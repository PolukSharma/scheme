import { z } from "zod";
import { sourceSchema } from "./source";

/**
 * Department prefix plus catalogue number, as the 2026-2027 catalogue prints it.
 * A suffix may include a sequence letter and markers such as L, g, or x
 * (CHEM 105aLg, CSCI 103L). DEMO 101 still matches.
 */
export const courseCodeSchema = z
  .string()
  .regex(/^[A-Z]{2,8} \d{3}[A-Za-z]{0,4}$/, "course code, for example DEMO 101 or CHEM 105aLg");

export type CourseCode = z.infer<typeof courseCodeSchema>;

/**
 * When a course is offered.
 * `both` means fall and spring. `unknown` means the pattern is not on file.
 */
export const offeringPatternSchema = z.enum(["fall", "spring", "both", "unknown"]);

export type OfferingPattern = z.infer<typeof offeringPatternSchema>;

export type PrerequisiteNode =
  | { type: "course"; code: CourseCode }
  | { type: "all_of"; children: PrerequisiteNode[] }
  | { type: "n_of"; n: number; children: PrerequisiteNode[] };

export const prerequisiteSchema: z.ZodType<PrerequisiteNode> = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal("course"),
      code: courseCodeSchema,
    }),
    z.object({
      type: z.literal("all_of"),
      children: z.array(prerequisiteSchema).min(1),
    }),
    z
      .object({
        type: z.literal("n_of"),
        n: z.number().int().positive(),
        children: z.array(prerequisiteSchema).min(1),
      })
      .superRefine((node, ctx) => {
        if (node.n > node.children.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "n_of n cannot exceed the number of children",
          });
        }
      }),
  ]),
);

export const courseSchema = z.object({
  code: courseCodeSchema,
  title: z.string().min(1),
  /**
   * Catalogue units. Zero is a printed value: ENGR 495 Practicum is 0 units.
   * A course whose page prints a range stores the lowest printed number and is unverified.
   */
  units: z.number().nonnegative(),
  /** Null when the course has no prerequisites. */
  prerequisites: prerequisiteSchema.nullable(),
  offering: offeringPatternSchema,
  source: sourceSchema,
  verified: z.boolean(),
});

export type Course = z.infer<typeof courseSchema>;
