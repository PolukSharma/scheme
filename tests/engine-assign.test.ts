import { describe, expect, it } from "vitest";
import { costUnits, coverProgram, makeContext } from "@/lib/engine/assign";
import { audit, planTerms } from "@/lib/engine";
import { prereqGap } from "@/lib/engine/plan";
import { courses, policyRules, programs, students } from "@/fixtures";
import type { Course, RequirementNode, Source, StudentRecord, TermPlan } from "@/lib/types";

const source: Source = {
  url: "https://example.edu/demo-catalogue/2026/solver-test",
  catalogueYear: "2026-2027",
  text: "Invented solver test, not a USC requirement.",
};

function leaf(code: string): RequirementNode {
  return { type: "course", id: code.toLowerCase().replace(" ", "-"), code, source, verified: false };
}

function courseRow(code: string, units: number, dept = "ZZ", level = 100): Course {
  return {
    code,
    title: `Test ${code}`,
    units,
    dept,
    level,
    prerequisites: null,
    corequisites: [],
    offerings: ["fall", "spring"],
    source,
  };
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

interface Brute {
  units: number;
  credit: number;
  ok: boolean;
}

function brute(node: RequirementNode, held: ReadonlySet<string>, unitsOf: (code: string) => number): Brute {
  if (node.type === "course") {
    const units = unitsOf(node.code);
    return held.has(node.code) ? { units: 0, credit: units, ok: true } : { units, credit: units, ok: true };
  }
  if (node.type === "all_of") {
    const parts = node.children.map((child) => brute(child, held, unitsOf));
    return {
      units: parts.reduce((sum, part) => sum + part.units, 0),
      credit: parts.reduce((sum, part) => sum + part.credit, 0),
      ok: parts.every((part) => part.ok),
    };
  }
  if (node.type === "course_set") return { units: 0, credit: 0, ok: false };
  let best: Brute | null = null;
  const options = node.options;
  const walk = (index: number, chosen: Brute[]) => {
    const credit = chosen.reduce((sum, part) => sum + part.credit, 0);
    const metCount = node.minCount === undefined || chosen.length >= node.minCount;
    const metUnits = node.minUnits === undefined || credit >= node.minUnits;
    if (chosen.length > 0 && metCount && metUnits && chosen.every((part) => part.ok)) {
      const units = chosen.reduce((sum, part) => sum + part.units, 0);
      if (!best || units < best.units) best = { units, credit, ok: true };
      return;
    }
    if (index >= options.length) return;
    walk(index + 1, chosen);
    walk(index + 1, [...chosen, brute(options[index], held, unitsOf)]);
  };
  walk(0, []);
  return best ?? { units: 1_000_000, credit: 0, ok: false };
}

function heldRows(codes: readonly string[], catalogue: readonly Course[]) {
  return codes.map((code) => ({
    code,
    units: catalogue.find((course) => course.code === code)?.units ?? 0,
    grade: "A",
    inProgress: false,
  }));
}

describe("assignment solver", () => {
  it("matches brute force on 200 small instances", () => {
    const random = mulberry32(20261114);
    for (let instance = 0; instance < 200; instance += 1) {
      const width = 3 + Math.floor(random() * 3);
      const catalogue = Array.from({ length: width }, (_, index) =>
        courseRow(`ZZ ${101 + index}`, 1 + Math.floor(random() * 4)),
      );
      const unitsOf = (code: string) => catalogue.find((course) => course.code === code)?.units ?? 0;
      const children = catalogue.map((course) => leaf(course.code));
      const tree: RequirementNode =
        instance % 2 === 0
          ? {
              type: "all_of",
              id: "root",
              source,
              verified: false,
              children: [
                children[0],
                {
                  type: "n_of",
                  id: "pick",
                  minCount: Math.min(2, children.length - 1),
                  options: children.slice(1),
                  source,
                  verified: false,
                },
              ],
            }
          : {
              type: "n_of",
              id: "pick",
              minCount: 2,
              options: children,
              source,
              verified: false,
            };
      const held = catalogue.filter(() => random() < 0.5).map((course) => course.code);
      const solved = coverProgram(tree, catalogue, heldRows(held, catalogue));
      const answer = brute(tree, new Set(held), unitsOf);
      expect(costUnits(makeContext(catalogue, heldRows(held, catalogue)), solved), `instance ${instance}`).toBe(
        answer.units,
      );
    }
  });

  it("meets a unit floor with one larger course instead of a one-unit course", () => {
    const catalogue = [courseRow("ZZ 101", 1), courseRow("ZZ 102", 4), courseRow("ZZ 103", 4)];
    const tree: RequirementNode = {
      type: "n_of",
      id: "pick",
      minCount: 1,
      minUnits: 4,
      options: catalogue.map((course) => leaf(course.code)),
      source,
      verified: false,
    };
    const solved = coverProgram(tree, catalogue, []);
    const answer = brute(tree, new Set(), (code) => catalogue.find((course) => course.code === code)?.units ?? 0);
    expect(answer.units).toBe(4);
    expect(costUnits(makeContext(catalogue, []), solved)).toBe(4);
  });

  it("gives a shared course to the requirement that has no substitute", () => {
    const catalogue = [courseRow("ZZ 101", 3), courseRow("ZZ 150", 2), courseRow("ZZ 180", 4)];
    const tree: RequirementNode = {
      type: "all_of",
      id: "root",
      source,
      verified: false,
      children: [
        leaf("ZZ 101"),
        {
          type: "course_set",
          id: "set",
          match: { dept: "ZZ", levelMin: 100, levelMax: 199 },
          minCount: 1,
          minUnits: 1,
          source,
          verified: false,
        },
      ],
    };
    const solved = coverProgram(tree, catalogue, heldRows(["ZZ 101"], catalogue));
    expect(costUnits(makeContext(catalogue, heldRows(["ZZ 101"], catalogue)), solved)).toBe(2);
    expect(solved.remaining).toEqual(["ZZ 150"]);
    expect(solved.applied).toEqual(["ZZ 101"]);
  });

  it("never increases remaining units when one more course is completed", () => {
    const major = programs.find((program) => program.id === "demo-applied-widgets");
    if (!major) throw new Error("missing major");
    const base = students[0];
    let previous = audit(base, major, courses, policyRules).unitsRemaining;
    const extras = ["DEMO 301", "DEMO 360", "DEMO 401", "DEMO 110", "DEMO 999"];
    let record: StudentRecord = base;
    for (const code of extras) {
      const known = courses.find((course) => course.code === code);
      record = {
        ...record,
        courses: [
          ...record.courses,
          {
            code,
            units: known?.units ?? 4,
            grade: "A",
            term: "2026-fall",
            status: "completed",
          },
        ],
      };
      const next = audit(record, major, courses, policyRules).unitsRemaining;
      expect(next).toBeLessThanOrEqual(previous);
      previous = next;
    }
  });

  it("needs the whole program when the record is empty", () => {
    const major = programs.find((program) => program.id === "demo-applied-widgets");
    const nova = students.find((student) => student.id === "demo-nova");
    if (!major || !nova) throw new Error("missing fixture");
    const empty: StudentRecord = { ...nova, id: "demo-empty-record", courses: [] };
    const full = audit(empty, major, courses, policyRules);
    expect(full.unitsApplied).toBe(0);
    expect(full.unitsRemaining).toBeGreaterThan(0);
    const finished: StudentRecord = {
      ...empty,
      courses: full.coursesRemaining.map((code) => ({
        code,
        units: courses.find((course) => course.code === code)?.units ?? 1,
        grade: "A",
        term: "2026-fall",
        status: "completed" as const,
      })),
    };
    const after = audit(finished, major, courses, policyRules);
    expect(after.unitsRemaining).toBe(0);
    expect(after.satisfied).toBe(true);
    for (const student of students) {
      expect(audit(student, major, courses, policyRules).unitsRemaining).toBeLessThanOrEqual(full.unitsRemaining);
    }
  });
});

function planErrors(plan: TermPlan, already: ReadonlySet<string>, cap: number): string[] {
  const byCode = new Map(courses.map((course) => [course.code, course]));
  const errors: string[] = [];
  const seen = new Set<string>();
  const done = new Set(already);
  for (const term of plan.terms) {
    const sum = term.courses.reduce((total, course) => total + course.units, 0);
    if (sum !== term.units) errors.push(`${term.label} unit total`);
    if (term.units > cap) errors.push(`${term.label} over cap`);
    for (const planned of term.courses) {
      if (seen.has(planned.code) || already.has(planned.code)) errors.push(`scheduled twice ${planned.code}`);
      seen.add(planned.code);
      const course = byCode.get(planned.code);
      if (!course) {
        errors.push(`missing ${planned.code}`);
        continue;
      }
      if (planned.units !== course.units) errors.push(`units ${planned.code}`);
      if (!course.offerings.includes(term.season)) errors.push(`offering ${planned.code}`);
      const gap = prereqGap(course.prerequisites, done, (code) => byCode.get(code)?.units ?? 0);
      if (gap.length > 0) errors.push(`prereq ${planned.code}`);
    }
    for (const planned of term.courses) done.add(planned.code);
  }
  return errors;
}

describe("term plans", () => {
  it("respects prerequisites, offerings, and the confirmed 16-unit cap", () => {
    const major = programs.find((program) => program.id === "demo-applied-widgets");
    if (!major) throw new Error("missing major");
    for (const student of students) {
      const plan = planTerms(student, [major], courses, policyRules);
      const already = new Set(student.courses.map((course) => course.code));
      expect(planErrors(plan, already, 16), student.id).toEqual([]);
      for (const course of student.courses) {
        if (course.status !== "in_progress") continue;
        expect(plan.terms.some((term) => term.courses.some((item) => item.code === course.code))).toBe(false);
      }
    }
  });
});
