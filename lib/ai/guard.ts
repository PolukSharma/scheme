import type { Source } from "@/lib/types";

function coursePattern(): RegExp {
  return /\b[A-Z]{2,8} \d{3}[A-Za-z]{0,4}\b/g;
}

const numberToken = /\d+(?:\.\d+)?/g;

export interface GuardResult {
  ok: boolean;
  violation: string | null;
}

function appearsAsToken(corpus: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`).test(corpus);
}

const nameStop = new Set([
  "a",
  "an",
  "the",
  "this",
  "that",
  "no",
  "any",
  "each",
  "your",
  "my",
  "its",
  "one",
  "some",
  "every",
  "another",
  "is",
  "has",
  "have",
  "lists",
  "list",
  "ranks",
  "rank",
  "named",
  "adding",
  "add",
  "result",
  "with",
  "from",
  "not",
  "was",
  "were",
  "be",
  "as",
  "on",
  "in",
  "for",
  "engine",
  "answer",
  "course",
  "courses",
]);
const nameJoin = new Set(["and", "of", "for"]);

function titleBefore(text: string, index: number): string[] {
  const before = text.slice(Math.max(0, index - 80), index).trim().split(/\s+/).slice(-6);
  const tail: string[] = [];
  for (let cursor = before.length - 1; cursor >= 0; cursor -= 1) {
    const original = before[cursor] ?? "";
    if (/[.:;!?,]$/.test(original)) break;
    const token = original.replace(/[^A-Za-z&/]/g, "");
    const lower = token.toLowerCase();
    if (!token) break;
    if (nameJoin.has(lower)) {
      if (tail.length > 0) tail.unshift(token);
      continue;
    }
    if (nameStop.has(lower)) break;
    tail.unshift(token);
  }
  return tail;
}

/** True when `name` occurs in `text` outside a longer catalogue name. */
export function mentionsProgramName(text: string, name: string, names: readonly string[]): boolean {
  const lower = text.toLowerCase();
  const needle = name.toLowerCase();
  if (needle.length < 3) return false;
  const longer = names.filter((other) => other.length > name.length && other.toLowerCase().includes(needle));
  let from = 0;
  while (from < lower.length) {
    const at = lower.indexOf(needle, from);
    if (at < 0) return false;
    const covered = longer.some((other) => {
      const long = other.toLowerCase();
      let pad = 0;
      while (pad < long.length) {
        const found = long.indexOf(needle, pad);
        if (found < 0) return false;
        const start = at - found;
        if (start >= 0 && lower.slice(start, start + long.length) === long) return true;
        pad = found + 1;
      }
      return false;
    });
    if (!covered) return true;
    from = at + 1;
  }
  return false;
}

/**
 * A catalogue program name, or a phrase of the form "Name minor", that shows
 * up in the output and not in the supplied text.
 */
export function foreignProgramName(text: string, corpus: string, names: readonly string[]): string | null {
  const unique = [...new Set(names.map((name) => name.trim()).filter((name) => name.length >= 3))];
  for (const name of unique.sort((left, right) => right.length - left.length)) {
    if (mentionsProgramName(text, name, unique) && !mentionsProgramName(corpus, name, unique)) return name;
  }
  const invented = /\b(minor|major|specialization)\b/gi;
  for (const match of text.matchAll(invented)) {
    const tail = titleBefore(text, match.index ?? 0);
    if (tail.length === 0) continue;
    const phrase = `${tail.join(" ")} ${match[1]}`;
    if (!corpus.toLowerCase().includes(phrase.toLowerCase())) return phrase;
  }
  const degrees = /\((BS|BA|BFA|MS|MA)\)/gi;
  for (const match of text.matchAll(degrees)) {
    const tail = titleBefore(text, match.index ?? 0);
    if (tail.length === 0) continue;
    const phrase = `${tail.join(" ")} (${match[1]})`;
    if (!corpus.toLowerCase().includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

/**
 * Every course code, number, and (when a name list is supplied) program name
 * in the output must already be in the supplied text. Every citation must be
 * one of the stored sources.
 */
export function guardOutput(
  text: string,
  citations: readonly Source[],
  corpus: string,
  allowed: readonly Source[],
  programNames: readonly string[] = [],
): GuardResult {
  const codes = text.match(coursePattern()) ?? [];
  for (const code of codes) {
    if (!appearsAsToken(corpus, code)) {
      return { ok: false, violation: `course code ${code} is not in the supplied text` };
    }
  }
  const numbers = text.replace(coursePattern(), " ").match(numberToken) ?? [];
  for (const value of numbers) {
    if (!appearsAsToken(corpus, value)) {
      return { ok: false, violation: `number ${value} is not in the supplied text` };
    }
  }
  if (programNames.length > 0) {
    const foreign = foreignProgramName(text, corpus, programNames);
    if (foreign) return { ok: false, violation: `program name ${foreign} is not in the supplied text` };
  }
  for (const citation of citations) {
    const resolved = allowed.some(
      (source) => source.url === citation.url && source.catalogueYear === citation.catalogueYear && source.text === citation.text,
    );
    if (!resolved) {
      return { ok: false, violation: "a citation does not resolve to a stored source" };
    }
  }
  return { ok: true, violation: null };
}

export function resolveCitation(url: string, allowed: readonly Source[]): Source | null {
  return allowed.find((source) => source.url === url) ?? null;
}
