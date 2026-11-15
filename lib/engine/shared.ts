import type {
  Assumption,
  Course,
  Program,
  RequirementNode,
  RequirementStatus,
  StudentCourse,
  StudentRecord,
} from "@/lib/types";
import type { Cover, HeldCourse } from "./assign";

export function countsOnRecord(course: StudentCourse): boolean {
  if (course.status === "in_progress") return true;
  return course.grade !== "F";
}

export function heldFrom(student: StudentRecord, extra: readonly HeldCourse[] = []): HeldCourse[] {
  const rows: HeldCourse[] = student.courses.filter(countsOnRecord).map((course) => ({
    code: course.code,
    units: course.units,
    grade: course.grade,
    inProgress: course.status === "in_progress",
  }));
  for (const course of extra) {
    if (!rows.some((row) => row.code === course.code)) rows.push(course);
  }
  return rows;
}

export function catalogue(courses: readonly Course[]): Map<string, Course> {
  return new Map(courses.map((course) => [course.code, course]));
}

export function unitsOf(byCode: Map<string, Course>, code: string, held: readonly HeldCourse[]): number {
  return byCode.get(code)?.units ?? held.find((course) => course.code === code)?.units ?? 0;
}

export function flatten(node: RequirementNode): RequirementNode[] {
  if (node.type === "all_of") return [node, ...node.children.flatMap(flatten)];
  if (node.type === "n_of") return [node, ...node.options.flatMap(flatten)];
  return [node];
}

export function statusesFor(root: RequirementNode, cover: Cover): RequirementStatus[] {
  const byId = new Map<string, RequirementStatus>();
  for (const status of cover.statuses) {
    if (!byId.has(status.nodeId)) byId.set(status.nodeId, status);
  }
  return flatten(root).map((node) => {
    const found = byId.get(node.id);
    if (found) return found;
    return {
      nodeId: node.id,
      satisfied: false,
      appliedCourses: [],
      remainingUnits: 0,
      note: "Not used in the cheapest assignment.",
      source: node.source,
    };
  });
}

export function progressAssumptions(student: StudentRecord, applied: readonly string[]): Assumption[] {
  return student.courses
    .filter((course) => course.status === "in_progress" && applied.includes(course.code))
    .map((course) => ({
      ruleId: "in-progress",
      text: `${course.code} is in progress. It counts where the requirement has no minimum grade, and it is not scheduled again.`,
    }));
}

export function blockedProgress(student: StudentRecord, remaining: readonly string[]): Assumption[] {
  return student.courses
    .filter((course) => course.status === "in_progress" && remaining.includes(course.code))
    .map((course) => ({
      ruleId: "in-progress",
      text: `${course.code} is in progress and does not yet meet a minimum grade, so it is not counted and not scheduled again.`,
    }));
}

export function unlistedAssumptions(node: RequirementNode): Assumption[] {
  const found: Assumption[] = [];
  const walk = (current: RequirementNode) => {
    if (/lists no courses/i.test(current.source.text)) {
      const floor = current.type === "course_set" || current.type === "n_of" ? (current.minUnits ?? 0) : 0;
      found.push({
        ruleId: current.id,
        text: `This block lists no courses, so ${floor} units stay on the requirement and are not filled by picking catalogue courses.`,
      });
    }
    if (current.type === "all_of") current.children.forEach(walk);
    if (current.type === "n_of") current.options.forEach(walk);
  };
  walk(node);
  return found;
}

export function missingAssumptions(codes: readonly string[], byCode: Map<string, Course>): Assumption[] {
  return codes
    .filter((code) => !byCode.has(code))
    .map((code) => ({
      ruleId: "missing-course",
      text: `${code} is not in the course catalogue. It stays on the remaining list and counts as 0 units.`,
    }));
}

export function isPartial(program: Program): boolean {
  const extra = program as Program & { partial?: boolean };
  return extra.partial === true;
}
