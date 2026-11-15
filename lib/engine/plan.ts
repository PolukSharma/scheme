import type { Assumption, Course, PlannedTerm, PrerequisiteExpr, StudentRecord } from "@/lib/types";

export interface CalendarTerm {
  season: "fall" | "spring" | "summer";
  year: number;
}

const SEASONS = new Set(["fall", "spring", "summer"]);

export function parseTermLabel(value: string | null | undefined): CalendarTerm | null {
  if (!value) return null;
  const iso = /^(\d{4})-(fall|spring|summer)$/.exec(value.trim().toLowerCase());
  if (iso) return { year: Number(iso[1]), season: iso[2] as CalendarTerm["season"] };
  const words = /^(fall|spring|summer)\s+(\d{4})$/.exec(value.trim().toLowerCase());
  if (words) return { year: Number(words[2]), season: words[1] as CalendarTerm["season"] };
  return null;
}

/** Fall of year Y, then spring of Y+1, then summer of Y+1. */
export function nextTerm(term: CalendarTerm): CalendarTerm {
  if (term.season === "fall") return { season: "spring", year: term.year + 1 };
  if (term.season === "spring") return { season: "summer", year: term.year };
  return { season: "fall", year: term.year };
}

function termKey(term: CalendarTerm): number {
  if (term.season === "fall") return term.year * 3;
  if (term.season === "spring") return (term.year - 1) * 3 + 1;
  return (term.year - 1) * 3 + 2;
}

/**
 * The first term that can hold a new course.
 * After the latest dated course when the student has one; otherwise the recorded start term.
 */
export function openingTerm(student: StudentRecord): CalendarTerm {
  let latest: CalendarTerm | null = null;
  for (const course of student.courses) {
    const parsed = parseTermLabel(course.term);
    if (!parsed) continue;
    if (!latest || termKey(parsed) > termKey(latest)) latest = parsed;
  }
  if (latest) return nextTerm(latest);
  return parseTermLabel(student.startTerm) ?? { season: "fall", year: student.startYear };
}

export function prereqGap(
  expr: PrerequisiteExpr | null,
  done: ReadonlySet<string>,
  unitsOf: (code: string) => number,
): string[] {
  if (!expr) return [];
  if (expr.type === "course") return done.has(expr.code) ? [] : [expr.code];
  if (expr.type === "all_of") return expr.children.flatMap((child) => prereqGap(child, done, unitsOf));
  if (expr.children.length > 8) {
    const ranked = expr.children
      .map((child) => prereqGap(child, done, unitsOf))
      .sort(
        (left, right) =>
          left.reduce((sum, code) => sum + unitsOf(code), 0) -
          right.reduce((sum, code) => sum + unitsOf(code), 0),
      );
    return [...new Set(ranked.slice(0, expr.minCount).flat())];
  }
  let best: string[] | null = null;
  const choose = (start: number, taken: string[][], count: number) => {
    if (count >= expr.minCount) {
      const flat = [...new Set(taken.flat())];
      const cost = flat.reduce((sum, code) => sum + unitsOf(code), 0);
      const bestCost = best ? best.reduce((sum, code) => sum + unitsOf(code), 0) : Infinity;
      if (!best || cost < bestCost || (cost === bestCost && flat.length < best.length)) best = flat;
      return;
    }
    for (let index = start; index < expr.children.length; index += 1) {
      choose(index + 1, [...taken, prereqGap(expr.children[index], done, unitsOf)], count + 1);
    }
  };
  choose(0, [], 0);
  return best ?? [];
}

function listedSeason(course: Course, season: CalendarTerm["season"]): boolean {
  return course.offerings.includes(season);
}

function termIsKnown(course: Course): boolean {
  return course.offerings.some((offering) => SEASONS.has(offering));
}

function labelOf(term: CalendarTerm): string {
  return `${term.season[0].toUpperCase()}${term.season.slice(1)} ${term.year}`;
}

function dependents(code: string, pending: readonly string[], byCode: Map<string, Course>): number {
  let count = 0;
  for (const other of pending) {
    if (other === code) continue;
    const course = byCode.get(other);
    if (!course?.prerequisites) continue;
    const gap = prereqGap(course.prerequisites, new Set([code]), () => 1);
    const without = prereqGap(course.prerequisites, new Set(), () => 1);
    if (without.includes(code) && !gap.includes(code)) count += 1;
  }
  return count;
}

export interface ScheduleInput {
  codes: readonly string[];
  byCode: Map<string, Course>;
  done: ReadonlySet<string>;
  /** In-progress codes stay off the plan. The student is already in them. */
  skip: ReadonlySet<string>;
  start: CalendarTerm;
  cap: number;
}

