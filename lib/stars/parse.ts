import { studentCourseSchema, type StudentCourse, type StudentCourseStatus, type StudentRecord } from "@/lib/types";
import { matchProgram } from "./programs";
import { createStudentRecord } from "./record";

export class StarsParseError extends Error {
  readonly offerManualEntry = true;

  constructor(message: string) {
    super(message);
    this.name = "StarsParseError";
  }
}

export interface StarsParseOptions {
  id?: string;
  label?: string;
}

export interface StarsParseSuccess {
  record: StudentRecord;
  /** Course lines that were not a catalogue-shaped code. The text is not kept. */
  skippedCourses: number;
}

const GRADE =
  /^(A\+|A-|B\+|B-|C\+|C-|D\+|D-|CR|RG|TR|IN|IX|MG|NS|A|B|C|D|F|P)$/;
const COURSE_LINE = /^\s*(\d{5})\s+(.*?)\s+(\d+\.\d+)\s+(\S+)\s*(.*)$/;
const ATTRIBUTE = /^[GLXMPW]$/;

const MANUAL_ENTRY = "Enter courses by hand.";

function fail(message: string): never {
  throw new StarsParseError(`${message} ${MANUAL_ENTRY}`);
}

export function termFromCode(code: string): { year: number; season: "spring" | "summer" | "fall"; label: string } | null {
  if (!/^\d{5}$/.test(code) || code.startsWith("9999")) return null;
  const year = Number(code.slice(0, 4));
  const season = code[4] === "1" ? "spring" : code[4] === "2" ? "summer" : code[4] === "3" ? "fall" : null;
  if (!season || year < 1900 || year > 2100) return null;
  return { year, season, label: `${year}-${season}` };
}

/** A fall code is the start of that catalogue year. A spring or summer code belongs to the year that started the previous fall. */
export function catalogueYearFromCode(code: string): string | null {
  const term = termFromCode(code);
  if (!term) return null;
  const start = term.season === "fall" ? term.year : term.year - 1;
  return `${start}-${start + 1}`;
}

function courseCodeFromField(field: string): string | null {
  const tokens = field.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  let dept = "";
  let number = "";
  let attached = "";
  let rest: string[] = [];
  const jammed = /^([A-Z]{2,8})(\d{3})([A-Z]*)$/.exec(tokens[0] ?? "");
  if (jammed) {
    dept = jammed[1] ?? "";
    number = jammed[2] ?? "";
    attached = jammed[3] ?? "";
    rest = tokens.slice(1);
  } else if (/^[A-Z]{2,8}$/.test(tokens[0] ?? "") && /^(\d{3})([A-Z]*)$/.test(tokens[1] ?? "")) {
    const split = /^(\d{3})([A-Z]*)$/.exec(tokens[1] ?? "");
    dept = tokens[0] ?? "";
    number = split?.[1] ?? "";
    attached = split?.[2] ?? "";
    rest = tokens.slice(2);
  } else {
    return null;
  }
  if (dept === "TRNSFR" || dept.startsWith("TR")) return null;
  const attributes = new Set(rest.filter((token) => ATTRIBUTE.test(token)));
  if (rest.some((token) => !ATTRIBUTE.test(token))) return null;
  let suffix = attached;
  if (suffix.length === 1 && (suffix === "A" || suffix === "B")) suffix = suffix.toLowerCase();
  if (attributes.has("L")) suffix += "L";
  if (attributes.has("G")) suffix += "g";
  if (attributes.has("X")) suffix += "x";
  if (attributes.has("P")) suffix += "p";
  if (attributes.has("M")) suffix += "m";
  if (attributes.has("W")) suffix += "w";
  return `${dept} ${number}${suffix}`;
}

const SEASON_RANK = { spring: 1, summer: 2, fall: 3 };

function termRank(term: string | null): number {
  const match = /^(\d{4})-(spring|summer|fall)$/.exec(term ?? "");
  if (!match) return 0;
  const season = match[2] as keyof typeof SEASON_RANK;
  return Number(match[1]) * 10 + SEASON_RANK[season];
}

function flagsOf(rest: string): { inProgress: boolean; dropped: boolean } {
  const flags = new Set<string>(rest.match(/>IP|>FF|>EX|>OS|>D|>Z|>R|>P/g) ?? []);
  return {
    inProgress: flags.has(">IP"),
    dropped: flags.has(">Z") || flags.has(">FF"),
  };
}

