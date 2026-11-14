import { z } from "zod";

/**
 * Shared contracts for Scheme. Other agents code against these types.
 * Serialized field names are camelCase. The sketch in the build plan used
 * snake_case; the mapping is documented in docs/contracts.md.
 */

export const courseCodeSchema = z
  .string()
  .regex(/^[A-Z]{2,8} \d{3}[A-Z]?$/, "course code, for example DEMO 101");

export const sourceSchema = z.object({
  url: z.string().url(),
  catalogueYear: z.string().min(4),
  text: z.string().min(1),
});

export type Source = z.infer<typeof sourceSchema>;

export const termOfferingSchema = z.enum(["fall", "spring", "summer", "irregular"]);

export type TermOffering = z.infer<typeof termOfferingSchema>;

export type PrerequisiteExpr =
  | { type: "course"; code: string }
  | { type: "all_of"; children: PrerequisiteExpr[] }
  | { type: "n_of"; minCount: number; children: PrerequisiteExpr[] };

export const prerequisiteSchema: z.ZodType<PrerequisiteExpr> = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal("course"),
      code: courseCodeSchema,
    }),
    z.object({
      type: z.literal("all_of"),
      children: z.array(prerequisiteSchema).min(1),
    }),
    z.object({
      type: z.literal("n_of"),
      minCount: z.number().int().positive(),
      children: z.array(prerequisiteSchema).min(1),
    }),
  ]),
);

export const courseSchema = z.object({
  code: courseCodeSchema,
  title: z.string().min(1),
  units: z.number().positive(),
  dept: z.string().min(2),
  level: z.number().int().nonnegative(),
  prerequisites: prerequisiteSchema.nullable(),
  corequisites: z.array(courseCodeSchema),
  offerings: z.array(termOfferingSchema).min(1),
  source: sourceSchema,
});

export type Course = z.infer<typeof courseSchema>;

export const requirementConstraintsSchema = z.object({
  minGrade: z.string().min(1).optional(),
  maxUnitsSharedWithMajor: z.number().nonnegative().optional(),
});

export type RequirementConstraints = z.infer<typeof requirementConstraintsSchema>;

interface RequirementBase {
  id: string;
  constraints?: RequirementConstraints;
  source: Source;
  verified: boolean;
}

export interface CourseRequirement extends RequirementBase {
  type: "course";
  code: string;
}

export interface CourseSetMatch {
  dept?: string;
  levelMin?: number;
  levelMax?: number;
}

export interface CourseSetRequirement extends RequirementBase {
  type: "course_set";
  match: CourseSetMatch;
  /** Present when the set itself has a count or a unit floor. At least one of minCount and minUnits is set. */
  minCount?: number;
  minUnits?: number;
}

export interface AllOfRequirement extends RequirementBase {
  type: "all_of";
  children: RequirementNode[];
}

export interface NOfRequirement extends RequirementBase {
  type: "n_of";
  /** At least one of minCount and minUnits is set. */
  minCount?: number;
  minUnits?: number;
  options: RequirementNode[];
}

export type RequirementNode =
  | CourseRequirement
  | CourseSetRequirement
  | AllOfRequirement
  | NOfRequirement;

const requirementBaseShape = {
  id: z.string().min(1),
  constraints: requirementConstraintsSchema.optional(),
  source: sourceSchema,
  verified: z.boolean(),
};

export const requirementNodeSchema: z.ZodType<RequirementNode> = z.lazy(() =>
  z.union([
    z.object({
      ...requirementBaseShape,
      type: z.literal("course"),
      code: courseCodeSchema,
    }),
    z
      .object({
        ...requirementBaseShape,
        type: z.literal("course_set"),
        match: z
          .object({
            dept: z.string().min(2).optional(),
            levelMin: z.number().int().nonnegative().optional(),
            levelMax: z.number().int().positive().optional(),
          })
          .refine(
            (match) =>
              match.dept !== undefined ||
              match.levelMin !== undefined ||
              match.levelMax !== undefined,
            "course_set match needs a department or a level bound",
          ),
        minCount: z.number().int().positive().optional(),
        minUnits: z.number().positive().optional(),
      })
      .refine(
        (node) => node.minCount !== undefined || node.minUnits !== undefined,
        "course_set needs minCount or minUnits",
      ),
    z.object({
      ...requirementBaseShape,
      type: z.literal("all_of"),
      children: z.array(requirementNodeSchema).min(1),
    }),
    z
      .object({
        ...requirementBaseShape,
        type: z.literal("n_of"),
        minCount: z.number().int().positive().optional(),
        minUnits: z.number().positive().optional(),
        options: z.array(requirementNodeSchema).min(1),
      })
      .refine(
        (node) => node.minCount !== undefined || node.minUnits !== undefined,
        "n_of needs minCount or minUnits",
      ),
  ]),
);

export const programKindSchema = z.enum(["major", "minor", "specialization"]);

export type ProgramKind = z.infer<typeof programKindSchema>;

export const programSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  school: z.string().min(1),
  kind: programKindSchema,
  description: z.string().min(1),
  catalogueYear: z.string().min(4),
  requirements: requirementNodeSchema,
  source: sourceSchema,
  verified: z.boolean(),
  humanChecked: z.boolean(),
});

export type Program = z.infer<typeof programSchema>;

export const policyRuleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  summary: z.string().min(1),
  /** Null when the rule is known to matter but the value is not confirmed. */
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]),
  source: sourceSchema,
  confirmed: z.boolean(),
});

export type PolicyRule = z.infer<typeof policyRuleSchema>;