export interface ScheduleOutput {
  terms: PlannedTerm[];
  assumptions: Assumption[];
  unplaced: string[];
}

/**
 * Place remaining courses into terms. Prerequisites come first.
 * A corequisite shares the term or is already done.
 * A course whose offering is irregular, or otherwise not a listed season, stays off the calendar.
 * The plan says that term is unknown instead of choosing fall, spring, or summer.
 */
export function scheduleRemaining(input: ScheduleInput): ScheduleOutput {
  const assumptions: Assumption[] = [];
  const pending = [...new Set(input.codes)].filter((code) => !input.done.has(code) && !input.skip.has(code));
  const unplaced: string[] = [];
  const placeable: string[] = [];
  for (const code of pending) {
    const course = input.byCode.get(code);
    if (!course) {
      unplaced.push(code);
      assumptions.push({
        ruleId: "missing-course",
        text: `${code} is not in the course catalogue, so it is left off the plan and counted as 0 units.`,
      });
      continue;
    }
    if (course.units <= 0) {
      unplaced.push(code);
      assumptions.push({
        ruleId: "zero-unit-course",
        text: `${code} is ${course.units} units. A term plan only lists courses with units, so it is not placed.`,
      });
      continue;
    }
    if (course.units > input.cap) {
      unplaced.push(code);
      assumptions.push({
        ruleId: "per-term-unit-cap",
        text: `${code} is ${course.units} units, above the ${input.cap}-unit planning cap, so it is not placed.`,
      });
      continue;
    }
    if (!termIsKnown(course)) {
      unplaced.push(code);
      assumptions.push({
        ruleId: "unknown-term",
        text: `${code}'s term is unknown. The offering on file is ${course.offerings.join(", ")}, so this plan does not invent a fall, spring, or summer term.`,
      });
      continue;
    }
    placeable.push(code);
  }

  const done = new Set(input.done);
  for (const code of input.skip) done.add(code);
  const left = new Set(placeable);
  const terms: PlannedTerm[] = [];
  let cursor = input.start;
  let idle = 0;
  while (left.size > 0 && idle < 24) {
    const ready = [...left].filter((code) => {
      const course = input.byCode.get(code);
      if (!course || !listedSeason(course, cursor.season)) return false;
      return prereqGap(course.prerequisites, done, (item) => input.byCode.get(item)?.units ?? 0).length === 0;
    });
    ready.sort((leftCode, rightCode) => {
      const leftDeps = dependents(leftCode, [...left], input.byCode);
      const rightDeps = dependents(rightCode, [...left], input.byCode);
      if (leftDeps !== rightDeps) return rightDeps - leftDeps;
      const leftUnits = input.byCode.get(leftCode)?.units ?? 0;
      const rightUnits = input.byCode.get(rightCode)?.units ?? 0;
      return rightUnits - leftUnits;
    });
    const chosen: string[] = [];
    let used = 0;
    const chosenSet = new Set<string>();
    for (const code of ready) {
      if (chosenSet.has(code)) continue;
      const course = input.byCode.get(code);
      if (!course) continue;
      const bundle = [code];
      let bundleUnits = course.units;
      let blocked = false;
      for (const coreq of course.corequisites) {
        if (done.has(coreq) || chosenSet.has(coreq)) continue;
        const partner = input.byCode.get(coreq);
        if (!partner || !left.has(coreq) || !ready.includes(coreq)) {
          blocked = true;
          break;
        }
        bundle.push(coreq);
        bundleUnits += partner.units;
      }
      if (blocked || used + bundleUnits > input.cap) continue;
      for (const item of bundle) {
        if (chosenSet.has(item)) continue;
        chosen.push(item);
        chosenSet.add(item);
      }
      used += bundleUnits;
    }
    if (chosen.length === 0) {
      idle += 1;
      cursor = nextTerm(cursor);
      continue;
    }
    idle = 0;
    const courses = chosen.map((code) => {
      const course = input.byCode.get(code);
      left.delete(code);
      done.add(code);
      return {
        code,
        units: course?.units ?? 0,
        title: course?.title ?? code,
      };
    });
    terms.push({
      label: labelOf(cursor),
      season: cursor.season,
      year: cursor.year,
      courses,
      units: courses.reduce((sum, course) => sum + course.units, 0),
    });
    cursor = nextTerm(cursor);
  }
  for (const code of left) unplaced.push(code);
  if (left.size > 0) {
    assumptions.push({
      ruleId: "unplaced-courses",
      text: `These courses did not fit a term under the prerequisites, offerings, and ${input.cap}-unit cap: ${[...left].sort().join(", ")}.`,
    });
  }
  return { terms, assumptions, unplaced };
}

export function countTerms(input: ScheduleInput): number {
  return scheduleRemaining(input).terms.length;
}
