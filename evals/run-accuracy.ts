/**
 * CI regression runner for the hand audits.
 *
 * `npm run hand-accuracy` rewrites evals/hand-accuracy.json, evals/REPORT.md, and the
 * pitch table. `npm run hand-accuracy -- --check` fails when those files would change.
 * `npm run accuracy` is the separate catalogue-diff runner and owns evals/accuracy.json.
 * The engine is called and not modified.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { audit, planTerms } from "@/lib/engine";
import type { Course, PolicyRule, Program, RequirementNode, StudentCourse, StudentRecord } from "@/lib/types";
import { forcedCodes, type Atom } from "./atoms";
import { checkPlan } from "./hand-plan";
import { handProgram } from "./hand-rules";
import { loadTierPages } from "./page-tree";
import {
  allowedCodes,
  catalogueUnits,
  choiceLeaks,
  countedCourses,
  covers,
  floorFor,
  majorCodes,
  prereqClosure,
} from "./reference";

interface Row {
  program: string;
  checks: number;
  passed: number;
  accuracy: string;
  invented: number;
  choiceLeaks: number;
  gradeFaults: number;
  planFaults: number;
}

interface Defect {
  rank: number;
  id: string;
  severity: string;
  programs: string;
  summary: string;
  reproduction: string;
}

interface StarRow {
  student: string;
  program: string;
  pass: string;
  mustRemain: string;
  mustNotRemain: string;
  engineRemaining: string;
}

interface Report {
  rows: Row[];
  defects: Defect[];
  stars: StarRow[];
}

const root = process.cwd();

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function programs(): Program[] {
  const dir = join(root, "data/programs");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json") && name !== "index.json")
    .map((name) => loadJson<Program>(join(dir, name)));
}

function courseNodeIds(node: RequirementNode, code: string, out: string[] = []): string[] {
  if (node.type === "course" && node.code === code) out.push(node.id);
  else if (node.type === "all_of") node.children.forEach((child) => courseNodeIds(child, code, out));
  else if (node.type === "n_of") node.options.forEach((child) => courseNodeIds(child, code, out));
  return out;
}

function record(id: string, programId: string, courses: StudentCourse[], school: string): StudentRecord {
  return {
    id,
    label: id,
    school,
    startYear: 2023,
    startTerm: "2023-fall",
    catalogueYear: "2026-2027",
    majorId: programId,
    declaredProgramIds: [programId],
    courses,
  };
}

function taken(code: string, grade: string | null, status: StudentCourse["status"], term: string, units = 4): StudentCourse {
  return { code, units, grade, term, status };
}

function schoolOf(program: Program): string {
  return program.school;
}

function optionalCodes(atom: Atom): Set<string> {
  const codes = new Set<string>();
  const walk = (node: Atom) => {
    if (node.type === "optional") node.codes.forEach((code) => codes.add(code));
    else if (node.type === "all") node.of.forEach(walk);
    else if (node.type === "one" || node.type === "n") node.options.forEach(walk);
  };
  walk(atom);
  return codes;
}

function inventedCodes(atom: Atom, remaining: readonly string[], catalogue: readonly Course[]): string[] {
  const allowed = allowedCodes(atom, catalogue);
  const relevant = new Set([...remaining, ...forcedCodes(atom)].filter((code) => allowed.has(code)));
  const closed = prereqClosure(relevant, catalogue);
  return remaining.filter((code) => !allowed.has(code) && !closed.has(code)).sort();
}

function sentenceMismatch(description: string, pageCodes: ReadonlySet<string>): string[] {
  const sentence = description.match(/A grade of C \(2\.0\) or better is required for each of the core courses [^.]+\./)?.[0] ?? "";
  const codes = sentence.match(/[A-Z]{2,8}\s+\d{3}[A-Za-z]{0,4}/g) ?? [];
  return [...new Set(codes.filter((code) => !pageCodes.has(code)))];
}

function nodeOpen(program: Program, result: { requirements: { nodeId: string; satisfied: boolean }[] }, code: string): boolean | null {
  const ids = courseNodeIds(program.requirements, code);
  if (ids.length === 0) return null;
  return result.requirements.some((status) => ids.includes(status.nodeId) && !status.satisfied);
}

function retakeAttack(catalogue: readonly Course[], rules: readonly PolicyRule[], stored: Map<string, Program>): string {
  const program = stored.get("computer-science-business-administration-bs");
  if (!program) return "";
  const filler = catalogue.filter((course) => course.units > 0 && course.units <= 2 && course.code !== "CSCI 104L").slice(0, 20);
  const student = record(
    "retake-104",
    program.id,
    [
      taken("CSCI 104L", "C-", "completed", "2025-spring"),
      ...filler.map((course, index) => taken(course.code, "A", "completed", index % 2 === 0 ? "2024-fall" : "2025-fall", course.units)),
    ],
    program.school,
  );
  const result = audit(student, program, catalogue, rules);
  const plan = planTerms(student, [program], catalogue, rules);
  const listed = result.coursesRemaining.includes("CSCI 104L");
  const placed = plan.terms.some((term) => term.courses.some((course) => course.code === "CSCI 104L"));
  if (listed && !placed) {
    return "Computer Science/Business Administration: CSCI 104L with C-, plus 20 other completed courses of at most 2 units, stays in coursesRemaining and is not placed on the plan.";
  }
  return "";
}

export function buildReport(): Report {
  const catalogue = loadJson<Course[]>(join(root, "data/courses.json"));
  const rules = loadJson<PolicyRule[]>(join(root, "data/policy-rules.json"));
  const stored = new Map(programs().map((program) => [program.id, program]));
  const samples = loadJson<StudentRecord[]>(join(root, "data/samples/students.json"));
  const units = catalogueUnits(catalogue);
  const pages = loadTierPages(root);
  const rows: Row[] = [];
  const defects: Defect[] = [];
  const stars: StarRow[] = [];
  const inventedPrograms: string[] = [];
  const leakPrograms: string[] = [];
  const hiddenPrograms: string[] = [];
  const consumedPrograms: string[] = [];
  const countedBadPrograms: string[] = [];
  const optionalPrograms: string[] = [];
  const transferPrograms: string[] = [];
  const repeatPrograms: string[] = [];
  const offeringPrograms: string[] = [];
  const mismatchPrograms: string[] = [];
  const researchOpen = { open: false, detail: "" };
  const inProgressLines: string[] = [];
  let retakeDetail = "";

  for (const page of pages) {
    const hand = handProgram(page);
    const program = stored.get(hand.id);
    if (!program) throw new Error(`Missing stored program ${hand.id}`);
    const major = majorCodes(hand.root);
    const checks: { name: string; pass: boolean }[] = [];
    const empty = record("empty", hand.id, [], schoolOf(program));
    const emptyAudit = audit(empty, program, catalogue, rules);
    const emptyPlan = planTerms(empty, [program], catalogue, rules);
    const emptyHave = new Set(emptyAudit.coursesRemaining);
    const studentUnits = new Map<string, number>();
    const unitsOf = (code: string) => Math.max(units(code), studentUnits.get(code) ?? 0);

    const covered = covers(hand.root, emptyHave, unitsOf, catalogue);
    checks.push({ name: "empty-covers", pass: covered });
    const invented = inventedCodes(hand.root, emptyAudit.coursesRemaining, catalogue);
    checks.push({ name: "empty-invented", pass: invented.length === 0 });
    if (invented.length > 0) inventedPrograms.push(`${hand.id} (${invented.slice(0, 6).join(", ")})`);
    const leaks = choiceLeaks(hand.root, new Set(), new Set(emptyAudit.coursesRemaining));
    checks.push({ name: "empty-choice", pass: leaks.length === 0 });
    if (leaks.length > 0) leakPrograms.push(`${hand.id} (${leaks.slice(0, 6).join(", ")})`);
    const optional = invented.filter((code) => optionalCodes(hand.root).has(code));
    if (optional.length > 0) optionalPrograms.push(`${hand.id} (${optional.slice(0, 6).join(", ")})`);

    const mismatched = sentenceMismatch(page.description, new Set(page.codes));
    checks.push({ name: "grade-codes", pass: mismatched.length === 0 });
    if (mismatched.length > 0) mismatchPrograms.push(`${hand.id}: ${mismatched.join(", ")}`);

    let gradeFaults = 0;
    if (hand.grade) {
      const code = hand.grade.scope === "named" ? hand.grade.codes[0] : "BISC 421";
      const bad = hand.grade.minimum === "C" ? "C-" : "D";
      const courseUnits = units(code) || 4;
      const passing = audit(
        record("passing", hand.id, [taken(code, "A", "completed", "2024-fall", courseUnits)], schoolOf(program)),
        program,
        catalogue,
        rules,
      );
      const passingOpen = nodeOpen(program, passing, code);
      checks.push({ name: "passing-grade", pass: passingOpen === false });
      if (passingOpen !== false) {
        gradeFaults += 1;
        consumedPrograms.push(`${hand.id} ${code} A`);
      } else {
        const graded = record("grade", hand.id, [taken(code, bad, "completed", "2024-fall", courseUnits)], schoolOf(program));
        const gradedAudit = audit(graded, program, catalogue, rules);
        const open = nodeOpen(program, gradedAudit, code) === true;
        const visible = gradedAudit.coursesRemaining.includes(code);
        checks.push({ name: "grade-node", pass: open });
        checks.push({ name: "grade-visible", pass: visible });
        if (!open) {
          gradeFaults += 1;
          countedBadPrograms.push(`${hand.id} ${code} ${bad}`);
        }
        if (open && !visible) {
          gradeFaults += 1;
          hiddenPrograms.push(`${hand.id} ${code} ${bad}`);
        }
        if (open && visible) {
          const gradedPlan = planTerms(graded, [program], catalogue, rules);
          const placed = gradedPlan.terms.some((term) => term.courses.some((course) => course.code === code));
          checks.push({ name: "grade-retake", pass: placed });
          if (!placed && !retakeDetail) {
            retakeDetail = `${hand.id}: ${code} with ${bad} is still required and stays off the plan.`;
          }
        }
        if (hand.grade.minimum === "C") {
          const transferAudit = audit(
            record("transfer", hand.id, [taken(code, "TR", "ap", "2023-spring", courseUnits)], schoolOf(program)),
            program,
            catalogue,
            rules,
          );
          const transferOpen = nodeOpen(program, transferAudit, code) === true;
          checks.push({ name: "transfer-ap", pass: !transferOpen });
          if (transferOpen) transferPrograms.push(`${hand.id} ${code}`);
          const repeatAudit = audit(
            record(
              "repeat",
              hand.id,
              [taken(code, "A", "completed", "2024-fall", courseUnits), taken(code, "F", "completed", "2025-spring", courseUnits)],
              schoolOf(program),
            ),
            program,
            catalogue,
            rules,
          );
          const repeatOpen = nodeOpen(program, repeatAudit, code) === true;
          checks.push({ name: "repeat-f", pass: repeatOpen });
          if (!repeatOpen) repeatPrograms.push(`${hand.id} ${code}`);
        }
      }
    }

    const planHave = new Set<string>([
      ...countedCourses(empty.courses, hand.grade, major).map((course) => course.code),
      ...emptyPlan.terms.flatMap((term) => term.courses.map((course) => course.code)),
    ]);
    const planCovers = covers(hand.root, planHave, unitsOf, catalogue);
    checks.push({ name: "plan-covers", pass: planCovers });
    const planInvented = inventedCodes(
      hand.root,
      emptyPlan.terms.flatMap((term) => term.courses.map((course) => course.code)),
      catalogue,
    );
    checks.push({ name: "plan-invented", pass: planInvented.length === 0 });
    const faults = checkPlan({
      plan: emptyPlan,
      courses: catalogue,
      studentCourses: empty.courses,
      stillNeeded: forcedCodes(hand.root),
      assumptionText: emptyPlan.assumptions.map((item) => item.text).join(" "),
    });
    const structural = faults.filter((fault) => !["unconfirmed-offering", "unparsed-prerequisite"].includes(fault.kind));
    checks.push({ name: "plan-structure", pass: structural.length === 0 });
    const offerings = faults.filter((fault) => fault.kind === "unconfirmed-offering");
    checks.push({ name: "plan-offering", pass: offerings.length === 0 });
    if (offerings.length > 0) offeringPrograms.push(hand.id);
    if (hand.id === "quantitative-biology-bs" && !planCovers) {
      researchOpen.open = true;
      researchOpen.detail = `Empty plan courses include ${emptyPlan.terms
        .flatMap((term) => term.courses.map((course) => course.code))
        .filter((code) => code.startsWith("QBIO 49"))
        .join(", ") || "(no QBIO 49x)"}. Catalogue units for QBIO 490x are ${units("QBIO 490x")}.`;
    }

    const sample = samples.find((student) => student.declaredProgramIds.includes(hand.id));
    if (sample) {
      const sampleAudit = audit(sample, program, catalogue, rules);
      const sampleCounted = countedCourses(sample.courses, hand.grade, major);
      for (const course of sampleCounted) studentUnits.set(course.code, course.units);
      const sampleUnits = (code: string) => Math.max(units(code), studentUnits.get(code) ?? 0);
      const sampleHave = new Set([...sampleCounted.map((course) => course.code), ...sampleAudit.coursesRemaining]);
      const sampleCovers = covers(hand.root, sampleHave, sampleUnits, catalogue);
      const sampleInvented = inventedCodes(hand.root, sampleAudit.coursesRemaining, catalogue);
      const expect = starExpect(sample.id, hand.id);
      const missing = expect.must.filter((code) => !sampleAudit.coursesRemaining.includes(code));
      const forbidden = expect.mustNot.filter((code) => sampleAudit.coursesRemaining.includes(code));
      const pass = sampleCovers && sampleInvented.length === 0 && missing.length === 0 && forbidden.length === 0;
      checks.push({ name: "stars", pass });
      stars.push({
        student: sample.id,
        program: hand.id,
        pass: pass ? "pass" : "fail",
        mustRemain: missing.length === 0 ? expect.must.join(", ") : `missing ${missing.join(", ")}`,
        mustNotRemain: forbidden.length === 0 ? "none of the forbidden codes" : forbidden.join(", "),
        engineRemaining: sampleAudit.coursesRemaining.join(", "),
      });
      const progress = sample.courses.find((course) => course.status === "in_progress" && floorFor(hand.grade, course.code, major));
      if (progress) {
        const progressPlan = planTerms(sample, [program], catalogue, rules);
        const placed = progressPlan.terms.some((term) => term.courses.some((course) => course.code === progress.code));
        const listed = sampleAudit.coursesRemaining.includes(progress.code);
        const open = nodeOpen(program, sampleAudit, progress.code);
        checks.push({ name: "in-progress", pass: listed && placed });
        inProgressLines.push(
          `${sample.id} ${progress.code} is in progress. The requirement node is open: ${open === true}. Remaining includes it: ${listed}. The plan places it: ${placed}.`,
        );
      }
      const completedOpen = sampleCounted.filter((course) => forcedCodes(hand.root).includes(course.code) && nodeOpen(program, sampleAudit, course.code) === true);
      checks.push({ name: "completed-applied", pass: completedOpen.length === 0 });
      if (completedOpen.length > 0) {
        consumedPrograms.push(`${sample.id} ${completedOpen.map((course) => course.code).join(", ")}`);
      }
    }

    const passed = checks.filter((check) => check.pass).length;
    rows.push({
      program: program.name,
      checks: checks.length,
      passed,
      accuracy: percent(passed, checks.length),
      invented: invented.length,
      choiceLeaks: leaks.length,
      gradeFaults,
      planFaults: structural.length + offerings.length + (planCovers ? 0 : 1) + planInvented.length,
    });
  }

  if (!retakeDetail) retakeDetail = retakeAttack(catalogue, rules, stored);
  const ranked: Omit<Defect, "rank">[] = [];
  if (inventedPrograms.length > 0) {
    ranked.push({
      id: "invented-courses",
      severity: "high",
      programs: inventedPrograms.join("; "),
      summary:
        "A block with no course list is stored as a course set that matches every catalogue course. The audit then schedules courses that are not on the program page, including 1-unit research courses, and those courses can hide a real requirement from coursesRemaining.",
      reproduction:
        "Audit an empty Computer Science (BS) record. coursesRemaining includes BISC 193, BISC 199, NEUR 199, and QBIO 490x. None of those codes is printed on the computer science page. Give that student only CSCI 102L with A. Node computer-science-bs-27 stays unsatisfied, coursesRemaining omits CSCI 102L, and the general-education set computer-science-bs-4-prose lists CSCI 102L as applied. The same shape holds for C-.",
    });
  }
  if (consumedPrograms.length > 0) {
    ranked.push({
      id: "passing-grade-consumed",
      severity: "high",
      programs: [...new Set(consumedPrograms)].join("; "),
      summary:
        "A passing grade on a named requirement is applied to an open placeholder set, so the named node stays unsatisfied and the course disappears from coursesRemaining.",
      reproduction: `An A, or a completed fixture course, leaves the named node open for: ${[...new Set(consumedPrograms)].join("; ")}.`,
    });
  }
  if (hiddenPrograms.length > 0) {
    ranked.push({
      id: "grade-hidden",
      severity: "high",
      programs: hiddenPrograms.join("; "),
      summary: "A course below the printed C floor is rejected by its own node and then removed from coursesRemaining by another set.",
      reproduction: `Programs: ${hiddenPrograms.join("; ")}. The node note says the course is still needed. coursesRemaining does not list it.`,
    });
  }
  if (retakeDetail) {
    ranked.push({
      id: "retake-not-planned",
      severity: "high",
      programs: retakeDetail,
      summary: "A finished course below the printed floor is treated as already done by the planner, so the required repeat is not scheduled.",
      reproduction: retakeDetail,
    });
  }
  if (countedBadPrograms.length > 0) {
    ranked.push({
      id: "grade-floor-missing",
      severity: "high",
      programs: countedBadPrograms.join("; "),
      summary: "A printed C or C- floor is not applied, so a D or C- satisfies the requirement node.",
      reproduction: `The requirement node is satisfied for: ${countedBadPrograms.join("; ")}.`,
    });
  }
  if (optionalPrograms.length > 0) {
    ranked.push({
      id: "optional-required",
      severity: "high",
      programs: optionalPrograms.join("; "),
      summary: "A list the page says may be substituted, or an honors pair, is scheduled as if it were required.",
      reproduction: `Empty audits still list: ${optionalPrograms.join("; ")}.`,
    });
  }
  if (leakPrograms.length > 0) {
    ranked.push({
      id: "choice-leak",
      severity: "high",
      programs: leakPrograms.join("; "),
      summary: "A choose-one group, including a nested or inside a track, leaves more than one option on the remaining list.",
      reproduction: `Empty remaining lists both sides for: ${leakPrograms.join("; ")}.`,
    });
  }
  if (researchOpen.open) {
    ranked.push({
      id: "research-units",
      severity: "high",
      programs: "quantitative-biology-bs",
      summary:
        "Quantitative Biology asks for 6 units of research. QBIO 490x is stored as 1 unit, and the plan adds the honors courses QBIO 493 and QBIO 494, which the page requires only of honors students. The scheduled research is still short of 6 units.",
      reproduction: researchOpen.detail,
    });
  }
  if (transferPrograms.length > 0) {
    ranked.push({
      id: "transfer-ap",
      severity: "medium",
      programs: transferPrograms.join("; "),
      summary: "AP credit posted as TR does not satisfy a printed C floor, so a core the student already has stays open.",
      reproduction: `An AP row with grade TR leaves the core node open for: ${transferPrograms.join("; ")}.`,
    });
  }
  if (repeatPrograms.length > 0) {
    ranked.push({
      id: "repeat-f",
      severity: "medium",
      programs: repeatPrograms.join("; "),
      summary: "A later F is dropped because F rows do not count, so an earlier A still satisfies the course after a failed repeat.",
      reproduction: `A then F still satisfies the node for: ${repeatPrograms.join("; ")}.`,
    });
  }
  if (inProgressLines.length > 0) {
    ranked.push({
      id: "in-progress",
      severity: "medium",
      programs: inProgressLines.join(" "),
      summary:
        "An in-progress course with a printed floor is omitted from coursesRemaining and from the plan. On a tree with no stored floor the course is counted as done. On a tree with a floor the node stays open and another set hides the code.",
      reproduction: inProgressLines.join(" "),
    });
  }
  if (offeringPrograms.length > 0) {
    ranked.push({
      id: "unconfirmed-offering",
      severity: "medium",
      programs: offeringPrograms.join(", "),
      summary: "A course whose catalogue page does not print a term is stored as irregular and then placed in a specific fall or spring.",
      reproduction: `Empty plans place an irregular course for: ${offeringPrograms.join(", ")}.`,
    });
  }
  if (mismatchPrograms.length > 0) {
    ranked.push({
      id: "grade-code-mismatch",
      severity: "medium",
      programs: mismatchPrograms.join("; "),
      summary: "The grade sentence names a course code the course list does not print.",
      reproduction: mismatchPrograms.join("; "),
    });
  }
  defects.push(
    ...ranked.map((defect, index) => ({ ...defect, rank: index + 1 })),
  );
  return { rows, defects, stars };
}

function starExpect(studentId: string, programId: string): { must: string[]; mustNot: string[] } {
  const key = `${studentId}:${programId}`;
  const table: Record<string, { must: string[]; mustNot: string[] }> = {
    "sample-early-cs:computer-science-bs": {
      must: ["CSCI 103L", "CSCI 104L", "CSCI 170", "CSCI 201", "MATH 125g", "WRIT 340", "EE 109L"],
      mustNot: ["CSCI 102L", "WRIT 150", "BISC 193", "NEUR 199"],
    },
    "sample-mid-neuro:computational-neuroscience-bs": {
      must: ["BISC 220Lg", "MATH 125g", "NEUR 199", "PSYC 100Lg", "BISC 421"],
      mustNot: ["CHEM 105aLg", "QBIO 305g", "TAC 115", "TAC 116", "BME 502", "CSCI 561"],
    },
    "sample-mid-neuro:artificial-intelligence-applications-minor": {
      must: ["TAC 216", "TAC 259", "TAC 359", "TAC 459"],
      mustNot: ["TAC 115", "CSCI 113x"],
    },
    "sample-late-csba:computer-science-business-administration-bs": {
      must: ["CSCI 201", "CSCI 270", "CSCI 310", "CSCI 401", "MATH 125g", "ACCT 410x"],
      mustNot: ["CSCI 102L", "CSCI 103L", "CSCI 104L", "CSCI 170", "WRIT 150", "WRIT 340", "BISC 193"],
    },
    "sample-late-csba:law-and-regulation-of-artificial-intelligence-minor": {
      must: ["LAW 306"],
      mustNot: ["LAW 210p", "TAC 115"],
    },
  };
  return table[key] ?? { must: [], mustNot: [] };
}

function filedIssue(id: string): string {
  const filed: Record<string, string> = {
    "invented-courses": "Filed as #31.",
    "passing-grade-consumed": "Filed as #31.",
    "retake-not-planned": "Filed as #32.",
    "grade-floor-missing": "Filed as #34.",
    "optional-required": "Already filed as #12 and #14.",
    "choice-leak": "Computer Science is #37. Computational Neuroscience, Computer Engineering, and CSBA are #15, #16, and #17.",
    "research-units": "Filed as #36. The capstone pair is #20.",
    "repeat-f": "Filed as #33.",
    "in-progress": "Filed as #35.",
    "unconfirmed-offering": "Already filed as #11.",
    "grade-code-mismatch": "Already filed as #22, #23, and #24.",
  };
  return filed[id] ?? "";
}

function percent(passed: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((passed / total) * 100)}%`;
}

function markdown(report: Report): string {
  const passed = report.rows.reduce((sum, row) => sum + row.passed, 0);
  const total = report.rows.reduce((sum, row) => sum + row.checks, 0);
  const lines = [
    "# Independent check",
    "",
    "Tier 1 is the twelve programs with `selected: true` in `data/programs/index.json`. Neuroscience (BA) is stored and is not in this table. The rules were read from the saved 2026-2027 catalogue pages. `data/programs` was used only as the tree the engine audits. No person has set `humanChecked`. STARS remains the official audit.",
    "",
    `Overall: ${passed} of ${total} checks passed (${percent(passed, total)}).`,
    "",
    "## Accuracy",
    "",
    "| Program | Checks | Passed | Accuracy | Invented courses | Choice leaks | Grade faults | Plan faults |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.rows.map(
      (row) =>
        `| ${row.program} | ${row.checks} | ${row.passed} | ${row.accuracy} | ${row.invented} | ${row.choiceLeaks} | ${row.gradeFaults} | ${row.planFaults} |`,
    ),
    "",
    "## Synthetic STARS fixtures",
    "",
    "The three records are `data/samples/students.json`, built from `fixtures/stars/early.txt`, `fixtures/stars/mid.txt`, and `fixtures/stars/late.txt`. A row fails when a hand-required code is missing, a forbidden code is still remaining, the remaining list invents an off-page course, or the remaining list does not cover the hand rule.",
    "",
    "| Student | Program | Result | Must remain | Must not remain |",
    "| --- | --- | --- | --- | --- |",
    ...report.stars.map(
      (row) => `| ${row.student} | ${row.program} | ${row.pass} | ${row.mustRemain} | ${row.mustNotRemain} |`,
    ),
    "",
    "## Defects",
    "",
    "Ranked by how far a remaining list or a plan can move a student off the catalogue. Reproduce with `npm run hand-accuracy`.",
    "",
    ...report.defects.flatMap((defect) => [
      `### ${defect.rank}. ${defect.summary}`,
      "",
      `Severity: ${defect.severity}. Id: \`${defect.id}\`. ${filedIssue(defect.id)}`,
      "",
      defect.reproduction,
      "",
    ]),
    "## Already filed",
    "",
    "New issues from this check are #31 through #37. These observations were already open and are not filed again: #7, #8, #9, and #10 (a C- core disappears from coursesRemaining), #11 (a course with no printed term is placed in a semester), #12 and #14 (a graduate list the page says may be substituted is required), #15, #16, and #17 (one side of an or still leaves the other side remaining), #18 (neuroscience physics pairs missing from an empty audit), #19 (BISC 199 and NEUR 199 share a title), #20 (the quantitative biology capstone pair is not on the plan), and #22, #23, and #24 (the grade sentence names CSCI 103 and CSCI 104).",
    "",
    "## Attacks that did not contradict the saved pages",
    "",
    "BISC 199 and NEUR 199 share the title Neuroscience Colloquium. The saved course text does not say they are cross-listed. A computational neuroscience student with BISC 199 and an A still has NEUR 199 remaining. The engine has no cross-list field. That is an observation, not a counted failure.",
    "",
    "The Artificial Intelligence Applications minor nested choice, CSCI 113x or the TAC 115/TAC 116 pair plus TAC 216, matches the mid fixture: TAC 115 is not remaining and TAC 216 is.",
    "",
    "## Plan checker",
    "",
    "The plan checker does not call the scheduler. It checks term order, the 18-unit recommended maximum, duplicate courses, parsed prerequisites, corequisites, printed offerings, zero-unit assumptions, and whether the planned courses cover the hand rule. A course with no printed term is a fault when the plan gives it a semester.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function pitch(report: Report): string {
  const passed = report.rows.reduce((sum, row) => sum + row.passed, 0);
  const total = report.rows.reduce((sum, row) => sum + row.checks, 0);
  return [
    "# Accuracy",
    "",
    `Hand check of the twelve Tier 1 programs against the saved 2026-2027 catalogue. ${passed} of ${total} checks passed (${percent(passed, total)}). No person has set humanChecked. STARS remains the official audit.`,
    "",
    "| Program | Checks | Passed | Accuracy | Invented courses | Choice leaks | Grade faults | Plan faults |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.rows.map(
      (row) =>
        `| ${row.program} | ${row.checks} | ${row.passed} | ${row.accuracy} | ${row.invented} | ${row.choiceLeaks} | ${row.gradeFaults} | ${row.planFaults} |`,
    ),
    "",
    "The full defect list and the STARS rows are in `evals/REPORT.md`.",
    "",
  ].join("\n");
}

function writeReport(check: boolean): void {
  const report = buildReport();
  const accuracyPath = join(root, "evals/hand-accuracy.json");
  const reportPath = join(root, "evals/REPORT.md");
  const pitchPath = join(root, "docs/submission/pitch.md");
  const accuracy = `${JSON.stringify(report.rows, null, 2)}\n`;
  const body = markdown(report);
  const pitchBody = pitch(report);
  if (check) {
    const same =
      readFileSync(accuracyPath, "utf8") === accuracy &&
      readFileSync(reportPath, "utf8") === body &&
      readFileSync(pitchPath, "utf8") === pitchBody;
    if (!same) {
      throw new Error("evals/hand-accuracy.json, evals/REPORT.md, or docs/submission/pitch.md is stale. Run npm run hand-accuracy.");
    }
    return;
  }
  writeFileSync(accuracyPath, accuracy);
  writeFileSync(reportPath, body);
  writeFileSync(pitchPath, pitchBody);
}

if (process.argv[1]?.endsWith("run-accuracy.ts")) {
  writeReport(process.argv.includes("--check"));
}

export { writeReport };
