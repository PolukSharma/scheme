import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { audit, planTerms, rankAddOns, rankSwitches } from "@/lib/engine";
import type { Course, PolicyRule, Program, StudentRecord, TransferRule } from "@/lib/types";

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("catalogue sweep", () => {
  it("ranks every stored program for one synthetic student within four seconds", () => {
    const root = join(process.cwd(), "data");
    const catalogue = loadJson<Course[]>(join(root, "courses.json"));
    const rules = loadJson<PolicyRule[]>(join(root, "policy-rules.json"));
    const transfers = loadJson<TransferRule[]>(join(root, "transfer-rules.json"));
    const programs = readdirSync(join(root, "programs"))
      .filter((name) => name.endsWith(".json") && name !== "index.json")
      .map((name) => loadJson<Program>(join(root, "programs", name)));
    const current = programs.find((program) => program.id === "computer-science-bs");
    if (!current) throw new Error("missing computer science major");
    const student: StudentRecord = {
      id: "sample-sweep",
      label: "Sample",
      school: "USC Viterbi School of Engineering",
      startYear: 2025,
      startTerm: "2025-fall",
      catalogueYear: "2026-2027",
      majorId: current.id,
      declaredProgramIds: [current.id],
      courses: [
        {
          code: "CSCI 102L",
          units: 2,
          grade: "A",
          term: "2025-fall",
          status: "completed",
        },
      ],
    };
    const started = performance.now();
    const audited = audit(student, current, catalogue, rules);
    const addOns = rankAddOns(
      student,
      [current],
      programs.filter((program) => program.id !== current.id),
      catalogue,
      rules,
      transfers,
    );
    const switches = rankSwitches(
      student,
      current,
      programs.filter((program) => program.kind === "major" && program.id !== current.id),
      catalogue,
      rules,
      transfers,
    );
    const plan = planTerms(student, [current], catalogue, rules);
    const elapsed = performance.now() - started;
    expect(programs.length).toBeGreaterThan(10);
    expect(addOns.length).toBe(programs.length - 1);
    expect(switches.length).toBeGreaterThan(0);
    expect(addOns.map((item) => item.extraTerms)).toEqual(
      [...addOns].sort((left, right) => left.extraTerms - right.extraTerms || left.extraUnits - right.extraUnits).map((item) => item.extraTerms),
    );
    expect(audited.unitsRemaining).toBeGreaterThan(0);
    expect(plan.programIds).toEqual([current.id]);
    const law = addOns.find((item) => item.programId === "law-and-regulation-of-artificial-intelligence-minor");
    const lawProgram = programs.find((program) => program.id === law?.programId);
    expect(lawProgram?.verified).toBe(true);
    expect(law?.verified).toBe(false);
    expect(addOns.every((item) => item.verified === false)).toBe(true);
    expect(switches.every((item) => item.verified === false)).toBe(true);
    expect(law?.crossSchool).toBe(true);
    expect(law?.transfer).not.toBeNull();
    expect(audited.assumptions.some((item) => item.ruleId === "per-term-unit-cap")).toBe(true);
    expect(audited.assumptions.some((item) => item.ruleId === "courses-shared-by-two-majors")).toBe(true);
    expect(elapsed).toBeLessThan(4000);
  });
});
