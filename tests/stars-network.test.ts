import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page, type Request } from "playwright-core";
import { textPdf } from "./stars-pdf";

const root = path.resolve(import.meta.dirname, "..");
const chromeCandidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((candidate): candidate is string => Boolean(candidate));

async function chromePath(): Promise<string> {
  const { access } = await import("node:fs/promises");
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try the next installed browser
    }
  }
  throw new Error("No Chrome or Chromium binary found for the STARS browser test.");
}

async function serve(dir: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const target = path.join(dir, relative);
    if (!target.startsWith(dir)) {
      response.writeHead(403);
      response.end();
      return;
    }
    try {
      const body = await readFile(target);
      const type = target.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8";
      response.writeHead(200, { "content-type": type, "cache-control": "no-store" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The test server did not bind.");
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

describe("STARS drop zone", () => {
  let browser: Browser | undefined;
  let page: Page | undefined;
  let directory: string | undefined;
  let closeServer: (() => Promise<void>) | undefined;

  afterAll(async () => {
    await page?.close();
    await browser?.close();
    await closeServer?.();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("makes no network request when a report is dropped", async () => {
    const esbuild = await import("esbuild");
    directory = await mkdtemp(path.join(tmpdir(), "stars-browser-"));
    await esbuild.build({
      entryPoints: [path.join(root, "tests/stars-browser/entry.tsx")],
      bundle: true,
      platform: "browser",
      format: "esm",
      target: "es2022",
      jsx: "automatic",
      outfile: path.join(directory, "app.js"),
      alias: { "@": root },
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
    });
    await writeFile(
      path.join(directory, "index.html"),
      `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><div id="root"></div><script type="module" src="./app.js"></script></body></html>`,
    );
    const server = await serve(directory);
    closeServer = server.close;
    browser = await chromium.launch({
      executablePath: await chromePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    page = await browser.newPage();
    const seen: string[] = [];
    const count = () => seen.length;
    page.on("request", (request: Request) => {
      seen.push(request.url());
    });
    await page.addInitScript(() => {
      const mark = () => {
        const counter = window as Window & { __net?: number };
        counter.__net = (counter.__net ?? 0) + 1;
      };
      const originalFetch = window.fetch.bind(window);
      window.fetch = ((...args: Parameters<typeof fetch>) => {
        mark();
        return originalFetch(...args);
      }) as typeof fetch;
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function open(this: XMLHttpRequest, method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null) {
        mark();
        originalOpen.call(this, method, url, async ?? true, username, password);
      };
      const originalBeacon = navigator.sendBeacon?.bind(navigator);
      if (originalBeacon) {
        navigator.sendBeacon = ((...args: Parameters<typeof navigator.sendBeacon>) => {
          mark();
          return originalBeacon(...args);
        }) as typeof navigator.sendBeacon;
      }
      const OriginalSocket = window.WebSocket;
      window.WebSocket = new Proxy(OriginalSocket, {
        construct(target, args) {
          mark();
          return new target(...(args as ConstructorParameters<typeof WebSocket>));
        },
      });
      const OriginalSource = window.EventSource;
      window.EventSource = new Proxy(OriginalSource, {
        construct(target, args) {
          mark();
          return new target(...(args as ConstructorParameters<typeof EventSource>));
        },
      });
    });
    await page.goto(server.url);
    await page.getByText("Parsed in your browser. Your report is never uploaded.").waitFor();
    const early = await readFile(path.join(root, "fixtures/stars/early.txt"));
    const html = await readFile(path.join(root, "fixtures/stars/early.html"));
    const pdf = textPdf(early.toString("utf8").split(/\r?\n/));
    await writeFile(path.join(directory, "early.txt"), early);
    await writeFile(path.join(directory, "early.html"), html);
    await writeFile(path.join(directory, "early.pdf"), pdf);
    const input = page.locator("#stars-file");

    async function drop(name: string, mime: string) {
      const beforeRequests = count();
      const beforeNet = await page!.evaluate(() => (window as Window & { __net?: number }).__net ?? 0);
      const beforeGeneration = await page!.locator("#stars-result").getAttribute("data-generation");
      await input.setInputFiles({
        name,
        mimeType: mime,
        buffer: await readFile(path.join(directory!, name)),
      });
      await expect
        .poll(async () => page!.locator("#stars-result").getAttribute("data-generation"), { timeout: 20_000 })
        .not.toBe(beforeGeneration);
      expect(await page!.locator("#stars-result").innerText()).toContain("computer-science-bs 3");
      expect(count()).toBe(beforeRequests);
      expect(await page!.evaluate(() => (window as Window & { __net?: number }).__net ?? 0)).toBe(beforeNet);
    }

    await drop("early.txt", "text/plain");
    await drop("early.html", "text/html");
    await drop("early.pdf", "application/pdf");

    const beforePaste = await page.locator("#stars-result").getAttribute("data-generation");
    await page.locator("#stars-paste").fill(early.toString("utf8"));
    await page.getByRole("button", { name: "Read pasted text" }).click();
    await expect
      .poll(async () => page!.locator("#stars-result").getAttribute("data-generation"), { timeout: 20_000 })
      .not.toBe(beforePaste);
    expect(await page.locator("#stars-result").innerText()).toContain("computer-science-bs 3");
    expect(await page.locator("#stars-paste").inputValue()).toBe("");

    const beforeRequests = count();
    await input.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a report") });
    await page.getByRole("button", { name: "Enter courses by hand" }).waitFor();
    expect(count()).toBe(beforeRequests);
    expect(await page.evaluate(() => (window as Window & { __net?: number }).__net ?? 0)).toBe(0);
    expect(page.url().startsWith(server.url)).toBe(true);
  }, 60_000);
});
