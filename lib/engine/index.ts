import type {
  Assumption,
  AuditResult,
  Course,
  Opportunity,
  PolicyRule,
  Program,
  RequirementNode,
  RequirementStatus,
  StudentCourse,
  StudentRecord,
  TermPlan,
  TransferCheck,
  TransferRule,
} from "@/lib/types";
import { closedCodes, costUnits, coverProgram, makeContext, type Cover, type HeldCourse } from "./assign";
import { openingTerm, scheduleRemaining } from "./plan";
import { termUnitCap } from "./policy";

/**
 * Public engine interface.
 *
 * audit(student, program, courses, policyRules) => AuditResult
 * rankAddOns(student, currentPrograms, candidates, courses, policyRules, transferRules) => Opportunity[]
 * rankSwitches(student, currentMajor, targets, courses, policyRules, transferRules) => Opportunity[]
 * planTerms(student, programs, courses, policyRules, options?) => TermPlan
 *
 * No network and no model calls. Unconfirmed policy rules are returned as assumptions.
 */

export interface PlanTermsOptions {
  /** Used when the per-term unit cap is unconfirmed. */
  unitCap?: number;
}

function countsOnRecord(course: StudentCourse): boolean {
  if (course.status === "in_progress") return true;
  return course.grade !== "F";
}

function heldFrom(student: StudentRecord, extra: readonly HeldCourse[] = []): HeldCourse[] {
  const rows: HeldCourse[] = student.courses.filter(countsOnRecord).map((course) => ({
    code: course.code,
    units: course.units,
    grade: course.grade,
    inProgress: course.status === "in_progress",
  }));
  for (const course of extra) {
    if (!rows.some((row) => row.code === course.code)) rows.push(course);
  }
  return rows;
}

function catalogue(courses: readonly Course[]): Map<string, Course> {
  return new Map(courses.map((course) => [course.code, course]));
}

function unitsOf(byCode: Map<string, Course>, code: string, held: readonly HeldCourse[]): number {
  return byCode.get(code)?.units ?? held.find((course) => course.code === code)?.units ?? 0;
}

function flatten(node: RequirementNode): RequirementNode[] {
  if (node.type === "all_of") return [node, ...node.children.flatMap(flatten)];
  if (node.type === "n_of") return [node, ...node.options.flatMap(flatten)];
  return [node];
}

function statusesFor(root: RequirementNode, cover: Cover): RequirementStatus[] {
  const byId = new Map<string, RequirementStatus>();
  for (const status of cover.statuses) {
    if (!byId.has(status.nodeId)) byId.set(status.nodeId, status);
  }
  return flatten(root).map((node) => {
    const found = byId.get(node.id);
    if (found) return found;
    return {
      nodeId: node.id,
      satisfied: false,
      appliedCourses: [],
      remainingUnits: 0,
      note: "Not used in the cheapest assignment.",
      source: node.source,
    };
  });
}

function progressAssumptions(student: StudentRecord, applied: readonly string[]): Assumption[] {
  return student.courses
    .filter((course) => course.status === "in_progress" && applied.includes(course.code))
    .map((course) => ({
      ruleId: "in-progress",
      text: `${course.code} is in progress. It counts where the requirement has no minimum grade, and it is not scheduled again.`,
    }));
}

function blockedProgress(student: StudentRecord, remaining: readonly string[]): Assumption[] {
  return student.courses
    .filter((course) => course.status === "in_progress" && remaining.includes(course.code))
    .map((course) => ({
      ruleId: "in-progress",
      text: `${course.code} is in progress and does not yet meet a minimum grade, so it is not counted and not scheduled again.`,
    }));
}

function missingAssumptions(codes: readonly string[], byCode: Map<string, Course>): Assumption[] {
  return codes
    .filter((code) => !byCode.has(code))
    .map((code) => ({
      ruleId: "missing-course",
      text: `${code} is not in the course catalogue. It stays on the remaining list and counts as 0 units.`,
    }));
}

function isPartial(program: Program): boolean {
  const extra = program as Program & { partial?: boolean };
  return extra.partial === true;
}

function longestChain(codes: readonly string[], byCode: Map<string, Course>): string[] {
  const pool = new Set(codes);
  const memo = new Map<string, string[]>();
  const walk = (code: string, stack: Set<string>): string[] => {
    const cached = memo.get(code);
    if (cached) return cached;
    if (stack.has(code)) return [code];
    stack.add(code);
    const course = byCode.get(code);
    let best: string[] = [];
    if (course?.prerequisites) {
      const mentioned = codesMentioned(course.prerequisites).filter((item) => pool.has(item));
      for (const item of mentioned) {
        const chain = walk(item, stack);
        if (chain.length > best.length) best = chain;
      }
    }
    stack.delete(code);
    const chain = [...best, code];
    memo.set(code, chain);
    return chain;
  };
  let best: string[] = [];
  for (const code of codes) {
    const chain = walk(code, new Set());
    if (chain.length > best.length) best = chain;
  }
  return best;
}

