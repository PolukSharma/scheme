import { z } from "zod";
import { sourceSchema } from "./source";

/**
 * A university rule that changes overlap or cost.
 * `value` is null when the rule matters but the figure is not quoted from a source.
 * Do not fill a null with a remembered tuition number.
 */
export const policyRuleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  summary: z.string().min(1),
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]),
  source: sourceSchema,
  verified: z.boolean(),
});

export type PolicyRule = z.infer<typeof policyRuleSchema>;
