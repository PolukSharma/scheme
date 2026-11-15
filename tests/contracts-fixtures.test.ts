import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  fixtureSchemaByFile,
  opportunitySchema,
  prerequisiteSchema,
  requirementNodeSchema,
  type FixtureFile,
  type RequirementNode,
} from "@/contracts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(root, "evals", "fixtures");

function walk(node: RequirementNode, visit: (node: RequirementNode) => void) {
  visit(node);
  if (node.type === "all_of" || node.type === "n_of") {
    node.children.forEach((child) => walk(child, visit));
  }
  if (node.type === "unit_min") walk(node.child, visit);
}

describe("fixtures", () => {
  it("loads every fixture through every schema", () => {
    const filenames = readdirSync(fixtureDir)
      .filter((name) => name.endsWith(".json"))
      .sort();
    const expected = Object.keys(fixtureSchemaByFile).sort();
    expect(filenames).toEqual(expected);

    const parsed = {} as { [K in FixtureFile]: unknown };
    for (const name of expected) {
      const file = name as FixtureFile;
      const raw = JSON.parse(readFileSync(path.join(fixtureDir, file), "utf8")) as unknown;
      parsed[file] = fixtureSchemaByFile[file].parse(raw);
    }

    const courses = parsed["courses.json"] as {
      code: string;
      prerequisites: unknown;
      verified: boolean;
    }[];
    const programs = parsed["programs.json"] as {
      id: string;
      description: string;
      requirements: RequirementNode;
      verified: boolean;
      school: string;
    }[];
    const students = parsed["students.json"] as {
      id: string;
      declaredPrograms: { programId: string; role: string }[];
      courses: { code: string; units: number }[];
    }[];
    const rules = parsed["policy-rules.json"] as { id: string; value: unknown; verified: boolean }[];
    const transfers = parsed["transfer-rules.json"] as {
      id: string;
      toSchool: string;
      verified: boolean;
    }[];
    const opportunities = parsed["opportunities.json"] as {
      mode: string;
      estimatedCost: number | null;
      verified: boolean;
    }[];
    const fits = parsed["career-fits.json"] as {
      noStrongMatch: boolean;
      matches: { programId: string; reason: string; suggestion: true }[];
    }[];

    expect(courses).toHaveLength(40);
    expect(programs).toHaveLength(3);
    expect(students).toHaveLength(3);
    expect(courses.every((course) => course.verified === false)).toBe(true);
    expect(programs.every((program) => program.verified === false)).toBe(true);
    expect(rules.every((rule) => rule.verified === false)).toBe(true);
    expect(transfers.every((rule) => rule.verified === false)).toBe(true);
    expect(opportunities.every((row) => row.estimatedCost === null && row.verified === false)).toBe(
      true,
    );
    expect(new Set(opportunities.map((row) => row.mode))).toEqual(new Set(["add-on", "switch"]));
    expect(rules.some((rule) => rule.id === "synthetic-tuition-unconfirmed" && rule.value === null)).toBe(
      true,
    );

    const nodes: RequirementNode[] = [];
    for (const program of programs) {
      walk(program.requirements, (node) => {
        expect(requirementNodeSchema.parse(node).id).toBe(node.id);
        expect(node.source.url).toMatch(/^https:\/\//);
        expect(node.source.catalogueYear).toMatch(/^\d{4}-\d{4}$/);
        nodes.push(node);
      });
    }
    expect(new Set(nodes.map((node) => node.type))).toEqual(
      new Set(["course", "course_set", "n_of", "all_of", "unit_min"]),
    );

    const codes = new Set(courses.map((course) => course.code));
    for (const course of courses) {
      if (course.prerequisites) prerequisiteSchema.parse(course.prerequisites);
    }
    for (const student of students) {
      expect(student.declaredPrograms.filter((program) => program.role === "primary")).toHaveLength(1);
      for (const course of student.courses) {
        expect(codes.has(course.code)).toBe(true);
      }
      for (const declared of student.declaredPrograms) {
        expect(programs.some((program) => program.id === declared.programId)).toBe(true);
      }
    }
    for (const school of new Set(programs.map((program) => program.school))) {
      expect(transfers.some((rule) => rule.toSchool === school)).toBe(true);
    }

    const quoted = fits.find((fit) => !fit.noStrongMatch);
    expect(quoted?.matches[0]?.suggestion).toBe(true);
    const quotedProgram = programs.find((program) => program.id === quoted?.matches[0]?.programId);
    expect(quotedProgram?.description.includes(quoted?.matches[0]?.reason ?? "")).toBe(true);
    expect(fits.some((fit) => fit.noStrongMatch && fit.matches.length === 0)).toBe(true);

    for (const row of parsed["opportunities.json"] as unknown[]) {
      opportunitySchema.parse(row);
    }

    const wordmark = readFileSync(path.join(root, "components", "wordmark.tsx"), "utf8");
    expect(wordmark).toContain("export function Wordmark");
    expect(wordmark).toContain('"#990000"');
    expect(wordmark).toContain('"#1A1A1A"');
  });
});
