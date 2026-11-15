import type { Course, RequirementNode, RequirementStatus } from "@/lib/types";
import { gradeMeets } from "./grade";
import { prereqGap } from "./plan";

export interface HeldCourse {
  code: string;
  units: number;
  grade: string | null;
  inProgress: boolean;
  /** Already required by the current path. Its units are not an extra cost. */
  anticipated?: boolean;
}

export interface Cover {
  applied: string[];
  remaining: string[];
  /** Prerequisite and corequisite courses that are not already in remaining. */
  extra: string[];
  /** Units this cover contributes to a parent's count or unit floor. */
  creditUnits: number;
  ok: boolean;
  statuses: RequirementStatus[];
}

export interface AssignContext {
  byCode: Map<string, Course>;
  held: Map<string, HeldCourse>;
  majorCourses: ReadonlySet<string>;
  memo: Map<string, Cover>;
}

const EXACT_OPTIONS = 12;

function unitsOf(ctx: AssignContext, code: string): number {
  return ctx.byCode.get(code)?.units ?? ctx.held.get(code)?.units ?? 0;
}

function unique(codes: readonly string[]): string[] {
  return [...new Set(codes)];
}

function minGradeOf(node: RequirementNode): string | undefined {
  return node.constraints?.minGrade;
}

function shareCap(node: RequirementNode): number | undefined {
  return node.constraints?.maxUnitsSharedWithMajor;
}

export function closedCodes(cover: Cover): string[] {
  return unique([...cover.remaining, ...cover.extra]);
}

export function costUnits(ctx: AssignContext, cover: Cover): number {
  return closedCodes(cover).reduce((sum, code) => sum + unitsOf(ctx, code), 0);
}

function heldCounts(ctx: AssignContext, code: string, minimum: string | undefined): boolean {
  const row = ctx.held.get(code);
  if (!row) return false;
  if (row.anticipated) return true;
  return gradeMeets(row.grade, minimum, row.inProgress);
}

function matchesSet(course: Course, node: Extract<RequirementNode, { type: "course_set" }>): boolean {
  if (node.match.dept && course.dept !== node.match.dept) return false;
  if (node.match.levelMin !== undefined && course.level < node.match.levelMin) return false;
  if (node.match.levelMax !== undefined && course.level > node.match.levelMax) return false;
  return true;
}

function couldUse(node: RequirementNode, code: string, ctx: AssignContext): boolean {
  if (node.type === "course") return node.code === code;
  if (node.type === "course_set") {
    const course = ctx.byCode.get(code);
    return course ? matchesSet(course, node) : false;
  }
  const children = node.type === "all_of" ? node.children : node.options;
  return children.some((child) => couldUse(child, code, ctx));
}

function sharedOk(code: string, sharedUnits: number, cap: number | undefined, ctx: AssignContext): boolean {
  if (cap === undefined || !ctx.majorCourses.has(code)) return true;
  return sharedUnits + unitsOf(ctx, code) <= cap;
}

function noteFor(node: RequirementNode, applied: readonly string[], ok: boolean): string {
  if (node.type === "course") {
    return ok ? `${node.code} is applied to this requirement.` : `${node.code} is still needed for this requirement.`;
  }
  if (node.type === "course_set") {
    return ok
      ? `Matched ${applied.length} catalogue course${applied.length === 1 ? "" : "s"} for this set.`
      : "This course set is not filled yet.";
  }
  if (node.type === "all_of") {
    return ok ? "Every child of this group is satisfied." : "Every child of this group is required.";
  }
  const count = node.minCount !== undefined ? String(node.minCount) : "enough";
  return ok ? `This group has its ${count} required options.` : `This group still needs ${count} options.`;
}

function statusFor(
  node: RequirementNode,
  applied: readonly string[],
  remainingUnits: number,
  ok: boolean,
): RequirementStatus {
  return {
    nodeId: node.id,
    satisfied: ok,
    appliedCourses: [...applied],
    remainingUnits,
    note: noteFor(node, applied, ok),
    source: node.source,
  };
}

