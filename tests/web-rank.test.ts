import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { advisorQuestions, chatRequestBody, estimatedCostLabel, filterByKind, narrowResults, rankStudent, verificationLabel } from "@/components/rank-student";
import type { Course, PolicyRule, Program, StudentRecord, TransferRule } from "@/lib/types";

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const root = join(process.cwd(), "data");
const courses = loadJson<Course[]>(join(root, "courses.json"));
const rules = loadJson<PolicyRule[]>(join(root, "policy-rules.json"));
const transfers = loadJson<TransferRule[]>(join(root, "transfer-rules.json"));
const programs = readdirSync(join(root, "programs"))
  .filter((name) => name.endsWith(".json") && name !== "index.json")
  .map((name) => loadJson<Program>(join(root, "programs", name)));
const students = loadJson<StudentRecord[]>(join(root, "samples", "students.json"));

describe("web rankings", () => {
  it("labels each engine result verified or unverified and keeps a cross-school flag", () => {
    for (const student of students) {
      const ranking = rankStudent(student, programs, courses, rules, transfers);
      expect(ranking.addOns.length).toBeGreaterThan(0);
      expect(ranking.switches.length).toBeGreaterThan(0);
      const rows = [...ranking.addOns, ...ranking.switches];
      expect(rows.some((item) => !item.verified)).toBe(true);
      expect(rows.some((item) => item.crossSchool)).toBe(true);
      for (const item of rows) {
        expect(verificationLabel(item.verified)).toBe(item.verified ? "Verified" : "Unverified");
      }
      expect(filterByKind(ranking.addOns, programs, "specialization")).toEqual([]);
      expect(filterByKind(ranking.switches, programs, "minor")).toEqual([]);
    }
  });

  it("sends course codes and the question, not a name or a grade", () => {
    const student = students[0];
    if (!student) throw new Error("missing sample");
    const body = chatRequestBody(student, "Which requirements are still open?");
    const encoded = JSON.stringify(body);
    expect(encoded).not.toContain(student.id);
    expect(encoded).not.toContain(student.label);
    expect(body.courses.every((course) => !("grade" in course))).toBe(true);
    expect(body.programIds).toEqual(student.declaredProgramIds);
    expect(body.startTerm).toBe(student.startTerm);
  });

  it("leaves estimated cost unset until a confirmed rule quotes tuition", () => {
    expect(estimatedCostLabel(rules, 12)).toBe("Not estimated");
    const source = rules[0]?.source;
    if (!source) throw new Error("missing policy source");
    expect(
      estimatedCostLabel(
        [
          {
            id: "tuition-per-unit",
            name: "Tuition per unit",
            summary: "Synthetic per-unit tuition quoted for this test.",
            value: 100,
            source,
            confirmed: true,
          },
        ],
        3,
      ),
    ).toBe("$300");
    expect(
      estimatedCostLabel(
        [
          {
            id: "tuition-band",
            name: "Tuition band",
            summary: "The figure is not confirmed.",
            value: null,
            source,
            confirmed: false,
          },
        ],
        3,
      ),
    ).toBe("Not estimated");
  });

  it("filters a ranking by type, school, and verification", () => {
    const student = students[0];
    if (!student) throw new Error("missing sample");
    const ranking = rankStudent(student, programs, courses, rules, transfers);
    const minors = narrowResults(ranking.addOns, programs, { kind: "minor", school: "all", verification: "unverified" });
    expect(minors.length).toBeGreaterThan(0);
    expect(minors.every((row) => !row.verified)).toBe(true);
    expect(minors.every((row) => programs.find((program) => program.id === row.programId)?.kind === "minor")).toBe(true);
    expect(narrowResults(ranking.addOns, programs, { kind: "all", school: "No Such School", verification: "all" })).toEqual([]);
    expect(filterByKind(ranking.addOns, programs, "all")).toEqual(ranking.addOns);
  });

  it("asks the advisor about unverified items and does not treat a cross-school page as admission", () => {
    const questions = advisorQuestions({ unverified: true, crossSchool: true, assumptionCount: 1 });
    expect(questions.some((question) => question.includes("STARS"))).toBe(true);
    expect(questions.some((question) => question.includes("does not estimate admission"))).toBe(true);
    expect(advisorQuestions({ unverified: false, crossSchool: false, assumptionCount: 0 })).toHaveLength(1);
  });
});
