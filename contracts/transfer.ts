import { z } from "zod";
import { courseCodeSchema } from "./course";
import { sourceSchema } from "./source";

/**
 * Internal-transfer facts for one destination school.
 * Admission is never implied. The UI lists what is on file and what the student has or lacks.
 */
export const transferRuleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  fromSchool: z.string().min(1),
  toSchool: z.string().min(1),
  summary: z.string().min(1),
  prerequisiteCourses: z.array(courseCodeSchema),
  source: sourceSchema,
  /** ISO date (YYYY-MM-DD) when the page was checked. */
  dateChecked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  verified: z.boolean(),
});

export type TransferRule = z.infer<typeof transferRuleSchema>;
