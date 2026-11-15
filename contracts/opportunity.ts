import { z } from "zod";
import { assumptionSchema } from "./audit";
import { courseCodeSchema } from "./course";

/** `add-on` keeps the current path. `switch` replaces the primary program. */
export const opportunityModeSchema = z.enum(["add-on", "switch"]);

export type OpportunityMode = z.infer<typeof opportunityModeSchema>;

export const opportunitySchema = z.object({
  mode: opportunityModeSchema,
  studentId: z.string().min(1),
  programId: z.string().min(1),
  /** Add-on: terms beyond the current degree. Switch: change against the current path. Negative means fewer terms. */
  extraTerms: z.number().int(),
  /** Same sign convention as extraTerms, in units. */
  extraUnits: z.number(),
  /**
   * Estimated extra tuition in dollars.
   * Null until a policy rule quotes the figure. Never invent this number.
   */
  estimatedCost: z.number().nonnegative().nullable(),
  bindingConstraint: z.string().min(1),
  coursesThatCount: z.array(courseCodeSchema),
  /** Completed courses that would stop counting. Empty for an add-on that drops nothing. */
  coursesThatStopCounting: z.array(courseCodeSchema),
  /** True when the target program's school differs from the student's school. */
  crossSchool: z.boolean(),
  /** Id of a TransferRule. Null when the schools match or no rule is on file. */
  transferRuleId: z.string().min(1).nullable(),
  prerequisitesHave: z.array(courseCodeSchema),
  prerequisitesLack: z.array(courseCodeSchema),
  verified: z.boolean(),
  assumptions: z.array(assumptionSchema),
});

export type Opportunity = z.infer<typeof opportunitySchema>;
