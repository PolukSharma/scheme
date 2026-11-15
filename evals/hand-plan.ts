/**
 * Independent checks on a term plan. Does not import lib/engine.
 */

import type { Course, PrerequisiteExpr, StudentCourse, TermPlan } from "@/lib/types";

export interface PlanFault {
  kind: string;
  detail: string;
}

interface Dated {
  year: number;
  season: "fall" | "spring" | "summer";
}

function parseTerm(value: string | null): Dated | null {
  if (!value) return null;
  const match = /^(\d{4})-(fall|spring|summer)$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), season: match[2] as Dated["season"] };
}

function key(term: Dated): number {
  if (term.season === "fall") return term.year * 3;
  if (term.season === "spring") return term.year * 3 + 1;
  return term.year * 3 + 2;
}

function next(term: Dated): Dated {
  if (term.season === "fall") return { season: "spring", year: term.year + 1 };
  if (term.season === "spring") return { season: "summer", year: term.year };
  return { season: "fall", year: term.year };
}

function prereqMet(expr: PrerequisiteExpr | null, done: ReadonlySet<string>): boolean {
  if (!expr) return true;
  if (expr.type === "course") return done.has(expr.code);
  if (expr.type === "all_of") return expr.children.every((child) => prereqMet(child, done));
  const ready = expr.children.filter((child) => prereqMet(child, done)).length;
  return ready >= expr.minCount;
}

function offered(course: Course, season: Dated["season"]): boolean {
  return course.offerings.includes(season);
}

export function checkPlan(input: {
  plan: TermPlan;
  courses: readonly Course[];
  studentCourses: readonly StudentCourse[];
  /** Courses the hand rules still need, ignoring the plan. */
  stillNeeded: readonly string[];
  /** Zero-unit codes the plan may leave off when an assumption names them. */
  assumptionText: string;
}): PlanFault[] {
  const faults: PlanFault[] = [];
  const byCode = new Map(input.courses.map((course) => [course.code, course]));
  const seen = new Set<string>();
  let sum = 0;
  let previous: Dated | null = null;
  const done = new Set(
    input.studentCourses.filter((course) => course.status === "in_progress" || (course.grade !== "F" && course.grade !== null)).map((course) => course.code),
  );

  let latest: Dated | null = null;
  for (const course of input.studentCourses) {
    const parsed = parseTerm(course.term);
    if (parsed && (!latest || key(parsed) > key(latest))) latest = parsed;
  }
  const earliest = latest ? next(latest) : null;

  for (const term of input.plan.terms) {
    const dated = { year: term.year, season: term.season };
    if (previous && key(dated) <= key(previous)) {
      faults.push({ kind: "term-order", detail: `${term.label} is not after the previous term.` });
    }
    if (earliest && key(dated) < key(earliest)) {
      faults.push({ kind: "term-order", detail: `${term.label} starts before the student's latest dated course.` });
    }
    previous = dated;
    const termUnits = term.courses.reduce((total, course) => total + course.units, 0);
    if (termUnits !== term.units) {
      faults.push({ kind: "term-units", detail: `${term.label} lists ${termUnits} units and records ${term.units}.` });
    }
    if (term.units > 18) {
      faults.push({ kind: "unit-cap", detail: `${term.label} has ${term.units} units. The confirmed recommended maximum is 18.` });
    }
    sum += term.units;
    for (const planned of term.courses) {
      if (seen.has(planned.code)) faults.push({ kind: "duplicate", detail: `${planned.code} is planned more than once.` });
      seen.add(planned.code);
      const course = byCode.get(planned.code);
      if (!course) {
        faults.push({ kind: "missing-course", detail: `${planned.code} is not in the course catalogue.` });
        continue;
      }
      if (planned.units !== course.units) {
        faults.push({
          kind: "variable-units",
          detail: `${planned.code} is planned as ${planned.units} units. The course file records ${course.units}.`,
        });
      }
      if (!offered(course, term.season)) {
        const unconfirmed = course.offerings.length === 1 && course.offerings[0] === "irregular";
        faults.push({
          kind: unconfirmed ? "unconfirmed-offering" : "not-offered",
          detail: unconfirmed
            ? `${planned.code} has no printed term. The plan places it in ${term.label}.`
            : `${planned.code} is not offered in ${term.season}. The course file lists ${course.offerings.join(", ")}.`,
        });
      } else if (course.offerings.includes("irregular") && course.source.text.includes("not printed")) {
        faults.push({
          kind: "unconfirmed-offering",
          detail: `${planned.code} has no printed term. The plan places it in ${term.label}.`,
        });
      }
      if (!prereqMet(course.prerequisites, done)) {
        faults.push({ kind: "prerequisite", detail: `${planned.code} is placed in ${term.label} before a parsed prerequisite is done.` });
      }
      for (const coreq of course.corequisites) {
        const same = term.courses.some((item) => item.code === coreq);
        if (!same && !done.has(coreq)) {
          faults.push({ kind: "corequisite", detail: `${planned.code} needs ${coreq} in ${term.label} or earlier.` });
        }
      }
      if (course.prerequisites === null && course.source.text.includes("did not become a complete boolean tree")) {
        faults.push({
          kind: "unparsed-prerequisite",
          detail: `${planned.code} is planned, and its prerequisite sentence was not stored as a tree.`,
        });
      }
      done.add(planned.code);
    }
  }
  if (sum !== input.plan.totalUnits) {
    faults.push({ kind: "total-units", detail: `The terms sum to ${sum} and the plan records ${input.plan.totalUnits}.` });
  }
  for (const code of input.stillNeeded) {
    if (seen.has(code)) continue;
    const course = byCode.get(code);
    if (course && course.units === 0 && input.assumptionText.includes(code)) continue;
    const attempt = input.studentCourses.find((row) => row.code === code && row.status === "in_progress");
    if (attempt) {
      faults.push({ kind: "in-progress-omitted", detail: `${code} is in progress and is not on the plan.` });
      continue;
    }
    faults.push({ kind: "not-planned", detail: `${code} is still required and is not on the plan.` });
  }
  return faults;
}
