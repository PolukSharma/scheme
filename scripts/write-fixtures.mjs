import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "evals", "fixtures");

const source = {
  url: "https://catalogue.usc.edu/",
  catalogueYear: "2026-2027",
  text: "Synthetic fixture for Scheme. This text is not a USC catalogue requirement.",
};

const offerings = ["fall", "spring", "both", "unknown"];

const numbers = [
  ...Array.from({ length: 12 }, (_, index) => 101 + index),
  ...Array.from({ length: 16 }, (_, index) => 201 + index),
  ...Array.from({ length: 12 }, (_, index) => 301 + index),
];

if (numbers.length !== 40) {
  throw new Error(`expected 40 courses, got ${numbers.length}`);
}

const courses = numbers.map((number, index) => {
  const code = `DEMO ${number}`;
  let prerequisites = null;
  if (index >= 4 && index % 7 === 0) {
    prerequisites = {
      type: "all_of",
      children: [
        { type: "course", code: `DEMO ${numbers[index - 1]}` },
        { type: "course", code: `DEMO ${numbers[index - 2]}` },
      ],
    };
  } else if (index >= 4 && index % 5 === 0) {
    prerequisites = {
      type: "n_of",
      n: 1,
      children: [
        { type: "course", code: `DEMO ${numbers[index - 1]}` },
        { type: "course", code: `DEMO ${numbers[index - 3]}` },
      ],
    };
  } else if (index >= 1) {
    prerequisites = { type: "course", code: `DEMO ${numbers[index - 1]}` };
  }
  return {
    code,
    title: `Synthetic studio ${number}`,
    units: 4,
    prerequisites,
    offering: offerings[index % offerings.length],
    source,
    verified: false,
  };
});

const byCode = new Map(courses.map((course) => [course.code, course]));

function courseNode(id, code) {
  if (!byCode.has(code)) throw new Error(`missing course ${code}`);
  return { type: "course", id, code, source, verified: false };
}

const programs = [
  {
    id: "demo-foundations",
    name: "Synthetic Foundations",
    school: "Demo College",
    kind: "major",
    description:
      "A synthetic major about careful systems. This sentence is fixture text, not a catalogue quote.",
    catalogueYear: "2026-2027",
    totalUnits: 32,
    requirements: {
      type: "all_of",
      id: "foundations-root",
      source,
      verified: false,
      children: [
        courseNode("foundations-101", "DEMO 101"),
        courseNode("foundations-102", "DEMO 102"),
        {
          type: "n_of",
          id: "foundations-choose",
          n: 2,
          source,
          verified: false,
          children: [
            courseNode("foundations-201", "DEMO 201"),
            courseNode("foundations-202", "DEMO 202"),
            courseNode("foundations-203", "DEMO 203"),
          ],
        },
        {
          type: "course_set",
          id: "foundations-set",
          minCount: 2,
          codes: ["DEMO 301", "DEMO 302", "DEMO 303", "DEMO 304"],
          source,
          verified: false,
        },
        {
          type: "unit_min",
          id: "foundations-units",
          minUnits: 8,
          source,
          verified: false,
          child: {
            type: "course_set",
            id: "foundations-upper",
            minCount: 1,
            subject: "DEMO",
            minLevel: 300,
            source,
            verified: false,
          },
        },
      ],
    },
    source,
    verified: false,
  },
  {
    id: "demo-overlap",
    name: "Synthetic Overlap",
    school: "Demo College",
    kind: "minor",
    description:
      "A synthetic minor that shares DEMO 101 with Synthetic Foundations and keeps its own unit floor.",
    catalogueYear: "2026-2027",
    totalUnits: 20,
    requirements: {
      type: "all_of",
      id: "overlap-root",
      source,
      verified: false,
      children: [
        courseNode("overlap-101", "DEMO 101"),
        courseNode("overlap-110", "DEMO 110"),
        {
          type: "n_of",
          id: "overlap-choose",
          n: 1,
          source,
          verified: false,
          children: [
            courseNode("overlap-210", "DEMO 210"),
            courseNode("overlap-211", "DEMO 211"),
          ],
        },
        {
          type: "unit_min",
          id: "overlap-units",
          minUnits: 8,
          source,
          verified: false,
          child: {
            type: "course_set",
            id: "overlap-set",
            minCount: 2,
            codes: ["DEMO 308", "DEMO 309", "DEMO 310", "DEMO 311"],
            source,
            verified: false,
          },
        },
      ],
    },
    source,
    verified: false,
  },
  {
    id: "demo-bridge",
    name: "Synthetic Bridge",
    school: "Other College",
    kind: "major",
    description:
      "A synthetic major in another school, used to exercise a cross-school switch.",
    catalogueYear: "2026-2027",
    totalUnits: 20,
    requirements: {
      type: "all_of",
      id: "bridge-root",
      source,
      verified: false,
      children: [
        courseNode("bridge-101", "DEMO 101"),
        courseNode("bridge-112", "DEMO 112"),
        courseNode("bridge-216", "DEMO 216"),
        {
          type: "course_set",
          id: "bridge-set",
          minCount: 1,
          codes: ["DEMO 305", "DEMO 306"],
          source,
          verified: false,
        },
        {
          type: "unit_min",
          id: "bridge-units",
          minUnits: 4,
          source,
          verified: false,
          child: courseNode("bridge-312", "DEMO 312"),
        },
      ],
    },
    source,
    verified: false,
  },
];

