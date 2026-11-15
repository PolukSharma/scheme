# Scheme contracts

Code against `lib/types`. If a type has to change, propose the change in a pull request description and do not edit it in place. The build-plan sketch used snake_case. These contracts use camelCase.

| Sketch | Field here |
| --- | --- |
| `min_count` | `minCount` |
| `min_units` | `minUnits` |
| `min_grade` | `minGrade` |
| `max_units_shared_with_major` | `maxUnitsSharedWithMajor` |
| `catalogue_year` | `catalogueYear` |
| `level_min` | `levelMin` |

A program is shown as verified only when its tree matches the golden tree and a teammate has set `humanChecked`. Fixtures keep both flags false.

## Engine signatures

The Engine agent replaces the bodies in `lib/engine/index.ts` and keeps these signatures. The stub looks up `fixtures/stub-results.json` by student id, filters rankings to the program ids it was given, and sorts by `extraTerms`, then `extraUnits`. An unknown student gets an empty result. `planTerms` returns that student's fixture plan and ignores `options.unitCap`.

```ts
audit(
  student: StudentRecord,
  program: Program,
  courses: readonly Course[],
  policyRules: readonly PolicyRule[],
): AuditResult

rankAddOns(
  student: StudentRecord,
  currentPrograms: readonly Program[],
  candidates: readonly Program[],
  courses: readonly Course[],
  policyRules: readonly PolicyRule[],
  transferRules: readonly TransferRule[],
): Opportunity[]

rankSwitches(
  student: StudentRecord,
  currentMajor: Program,
  targets: readonly Program[],
  courses: readonly Course[],
  policyRules: readonly PolicyRule[],
  transferRules: readonly TransferRule[],
): Opportunity[]

planTerms(
  student: StudentRecord,
  programs: readonly Program[],
  courses: readonly Course[],
  policyRules: readonly PolicyRule[],
  options?: { unitCap?: number },
): TermPlan
```

`extraTerms` and `extraUnits` are extra beyond the current degree for `add_on`, and the change against the current path for `switch` (negative means fewer). `crossSchool` is true when the target school's name differs from `student.school`. `transfer` is that school's `TransferRule` plus the prerequisite courses the student has and lacks, or null when the schools match or no rule is on file. A policy rule with `confirmed: false` is never applied silently; return it in `assumptions`.

Nothing in `lib/engine` calls a model or the network.

## Source

Every requirement, course, policy rule, and transfer rule carries a source.

```json
{
  "url": "https://example.edu/demo-catalogue/2026/programs/applied-widgets",
  "catalogueYear": "2026-2027",
  "text": "Invented fixture: the Applied Widgets major requires the core sequence and a choose-two upper-division group."
}
```

## Course

`offerings` uses `fall`, `spring`, `summer`, and `irregular`. `prerequisites` is null or a tree of `course`, `all_of`, and `n_of`.

```json
{
  "code": "DEMO 201",
  "title": "Widget Structures",
  "units": 4,
  "dept": "DEMO",
  "level": 200,
  "prerequisites": { "type": "course", "code": "DEMO 101" },
  "corequisites": [],
  "offerings": ["fall", "spring"],
  "source": {
    "url": "https://example.edu/demo-catalogue/2026/courses/demo-201",
    "catalogueYear": "2026-2027",
    "text": "Invented fixture, not a USC course: DEMO 201 Widget Structures is 4 units."
  }
}
```

A prerequisite `n_of` example, from DEMO 390:

```json
{
  "type": "n_of",
  "minCount": 1,
  "children": [
    { "type": "course", "code": "DEMO 260" },
    { "type": "course", "code": "DEMO 380" }
  ]
}
```

## RequirementNode

Node types are `course`, `course_set`, `all_of`, and `n_of`. Every node has `id`, `source`, and `verified`. Constraints are optional: `minGrade`, `maxUnitsSharedWithMajor`.

`n_of` needs `minCount` or `minUnits` (or both) and a list of `options`. `all_of` has `children`. `course_set` matches on `dept`, `levelMin`, or `levelMax` and needs `minCount` or `minUnits`. When a `course_set` is an option of `n_of`, those floors say what it takes for that option to count as chosen.

