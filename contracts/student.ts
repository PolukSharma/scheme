import { z } from "zod";
import { courseCodeSchema } from "./course";
import { catalogueYearSchema } from "./source";

/** STARS term code: year plus 1 spring, 2 summer, or 3 fall. */
export const termCodeSchema = z.string().regex(/^\d{4}[123]$/);

export type TermCode = z.infer<typeof termCodeSchema>;

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
    title: z.string().min(1),
    units: z.number().positive(),
    /** Null for in-progress work, which has no final grade. */
    grade: z.string().min(1).nullable(),
    term: termCodeSchema.nullable(),
    status: studentCourseStatusSchema,
    flags: z.array(z.string().min(1)),
  })
  .superRefine((course, ctx) => {
    if (course.status === "in_progress" && course.grade !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "an in-progress course has no final grade",
      });
    }
  });

export type StudentCourse = z.infer<typeof studentCourseSchema>;

export const declaredProgramSchema = z.object({
  programId: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(["primary", "minor", "specialization"]),
  effectiveTerm: termCodeSchema.nullable(),
});

export type DeclaredProgram = z.infer<typeof declaredProgramSchema>;

/** A line from a STARS requirement block. PLUS and MINUS are the + and - status codes. */
export const remainingRequirementStatusSchema = z.enum([
  "OK",
  "NO",
  "IP",
  "+",
  "-",
  "NEEDS",
  "SELECT FROM",
]);

export const remainingRequirementSchema = z.object({
  text: z.string().min(1),
  status: remainingRequirementStatusSchema,
});

export type RemainingRequirement = z.infer<typeof remainingRequirementSchema>;

/**
 * Parsed STARS record. Name, student ID, and diploma address are stripped before this object exists.
 * `id` is a fixture key, never a USC ID. `label` is a persona label, never a legal name.
 */
export const studentRecordSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    label: z.string().min(1),
    school: z.string().min(1),
    entranceTerm: termCodeSchema,
    classLevel: z.string().min(1),
    expectedGraduation: termCodeSchema,
    catalogueYear: catalogueYearSchema,
    declaredPrograms: z.array(declaredProgramSchema).min(1),
    units: z.object({
      earned: z.number().nonnegative(),
      inProgress: z.number().nonnegative(),
      transfer: z.number().nonnegative(),
      ap: z.number().nonnegative(),
    }),
    courses: z.array(studentCourseSchema),
    remainingRequirements: z.array(remainingRequirementSchema),
  })
  .superRefine((student, ctx) => {
    const primary = student.declaredPrograms.filter((program) => program.role === "primary");
    if (primary.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "a student record has exactly one primary program",
      });
    }
  });

export type StudentRecord = z.infer<typeof studentRecordSchema>;
