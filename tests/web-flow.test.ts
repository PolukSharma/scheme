import { spawn, type ChildProcess } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import axe from "axe-core";
import { chromium, type Browser, type Page } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const port = 4173;
const base = `http://127.0.0.1:${port}`;
const chromeCandidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((candidate): candidate is string => Boolean(candidate));

async function chromePath(): Promise<string> {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try the next installed browser
    }
  }
  throw new Error("No Chrome or Chromium binary found for the web flow test.");
}

async function startApp(): Promise<ChildProcess> {
  const child = spawn(path.join(root, "node_modules", ".bin", "next"), ["dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    if (output.includes("Ready") || output.includes("Local:")) return child;
    if (child.exitCode !== null) throw new Error("The dev server exited before it was ready.");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  child.kill("SIGTERM");
  throw new Error("The dev server did not become ready.");
}

async function seriousViolations(page: Page): Promise<string[]> {
  const source = axe.source;
  const violations = await page.evaluate(async (script) => {
    const tag = document.createElement("script");
    tag.textContent = script;
    document.documentElement.appendChild(tag);
    const runner = (window as unknown as { axe: { run: (node: Document) => Promise<{ violations: { id: string; impact: string | null; help: string }[] }> } }).axe;
    const result = await runner.run(document);
    return result.violations
      .filter((item) => item.impact === "serious" || item.impact === "critical")
      .map((item) => `${item.id}: ${item.help}`);
  }, source);
  return violations;
}

describe("web flow", () => {
  let server: ChildProcess | undefined;
  let browser: Browser | undefined;

  afterAll(async () => {
    await browser?.close();
    server?.kill("SIGTERM");
  });

  it("walks every sample student on a phone and on a desktop", async () => {
    server = await startApp();
    browser = await chromium.launch({
      executablePath: await chromePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const samples = ["Early", "Mid", "Late"] as const;
    const widths = [
      { width: 390, height: 844 },
      { width: 1280, height: 800 },
    ];
    let checkedAxe = false;
    for (const viewport of widths) {
      for (const sample of samples) {
        const page = await browser.newPage({ viewport });
        await page.goto(base);
        await page.locator("main[data-ready='true']").waitFor();
        const sc = await page.locator(".scheme-sc").first().evaluate((node) => getComputedStyle(node).color);
        const rest = await page.locator(".scheme-rest").first().evaluate((node) => getComputedStyle(node).color);
        expect(sc).toBe("rgb(153, 0, 0)");
        expect(rest).toBe("rgb(0, 0, 0)");
        await page.getByText("STARS remains the official audit.").first().waitFor();
        await page.getByRole("button", { name: "Try a sample student" }).click();
        await page.getByRole("button", { name: sample }).click();
        await page.getByRole("heading", { name: "Scheme results" }).waitFor();
        await page.getByText("extra terms").first().waitFor({ timeout: 30_000 });
        expect(await page.getByText("Unverified").first().isVisible()).toBe(true);
        expect(await page.getByText("Different school").first().isVisible()).toBe(true);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
        expect(overflow).toBe(true);
        if (!checkedAxe && viewport.width === 1280 && sample === "Early") {
          expect(await seriousViolations(page)).toEqual([]);
          await page.getByRole("tab", { name: "Best for my career goal" }).click();
          await page.getByText("Career matching is unavailable").waitFor();
          await page.getByText("Chat is unavailable").waitFor();
          expect(await seriousViolations(page)).toEqual([]);
          checkedAxe = true;
        }
        await page.getByRole("button", { name: /^Open / }).first().click();
        await page.getByRole("heading", { name: "Requirements" }).waitFor({ timeout: 30_000 });
        expect(await page.getByRole("link", { name: /Catalogue/ }).first().isVisible()).toBe(true);
        await page.getByRole("button", { name: "Advisor PDF" }).click();
        await page.getByRole("heading", { name: "Scheme advisor copy" }).waitFor();
        expect(await page.getByLabel("Name on the advisor copy").isVisible()).toBe(true);
        await page.emulateMedia({ media: "print" });
        const ink = await page.locator(".advisor-sheet").evaluate((node) => getComputedStyle(node).color);
        expect(ink).toBe("rgb(0, 0, 0)");
        await page.close();
      }
    }
    const keyboard = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await keyboard.goto(base);
    await keyboard.locator("main[data-ready='true']").waitFor();
    async function tabTo(text: string) {
      for (let step = 0; step < 8; step += 1) {
        const current = await keyboard.evaluate(() => document.activeElement?.textContent ?? "");
        if (current.includes(text)) return;
        await keyboard.keyboard.press("Tab");
      }
      expect(await keyboard.evaluate(() => document.activeElement?.textContent ?? "")).toContain(text);
    }
    await tabTo("Try a sample student");
    await keyboard.keyboard.press("Enter");
    await keyboard.getByRole("button", { name: "Early" }).waitFor();
    await tabTo("Early");
    await keyboard.keyboard.press("Enter");
    await keyboard.getByRole("heading", { name: "Scheme results" }).waitFor();
    await keyboard.getByText("extra terms").first().waitFor({ timeout: 30_000 });
    const intake = await browser.newPage();
    await intake.goto(base);
    await intake.locator("main[data-ready='true']").waitFor();
    await intake.getByRole("button", { name: "Add my courses" }).click();
    await intake.getByRole("tab", { name: "Enter courses" }).click();
    expect(await intake.getByLabel("Major").isVisible()).toBe(true);
    expect(await intake.getByLabel("Start year").isVisible()).toBe(true);
    await intake.goto(`${base}/accuracy`);
    await intake.getByRole("heading", { name: "Scheme accuracy" }).waitFor();
    expect(await intake.getByText(/accuracy\.json/).isVisible()).toBe(true);
    await keyboard.close();
    await intake.close();
  }, 180_000);
});
