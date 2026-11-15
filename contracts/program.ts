import { z } from "zod";
import { requirementNodeSchema } from "./requirement";
import { catalogueYearSchema, sourceSchema } from "./source";

export const programKindSchema = z.enum([
  "major",
  "minor",
  "specialization",
  "progressive",
]);

export type ProgramKind = z.infer<typeof programKindSchema>;

export const programSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  school: z.string().min(1),
  kind: programKindSchema,
  /** Prose a career-fit reason may quote. Synthetic fixtures are labeled as such. */
  description: z.string().min(1),
  catalogueYear: catalogueYearSchema,
  /** Units the catalogue states for the program. Recompute this from the tree before trusting it. */
  totalUnits: z.number().positive(),
  requirements: requirementNodeSchema,
  source: sourceSchema,
  verified: z.boolean(),
});

export type Program = z.infer<typeof programSchema>;
