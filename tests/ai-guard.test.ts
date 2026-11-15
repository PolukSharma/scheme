import { describe, expect, it } from "vitest";
import { foreignProgramName, guardOutput } from "@/lib/ai/guard";
import type { Source } from "@/lib/types";

const source: Source = {
  url: "https://catalogue.usc.edu/preview_program.php?catoid=22&poid=32086",
  catalogueYear: "2026-2027",
  text: "CSCI 102L is listed for 2 units.",
};

describe("output guard", () => {
  it("rejects a course code that was not supplied", () => {
    const result = guardOutput("Take DEMO 999 next.", [source], source.text, [source]);
    expect(result.ok).toBe(false);
    expect(result.violation).toContain("DEMO 999");
  });

  it("rejects a number that was not supplied", () => {
    const result = guardOutput("That path is 99 units.", [source], source.text, [source]);
    expect(result.ok).toBe(false);
    expect(result.violation).toContain("99");
  });

  it("rejects a citation that does not resolve", () => {
    const fake: Source = { ...source, url: "https://example.com/not-a-source" };
    const result = guardOutput("CSCI 102L is listed for 2 units.", [fake], source.text, [source]);
    expect(result.ok).toBe(false);
    expect(result.violation).toContain("citation");
  });

  it("rejects a program name that was not supplied", () => {
    const names = ["Computer Science (BS)", "Data Science Minor"];
    const result = guardOutput("The Data Science Minor adds a year.", [source], source.text, [source], names);
    expect(result.ok).toBe(false);
    expect(result.violation).toContain("Data Science");
    expect(foreignProgramName("Computer Science (BS) stays as listed.", "Computer Science (BS) stays as listed.", names)).toBeNull();
  });

  it("accepts a sentence whose codes, numbers, and citation were supplied", () => {
    const result = guardOutput("CSCI 102L is listed for 2 units.", [source], `${source.text} ${source.url}`, [source]);
    expect(result.ok).toBe(true);
  });
});