export const transferRuleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  school: z.string().min(1),
  summary: z.string().min(1),
  prerequisiteCourses: z.array(courseCodeSchema),
  gpaText: z.string().min(1).nullable(),
  timingText: z.string().min(1).nullable(),
  applicationSteps: z.array(z.string().min(1)),
  source: sourceSchema,
  /** ISO date (YYYY-MM-DD) when this page was checked. */
  dateChecked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confirmed: z.boolean(),
});

export type TransferRule = z.infer<typeof transferRuleSchema>;

export const studentCourseStatusSchema = z.enum([
  "completed",
  "in_progress",
  "transfer",
  "ap",
]);

export type StudentCourseStatus = z.infer<typeof studentCourseStatusSchema>;

export const studentCourseSchema = z
  .object({
    code: courseCodeSchema,
    units: z.number().positive(),
    grade: z.string().min(1).nullable(),
    term: z.string().min(4).nullable(),
    status: studentCourseStatusSchema,
  })
  .refine(
    (course) => course.status !== "in_progress" || course.grade === null,
    "an in-progress course has no final grade",
  );

export type StudentCourse = z.infer<typeof studentCourseSchema>;

export const studentRecordSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    label: z.string().min(1),
    school: z.string().min(1),
    startYear: z.number().int().min(1900).max(2100),
    startTerm: z.string().min(4),
    catalogueYear: z.string().min(4),
    majorId: z.string().min(1),
    declaredProgramIds: z.array(z.string().min(1)).min(1),
    courses: z.array(studentCourseSchema),
  })
  .refine(
    (student) => student.declaredProgramIds.includes(student.majorId),
    "majorId is one of declaredProgramIds",
  );

export type StudentRecord = z.infer<typeof studentRecordSchema>;

export const assumptionSchema = z.object({
  ruleId: z.string().min(1),
  text: z.string().min(1),
});

export type Assumption = z.infer<typeof assumptionSchema>;

export const requirementStatusSchema = z.object({
  nodeId: z.string().min(1),
  satisfied: z.boolean(),
  appliedCourses: z.array(courseCodeSchema),
  remainingUnits: z.number().nonnegative(),
  note: z.string().min(1),
  source: sourceSchema,
});

export type RequirementStatus = z.infer<typeof requirementStatusSchema>;

export const auditResultSchema = z.object({
  studentId: z.string().min(1),
  programId: z.string().min(1),
  satisfied: z.boolean(),
  unitsApplied: z.number().nonnegative(),
  unitsRemaining: z.number().nonnegative(),
  coursesRemaining: z.array(courseCodeSchema),
  requirements: z.array(requirementStatusSchema),
  assumptions: z.array(assumptionSchema),
});

export type AuditResult = z.infer<typeof auditResultSchema>;

export const transferCheckSchema = z.object({
  rule: transferRuleSchema,
  prerequisitesHave: z.array(courseCodeSchema),
  prerequisitesLack: z.array(courseCodeSchema),
});

export type TransferCheck = z.infer<typeof transferCheckSchema>;

export const opportunityModeSchema = z.enum(["add_on", "switch"]);

export type OpportunityMode = z.infer<typeof opportunityModeSchema>;

export const opportunitySchema = z.object({
  mode: opportunityModeSchema,
  studentId: z.string().min(1),
  programId: z.string().min(1),
  /**
   * Add-on: extra terms beyond the current degree.
   * Switch: change in terms against the current path. Negative means fewer terms.
   */
  extraTerms: z.number().int(),
  /** Same sign convention as extraTerms, in units. */
  extraUnits: z.number(),
  bindingConstraint: z.string().min(1),
  coursesThatCount: z.array(courseCodeSchema),
  coursesThatStopCounting: z.array(courseCodeSchema),
  remainingCourses: z.array(courseCodeSchema),
  verified: z.boolean(),
  /** True when the target program's school differs from the student's school. */
  crossSchool: z.boolean(),
  /**
   * The target school's transfer rule when one is on file.
   * Null when the schools match, or when they differ and no rule is on file.
   */
  transfer: transferCheckSchema.nullable(),
  assumptions: z.array(assumptionSchema),
});

export type Opportunity = z.infer<typeof opportunitySchema>;

export const plannedCourseSchema = z.object({
  code: courseCodeSchema,
  units: z.number().positive(),
  title: z.string().min(1),
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

export const careerMatchSchema = z.object({
  programId: z.string().min(1),
  /** A suggestion. The reason is a verbatim substring of stored catalogue text. */
  reason: z.string().min(1),
  source: sourceSchema,
});

export type CareerMatch = z.infer<typeof careerMatchSchema>;

export const chatCitationSchema = z.object({
  label: z.string().min(1),
  source: sourceSchema,
});

export type ChatCitation = z.infer<typeof chatCitationSchema>;

export const chatAnswerSchema = z.object({
  text: z.string().min(1),
  citations: z.array(chatCitationSchema),
  /** True when the answer is the engine-only fallback rather than a model reply. */
  fallback: z.boolean(),
});

export type ChatAnswer = z.infer<typeof chatAnswerSchema>;

export const stubStudentSchema = z.object({
  studentId: z.string().min(1),
  audits: z.array(auditResultSchema),
  addOns: z.array(opportunitySchema),
  switches: z.array(opportunitySchema),
  plan: termPlanSchema,
});

export const stubResultsSchema = z.object({
  byStudent: z.array(stubStudentSchema),
});

export type StubResults = z.infer<typeof stubResultsSchema>;

export const courseListSchema = z.array(courseSchema);
export const programListSchema = z.array(programSchema);
export const policyRuleListSchema = z.array(policyRuleSchema);
export const transferRuleListSchema = z.array(transferRuleSchema);
export const studentListSchema = z.array(studentRecordSchema);

export function parseWith<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`${label} failed validation: ${result.error.message}`);
  }
  return result.data;
}
