import type { AuditResult, Course, PolicyRule, Program, StudentRecord } from "@/lib/types";
import { closedCodes, coverProgram } from "./assign";
import { termUnitCap } from "./policy";
import {
  blockedProgress,
  catalogue,
  heldFrom,
  missingAssumptions,
  progressAssumptions,
  statusesFor,
  unitsOf,
  unlistedAssumptions,
} from "./shared";

/**
 * Minimum remaining units for one program.
 * A course is applied to each requirement it can fill, up to the sharing limits
 * on that requirement. Repeated requirement ids stay separate.
 */
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
  const unlisted = cover.unlistedUnits ?? 0;
  const assumptions = [
    ...cap.assumptions,
    ...unlistedAssumptions(program.requirements),
    ...progressAssumptions(student, cover.applied),
    ...blockedProgress(student, remaining),
    ...missingAssumptions(remaining, byCode),
  ];
  return {
    studentId: student.id,
    programId: program.id,
    satisfied: cover.ok && remaining.length === 0 && unlisted === 0,
    unitsApplied: cover.applied.reduce((sum, code) => sum + unitsOf(byCode, code, held), 0),
    unitsRemaining: remaining.reduce((sum, code) => sum + unitsOf(byCode, code, held), 0) + unlisted,
    coursesRemaining: remaining,
    requirements: statusesFor(program.requirements, cover),
    assumptions,
  };
}
