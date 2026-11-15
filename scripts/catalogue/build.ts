import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Course, PrerequisiteExpr, Program, RequirementNode, TermOffering } from "../../lib/types";
import { parseProgramPage } from "./parse";
import { offeringsFrom, parseCourseExpression, parseRawCourse } from "./course";
import { buildTree, pageTotal, type UnexpandedBlock } from "./tree";

const YEAR = "2026-2027";
const ROOT = path.resolve(import.meta.dirname, "../..");
const RAW = path.join(ROOT, "data/raw", YEAR);
const COURSE_CACHE = process.env.COURSE_CACHE ?? "/tmp/usc/courses";

interface ListedProgram {
  id: string;
  catalogueName: string | null;
  school: string | null;
  kind: "major" | "minor" | "specialization" | null;
  degree: string | null;
  url: string | null;
  poid: number | null;
  selected: boolean;
  status: string;
}

interface ProgramList {
  programs: ListedProgram[];
  notFoundAsNamed: ListedProgram[];
}

function programFile(poid: number): string {
  return path.join(RAW, `catalogue_usc_edu_preview_program_php_catoid_22_poid_${poid}.html`);
}

function walk(node: RequirementNode, visit: (node: RequirementNode) => void): void {
  visit(node);
  if (node.type === "all_of") node.children.forEach((child) => walk(child, visit));
  if (node.type === "n_of") node.options.forEach((child) => walk(child, visit));
}

function applyGradeRule(node: RequirementNode, description: string): void {
  const sentence = /grade of ([A-D][+-]?) \([^)]*\) or better is required for each of the core courses ([^.]+)/i.exec(
    description,
  );
  if (!sentence) return;
  const grade = sentence[1].toUpperCase();
  const listed = [...sentence[2].matchAll(/\b([A-Z]{2,8})\s+(\d{3})/g)].map((match) => `${match[1]} ${match[2]}`);
  walk(node, (current) => {
    if (current.type !== "course") return;
    const normalized = current.code.replace(/^([A-Z]+ \d{3})[A-Za-z]+$/, "$1");
    if (!listed.includes(normalized)) return;
    current.constraints = { minGrade: grade };
    current.source = {
      ...current.source,
      text: `${current.source.text} ${sentence[0]}`,
    };
  });
}

function treeUnits(node: RequirementNode): number {
  if (node.type === "course") {
    const match = /Units:\s*(\d+(?:\.\d+)?)/.exec(node.source.text);
    return match ? Number(match[1]) : 0;
  }
  if (node.type === "course_set") return node.minUnits ?? 0;
  if (node.type === "all_of") return node.children.reduce((sum, child) => sum + treeUnits(child), 0);
  if (node.minUnits !== undefined) return node.minUnits;
  if (node.minCount) {
    const smallest = Math.min(...node.options.map(treeUnits));
    return node.minCount * smallest;
  }
  return 0;
}

function allVerified(node: RequirementNode): boolean {
  if (!node.verified) return false;
  if (node.type === "all_of") return node.children.every(allVerified);
  if (node.type === "n_of") return node.options.every(allVerified);
  return true;
}

function unitReason(built: number, unexpanded: UnexpandedBlock[], stated: number | null, tree: number): string {
  const named = unexpanded.map((block) => `${block.heading} (${block.units?.min ?? "no unit count"} units)`).join("; ");
  if (stated === null) return "The page does not print a single total. verified is false.";
  if (tree === stated) return `The requirement tree accounts for the ${stated} units printed on the page.`;
  return `The page prints ${stated} units. The built tree accounts for ${tree} units. Blocks without a course list: ${named || "none"}. Built course lines sum to ${built}.`;
}

export function buildPrograms(): { programs: Program[]; index: unknown; codes: Set<string> } {
  const list = JSON.parse(readFileSync(path.join(ROOT, "data/program-list.json"), "utf8")) as ProgramList;
  const codes = new Set<string>();
  const programs: Program[] = [];
  const indexRows: unknown[] = [];
  mkdirSync(path.join(ROOT, "data/programs"), { recursive: true });

  for (const entry of list.programs) {
    if (!entry.poid || !entry.url || !entry.catalogueName || !entry.school || !entry.kind) continue;
    const page = parseProgramPage(readFileSync(programFile(entry.poid), "utf8"));
    const built = buildTree(page.outline, entry.url, entry.id, page.description);
    applyGradeRule(built.requirements, page.description);
    walk(built.requirements, (node) => {
      if (node.type === "course") codes.add(node.code);
    });
    const stated = pageTotal(page.description, page.outline) ?? built.statedTotal;
    const accounted = treeUnits(built.requirements);
    const unitsMatch = stated !== null && accounted === stated;
    const nodesVerified = allVerified(built.requirements);
    const reason = `${unitReason(built.builtUnits, built.unexpanded, stated, accounted)}${
      unitsMatch && !nodesVerified
        ? " verified is false because a node is unverified: a block with no course list, a course set read from a sentence, or a track choice the page does not state in words."
        : ""
    }`;
    const verified = nodesVerified && unitsMatch;
    const program: Program & { unitCheck: string; unexpanded: UnexpandedBlock[] } = {
      id: entry.id,
      name: entry.catalogueName,
      school: entry.school,
      kind: entry.kind,
      description: page.description || "The catalogue page does not print a description above the requirements.",
      catalogueYear: YEAR,
      requirements: built.requirements,
      source: {
        url: entry.url,
        catalogueYear: YEAR,
        text: page.description.slice(0, 500) || entry.catalogueName,
      },
      verified,
      humanChecked: false,
      unitCheck: reason,
      unexpanded: built.unexpanded,
    };
    if (!verified) {
      program.source = { ...program.source, text: `${program.source.text} ${reason}` };
    }
    programs.push(program);
    writeFileSync(path.join(ROOT, "data/programs", `${entry.id}.json`), `${JSON.stringify(program, null, 2)}\n`);
    indexRows.push({
      id: entry.id,
      name: entry.catalogueName,
      school: entry.school,
      kind: entry.kind,
      degree: entry.degree,
      file: `data/programs/${entry.id}.json`,
      url: entry.url,
      catalogueYear: YEAR,
      selected: entry.selected,
      status: entry.status,
      verified,
      humanChecked: false,
      unitCheck: reason,
    });
  }

  const index = {
    catalogueYear: YEAR,
    humanChecked: false,
    note: "AI Applications as a specialization of the CSBA major is not in this index. It was not found under that name. The Artificial Intelligence Applications minor is a separate catalogue program and is not a substitute for it.",
    notFoundAsNamed: list.notFoundAsNamed,
    programs: indexRows,
  };
  writeFileSync(path.join(ROOT, "data/programs/index.json"), `${JSON.stringify(index, null, 2)}\n`);
  return { programs, index, codes };
}

