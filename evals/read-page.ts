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
  pull: "tracks" | "either" | null;
  trackCount: number | null;
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

function countAsked(text: string): number | null {
  const patterns = [
    /\b(?:choose|take|select)\s+(one|two|three|four|five|six|seven|eight|\d+)\b/i,
    /\b(one|two|three|four|five|six|seven|eight|\d+)\s+courses?\s+from\b/i,
    /\b(one|two|three|four|five|six|seven|eight|\d+)\s+courses?\b/i,
  ];
  for (const pattern of patterns) {
    const found = text.match(pattern);
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

function blankNode(heading: string, quote: string): MutableNode {
  const span = unitSpan(heading) ;
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
    pull: null,
    trackCount: null,
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
  const asked = countAsked(words);
  const one = chooseOne(words);
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
      if (size > 0 && node.statedUnits % size === 0) node.minCount = node.statedUnits / size;
    }
    return;
  }
  node.rule = "all";
  if (node.statedUnits !== null) node.minUnits = node.statedUnits;
}

function parseCore($: cheerio.CheerioAPI, el: Element): MutableNode {
  const headingNode = $(el).find("h2, h3").first();
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
  const root = blankNode(heading, squash(`${heading} ${prose}`));
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
      const child = blankNode(label, squash(`${label}`));
      current.children.push(child);
      current = child;
    });
  flushPick();
  const words = `${root.heading} ${root.quote}`;
  if (/choose one of the following(?:\s+\w+)?\s+tracks/i.test(words) || /choose one of the following tracks/i.test(words)) {
    root.pull = "tracks";
    root.trackCount = countAsked(words);
  } else if (/choose either/i.test(words)) {
    root.pull = "either";
  }
  return root;
}

function isTrackStart(node: MutableNode): boolean {
  return /\btrack\b/i.test(node.heading) || /^\d+\.?$/.test(node.heading.trim());
}

function isCloser(node: MutableNode): boolean {
  return /^(practicum|free elective|total)\b/i.test(node.heading);
}

function pullGroups(nodes: MutableNode[]): MutableNode[] {
  const out: MutableNode[] = [];
  let index = 0;
  while (index < nodes.length) {
    const node = nodes[index];
    if (!node) break;
    if (node.pull === "tracks") {
      const wanted = node.trackCount ?? 3;
      const tracks: MutableNode[] = [];
      let cursor = index + 1;
      while (cursor < nodes.length && tracks.length < wanted) {
        const start = nodes[cursor];
        if (!start || !isTrackStart(start)) break;
        const extras: MutableNode[] = [];
        let next = cursor + 1;
        while (next < nodes.length) {
          const candidate = nodes[next];
          if (!candidate || isTrackStart(candidate) || isCloser(candidate)) break;
          extras.push(candidate);
          next += 1;
        }
        start.children = [...start.children, ...extras];
        tracks.push(start);
        cursor = next;
      }
      node.children = [...node.children, ...tracks];
      node.rule = "one";
      node.minCount = 1;
      node.pull = null;
      out.push(node);
      index = cursor;
      continue;
    }
    if (node.pull === "either") {
      const options: MutableNode[] = [];
      let cursor = index + 1;
      while (cursor < nodes.length && options.length < 2) {
        const candidate = nodes[cursor];
        if (!candidate || /elective|total|practicum/i.test(candidate.heading)) break;
        options.push(candidate);
        cursor += 1;
      }
      node.children = [...node.children, ...options];
      node.rule = "one";
      node.minCount = 1;
      node.pull = null;
      out.push(node);
      index = cursor;
      continue;
    }
    out.push(node);
    index += 1;
  }
  return out;
}

function attachDesign(nodes: MutableNode[]): MutableNode[] {
  const out: MutableNode[] = [];
  for (const node of nodes) {
    const previous = out[out.length - 1];
    if (previous && /senior design/i.test(node.heading) && /\btrack\b/i.test(previous.heading)) {
      previous.children = [...previous.children, node];
      continue;
    }
    out.push(node);
  }
  return out;
}

function canSum(node: MutableNode): boolean {
  return node.rule === "open" && node.statedUnits !== null && node.picks.length === 0 && node.pull === null && !/choose one of the following/i.test(node.quote);
}

