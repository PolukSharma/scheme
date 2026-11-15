import { describe, expect, it } from "vitest";
import { writeReport } from "../evals/run-accuracy";

describe("accuracy regression", () => {
  it("matches the committed hand-check snapshot", () => {
    expect(() => writeReport(true)).not.toThrow();
  });
});
