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

/**
 * Every course code and every number in the output must already be in the
 * supplied text (the request, the engine result, or a catalogue passage).
 * Every citation must be one of the stored sources.
 */
export function guardOutput(text: string, citations: readonly Source[], corpus: string, allowed: readonly Source[]): GuardResult {
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
