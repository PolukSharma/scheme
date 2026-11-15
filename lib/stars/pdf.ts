import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { WorkerMessageHandler } from "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { htmlToReportText, parseStarsText, StarsParseError, type StarsParseOptions, type StarsParseSuccess } from "./parse";

const scope = globalThis as typeof globalThis & {
  pdfjsWorker?: { WorkerMessageHandler: typeof WorkerMessageHandler };
};
scope.pdfjsWorker = { WorkerMessageHandler };

interface PdfTextItem {
  str: string;
  transform: number[];
  width?: number;
}

function linesFromPage(items: readonly PdfTextItem[]): string {
  const rows: { y: number; parts: { x: number; end: number; str: string }[] }[] = [];
  for (const item of items) {
    if (!item.str) continue;
    const x = item.transform[4] ?? 0;
    const y = item.transform[5] ?? 0;
    const width = item.width ?? item.str.length * 4;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 2);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x, end: x + width, str: item.str });
  }
  rows.sort((left, right) => right.y - left.y);
  return rows
    .map((row) => {
      const parts = [...row.parts].sort((left, right) => left.x - right.x);
      let line = "";
      let cursor = 0;
      for (const part of parts) {
        const gap = part.x - cursor;
        if (line && gap > 1.2 && !/\s$/.test(line) && !/^\s/.test(part.str)) line += " ";
        line += part.str;
        cursor = Math.max(cursor, part.end);
      }
      return line;
    })
    .join("\n");
}

/**
 * Read PDF text inside this page. The worker is the bundled copy, not a request.
 */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  const task = getDocument({
    data,
    useWorkerFetch: false,
    useWasm: false,
    disableFontFace: true,
    useSystemFonts: false,
  });
  try {
    const document = await task.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const item of content.items) {
        if ("str" in item) items.push({ str: item.str, transform: item.transform, width: item.width });
      }
      pages.push(linesFromPage(items));
    }
    return pages.join("\n");
  } finally {
    await task.destroy();
  }
}

export async function parseStarsFile(
  data: ArrayBuffer | Uint8Array,
  options: StarsParseOptions & { mimeType?: string; fileName?: string } = {},
): Promise<StarsParseSuccess> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const name = options.fileName?.toLowerCase() ?? "";
  const mime = options.mimeType?.toLowerCase() ?? "";
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 5));
  if (head === "%PDF-" || mime.includes("pdf") || name.endsWith(".pdf")) {
    try {
      const text = await extractPdfText(bytes);
      return parseStarsText(text, options);
    } catch (error) {
      if (error instanceof StarsParseError) throw error;
      throw new StarsParseError("This PDF could not be read in the browser. Enter courses by hand.");
    }
  }
  const decoded = new TextDecoder("utf-8").decode(bytes);
  const looksHtml = mime.includes("html") || name.endsWith(".html") || name.endsWith(".htm") || /<html|<pre|<body/i.test(decoded);
  return parseStarsText(looksHtml ? htmlToReportText(decoded) : decoded, options);
}
