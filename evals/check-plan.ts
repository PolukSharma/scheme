/**
 * Independent plan checker. It does not call the engine's scheduler.
 * A plan is valid when prerequisites are already done, each course sits in a
 * term the catalogue lists for it, no term passes the cap the plan itself
 * claims, and every course this page requires is on the record or the plan.
 */

import type { Course, PrerequisiteExpr, StudentCourse, StudentRecord, TermPlan } from "@/lib/types";
import type { GoldenProgram } from "./read-page";
import { expectation } from "./expect";

export interface PlanIssue {
  kind: "cap" | "offering" | "prerequisite" | "repeat" | "incomplete" | "units";
  detail: string;
}

function counts(course: StudentCourse): boolean {
  if (course.status === "in_progress") return true;
  return course.grade !== "F";
}

function claimedCap(plan: TermPlan): number {
  for (const assumption of plan.assumptions) {
    const found = assumption.text.match(/uses (\d+) units/);
    if (found?.[1]) return Number(found[1]);
  }
  return 18;
}

function prerequisiteHolds(expr: PrerequisiteExpr | null, done: ReadonlySet<string>): boolean {
  if (!expr) return true;
  if (expr.type === "course") return done.has(expr.code);
  if (expr.type === "all_of") return expr.children.every((child) => prerequisiteHolds(child, done));
  const ready = expr.children.filter((child) => prerequisiteHolds(child, done)).length;
  return ready >= expr.minCount;
}

function missingPrerequisite(expr: PrerequisiteExpr | null, done: ReadonlySet<string>): string | null {
  if (!expr || prerequisiteHolds(expr, done)) return null;
  if (expr.type === "course") return expr.code;
  if (expr.type === "all_of") {
    return expr.children.map((child) => missingPrerequisite(child, done)).find((code) => code !== null) ?? "a prerequisite";
  }
  return `${expr.minCount} of ${expr.children.length} prerequisites`;
}

export function checkPlan(
  plan: TermPlan,
  student: StudentRecord,
  courses: readonly Course[],
  program: GoldenProgram,
): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const byCode = new Map(courses.map((course) => [course.code, course]));
  const cap = claimedCap(plan);
  const already = new Set(student.courses.filter(counts).map((course) => course.code));
  const done = new Set(already);

  for (const term of plan.terms) {
    const listed = term.courses.reduce((sum, course) => sum + course.units, 0);
    if (Math.abs(listed - term.units) > 0.05) {
      issues.push({
        kind: "units",
        detail: `${term.label} says ${term.units} units and the courses on it add to ${listed}.`,
      });
    }
    if (term.units > cap) {
      issues.push({
        kind: "cap",
        detail: `${term.label} has ${term.units} units. The plan's own assumption uses ${cap} units, the recommended maximum while the hard cap is unconfirmed.`,
      });
    }
    for (const planned of term.courses) {
      if (done.has(planned.code)) {
        issues.push({
          kind: "repeat",
          detail: `${planned.code} is placed in ${term.label} after it is already on the record or earlier in the plan.`,
        });
      }
      const course = byCode.get(planned.code);
      if (!course) {
        issues.push({
          kind: "offering",
          detail: `${planned.code} is on the plan and is not in the course catalogue, so no term offering is on file.`,
        });
      } else if (!course.offerings.includes(term.season)) {
        const printed = course.offerings.join(", ");
        issues.push({
          kind: "offering",
          detail: `${planned.code} is placed in ${term.label}. The course page lists ${printed}. ${printed === "irregular" ? "No typical term is printed." : "That season is not one of them."}`,
        });
      }
      const gap = course ? missingPrerequisite(course.prerequisites, done) : null;
      if (gap) {
        issues.push({
          kind: "prerequisite",
          detail: `${planned.code} is placed in ${term.label} before ${gap} is done.`,
        });
      }
      done.add(planned.code);
    }
  }

  const unknownTerm = new Set<string>();
  for (const assumption of plan.assumptions) {
    if (!/term is unknown/i.test(assumption.text)) continue;
    const named = assumption.text.match(/^([A-Z]{2,8} \d{3}[A-Za-z]*)/);
    if (named?.[1]) unknownTerm.add(named[1]);
  }
  const page = expectation(program, new Set([...done, ...unknownTerm]));
  for (const code of page.mustRemain) {
    issues.push({
      kind: "incomplete",
      detail: `${code} is required on ${program.url} and is neither done nor on the plan. ${page.working[0] ?? ""}`.trim(),
    });
  }
  for (const group of page.oneOf) {
    issues.push({
      kind: "incomplete",
      detail: `None of ${group.join(", ")} is done or on the plan. The page requires one of them.`,
    });
  }
  return issues;
}
