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

export interface StarsDeclaredProgram {
  id: string;
  name: string;
  kind: "major" | "minor";
  effectiveTerm: string | null;
}

export interface StarsRemainingRequirement {
  title: string;
  needsUnits: number | null;
  selectFrom: string[];
}

export interface StarsUnitSummary {
  earned: number | null;
  inProcess: number | null;
  transfer: number | null;
}

export interface StarsElectiveSummary {
  freeEarned: number | null;
  excessCourses: string[];
}

export interface StarsParseSuccess {
  record: StudentRecord;
  /** Course lines that were not a catalogue-shaped code. The text is not kept. */
  skippedCourses: number;
  classLevel: string | null;
  expectedGraduation: string | null;
  programs: StarsDeclaredProgram[];
  units: StarsUnitSummary;
  remainingRequirements: StarsRemainingRequirement[];
  currentRegistration: string[];
  electives: StarsElectiveSummary;
}

const GRADE =
  /^(A\+|A-|B\+|B-|C\+|C-|D\+|D-|CR|RG|TR|IN|IX|MG|NS|A|B|C|D|F|P)$/;
const COURSE_LINE = /^\s*(\d{5})\s+(.*?)\s+(\d+\.\d+)\s+(\S+)\s*(.*)$/;
const ATTRIBUTE = /^[GLXMPW]$/;
const FLAG = /^>(?:IP|FF|EX|OS|D|Z|R|P)$/;
const FLAG_SOURCE = ">(?:IP|FF|EX|OS|D|Z|R|P)";
const SECTION_START =
  /^(PERTINENT|PRIMARY|MINOR:|UNIT\s+SUMMARY|REQUIREMENTS|CURRENT\s+REGISTRATION|FREE\s+ELECTIVE|EXCESS\s+ELECTIVE|BACHELOR\b|STARS\b|PROGRAM:|CATALOG|PREPARED|_{3,}|\d{5}\s+)/i;

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
  const jammed = /^([A-Z]{2,8})(\d{3})([A-Za-z]*)$/.exec(tokens[0] ?? "");
  if (jammed) {
    dept = jammed[1] ?? "";
    number = jammed[2] ?? "";
    attached = jammed[3] ?? "";
    rest = tokens.slice(1);
  } else if (/^[A-Z]{2,8}$/.test(tokens[0] ?? "") && /^(\d{3})([A-Za-z]*)$/.test(tokens[1] ?? "")) {
    const split = /^(\d{3})([A-Za-z]*)$/.exec(tokens[1] ?? "");
    dept = tokens[0] ?? "";
    number = split?.[1] ?? "";
    attached = split?.[2] ?? "";
    rest = tokens.slice(2);
  } else {
    return null;
  }
  if (dept === "TRNSFR" || dept.startsWith("TR")) return null;
  rest = rest.filter((token) => !FLAG.test(token));
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

function codesInText(value: string): string[] {
  const found: string[] = [];
  for (const match of value.matchAll(/\b([A-Z]{2,8})\s*(\d{3}[A-Za-z]*)\b/g)) {
    const code = courseCodeFromField(`${match[1]} ${match[2]}`);
    if (code && !found.includes(code)) found.push(code);
  }
  return found;
}

const SEASON_RANK = { spring: 1, summer: 2, fall: 3 };

function termRank(term: string | null): number {
  const match = /^(\d{4})-(spring|summer|fall)$/.exec(term ?? "");
  if (!match) return 0;
  const season = match[2] as keyof typeof SEASON_RANK;
  return Number(match[1]) * 10 + SEASON_RANK[season];
}

