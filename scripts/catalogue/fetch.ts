import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { chromium, type BrowserContext } from "playwright-core";

/**
 * The USC catalogue (catalogue.usc.edu) sits behind a JavaScript challenge, so a plain
 * HTTP client gets an empty 202. A real browser loads the same public pages. Pages are
 * fetched one at a time with a pause between requests and cached under data/raw/.
 */

export const CATALOGUE_HOST = "https://catalogue.usc.edu";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((value): value is string => Boolean(value));

export function chromePath(): string {
  const found = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error("No Chrome found. Set CHROME_PATH to a Chrome or Chromium binary.");
  }
  return found;
}

export function cacheFileFor(cacheDir: string, url: string): string {
  const name = url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return path.join(cacheDir, `${name}.html`);
}

/**
 * Keeps only the catalogue's main content cell so cached pages stay small enough to commit.
 * Scripts, navigation, and the search form are dropped.
 */
export function slimPage(html: string): string {
  const $ = cheerio.load(html);
  const main = $("td.block_content").filter((_, el) => $(el).find("#acalog-page-title, #course_preview_title").length > 0).first();
  if (!main.length) return html;
  main.find("script, style, .gateway-toolbar, #gateway-toolbar-container").remove();
  return `<!doctype html><html><body><table><tr>${$.html(main)}</tr></table></body></html>`;
}

export interface FetchOptions {
  cacheDir: string;
  /** Ignore the cache and fetch again. */
  refresh?: boolean;
  pauseMs?: number;
  log?: (message: string) => void;
}

export class CataloguePages {
  private context: BrowserContext | null = null;
  private close: (() => Promise<void>) | null = null;

  constructor(private readonly options: FetchOptions) {
    mkdirSync(options.cacheDir, { recursive: true });
  }

  private async open(): Promise<BrowserContext> {
    if (this.context) return this.context;
    const browser = await chromium.launch({ executablePath: chromePath(), headless: true });
    this.context = await browser.newContext();
    this.close = () => browser.close();
    return this.context;
  }

  async get(url: string): Promise<string> {
    const file = cacheFileFor(this.options.cacheDir, url);
    if (!this.options.refresh && existsSync(file)) return readFileSync(file, "utf8");
    const context = await this.open();
    const page = await context.newPage();
    try {
      let html = "";
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
          await page.waitForTimeout(1500 + attempt * 3000);
          await page.waitForLoadState("load", { timeout: 30_000 }).catch(() => undefined);
          html = await page.content();
          if (html.length > 5000 && !html.includes("awsWafCookieDomainList")) break;
        } catch {
          html = "";
        }
      }
      if (html.length <= 5000) throw new Error(`Page came back empty: ${url}`);
      html = slimPage(html);
      writeFileSync(file, html);
      this.options.log?.(`fetched ${url}`);
      await page.waitForTimeout(this.options.pauseMs ?? 700);
      return html;
    } finally {
      await page.close();
    }
  }

  async dispose(): Promise<void> {
    await this.close?.();
    this.context = null;
    this.close = null;
  }
}