function taken(code, status, grade, term, flags = []) {
  const course = byCode.get(code);
  if (!course) throw new Error(`missing course ${code}`);
  return {
    code,
    title: course.title,
    units: course.units,
    grade,
    term,
    status,
    flags,
  };
}

const placeholder = {
  ruleId: "synthetic-fixture",
  text: "Hand-written synthetic row for schema coverage. Not an engine result.",
};

const students = [
  {
    id: "synthetic-a",
    label: "Synthetic student A",
    school: "Demo College",
    entranceTerm: "20243",
    classLevel: "Junior",
    expectedGraduation: "20281",
    catalogueYear: "2026-2027",
    declaredPrograms: [
      {
        programId: "demo-foundations",
        name: "Synthetic Foundations",
        role: "primary",
        effectiveTerm: "20243",
      },
      {
        programId: "demo-overlap",
        name: "Synthetic Overlap",
        role: "minor",
        effectiveTerm: "20253",
      },
    ],
    units: { earned: 8, inProgress: 4, transfer: 4, ap: 4 },
    courses: [
      taken("DEMO 101", "completed", "A", "20251"),
      taken("DEMO 102", "completed", "A-", "20253"),
      taken("DEMO 201", "in_progress", null, "20263", [">IP"]),
      taken("DEMO 110", "transfer", "TR", "20243"),
      taken("DEMO 104", "ap", "CR", null),
    ],
    remainingRequirements: [
      { text: "Synthetic Foundations choose-two group", status: "IP" },
      { text: "Synthetic Overlap unit floor", status: "NEEDS" },
      { text: "Select from the synthetic upper-division pool", status: "SELECT FROM" },
    ],
  },
  {
    id: "synthetic-b",
    label: "Synthetic student B",
    school: "Other College",
    entranceTerm: "20251",
    classLevel: "Sophomore",
    expectedGraduation: "20291",
    catalogueYear: "2026-2027",
    declaredPrograms: [
      {
        programId: "demo-bridge",
        name: "Synthetic Bridge",
        role: "primary",
        effectiveTerm: "20251",
      },
    ],
    units: { earned: 4, inProgress: 4, transfer: 0, ap: 0 },
    courses: [
      taken("DEMO 112", "completed", "B+", "20253"),
      taken("DEMO 216", "in_progress", null, "20261", [">IP"]),
    ],
    remainingRequirements: [
      { text: "Synthetic Bridge required studio", status: "NO" },
    ],
  },
  {
    id: "synthetic-c",
    label: "Synthetic student C",
    school: "Demo College",
    entranceTerm: "20233",
    classLevel: "Senior",
    expectedGraduation: "20271",
    catalogueYear: "2026-2027",
    declaredPrograms: [
      {
        programId: "demo-foundations",
        name: "Synthetic Foundations",
        role: "primary",
        effectiveTerm: "20233",
      },
    ],
    units: { earned: 32, inProgress: 0, transfer: 0, ap: 0 },
    courses: [
      taken("DEMO 101", "completed", "A", "20241"),
      taken("DEMO 102", "completed", "A", "20243"),
      taken("DEMO 201", "completed", "A-", "20251"),
      taken("DEMO 202", "completed", "B+", "20253"),
      taken("DEMO 301", "completed", "A", "20261"),
      taken("DEMO 302", "completed", "A-", "20261"),
      taken("DEMO 308", "completed", "A", "20263"),
      taken("DEMO 309", "completed", "A-", "20263"),
    ],
    remainingRequirements: [
      { text: "Synthetic Foundations", status: "OK" },
    ],
  },
];