function codesMentioned(expr: Course["prerequisites"]): string[] {
  if (!expr) return [];
  if (expr.type === "course") return [expr.code];
  return expr.children.flatMap((child) => codesMentioned(child));
}

function bindingConstraint(codes: readonly string[], byCode: Map<string, Course>, cap: number, scheduled: number): string {
  if (codes.length === 0) return "No courses remain on this path.";
  const chain = longestChain(codes, byCode);
  const units = codes.reduce((sum, code) => sum + (byCode.get(code)?.units ?? 0), 0);
  const capTerms = Math.max(1, Math.ceil(units / cap));
  const described = chain
    .map((code) => {
      const offerings = byCode.get(code)?.offerings ?? [];
      return offerings.length > 0 ? `${code} (${offerings.join(", ")})` : code;
    })
    .join(" → ");
  if (chain.length >= 2 && chain.length >= capTerms) {
    return `Prerequisite chain ${described}.`;
  }
  if (scheduled >= capTerms && capTerms >= chain.length) {
    return `The ${cap}-unit planning cap sets the length: ${units} units need ${capTerms} term${capTerms === 1 ? "" : "s"}.`;
  }
  return chain.length >= 2 ? `Prerequisite chain ${described}.` : `${codes.length} course${codes.length === 1 ? "" : "s"} still to take.`;
}

function transferFor(
  student: StudentRecord,
  program: Program,
  rules: readonly TransferRule[],
  held: readonly HeldCourse[],
): { crossSchool: boolean; transfer: TransferCheck | null } {
  const crossSchool = program.school !== student.school;
  if (!crossSchool) return { crossSchool, transfer: null };
  const rule = rules.find((item) => item.school === program.school);
  if (!rule) return { crossSchool, transfer: null };
  const have = new Set(held.filter((course) => !course.anticipated).map((course) => course.code));
  return {
    crossSchool,
    transfer: {
      rule,
      prerequisitesHave: rule.prerequisiteCourses.filter((code) => have.has(code)),
      prerequisitesLack: rule.prerequisiteCourses.filter((code) => !have.has(code)),
    },
  };
}

function minorShortfall(
  candidate: Program,
  majorCodes: ReadonlySet<string>,
  minorCover: Cover,
  rules: readonly PolicyRule[],
  byCode: Map<string, Course>,
  held: readonly HeldCourse[],
): { units: number; assumption: Assumption | null } {
  if (candidate.kind !== "minor") return { units: 0, assumption: null };
  const rule = rules.find((item) => item.id === "minor-units-unique-to-the-minor" && item.confirmed);
  if (!rule || typeof rule.value !== "number") return { units: 0, assumption: null };
  const minorCodes = [...new Set([...minorCover.applied, ...minorCover.remaining])];
  const uniqueUnits = minorCodes
    .filter((code) => !majorCodes.has(code))
    .reduce((sum, code) => sum + unitsOf(byCode, code, held), 0);
  if (uniqueUnits >= rule.value) return { units: 0, assumption: null };
  const short = rule.value - uniqueUnits;
  return {
    units: short,
    assumption: {
      ruleId: rule.id,
      text: `${uniqueUnits} units of this minor are not already on the current path. The confirmed rule asks for ${rule.value} units unique to the minor, a shortfall of ${short}. Those units are not a list of courses.`,
    },
  };
}

function opportunity(input: {
  mode: Opportunity["mode"];
  student: StudentRecord;
  program: Program;
  extraTerms: number;
  extraUnits: number;
  binding: string;
  coursesThatCount: string[];
  coursesThatStopCounting: string[];
  remainingCourses: string[];
  capConfirmed: boolean;
  crossSchool: boolean;
  transfer: TransferCheck | null;
  assumptions: Assumption[];
}): Opportunity {
  return {
    mode: input.mode,
    studentId: input.student.id,
    programId: input.program.id,
    extraTerms: input.extraTerms,
    extraUnits: input.extraUnits,
    bindingConstraint: input.binding,
    coursesThatCount: input.coursesThatCount,
    coursesThatStopCounting: input.coursesThatStopCounting,
    remainingCourses: input.remainingCourses,
    verified: input.program.verified && input.capConfirmed,
    partial: isPartial(input.program),
    crossSchool: input.crossSchool,
    transfer: input.transfer,
    assumptions: input.assumptions,
  } as Opportunity;
}

function byCost(left: Opportunity, right: Opportunity): number {
  return left.extraTerms - right.extraTerms || left.extraUnits - right.extraUnits || left.programId.localeCompare(right.programId);
}