function flagsOf(text: string): { inProgress: boolean; dropped: boolean } {
  const flags = new Set<string>(text.match(new RegExp(FLAG_SOURCE, "g")) ?? []);
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

function courseScanLine(rawLine: string): string {
  return rawLine.replace(/^\s*(?:\+|PLUS|-|MINUS)\s*(?=\d{5}\b)/i, " ");
}

function readCourses(text: string): { courses: StudentCourse[]; skippedCourses: number } {
  const byKey = new Map<string, StudentCourse>();
  let skippedCourses = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const match = COURSE_LINE.exec(courseScanLine(rawLine));
    if (!match) continue;
    const termCode = match[1] ?? "";
    const field = match[2] ?? "";
    const units = Number(match[3]);
    const gradeToken = (match[4] ?? "").replace(new RegExp(FLAG_SOURCE, "g"), "");
    const rest = match[5] ?? "";
    if (!GRADE.test(gradeToken) || !Number.isFinite(units) || units <= 0) continue;
    const term = termFromCode(termCode);
    const code = courseCodeFromField(field);
    const title = rest.replace(new RegExp(FLAG_SOURCE, "g"), " ").replace(/\s+/g, " ").trim();
    const flags = flagsOf(rawLine);
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
 * Drop the name, student ID, and diploma address before any other field is read.
 * The removed text is not returned and is not kept on the record.
 */
function redactIdentity(text: string): string {
  const id = text.match(/(?:USC|STUDENT)\s*ID\s*[:#]?\s*(\d{7,12})/i)?.[1] ?? null;
  const lines = text.split(/\r?\n/);
  const drop = new Set<number>();
  let mode: "none" | "name" | "address" = "none";
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index]?.trim() ?? "";
    if (/(?:USC|STUDENT)\s*ID\b/i.test(trimmed)) {
      drop.add(index);
      mode = "none";
      continue;
    }
    if (/Name\s+as\s+it\s+will\s+appear|Student\s+Name\s*:/i.test(trimmed)) {
      drop.add(index);
      mode = "name";
      continue;
    }
    if (/Diploma\s+(?:Mailing\s+)?Address\b|Mailing\s+Address\b/i.test(trimmed)) {
      drop.add(index);
      mode = "address";
      continue;
    }
    if (mode !== "none") {
      if (!trimmed) {
        drop.add(index);
        continue;
      }
      if (SECTION_START.test(trimmed)) mode = "none";
      else {
        drop.add(index);
        continue;
      }
    }
  }
  let cleaned = lines.filter((_, index) => !drop.has(index)).join("\n");
  if (id) cleaned = cleaned.split(id).join("");
  return cleaned;
}

function sectionBody(text: string, start: string, end: string | null): string | null {
  const match = new RegExp(start, "i").exec(text);
  if (!match) return null;
  const rest = text.slice(match.index + match[0].length);
  if (!end) return rest;
  const stop = new RegExp(end, "i").exec(rest);
  return stop ? rest.slice(0, stop.index) : rest;
}

function labeledNumber(section: string, label: string): number | null {
  const direct = new RegExp(`(?:^|\\n)\\s*${label}[ \\t]*[:=]?[ \\t]*(\\d+(?:\\.\\d+)?)`, "i").exec(section);
  if (direct?.[1]) return Number(direct[1]);
  const inline = new RegExp(`\\b${label}[ \\t]*[:=]?[ \\t]*(\\d+(?:\\.\\d+)?)`, "i").exec(section);
  if (inline?.[1]) return Number(inline[1]);
  const lines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const labelRe = new RegExp(label, "i");
  for (let index = 0; index < lines.length - 1; index += 1) {
    const labels = (lines[index] ?? "").split(/\s{2,}|\t/).filter(Boolean);
    if (!labels.some((item) => labelRe.test(item))) continue;
    const values = (lines[index + 1] ?? "").split(/\s{2,}|\t/).filter(Boolean);
    const found = labels.findIndex((item) => labelRe.test(item));
    const raw = values[found];
    if (raw && /^\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  }
  return null;
}

function readUnits(text: string): StarsUnitSummary {
  const section = sectionBody(
    text,
    "UNIT\\s+SUMMARY\\b",
    "\\n\\s*(REQUIREMENTS|CURRENT\\s+REGISTRATION|FREE\\s+ELECTIVES|EXCESS\\s+ELECTIVES|\\d{5}\\s+[A-Z])",
  );
  if (section === null) return { earned: null, inProcess: null, transfer: null };
  return {
    earned: labeledNumber(section, "earned"),
    inProcess: labeledNumber(section, "in[-\\t ]?process"),
    transfer: labeledNumber(section, "transfer"),
  };
}

function classLevelFrom(text: string): string | null {
  const match = text.match(/Current\s+Class\s+Level:?\s+([A-Za-z][A-Za-z -]*?)(?=\s{2,}|$)/im);
  const level = match?.[1]?.replace(/\s+/g, " ").trim();
  return level || null;
}

function graduationFrom(text: string): string | null {
  const match = text.match(/Expected\s+Graduation(?:[ \t]+Term)?:?[ \t]*([A-Za-z0-9-]+(?:[ \t]+[A-Za-z0-9-]+)?)/i);
  const raw = match?.[1]?.trim();
  if (!raw) return null;
  const coded = termFromCode(raw);
  if (coded) return coded.label;
  const seasonFirst = /^(spring|summer|fall)\s+(\d{4})$/i.exec(raw);
  if (seasonFirst?.[1] && seasonFirst[2]) return `${seasonFirst[2]}-${seasonFirst[1].toLowerCase()}`;
  const yearFirst = /^(\d{4})\s+(spring|summer|fall)$/i.exec(raw);
  if (yearFirst?.[1] && yearFirst[2]) return `${yearFirst[1]}-${yearFirst[2].toLowerCase()}`;
  return raw;
}

function primaryEffectiveTerm(text: string): string | null {
  const block = sectionBody(
    text,
    "PRIMARY\\s+POST\\b",
    "\\n\\s*(MINOR:|UNIT\\s+SUMMARY|REQUIREMENTS|CURRENT\\s+REGISTRATION|FREE\\s+ELECTIVES|\\d{5}\\s+[A-Z])",
  );
  if (block === null) return null;
  const codes = [...block.matchAll(/\b(\d{5})\b/g)].map((match) => match[1] ?? "");
  for (let index = codes.length - 1; index >= 0; index -= 1) {
    const term = termFromCode(codes[index] ?? "");
    if (term) return term.label;
  }
  return null;
}

function readRequirements(text: string): StarsRemainingRequirement[] {
  const header = /^(OK|NO|IP)\b\s*:?\s*(?:\d+\s*[.)]\s*)?(.*)$/i;
  const sub = /^(?:\+|PLUS|-|MINUS)\b\s*(.*)$/i;
  let status: "OK" | "NO" | "IP" | null = null;
  let title = "";
  let parts: { unmet: boolean; needsUnits: number | null; selectFrom: string[] }[] = [];
  let part: { unmet: boolean; needsUnits: number | null; selectFrom: string[] } | null = null;
  const remaining: StarsRemainingRequirement[] = [];

  function ensure(unmet: boolean) {
    if (!part) {
      part = { unmet, needsUnits: null, selectFrom: [] };
      parts.push(part);
    }
    return part;
  }

  function absorb(value: string, unmet: boolean) {
    const needs = /NEEDS:\s*(\d+(?:\.\d+)?)/i.exec(value);
    const select = /SELECT\s+FROM:\s*(.+)/i.exec(value);
    if (!needs && !select) return;
    const target = ensure(unmet);
    if (needs?.[1]) target.needsUnits = Number(needs[1]);
    if (select?.[1]) {
      for (const code of codesInText(select[1])) {
        if (!target.selectFrom.includes(code)) target.selectFrom.push(code);
      }
    }
  }

  function finish() {
    if (!status || !title) {
      status = null;
      title = "";
      parts = [];
      part = null;
      return;
    }
    const unmetParts = parts.filter((item) => item.unmet);
    if (unmetParts.length > 0) {
      for (const item of unmetParts) {
        remaining.push({ title, needsUnits: item.needsUnits, selectFrom: [...item.selectFrom] });
      }
    } else if (status === "NO") {
      const collected = parts[0];
      remaining.push({
        title,
        needsUnits: collected?.needsUnits ?? null,
        selectFrom: collected ? [...collected.selectFrom] : [],
      });
    }
    status = null;
    title = "";
    parts = [];
    part = null;
  }

  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed || /^[_*]{3,}$/.test(trimmed)) continue;
    const headerMatch = header.exec(trimmed);
    if (headerMatch?.[1]) {
      finish();
      status = headerMatch[1].toUpperCase() as "OK" | "NO" | "IP";
      title = (headerMatch[2] ?? "").replace(/\s+/g, " ").trim();
      absorb(trimmed, status === "NO");
      continue;
    }
    if (!status) continue;
    const subMatch = sub.exec(trimmed);
    if (subMatch) {
      const unmet = /^(-|MINUS)\b/i.test(trimmed);
      part = { unmet, needsUnits: null, selectFrom: [] };
      parts.push(part);
      absorb(subMatch[1] ?? "", unmet);
      continue;
    }
    absorb(trimmed, status === "NO");
  }
  finish();
  return remaining;
}

