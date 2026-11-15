import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { RequirementNode } from "../lib/types";
import { parseProgramPage } from "../scripts/catalogue/parse";
import { buildTree } from "../scripts/catalogue/tree";
import { buildPolicy } from "../scripts/catalogue/policy";

const root = path.resolve(import.meta.dirname, "..");

function load(poid: number) {
  const html = readFileSync(
    path.join(root, `data/raw/2026-2027/catalogue_usc_edu_preview_program_php_catoid_22_poid_${poid}.html`),
    "utf8",
  );
  const page = parseProgramPage(html);
  return buildTree(page.outline, `https://catalogue.usc.edu/preview_program.php?catoid=22&poid=${poid}`, "p", page.description);
}

function codes(node: RequirementNode): string[] {
  if (node.type === "course") return [node.code];
  if (node.type === "course_set") return [];
  const children = node.type === "all_of" ? node.children : node.options;
  return children.flatMap(codes);
}

describe("catalogue requirement trees", () => {
  it("keeps the law minor at the 20 units the page prints", () => {
    const built = load(32878);
    expect(built.statedTotal).toBe(20);
    expect(built.builtUnits).toBe(20);
    expect(built.unexpanded).toEqual([]);
    const text = JSON.stringify(built.requirements);
    expect(text).toContain("LAW 210p");
    expect(text).toContain("TAC 115");
    expect(text).toContain("TAC 216");
  });

  it("accounts for the computer engineering degree once one track is chosen", () => {
    const built = load(32083);
    expect(built.statedTotal).toBe(128);
    expect(built.builtUnits + built.unexpandedUnits).toBe(128);
    expect(codes(built.requirements)).toContain("CSCI 102L");
    expect(JSON.stringify(built.requirements)).toContain("tracks");
  });

  it("reads the policy sentences from the cached catalogue pages", () => {
    const rules = buildPolicy();
    expect(rules.find((rule) => rule.id === "minor-units-unique-to-the-minor")?.value).toBe(16);
    expect(rules.find((rule) => rule.id === "per-term-unit-cap")?.confirmed).toBe(false);
    expect(rules.every((rule) => rule.source.catalogueYear === "2026-2027" && rule.source.url.startsWith("https://"))).toBe(
      true,
    );
  });
});
