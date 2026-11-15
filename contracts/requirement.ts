import { z } from "zod";
import { courseCodeSchema } from "./course";
import { sourceSchema, type Source } from "./source";

const requirementIdSchema = z.string().regex(/^[a-z0-9-]+$/);

const requirementBase = {
  id: requirementIdSchema,
  source: sourceSchema,
  verified: z.boolean(),
  /** Minimum grade when the catalogue states one, for example "C". */
  minGrade: z.string().min(1).optional(),
};

interface RequirementBase {
  id: string;
  source: Source;
  verified: boolean;
  minGrade?: string;
}

export interface CourseRequirement extends RequirementBase {
  type: "course";
  code: string;
}

export interface CourseSetRequirement extends RequirementBase {
  type: "course_set";
  /** How many courses from the pool must be used. */
  minCount: number;
  /** Explicit pool. Omit when the pool is described by subject or level. */
  codes?: string[];
  /** Department prefix, for example DEMO. */
  subject?: string;
  /** Inclusive catalogue-number floor, for example 300. */
  minLevel?: number;
}

export interface NOfRequirement extends RequirementBase {
  type: "n_of";
  n: number;
  children: RequirementNode[];
}

export interface AllOfRequirement extends RequirementBase {
  type: "all_of";
  children: RequirementNode[];
}

/** At least `minUnits` drawn from `child`. */
export interface UnitMinRequirement extends RequirementBase {
  type: "unit_min";
  minUnits: number;
  child: RequirementNode;
}

export type RequirementNode =
  | CourseRequirement
  | CourseSetRequirement
  | NOfRequirement
  | AllOfRequirement
  | UnitMinRequirement;

const courseRequirementSchema = z.object({
  ...requirementBase,
  type: z.literal("course"),
  code: courseCodeSchema,
});

const courseSetRequirementSchema = z
  .object({
    ...requirementBase,
    type: z.literal("course_set"),
    minCount: z.number().int().positive(),
    codes: z.array(courseCodeSchema).min(1).optional(),
    subject: z
      .string()
      .regex(/^[A-Z]{2,8}$/)
      .optional(),
    minLevel: z.number().int().nonnegative().optional(),
  })
  .superRefine((node, ctx) => {
    const hasCodes = node.codes !== undefined && node.codes.length > 0;
    if (!hasCodes && node.subject === undefined && node.minLevel === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "course_set needs codes, a subject, or a minLevel",
      });
    }
  });

const nOfRequirementSchema = z
  .object({
    ...requirementBase,
    type: z.literal("n_of"),
    n: z.number().int().positive(),
    children: z.array(z.lazy(() => requirementNodeSchema)).min(1),
  })
  .superRefine((node, ctx) => {
    if (node.n > node.children.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "n_of n cannot exceed the number of children",
      });
    }
  });

const allOfRequirementSchema = z.object({
  ...requirementBase,
  type: z.literal("all_of"),
  children: z.array(z.lazy(() => requirementNodeSchema)).min(1),
});

const unitMinRequirementSchema = z.object({
  ...requirementBase,
  type: z.literal("unit_min"),
  minUnits: z.number().positive(),
  child: z.lazy(() => requirementNodeSchema),
});

export const requirementNodeSchema: z.ZodType<RequirementNode> = z.lazy(() =>
  z.union([
    courseRequirementSchema,
    courseSetRequirementSchema,
    nOfRequirementSchema,
    allOfRequirementSchema,
    unitMinRequirementSchema,
  ]),
);