function readElectives(text: string): StarsElectiveSummary {
  const free = sectionBody(text, "FREE\\s+ELECTIVES\\b", "\\n\\s*EXCESS\\s+ELECTIVES\\b");
  const excess = sectionBody(text, "EXCESS\\s+ELECTIVES\\b", null);
  return {
    freeEarned: free === null ? null : labeledNumber(free, "earned"),
    excessCourses: excess === null ? [] : readCourses(excess).courses.map((course) => course.code),
  };
}

function registrationCodes(text: string): string[] {
  const section = sectionBody(
    text,
    "CURRENT\\s+REGISTRATION\\b",
    "\\n\\s*(FREE\\s+ELECTIVES|EXCESS\\s+ELECTIVES|REQUIREMENTS|UNIT\\s+SUMMARY)\\b",
  );
  if (section === null) return [];
  return readCourses(section).courses.map((course) => course.code);
}

/**
 * Parse pasted STARS text, or text extracted from the PDF, into a student record.
 * Name, student ID, and diploma address are removed first. Nothing is stored.
 */
export function parseStarsText(text: string, options: StarsParseOptions = {}): StarsParseSuccess {
  const source = redactIdentity(text);
  if (!/STARS/i.test(source) || !/CATALOG\s+YEAR:\s*\d{5}/i.test(source)) {
    fail("This file is not a STARS degree progress report.");
  }
  const catalogCode = source.match(/CATALOG\s+YEAR:\s*(\d{5})/i)?.[1];
  const catalogueYear = catalogCode ? catalogueYearFromCode(catalogCode) : null;
  if (!catalogueYear) fail("The catalogue year on this report could not be read.");
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const majorTitle = majorName(lines);
  const major = majorTitle ? matchProgram(majorTitle, "major") : null;
  if (!major) fail("The major on this report is not in the program list.");
  const entranceCode = source.match(/Term\s+of\s+USC\s+Entrance\s+(\d{5})/i)?.[1];
  const entrance = entranceCode ? termFromCode(entranceCode) : null;
  if (!entrance) fail("The entrance term on this report could not be read.");
  const minors = lines.flatMap((line) => {
    const match = /^MINOR:\s+(.+?)\s+(\d{5})\s*$/i.exec(line);
    if (!match?.[1] || !match[2]) return [];
    const program = matchProgram(match[1], "minor");
    if (!program) return [];
    return [
      {
        id: program.id,
        name: program.name,
        kind: "minor" as const,
        effectiveTerm: termFromCode(match[2])?.label ?? null,
      },
    ];
  });
  const { courses, skippedCourses } = readCourses(source);
  if (courses.length === 0) fail("No courses could be read from this report.");
  const declaredProgramIds = [major.id, ...minors.map((program) => program.id).filter((id) => id !== major.id)];
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
  return {
    record,
    skippedCourses,
    classLevel: classLevelFrom(source),
    expectedGraduation: graduationFrom(source),
    programs: [
      {
        id: major.id,
        name: major.name,
        kind: "major",
        effectiveTerm: primaryEffectiveTerm(source),
      },
      ...minors.filter((program) => program.id !== major.id),
    ],
    units: readUnits(source),
    remainingRequirements: readRequirements(source),
    currentRegistration: registrationCodes(source),
    electives: readElectives(source),
  };
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