function blank(node: RequirementNode): Cover {
  return {
    applied: [],
    remaining: [],
    extra: [],
    creditUnits: 0,
    ok: false,
    statuses: [statusFor(node, [], 0, false)],
  };
}

function chainCodes(ctx: AssignContext, cover: Cover): string[] {
  const codes = new Set(closedCodes(cover));
  const pending = [...codes];
  const done = new Set(ctx.held.keys());
  while (pending.length > 0) {
    const code = pending.pop();
    if (!code) break;
    const course = ctx.byCode.get(code);
    if (!course) continue;
    for (const needed of prereqGap(course.prerequisites, done, (item) => unitsOf(ctx, item))) {
      if (codes.has(needed) || done.has(needed)) continue;
      codes.add(needed);
      pending.push(needed);
    }
    for (const coreq of course.corequisites) {
      if (!codes.has(coreq) && !done.has(coreq)) {
        codes.add(coreq);
        pending.push(coreq);
      }
    }
  }
  return [...codes];
}

function chainSpan(ctx: AssignContext, cover: Cover): number {
  const pool = new Set(chainCodes(ctx, cover));
  const memo = new Map<string, number>();
  const walk = (code: string, stack: Set<string>): number => {
    const cached = memo.get(code);
    if (cached !== undefined) return cached;
    if (stack.has(code)) return 1;
    stack.add(code);
    const course = ctx.byCode.get(code);
    let depth = 0;
    if (course) {
      const mentioned = mentionedCodes(course.prerequisites).filter((item) => pool.has(item) && !ctx.held.has(item));
      for (const item of mentioned) depth = Math.max(depth, walk(item, stack));
    }
    stack.delete(code);
    const span = depth + 1;
    memo.set(code, span);
    return span;
  };
  let best = 0;
  for (const code of pool) best = Math.max(best, walk(code, new Set()));
  return best;
}

function mentionedCodes(expr: Course["prerequisites"]): string[] {
  if (!expr) return [];
  if (expr.type === "course") return [expr.code];
  return expr.children.flatMap((child) => mentionedCodes(child));
}

function rankTuple(ctx: AssignContext, cover: Cover): [number, number, number, number] {
  const units = costUnits(ctx, cover);
  const penalty = cover.ok ? units : units + 1_000_000;
  return [penalty, chainSpan(ctx, cover), closedCodes(cover).length, cover.applied.length];
}

function better(ctx: AssignContext, left: Cover, right: Cover): boolean {
  const leftRank = rankTuple(ctx, left);
  const rightRank = rankTuple(ctx, right);
  for (let index = 0; index < leftRank.length; index += 1) {
    if (leftRank[index] !== rightRank[index]) return leftRank[index] < rightRank[index];
  }
  const leftKey = [...closedCodes(left)].sort().join("|");
  const rightKey = [...closedCodes(right)].sort().join("|");
  return leftKey < rightKey;
}

function attachExtras(cover: Cover, ctx: AssignContext, unavailable: ReadonlySet<string>): Cover {
  const have = new Set<string>([...ctx.held.keys(), ...cover.applied, ...cover.remaining, ...unavailable]);
  const extra = [...cover.extra];
  const pending = [...cover.remaining, ...cover.extra];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const code = pending.pop();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const course = ctx.byCode.get(code);
    if (!course) continue;
    for (const needed of prereqGap(course.prerequisites, have, (item) => unitsOf(ctx, item))) {
      if (have.has(needed)) continue;
      extra.push(needed);
      have.add(needed);
      pending.push(needed);
    }
    for (const coreq of course.corequisites) {
      if (!have.has(coreq)) {
        extra.push(coreq);
        have.add(coreq);
        pending.push(coreq);
      }
    }
  }
  const applied = new Set(cover.applied);
  const remaining = new Set(cover.remaining);
  return {
    ...cover,
    extra: unique(extra).filter((code) => !applied.has(code) && !remaining.has(code)),
  };
}

