/**
 * One-shot writer for the DEMO fixtures. Run with `node fixtures/generate.mjs`.
 * Outputs JSON that lib/types validates. Not part of the app runtime.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const year = "2026-2027";

function source(path, text) {
  return {
    url: `https://example.edu/demo-catalogue/2026/${path}`,
    catalogueYear: year,
    text,
  };
}

function req(partial, text) {
  return {
    verified: false,
    source: source(`requirements/${partial.id}`, text),
    ...partial,
  };
}

const courseSpec = [
  ["DEMO 101", "Introduction to Widgets", 4, null, ["fall", "spring"]],
  ["DEMO 102", "Widget Studio", 2, { type: "course", code: "DEMO 101" }, ["fall", "spring"]],
  ["DEMO 110", "Discrete Gadgets", 4, null, ["fall", "spring"]],
  ["DEMO 120", "Gadget Laboratory", 2, { type: "course", code: "DEMO 110" }, ["spring"]],
  ["DEMO 130", "Linear Planks", 4, { type: "course", code: "DEMO 101" }, ["fall", "spring"]],
  ["DEMO 140", "Plank Laboratory", 2, { type: "course", code: "DEMO 130" }, ["fall"]],
  ["DEMO 150", "Proofs for Widgets", 4, { type: "course", code: "DEMO 110" }, ["fall"]],
  ["DEMO 160", "Widget Writing", 4, null, ["fall", "spring", "summer"]],
  ["DEMO 201", "Widget Structures", 4, { type: "course", code: "DEMO 101" }, ["fall", "spring"]],
  ["DEMO 202", "Structures Laboratory", 2, { type: "course", code: "DEMO 201" }, ["fall", "spring"]],
  ["DEMO 210", "Widget Policy", 4, { type: "course", code: "DEMO 101" }, ["fall"]],
  ["DEMO 220", "Rules of Assembly", 3, { type: "course", code: "DEMO 210" }, ["spring"]],
  ["DEMO 230", "Public Gadgets", 3, { type: "course", code: "DEMO 210" }, ["fall"]],
  ["DEMO 240", "Ethics of Automation", 3, { type: "course", code: "DEMO 160" }, ["spring", "summer"]],
  ["DEMO 250", "Counting Arguments", 4, { type: "all_of", children: [{ type: "course", code: "DEMO 110" }, { type: "course", code: "DEMO 130" }] }, ["fall"]],
  ["DEMO 260", "Probability for Demos", 4, { type: "course", code: "DEMO 130" }, ["spring"]],
  ["DEMO 270", "Graphical Widgets", 4, { type: "course", code: "DEMO 201" }, ["fall"]],
  ["DEMO 280", "Systems Survey", 4, { type: "all_of", children: [{ type: "course", code: "DEMO 102" }, { type: "course", code: "DEMO 110" }] }, ["spring"]],
  ["DEMO 301", "Applied Widget Design", 4, { type: "course", code: "DEMO 201" }, ["fall", "spring"]],
  ["DEMO 310", "Design Critique", 2, { type: "course", code: "DEMO 301" }, ["spring"]],
  ["DEMO 320", "Operating Gadgets", 4, { type: "all_of", children: [{ type: "course", code: "DEMO 201" }, { type: "course", code: "DEMO 110" }] }, ["fall"]],
  ["DEMO 330", "Gadget Networks", 4, { type: "course", code: "DEMO 320" }, ["spring"]],
  ["DEMO 340", "Compiled Widgets", 4, { type: "course", code: "DEMO 201" }, ["fall"]],
  ["DEMO 350", "Widget Runtimes", 4, { type: "course", code: "DEMO 340" }, ["spring"]],
  ["DEMO 360", "Capstone Studio I", 4, { type: "course", code: "DEMO 301" }, ["fall"]],
  ["DEMO 370", "Capstone Studio II", 4, { type: "course", code: "DEMO 360" }, ["spring"]],
  ["DEMO 380", "Data Widgets", 4, { type: "all_of", children: [{ type: "course", code: "DEMO 201" }, { type: "course", code: "DEMO 260" }] }, ["fall", "spring"]],
  ["DEMO 390", "Learning Gadgets", 4, { type: "n_of", minCount: 1, children: [{ type: "course", code: "DEMO 260" }, { type: "course", code: "DEMO 380" }] }, ["spring"]],
  ["DEMO 401", "Advanced Widget Theory", 4, { type: "course", code: "DEMO 301" }, ["fall"]],
  ["DEMO 410", "Widget Research", 4, { type: "all_of", children: [{ type: "course", code: "DEMO 301" }, { type: "course", code: "DEMO 250" }] }, ["spring"]],
  ["DEMO 420", "Secure Gadgets", 4, { type: "course", code: "DEMO 320" }, ["fall"]],
  ["DEMO 430", "Distributed Demos", 4, { type: "course", code: "DEMO 330" }, ["spring"]],
  ["DEMO 440", "Language Gadgets", 4, { type: "course", code: "DEMO 340" }, ["fall"]],
  ["DEMO 450", "Interface Systems", 4, { type: "course", code: "DEMO 280" }, ["spring"]],
  ["DEMO 460", "Policy Workshop", 4, { type: "all_of", children: [{ type: "course", code: "DEMO 220" }, { type: "course", code: "DEMO 230" }] }, ["fall"]],
  ["DEMO 470", "Field Methods", 4, { type: "course", code: "DEMO 210" }, ["spring", "summer"]],
  ["DEMO 480", "Irregular Topics", 2, { type: "course", code: "DEMO 301" }, ["irregular"]],
  ["DEMO 490", "Directed Demo", 2, { type: "course", code: "DEMO 401" }, ["fall", "spring", "summer"]],
  ["DEMO 495", "Honors Seminar", 2, { type: "course", code: "DEMO 301" }, ["fall"]],
  ["DEMO 499", "Honors Thesis", 4, { type: "course", code: "DEMO 495" }, ["spring"]],
];

if (courseSpec.length !== 40) {
  throw new Error(`expected 40 courses, got ${courseSpec.length}`);
}

const courses = courseSpec.map(([code, title, units, prerequisites, offerings]) => {
  const level = Math.floor(Number(code.slice(5, 8)) / 100) * 100;
  return {
    code,
    title,
    units,
    dept: "DEMO",
    level,
    prerequisites,
    corequisites: [],
    offerings,
    source: source(
      `courses/${code.toLowerCase().replace(" ", "-")}`,
      `Invented fixture, not a USC course: ${code} ${title} is ${units} units.`,
    ),
  };
});

const byCode = new Map(courses.map((course) => [course.code, course]));

function courseNode(id, code, constraints) {
  const course = byCode.get(code);
  return req(
    { type: "course", id, code, ...(constraints ? { constraints } : {}) },
    `Invented fixture: take ${code} ${course.title}.`,
  );
}

function programs() {
  const applied = {
    id: "demo-applied-widgets",
    name: "Applied Widgets",
    school: "School of Demonstration",
    kind: "major",
    description:
      "Invented fixture: students build a widget core and then choose two upper-division studios or a 400-level set.",
    catalogueYear: year,
    verified: false,
    humanChecked: false,
    source: source(
      "programs/applied-widgets",
      "Invented fixture: the Applied Widgets major requires the core sequence and a choose-two upper-division group.",
    ),
    requirements: req(
      {
        type: "all_of",
        id: "aw-all",
        children: [
          courseNode("aw-101", "DEMO 101"),
          courseNode("aw-201", "DEMO 201"),
          courseNode("aw-301", "DEMO 301"),
          req(
            {
              type: "n_of",
              id: "aw-choose",
              minCount: 2,
              minUnits: 8,
              options: [
                courseNode("aw-360", "DEMO 360"),
                courseNode("aw-370", "DEMO 370"),
                req(
                  {
                    type: "course_set",
                    id: "aw-400",
                    match: { dept: "DEMO", levelMin: 400 },
                    minCount: 1,
                    minUnits: 4,
                  },
                  "Invented fixture: one DEMO course at level 400 or above, at least 4 units, may fill this choice.",
                ),
              ],
            },
            "Invented fixture: choose two options totaling at least 8 units from the studios or a 400-level set.",
          ),
        ],
      },
      "Invented fixture: complete every child of the Applied Widgets major.",
    ),
  };

  const policy = {
    id: "demo-widget-policy",
    name: "Widget Policy",
    school: "College of Examples",
    kind: "minor",
    description:
      "Invented fixture: the Widget Policy minor studies rules of assembly and how gadgets meet a public rulebook.",
    catalogueYear: year,
    verified: false,
    humanChecked: false,
    source: source(
      "programs/widget-policy",
      "Invented fixture: the Widget Policy minor limits how many units may be shared with the major.",
    ),
    requirements: req(
      {
        type: "all_of",
        id: "wp-all",
        children: [
          courseNode("wp-210", "DEMO 210", { maxUnitsSharedWithMajor: 0 }),
          req(
            {
              type: "n_of",
              id: "wp-choose",
              minCount: 2,
              minUnits: 6,
              constraints: { minGrade: "C", maxUnitsSharedWithMajor: 4 },
              options: [
                courseNode("wp-220", "DEMO 220"),
                courseNode("wp-230", "DEMO 230"),
                courseNode("wp-240", "DEMO 240"),
              ],
            },
            "Invented fixture: choose two policy courses, at least 6 units, with at most 4 units shared with the major.",
          ),
          req(
            {
              type: "course_set",
              id: "wp-300",
              match: { dept: "DEMO", levelMin: 300, levelMax: 399 },
              minUnits: 4,
              constraints: { minGrade: "C" },
            },
            "Invented fixture: at least 4 units of DEMO courses numbered 300 through 399.",
          ),
        ],
      },
      "Invented fixture: complete every child of the Widget Policy minor.",
    ),
  };

  const systems = {
    id: "demo-widget-systems",
    name: "Widget Systems",
    school: "School of Demonstration",
    kind: "major",
    description:
      "Invented fixture: a second major path through operating gadgets or compiled widgets, plus a 400-level course.",
    catalogueYear: year,
    verified: false,
    humanChecked: false,
    source: source(
      "programs/widget-systems",
      "Invented fixture: Widget Systems requires a studio, a nested choice of two tracks, and a 400-level set.",
    ),
    requirements: req(
      {
        type: "all_of",
        id: "ws-all",
        children: [
          courseNode("ws-102", "DEMO 102"),
          courseNode("ws-110", "DEMO 110"),
          req(
            {
              type: "n_of",
              id: "ws-track",
              minCount: 1,
              options: [
                req(
                  {
                    type: "all_of",
                    id: "ws-operating",
                    children: [courseNode("ws-320", "DEMO 320"), courseNode("ws-330", "DEMO 330")],
                  },
                  "Invented fixture: the operating-gadgets track is DEMO 320 and DEMO 330.",
                ),
                req(
                  {
                    type: "all_of",
                    id: "ws-compiled",
                    children: [courseNode("ws-340", "DEMO 340"), courseNode("ws-350", "DEMO 350")],
                  },
                  "Invented fixture: the compiled-widgets track is DEMO 340 and DEMO 350.",
                ),
              ],
            },
            "Invented fixture: complete one of the two nested tracks.",
          ),
          req(
            {
              type: "course_set",
              id: "ws-400",
              match: { dept: "DEMO", levelMin: 400 },
              minCount: 1,
              minUnits: 4,
            },
            "Invented fixture: one DEMO course at level 400 or above.",
          ),
        ],
      },
      "Invented fixture: complete every child of the Widget Systems major.",
    ),
  };

  return [applied, policy, systems];
}

const programList = programs();

function taken(code, status, grade, term) {
  const course = byCode.get(code);
  if (!course) throw new Error(code);
  return { code, units: course.units, grade, term, status };
}

const students = [
  {
    id: "demo-nova",
    label: "Nova",
    school: "School of Demonstration",
    startYear: 2025,
    startTerm: "2025-fall",
    catalogueYear: year,
    majorId: "demo-applied-widgets",
    declaredProgramIds: ["demo-applied-widgets"],
    courses: [
      taken("DEMO 101", "completed", "A", "2025-fall"),
      taken("DEMO 102", "completed", "A-", "2025-fall"),
      taken("DEMO 201", "in_progress", null, "2026-spring"),
    ],
  },
  {
    id: "demo-quill",
    label: "Quill",
    school: "School of Demonstration",
    startYear: 2023,
    startTerm: "2023-fall",
    catalogueYear: year,
    majorId: "demo-applied-widgets",
    declaredProgramIds: ["demo-applied-widgets"],
    courses: [
      taken("DEMO 101", "completed", "A", "2023-fall"),
      taken("DEMO 102", "completed", "A-", "2023-fall"),
      taken("DEMO 110", "completed", "A", "2024-spring"),
      taken("DEMO 201", "completed", "A-", "2024-fall"),
      taken("DEMO 210", "completed", "B+", "2024-fall"),
      taken("DEMO 220", "completed", "A-", "2025-spring"),
      taken("DEMO 301", "completed", "A", "2025-spring"),
      taken("DEMO 360", "completed", "A", "2025-fall"),
      taken("DEMO 401", "completed", "B+", "2026-spring"),
      taken("DEMO 370", "in_progress", null, "2026-fall"),
    ],
  },
  {
    id: "demo-pebble",
    label: "Pebble",
    school: "School of Demonstration",
    startYear: 2022,
    startTerm: "2022-fall",
    catalogueYear: year,
    majorId: "demo-applied-widgets",
    declaredProgramIds: ["demo-applied-widgets"],
    courses: [
      taken("DEMO 101", "completed", "A", "2022-fall"),
      taken("DEMO 102", "completed", "A", "2022-fall"),
      taken("DEMO 110", "completed", "A-", "2023-spring"),
      taken("DEMO 201", "completed", "A", "2023-fall"),
      taken("DEMO 320", "completed", "A-", "2025-fall"),
      taken("DEMO 301", "in_progress", null, "2026-fall"),
    ],
  },
];

const policyRules = [
  {
    id: "demo-term-unit-cap",
    name: "DEMO term unit cap",
    summary: "Invented DEMO fixture cap of 16 units in a term. Not a USC rule.",
    value: 16,
    source: source(
      "policy/term-cap",
      "Invented fixture, not a USC rule: a DEMO term lists at most 16 units.",
    ),
    confirmed: true,
  },
  {
    id: "demo-minor-unique-units",
    name: "Units unique to a minor",
    summary: "TO SOURCE: how many units must be unique to a minor. Left unset in this fixture.",
    value: null,
    source: source(
      "policy/minor-unique-units",
      "TO SOURCE: units that must be unique to a minor. This fixture does not invent a number.",
    ),
    confirmed: false,
  },
  {
    id: "demo-catalogue-year",
    name: "Catalogue year for a continuing student",
    summary: "TO SOURCE: which catalogue year applies to a continuing student. Left unset.",
    value: null,
    source: source(
      "policy/catalogue-year",
      "TO SOURCE: which catalogue year applies to a continuing student.",
    ),
    confirmed: false,
  },
];

const transferRules = [
  {
    id: "transfer-school-of-demonstration",
    school: "School of Demonstration",
    summary:
      "Invented fixture: the School of Demonstration lists no extra coursework on this page. Not a USC rule.",
    prerequisiteCourses: [],
    gpaText: null,
    timingText: null,
    applicationSteps: [
      "Read the invented DEMO school page at example.edu. This step is not a USC process.",
    ],
    source: source(
      "transfer/school-of-demonstration",
      "Invented fixture, not a USC rule: the School of Demonstration publishes no extra prerequisite courses.",
    ),
    dateChecked: "2026-11-14",
    confirmed: true,
  },
  {
    id: "transfer-college-of-examples",
    school: "College of Examples",
    summary:
      "Invented fixture: the College of Examples asks for DEMO 101 and DEMO 210 on its form. Not a USC rule, and it says nothing about admission.",
    prerequisiteCourses: ["DEMO 101", "DEMO 210"],
    gpaText: null,
    timingText: "Invented fixture: file the form before the term you want to enter.",
    applicationSteps: [
      "Open the invented form on the fixture page.",
      "List DEMO 101 and DEMO 210. This is not a USC form.",
    ],
    source: source(
      "transfer/college-of-examples",
      "Invented fixture, not a USC rule: list DEMO 101 and DEMO 210. This page does not predict admission.",
    ),
    dateChecked: "2026-11-14",
    confirmed: true,
  },
];

function completedSet(student) {
  return new Set(
    student.courses
      .filter((course) => course.status === "completed" || course.status === "transfer" || course.status === "ap")
      .map((course) => course.code),
  );
}

function matchingCourses(match, codes) {
  return [...codes].filter((code) => {
    const course = byCode.get(code);
    if (!course) return false;
    if (match.dept && course.dept !== match.dept) return false;
    if (match.levelMin !== undefined && course.level < match.levelMin) return false;
    if (match.levelMax !== undefined && course.level > match.levelMax) return false;
    return true;
  });
}

function evalNode(node, codes) {
  if (node.type === "course") {
    const course = byCode.get(node.code);
    const satisfied = codes.has(node.code);
    return {
      satisfied,
      appliedCourses: satisfied ? [node.code] : [],
      remainingUnits: satisfied ? 0 : course.units,
      note: satisfied
        ? "Stub: this completed course is applied."
        : "Stub: this course is not completed. In-progress courses do not count.",
    };
  }
  if (node.type === "course_set") {
    const applied = matchingCourses(node.match, codes);
    const units = applied.reduce((sum, code) => sum + byCode.get(code).units, 0);
    const countOk = node.minCount === undefined || applied.length >= node.minCount;
    const unitsOk = node.minUnits === undefined || units >= node.minUnits;
    const satisfied = countOk && unitsOk;
    let remainingUnits = 0;
    if (!unitsOk && node.minUnits !== undefined) remainingUnits = Math.max(0, node.minUnits - units);
    else if (!countOk && node.minCount !== undefined) remainingUnits = (node.minCount - applied.length) * 4;
    return {
      satisfied,
      appliedCourses: applied,
      remainingUnits,
      note: "Stub: course-set match against completed DEMO courses. Not an assignment solver.",
    };
  }
  const children = node.type === "all_of" ? node.children : node.options;
  const parts = children.map((child) => ({ child, result: evalNode(child, codes) }));
  if (node.type === "all_of") {
    const satisfied = parts.every((part) => part.result.satisfied);
    return {
      satisfied,
      appliedCourses: parts.flatMap((part) => part.result.appliedCourses),
      remainingUnits: parts.reduce((sum, part) => sum + part.result.remainingUnits, 0),
      note: "Stub: every child of this group must be satisfied.",
    };
  }
  const done = parts.filter((part) => part.result.satisfied);
  const countOk = node.minCount === undefined || done.length >= node.minCount;
  const doneUnits = done.reduce((sum, part) => {
    if (part.child.type === "course") return sum + byCode.get(part.child.code).units;
    return sum + part.result.appliedCourses.reduce((inner, code) => inner + byCode.get(code).units, 0);
  }, 0);
  const unitsOk = node.minUnits === undefined || doneUnits >= node.minUnits;
  const satisfied = countOk && unitsOk;
  let remainingUnits = 0;
  if (!satisfied) {
    if (node.minUnits !== undefined) remainingUnits = Math.max(remainingUnits, node.minUnits - doneUnits);
    if (node.minCount !== undefined) remainingUnits = Math.max(remainingUnits, (node.minCount - done.length) * 4);
  }
  return {
    satisfied,
    appliedCourses: done.flatMap((part) => part.result.appliedCourses),
    remainingUnits,
    note: "Stub: a choose-group tally. It is not a cheapest remaining set.",
  };
}

function flatten(node, codes, out) {
  const result = evalNode(node, codes);
  out.push({
    nodeId: node.id,
    satisfied: result.satisfied,
    appliedCourses: result.appliedCourses,
    remainingUnits: result.remainingUnits,
    note: result.note,
    source: node.source,
  });
  const children = node.type === "all_of" ? node.children : node.type === "n_of" ? node.options : [];
  for (const child of children) flatten(child, codes, out);
  return result;
}

function unsatisfiedCourseCodes(node, codes, out) {
  if (node.type === "course" && !codes.has(node.code)) out.push(node.code);
  const children = node.type === "all_of" ? node.children : node.type === "n_of" ? node.options : [];
  for (const child of children) unsatisfiedCourseCodes(child, codes, out);
}

const stubNote = {
  ruleId: "demo-term-unit-cap",
  text: "Stub tally for the skeleton. Not a degree audit. The invented DEMO cap is 16 units.",
};

function auditFor(student, program) {
  const codes = completedSet(student);
  const requirements = [];
  const root = flatten(program.requirements, codes, requirements);
  const coursesRemaining = [];
  unsatisfiedCourseCodes(program.requirements, codes, coursesRemaining);
  const appliedUnits = student.courses
    .filter((course) => root.appliedCourses.includes(course.code) && course.status === "completed")
    .reduce((sum, course) => sum + course.units, 0);
  return {
    studentId: student.id,
    programId: program.id,
    satisfied: root.satisfied,
    unitsApplied: appliedUnits,
    unitsRemaining: root.remainingUnits,
    coursesRemaining: [...new Set(coursesRemaining)],
    requirements,
    assumptions: [stubNote],
  };
}

function planned(code) {
  const course = byCode.get(code);
  return { code, units: course.units, title: course.title };
}

function term(label, season, yearNumber, codes) {
  const termCourses = codes.map(planned);
  return {
    label,
    season,
    year: yearNumber,
    courses: termCourses,
    units: termCourses.reduce((sum, course) => sum + course.units, 0),
  };
}

const college = transferRules[1];

function transferCheck(have) {
  const need = college.prerequisiteCourses;
  return {
    rule: college,
    prerequisitesHave: need.filter((code) => have.includes(code)),
    prerequisitesLack: need.filter((code) => !have.includes(code)),
  };
}

function opportunity(partial) {
  return {
    coursesThatStopCounting: [],
    verified: false,
    assumptions: [stubNote],
    ...partial,
  };
}

const addOns = {
  "demo-nova": [
    opportunity({
      mode: "add_on",
      studentId: "demo-nova",
      programId: "demo-widget-policy",
      extraTerms: 3,
      extraUnits: 14,
      bindingConstraint:
        "Stub: DEMO 210 is fall-only in this fixture, and DEMO 220 and DEMO 230 come after it.",
      coursesThatCount: [],
      remainingCourses: ["DEMO 210", "DEMO 220", "DEMO 230", "DEMO 301"],
      crossSchool: true,
      transfer: transferCheck(["DEMO 101"]),
    }),
    opportunity({
      mode: "add_on",
      studentId: "demo-nova",
      programId: "demo-widget-systems",
      extraTerms: 4,
      extraUnits: 16,
      bindingConstraint:
        "Stub: DEMO 330 is spring-only and follows DEMO 320, which is fall-only in this fixture.",
      coursesThatCount: ["DEMO 102"],
      remainingCourses: ["DEMO 110", "DEMO 320", "DEMO 330", "DEMO 401"],
      crossSchool: false,
      transfer: null,
    }),
  ],
  "demo-quill": [
    opportunity({
      mode: "add_on",
      studentId: "demo-quill",
      programId: "demo-widget-policy",
      extraTerms: 1,
      extraUnits: 3,
      bindingConstraint: "Stub: DEMO 230 is fall-only in this fixture and is the remaining policy choice.",
      coursesThatCount: ["DEMO 210", "DEMO 220", "DEMO 301"],
      remainingCourses: ["DEMO 230"],
      crossSchool: true,
      transfer: transferCheck(["DEMO 101", "DEMO 210"]),
    }),
    opportunity({
      mode: "add_on",
      studentId: "demo-quill",
      programId: "demo-widget-systems",
      extraTerms: 2,
      extraUnits: 8,
      bindingConstraint: "Stub: DEMO 320 is fall-only and DEMO 330 follows it in the spring.",
      coursesThatCount: ["DEMO 102", "DEMO 110", "DEMO 401"],
      remainingCourses: ["DEMO 320", "DEMO 330"],
      crossSchool: false,
      transfer: null,
    }),
  ],
  "demo-pebble": [
    opportunity({
      mode: "add_on",
      studentId: "demo-pebble",
      programId: "demo-widget-systems",
      extraTerms: 2,
      extraUnits: 8,
      bindingConstraint: "Stub: DEMO 330 is spring-only and follows the completed DEMO 320.",
      coursesThatCount: ["DEMO 102", "DEMO 110", "DEMO 320"],
      remainingCourses: ["DEMO 330", "DEMO 401"],
      crossSchool: false,
      transfer: null,
    }),
    opportunity({
      mode: "add_on",
      studentId: "demo-pebble",
      programId: "demo-widget-policy",
      extraTerms: 3,
      extraUnits: 14,
      bindingConstraint: "Stub: DEMO 210 is fall-only, then DEMO 220, DEMO 230, and a 300-level course remain.",
      coursesThatCount: [],
      remainingCourses: ["DEMO 210", "DEMO 220", "DEMO 230", "DEMO 301"],
      crossSchool: true,
      transfer: transferCheck(["DEMO 101"]),
    }),
  ],
};

const switches = {
  "demo-nova": [
    opportunity({
      mode: "switch",
      studentId: "demo-nova",
      programId: "demo-widget-systems",
      extraTerms: 2,
      extraUnits: 16,
      bindingConstraint: "Stub: switching drops DEMO 101. DEMO 320 then DEMO 330 is a two-term chain.",
      coursesThatCount: ["DEMO 102"],
      coursesThatStopCounting: ["DEMO 101"],
      remainingCourses: ["DEMO 110", "DEMO 320", "DEMO 330", "DEMO 401"],
      crossSchool: false,
      transfer: null,
    }),
  ],
  "demo-quill": [
    opportunity({
      mode: "switch",
      studentId: "demo-quill",
      programId: "demo-widget-systems",
      extraTerms: 2,
      extraUnits: 8,
      bindingConstraint: "Stub: the current major is already satisfied, so the systems track adds two terms.",
      coursesThatCount: ["DEMO 102", "DEMO 110", "DEMO 401"],
      coursesThatStopCounting: ["DEMO 101", "DEMO 201", "DEMO 210", "DEMO 220", "DEMO 301", "DEMO 360"],
      remainingCourses: ["DEMO 320", "DEMO 330"],
      crossSchool: false,
      transfer: null,
    }),
  ],
  "demo-pebble": [
    opportunity({
      mode: "switch",
      studentId: "demo-pebble",
      programId: "demo-widget-systems",
      extraTerms: 0,
      extraUnits: -4,
      bindingConstraint:
        "Stub: finishing Widget Systems is the same number of terms as finishing Applied Widgets, and 4 fewer units, in this fixture.",
      coursesThatCount: ["DEMO 102", "DEMO 110", "DEMO 320"],
      coursesThatStopCounting: ["DEMO 101", "DEMO 201"],
      remainingCourses: ["DEMO 330", "DEMO 401"],
      crossSchool: false,
      transfer: null,
    }),
  ],
};

const plans = {
  "demo-nova": {
    studentId: "demo-nova",
    programIds: ["demo-applied-widgets"],
    terms: [
      term("Spring 2026", "spring", 2026, ["DEMO 201"]),
      term("Fall 2026", "fall", 2026, ["DEMO 301"]),
      term("Spring 2027", "spring", 2027, ["DEMO 360"]),
      term("Fall 2027", "fall", 2027, ["DEMO 370"]),
    ],
    assumptions: [stubNote],
  },
  "demo-quill": {
    studentId: "demo-quill",
    programIds: ["demo-applied-widgets"],
    terms: [],
    assumptions: [
      stubNote,
      {
        ruleId: "demo-term-unit-cap",
        text: "Stub: Applied Widgets is already satisfied for Quill, so this plan has no further terms. DEMO 370 is in progress and is not required by the stub tally.",
      },
    ],
  },
  "demo-pebble": {
    studentId: "demo-pebble",
    programIds: ["demo-applied-widgets"],
    terms: [
      term("Fall 2026", "fall", 2026, ["DEMO 301"]),
      term("Fall 2027", "fall", 2027, ["DEMO 360"]),
      term("Spring 2028", "spring", 2028, ["DEMO 370"]),
    ],
    assumptions: [stubNote],
  },
};

for (const plan of Object.values(plans)) {
  plan.totalUnits = plan.terms.reduce((sum, item) => sum + item.units, 0);
}

const byStudent = students.map((student) => ({
  studentId: student.id,
  audits: programList.map((program) => auditFor(student, program)),
  addOns: addOns[student.id],
  switches: switches[student.id],
  plan: plans[student.id],
}));

const careerMatch = {
  programId: "demo-widget-policy",
  reason: "the Widget Policy minor studies rules of assembly and how gadgets meet a public rulebook",
  source: programList[1].source,
};

const chatAnswer = {
  text: "The stub treats an in-progress course as unfinished.",
  citations: [
    {
      label: "DEMO 201",
      source: byCode.get("DEMO 201").source,
    },
  ],
  fallback: true,
};

function write(name, value) {
  writeFileSync(join(root, name), `${JSON.stringify(value, null, 2)}\n`);
}

write("courses.json", courses);
write("programs.json", programList);
write("students.json", students);
write("policy-rules.json", policyRules);
write("transfer-rules.json", transferRules);
write("stub-results.json", { byStudent });
write("career-match.json", careerMatch);
write("chat-answer.json", chatAnswer);

console.log(`wrote fixtures: ${courses.length} courses, ${programList.length} programs, ${students.length} students`);
