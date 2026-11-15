/**
 * Independent audit of a hand atom. Does not import lib/engine.
 */

import type { Course, PrerequisiteExpr, StudentCourse } from "@/lib/types";
import { coursesOf, forcedCodes, type Atom } from "./atoms";
import { meetsFloor } from "./letters";
import type { HandGrade } from "./hand-rules";

export interface Counted {
  code: string;
  units: number;
}

const CREDIT = new Set(["TR", "CR", "P", "S"]);

function termKey(term: string | null): number {
  if (!term) return -1;
  const match = /^(\d{4})-(fall|spring|summer)$/.exec(term);
  if (!match) return -1;
  const year = Number(match[1]);
  const season = match[2] === "fall" ? 0 : match[2] === "spring" ? 1 : 2;
  return year * 3 + season;
}

export function floorFor(grade: HandGrade | null, code: string, majorCodes: ReadonlySet<string>): "C" | "C-" | null {
  if (!grade) return null;
  if (grade.scope === "major") return majorCodes.has(code) ? grade.minimum : null;
  return grade.codes.includes(code) ? grade.minimum : null;
}

/**
 * The attempt that counts. The latest finished attempt is the one that has to
 * meet the floor. An in-progress repeat does not erase an earlier pass, and it
 * does not satisfy a printed floor before the grade is posted.
 */
export function countedCourses(
  rows: readonly StudentCourse[],
  grade: HandGrade | null,
  majorCodes: ReadonlySet<string>,
): Counted[] {
  const byCode = new Map<string, StudentCourse[]>();
  for (const row of rows) {
    const list = byCode.get(row.code) ?? [];
    list.push(row);
    byCode.set(row.code, list);
  }
  const counted: Counted[] = [];
  for (const [code, attempts] of byCode) {
    const floor = floorFor(grade, code, majorCodes);
    const ordered = [...attempts].sort((left, right) => termKey(left.term) - termKey(right.term));
    const finished = ordered.filter((row) => row.status !== "in_progress");
    const latest = finished[finished.length - 1];
    const inProgress = ordered.some((row) => row.status === "in_progress");
    if (latest) {
      const credit = latest.status === "transfer" || latest.status === "ap";
      if (meetsFloor(latest.grade, floor, credit && latest.grade !== null && CREDIT.has(latest.grade))) {
        counted.push({ code, units: latest.units });
        continue;
      }
    }
    if (inProgress && !floor) {
      counted.push({ code, units: ordered.find((row) => row.status === "in_progress")?.units ?? 0 });
    }
  }
  return counted;
}

export function catalogueUnits(courses: readonly Course[]): (code: string) => number {
  const byCode = new Map(courses.map((course) => [course.code, course.units]));
  return (code) => byCode.get(code) ?? 0;
}

function optionUnits(atom: Atom, unitsOf: (code: string) => number): number {
  switch (atom.type) {
    case "course":
      return atom.credit ?? unitsOf(atom.code);
    case "all":
      return atom.of.reduce((sum, child) => sum + optionUnits(child, unitsOf), 0);
    case "one":
      return Math.min(...atom.options.map((option) => optionUnits(option, unitsOf)));
    case "n":
      return atom.minUnits ?? atom.n * Math.min(...atom.options.map((option) => optionUnits(option, unitsOf)));
    case "units":
      return atom.minUnits;
    case "set":
      return atom.minUnits ?? 0;
    case "unlisted":
      return atom.units;
    default:
      return 0;
  }
}

export function covers(atom: Atom, have: ReadonlySet<string>, unitsOf: (code: string) => number, courses: readonly Course[]): boolean {
  const forced = new Set(forcedCodes(atom));
  return covered(atom, have, unitsOf, courses, forced);
}

function covered(
  atom: Atom,
  have: ReadonlySet<string>,
  unitsOf: (code: string) => number,
  courses: readonly Course[],
  forced: ReadonlySet<string>,
): boolean {
  switch (atom.type) {
    case "course":
      return have.has(atom.code);
    case "all":
      return atom.of.every((child) => covered(child, have, unitsOf, courses, forced));
    case "one":
      return atom.options.some((option) => covered(option, have, unitsOf, courses, forced));
    case "n": {
      const ready = atom.options.filter((option) => covered(option, have, unitsOf, courses, forced));
      const units = ready.reduce((sum, option) => sum + witnessUnits(option, have, unitsOf), 0);
      if (ready.length < atom.n) return false;
      if (atom.minUnits !== undefined && units < atom.minUnits) return false;
      return true;
    }
    case "set": {
      const pool = courses.filter((course) => {
        if (!have.has(course.code)) return false;
        if (!atom.depts.includes(course.dept)) return false;
        if (course.level < atom.levelMin || course.level > atom.levelMax) return false;
        if (atom.excludeForced && forced.has(course.code)) return false;
        return true;
      });
      if (atom.minCount !== undefined && pool.length < atom.minCount) return false;
      if (atom.minUnits !== undefined && pool.reduce((sum, course) => sum + course.units, 0) < atom.minUnits) return false;
      return true;
    }
    case "units": {
      const sum = atom.options.filter((option) => have.has(option.code)).reduce((total, option) => total + unitsOf(option.code), 0);
      return sum >= atom.minUnits;
    }
    case "unlisted":
    case "optional":
      return true;
    case "outside": {
      const picked = [...atom.upper, ...atom.lower].filter((code) => have.has(code));
      const outside = picked.filter((code) => !code.startsWith("MATH "));
      const upper = picked.filter((code) => atom.upper.includes(code));
      return picked.length >= atom.n && outside.length >= atom.minOutside && upper.length >= atom.minUpper;
    }
    default:
      return false;
  }
}

