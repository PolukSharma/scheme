/**
 * Requirement atoms for the hand audit. Built from catalogue sentences,
 * not from data/programs.
 */

export interface CourseAtom {
  type: "course";
  code: string;
  /** Units this one course can contribute when the page prints a range. */
  credit?: number;
}

export interface AllAtom {
  type: "all";
  of: Atom[];
}

export interface OneAtom {
  type: "one";
  options: Atom[];
}

export interface CountAtom {
  type: "n";
  n: number;
  minUnits?: number;
  options: Atom[];
}

export interface SetAtom {
  type: "set";
  depts: string[];
  levelMin: number;
  levelMax: number;
  minCount?: number;
  minUnits?: number;
  /** Named courses every student must take cannot fill this set. */
  excludeForced?: boolean;
  label: string;
}

export interface UnitsAtom {
  type: "units";
  minUnits: number;
  options: CourseAtom[];
  label: string;
}

/** A block the page states as a unit count and does not list courses for. */
export interface UnlistedAtom {
  type: "unlisted";
  units: number;
  label: string;
}

/** Printed courses that are not required of every student. */
export interface OptionalAtom {
  type: "optional";
  label: string;
  codes: string[];
}

export interface OutsideAtom {
  type: "outside";
  n: number;
  minOutside: number;
  minUpper: number;
  upper: string[];
  lower: string[];
  label: string;
}

export type Atom =
  | CourseAtom
  | AllAtom
  | OneAtom
  | CountAtom
  | SetAtom
  | UnitsAtom
  | UnlistedAtom
  | OptionalAtom
  | OutsideAtom;

export function course(code: string, credit?: number): CourseAtom {
  return { type: "course", code, credit };
}

export function all(...of: Atom[]): AllAtom {
  return { type: "all", of };
}

export function one(...options: Atom[]): OneAtom {
  return { type: "one", options };
}

export function count(n: number, options: Atom[], minUnits?: number): CountAtom {
  return { type: "n", n, minUnits, options };
}

export function coursesOf(atom: Atom): string[] {
  switch (atom.type) {
    case "course":
      return [atom.code];
    case "all":
      return atom.of.flatMap(coursesOf);
    case "one":
      return atom.options.flatMap(coursesOf);
    case "n":
      return atom.options.flatMap(coursesOf);
    case "units":
      return atom.options.map((option) => option.code);
    case "optional":
      return atom.codes;
    case "outside":
      return [...atom.upper, ...atom.lower];
    default:
      return [];
  }
}

/** Courses every completion of this atom includes. */
export function forcedCodes(atom: Atom): string[] {
  switch (atom.type) {
    case "course":
      return [atom.code];
    case "all":
      return [...new Set(atom.of.flatMap(forcedCodes))];
    case "one": {
      const lists = atom.options.map((option) => new Set(forcedCodes(option)));
      if (lists.length === 0) return [];
      return [...lists[0]].filter((code) => lists.every((list) => list.has(code)));
    }
    case "n":
      return atom.n >= atom.options.length ? [...new Set(atom.options.flatMap(forcedCodes))] : [];
    default:
      return [];
  }
}
