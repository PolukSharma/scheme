/**
 * Reads a saved catalogue program page into headings and course lines.
 * No requirement tree from data/programs is used.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseProgramPage, type OutlineBlock, type OutlineItem } from "@/scripts/catalogue/parse";
import { cataloguePages, type CataloguePage } from "./catalogue-pages";

export interface CourseLine {
  code: string;
  unitsText: string;
}

export interface PageHeading {
  heading: string;
  path: string;
  courses: CourseLine[];
  notes: string[];
  /** True when a line or a word between lines says "or" or "and". */
  connector: boolean;
  children: PageHeading[];
}

export interface LoadedPage {
  id: string;
  name: string;
  description: string;
  url: string;
  headings: PageHeading[];
  codes: string[];
}

function hasConnector(items: readonly OutlineItem[]): boolean {
  for (const item of items) {
    if (item.kind === "course" && /\b(or|and)\b/i.test(item.unitsText)) return true;
    if (item.kind === "text" && /^(or|and)$/i.test(item.text.trim())) return true;
  }
  return false;
}

function fromBlock(block: OutlineBlock, parent: string): PageHeading {
  const path = parent ? `${parent} / ${block.heading}` : block.heading;
  const courses: CourseLine[] = [];
  const notes: string[] = [];
  const children: PageHeading[] = [];
  for (const item of block.children) {
    if (item.kind === "course") courses.push({ code: item.code, unitsText: item.unitsText });
    else if (item.kind === "text") notes.push(item.text);
    else children.push(fromBlock(item, path));
  }
  return {
    heading: block.heading,
    path,
    courses,
    notes,
    connector: hasConnector(block.children),
    children,
  };
}

export function loadPage(page: CataloguePage, root = process.cwd()): LoadedPage {
  const html = readFileSync(
    join(root, "data/raw", "2026-2027", `catalogue_usc_edu_preview_program_php_catoid_22_poid_${page.poid}.html`),
    "utf8",
  );
  const parsed = parseProgramPage(html);
  const headings = parsed.outline.filter((item): item is OutlineBlock => item.kind === "block").map((block) => fromBlock(block, ""));
  const codes = new Set<string>();
  const walk = (heading: PageHeading) => {
    for (const course of heading.courses) codes.add(course.code);
    heading.children.forEach(walk);
  };
  headings.forEach(walk);
  return {
    id: page.id,
    name: page.name,
    description: parsed.description,
    url: page.url,
    headings,
    codes: [...codes].sort(),
  };
}

export function loadTierPages(root = process.cwd()): LoadedPage[] {
  return cataloguePages.filter((page) => page.id !== "neuroscience-ba").map((page) => loadPage(page, root));
}

export function headingMap(page: LoadedPage): Map<string, PageHeading> {
  const map = new Map<string, PageHeading>();
  const walk = (heading: PageHeading) => {
    if (map.has(heading.path)) throw new Error(`Duplicate heading path ${heading.path}`);
    map.set(heading.path, heading);
    heading.children.forEach(walk);
  };
  page.headings.forEach(walk);
  return map;
}

export function requireCodes(heading: PageHeading, expected: number): string[] {
  if (heading.connector) throw new Error(`${heading.path} has or/and; write the groups by hand`);
  return courseCodes(heading, expected);
}

/** The course lines under a heading, including a heading whose lines use or/and. */
export function courseCodes(heading: PageHeading, expected: number): string[] {
  if (heading.courses.length !== expected) {
    throw new Error(`${heading.path} lists ${heading.courses.length} courses; the hand count is ${expected}`);
  }
  return heading.courses.map((course) => course.code);
}