function mergeCovers(covers: readonly Cover[], ok: boolean, creditUnits: number): Cover {
  const applied = unique(covers.flatMap((cover) => cover.applied));
  const appliedSet = new Set(applied);
  const remaining = unique(covers.flatMap((cover) => cover.remaining)).filter((code) => !appliedSet.has(code));
  const remainingSet = new Set(remaining);
  const extra = unique(covers.flatMap((cover) => cover.extra)).filter(
    (code) => !appliedSet.has(code) && !remainingSet.has(code),
  );
  return {
    applied,
    remaining,
    extra,
    creditUnits,
    ok,
    statuses: covers.flatMap((cover) => cover.statuses),
  };
}

function keyOf(node: RequirementNode, unavailable: ReadonlySet<string>): string {
  return `${node.id}|${[...unavailable].sort().join(",")}`;
}

function contestedHeld(
  node: Extract<RequirementNode, { type: "all_of" }>,
  ctx: AssignContext,
  unavailable: ReadonlySet<string>,
): string[] {
  const found: string[] = [];
  for (const code of ctx.held.keys()) {
    if (unavailable.has(code) || !heldCounts(ctx, code, undefined)) continue;
    const users = node.children.filter((child) => couldUse(child, code, ctx)).length;
    if (users > 1) found.push(code);
  }
  return found;
}

function withOwnStatus(node: RequirementNode, cover: Cover, ctx: AssignContext): Cover {
  const ownUnits = cover.remaining.reduce((sum, code) => sum + unitsOf(ctx, code), 0);
  const satisfied = cover.ok && cover.remaining.length === 0;
  return {
    ...cover,
    statuses: [statusFor(node, cover.applied, ownUnits, satisfied), ...cover.statuses],
  };
}

function sequentialAll(
  node: Extract<RequirementNode, { type: "all_of" }>,
  ctx: AssignContext,
  unavailable: ReadonlySet<string>,
): Cover {
  const ordered = [...node.children].sort(
    (left, right) => Number(right.type === "course") - Number(left.type === "course"),
  );
  const covers: Cover[] = [];
  const taken = new Set(unavailable);
  for (const child of ordered) {
    const cover = coverNode(child, ctx, taken);
    covers.push(cover);
    for (const code of [...cover.applied, ...cover.remaining, ...cover.extra]) taken.add(code);
  }
  const merged = mergeCovers(
    covers,
    covers.every((cover) => cover.ok),
    covers.reduce((sum, cover) => sum + cover.creditUnits, 0),
  );
  return withOwnStatus(node, merged, ctx);
}

function coverAll(
  node: Extract<RequirementNode, { type: "all_of" }>,
  ctx: AssignContext,
  unavailable: Set<string>,
): Cover {
  const contested = contestedHeld(node, ctx, unavailable);
  if (contested.length === 0 || contested.length > 4) return sequentialAll(node, ctx, unavailable);
  const code = contested[0];
  let best: Cover | null = null;
  const consider = (cover: Cover) => {
    if (!best || better(ctx, cover, best)) best = cover;
  };
  const banned = new Set(unavailable);
  banned.add(code);
  consider(coverAll(node, ctx, banned));
  for (let index = 0; index < node.children.length; index += 1) {
    if (!couldUse(node.children[index], code, ctx)) continue;
    const covers: Cover[] = [];
    const taken = new Set(unavailable);
    for (let childIndex = 0; childIndex < node.children.length; childIndex += 1) {
      const ban = new Set(taken);
      if (childIndex !== index) ban.add(code);
      const cover = coverNode(node.children[childIndex], ctx, ban);
      covers.push(cover);
      for (const used of [...cover.applied, ...cover.remaining, ...cover.extra]) taken.add(used);
    }
    const merged = mergeCovers(
      covers,
      covers.every((cover) => cover.ok),
      covers.reduce((sum, cover) => sum + cover.creditUnits, 0),
    );
    consider(withOwnStatus(node, merged, ctx));
  }
  return best ?? sequentialAll(node, ctx, unavailable);
}