export function audit(
  student: StudentRecord,
  program: Program,
  courses: readonly Course[],
  policyRules: readonly PolicyRule[],
): AuditResult {
  const cap = termUnitCap(policyRules, undefined);
  const held = heldFrom(student);
  const byCode = catalogue(courses);
  const cover = coverProgram(program.requirements, courses, held);
  const remaining = [...closedCodes(cover)].sort();
  const assumptions = [
    ...cap.assumptions,
    ...progressAssumptions(student, cover.applied),
    ...blockedProgress(student, remaining),
    ...missingAssumptions(remaining, byCode),
  ];
  return {
    studentId: student.id,
    programId: program.id,
    satisfied: cover.ok && remaining.length === 0,
    unitsApplied: cover.applied.reduce((sum, code) => sum + unitsOf(byCode, code, held), 0),
    unitsRemaining: remaining.reduce((sum, code) => sum + unitsOf(byCode, code, held), 0),
    coursesRemaining: remaining,
    requirements: statusesFor(program.requirements, cover),
    assumptions,
  };
}

function scheduleCodes(
  student: StudentRecord,
  courses: readonly Course[],
  codes: readonly string[],
  cap: number,
): TermPlan["terms"] {
  const byCode = catalogue(courses);
  const done = new Set(student.courses.filter(countsOnRecord).map((course) => course.code));
  const skip = new Set(student.courses.filter((course) => course.status === "in_progress").map((course) => course.code));
  return scheduleRemaining({
    codes,
    byCode,
    done,
    skip,
    start: openingTerm(student),
    cap,
  }).terms;
}

function planAssumptions(
  student: StudentRecord,
  courses: readonly Course[],
  codes: readonly string[],
  capInfo: ReturnType<typeof termUnitCap>,
): Assumption[] {
  const byCode = catalogue(courses);
  const done = new Set(student.courses.filter(countsOnRecord).map((course) => course.code));
  const skip = new Set(student.courses.filter((course) => course.status === "in_progress").map((course) => course.code));
  const scheduled = scheduleRemaining({
    codes,
    byCode,
    done,
    skip,
    start: openingTerm(student),
    cap: capInfo.cap,
  });
  return [...capInfo.assumptions, ...scheduled.assumptions];
}

export function planTerms(
  student: StudentRecord,
  programs: readonly Program[],
  courses: readonly Course[],
  policyRules: readonly PolicyRule[],
  options?: PlanTermsOptions,
): TermPlan {
  const cap = termUnitCap(policyRules, options?.unitCap);
  const byCode = catalogue(courses);
  let held = heldFrom(student);
  const codes: string[] = [];
  const majorCourses = new Set<string>();
  for (const program of programs) {
    const cover = coverProgram(program.requirements, courses, held, majorCourses);
    for (const code of [...cover.applied, ...closedCodes(cover)]) majorCourses.add(code);
    for (const code of closedCodes(cover)) {
      if (!codes.includes(code)) codes.push(code);
      if (!held.some((row) => row.code === code)) {
        held = [
          ...held,
          {
            code,
            units: unitsOf(byCode, code, held),
            grade: null,
            inProgress: false,
            anticipated: true,
          },
        ];
      }
    }
  }
  const terms = scheduleCodes(student, courses, codes, cap.cap);
  return {
    studentId: student.id,
    programIds: programs.map((program) => program.id),
    terms,
    totalUnits: terms.reduce((sum, term) => sum + term.units, 0),
    assumptions: planAssumptions(student, courses, codes, cap),
  };
}

function currentPath(
  student: StudentRecord,
  programs: readonly Program[],
  courses: readonly Course[],
  cap: number,
): { coverCodes: string[]; applied: string[]; units: number; terms: number; codeSet: Set<string> } {
  const byCode = catalogue(courses);
  let held = heldFrom(student);
  const codes: string[] = [];
  const applied: string[] = [];
  const codeSet = new Set<string>();
  for (const program of programs) {
    const cover = coverProgram(program.requirements, courses, held, codeSet);
    for (const code of cover.applied) {
      if (!applied.includes(code)) applied.push(code);
      codeSet.add(code);
    }
    for (const code of closedCodes(cover)) {
      if (!codes.includes(code)) codes.push(code);
      codeSet.add(code);
      if (!held.some((row) => row.code === code)) {
        held = [
          ...held,
          { code, units: unitsOf(byCode, code, held), grade: null, inProgress: false, anticipated: true },
        ];
      }
    }
  }
  const units = codes.reduce((sum, code) => sum + unitsOf(byCode, code, held), 0);
  return { coverCodes: codes, applied, units, terms: scheduleCodes(student, courses, codes, cap).length, codeSet };
}

