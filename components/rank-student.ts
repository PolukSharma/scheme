import { audit, planTerms, rankAddOns, rankSwitches } from "@/lib/engine";
import type {
  AuditResult,
  Opportunity,
  PolicyRule,
  Program,
  ProgramKind,
  RequirementNode,
  StudentRecord,
  TermPlan,
  TransferRule,
  Course,
} from "@/lib/types";

export interface StudentRanking {
  addOns: Opportunity[];
  switches: Opportunity[];
  declaredAudit: AuditResult;
  declaredPlan: TermPlan;
}

export function rankStudent(
  student: StudentRecord,
  programs: readonly Program[],
  courses: readonly Course[],
  policyRules: readonly PolicyRule[],
  transferRules: readonly TransferRule[],
): StudentRanking {
  const major = programs.find((program) => program.id === student.majorId);
  if (!major) throw new Error("The major on this record is not in the program list.");
  const declared = student.declaredProgramIds.map((id) => {
    const program = programs.find((item) => item.id === id);
    if (!program) throw new Error("A declared program on this record is not in the program list.");
    return program;
  });
  const others = programs.filter((program) => !declared.some((item) => item.id === program.id));
  const majors = programs.filter((program) => program.kind === "major" && program.id !== major.id);
  return {
    addOns: rankAddOns(student, declared, others, courses, policyRules, transferRules),
    switches: rankSwitches(student, major, majors, courses, policyRules, transferRules),
    declaredAudit: audit(student, major, courses, policyRules),
    declaredPlan: planTerms(student, declared, courses, policyRules),
  };
}

export function filterByKind(
  rows: readonly Opportunity[],
  programs: readonly Program[],
  kind: "all" | ProgramKind,
): Opportunity[] {
  if (kind === "all") return [...rows];
  return rows.filter((row) => programs.find((program) => program.id === row.programId)?.kind === kind);
}

export interface ResultFilters {
  kind: "all" | ProgramKind;
  school: string;
  verification: "all" | "verified" | "unverified";
}

export function schoolOptions(programs: readonly Program[]): string[] {
  return [...new Set(programs.map((program) => program.school))].sort((left, right) => left.localeCompare(right));
}

export function narrowResults(
  rows: readonly Opportunity[],
  programs: readonly Program[],
  filters: ResultFilters,
): Opportunity[] {
  return filterByKind(rows, programs, filters.kind).filter((row) => {
    const program = programs.find((item) => item.id === row.programId);
    if (filters.school !== "all" && program?.school !== filters.school) return false;
    if (filters.verification === "verified") return row.verified;
    if (filters.verification === "unverified") return !row.verified;
    return true;
  });
}

/**
 * Dollars only when a confirmed policy rule quotes tuition.
 * A missing figure stays "Not estimated". The screen does not invent a rate.
 */
export function estimatedCostLabel(rules: readonly PolicyRule[], extraUnits: number): string {
  const rule = rules.find(
    (item) =>
      item.confirmed &&
      typeof item.value === "number" &&
      item.value >= 0 &&
      /tuition|estimated-cost|cost-per/i.test(`${item.id} ${item.name}`),
  );
  if (!rule || typeof rule.value !== "number") return "Not estimated";
  const perUnit = /per[- ]unit/i.test(`${rule.id} ${rule.name} ${rule.summary}`);
  const dollars = perUnit ? rule.value * Math.max(0, extraUnits) : rule.value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

export function verificationLabel(verified: boolean): "Verified" | "Unverified" {
  return verified ? "Verified" : "Unverified";
}

export function indexRequirements(node: RequirementNode, into = new Map<string, RequirementNode>()): Map<string, RequirementNode> {
  into.set(node.id, node);
  if (node.type === "all_of") node.children.forEach((child) => indexRequirements(child, into));
  if (node.type === "n_of") node.options.forEach((child) => indexRequirements(child, into));
  return into;
}

export function planChoice(
  student: StudentRecord,
  mode: "add_on" | "switch",
  program: Program,
  programs: readonly Program[],
  courses: readonly Course[],
  policyRules: readonly PolicyRule[],
): { audit: AuditResult; plan: TermPlan } {
  const declared = student.declaredProgramIds.flatMap((id) => {
    const found = programs.find((item) => item.id === id);
    return found ? [found] : [];
  });
  const together = mode === "switch" ? [program] : [...declared.filter((item) => item.id !== program.id), program];
  return {
    audit: audit(student, program, courses, policyRules),
    plan: planTerms(student, together, courses, policyRules),
  };
}

/** Course codes and the question only. No name, id, or grade. */
export function chatRequestBody(student: StudentRecord, question: string) {
  return {
    courses: student.courses
      .filter((course) => course.status === "completed" || course.status === "in_progress")
      .map((course) => ({ code: course.code, status: course.status })),
    programIds: student.declaredProgramIds,
    startTerm: student.startTerm,
    question,
  };
}

export function careerRequestBody(goal: string, programIds: readonly string[]) {
  return { goal, programIds: [...programIds] };
}

export function advisorQuestions(input: { unverified: boolean; crossSchool: boolean; assumptionCount: number }): string[] {
  const questions = ["Which of the planned courses does the current STARS report still require?"];
  if (input.assumptionCount > 0) questions.push("Which of the listed assumptions should change this plan?");
  if (input.unverified) questions.push("Which unverified items should stay out of the plan until the catalogue page is checked?");
  if (input.crossSchool) {
    questions.push("What does the linked school page require before a change of school? This plan does not estimate admission.");
  }
  return questions;
}

export function uniqueAssumptions(rows: readonly { assumptions: { ruleId: string; text: string }[] }[]): { ruleId: string; text: string }[] {
  const seen = new Set<string>();
  const unique: { ruleId: string; text: string }[] = [];
  for (const row of rows) {
    for (const assumption of row.assumptions) {
      const key = `${assumption.ruleId}\n${assumption.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(assumption);
    }
  }
  return unique;
}