function meetsQuota(
  count: number,
  units: number,
  minCount: number | undefined,
  minUnits: number | undefined,
): boolean {
  if (minCount !== undefined && count < minCount) return false;
  if (minUnits !== undefined && units < minUnits) return false;
  if (minCount === undefined && minUnits === undefined) return count > 0;
  return true;
}

function finishGroup(node: RequirementNode, chosen: readonly Cover[], ctx: AssignContext): Cover {
  const credit = chosen.reduce((sum, cover) => sum + cover.creditUnits, 0);
  const minCount = node.type === "n_of" || node.type === "course_set" ? node.minCount : undefined;
  const minUnits = node.type === "n_of" || node.type === "course_set" ? node.minUnits : undefined;
  const ok = chosen.every((cover) => cover.ok) && meetsQuota(chosen.length, credit, minCount, minUnits);
  return withOwnStatus(node, mergeCovers(chosen, ok, credit), ctx);
}

function coverChoice(
  node: Extract<RequirementNode, { type: "n_of" }>,
  ctx: AssignContext,
  unavailable: Set<string>,
): Cover {
  if (node.options.length > EXACT_OPTIONS) return greedyOptions(node, node.options, ctx, unavailable);
  let best: Cover | null = null;
  const consider = (cover: Cover) => {
    if (!best || better(ctx, cover, best)) best = cover;
  };
  const walk = (index: number, chosen: Cover[], taken: Set<string>) => {
    const credit = chosen.reduce((sum, cover) => sum + cover.creditUnits, 0);
    if (meetsQuota(chosen.length, credit, node.minCount, node.minUnits) && chosen.every((cover) => cover.ok)) {
      consider(finishGroup(node, chosen, ctx));
      return;
    }
    if (index >= node.options.length) {
      if (chosen.length > 0) consider(finishGroup(node, chosen, ctx));
      return;
    }
    if (best?.ok && chosen.length > 0 && costUnits(ctx, finishGroup(node, chosen, ctx)) > costUnits(ctx, best)) {
      return;
    }
    walk(index + 1, chosen, taken);
    const ban = new Set(unavailable);
    for (const code of taken) ban.add(code);
    const cover = coverNode(node.options[index], ctx, ban);
    const nextTaken = new Set(taken);
    for (const code of [...cover.applied, ...cover.remaining, ...cover.extra]) nextTaken.add(code);
    walk(index + 1, [...chosen, cover], nextTaken);
  };
  walk(0, [], new Set());
  return best ?? blank(node);
}

function greedyOptions(
  node: RequirementNode,
  options: readonly RequirementNode[],
  ctx: AssignContext,
  unavailable: ReadonlySet<string>,
): Cover {
  if (options.every((option) => option.type === "course")) return greedyCourses(node, options, ctx, unavailable);
  const have = new Set(unavailable);
  const chosen: Cover[] = [];
  const pool = [...options];
  const minCount = node.type === "n_of" || node.type === "course_set" ? node.minCount : undefined;
  const minUnits = node.type === "n_of" || node.type === "course_set" ? node.minUnits : undefined;
  while (pool.length > 0 && chosen.length <= options.length) {
    const credit = chosen.reduce((sum, cover) => sum + cover.creditUnits, 0);
    if (meetsQuota(chosen.length, credit, minCount, minUnits) && chosen.every((cover) => cover.ok)) break;
    let bestIndex = 0;
    let bestCover = coverNode(pool[0], ctx, have);
    for (let index = 1; index < pool.length; index += 1) {
      const cover = coverNode(pool[index], ctx, have);
      if (better(ctx, cover, bestCover)) {
        bestCover = cover;
        bestIndex = index;
      }
    }
    if (!bestCover.ok && bestCover.remaining.length === 0 && bestCover.extra.length === 0 && bestCover.creditUnits === 0) {
      break;
    }
    chosen.push(bestCover);
    for (const code of [...bestCover.applied, ...bestCover.remaining, ...bestCover.extra]) have.add(code);
    pool.splice(bestIndex, 1);
  }
  return finishGroup(node, chosen, ctx);
}

