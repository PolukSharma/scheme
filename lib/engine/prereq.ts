import type { Course, PrerequisiteExpr } from "@/lib/types";

export function prereqGap(
  expr: PrerequisiteExpr | null,
  done: ReadonlySet<string>,
  unitsOf: (code: string) => number,
): string[] {
  if (!expr) return [];
  if (expr.type === "course") return done.has(expr.code) ? [] : [expr.code];
  if (expr.type === "all_of") return expr.children.flatMap((child) => prereqGap(child, done, unitsOf));
  if (expr.children.length > 8) {
    const ranked = expr.children
      .map((child) => prereqGap(child, done, unitsOf))
      .sort(
        (left, right) =>
          left.reduce((sum, code) => sum + unitsOf(code), 0) -
          right.reduce((sum, code) => sum + unitsOf(code), 0),
      );
    return [...new Set(ranked.slice(0, expr.minCount).flat())];
  }
  let best: string[] | null = null;
  const choose = (start: number, taken: string[][], count: number) => {
    if (count >= expr.minCount) {
      const flat = [...new Set(taken.flat())];
      const cost = flat.reduce((sum, code) => sum + unitsOf(code), 0);
      const bestCost = best ? best.reduce((sum, code) => sum + unitsOf(code), 0) : Infinity;
      if (!best || cost < bestCost || (cost === bestCost && flat.length < best.length)) best = flat;
      return;
    }
    for (let index = start; index < expr.children.length; index += 1) {
      choose(index + 1, [...taken, prereqGap(expr.children[index], done, unitsOf)], count + 1);
    }
  };
  choose(0, [], 0);
  return best ?? [];
}

function corequisiteClause(text: string): string | null {
  const match = /Corequisite:\s*([^.]*)/i.exec(text);
  return match?.[1]?.trim() ?? null;
}

function clauseMentions(clause: string, code: string): boolean {
  if (clause.includes(code)) return true;
  const stem = code.replace(/[a-z]+$/i, "");
  if (stem === code || stem.length < 6) return false;
  return new RegExp(`(?:^|[\\s(])${stem}(?:[a-z]+)?(?:$|[\\s)])`).test(clause);
}

/**
 * Corequisites listed with "or" in the course sentence are alternatives.
 * One course that is already done, or the cheapest one still open, is enough.
 * A list joined by "and", or a sentence that does not name every code, stays a list.
 */
export function corequisiteGap(
  course: Course,
  have: ReadonlySet<string>,
  unitsOf: (code: string) => number,
): string[] {
  if (course.corequisites.length === 0) return [];
  const clause = corequisiteClause(course.source.text);
  const alternatives =
    clause !== null &&
    /\bor\b/i.test(clause) &&
    !/\band\b/i.test(clause) &&
    course.corequisites.every((code) => clauseMentions(clause, code));
  if (alternatives) {
    if (course.corequisites.some((code) => have.has(code))) return [];
    const [pick] = [...course.corequisites].sort(
      (left, right) => unitsOf(left) - unitsOf(right) || left.localeCompare(right),
    );
    return pick ? [pick] : [];
  }
  return course.corequisites.filter((code) => !have.has(code));
}
