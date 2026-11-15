import type { RequirementNode, Source } from "../../lib/types";
import type { OutlineBlock, OutlineCourse, OutlineItem } from "./parse";

/**
 * Turns a catalogue outline into a requirement tree. Grouping follows the page:
 * a course line ending in "or" or "and", and the words "or" and "and" printed between
 * lines. "Choose N" and a heading unit count decide whether a block is all-of or choose-N.
 * A block the page states only in prose is returned in `unexpanded` with the quotation,
 * not filled in.
 */

const YEAR = "2026-2027";

const WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
};

export interface UnexpandedBlock {
  heading: string;
  text: string;
  units: { min: number; max: number } | null;
}

export interface BuiltProgram {
  requirements: RequirementNode;
  unexpanded: UnexpandedBlock[];
  /** Units of the course lines and choose-groups that were built. */
  builtUnits: number;
  /** Units named by blocks that list no courses, such as general education. */
  unexpandedUnits: number;
  statedTotal: number | null;
}

function source(url: string, text: string): Source {
  return { url, catalogueYear: YEAR, text: text.replace(/\s+/g, " ").trim() };
}

function headingUnits(heading: string): { min: number; max: number } | null {
  const trailing = /units?:\s*(\d+)(?:\s*(?:to|-|–)\s*(\d+))?/i.exec(heading);
  if (trailing) return { min: Number(trailing[1]), max: Number(trailing[2] ?? trailing[1]) };
  const range = /(\d+)\s*(?:to|-|–)\s*(\d+)\s*-?\s*units?/i.exec(heading);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const one = /(\d+)\s*-?\s*units?/i.exec(heading);
  if (one) return { min: Number(one[1]), max: Number(one[1]) };
  const word = /(one|two|three|four|five|six|seven|eight)\s+units?/i.exec(heading);
  if (word) return { min: WORDS[word[1].toLowerCase()], max: WORDS[word[1].toLowerCase()] };
  return null;
}

function nodeUnits(node: RequirementNode): number {
  if (node.type === "course") {
    const match = /Units:\s*(\d+(?:\.\d+)?)/.exec(node.source.text);
    return match ? Number(match[1]) : 0;
  }
  if (node.type === "course_set") return node.minUnits ?? 0;
  if (node.type === "all_of") return node.children.reduce((sum, child) => sum + nodeUnits(child), 0);
  if (node.minUnits !== undefined) return node.minUnits;
  if (node.minCount) return node.minCount * Math.min(...node.options.map(nodeUnits));
  return 0;
}

function courseUnits(unitsText: string): number {
  const match = /(\d+(?:\.\d+)?)/.exec(unitsText);
  return match ? Number(match[1]) : 0;
}

function isCourseChoice(node: RequirementNode): boolean {
  if (node.type === "course") return true;
  return node.type === "n_of" && node.minCount === 1 && node.options.every((option) => option.type === "course" || option.type === "all_of");
}

function leadingCourseCount(atoms: Atom[]): number {
  const index = atoms.findIndex((atom) => !isCourseChoice(atom.node));
  return index === -1 ? atoms.length : index;
}

function chooseCount(text: string): number | null {
  const chosen =
    /(?:choose|select|take|complete|enroll in)\s+(one|two|three|four|five|six|seven|eight|\d+)/i.exec(text);
  const courses = /\b(one|two|three|four|five|six|seven|eight|\d+)\s+(?:[A-Za-z]+\s+){0,3}courses?\b/i.exec(text);
  const word = (chosen ?? courses)?.[1];
  if (!word) return null;
  return WORDS[word.toLowerCase()] ?? Number(word);
}