function statusFor(grade: string, title: string, inProgress: boolean): { status: StudentCourseStatus; grade: string | null } {
  if (inProgress || grade === "RG") return { status: "in_progress", grade: null };
  if (grade === "TR") {
    const external = /\bAP\b|\bIB\b|IBTEST/i.test(title);
    return { status: external && /\bAP\b/i.test(title) ? "ap" : "transfer", grade: "TR" };
  }
  return { status: "completed", grade };
}

function readCourses(text: string): { courses: StudentCourse[]; skippedCourses: number } {
  const byKey = new Map<string, StudentCourse>();
  let skippedCourses = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const match = COURSE_LINE.exec(rawLine);
    if (!match) continue;
    const termCode = match[1] ?? "";
    const field = match[2] ?? "";
    const units = Number(match[3]);
    const gradeToken = match[4] ?? "";
    const rest = match[5] ?? "";
    if (!GRADE.test(gradeToken) || !Number.isFinite(units) || units <= 0) continue;
    const term = termFromCode(termCode);
    const code = courseCodeFromField(field);
    const title = rest.replace(/>IP|>FF|>EX|>OS|>D|>Z|>R|>P/g, " ").replace(/\s+/g, " ").trim();
    const flags = flagsOf(rest);
    if (!term || !code) {
      skippedCourses += 1;
      continue;
    }
    if (flags.dropped) continue;
    const graded = statusFor(gradeToken, title, flags.inProgress);
    const candidate = {
      code,
      units,
      grade: graded.grade,
      term: term.label,
      status: graded.status,
    };
    const parsed = studentCourseSchema.safeParse(candidate);
    if (!parsed.success) {
      skippedCourses += 1;
      continue;
    }
    const key = `${parsed.data.code}|${parsed.data.term}`;
    const existing = byKey.get(key);
    if (!existing || parsed.data.status === "in_progress") byKey.set(key, parsed.data);
  }
  const courses = [...byKey.values()].sort((left, right) => {
    const termOrder = termRank(left.term) - termRank(right.term);
    return termOrder || left.code.localeCompare(right.code);
  });
  return { courses, skippedCourses };
}

function majorName(lines: string[]): string | null {
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^BACHELOR\s+OF\b/i.test(lines[index] ?? "")) continue;
    const next = lines[index + 1];
    if (next && !/^PERTINENT\b/i.test(next) && !/^_+$/.test(next)) return next;
  }
  return null;
}

/**
 * Parse the text of a STARS degree progress report.
 * The name and any student ID are not copied onto the record.
 */
export function parseStarsText(text: string, options: StarsParseOptions = {}): StarsParseSuccess {
  if (!/STARS/i.test(text) || !/CATALOG\s+YEAR:\s*\d{5}/i.test(text)) {
    fail("This file is not a STARS degree progress report.");
  }
  const catalogCode = text.match(/CATALOG\s+YEAR:\s*(\d{5})/i)?.[1];
  const catalogueYear = catalogCode ? catalogueYearFromCode(catalogCode) : null;
  if (!catalogueYear) fail("The catalogue year on this report could not be read.");
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const majorTitle = majorName(lines);
  const major = majorTitle ? matchProgram(majorTitle, "major") : null;
  if (!major) fail("The major on this report is not in the program list.");
  const entranceCode = text.match(/Term\s+of\s+USC\s+Entrance\s+(\d{5})/i)?.[1];
  const entrance = entranceCode ? termFromCode(entranceCode) : null;
  if (!entrance) fail("The entrance term on this report could not be read.");
  const minors = lines.flatMap((line) => {
    const match = /^MINOR:\s+(.+?)\s+(\d{5})\s*$/i.exec(line);
    if (!match?.[1]) return [];
    const program = matchProgram(match[1], "minor");
    return program ? [program.id] : [];
  });
  const { courses, skippedCourses } = readCourses(text);
  if (courses.length === 0) fail("No courses could be read from this report.");
  const declaredProgramIds = [major.id, ...minors.filter((id) => id !== major.id)];
  const record = createStudentRecord({
    id: options.id ?? "stars-local",
    label: options.label ?? "Student",
    school: major.school,
    startYear: entrance.year,
    startTerm: entrance.label,
    catalogueYear,
    majorId: major.id,
    declaredProgramIds,
    courses,
  });
  return { record, skippedCourses };
}

export function htmlToReportText(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  if (typeof DOMParser !== "undefined") {
    const document = new DOMParser().parseFromString(withoutNoise, "text/html");
    const blocks = document.body?.innerText ?? document.body?.textContent ?? "";
    if (blocks.trim()) return blocks;
  }
  return withoutNoise
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d|pre|section)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}
