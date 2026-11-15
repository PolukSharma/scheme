import { z } from "zod";
import { sourceSchema } from "./source";

/**
 * One suggested program. `reason` must be a verbatim substring of stored catalogue or fixture text.
 * `extraUnits` and `extraTerms` are copied from the engine and are not recomputed here.
 */
export const careerFitMatchSchema = z.object({
  programId: z.string().min(1),
  reason: z.string().min(1),
  source: sourceSchema,
  suggestion: z.literal(true),
  extraUnits: z.number(),
  extraTerms: z.number().int(),
});

export type CareerFitMatch = z.infer<typeof careerFitMatchSchema>;

export const careerFitSchema = z
  .object({
    goal: z.string().min(1),
    matches: z.array(careerFitMatchSchema).max(3),
    noStrongMatch: z.boolean(),
  })
  .superRefine((fit, ctx) => {
    if (fit.noStrongMatch && fit.matches.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "noStrongMatch is returned with an empty match list",
      });
    }
    if (!fit.noStrongMatch && fit.matches.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "a strong match needs at least one program",
      });
    }
  });

export type CareerFit = z.infer<typeof careerFitSchema>;
