import { z } from "zod";
import { auditResultSchema } from "./audit";
import { careerFitSchema } from "./career";
import { courseSchema } from "./course";
import { opportunitySchema } from "./opportunity";
import { policyRuleSchema } from "./policy";
import { programSchema } from "./program";
import { studentRecordSchema } from "./student";
import { termPlanSchema } from "./term-plan";
import { transferRuleSchema } from "./transfer";

export { assumptionSchema, auditResultSchema, requirementOutcomeSchema } from "./audit";
export type { Assumption, AuditResult, RequirementOutcome } from "./audit";

export { careerFitMatchSchema, careerFitSchema } from "./career";
export type { CareerFit, CareerFitMatch } from "./career";

export { courseCodeSchema, courseSchema, offeringPatternSchema, prerequisiteSchema } from "./course";
export type { Course, CourseCode, OfferingPattern, PrerequisiteNode } from "./course";

export { opportunityModeSchema, opportunitySchema } from "./opportunity";
export type { Opportunity, OpportunityMode } from "./opportunity";

export { policyRuleSchema } from "./policy";
export type { PolicyRule } from "./policy";

export { programKindSchema, programSchema } from "./program";
export type { Program, ProgramKind } from "./program";

export { requirementNodeSchema } from "./requirement";
export type {
  AllOfRequirement,
  CourseRequirement,
  CourseSetRequirement,
  NOfRequirement,
  RequirementNode,
  UnitMinRequirement,
} from "./requirement";

export { catalogueYearSchema, sourceSchema } from "./source";
export type { CatalogueYear, Source } from "./source";

export {
  declaredProgramSchema,
  remainingRequirementSchema,
  remainingRequirementStatusSchema,
  studentCourseSchema,
  studentCourseStatusSchema,
  studentRecordSchema,
  termCodeSchema,
} from "./student";
export type {
  DeclaredProgram,
  RemainingRequirement,
  StudentCourse,
  StudentCourseStatus,
  StudentRecord,
  TermCode,
} from "./student";

export { plannedCourseSchema, plannedTermSchema, termPlanSchema } from "./term-plan";
export type { PlannedCourse, PlannedTerm, TermPlan } from "./term-plan";

export { transferRuleSchema } from "./transfer";
export type { TransferRule } from "./transfer";

/** Fixture filename to the schema that file must satisfy. */
export const fixtureSchemaByFile = {
  "courses.json": z.array(courseSchema).length(40),
  "programs.json": z.array(programSchema).length(3),
  "students.json": z.array(studentRecordSchema).length(3),
  "policy-rules.json": z.array(policyRuleSchema).min(1),
  "transfer-rules.json": z.array(transferRuleSchema).min(1),
  "audit-results.json": z.array(auditResultSchema).min(1),
  "opportunities.json": z.array(opportunitySchema).min(1),
  "term-plans.json": z.array(termPlanSchema).min(1),
  "career-fits.json": z.array(careerFitSchema).min(1),
} as const;

export type FixtureFile = keyof typeof fixtureSchemaByFile;