export function rankAddOns(
  student: StudentRecord,
  currentPrograms: readonly Program[],
  candidates: readonly Program[],
  courses: readonly Course[],
  policyRules: readonly PolicyRule[],
  transferRules: readonly TransferRule[],
): Opportunity[] {
  const cap = termUnitCap(policyRules, undefined);
  const byCode = catalogue(courses);
  const held = heldFrom(student);
  const current = currentPath(student, currentPrograms, courses, cap.cap);
  const rows: Opportunity[] = [];
  for (const candidate of candidates) {
    if (currentPrograms.some((program) => program.id === candidate.id)) continue;
    const anticipated: HeldCourse[] = current.coverCodes.map((code) => ({
      code,
      units: unitsOf(byCode, code, held),
      grade: null,
      inProgress: false,
      anticipated: true,
    }));
    const withPath = heldFrom(student, anticipated);
    const cover = coverProgram(candidate.requirements, courses, withPath, current.codeSet);
    const union = [...current.coverCodes];
    for (const code of closedCodes(cover)) {
      if (!union.includes(code)) union.push(code);
    }
    const unionUnits = union.reduce((sum, code) => sum + unitsOf(byCode, code, withPath), 0);
    const extraCodes = union.filter((code) => !current.coverCodes.includes(code));
    const shortfall = minorShortfall(candidate, current.codeSet, cover, policyRules, byCode, withPath);
    const extraTerms = scheduleCodes(student, courses, union, cap.cap).length - current.terms;
    const school = transferFor(student, candidate, transferRules, held);
    const assumptions = [
      ...cap.assumptions,
      ...progressAssumptions(student, cover.applied),
      ...missingAssumptions(extraCodes, byCode),
    ];
    if (shortfall.assumption) assumptions.push(shortfall.assumption);
    const countedFromPath = cover.applied.filter((code) => current.coverCodes.includes(code));
    if (countedFromPath.length > 0) {
      assumptions.push({
        ruleId: "shared-with-current-path",
        text: `${countedFromPath.join(", ")} ${countedFromPath.length === 1 ? "is" : "are"} still required on the current path. This add-on counts ${countedFromPath.length === 1 ? "it" : "them"}, and those units are not extra.`,
      });
    }
    rows.push(
      opportunity({
        mode: "add_on",
        student,
        program: candidate,
        extraTerms,
        extraUnits: unionUnits - current.units + shortfall.units,
        binding: bindingConstraint(extraCodes, byCode, cap.cap, Math.max(extraTerms, 0)),
        coursesThatCount: cover.applied.filter((code) => held.some((row) => row.code === code)),
        coursesThatStopCounting: [],
        remainingCourses: [...extraCodes].sort(),
        capConfirmed: cap.capConfirmed,
        crossSchool: school.crossSchool,
        transfer: school.transfer,
        assumptions,
      }),
    );
  }
  return rows.sort(byCost);
}

export function rankSwitches(
  student: StudentRecord,
  currentMajor: Program,
  targets: readonly Program[],
  courses: readonly Course[],
  policyRules: readonly PolicyRule[],
  transferRules: readonly TransferRule[],
): Opportunity[] {
  const cap = termUnitCap(policyRules, undefined);
  const byCode = catalogue(courses);
  const held = heldFrom(student);
  const current = currentPath(student, [currentMajor], courses, cap.cap);
  const rows: Opportunity[] = [];
  for (const target of targets) {
    if (target.id === currentMajor.id) continue;
    const cover = coverProgram(target.requirements, courses, held);
    const remaining = [...closedCodes(cover)].sort();
    const targetUnits = costUnits(makeContext(courses, held), cover);
    const targetTerms = scheduleCodes(student, courses, remaining, cap.cap).length;
    const school = transferFor(student, target, transferRules, held);
    const stopped = current.applied.filter(
      (code) => held.some((row) => row.code === code && !row.anticipated) && !cover.applied.includes(code),
    );
    rows.push(
      opportunity({
        mode: "switch",
        student,
        program: target,
        extraTerms: targetTerms - current.terms,
        extraUnits: targetUnits - current.units,
        binding: bindingConstraint(remaining, byCode, cap.cap, targetTerms),
        coursesThatCount: cover.applied.filter((code) => held.some((row) => row.code === code)),
        coursesThatStopCounting: [...stopped].sort(),
        remainingCourses: remaining,
        capConfirmed: cap.capConfirmed,
        crossSchool: school.crossSchool,
        transfer: school.transfer,
        assumptions: [
          ...cap.assumptions,
          ...progressAssumptions(student, cover.applied),
          ...missingAssumptions(remaining, byCode),
        ],
      }),
    );
  }
  return rows.sort(byCost);
}
