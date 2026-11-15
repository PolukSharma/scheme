import { z } from "zod";

/** Catalogue year as printed on a USC catalogue, for example 2026-2027. */
export const catalogueYearSchema = z
  .string()
  .regex(/^\d{4}-\d{4}$/, "catalogue year, for example 2026-2027");

/**
 * Provenance required on every requirement and policy rule.
 * `text` is the quoted passage the fact came from. Synthetic fixtures say so in `text`.
 */
export const sourceSchema = z.object({
  url: z.string().url(),
  catalogueYear: catalogueYearSchema,
  text: z.string().min(1),
});

export type Source = z.infer<typeof sourceSchema>;
export type CatalogueYear = z.infer<typeof catalogueYearSchema>;