function courseUrl(coid: string): string {
  return `https://catalogue.usc.edu/preview_course_nopop.php?catoid=22&coid=${coid}`;
}

function offeringsFor(termsText: string | null): { offerings: TermOffering[]; confirmed: boolean } {
  if (!termsText) return { offerings: ["irregular"], confirmed: false };
  return offeringsFrom(termsText);
}

function unitsFor(unitsText: string): number {
  const match = /(\d+(?:\.\d+)?)/.exec(unitsText);
  return match ? Number(match[1]) : 0;
}

export function buildCourses(codes: Set<string>): Course[] {
  const byCode = new Map<string, { coid: string; html: string }>();
  const files = readdirSync(COURSE_CACHE).filter((name) => name.endsWith(".html"));
  for (const file of files) {
    const html = readFileSync(path.join(COURSE_CACHE, file), "utf8");
    const coid = /coid[_=](\d+)/.exec(file)?.[1] ?? "";
    const raw = parseRawCourse(html, coid);
    if (!raw.code || raw.code === "Catalogue") continue;
    if (!byCode.has(raw.code)) byCode.set(raw.code, { coid, html });
  }
  const codeFor = new Map<string, string>();
  for (const [code, found] of byCode) codeFor.set(found.coid, code);

  const courses: Course[] = [];
  for (const code of [...codes].sort()) {
    const found = byCode.get(code);
    if (!found) continue;
    const raw = parseRawCourse(found.html, found.coid);
    const lookup = (coid: string) => codeFor.get(coid) ?? null;
    let prerequisites: PrerequisiteExpr | null = null;
    if (raw.prerequisiteMarked) {
      prerequisites = parseCourseExpression(raw.prerequisiteMarked, lookup);
    }
    const corequisites: string[] = [];
    if (raw.corequisiteMarked) {
      const parsed = parseCourseExpression(raw.corequisiteMarked, lookup);
      const collect = (expr: PrerequisiteExpr | null) => {
        if (!expr) return;
        if (expr.type === "course") corequisites.push(expr.code);
        else expr.children.forEach(collect);
      };
      collect(parsed);
    }
    const terms = offeringsFor(raw.termsText);
    const sourceText = [
      `${raw.code} ${raw.title}`,
      `Units: ${raw.unitsText || "not printed"}`,
      raw.termsText ? `Terms Offered: ${raw.termsText}` : "Terms Offered: not printed on this page",
      raw.prerequisiteText ? `Prerequisite: ${raw.prerequisiteText}` : "Prerequisite: none printed",
      raw.corequisiteText ? `Corequisite: ${raw.corequisiteText}` : "",
      !terms.confirmed ? "Term offerings are unconfirmed." : "",
      prerequisites === null && raw.prerequisiteText ? "The prerequisite sentence did not become a complete boolean tree." : "",
    ]
      .filter(Boolean)
      .join(" ");
    const [dept, number] = raw.code.split(" ");
    courses.push({
      code: raw.code,
      title: raw.title,
      units: unitsFor(raw.unitsText),
      dept,
      level: Math.floor(Number(number.replace(/\D/g, "")) / 100) * 100,
      prerequisites,
      corequisites,
      offerings: terms.offerings,
      source: { url: courseUrl(found.coid), catalogueYear: YEAR, text: sourceText },
    });
  }
  writeFileSync(path.join(ROOT, "data/courses.json"), `${JSON.stringify(courses, null, 2)}\n`);
  return courses;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const { codes } = buildPrograms();
  const courses = buildCourses(codes);
  console.log(`programs written, ${codes.size} course codes, ${courses.length} course records`);
  const missing = [...codes].filter((code) => !courses.some((course) => course.code === code));
  if (missing.length) console.log("missing course pages:", missing.join(", "));
}