const policyRules = [
  {
    id: "synthetic-unique-units",
    name: "Synthetic unique-unit floor",
    summary: "Stand-in for a minor unique-unit rule. The number is not a USC figure.",
    value: 16,
    source,
    verified: false,
  },
  {
    id: "synthetic-unit-cap",
    name: "Synthetic term unit cap",
    summary: "Stand-in unit cap used so a term plan has a limit to respect.",
    value: 18,
    source,
    verified: false,
  },
  {
    id: "synthetic-tuition-unconfirmed",
    name: "Synthetic tuition band",
    summary: "Tuition is unconfirmed. Leave the value null until a source quotes the figure.",
    value: null,
    source: {
      ...source,
      text: "Synthetic fixture. No tuition figure is quoted here. Do not invent one.",
    },
    verified: false,
  },
];

const transferRules = [
  {
    id: "into-demo-college",
    fromSchool: "Other College",
    toSchool: "Demo College",
    summary: "Synthetic internal-transfer note into Demo College. Not an admission decision.",
    prerequisiteCourses: ["DEMO 101", "DEMO 201"],
    source,
    dateChecked: "2026-11-14",
    verified: false,
  },
  {
    id: "into-other-college",
    fromSchool: "Demo College",
    toSchool: "Other College",
    summary: "Synthetic internal-transfer note into Other College. Not an admission decision.",
    prerequisiteCourses: ["DEMO 112"],
    source,
    dateChecked: "2026-11-14",
    verified: false,
  },
];

const auditResults = [
  {
    studentId: "synthetic-a",
    programId: "demo-foundations",
    satisfied: false,
    unitsApplied: 8,
    unitsRemaining: 24,
    requirements: [
      {
        nodeId: "foundations-101",
        satisfied: true,
        appliedCourses: ["DEMO 101"],
        remainingUnits: 0,
        note: "Completed DEMO 101.",
      },
      {
        nodeId: "foundations-102",
        satisfied: true,
        appliedCourses: ["DEMO 102"],
        remainingUnits: 0,
        note: "Completed DEMO 102.",
      },
      {
        nodeId: "foundations-choose",
        satisfied: false,
        appliedCourses: [],
        remainingUnits: 8,
        note: "DEMO 201 is in progress and does not satisfy the choose-two group yet.",
      },
      {
        nodeId: "foundations-set",
        satisfied: false,
        appliedCourses: [],
        remainingUnits: 8,
        note: "Two courses from the synthetic set are still open.",
      },
      {
        nodeId: "foundations-units",
        satisfied: false,
        appliedCourses: [],
        remainingUnits: 8,
        note: "The synthetic 8-unit floor is open.",
      },
    ],
    assumptions: [placeholder],
  },
  {
    studentId: "synthetic-c",
    programId: "demo-foundations",
    satisfied: true,
    unitsApplied: 32,
    unitsRemaining: 0,
    requirements: [
      {
        nodeId: "foundations-root",
        satisfied: true,
        appliedCourses: [
          "DEMO 101",
          "DEMO 102",
          "DEMO 201",
          "DEMO 202",
          "DEMO 301",
          "DEMO 302",
          "DEMO 308",
          "DEMO 309",
        ],
        remainingUnits: 0,
        note: "Hand-written complete audit for the synthetic major.",
      },
    ],
    assumptions: [placeholder],
  },
];

