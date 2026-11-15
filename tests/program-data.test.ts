import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { courseSchema, programSchema, type Course, type PrerequisiteNode, type RequirementNode } from "@/contracts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relative: string): unknown {
  return JSON.parse(readFileSync(path.join(root, relative), "utf8"));
}

/** Minimum units on the cheapest way to satisfy the node. A subject pool with no codes contributes 0; a unit floor then uses its own minimum. */
function minimumUnits(node: RequirementNode, unitsOf: ReadonlyMap<string, number>): number {
  switch (node.type) {
    case "course": {
      const units = unitsOf.get(node.code);
      if (units === undefined) throw new Error(`missing course ${node.code}`);
      return units;
    }
    case "all_of":
      return node.children.reduce((sum, child) => sum + minimumUnits(child, unitsOf), 0);
    case "n_of": {
      const costs = node.children.map((child) => minimumUnits(child, unitsOf)).sort((a, b) => a - b);
      return costs.slice(0, node.n).reduce((sum, value) => sum + value, 0);
    }
    case "course_set": {
      if (!node.codes) return 0;
      const costs = node.codes.map((code) => {
        const units = unitsOf.get(code);
        if (units === undefined) throw new Error(`missing course ${code}`);
        return units;
      });
      costs.sort((a, b) => a - b);
      return costs.slice(0, node.minCount).reduce((sum, value) => sum + value, 0);
    }
    case "unit_min":
      return Math.max(node.minUnits, minimumUnits(node.child, unitsOf));
    default: {
      const unreachable: never = node;
      return unreachable;
    }
  }
}

function walkRequirements(node: RequirementNode, visit: (node: RequirementNode) => void) {
  visit(node);
  if (node.type === "all_of" || node.type === "n_of") {
    node.children.forEach((child) => walkRequirements(child, visit));
  }
  if (node.type === "unit_min") walkRequirements(node.child, visit);
}

function walkPrerequisites(node: PrerequisiteNode, visit: (node: PrerequisiteNode) => void) {
  visit(node);
  if (node.type !== "course") node.children.forEach((child) => walkPrerequisites(child, visit));
}

describe("tier 1 catalogue data", () => {
  const courses = courseSchema.array().parse(readJson("data/courses.json"));
  const unitsOf = new Map(courses.map((course) => [course.code, course.units]));
  const gaps = readFileSync(path.join(root, "docs/data-gaps.md"), "utf8");
  const programFiles = readdirSync(path.join(root, "data/programs"))
    .filter((name) => name.endsWith(".json"))
    .sort();

  it("covers the six Tier 1 programs", () => {
    expect(programFiles).toEqual([
      "artificial-intelligence-applications-minor.json",
      "computational-neuroscience-bs.json",
      "computer-science-bs.json",
      "computer-science-business-administration-bs.json",
      "law-and-regulation-of-artificial-intelligence-minor.json",
      "neuroscience-bs.json",
    ]);
  });

  it("validates every program and compares the tree with the stated total", () => {
    const programs = programFiles.map((name) => programSchema.parse(readJson(`data/programs/${name}`)));
    expect(new Set(programs.map((program) => program.id)).size).toBe(programs.length);

    for (const program of programs) {
      const built = minimumUnits(program.requirements, unitsOf);
      const codes: string[] = [];
      walkRequirements(program.requirements, (node) => {
        if (node.type === "course") codes.push(node.code);
        if (node.type === "course_set") codes.push(...(node.codes ?? []));
        expect(node.source.text).not.toContain("levelMin is not a catalogue rule");
      });
      for (const code of codes) expect(unitsOf.has(code), code).toBe(true);

      if (program.verified) {
        expect(built, program.id).toBe(program.totalUnits);
        walkRequirements(program.requirements, (node) => {
          expect(node.verified, node.id).toBe(true);
        });
      } else {
        expect(gaps).toContain(`### ${program.id}`);
        expect(gaps).toContain(`Tree minimum: ${built}.`);
        expect(gaps).toContain(`Stated total stored on the program: ${program.totalUnits}.`);
      }
    }

    const law = programs.find((program) => program.id === "law-and-regulation-of-artificial-intelligence-minor");
    expect(law?.verified).toBe(true);
    expect(law?.totalUnits).toBe(20);
  });

  it("validates courses and keeps prerequisite codes in the file", () => {
    expect(courses.length).toBeGreaterThan(0);
    const byCode = new Map<string, Course>(courses.map((course) => [course.code, course]));
    expect(byCode.size).toBe(courses.length);
    const practicum = byCode.get("ENGR 495");
    expect(practicum?.units).toBe(0);

    for (const course of courses) {
      if (!course.prerequisites) continue;
      walkPrerequisites(course.prerequisites, (node) => {
        if (node.type === "course") expect(byCode.has(node.code), node.code).toBe(true);
      });
    }
  });
});
