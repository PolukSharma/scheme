import { opportunitySchema, type Opportunity } from "@/lib/types";
import { z } from "zod";

/** An engine Opportunity with the student id removed. The model never sees that id. */
const postedShape = opportunitySchema.omit({ studentId: true });

export const postedOpportunitySchema = postedShape.strict();

export type PostedOpportunity = z.infer<typeof postedOpportunitySchema>;

export function postOpportunity(opportunity: Opportunity): PostedOpportunity {
  return postedShape.parse(opportunity);
}