```json
{
  "type": "n_of",
  "id": "aw-choose",
  "minCount": 2,
  "minUnits": 8,
  "options": [
    { "type": "course", "id": "aw-360", "code": "DEMO 360", "source": { "url": "https://example.edu/demo-catalogue/2026/requirements/aw-360", "catalogueYear": "2026-2027", "text": "Invented fixture: take DEMO 360 Capstone Studio I." }, "verified": false },
    { "type": "course", "id": "aw-370", "code": "DEMO 370", "source": { "url": "https://example.edu/demo-catalogue/2026/requirements/aw-370", "catalogueYear": "2026-2027", "text": "Invented fixture: take DEMO 370 Capstone Studio II." }, "verified": false },
    {
      "type": "course_set",
      "id": "aw-400",
      "match": { "dept": "DEMO", "levelMin": 400 },
      "minCount": 1,
      "minUnits": 4,
      "source": { "url": "https://example.edu/demo-catalogue/2026/requirements/aw-400", "catalogueYear": "2026-2027", "text": "Invented fixture: one DEMO course at level 400 or above, at least 4 units, may fill this choice." },
      "verified": false
    }
  ],
  "source": { "url": "https://example.edu/demo-catalogue/2026/requirements/aw-choose", "catalogueYear": "2026-2027", "text": "Invented fixture: choose two options totaling at least 8 units from the studios or a 400-level set." },
  "verified": false
}
```

A sharing limit, from the Widget Policy minor:

```json
{
  "type": "n_of",
  "id": "wp-choose",
  "minCount": 2,
  "minUnits": 6,
  "constraints": { "minGrade": "C", "maxUnitsSharedWithMajor": 4 },
  "options": [],
  "source": { "url": "https://example.edu/demo-catalogue/2026/requirements/wp-choose", "catalogueYear": "2026-2027", "text": "Invented fixture: choose two policy courses, at least 6 units, with at most 4 units shared with the major." },
  "verified": false
}
```

The real fixture options are DEMO 220, DEMO 230, and DEMO 240. The snippet above leaves `options` empty only to show the constraint fields; the file on disk is valid and non-empty.

Nested choose, from Widget Systems: an `n_of` with `minCount: 1` whose options are two `all_of` tracks (DEMO 320 and DEMO 330, or DEMO 340 and DEMO 350).

## Program

```json
{
  "id": "demo-applied-widgets",
  "name": "Applied Widgets",
  "school": "School of Demonstration",
  "kind": "major",
  "description": "Invented fixture: students build a widget core and then choose two upper-division studios or a 400-level set.",
  "catalogueYear": "2026-2027",
  "requirements": { "type": "all_of", "id": "aw-all", "children": [], "source": { "url": "https://example.edu/demo-catalogue/2026/requirements/aw-all", "catalogueYear": "2026-2027", "text": "Invented fixture: complete every child of the Applied Widgets major." }, "verified": false },
  "source": { "url": "https://example.edu/demo-catalogue/2026/programs/applied-widgets", "catalogueYear": "2026-2027", "text": "Invented fixture: the Applied Widgets major requires the core sequence and a choose-two upper-division group." },
  "verified": false,
  "humanChecked": false
}
```

`kind` is `major`, `minor`, or `specialization`. The `children` array in the live fixture is the core courses plus `aw-choose`.

## PolicyRule

`value` is null when the number or the wording is not confirmed. `confirmed: false` means do not apply it silently.

```json
{
  "id": "demo-minor-unique-units",
  "name": "Units unique to a minor",
  "summary": "TO SOURCE: how many units must be unique to a minor. Left unset in this fixture.",
  "value": null,
  "source": { "url": "https://example.edu/demo-catalogue/2026/policy/minor-unique-units", "catalogueYear": "2026-2027", "text": "TO SOURCE: units that must be unique to a minor. This fixture does not invent a number." },
  "confirmed": false
}
```

## TransferRule

One rule per school. `gpaText` and `timingText` are null when the page does not state them. Wording never implies admission.

```json
{
  "id": "transfer-college-of-examples",
  "school": "College of Examples",
  "summary": "Invented fixture: the College of Examples asks for DEMO 101 and DEMO 210 on its form. Not a USC rule, and it says nothing about admission.",
  "prerequisiteCourses": ["DEMO 101", "DEMO 210"],
  "gpaText": null,
  "timingText": "Invented fixture: file the form before the term you want to enter.",
  "applicationSteps": ["Open the invented form on the fixture page.", "List DEMO 101 and DEMO 210. This is not a USC form."],
  "source": { "url": "https://example.edu/demo-catalogue/2026/transfer/college-of-examples", "catalogueYear": "2026-2027", "text": "Invented fixture, not a USC rule: list DEMO 101 and DEMO 210. This page does not predict admission." },
  "dateChecked": "2026-11-14",
  "confirmed": true
}
```

## StudentRecord

Held in memory in the browser. `majorId` is included in `declaredProgramIds`. An in-progress course has `grade: null`. Status is `completed`, `in_progress`, `transfer`, or `ap`.

