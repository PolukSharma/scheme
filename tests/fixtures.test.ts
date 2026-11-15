import { describe, expect, it } from "vitest";
import {
  careerMatch,
  chatAnswer,
  courses,
  policyRules,
  programs,
  stubResults,
  students,
  transferRules,
} from "@/fixtures";
import {
  auditResultSchema,
  careerMatchSchema,
  chatAnswerSchema,
  courseSchema,
  opportunitySchema,
  policyRuleSchema,
  programSchema,
  requirementNodeSchema,
  studentRecordSchema,
  termPlanSchema,
  transferRuleSchema,
} from "@/lib/types";
import type { RequirementNode } from "@/lib/types";

function walk(node: RequirementNode, visit: (node: RequirementNode) => void) {
  visit(node);
  if (node.type === "all_of") node.children.forEach((child) => walk(child, visit));
  if (node.type === "n_of") node.options.forEach((child) => walk(child, visit));
}

describe("fixtures", () => {
  it("loads every fixture through every shared type", () => {
    expect(courses).toHaveLength(40);
    expect(programs).toHaveLength(3);
    expect(students).toHaveLength(3);
    for (const course of courses) expect(courseSchema.parse(course).code).toBe(course.code);
    for (const program of programs) expect(programSchema.parse(program).id).toBe(program.id);
    for (const student of students) expect(studentRecordSchema.parse(student).id).toBe(student.id);
    for (const rule of policyRules) expect(policyRuleSchema.parse(rule).id).toBe(rule.id);
    for (const rule of transferRules) expect(transferRuleSchema.parse(rule).id).toBe(rule.id);
    expect(careerMatchSchema.parse(careerMatch).programId).toBe(careerMatch.programId);
    expect(chatAnswerSchema.parse(chatAnswer).fallback).toBe(true);
    for (const row of stubResults.byStudent) {
      for (const audit of row.audits) auditResultSchema.parse(audit);
      for (const addOn of row.addOns) opportunitySchema.parse(addOn);
      for (const target of row.switches) opportunitySchema.parse(target);
      termPlanSchema.parse(row.plan);
    }
    const quoted = programs.find((program) => program.id === careerMatch.programId);
    expect(quoted?.description.includes(careerMatch.reason)).toBe(true);
  });

  it("uses an invented department and the structures the engine needs", () => {
    expect(new Set(courses.map((course) => course.dept))).toEqual(new Set(["DEMO"]));
    const nodes: RequirementNode[] = [];
    for (const program of programs) walk(program.requirements, (node) => nodes.push(node));
    expect(nodes.some((node) => node.type === "n_of" && node.options.some((option) => option.type === "all_of"))).toBe(
      true,
    );
    expect(nodes.some((node) => node.type === "course_set" && node.match.dept === "DEMO")).toBe(true);
    expect(
      nodes.some((node) => node.constraints?.maxUnitsSharedWithMajor !== undefined),
    ).toBe(true);
    expect(nodes.filter((node) => node.type === "n_of").every((node) => node.type === "n_of" && (node.minCount !== undefined || node.minUnits !== undefined))).toBe(true);
  });

  it("rejects a choose-group that has neither a count nor a unit floor", () => {
    const result = requirementNodeSchema.safeParse({
      type: "n_of",
      id: "bad",
      options: [{ type: "course", id: "bad-course", code: "DEMO 101", source: courses[0].source, verified: false }],
      source: courses[0].source,
      verified: false,
    });
    expect(result.success).toBe(false);
  });

  it("keeps student courses, prerequisites, and schools inside the fixture", () => {
    const codes = new Set(courses.map((course) => course.code));
    for (const student of students) {
      for (const course of student.courses) {
        expect(codes.has(course.code)).toBe(true);
        const catalogue = courses.find((item) => item.code === course.code);
        expect(course.units).toBe(catalogue?.units);
      }
      expect(programs.some((program) => program.id === student.majorId)).toBe(true);
    }
    const schools = new Set(programs.map((program) => program.school));
    for (const school of schools) {
      expect(transferRules.some((rule) => rule.school === school)).toBe(true);
    }
    function prereqCodes(node: (typeof courses)[number]["prerequisites"], out: string[]) {
      if (!node) return;
      if (node.type === "course") out.push(node.code);
      else node.children.forEach((child) => prereqCodes(child, out));
    }
    for (const course of courses) {
      const refs: string[] = [];
      prereqCodes(course.prerequisites, refs);
      for (const code of refs) expect(codes.has(code)).toBe(true);
      expect(course.offerings.length).toBeGreaterThan(0);
    }
  });
});
