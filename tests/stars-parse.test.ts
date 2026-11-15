import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sampleStudents } from "@/data/samples";
import { findCatalogueCourse } from "@/lib/stars/catalogue";
import { extractPdfText, parseStarsFile } from "@/lib/stars/pdf";
import { htmlToReportText, parseStarsText, StarsParseError, type StarsParseSuccess } from "@/lib/stars/parse";
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

const expected = JSON.parse(read("expected.json")) as Record<string, ReturnType<typeof reportFacts>>;

function reportFacts(parsed: StarsParseSuccess) {
  return {
    classLevel: parsed.classLevel,
    expectedGraduation: parsed.expectedGraduation,
    programs: parsed.programs,
    units: parsed.units,
    remainingRequirements: parsed.remainingRequirements,
    currentRegistration: parsed.currentRegistration,
    electives: parsed.electives,
  };
}

describe("STARS text", () => {
  it("parses the early synthetic report onto the early sample", () => {
    const parsed = parseStarsText(read("early.txt"), { id: "sample-early-cs", label: "Early" });
    expect(parsed.record).toEqual(student("sample-early-cs"));
    expect(parsed.skippedCourses).toBe(1);
    expect(reportFacts(parsed)).toEqual(expected.early);
    expect(parseStarsText(read("early.txt"), { id: "sample-early-cs", label: "Early" })).toEqual(parsed);
    const json = JSON.stringify(parsed);
    expect(json).not.toContain("1234567890");
    expect(json).not.toContain("Diploma Name Placeholder");
    expect(json).not.toContain("123 Fake Street");
    expect(json).not.toContain("90089");
  });

  it("parses the mid synthetic report, including transfer and AP", () => {
    const parsed = parseStarsText(read("mid.txt"), { id: "sample-mid-neuro", label: "Mid" });
    expect(parsed.record).toEqual(student("sample-mid-neuro"));
    expect(parsed.skippedCourses).toBe(1);
    expect(reportFacts(parsed)).toEqual(expected.mid);
    expect(parsed.record.courses.filter((course) => course.status === "ap").map((course) => course.code)).toEqual([
      "CSCI 102L",
    ]);
    expect(parsed.record.courses.filter((course) => course.status === "transfer").map((course) => course.code)).toEqual([
      "WRIT 150",
    ]);
    expect(parsed.record.courses.filter((course) => course.status === "in_progress").map((course) => course.code)).toEqual([
      "BISC 220Lg",
    ]);
  });

  it("parses the late synthetic report onto the late sample", () => {
    const parsed = parseStarsText(read("late.txt"), { id: "sample-late-csba", label: "Late" });
    expect(parsed.record).toEqual(student("sample-late-csba"));
    expect(parsed.skippedCourses).toBe(0);
    expect(reportFacts(parsed)).toEqual(expected.late);
    expect(parsed.remainingRequirements.map((item) => item.title)).toEqual(["Further mathematics"]);
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

  it("reads requirement status, registration, and elective lines", () => {
    const parsed = parseStarsText(`
      STARS - DEGREE PROGRESS REPORT
      CATALOG YEAR: 20263
      BACHELOR OF SCIENCE
      COMPUTER SCIENCE
      Term of USC Entrance 20253
      Expected Graduation Spring 2027
      Current Class Level Junior
      UNIT SUMMARY
      EARNED    IN-PROCESS    TRANSFER
      2.0       4.0           0.0
      20253 CSCI102  L >IP  2.0 RG    Invented fundamentals
      REQUIREMENTS
      OK  Writing requirement
      PLUS 20261 WRIT150  4.0 A- Invented writing
      NO  Systems
      MINUS NEEDS: 4.0 UNITS
      SELECT FROM: CSCI 270 or CSCI 104
      CURRENT REGISTRATION
      20263 CSCI270  4.0 RG >IP Invented systems
      FREE ELECTIVES
      Earned 1.0
      EXCESS ELECTIVES
      20253 TAC 115  2.0 A Invented python
    `);
    expect(parsed.record.courses.map((course) => [course.code, course.status, course.grade])).toEqual([
      ["CSCI 102L", "in_progress", null],
      ["TAC 115", "completed", "A"],
      ["WRIT 150", "completed", "A-"],
      ["CSCI 270", "in_progress", null],
    ]);
    expect(parsed.classLevel).toBe("Junior");
    expect(parsed.expectedGraduation).toBe("2027-spring");
    expect(parsed.units).toEqual({ earned: 2, inProcess: 4, transfer: 0 });
    expect(parsed.remainingRequirements).toEqual([
      { title: "Systems", needsUnits: 4, selectFrom: ["CSCI 270", "CSCI 104"] },
    ]);
    expect(parsed.currentRegistration).toEqual(["CSCI 270"]);
    expect(parsed.electives).toEqual({ freeEarned: 1, excessCourses: ["TAC 115"] });
  });

  it("strips the name, id, and diploma address before it reports an error", () => {
    const name = "Diploma Name Placeholder";
    const id = "1234567890";
    const street = "123 Fake Street";
    const report = `
      STARS - DEGREE PROGRESS REPORT
      CATALOG YEAR: 20264
      USC ID ${id}
      Name as it will appear on your USC Diploma:
      ${name}
      Diploma Mailing Address:
      ${street}
      Los Angeles CA 90089
      BACHELOR OF SCIENCE
      COMPUTER SCIENCE
      Term of USC Entrance 20253
      20253 CSCI102  L    2.0 A     Invented fundamentals
    `;
    expect(() => parseStarsText(report)).toThrow(StarsParseError);
    try {
      parseStarsText(report);
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("catalogue year");
      expect(message).toContain("Enter courses by hand.");
      expect(message).not.toContain(name);
      expect(message).not.toContain(id);
      expect(message).not.toContain(street);
    }
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
    expect(reportFacts(parsed)).toEqual(expected.early);
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
