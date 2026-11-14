import { stubResults } from "@/fixtures";
import type {
  AuditResult,
  Course,
  Opportunity,
  PolicyRule,
  Program,
  StudentRecord,
  TermPlan,
  TransferRule,
} from "@/lib/types";

/**
 * Public engine interface.
 *
 * The Engine agent replaces the bodies below and keeps these signatures.
 * This stub returns fixtures/stub-results.json so the Web and AI agents can
 * build against real shapes. It does not decide degree requirements.
 *
 * audit(student, program, courses, policyRules) => AuditResult
 * rankAddOns(student, currentPrograms, candidates, courses, policyRules, transferRules) => Opportunity[]
 * rankSwitches(student, currentMajor, targets, courses, policyRules, transferRules) => Opportunity[]
 * planTerms(student, programs, courses, policyRules, options?) => TermPlan
 */

export interface PlanTermsOptions {
  /** Used when the per-term unit cap is unconfirmed. The stub ignores this value. */
  unitCap?: number;
}

function unused(...values: unknown[]): void {
  void values;
}

function byCost(a: Opportunity, b: Opportunity): number {
  return a.extraTerms - b.extraTerms || a.extraUnits - b.extraUnits;
}

function rowFor(studentId: string) {
  return stubResults.byStudent.find((row) => row.studentId === studentId);
}

function gap(ruleText: string) {
  return [{ ruleId: "demo-term-unit-cap", text: ruleText }];
}

export function audit(
  student: StudentRecord,
  program: Program,
  courses: readonly Course[],
  policyRules: readonly PolicyRule[],
): AuditResult {
  unused(courses, policyRules);
  const found = rowFor(student.id)?.audits.find((item) => item.programId === program.id);
  if (found) return found;
  return {
    studentId: student.id,
    programId: program.id,
    satisfied: false,
    unitsApplied: 0,
    unitsRemaining: 0,
    coursesRemaining: [],
    requirements: [],
    assumptions: gap("The engine stub has no fixture audit for this student and program."),
  };
}

export function rankAddOns(
  student: StudentRecord,
  currentPrograms: readonly Program[],
  candidates: readonly Program[],
  courses: readonly Course[],
  policyRules: readonly PolicyRule[],
  transferRules: readonly TransferRule[],
): Opportunity[] {
  unused(currentPrograms, courses, policyRules, transferRules);
  const wanted = new Set(candidates.map((program) => program.id));
  const found = rowFor(student.id)?.addOns ?? [];
  return found.filter((item) => item.mode === "add_on" && wanted.has(item.programId)).sort(byCost);
}

export function rankSwitches(
  student: StudentRecord,
  currentMajor: Program,
  targets: readonly Program[],
  courses: readonly Course[],
  policyRules: readonly PolicyRule[],
  transferRules: readonly TransferRule[],
): Opportunity[] {
  unused(currentMajor, courses, policyRules, transferRules);
  const wanted = new Set(targets.map((program) => program.id));
  const found = rowFor(student.id)?.switches ?? [];
  return found
    .filter((item) => item.mode === "switch" && wanted.has(item.programId))
    .sort(byCost);
}

export function planTerms(
  student: StudentRecord,
  programs: readonly Program[],
  courses: readonly Course[],
  policyRules: readonly PolicyRule[],
  options?: PlanTermsOptions,
): TermPlan {
  unused(courses, policyRules, options);
  const found = rowFor(student.id)?.plan;
  if (found) return found;
  return {
    studentId: student.id,
    programIds: programs.map((program) => program.id),
    terms: [],
    totalUnits: 0,
    assumptions: gap("The engine stub has no fixture plan for this student."),
  };
}
