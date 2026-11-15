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

/**
 * A finished course meets a minimum when its grade is at least that letter.
 * With no minimum, F does not count and any other recorded grade does.
 * In-progress work has no grade, so it counts only when the requirement sets no minimum.
 */
export function gradeMeets(
  grade: string | null,
  minimum: string | undefined,
  inProgress: boolean,
): boolean {
  if (inProgress) return !minimum;
  if (!minimum) {
    if (!grade) return true;
    if (grade === "F") return false;
    const earned = POINTS[grade];
    return earned === undefined ? true : earned > 0;
  }
  if (!grade) return false;
  const earned = POINTS[grade];
  const needed = POINTS[minimum];
  if (earned === undefined || needed === undefined) return false;
  return earned >= needed;
}
