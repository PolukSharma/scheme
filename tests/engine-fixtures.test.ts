import { describe, expect, it } from "vitest";
import { courses, policyRules, programs, students, transferRules } from "@/fixtures";
import { audit, planTerms, rankAddOns } from "@/lib/engine";
import type { StudentRecord } from "@/lib/types";

const major = programs.find((program) => program.id === "demo-applied-widgets");
const policy = programs.find((program) => program.id === "demo-widget-policy");
const systems = programs.find((program) => program.id === "demo-widget-systems");

function student(id: string): StudentRecord {
  const found = students.find((item) => item.id === id);
  if (!found || !major || !policy || !systems) throw new Error("missing fixture");
  return found;
}

describe("hand-computed fixture audits", () => {
  it("audits Nova: 201 in progress counts, and 360 plus 401 is cheaper than 360 plus 370", () => {
    // DEMO 101 is done (4). DEMO 201 is in progress with no minimum grade, so it counts (4) and is not scheduled.
    // Still needed: DEMO 301 (4, fall/spring, prereq 201), then the choose-two.
    // DEMO 360 (fall, prereq 301) and DEMO 401 (fall, prereq 301) finish together.
    // DEMO 370 is spring-only after 360, so 360+370 costs another term for the same 8 units.
    // Latest dated course is 2026-spring, so the plan opens fall 2026: 301, then fall 2027: 360 and 401.
    if (!major) throw new Error("missing major");
    const nova = student("demo-nova");
    const audited = audit(nova, major, courses, policyRules);
    expect(audited.unitsApplied).toBe(8);
    expect(audited.assumptions.some((item) => item.ruleId === "demo-minor-unique-units")).toBe(true);
    expect(audited.assumptions.some((item) => item.ruleId === "in-progress")).toBe(true);
    expect(audited.unitsRemaining).toBe(12);
    expect(audited.coursesRemaining).toEqual(["DEMO 301", "DEMO 360", "DEMO 401"]);
    expect(audited.satisfied).toBe(false);
    const plan = planTerms(nova, [major], courses, policyRules);
    expect(plan.terms.map((term) => term.label)).toEqual(["Fall 2026", "Fall 2027"]);
    expect(plan.terms[0]?.courses.map((course) => course.code)).toEqual(["DEMO 301"]);
    expect(plan.terms[1]?.courses.map((course) => course.code).sort()).toEqual(["DEMO 360", "DEMO 401"]);
    expect(plan.totalUnits).toBe(12);
  });

  it("audits Quill as finished, with an empty plan", () => {
    // DEMO 101, 201, 301, and 360 are done. DEMO 370 is in progress and counts toward the choose-two.
    // 360 + 370 is 8 units and two options, so nothing remains.
    if (!major) throw new Error("missing major");
    const quill = student("demo-quill");
    const audited = audit(quill, major, courses, policyRules);
    expect(audited.satisfied).toBe(true);
    expect(audited.unitsRemaining).toBe(0);
    expect(audited.coursesRemaining).toEqual([]);
    expect(planTerms(quill, [major], courses, policyRules).terms).toEqual([]);
  });

  it("audits Pebble: DEMO 320 does not fill the choose-two, so 360 and 401 remain", () => {
    // DEMO 101 and 201 are done. DEMO 301 is in progress and counts. DEMO 320 is not 360, 370, or level 400.
    // Remaining is DEMO 360 and DEMO 401, 8 units, both fall. Latest term is 2026-fall, so they share fall 2027.
    if (!major) throw new Error("missing major");
    const pebble = student("demo-pebble");
    const audited = audit(pebble, major, courses, policyRules);
    expect(audited.unitsApplied).toBe(12);
    expect(audited.unitsRemaining).toBe(8);
    expect(audited.coursesRemaining).toEqual(["DEMO 360", "DEMO 401"]);
    const plan = planTerms(pebble, [major], courses, policyRules);
    expect(plan.terms.map((term) => term.label)).toEqual(["Fall 2027"]);
    expect(plan.terms[0]?.units).toBe(8);
  });

  it("an empty record needs the whole Applied Widgets core: 20 units and four terms", () => {
    // 101 → 201 → 301, then 360 and 401 in the following fall. The 16-unit cap would allow two terms; the chain needs four.
    if (!major) throw new Error("missing major");
    const empty: StudentRecord = { ...student("demo-nova"), id: "demo-empty", courses: [] };
    const audited = audit(empty, major, courses, policyRules);
    expect(audited.unitsApplied).toBe(0);
    expect(audited.unitsRemaining).toBe(20);
    expect(audited.coursesRemaining).toEqual(["DEMO 101", "DEMO 201", "DEMO 301", "DEMO 360", "DEMO 401"]);
    expect(planTerms(empty, [major], courses, policyRules).terms).toHaveLength(4);
  });

  it("ranks the policy minor ahead of systems for Nova, without calling the minor verified", () => {
    // Policy, beyond the major: DEMO 210 (4, fall), 220 (3, spring, prereq 210), 230 (3, fall, prereq 210).
    // DEMO 240 needs DEMO 160, so it loses. The 300-level set is filled by major DEMO 301.
    // Unique-units is unconfirmed in the fixture, so 16 is not applied. Extra units 10. Combined plan is 3 terms vs 2.
    // Systems shares DEMO 401 and still needs 110, 340, and 350: 12 extra units and one extra term.
    if (!major || !policy || !systems) throw new Error("missing program");
    const nova = student("demo-nova");
    const addOns = rankAddOns(nova, [major], [policy, systems], courses, policyRules, transferRules);
    expect(addOns.map((item) => item.programId)).toEqual(["demo-widget-policy", "demo-widget-systems"]);
    expect(addOns[0]).toMatchObject({
      extraTerms: 1,
      extraUnits: 10,
      crossSchool: true,
      verified: false,
    });
    expect(addOns[0]?.transfer?.rule.school).toBe("College of Examples");
    expect(addOns[0]?.transfer?.prerequisitesHave).toEqual(["DEMO 101"]);
    expect(addOns[0]?.transfer?.prerequisitesLack).toEqual(["DEMO 210"]);
    expect(addOns[0]?.remainingCourses).toEqual(["DEMO 210", "DEMO 220", "DEMO 230"]);
    expect(addOns[1]).toMatchObject({
      extraTerms: 1,
      extraUnits: 12,
      crossSchool: false,
      transfer: null,
      verified: false,
    });
    expect(addOns[1]?.remainingCourses).toEqual(["DEMO 110", "DEMO 340", "DEMO 350"]);
    expect(policy.verified).toBe(false);
    expect(addOns.every((item) => item.verified === false)).toBe(true);
  });
});
