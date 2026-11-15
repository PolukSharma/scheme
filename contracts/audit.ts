import { z } from "zod";
import { courseCodeSchema } from "./course";

export const assumptionSchema = z.object({
  ruleId: z.string().min(1),
  text: z.string().min(1),
});

export type Assumption = z.infer<typeof assumptionSchema>;

export const requirementOutcomeSchema = z.object({
  nodeId: z.string().min(1),
  satisfied: z.boolean(),
  appliedCourses: z.array(courseCodeSchema),
  remainingUnits: z.number().nonnegative(),
  note: z.string().min(1),
});

export type RequirementOutcome = z.infer<typeof requirementOutcomeSchema>;

export const auditResultSchema = z.object({
  studentId: z.string().min(1),
  programId: z.string().min(1),
  satisfied: z.boolean(),
  unitsApplied: z.number().nonnegative(),
  unitsRemaining: z.number().nonnegative(),
  requirements: z.array(requirementOutcomeSchema),
  assumptions: z.array(assumptionSchema),
});

export type AuditResult = z.infer<typeof auditResultSchema>;
