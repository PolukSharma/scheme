import { existsSync, readFileSync } from "node:fs";
import { cacheFileFor } from "./fetch";
import { parseProgramPage, type OutlineItem } from "./parse";

export interface CourseUnits {
  code: string;
  units: number;
}

/** Units for a course line: the first number printed, or 0 when the page prints none. */
export function unitsOf(unitsText: string): number {
  const match = /(\d+(?:\.\d+)?)/.exec(unitsText);
  return match ? Number(match[1]) : 0;
}

export function collectCourses(items: readonly OutlineItem[], out = new Map<string, number>()): Map<string, number> {
  for (const item of items) {
    if (item.kind === "course") {
      if (!out.has(item.code)) out.set(item.code, unitsOf(item.unitsText));
    } else if (item.kind === "block") {
      collectCourses(item.children, out);
    }
  }
  return out;
}

export interface OverlapRow {
  poid: string;
  name: string;
  overlapCourses: string[];
  overlapUnits: number;
  listedCourses: number;
}

export function pageFor(cacheDir: string, poid: string, catoid = 22): string | null {
  const url = `https://catalogue.usc.edu/preview_program.php?catoid=${catoid}&poid=${poid}`;
  const file = cacheFileFor(cacheDir, url);
  return existsSync(file) ? readFileSync(file, "utf8") : null;
}

export function overlapAgainst(
  cacheDir: string,
  candidates: readonly { poid: string; name: string }[],
  referenceCourses: ReadonlySet<string>,
): OverlapRow[] {
  const rows: OverlapRow[] = [];
  for (const candidate of candidates) {
    const html = pageFor(cacheDir, candidate.poid);
    if (!html) continue;
    const page = parseProgramPage(html);
    const courses = collectCourses(page.outline);
    const shared = [...courses.entries()].filter(([code]) => referenceCourses.has(code));
    rows.push({
      poid: candidate.poid,
      name: candidate.name,
      overlapCourses: shared.map(([code]) => code).sort(),
      overlapUnits: shared.reduce((sum, [, units]) => sum + units, 0),
      listedCourses: courses.size,
    });
  }
  return rows.sort(
    (a, b) =>
      b.overlapCourses.length - a.overlapCourses.length ||
      b.overlapUnits - a.overlapUnits ||
      a.name.localeCompare(b.name),
  );
}