function courseSetFrom(text: string, url: string, id: string): RequirementNode | null {
  const level = /(\d{3})\s*-?\s*(?:or\s+)?(\d{3})\s*-?\s*level/i.exec(text);
  const depts = [...text.matchAll(/\b([A-Z]{2,5})\b/g)]
    .map((match) => match[1])
    .filter((word) => !["GE", "USC", "OR", "AND", "GPA"].includes(word));
  const uniqueDepts = [...new Set(depts)];
  if (!level || uniqueDepts.length === 0) return null;
  const units = headingUnits(text);
  const count = chooseCount(text);
  const minUnits = units?.min;
  const option = (dept: string): RequirementNode => ({
    type: "course_set",
    id: `${id}-${dept.toLowerCase()}`,
    match: {
      dept,
      levelMin: Number(level[1]),
      levelMax: Number(level[2]) + 99,
    },
    ...(count ? { minCount: count } : {}),
    ...(minUnits ? { minUnits } : {}),
    source: source(url, text),
    verified: false,
  });
  if (uniqueDepts.length === 1) return option(uniqueDepts[0]);
  return {
    type: "n_of",
    id,
    minCount: 1,
    ...(minUnits ? { minUnits } : {}),
    options: uniqueDepts.map(option),
    source: source(
      url,
      `${text} The ${minUnits ?? count} required here may be mixed across these prefixes; this node lists one set per prefix and is unverified for that reason.`,
    ),
    verified: false,
  };
}

interface Atom {
  node: RequirementNode;
  units: number;
  or: boolean;
}

function courseNode(course: OutlineCourse, url: string, id: string, or: boolean): Atom {
  const units = courseUnits(course.unitsText);
  return {
    or,
    units,
    node: {
      type: "course",
      id,
      code: course.code,
      source: source(url, `${course.code} ${course.title} Units: ${course.unitsText}`.trim()),
      verified: true,
    },
  };
}

function combine(kind: "all_of" | "n_of", atoms: Atom[], url: string, id: string, quote: string): Atom {
  const node: RequirementNode =
    kind === "all_of"
      ? {
          type: "all_of",
          id,
          children: atoms.map((atom) => atom.node),
          source: source(url, quote),
          verified: atoms.every((atom) => atom.node.verified),
        }
      : {
          type: "n_of",
          id,
          minCount: 1,
          options: atoms.map((atom) => atom.node),
          source: source(url, quote),
          verified: atoms.every((atom) => atom.node.verified),
        };
  const units =
    kind === "all_of" ? atoms.reduce((sum, atom) => sum + atom.units, 0) : Math.min(...atoms.map((atom) => atom.units));
  return { node, units, or: false };
}

type Token =
  | { kind: "course"; andSuffix: boolean; orSuffix: boolean; atom: Atom }
  | { kind: "word"; word: "and" | "or" }
  | { kind: "ready"; atom: Atom };

