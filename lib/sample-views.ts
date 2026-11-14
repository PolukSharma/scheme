import { courses, policyRules, programs, students, transferRules } from "@/fixtures";
import { audit, planTerms, rankAddOns, rankSwitches } from "@/lib/engine";
import type { AuditResult, Opportunity, Program, StudentRecord, TermPlan } from "@/lib/types";

export interface NamedOpportunity extends Opportunity {
  programName: string;
  programKind: Program["kind"];
  school: string;
}

export interface SampleView {
  student: StudentRecord;
  majorName: string;
  audit: AuditResult;
  addOns: NamedOpportunity[];
  switches: NamedOpportunity[];
  plan: TermPlan;
}

function nameOf(programId: string): Pick<NamedOpportunity, "programName" | "programKind" | "school"> {
  const program = programs.find((item) => item.id === programId);
  return {
    programName: program?.name ?? programId,
    programKind: program?.kind ?? "major",
    school: program?.school ?? "",
  };
}

export function buildSampleViews(): SampleView[] {
  return students.map((student) => {
    const major = programs.find((program) => program.id === student.majorId);
    if (!major) {
      throw new Error(`Sample ${student.id} declares an unknown major ${student.majorId}`);
    }
    const others = programs.filter((program) => program.id !== major.id);
    const majorTargets = others.filter((program) => program.kind === "major");
    const decorate = (items: Opportunity[]): NamedOpportunity[] =>
      items.map((item) => ({ ...item, ...nameOf(item.programId) }));
    return {
      student,
      majorName: major.name,
      audit: audit(student, major, courses, policyRules),
      addOns: decorate(
        rankAddOns(student, [major], others, courses, policyRules, transferRules),
      ),
      switches: decorate(
        rankSwitches(student, major, majorTargets, courses, policyRules, transferRules),
      ),
      plan: planTerms(student, [major], courses, policyRules),
    };
  });
}
