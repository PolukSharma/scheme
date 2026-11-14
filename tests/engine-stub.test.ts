import { describe, expect, it } from "vitest";
import { courses, policyRules, programs, students, transferRules } from "@/fixtures";
import { audit, planTerms, rankAddOns, rankSwitches } from "@/lib/engine";
import { buildSampleViews } from "@/lib/sample-views";
import { auditResultSchema, opportunitySchema, termPlanSchema } from "@/lib/types";

describe("engine stub", () => {
  it("returns fixture rankings for every sample student", () => {
    const major = programs.find((program) => program.id === "demo-applied-widgets");
    const others = programs.filter((program) => program.id !== major?.id);
    const targets = others.filter((program) => program.kind === "major");
    if (!major) throw new Error("missing major");
    for (const student of students) {
      const audited = audit(student, major, courses, policyRules);
      expect(auditResultSchema.parse(audited).studentId).toBe(student.id);
      const addOns = rankAddOns(student, [major], others, courses, policyRules, transferRules);
      const switches = rankSwitches(student, major, targets, courses, policyRules, transferRules);
      const plan = planTerms(student, [major], courses, policyRules, { unitCap: 16 });
      expect(addOns.length).toBeGreaterThan(0);
      expect(switches.length).toBeGreaterThan(0);
      expect(addOns.map((item) => item.extraTerms)).toEqual(
        [...addOns].sort((a, b) => a.extraTerms - b.extraTerms || a.extraUnits - b.extraUnits).map((item) => item.extraTerms),
      );
      for (const item of addOns) opportunitySchema.parse(item);
      for (const item of switches) expect(opportunitySchema.parse(item).mode).toBe("switch");
      expect(termPlanSchema.parse(plan).programIds).toContain(major.id);
    }
  });

  it("marks the other school on the policy minor and not on the systems major", () => {
    const nova = students.find((student) => student.id === "demo-nova");
    const major = programs.find((program) => program.id === "demo-applied-widgets");
    if (!nova || !major) throw new Error("missing fixture");
    const addOns = rankAddOns(nova, [major], programs.filter((program) => program.id !== major.id), courses, policyRules, transferRules);
    const policy = addOns.find((item) => item.programId === "demo-widget-policy");
    const systems = addOns.find((item) => item.programId === "demo-widget-systems");
    expect(policy?.crossSchool).toBe(true);
    expect(policy?.transfer?.rule.school).toBe("College of Examples");
    expect(systems?.crossSchool).toBe(false);
    expect(systems?.transfer).toBeNull();
    expect(addOns[0]?.programId).toBe("demo-widget-policy");
  });

  it("gives an empty result for a student the fixture does not know", () => {
    const major = programs[0];
    const stranger = { ...students[0], id: "demo-stranger" };
    const audited = audit(stranger, major, courses, policyRules);
    expect(audited.requirements).toEqual([]);
    expect(rankAddOns(stranger, [major], programs, courses, policyRules, transferRules)).toEqual([]);
    expect(planTerms(stranger, [major], courses, policyRules).terms).toEqual([]);
  });

  it("builds the home-page view for all three samples", () => {
    const views = buildSampleViews();
    expect(views.map((view) => view.student.label)).toEqual(["Nova", "Quill", "Pebble"]);
    const quill = views.find((view) => view.student.id === "demo-quill");
    expect(quill?.audit.satisfied).toBe(true);
    expect(quill?.plan.terms).toEqual([]);
    expect(quill?.addOns[0]?.extraTerms).toBe(1);
  });
});