/** A suffix on a course line binds only to the next course. A printed "and" or "or" binds the groups on either side. */
function linkTokens(tokens: Token[], url: string, id: string): Atom[] {
  const suffixed: Token[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind === "course" && (token.andSuffix || token.orSuffix) && tokens[index + 1]?.kind === "course") {
      const which = token.andSuffix ? "andSuffix" : "orSuffix";
      const chain = [token];
      while (chain[chain.length - 1][which] && tokens[index + 1]?.kind === "course") {
        index += 1;
        const next = tokens[index];
        if (next.kind !== "course") break;
        chain.push(next);
      }
      suffixed.push({
        kind: "ready",
        atom: combine(
          which === "andSuffix" ? "all_of" : "n_of",
          chain.map((item) => item.atom),
          url,
          `${id}-${which}`,
          which === "andSuffix" ? "The page joins these with and." : "The page prints these as alternatives.",
        ),
      });
      continue;
    }
    suffixed.push(token.kind === "course" ? { kind: "ready", atom: token.atom } : token);
  }
  const out: Atom[] = [];
  for (let index = 0; index < suffixed.length; index += 1) {
    const token = suffixed[index];
    if (token.kind !== "ready") continue;
    const word = suffixed[index + 1];
    if (word?.kind !== "word") {
      out.push(token.atom);
      continue;
    }
    const group = [token.atom];
    while (suffixed[index + 1]?.kind === "word" && (suffixed[index + 1] as { word: string }).word === word.word && suffixed[index + 2]?.kind === "ready") {
      group.push((suffixed[index + 2] as { atom: Atom }).atom);
      index += 2;
    }
    out.push(
      combine(
        word.word === "and" ? "all_of" : "n_of",
        group,
        url,
        `${id}-${word.word}`,
        word.word === "and" ? "The page joins these with and." : "The page prints these as alternatives.",
      ),
    );
  }
  return out;
}

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function buildTree(
  outline: readonly OutlineItem[],
  url: string,
  idPrefix: string,
  description = "",
): BuiltProgram {
  counter = 0;
  const unexpanded: UnexpandedBlock[] = [];
  const rootChildren: Atom[] = [];
  const notes: string[] = [];
  for (const item of outline) {
    if (item.kind === "text") {
      if (!/^(or|and)$/i.test(item.text)) notes.push(item.text);
      continue;
    }
    if (item.kind === "course") {
      rootChildren.push(courseNode(item, url, nextId(idPrefix), false));
      continue;
    }
    if (/^total(?:\s+required)?\s+units/i.test(item.heading)) continue;
    const built = buildBlock(item, url, idPrefix, unexpanded);
    if (built.node.type === "all_of" && built.node.children.length === 0) continue;
    rootChildren.push(built);
  }
  const unexpandedUnits = unexpanded.reduce((sum, block) => sum + (block.units?.min ?? 0), 0);
  const stated = statedFromOutline(outline) ?? statedTotal(description) ?? statedTotal(notes.join(" "));
  const collapsed = collapseTracks(rootChildren, stated, unexpandedUnits, url, idPrefix);
  const requirements: RequirementNode = {
    type: "all_of",
    id: `${idPrefix}-all`,
    children: collapsed.map((atom) => atom.node),
    source: source(url, notes[0] ?? "Requirements as printed on the catalogue page."),
    verified: collapsed.every((atom) => atom.node.verified) && unexpanded.length === 0,
  };
  return {
    requirements,
    unexpanded,
    builtUnits: collapsed.reduce((sum, atom) => sum + atom.units, 0),
    unexpandedUnits,
    statedTotal: stated,
  };
}

function statedFromOutline(outline: readonly OutlineItem[]): number | null {
  for (const item of outline) {
    if (item.kind === "block") {
      const found = statedTotal(item.heading);
      if (found) return found;
    }
    if (item.kind === "text") {
      const found = statedTotal(item.text);
      if (found) return found;
    }
  }
  return null;
}

