import type { Assumption, PolicyRule } from "@/lib/types";

/** Rules with confirmed: false are reported and never used as numbers. */
export function unconfirmedAssumptions(rules: readonly PolicyRule[]): Assumption[] {
  return rules
    .filter((rule) => !rule.confirmed)
    .map((rule) => ({
      ruleId: rule.id,
      text: `${rule.name} is unconfirmed and was not applied. ${rule.summary}`,
    }));
}

export function confirmedNumber(rules: readonly PolicyRule[], id: string): number | null {
  const rule = rules.find((item) => item.id === id && item.confirmed);
  return rule && typeof rule.value === "number" ? rule.value : null;
}

/**
 * A confirmed numeric cap is a rule. An unconfirmed cap is not.
 * The number then comes from the caller, and the result says so.
 */
export function termUnitCap(
  rules: readonly PolicyRule[],
  requested: number | undefined,
): { cap: number; capConfirmed: boolean; assumptions: Assumption[] } {
  const assumptions = unconfirmedAssumptions(rules);
  const hard = confirmedNumber(rules, "per-term-unit-cap") ?? confirmedNumber(rules, "demo-term-unit-cap");
  if (hard !== null) {
    return { cap: hard, capConfirmed: true, assumptions };
  }
  if (requested !== undefined) {
    assumptions.push({
      ruleId: "per-term-unit-cap",
      text: `The per-term unit cap is unconfirmed. This plan uses ${requested} units because that number was passed in.`,
    });
    return { cap: requested, capConfirmed: false, assumptions };
  }
  const recommended = confirmedNumber(rules, "undergraduate-recommended-maximum");
  if (recommended !== null) {
    assumptions.push({
      ruleId: "per-term-unit-cap",
      text: `The per-term unit cap is unconfirmed. This plan uses ${recommended} units, the confirmed recommended maximum, and shows that as an assumption.`,
    });
    return { cap: recommended, capConfirmed: false, assumptions };
  }
  const normal = confirmedNumber(rules, "undergraduate-normal-term-load");
  const cap = normal ?? 16;
  assumptions.push({
    ruleId: "per-term-unit-cap",
    text: `The per-term unit cap is unconfirmed and no unit cap was passed in. This plan uses ${cap} units${normal !== null ? ", the confirmed normal load," : ""} and shows that as an assumption.`,
  });
  return { cap, capConfirmed: false, assumptions };
}
