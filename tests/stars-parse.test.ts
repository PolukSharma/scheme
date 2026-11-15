import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sampleStudents } from "@/data/samples";
import { findCatalogueCourse } from "@/lib/stars/catalogue";
import { extractPdfText, parseStarsFile } from "@/lib/stars/pdf";
import { htmlToReportText, parseStarsText, StarsParseError } from "@/lib/stars/parse";
import { createStudentRecord } from "@/lib/stars/record";
import type { StudentRecord } from "@/lib/types";
import { textPdf } from "./stars-pdf";

const root = path.resolve(import.meta.dirname, "..");

function read(name: string): string {
  return readFileSync(path.join(root, "fixtures/stars", name), "utf8");
}

function student(id: string): StudentRecord {
  const found = sampleStudents.find((item) => item.id === id);
  if (!found) throw new Error(`missing sample ${id}`);
  return found;
}

describe("STARS text", () => {
  it("parses the early synthetic report onto the early sample", () => {
    const parsed = parseStarsText(read("early.txt"), { id: "sample-early-cs", label: "Early" });
    expect(parsed.record).toEqual(student("sample-early-cs"));
    expect(parsed.skippedCourses).toBe(1);
    const json = JSON.stringify(parsed.record);
    expect(json).not.toContain("1234567890");
    expect(json).not.toContain("Diploma Name Placeholder");
  });

  it("parses the mid synthetic report, including transfer and AP", () => {
    const parsed = parseStarsText(read("mid.txt"), { id: "sample-mid-neuro", label: "Mid" });
    expect(parsed.record).toEqual(student("sample-mid-neuro"));
    expect(parsed.skippedCourses).toBe(1);
  });

  it("parses the late synthetic report onto the late sample", () => {
    const parsed = parseStarsText(read("late.txt"), { id: "sample-late-csba", label: "Late" });
    expect(parsed.record).toEqual(student("sample-late-csba"));
    expect(parsed.skippedCourses).toBe(0);
  });

  it("still reads a header when PDF positioning leaves extra spaces", () => {
    const spaced = read("early.txt")
      .replace("CATALOG YEAR:", "CATALOG  YEAR:")
      .replace("BACHELOR OF", "BACHELOR  OF")
      .replace("Term of USC Entrance", "Term  of  USC  Entrance");
    const parsed = parseStarsText(spaced, { id: "sample-early-cs", label: "Early" });
    expect(parsed.record).toEqual(student("sample-early-cs"));
  });

  it("parses a saved HTML report", () => {
    const parsed = parseStarsText(htmlToReportText(read("early.html")), {
      id: "sample-early-cs",
      label: "Early",
    });
    expect(parsed.record.courses).toEqual(student("sample-early-cs").courses);
    expect(parsed.record.majorId).toBe("computer-science-bs");
    expect(parsed.record.catalogueYear).toBe("2026-2027");
  });

  it("reads a restriction suffix and keeps a deleted-but-counted grade", () => {
    const parsed = parseStarsText(`
      STARS - DEGREE PROGRESS REPORT
      CATALOG YEAR: 20263
      BACHELOR OF SCIENCE
      COMPUTER SCIENCE
      Term of USC Entrance 20253
      20253 ACCT410   X  4.0 A     Invented accounting
      20253 TAC 216       2.0 A >DInvented counted
      20261 TAC 216       2.0 F >ZInvented removed
    `);
    expect(parsed.record.courses.map((course) => [course.code, course.status, course.grade])).toEqual([
      ["ACCT 410x", "completed", "A"],
      ["TAC 216", "completed", "A"],
    ]);
  });

  it("rejects a report it does not recognise and does not echo the contents", () => {
    expect(() => parseStarsText("not a report")).toThrow(StarsParseError);
    try {
      parseStarsText("not a report");
    } catch (error) {
      expect(error).toBeInstanceOf(StarsParseError);
      expect((error as Error).message).toContain("Enter courses by hand.");
    }
    const unknown = "ZZZNOTREAL";
    expect(() =>
      parseStarsText(`
        STARS - DEGREE PROGRESS REPORT
        CATALOG YEAR: 20263
        BACHELOR OF SCIENCE
        ${unknown}
        Term of USC Entrance 20253
        20253 CSCI102  L    2.0 A     Invented fundamentals
      `),
    ).toThrow(StarsParseError);
    try {
      parseStarsText(`
        STARS - DEGREE PROGRESS REPORT
        CATALOG YEAR: 20263
        BACHELOR OF SCIENCE
        ${unknown}
        Term of USC Entrance 20253
        20253 CSCI102  L    2.0 A     Invented fundamentals
      `);
    } catch (error) {
      expect((error as Error).message).not.toContain(unknown);
      expect((error as Error).message).toContain("Enter courses by hand.");
    }
  });

  it("builds the same record from manual fields and from a sample", () => {
    const early = student("sample-early-cs");
    const manual = createStudentRecord({
      ...early,
      id: "manual-local",
      label: "Student",
      courses: early.courses.map((course) => {
        const listed = findCatalogueCourse(course.code);
        if (!listed) throw new Error(`missing catalogue course ${course.code}`);
        return { ...course, units: listed.units };
      }),
    });
    expect(manual.courses).toEqual(early.courses);
    expect(manual.majorId).toBe(early.majorId);
    expect(manual.declaredProgramIds).toEqual(early.declaredProgramIds);
    expect(() =>
      createStudentRecord({
        ...early,
        courses: [{ ...early.courses[0], status: "in_progress", grade: "A" }],
      }),
    ).toThrow(/in-progress/);
  });
});

describe("STARS pdf", () => {
  it("reads a generated PDF without a worker request", async () => {
    const lines = read("early.txt").split(/\r?\n/);
    const text = await extractPdfText(textPdf(lines));
    const parsed = parseStarsText(text, { id: "sample-early-cs", label: "Early" });
    expect(parsed.record).toEqual(student("sample-early-cs"));
    const fromFile = await parseStarsFile(textPdf(lines), {
      fileName: "early.pdf",
      id: "sample-early-cs",
      label: "Early",
    });
    expect(fromFile.record).toEqual(student("sample-early-cs"));
  }, 20_000);
});

describe("STARS privacy", () => {
  it("does not store the report or call the network from the intake source", () => {
    const files = [
      ...readdirSync(path.join(root, "lib/stars")).map((name) => path.join(root, "lib/stars", name)),
      ...readdirSync(path.join(root, "components/intake")).map((name) => path.join(root, "components/intake", name)),
    ];
    const source = files
      .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/);
    expect(source).toContain("Parsed in your browser. Your report is never uploaded.");
  });
});