function addedCost(
  code: string,
  ctx: AssignContext,
  have: ReadonlySet<string>,
  free: boolean,
): { cost: number; extra: string[] } {
  const own = free ? 0 : unitsOf(ctx, code);
  const course = ctx.byCode.get(code);
  if (!course) return { cost: own, extra: [] };
  const extra = unique([
    ...prereqGap(course.prerequisites, have, (item) => unitsOf(ctx, item)),
    ...course.corequisites.filter((item) => !have.has(item)),
  ]);
  return { cost: own + extra.reduce((sum, item) => sum + unitsOf(ctx, item), 0), extra };
}

function greedyCourses(
  node: RequirementNode,
  options: readonly RequirementNode[],
  ctx: AssignContext,
  unavailable: ReadonlySet<string>,
): Cover {
  const grade = node.constraints?.minGrade;
  const cap = node.constraints?.maxUnitsSharedWithMajor;
  const minCount = node.type === "n_of" || node.type === "course_set" ? node.minCount : undefined;
  const minUnits = node.type === "n_of" || node.type === "course_set" ? node.minUnits : undefined;
  const have = new Set<string>([...ctx.held.keys(), ...unavailable]);
  const applied: string[] = [];
  const remaining: string[] = [];
  const extra: string[] = [];
  let creditUnits = 0;
  let shared = 0;
  const pool = options.flatMap((option) => (option.type === "course" ? [option.code] : []));
  while (pool.length > 0) {
    if (meetsQuota(applied.length + remaining.length, creditUnits, minCount, minUnits)) break;
    let best: { index: number; cost: number; extra: string[]; free: boolean } | null = null;
    for (let index = 0; index < pool.length; index += 1) {
      const code = pool[index];
      if (unavailable.has(code) || !sharedOk(code, shared, cap, ctx)) continue;
      const option = options.find((item) => item.type === "course" && item.code === code);
      const free = heldCounts(ctx, code, grade ?? option?.constraints?.minGrade);
      const quote = addedCost(code, ctx, have, free);
      const currentUnits = unitsOf(ctx, code);
      const bestUnits = best ? unitsOf(ctx, pool[best.index]) : 0;
      if (!best || quote.cost < best.cost || (quote.cost === best.cost && currentUnits > bestUnits)) {
        best = { index, cost: quote.cost, extra: quote.extra, free };
      }
    }
    if (!best) break;
    const code = pool[best.index];
    pool.splice(best.index, 1);
    if (best.free) applied.push(code);
    else remaining.push(code);
    creditUnits += unitsOf(ctx, code);
    if (ctx.majorCourses.has(code)) shared += unitsOf(ctx, code);
    have.add(code);
    for (const extraCode of best.extra) {
      if (!have.has(extraCode)) extra.push(extraCode);
      have.add(extraCode);
    }
  }
  const ok = meetsQuota(applied.length + remaining.length, creditUnits, minCount, minUnits);
  const childStatuses = options.map((option) => {
    if (option.type !== "course") return statusFor(option, [], 0, false);
    const isApplied = applied.includes(option.code);
    return statusFor(
      option,
      isApplied ? [option.code] : [],
      isApplied ? 0 : unitsOf(ctx, option.code),
      isApplied,
    );
  });
  return {
    applied,
    remaining,
    extra: unique(extra).filter((code) => !applied.includes(code) && !remaining.includes(code)),
    creditUnits,
    ok,
    statuses: [
      statusFor(
        node,
        applied,
        remaining.reduce((sum, code) => sum + unitsOf(ctx, code), 0),
        ok && remaining.length === 0,
      ),
      ...childStatuses,
    ],
  };
}

