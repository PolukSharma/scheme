import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";

/**
 * Turns an Acalog program page (catalogue.usc.edu/preview_program.php) into a plain outline:
 * headings, prose lines, and course lines in page order. No interpretation happens here.
 */

export interface OutlineCourse {
  kind: "course";
  code: string;
  title: string;
  /** Units text exactly as printed, for example "4" or "2 or". */
  unitsText: string;
  coid: string;
}

export interface OutlineText {
  kind: "text";
  text: string;
}

export interface OutlineBlock {
  kind: "block";
  heading: string;
  level: number;
  children: OutlineItem[];
}

export type OutlineItem = OutlineCourse | OutlineText | OutlineBlock;

export interface ProgramPage {
  catalogueName: string;
  title: string;
  description: string;
  outline: OutlineItem[];
}

function clean(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COURSE_LINK = /^([A-Z]{2,5}) (\d{3}[A-Za-z]{0,4}) (.*)$/;

function parseCourse($: cheerio.CheerioAPI, li: Element): OutlineCourse | null {
  const anchor = $(li).find("a[onclick*='showCourse']").first();
  const label = clean(anchor.text());
  const match = COURSE_LINK.exec(label);
  if (!match) return null;
  const onclick = anchor.attr("onclick") ?? "";
  const coid = /showCourse\('\d+', '(\d+)'/.exec(onclick)?.[1] ?? "";
  const span = clean($(li).children("span").first().text());
  const unitsText = clean(span.slice(span.indexOf("Units:") + "Units:".length));
  return {
    kind: "course",
    code: `${match[1]} ${match[2]}`,
    title: match[3],
    unitsText: span.includes("Units:") ? unitsText : "",
    coid,
  };
}

function walkList($: cheerio.CheerioAPI, ul: Element, out: OutlineItem[]): void {
  for (const child of $(ul).children("li").toArray()) {
    const li = child as Element;
    if ($(li).hasClass("acalog-course")) {
      const course = parseCourse($, li);
      if (course) out.push(course);
      $(li)
        .children("ul")
        .each((_, nested) => walkList($, nested as Element, out));
      continue;
    }
    const text = clean($(li).text());
    if (text) out.push({ kind: "text", text });
    $(li)
      .children("ul")
      .each((_, nested) => walkList($, nested as Element, out));
  }
}

function walkContainer($: cheerio.CheerioAPI, container: Element, out: OutlineItem[]): void {
  for (const node of $(container).contents().toArray() as AnyNode[]) {
    if (node.type !== "tag") continue;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === "ul") {
      walkList($, el, out);
    } else if (tag === "div" && $(el).hasClass("acalog-core")) {
      out.push(walkCore($, el));
    } else if (tag === "div" && $(el).hasClass("custom_leftpad_20")) {
      const last = out[out.length - 1];
      walkContainer($, el, last && last.kind === "block" ? last.children : out);
    } else if (tag === "p" || tag === "div") {
      const text = clean($(el).text());
      if (text) out.push({ kind: "text", text });
    }
  }
}

function walkCore($: cheerio.CheerioAPI, core: Element): OutlineBlock {
  const heading = $(core).children("h2, h3, h4, h5, h6").first();
  const level = heading.length ? Number(heading.prop("tagName")?.toString().slice(1) ?? 2) : 2;
  const block: OutlineBlock = {
    kind: "block",
    heading: clean(heading.text()),
    level,
    children: [],
  };
  walkContainer($, core, block.children);
  return block;
}

export function parseProgramPage(html: string): ProgramPage {
  const $ = cheerio.load(html);
  const catalogueName = clean($(".acalog_catalog_name").first().text());
  const title = clean($("#acalog-page-title").first().text());
  const description = clean($(".program_description").first().text());
  const outline: OutlineItem[] = [];
  const root = $("div.acalog-core").first().parent();
  if (root.length) walkContainer($, root.get(0) as Element, outline);
  return { catalogueName, title, description, outline };
}

export function renderOutline(items: readonly OutlineItem[], depth = 0): string {
  const pad = "  ".repeat(depth);
  const lines: string[] = [];
  for (const item of items) {
    if (item.kind === "course") {
      lines.push(`${pad}- ${item.code} ${item.title} [${item.unitsText}]`);
    } else if (item.kind === "text") {
      lines.push(`${pad}  "${item.text}"`);
    } else {
      lines.push(`${pad}## ${item.heading}`);
      lines.push(renderOutline(item.children, depth + 1));
    }
  }
  return lines.join("\n");
}

export interface CourseDetail {
  code: string;
  title: string;
  units: string;
  description: string;
  prerequisiteText: string | null;
  corequisiteText: string | null;
  recommendedText: string | null;
  crossListedText: string | null;
  termsText: string | null;
}

function labelledText($: cheerio.CheerioAPI, label: string): string | null {
  const hit = $("strong")
    .toArray()
    .find((el) => clean($(el).text()).toLowerCase().startsWith(label.toLowerCase()));
  if (!hit) return null;
  let text = "";
  let node = hit.nextSibling;
  while (node) {
    if (node.type === "tag") {
      const el = node as Element;
      if (el.tagName.toLowerCase() === "br" || el.tagName.toLowerCase() === "strong") break;
      text += $(el).text();
    } else if (node.type === "text") {
      text += (node as unknown as { data: string }).data;
    }
    node = node.nextSibling;
  }
  const out = clean(text).replace(/^:\s*/, "");
  return out || null;
}

export function parseCoursePage(html: string): CourseDetail {
  const $ = cheerio.load(html);
  const heading = clean($("#course_preview_title, h1").first().text());
  const match = COURSE_LINK.exec(heading);
  const block = $(".block_content").first();
  const bodyText = clean(block.text());
  const units = /Units:\s*([0-9.\-– ]+(?:or [0-9.]+)?)/.exec(bodyText)?.[1]?.trim() ?? "";
  return {
    code: match ? `${match[1]} ${match[2]}` : heading,
    title: match ? match[3] : heading,
    units,
    description: bodyText,
    prerequisiteText: labelledText($, "Prerequisite"),
    corequisiteText: labelledText($, "Corequisite"),
    recommendedText: labelledText($, "Recommended"),
    crossListedText: labelledText($, "Crosslisted") ?? labelledText($, "Cross-listed"),
    termsText: labelledText($, "Terms Offered") ?? labelledText($, "Term"),
  };
}
