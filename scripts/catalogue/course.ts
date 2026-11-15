import * as cheerio from "cheerio";
import type { PrerequisiteExpr, TermOffering } from "../../lib/types";

/**
 * Reads one catalogue course page (preview_course_nopop.php). Prerequisite links carry a
 * coid, which is how a printed "CSCI 102" is tied to the course CSCI 102L without guessing.
 */

export interface RawCourse {
  coid: string;
  code: string;
  title: string;
  unitsText: string;
  termsText: string | null;
  description: string;
  prerequisiteText: string | null;
  corequisiteText: string | null;
  /** Prerequisite text with each link replaced by a marker, for the parser. */
  prerequisiteMarked: string | null;
  corequisiteMarked: string | null;
  links: Record<string, string>;
}

function clean(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

const TITLE = /^([A-Z]{2,5}) (\d{3}[A-Za-z]{0,4}) (.*)$/;

function sectionHtml(html: string, label: string): string | null {
  const pattern = new RegExp(`<em>\\s*${label}[^<]*</em>\\s*:?\\s*`, "i");
  const match = pattern.exec(html);
  if (!match) return null;
  const rest = html.slice(match.index + match[0].length);
  const end = rest.search(/<br\s*\/?>|<em>/i);
  return end === -1 ? rest : rest.slice(0, end);
}

function mark(fragment: string, links: Record<string, string>): { marked: string; text: string } {
  const $ = cheerio.load(`<div id="root">${fragment}</div>`);
  $("#root a").each((_, anchor) => {
    const href = $(anchor).attr("href") ?? "";
    const coid = /coid=(\d+)/.exec(href)?.[1];
    const label = clean($(anchor).text());
    if (coid) {
      links[coid] = label;
      $(anchor).replaceWith(` ⟦${coid}⟧ `);
    }
  });
  $("#root span[style*='display: none']").remove();
  const marked = clean($("#root").text());
  const text = clean(marked.replace(/⟦(\d+)⟧/g, (_, coid: string) => links[coid] ?? coid));
  return { marked, text };
}

export function parseRawCourse(html: string, coid: string): RawCourse {
  const $ = cheerio.load(html);
  const title = clean($("#course_preview_title").first().text());
  const match = TITLE.exec(title);
  const bodyHtml = $("td.block_content").first().html() ?? html;
  const unitsText = clean(/Units:\s*([^<]*)</.exec(bodyHtml)?.[1] ?? "");
  const termsText = clean(/Terms Offered:\s*([^<]*)</.exec(bodyHtml)?.[1] ?? "") || null;
  const links: Record<string, string> = {};
  const prereq = sectionHtml(bodyHtml, "Prerequisite");
  const coreq =
    sectionHtml(bodyHtml, "Corequisite") ??
    sectionHtml(bodyHtml, "Concurrent Enrollment");
  const prereqMarked = prereq ? mark(prereq, links) : null;
  const coreqMarked = coreq ? mark(coreq, links) : null;
  const description = clean(
    cheerio
      .load(`<div>${bodyHtml.split("<hr>").slice(1).join(" ").split("<br>")[0] ?? ""}</div>`)("div")
      .text(),
  );
  return {
    coid,
    code: match ? `${match[1]} ${match[2]}` : title,
    title: match ? match[3] : title,
    unitsText,
    termsText,
    description,
    prerequisiteText: prereqMarked?.text ?? null,
    corequisiteText: coreqMarked?.text ?? null,
    prerequisiteMarked: prereqMarked?.marked ?? null,
    corequisiteMarked: coreqMarked?.marked ?? null,
    links,
  };
}

export function offeringsFrom(termsText: string | null): { offerings: TermOffering[]; confirmed: boolean } {
  if (!termsText) return { offerings: ["irregular"], confirmed: false };
  const found: TermOffering[] = [];
  if (/Fa/.test(termsText)) found.push("fall");
  if (/Sp/.test(termsText)) found.push("spring");
  if (/Sm/.test(termsText)) found.push("summer");
  if (found.length === 0) return { offerings: ["irregular"], confirmed: false };
  return { offerings: found, confirmed: true };
}

type Token = { kind: "course"; coid: string } | { kind: "and" } | { kind: "or" } | { kind: "open" } | { kind: "close" };

function tokenize(marked: string): Token[] | null {
  const tokens: Token[] = [];
  const pattern = /⟦(\d+)⟧|\b(and)\b|\b(or)\b|([(),;])|([^\s⟦(),;]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(marked))) {
    if (match[1]) tokens.push({ kind: "course", coid: match[1] });
    else if (match[2]) tokens.push({ kind: "and" });
    else if (match[3]) tokens.push({ kind: "or" });
    else if (match[4] === "(") tokens.push({ kind: "open" });
    else if (match[4] === ")") tokens.push({ kind: "close" });
    else if (match[4] === "," || match[4] === ";") tokens.push({ kind: "and" });
    else return null;
  }
  return tokens;
}

/**
 * Builds a boolean tree from marked prerequisite text. Returns null when the text has
 * anything beyond course links, "and", "or", commas, semicolons, and parentheses, or when
 * "and" and "or" meet at one level without parentheses. Null means a person must read it.
 */
export function parseCourseExpression(
  marked: string,
  codeFor: (coid: string) => string | null,
): PrerequisiteExpr | null {
  const tokens = tokenize(marked);
  if (!tokens || tokens.length === 0) return null;
  let index = 0;

  function atom(): PrerequisiteExpr | null {
    const token = tokens![index];
    if (!token) return null;
    if (token.kind === "course") {
      index += 1;
      const code = codeFor(token.coid);
      return code ? { type: "course", code } : null;
    }
    if (token.kind === "open") {
      index += 1;
      const inner = group();
      if (!inner || tokens![index]?.kind !== "close") return null;
      index += 1;
      return inner;
    }
    return null;
  }

  function group(): PrerequisiteExpr | null {
    const first = atom();
    if (!first) return null;
    const parts = [first];
    let joiner: "and" | "or" | null = null;
    for (;;) {
      const token = tokens![index];
      if (!token || token.kind === "close") break;
      if (token.kind !== "and" && token.kind !== "or") return null;
      if (joiner && joiner !== token.kind) return null;
      joiner = token.kind;
      index += 1;
      const next = atom();
      if (!next) return null;
      parts.push(next);
    }
    if (parts.length === 1) return parts[0];
    if (joiner === "and") return { type: "all_of", children: parts };
    return { type: "n_of", minCount: 1, children: parts };
  }

  const tree = group();
  if (!tree || index !== tokens.length) return null;
  return tree;
}

export function courseCodesIn(expr: PrerequisiteExpr | null, out: string[] = []): string[] {
  if (!expr) return out;
  if (expr.type === "course") out.push(expr.code);
  else expr.children.forEach((child) => courseCodesIn(child, out));
  return out;
}
