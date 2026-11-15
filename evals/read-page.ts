/**
 * Reads a saved USC catalogue program page into a requirement tree.
 * The source is the HTML of the catalogue page. This module does not read
 * data/programs.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { CataloguePage } from "./catalogue-pages";
import { catalogueYear } from "./catalogue-pages";

export interface GoldenCourse {
  code: string;
  /** Null when the line prints more than one unit value. */
  units: number | null;
  unitChoices: number[];
  line: string;
}

export interface GoldenPick {
  all: GoldenCourse[];
  oneOf: GoldenCourse[][];
}

export type GoldenRule = "all" | "one" | "n" | "prose" | "note" | "total" | "tracks";

export interface GoldenNode {
  heading: string;
  quote: string;
  rule: GoldenRule;
  statedUnits: number | null;
  statedMin: number | null;
  statedMax: number | null;
  minCount: number | null;
  minUnits: number | null;
  picks: GoldenPick[];
  children: GoldenNode[];
}

export interface GoldenProgram {
  id: string;
  name: string;
  school: string;
  kind: "major" | "minor";
  url: string;
  catalogueYear: string;
  sourceFile: string;
  degreeSentence: string | null;
  gradeSentence: string | null;
  gradeCodes: string[];
  nodes: GoldenNode[];
}

interface MutableNode {
  heading: string;
  quote: string;
  rule: GoldenRule | "open";
  statedUnits: number | null;
  statedMin: number | null;
  statedMax: number | null;
  minCount: number | null;
  minUnits: number | null;
  picks: GoldenPick[];
  children: MutableNode[];
  level: number;
}

const WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
};

