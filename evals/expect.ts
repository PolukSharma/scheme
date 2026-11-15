/**
 * Hand-computed expectations from a golden tree.
 * A required course is one the page lists outside a choice.
 * A choice is an "or" on the page, or a block whose unit total is smaller
 * than the courses it lists. Large menus are not scored course by course.
 */

import type { GoldenCourse, GoldenNode, GoldenPick, GoldenProgram } from "./read-page";

export interface PoolExpectation {
  heading: string;
  quote: string;
  codes: string[];
  minCount: number | null;
  minUnits: number | null;
}

export interface PageExpectation {
  mustRemain: string[];
  mustNotRemain: string[];
  oneOf: string[][];
  pools: PoolExpectation[];
  unchecked: { heading: string; quote: string }[];
  working: string[];
}

function unique(codes: string[]): string[] {
  return [...new Set(codes)];
}

function pickCodes(pick: GoldenPick): string[] {
  return [...pick.all.map((course) => course.code), ...pick.oneOf.flat().map((course) => course.code)];
}

function ownCodes(node: GoldenNode): string[] {
  return unique(node.picks.flatMap(pickCodes));
}

function optionSets(pick: GoldenPick): string[][] {
  if (pick.oneOf.length === 0) return pick.all.length ? [pick.all.map((course) => course.code)] : [];
  const head = pick.all.map((course) => course.code);
  return pick.oneOf[0]?.map((course) => [...head, course.code]) ?? [];
}

function satisfied(option: string[], done: ReadonlySet<string>): boolean {
  return option.every((code) => done.has(code));
}

export function expectation(program: GoldenProgram, done: ReadonlySet<string>): PageExpectation {
  const result: PageExpectation = {
    mustRemain: [],
    mustNotRemain: [],
    oneOf: [],
    pools: [],
    unchecked: [],
    working: [`${program.name}. Catalogue page ${program.url}.`],
  };
  for (const node of program.nodes) walk(node, done, result);
  result.mustRemain = unique(result.mustRemain);
  result.mustNotRemain = unique(result.mustNotRemain.filter((code) => !result.mustRemain.includes(code)));
  result.working.push(
    result.mustRemain.length
      ? `Still required: ${result.mustRemain.join(", ")}.`
      : "No individually required course is still open.",
  );
  for (const group of result.oneOf) {
    result.working.push(`One of these is still required: ${group.join(" or ")}.`);
  }
  return result;
}

function walk(node: GoldenNode, done: ReadonlySet<string>, result: PageExpectation): void {
  if (node.rule === "note" || node.rule === "total") return;
  if (node.rule === "tracks" || node.rule === "prose") {
    result.unchecked.push({ heading: node.heading, quote: node.quote });
    result.working.push(`Not scored course by course: ${node.heading}. ${node.quote.slice(0, 180)}`);
    return;
  }
  if (node.rule === "all") {
    for (const pick of node.picks) {
      for (const course of pick.all) {
        if (course.units === 0) continue;
        if (done.has(course.code)) result.mustNotRemain.push(course.code);
        else result.mustRemain.push(course.code);
      }
      for (const group of pick.oneOf) {
        const codes = group.map((course) => course.code);
        const held = codes.filter((code) => done.has(code));
        if (held.length === 0) result.oneOf.push(codes);
        else result.mustNotRemain.push(...codes.filter((code) => !done.has(code)));
      }
    }
    result.working.push(`${node.heading}: take each listed course, and one course from each "or".`);
    for (const child of node.children) walk(child, done, result);
    return;
  }
  const pool = ownCodes(node);
  const codes = pool.length > 0 ? pool : unique(node.children.flatMap((child) => ownCodes(child)));
  if (node.rule === "one" && node.children.length > 0 && node.picks.length === 0) {
    const sectionCodes = unique(node.children.flatMap((child) => ownCodes(child)));
    if (sectionCodes.length > 0 && sectionCodes.length <= 12 && !sectionCodes.some((code) => done.has(code))) result.oneOf.push(sectionCodes);
    result.working.push(`${node.heading}: choose one subsection. ${node.quote.slice(0, 160)}`);
    return;
  }
  if (node.rule === "one") {
    const options = node.picks.flatMap(optionSets);
    const sets = options.length > 0 ? options : codes.map((code) => [code]);
    const held = sets.find((option) => satisfied(option, done));
    if (held) {
      const keep = new Set(held);
      result.mustNotRemain.push(...codes.filter((code) => !keep.has(code)));
      result.working.push(`${node.heading}: ${held.join(" and ")} covers this choice. The other listed courses should not remain.`);
    } else if (codes.length > 0 && codes.length <= 12) {
      result.oneOf.push(codes);
      result.working.push(`${node.heading}: one of ${codes.join(", ")}.`);
    } else {
      result.unchecked.push({ heading: node.heading, quote: node.quote });
    }
    return;
  }
  if (codes.length === 0 || (node.minCount === null && node.minUnits === null)) {
    for (const child of node.children) walk(child, done, result);
    return;
  }
  if (codes.length > 12) {
    result.pools.push({
      heading: node.heading,
      quote: node.quote,
      codes,
      minCount: node.minCount,
      minUnits: node.minUnits,
    });
    result.working.push(
      `${node.heading}: ${node.minCount ?? "enough"} course(s) or ${node.minUnits ?? "the stated"} units from ${codes.length} listed courses. The individual list is not scored.`,
    );
    return;
  }
  const held = codes.filter((code) => done.has(code));
  const minCount = node.minCount ?? 1;
  if (held.length >= minCount) result.mustNotRemain.push(...codes.filter((code) => !done.has(code)));
  else result.oneOf.push(codes.filter((code) => !done.has(code)));
  result.working.push(`${node.heading}: at least ${minCount} of ${codes.join(", ")}.`);
}

export function choicePairs(program: GoldenProgram): { take: string[]; clear: string[] }[] {
  const pairs: { take: string[]; clear: string[] }[] = [];
  function walk(node: GoldenNode): void {
    if (node.rule === "all") {
      for (const pick of node.picks) {
        for (const group of pick.oneOf) {
          const first = group[0];
          if (!first || group.length < 2) continue;
          pairs.push({ take: [first.code], clear: group.slice(1).map((course) => course.code) });
        }
      }
    }
    if (node.rule === "one") {
      const options = node.picks.flatMap(optionSets);
      const first = options[0];
      if (first && options.length >= 2 && options.every((option) => option.length <= 3)) {
        const clear = unique(options.slice(1).flat()).filter((code) => !first.includes(code));
        if (clear.length > 0) pairs.push({ take: first, clear });
      }
    }
    if (node.rule !== "tracks" && node.rule !== "note" && node.rule !== "prose") {
      for (const child of node.children) walk(child);
    }
  }
  for (const node of program.nodes) walk(node);
  return pairs;
}

export function requiredCourses(program: GoldenProgram): GoldenCourse[] {
  const courses: GoldenCourse[] = [];
  const empty = new Set<string>();
  const exp = expectation(program, empty);
  const wanted = new Set([...exp.mustRemain, ...exp.oneOf.flat()]);
  function walkCourses(node: GoldenNode): void {
    for (const pick of node.picks) {
      for (const course of [...pick.all, ...pick.oneOf.flat()]) {
        if (wanted.has(course.code)) courses.push(course);
      }
    }
    for (const child of node.children) walkCourses(child);
  }
  for (const node of program.nodes) walkCourses(node);
  return courses;
}