const opportunities = [
  {
    mode: "add-on",
    studentId: "synthetic-a",
    programId: "demo-overlap",
    extraTerms: 1,
    extraUnits: 12,
    estimatedCost: null,
    bindingConstraint: "synthetic unit floor on the minor",
    coursesThatCount: ["DEMO 101", "DEMO 110"],
    coursesThatStopCounting: [],
    crossSchool: false,
    transferRuleId: null,
    prerequisitesHave: [],
    prerequisitesLack: [],
    verified: false,
    assumptions: [placeholder],
  },
  {
    mode: "switch",
    studentId: "synthetic-b",
    programId: "demo-foundations",
    extraTerms: 2,
    extraUnits: 24,
    estimatedCost: null,
    bindingConstraint: "synthetic cross-school prerequisites",
    coursesThatCount: [],
    coursesThatStopCounting: ["DEMO 112", "DEMO 216"],
    crossSchool: true,
    transferRuleId: "into-demo-college",
    prerequisitesHave: [],
    prerequisitesLack: ["DEMO 101", "DEMO 201"],
    verified: false,
    assumptions: [
      placeholder,
      {
        ruleId: "into-demo-college",
        text: "Synthetic transfer note only. This does not imply admission.",
      },
    ],
  },
];

const termPlans = [
  {
    studentId: "synthetic-a",
    programIds: ["demo-foundations", "demo-overlap"],
    terms: [
      {
        label: "Fall 2026",
        season: "fall",
        year: 2026,
        courses: [
          {
            code: "DEMO 202",
            title: byCode.get("DEMO 202").title,
            units: 4,
          },
          {
            code: "DEMO 301",
            title: byCode.get("DEMO 301").title,
            units: 4,
          },
        ],
        units: 8,
      },
      {
        label: "Spring 2027",
        season: "spring",
        year: 2027,
        courses: [
          {
            code: "DEMO 302",
            title: byCode.get("DEMO 302").title,
            units: 4,
          },
          {
            code: "DEMO 308",
            title: byCode.get("DEMO 308").title,
            units: 4,
          },
        ],
        units: 8,
      },
    ],
    totalUnits: 16,
    assumptions: [placeholder],
  },
];

const foundations = programs.find((program) => program.id === "demo-foundations");
const quoted = "A synthetic major about careful systems.";
if (!foundations.description.includes(quoted)) {
  throw new Error("career-fit quote is not in the program description");
}

const careerFits = [
  {
    goal: "Work on careful systems.",
    matches: [
      {
        programId: "demo-foundations",
        reason: quoted,
        source: foundations.source,
        suggestion: true,
        extraUnits: 24,
        extraTerms: 2,
      },
    ],
    noStrongMatch: false,
  },
  {
    goal: "A goal with no synthetic program behind it.",
    matches: [],
    noStrongMatch: true,
  },
];

const files = {
  "courses.json": courses,
  "programs.json": programs,
  "students.json": students,
  "policy-rules.json": policyRules,
  "transfer-rules.json": transferRules,
  "audit-results.json": auditResults,
  "opportunities.json": opportunities,
  "term-plans.json": termPlans,
  "career-fits.json": careerFits,
};

mkdirSync(outDir, { recursive: true });
for (const [name, value] of Object.entries(files)) {
  writeFileSync(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`);
}
console.log(`wrote ${Object.keys(files).length} fixture files to ${outDir}`);
