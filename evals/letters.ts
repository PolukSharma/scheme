/**
 * Letter-grade order read from the catalogue sentences this checker uses.
 * This file does not import the engine.
 */

const POINTS: Record<string, number> = {
  "A+": 4.3,
  A: 4,
  "A-": 3.7,
  "B+": 3.3,
  B: 3,
  "B-": 2.7,
  "C+": 2.3,
  C: 2,
  "C-": 1.7,
  "D+": 1.3,
  D: 1,
  "D-": 0.7,
  F: 0,
};

/** Grades USC posts when credit has no letter. They meet a printed letter floor. */
const CREDIT_WITHOUT_LETTER = new Set(["TR", "CR", "P", "S"]);

export function letterPoints(grade: string): number | null {
  return POINTS[grade] ?? null;
}

export function meetsFloor(grade: string | null, minimum: "C" | "C-" | null, creditWithoutLetter: boolean): boolean {
  if (!grade) return false;
  if (creditWithoutLetter && CREDIT_WITHOUT_LETTER.has(grade)) return true;
  if (grade === "F") return false;
  const earned = POINTS[grade];
  if (!minimum) return earned === undefined ? true : earned > 0;
  if (earned === undefined) return false;
  return earned >= POINTS[minimum];
}