function squash(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function wordCount(value: string): number | null {
  const lower = value.toLowerCase();
  if (/^\d+$/.test(lower)) return Number(lower);
  return WORDS[lower] ?? null;
}

function unitSpan(text: string): { min: number | null; max: number | null } {
  const patterns = [
    /(?:\(|:\s*|^)\s*(\d+)(?:\s*(?:to|–|-)\s*(\d+))?\s*units?\b/i,
    /\bminimum(?:\s+of)?\s+(\d+)\s*units\b/i,
    /^units:\s*(\d+)(?:\s*(?:to|–|-)\s*(\d+))?/i,
    /total(?:\s+required)?\s+units:\s*(\d+)(?:\s*(?:to|–|-)\s*(\d+))?/i,
  ];
  for (const pattern of patterns) {
    const found = text.match(pattern);
    if (!found?.[1]) continue;
    const min = Number(found[1]);
    const max = found[2] ? Number(found[2]) : min;
    return { min, max };
  }
  return { min: null, max: null };
}

function countAsked(heading: string, quote: string): number | null {
  const head = heading.match(/\b(one|two|three|four|five|six|seven|eight|\d+)\s+courses?\b/i);
  if (head?.[1]) return wordCount(head[1]);
  const number = "(one|two|three|four|five|six|seven|eight|\\d+)(?!-)";
  const patterns = [
    new RegExp(`\\b(five|four|three|two|six)\\s+or\\s+(?:six|five|four|three|two)\\b`, "i"),
    new RegExp(`\\b(two|three|four|five|six)\\s+[A-Za-z]+\\s+courses\\b`, "i"),
    new RegExp(`\\bfollowing\\s+${number}\\s+courses?\\b`, "i"),
    new RegExp(`\\btotal of\\s+${number}\\s+courses?\\b`, "i"),
    new RegExp(`\\b(?:choose|take|select)\\s+${number}\\b`, "i"),
    new RegExp(`\\bat least\\s+${number}\\b`, "i"),
    new RegExp(`\\b${number}\\s+courses?\\s+from\\b`, "i"),
  ];
  for (const pattern of patterns) {
    const found = quote.match(pattern);
    if (found?.[1]) return wordCount(found[1]);
  }
  return null;
}

function chooseOne(text: string): boolean {
  return /\b(choose|take|select)\s+one\b|\bone\s+from\b|\bchoose either\b|\bchoose one from\b/i.test(text);
}

function parseCourse(raw: string): { course: GoldenCourse; orNext: boolean; andNext: boolean } | null {
  const line = squash(raw);
  const code = line.match(/^([A-Z]{2,8})\s+(\d{3}[A-Za-z]{0,4})\b/);
  if (!code) return null;
  const orNext = /\bor\s*\**\s*$/i.test(line);
  const andNext = !orNext && /\band\s*\**\s*$/i.test(line);
  const unitsText = line.match(/Units:\s*([0-9]+(?:\s*,\s*[0-9]+)*)/i);
  const choices = unitsText?.[1]?.split(",").map((part) => Number(part.trim())) ?? [];
  const units = choices.length === 1 ? choices[0] ?? null : null;
  return {
    course: {
      code: `${code[1]} ${code[2]}`,
      units,
      unitChoices: choices,
      line,
    },
    orNext,
    andNext,
  };
}

function adhocKind(text: string): "or" | "and" | "note" | "head" | "skip" {
  if (!text) return "skip";
  if (/^or$/i.test(text)) return "or";
  if (/^and$/i.test(text)) return "and";
  if (/^\*/.test(text) || /^note\b/i.test(text) || /^cannot take\b/i.test(text)) return "note";
  if (text.length > 70 && !/\b(units|choose|courses)\b/i.test(text)) return "note";
  return "head";
}

function blankNode(heading: string, quote: string, level = 2): MutableNode {
  const span = unitSpan(heading);
  const quoteSpan = span.min === null ? unitSpan(quote) : span;
  const single = quoteSpan.min !== null && quoteSpan.min === quoteSpan.max ? quoteSpan.min : null;
  return {
    heading,
    quote,
    rule: "open",
    statedUnits: single,
    statedMin: quoteSpan.min,
    statedMax: quoteSpan.max,
    minCount: null,
    minUnits: single,
    picks: [],
    children: [],
    level,
  };
}

function pickUnits(pick: GoldenPick): number | null {
  if (pick.all.some((course) => course.units === null)) return null;
  let sum = pick.all.reduce((total, course) => total + (course.units ?? 0), 0);
  for (const group of pick.oneOf) {
    if (group.some((course) => course.units === null)) return null;
    const values = group.map((course) => course.units ?? 0);
    sum += Math.min(...values);
  }
  return sum;
}

function lowerBound(node: MutableNode): number {
  let sum = 0;
  for (const pick of node.picks) {
    const exact = pickUnits(pick);
    if (exact !== null) {
      sum += exact;
      continue;
    }
    const known = [...pick.all, ...pick.oneOf.flat()].map((course) => course.units).filter((units): units is number => units !== null);
    if (known.length > 0) sum += Math.min(...known);
  }
  return sum;
}

function skeleton(node: MutableNode): number | null {
  let sum = 0;
  for (const pick of node.picks) {
    const units = pickUnits(pick);
    if (units === null) return null;
    sum += units;
  }
  for (const child of node.children) {
    if (child.rule === "note" || child.rule === "total") continue;
    if (child.statedUnits === null) return null;
    const childUnits = child.rule === "one" || child.rule === "n" ? child.statedUnits : child.statedUnits;
    sum += childUnits;
  }
  return sum;
}

function finishRule(node: MutableNode): void {
  if (node.rule !== "open") return;
  const words = `${node.heading} ${node.quote}`;
  if (/may be substituted/i.test(node.quote)) {
    node.rule = "note";
    return;
  }
  if (/^total\b/i.test(node.heading)) {
    node.rule = "total";
    return;
  }
  const asked = countAsked(node.heading, node.quote);
  const one = chooseOne(words) || asked === 1;
  if (one && node.children.length > 1 && /\band\b/i.test(node.quote)) {
    node.rule = "all";
    node.minCount = null;
    return;
  }
  const units = skeleton(node);
  if (node.picks.length === 0 && node.children.length === 0) {
    if (/^total\b/i.test(node.heading) || /total(?:\s+required)?\s+units/i.test(node.heading)) node.rule = "total";
    else if (/^(note|honors|scholarship|suggested)\b/i.test(node.heading) || /suggestions only/i.test(node.quote)) node.rule = "note";
    else node.rule = "prose";
    if (one) node.minCount = 1;
    else if (asked && /courses/i.test(words)) node.minCount = asked;
    return;
  }
  if (/suggestions only/i.test(node.quote)) {
    node.rule = "note";
    return;
  }
  if (one || (asked === 1 && /from|either|following/i.test(words))) {
    node.rule = "one";
    node.minCount = 1;
    if (node.statedUnits !== null) node.minUnits = node.statedUnits;
    return;
  }
  if (asked !== null && asked > 1 && /course/i.test(words)) {
    node.rule = "n";
    node.minCount = asked;
    if (node.statedUnits !== null) node.minUnits = node.statedUnits;
    return;
  }
  if (node.statedUnits !== null && units !== null && units > node.statedUnits + 0.05) {
    node.rule = "n";
    node.minUnits = node.statedUnits;
    const sizes = node.picks.map(pickUnits).filter((size): size is number => size !== null);
    if (sizes.length === node.picks.length && sizes.length > 0 && sizes.every((size) => size === sizes[0])) {
      const size = sizes[0] ?? 0;
      if (size > 0 && node.statedUnits % size === 0) {
        const count = node.statedUnits / size;
        node.minCount = count;
        if (count === 1) node.rule = "one";
      }
    }
    return;
  }
  if (node.statedUnits !== null && node.picks.length > 1 && lowerBound(node) > node.statedUnits + 0.05) {
    node.rule = "n";
    node.minUnits = node.statedUnits;
    return;
  }
  if (node.statedMin !== null && node.statedMax !== null && node.statedMin !== node.statedMax && node.picks.length > 1) {
    node.rule = "n";
    node.minCount = /\bone or two\b/i.test(words) ? 1 : node.minCount;
    node.minUnits = node.statedMin;
    return;
  }
  node.rule = "all";
  if (node.statedUnits !== null) node.minUnits = node.statedUnits;
}

function parseCore($: cheerio.CheerioAPI, el: Element): MutableNode {
  const headingNode = $(el).find("h2, h3, h4").first();
  const tag = headingNode.get(0)?.tagName ?? "";
  const level = tag === "h2" ? 2 : tag === "h3" ? 3 : tag === "h4" ? 4 : 0;
  let heading = squash(headingNode.text());
  const prose = $(el)
    .find("p")
    .map((_, paragraph) => squash($(paragraph).text()))
    .get()
    .filter(Boolean)
    .join(" ");
  if (!heading) {
    const clone = $(el).clone();
    clone.find("li.acalog-course").remove();
    heading = squash(clone.text()).slice(0, 160);
  }
  const root = blankNode(heading, squash(`${heading} ${prose}`), level);
  let current = root;
  let pick: GoldenPick | null = null;
  let openOr: GoldenCourse[] | null = null;
  let joinAnd = false;

  function flushOr(): void {
    if (!openOr || openOr.length === 0) {
      openOr = null;
      return;
    }
    pick = pick ?? { all: [], oneOf: [] };
    pick.oneOf.push(openOr);
    openOr = null;
  }

  function flushPick(): void {
    flushOr();
    if (pick && (pick.all.length > 0 || pick.oneOf.length > 0)) current.picks.push(pick);
    pick = null;
    joinAnd = false;
  }

  function addCourse(course: GoldenCourse, orNext: boolean, andNext: boolean): void {
    if (joinAnd) {
      pick = pick ?? { all: [], oneOf: [] };
      if (orNext) openOr = [course];
      else pick.all.push(course);
      joinAnd = andNext;
      return;
    }
    if (openOr) {
      openOr.push(course);
      if (!orNext) flushOr();
      if (andNext) joinAnd = true;
      return;
    }
    if (orNext) {
      flushPick();
      pick = { all: [], oneOf: [] };
      openOr = [course];
      return;
    }
    flushPick();
    pick = { all: [course], oneOf: [] };
    if (andNext) joinAnd = true;
  }

  function connectorOr(): void {
    if (openOr) return;
    if (pick && pick.all.length === 1 && pick.oneOf.length === 0) {
      openOr = [...pick.all];
      pick.all = [];
      return;
    }
    if (pick && pick.oneOf.length > 0 && pick.all.length === 0) {
      openOr = pick.oneOf.pop() ?? [];
      return;
    }
    if (pick && pick.all.length > 1) flushPick();
  }

  $(el)
    .find("li")
    .each((_, li) => {
      const classes = $(li).attr("class") ?? "";
      if (classes.includes("acalog-course")) {
        const parsed = parseCourse($(li).text());
        if (parsed) addCourse(parsed.course, parsed.orNext, parsed.andNext);
        return;
      }
      const label = squash($(li).text());
      const kind = adhocKind(label);
      if (kind === "skip") return;
      if (kind === "or") {
        connectorOr();
        return;
      }
      if (kind === "and") {
        flushOr();
        joinAnd = true;
        return;
      }
      if (kind === "note") {
        current.quote = squash(`${current.quote} ${label}`);
        return;
      }
      flushPick();
      const child = blankNode(label, squash(label), root.level + 1);
      root.children.push(child);
      current = child;
    });
  flushPick();
  const clone = $(el).clone();
  clone.find("li").remove();
  clone.find("h2, h3, h4, p, div").append(" ");
  root.quote = squash(clone.text()).slice(0, 700);
  return root;
}

function assemble(nodes: MutableNode[]): MutableNode[] {
  const roots: MutableNode[] = [];
  const stack: MutableNode[] = [];
  for (const node of nodes) {
    if (/^units:/i.test(node.heading) && node.picks.length === 0) {
      const parent = stack[stack.length - 1];
      if (parent && parent.statedUnits === null && node.statedMin !== null) {
        parent.statedMin = node.statedMin;
        parent.statedMax = node.statedMax;
        parent.statedUnits = node.statedMin === node.statedMax ? node.statedMin : null;
        parent.quote = squash(`${parent.quote} ${node.heading}`);
        continue;
      }
    }
    const level = node.level > 0 ? node.level : (stack[stack.length - 1]?.level ?? 1) + 1;
    while (stack.length > 0 && (stack[stack.length - 1]?.level ?? 2) >= level) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  for (const node of roots) finishDeep(node, false);
  for (const node of roots) markPools(node);
  for (const node of roots) unsettleTracks(node, false);
  return roots;
}

function finishDeep(node: MutableNode, inheritedNote: boolean): void {
  const ownNote = inheritedNote || /suggested tracks/i.test(node.heading) || /suggestions only/i.test(node.quote);
  if (ownNote) node.rule = "note";
  for (const child of node.children) finishDeep(child, ownNote);
  finishRule(node);
  const counts = node.children.map((child) => child.minCount ?? 0);
  const sum = counts.reduce((total, count) => total + count, 0);
  if (node.picks.length === 0 && node.minCount !== null && node.children.length > 0 && counts.every((count) => count > 0) && sum === node.minCount) {
    node.rule = "all";
  }
}

function markPools(node: MutableNode): void {
  for (const child of node.children) markPools(child);
  const menu = node.picks.length >= 8 && node.statedUnits === null && node.rule === "all";
  const namedList = /^(list|elective courses|graduate courses)\b/i.test(node.heading);
  if (menu || (namedList && node.picks.length > 1 && node.rule === "all")) node.rule = "n";
}

function unsettleTracks(node: MutableNode, underChoice: boolean): void {
  const choice = underChoice || /choose one of the following/i.test(`${node.heading} ${node.quote}`);
  if (!choice && /\btrack\b/i.test(node.heading) && node.rule === "all") node.rule = "tracks";
  for (const child of node.children) unsettleTracks(child, choice || node.rule === "one");
}


function freeze(node: MutableNode): GoldenNode {
  const rule: GoldenRule = node.rule === "open" ? "prose" : node.rule;
  return {
    heading: node.heading,
    quote: node.quote,
    rule,
    statedUnits: node.statedUnits,
    statedMin: node.statedMin,
    statedMax: node.statedMax,
    minCount: node.minCount,
    minUnits: node.minUnits,
    picks: node.picks,
    children: node.children.map(freeze),
  };
}

function pageFile(page: CataloguePage): string {
  return join("data/raw", catalogueYear, `catalogue_usc_edu_preview_program_php_catoid_22_poid_${page.poid}.html`);
}

export function readCataloguePage(page: CataloguePage, root = process.cwd()): GoldenProgram {
  const sourceFile = pageFile(page);
  const html = readFileSync(join(root, sourceFile), "utf8");
  const $ = cheerio.load(html);
  const description = squash($(".program_description").text());
  const degree = description.match(/The requirement for the degree is \d+ units\./)?.[0] ?? description.match(/\b\d+ units\b/)?.[0] ?? null;
  const gradeSentence = description.match(/A grade of C \(2\.0\) or better is required[^.]*\./)?.[0] ?? null;
  const gradeCodes = gradeSentence?.match(/[A-Z]{2,8}\s+\d{3}[A-Za-z]{0,4}/g) ?? [];
  const cores = $(".custom_leftpad_20 > .acalog-core")
    .toArray()
    .map((el) => parseCore($, el));
  const nodes = assemble(cores).map(freeze);
  return {
    id: page.id,
    name: page.name,
    school: page.school,
    kind: page.kind,
    url: page.url,
    catalogueYear,
    sourceFile,
    degreeSentence: degree,
    gradeSentence,
    gradeCodes,
    nodes,
  };
}

export function listedCourses(node: GoldenNode, includeNotes = false): GoldenCourse[] {
  if (!includeNotes && (node.rule === "note" || node.rule === "total")) return [];
  const own = node.picks.flatMap((pick) => [...pick.all, ...pick.oneOf.flat()]);
  return [...own, ...node.children.flatMap((child) => listedCourses(child, includeNotes))];
}