function witnessUnits(atom: Atom, have: ReadonlySet<string>, unitsOf: (code: string) => number): number {
  switch (atom.type) {
    case "course":
      return unitsOf(atom.code);
    case "all":
      return atom.of.reduce((sum, child) => sum + witnessUnits(child, have, unitsOf), 0);
    case "one": {
      const ready = atom.options.filter((option) => haveHas(option, have));
      const chosen = ready[0];
      return chosen ? witnessUnits(chosen, have, unitsOf) : optionUnits(atom, unitsOf);
    }
    default:
      return optionUnits(atom, unitsOf);
  }
}

function haveHas(atom: Atom, have: ReadonlySet<string>): boolean {
  switch (atom.type) {
    case "course":
      return have.has(atom.code);
    case "all":
      return atom.of.every((child) => haveHas(child, have));
    case "one":
      return atom.options.some((option) => haveHas(option, have));
    default:
      return false;
  }
}

export function allowedCodes(atom: Atom, courses: readonly Course[]): Set<string> {
  const allowed = new Set<string>();
  const walk = (node: Atom) => {
    if (node.type === "optional") return;
    if (node.type === "course" || node.type === "units") coursesOf(node).forEach((code) => allowed.add(code));
    else if (node.type === "all") node.of.forEach(walk);
    else if (node.type === "one" || node.type === "n") node.options.forEach(walk);
    else if (node.type === "outside") {
      node.upper.forEach((code) => allowed.add(code));
      node.lower.forEach((code) => allowed.add(code));
    } else if (node.type === "set") {
      for (const course of courses) {
        if (!node.depts.includes(course.dept)) continue;
        if (course.level < node.levelMin || course.level > node.levelMax) continue;
        allowed.add(course.code);
      }
    }
  };
  walk(atom);
  return allowed;
}

export function prereqClosure(codes: ReadonlySet<string>, courses: readonly Course[]): Set<string> {
  const byCode = new Map(courses.map((course) => [course.code, course]));
  const closed = new Set(codes);
  const pending = [...codes];
  while (pending.length > 0) {
    const code = pending.pop();
    if (!code) break;
    const course = byCode.get(code);
    if (!course?.prerequisites) continue;
    for (const needed of mentioned(course.prerequisites)) {
      if (closed.has(needed)) continue;
      closed.add(needed);
      pending.push(needed);
    }
    for (const coreq of course.corequisites) {
      if (!closed.has(coreq)) {
        closed.add(coreq);
        pending.push(coreq);
      }
    }
  }
  return closed;
}

function mentioned(expr: PrerequisiteExpr): string[] {
  if (expr.type === "course") return [expr.code];
  return expr.children.flatMap(mentioned);
}

/**
 * Another side of a satisfied choice is still in the engine's remaining list.
 * `have` is only what the student already counts, not the remaining list.
 */
export function choiceLeaks(atom: Atom, have: ReadonlySet<string>, remaining: ReadonlySet<string>): string[] {
  const leaks: string[] = [];
  const walk = (node: Atom) => {
    if (node.type === "all") node.of.forEach(walk);
    else if (node.type === "n") node.options.forEach(walk);
    else if (node.type === "one") {
      const satisfied = node.options.filter((option) => haveHas(option, have));
      if (satisfied.length > 0) {
        const kept = new Set(satisfied.flatMap((option) => coursesOf(option)));
        for (const option of node.options) {
          if (satisfied.includes(option)) continue;
          for (const code of coursesOf(option)) {
            if (!kept.has(code) && remaining.has(code)) leaks.push(code);
          }
        }
      } else {
        const full = node.options.filter((option) => forcedCodes(option).every((code) => remaining.has(code) || have.has(code)));
        if (full.length > 1) {
          const extras = full.slice(1).flatMap((option) => forcedCodes(option));
          leaks.push(...extras.filter((code) => remaining.has(code)));
        }
      }
      node.options.forEach(walk);
    }
  };
  walk(atom);
  return [...new Set(leaks)].sort();
}

export function majorCodes(atom: Atom): Set<string> {
  return new Set(coursesOf(atom));
}