```json
{
  "id": "demo-nova",
  "label": "Nova",
  "school": "School of Demonstration",
  "startYear": 2025,
  "startTerm": "2025-fall",
  "catalogueYear": "2026-2027",
  "majorId": "demo-applied-widgets",
  "declaredProgramIds": ["demo-applied-widgets"],
  "courses": [
    { "code": "DEMO 101", "units": 4, "grade": "A", "term": "2025-fall", "status": "completed" },
    { "code": "DEMO 201", "units": 4, "grade": null, "term": "2026-spring", "status": "in_progress" }
  ]
}
```

## AuditResult

```json
{
  "studentId": "demo-nova",
  "programId": "demo-applied-widgets",
  "satisfied": false,
  "unitsApplied": 4,
  "unitsRemaining": 16,
  "coursesRemaining": ["DEMO 201", "DEMO 301", "DEMO 360", "DEMO 370"],
  "requirements": [
    {
      "nodeId": "aw-101",
      "satisfied": true,
      "appliedCourses": ["DEMO 101"],
      "remainingUnits": 0,
      "note": "Stub: this completed course is applied.",
      "source": { "url": "https://example.edu/demo-catalogue/2026/requirements/aw-101", "catalogueYear": "2026-2027", "text": "Invented fixture: take DEMO 101 Introduction to Widgets." }
    }
  ],
  "assumptions": [
    { "ruleId": "demo-term-unit-cap", "text": "Stub tally for the skeleton. Not a degree audit. The invented DEMO cap is 16 units." }
  ]
}
```

The numbers above match the stub's story for Nova. The full requirement list is in `fixtures/stub-results.json`.

## Opportunity

`mode` is `add_on` or `switch`.

```json
{
  "mode": "add_on",
  "studentId": "demo-quill",
  "programId": "demo-widget-policy",
  "extraTerms": 1,
  "extraUnits": 3,
  "bindingConstraint": "Stub: DEMO 230 is fall-only in this fixture and is the remaining policy choice.",
  "coursesThatCount": ["DEMO 210", "DEMO 220", "DEMO 301"],
  "coursesThatStopCounting": [],
  "remainingCourses": ["DEMO 230"],
  "verified": false,
  "crossSchool": true,
  "transfer": {
    "rule": { "id": "transfer-college-of-examples", "school": "College of Examples" },
    "prerequisitesHave": ["DEMO 101", "DEMO 210"],
    "prerequisitesLack": []
  },
  "assumptions": [
    { "ruleId": "demo-term-unit-cap", "text": "Stub tally for the skeleton. Not a degree audit. The invented DEMO cap is 16 units." }
  ]
}
```

The `rule` value in the file is a full `TransferRule`. The snippet shows the fields the UI reads first.

## TermPlan

```json
{
  "studentId": "demo-nova",
  "programIds": ["demo-applied-widgets"],
  "terms": [
    {
      "label": "Spring 2026",
      "season": "spring",
      "year": 2026,
      "courses": [{ "code": "DEMO 201", "units": 4, "title": "Widget Structures" }],
      "units": 4
    }
  ],
  "totalUnits": 16,
  "assumptions": [
    { "ruleId": "demo-term-unit-cap", "text": "Stub tally for the skeleton. Not a degree audit. The invented DEMO cap is 16 units." }
  ]
}
```

Nova's fixture plan has four terms; the total counts all of them. Quill's major plan has no terms because the stub marks Applied Widgets satisfied.

## CareerMatch

A suggestion. `reason` is a verbatim substring of the program description the AI layer is allowed to quote. The browser joins difficulty from the engine. The model never supplies `extraTerms` or `extraUnits`.

```json
{
  "programId": "demo-widget-policy",
  "reason": "the Widget Policy minor studies rules of assembly and how gadgets meet a public rulebook",
  "source": { "url": "https://example.edu/demo-catalogue/2026/programs/widget-policy", "catalogueYear": "2026-2027", "text": "Invented fixture: the Widget Policy minor limits how many units may be shared with the major." }
}
```

## ChatAnswer

`fallback: true` means the engine-only answer, used when the key is missing, the provider is down, or the output guard rejects a reply.

```json
{
  "text": "The stub treats an in-progress course as unfinished.",
  "citations": [
    {
      "label": "DEMO 201",
      "source": { "url": "https://example.edu/demo-catalogue/2026/courses/demo-201", "catalogueYear": "2026-2027", "text": "Invented fixture, not a USC course: DEMO 201 Widget Structures is 4 units." }
    }
  ],
  "fallback": true
}
```

## Assumption

```json
{ "ruleId": "demo-catalogue-year", "text": "The catalogue year is unconfirmed, so the plan uses 2026-2027 as an assumption." }
```

`ruleId` refers to a `PolicyRule` when the assumption comes from policy.