function coverSet(
  node: Extract<RequirementNode, { type: "course_set" }>,
  ctx: AssignContext,
  unavailable: Set<string>,
): Cover {
  const options: RequirementNode[] = [];
  for (const course of ctx.byCode.values()) {
    if (unavailable.has(course.code) || !matchesSet(course, node)) continue;
    options.push({
      type: "course",
      id: `${node.id}:${course.code}`,
      code: course.code,
      source: node.source,
      verified: node.verified,
      constraints: node.constraints,
    });
  }
  if (options.length > EXACT_OPTIONS) return greedyCourses(node, options, ctx, unavailable);
  const synthetic: Extract<RequirementNode, { type: "n_of" }> = {
    type: "n_of",
    id: `${node.id}:pick`,
    options,
    minCount: node.minCount,
    minUnits: node.minUnits,
    source: node.source,
    verified: node.verified,
    constraints: node.constraints,
  };
  const picked = coverChoice(synthetic, ctx, unavailable);
  return {
    ...picked,
    statuses: [
      statusFor(
        node,
        picked.applied,
        picked.remaining.reduce((sum, code) => sum + unitsOf(ctx, code), 0),
        picked.ok && picked.remaining.length === 0,
      ),
      ...picked.statuses.filter((status) => status.nodeId !== synthetic.id),
    ],
  };
}

function coverCourse(
  node: Extract<RequirementNode, { type: "course" }>,
  ctx: AssignContext,
  unavailable: ReadonlySet<string>,
): Cover {
  const credit = unitsOf(ctx, node.code);
  const usable =
    !unavailable.has(node.code) &&
    heldCounts(ctx, node.code, minGradeOf(node)) &&
    sharedOk(node.code, 0, shareCap(node), ctx);
  if (usable) {
    return {
      applied: [node.code],
      remaining: [],
      extra: [],
      creditUnits: credit,
      ok: true,
      statuses: [statusFor(node, [node.code], 0, true)],
    };
  }
  return {
    applied: [],
    remaining: [node.code],
    extra: [],
    creditUnits: credit,
    ok: true,
    statuses: [statusFor(node, [], credit, false)],
  };
}

export function coverNode(
  node: RequirementNode,
  ctx: AssignContext,
  unavailable: ReadonlySet<string> = new Set(),
): Cover {
  const memoKey = keyOf(node, unavailable);
  const cached = ctx.memo.get(memoKey);
  if (cached) return cached;
  let cover: Cover;
  if (node.type === "course") cover = coverCourse(node, ctx, unavailable);
  else if (node.type === "course_set") cover = coverSet(node, ctx, new Set(unavailable));
  else if (node.type === "all_of") cover = coverAll(node, ctx, new Set(unavailable));
  else cover = coverChoice(node, ctx, new Set(unavailable));
  const closed = attachExtras(cover, ctx, unavailable);
  ctx.memo.set(memoKey, closed);
  return closed;
}

export function makeContext(
  courses: readonly Course[],
  held: readonly HeldCourse[],
  majorCourses: ReadonlySet<string> = new Set(),
): AssignContext {
  return {
    byCode: new Map(courses.map((course) => [course.code, course])),
    held: new Map(held.map((course) => [course.code, course])),
    majorCourses,
    memo: new Map(),
  };
}

export function coverProgram(
  root: RequirementNode,
  courses: readonly Course[],
  held: readonly HeldCourse[],
  majorCourses: ReadonlySet<string> = new Set(),
): Cover {
  return coverNode(root, makeContext(courses, held, majorCourses));
}