function childrenAlreadyMatch(node: MutableNode): boolean {
  if (node.statedUnits === null || node.children.length === 0) return false;
  let sum = 0;
  for (const child of node.children) {
    const units = nodeUnits(child);
    if (units === null) return false;
    sum += units;
  }
  return Math.abs(sum - node.statedUnits) < 0.2;
}

function headingCount(node: MutableNode): number | null {
  const found = node.heading.match(/\b(one|two|three|four|five|six|seven|eight|\d+)\s+courses?\b/i);
  return found?.[1] ? wordCount(found[1]) : null;
}

function nodeUnits(node: MutableNode): number | null {
  if (node.statedUnits !== null) return node.statedUnits;
  if (node.rule === "all") return skeleton(node);
  return null;
}

function fold(nodes: MutableNode[]): MutableNode[] {
  const ready = pullGroups(attachDesign(nodes)).map((node) => ({ ...node, children: fold(node.children) }));
  const out: MutableNode[] = [];
  let index = 0;
  while (index < ready.length) {
    const node = ready[index];
    if (!node) break;
    const asked = headingCount(node);
    if (node.rule === "open" && node.picks.length === 0 && asked !== null && asked > 1) {
      const taken: MutableNode[] = [];
      let count = 0;
      let cursor = index + 1;
      while (cursor < ready.length && count < asked) {
        const candidate = ready[cursor];
        const part = candidate ? headingCount(candidate) : null;
        if (!candidate || part === null) break;
        taken.push(candidate);
        count += part;
        cursor += 1;
      }
      if (count === asked && taken.length > 0) {
        const unitsLine = ready[cursor];
        if (unitsLine && /^units:/i.test(unitsLine.heading)) {
          node.statedMin = unitsLine.statedMin;
          node.statedMax = unitsLine.statedMax;
          node.statedUnits = unitsLine.statedMin === unitsLine.statedMax ? unitsLine.statedMin : null;
          node.quote = squash(`${node.quote} ${unitsLine.heading}`);
          cursor += 1;
        }
        node.children = [...node.children, ...taken];
        node.minCount = asked;
        node.rule = "all";
        out.push(node);
        index = cursor;
        continue;
      }
    }
    if (canSum(node) && node.statedUnits !== null && !childrenAlreadyMatch(node)) {
      const taken: MutableNode[] = [];
      let sum = 0;
      let cursor = index + 1;
      let fits = false;
      while (cursor < ready.length && sum < node.statedUnits - 0.05) {
        const candidate = ready[cursor];
        if (!candidate || candidate.rule === "total" || candidate.rule === "note") break;
        const units = nodeUnits(candidate);
        if (units === null) break;
        if (sum + units > node.statedUnits + 0.05) break;
        sum += units;
        taken.push(candidate);
        cursor += 1;
        if (Math.abs(sum - node.statedUnits) < 0.2) {
          fits = true;
          break;
        }
      }
      if (fits && taken.length > 0) {
        node.children = [...node.children, ...taken];
        node.rule = "all";
        out.push(node);
        index = cursor;
        continue;
      }
    }
    out.push(node);
    index += 1;
  }
  for (const node of out) finishDeep(node);
  return out;
}

function finishDeep(node: MutableNode): void {
  finishRule(node);
  for (const child of node.children) finishDeep(child);
}

function markSuggestions(nodes: MutableNode[]): MutableNode[] {
  const start = nodes.findIndex((node) => /suggested tracks/i.test(node.heading) || /suggestions only/i.test(node.quote));
  if (start < 0) return nodes;
  return nodes.map((node, index) => (index >= start ? { ...node, rule: "note" as const } : node));
}

function mergeUnitLines(nodes: MutableNode[]): MutableNode[] {
  const out: MutableNode[] = [];
  for (const node of nodes) {
    const previous = out[out.length - 1];
    if (previous && /^units:/i.test(node.heading) && node.picks.length === 0 && previous.statedUnits === null && node.statedMin !== null) {
      previous.statedMin = node.statedMin;
      previous.statedMax = node.statedMax;
      previous.statedUnits = node.statedMin === node.statedMax ? node.statedMin : null;
      previous.quote = squash(`${previous.quote} ${node.heading}`);
      continue;
    }
    out.push(node);
  }
  return out;
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
  const nodes = fold(markSuggestions(mergeUnitLines(cores))).map(freeze);
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