function collapseTracks(
  children: Atom[],
  stated: number | null,
  unexpandedUnits: number,
  url: string,
  idPrefix: string,
): Atom[] {
  if (stated === null) return children;
  const tracks = children.filter((atom) => /track\s*\(/i.test(atom.node.source.text));
  if (tracks.length < 2 || tracks.some((track) => track.units !== tracks[0].units || track.units === 0)) {
    return children;
  }
  const sum = children.reduce((total, atom) => total + atom.units, 0) + unexpandedUnits;
  const extra = sum - stated;
  const removable = tracks[0].units * (tracks.length - 1);
  if (extra !== removable) return children;
  const choice = combine(
    "n_of",
    tracks,
    url,
    `${idPrefix}-tracks`,
    `The page lists ${tracks.length} tracks of ${tracks[0].units} units and a degree total of ${stated} units. That total matches only when one track is taken. The text read on the page does not say to choose one track, so this node is unverified.`,
  );
  choice.node.verified = false;
  choice.units = tracks[0].units;
  const out: Atom[] = [];
  let placed = false;
  for (const child of children) {
    if (!tracks.includes(child)) {
      out.push(child);
      continue;
    }
    if (!placed) {
      out.push(choice);
      placed = true;
    }
  }
  return out;
}

function statedTotal(text: string): number | null {
  const labeled = /total(?:\s+required)?\s+units?:\s*(\d+)/i.exec(text);
  if (labeled) return Number(labeled[1]);
  const sentence = /totals?\s+(\d+)\s+units/i.exec(text);
  return sentence ? Number(sentence[1]) : null;
}

function buildBlock(
  block: OutlineBlock,
  url: string,
  idPrefix: string,
  unexpanded: UnexpandedBlock[],
): Atom {
  const segments: { heading: string; tokens: Token[]; notes: string[] }[] = [
    { heading: block.heading, tokens: [], notes: [] },
  ];
  const subhead = /(\d+\s*(?:to|-|–)\s*\d+|\d+)\s*-?\s*units?|choose (?:one|two|three|four)|select one|requirement/i;
  for (const child of block.children) {
    const current = segments[segments.length - 1];
    if (child.kind === "text" && subhead.test(child.text) && current.tokens.length > 0) {
      segments.push({ heading: child.text, tokens: [], notes: [] });
      continue;
    }
    if (child.kind === "text") {
      if (/^and$/i.test(child.text)) current.tokens.push({ kind: "word", word: "and" });
      else if (/^or$/i.test(child.text)) current.tokens.push({ kind: "word", word: "or" });
      else current.notes.push(child.text);
      continue;
    }
    if (child.kind === "course") {
      current.tokens.push({
        kind: "course",
        andSuffix: /\band\b/i.test(child.unitsText),
        orSuffix: /\bor\b/i.test(child.unitsText),
        atom: courseNode(child, url, nextId(idPrefix), false),
      });
      continue;
    }
    current.tokens.push({ kind: "ready", atom: buildBlock(child, url, idPrefix, unexpanded) });
  }
  if (segments.length > 1) {
    const parts = segments
      .filter((segment) => segment.tokens.length > 0)
      .map((segment) => fromTokens(segment.heading, segment.notes, segment.tokens, url, idPrefix, unexpanded));
    return fromTokens(
      block.heading,
      [],
      parts.map((part) => ({ kind: "ready", atom: part })),
      url,
      idPrefix,
      unexpanded,
    );
  }
  return fromTokens(block.heading, segments[0].notes, segments[0].tokens, url, idPrefix, unexpanded);
}

function fromTokens(
  heading: string,
  notes: string[],
  tokens: Token[],
  url: string,
  idPrefix: string,
  unexpanded: UnexpandedBlock[],
): Atom {
  const id = nextId(idPrefix);
  const atoms = linkTokens(tokens, url, id).filter((atom) => atom.node.type !== "all_of" || atom.node.children.length > 0);
  const quote = [heading, ...notes].filter(Boolean).join(" ");
  const units = headingUnits(heading) ?? headingUnits(notes.join(" "));
  const prose = `${heading} ${notes.join(" ")}`;
  const unclear = /advis[eo]r|permission|waiv|substitut|honou?rs|consult/i.test(prose);

  if (/may be substituted/i.test(prose)) {
    return {
      units: 0,
      or: false,
      node: {
        type: "all_of",
        id,
        children: [
          {
            type: "course_set",
            id: `${id}-substitution`,
            match: { dept: "ZZ" },
            minCount: 1,
            source: source(
              url,
              `${quote} The substitution cannot be encoded exactly, so this node is unverified and does not require the listed courses. The department ZZ is not a catalogue rule; it only keeps the node in the shared schema.`,
            ),
            verified: false,
          },
        ],
        source: source(url, quote),
        verified: false,
      },
    };
  }
  if (/^(honou?rs|scholarship|note)\b/i.test(heading) || /^units:/i.test(heading)) {
    return { node: { type: "all_of", id, children: [], source: source(url, quote || heading), verified: false }, units: 0, or: false };
  }
  if (atoms.length === 0) {
    const set = courseSetFrom(prose, url, id);
    if (set) return { node: set, units: units?.min ?? 0, or: false };
    unexpanded.push({ heading, text: quote, units });
    return {
      units: 0,
      or: false,
      node: {
        type: "all_of",
        id,
        children: [
          {
            type: "course_set",
            id: `${id}-prose`,
            match: { levelMin: 0 },
            minUnits: units?.min ?? 1,
            source: source(
              url,
              `${quote} This block lists no courses. levelMin is not a catalogue rule; it only keeps the node in the shared schema.`,
            ),
            verified: false,
          },
        ],
        source: source(url, quote),
        verified: false,
      },
    };
  }

  const sum = atoms.reduce((total, atom) => total + atom.units, 0);
  const count = chooseCount(prose);
  const headingSaysChoose = /choose either|select one|take one of|choose one|choose two|choose three|choose four/i.test(
    `${heading} ${notes.join(" ")}`,
  );
  const sumsToHeading = units !== null && Math.abs(sum - units.max) < 0.01 && units.min === units.max;
  let node: RequirementNode;
  if (sumsToHeading && !headingSaysChoose) {
    node = {
      type: "all_of",
      id,
      children: atoms.map((atom) => atom.node),
      source: source(url, quote),
      verified: !unclear && atoms.every((atom) => atom.node.verified),
    };
  } else if (count !== null && count === leadingCourseCount(atoms) && leadingCourseCount(atoms) < atoms.length) {
    node = {
      type: "all_of",
      id,
      children: atoms.map((atom) => atom.node),
      source: source(url, quote),
      verified: !unclear && atoms.every((atom) => atom.node.verified),
    };
  } else if (count !== null && count === atoms.length) {
    node = {
      type: "all_of",
      id,
      children: atoms.map((atom) => atom.node),
      source: source(url, quote),
      verified: !unclear && atoms.every((atom) => atom.node.verified),
    };
  } else if ((count === 1 || /choose either|select one|take one of|choose one/i.test(prose)) && atoms.length > 1) {
    node = {
      type: "n_of",
      id,
      minCount: 1,
      ...(units ? { minUnits: units.min } : {}),
      options: atoms.map((atom) => atom.node),
      source: source(url, quote),
      verified: !unclear && atoms.every((atom) => atom.node.verified) && !(units && units.min !== units.max),
    };
  } else if (count && count > 1 && count >= atoms.length && atoms.length > 1 && atoms.every((atom) => atom.node.type === "all_of" || atom.node.type === "n_of")) {
    const options = atoms.flatMap((atom) =>
      atom.node.type === "all_of" ? atom.node.children : atom.node.type === "n_of" ? atom.node.options : [atom.node],
    );
    node = {
      type: "n_of",
      id,
      minCount: count,
      ...(units ? { minUnits: units.min } : {}),
      options,
      source: source(url, quote),
      verified: false,
    };
    const optionUnits = options.map(nodeUnits).filter((value) => value > 0);
    return { node, units: optionUnits.length ? count * Math.min(...optionUnits) : 0, or: false };
  } else if (count && count > 1 && count < atoms.length) {
    node = {
      type: "n_of",
      id,
      minCount: count,
      ...(units ? { minUnits: units.min } : {}),
      options: atoms.map((atom) => atom.node),
      source: source(url, quote),
      verified: !unclear && atoms.every((atom) => atom.node.verified),
    };
  } else if (units && sum > units.max + 0.01) {
    const same = atoms.every((atom) => atom.units === atoms[0].units && atom.units > 0);
    const implied = same && units.min % atoms[0].units === 0 ? units.min / atoms[0].units : undefined;
    node = {
      type: "n_of",
      id,
      ...(implied ? { minCount: implied } : {}),
      minUnits: units.min,
      options: atoms.map((atom) => atom.node),
      source: source(url, quote),
      verified: !unclear && atoms.every((atom) => atom.node.verified),
    };
  } else {
    node = {
      type: "all_of",
      id,
      children: atoms.map((atom) => atom.node),
      source: source(url, quote),
      verified: !unclear && atoms.every((atom) => atom.node.verified) && !(units && units.min !== units.max),
    };
  }
  const counted =
    node.type === "all_of"
      ? sum
      : node.minUnits ??
        (node.minCount && atoms[0] ? node.minCount * Math.min(...atoms.map((atom) => atom.units)) : units?.min ?? sum);
  return { node, units: counted, or: false };
}

export function pageTotal(description: string, outline: readonly OutlineItem[]): number | null {
  const texts = [description];
  const walk = (items: readonly OutlineItem[]) => {
    for (const item of items) {
      if (item.kind === "text") texts.push(item.text);
      if (item.kind === "block") {
        texts.push(item.heading);
        walk(item.children);
      }
    }
  };
  walk(outline);
  const blob = texts.join("\n");
  const total = /total(?:\s+required)?\s+units?:\s*(\d+)/i.exec(blob);
  if (total) return Number(total[1]);
  const degree = /(?:minimum requirement for the degree is|requirement for the degree is|totals?)\s*(\d+)\s*units/i.exec(
    description,
  );
  return degree ? Number(degree[1]) : null;
}
