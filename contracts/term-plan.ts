import { z } from "zod";
import { assumptionSchema } from "./audit";
import { courseCodeSchema } from "./course";

export const plannedCourseSchema = z.object({
  code: courseCodeSchema,
  title: z.string().min(1),
  units: z.number().positive(),
});

export type PlannedCourse = z.infer<typeof plannedCourseSchema>;

export const plannedTermSchema = z.object({
  label: z.string().min(1),
  season: z.enum(["fall", "spring", "summer"]),
  year: z.number().int(),
  courses: z.array(plannedCourseSchema),
  units: z.number().nonnegative(),
});

export type PlannedTerm = z.infer<typeof plannedTermSchema>;

export const termPlanSchema = z.object({
  studentId: z.string().min(1),
  programIds: z.array(z.string().min(1)).min(1),
  terms: z.array(plannedTermSchema),
  totalUnits: z.number().nonnegative(),
  assumptions: z.array(assumptionSchema),
});

export type TermPlan = z.infer<typeof termPlanSchema>;
