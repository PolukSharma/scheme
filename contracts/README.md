# Contracts

Shared Zod schemas and the TypeScript types inferred from them. Later work codes against this folder. If a type must change, stop and say so. Do not edit these files to unblock another task.

`docs/project-context.md` was not in the repo when this folder was added.

## Rules that travel with the types

- Stack is Next.js and TypeScript only.
- `engine/` stays free of LLM calls. These types describe inputs and outputs; they do not call a model.
- Every requirement node and every policy rule carries `source: { url, catalogueYear, text }` and `verified`.
- `verified: false` means the row has not been checked against the catalogue. Synthetic fixtures in `evals/fixtures/` stay unverified.
- Do not commit real student records. Persona fixtures use labels such as "Synthetic student A" and never a USC ID.
- Tuition stays null until a policy rule quotes a figure. `Opportunity.estimatedCost` is null in the fixtures for that reason.
- In the UI, the product name is rendered only by `components/wordmark.tsx`. The letters `Sc` use `#990000`.

## RequirementNode

A tree. Every node has `id`, `source`, `verified`, and an optional `minGrade`.

| `type` | Meaning |
| --- | --- |
| `course` | One course, in `code`. |
| `course_set` | Take `minCount` courses. The pool is `codes`, or a `subject` prefix, or a `minLevel`, or a combination. |
| `n_of` | Satisfy at least `n` children. `n` cannot exceed the child count. |
| `all_of` | Satisfy every child. |
| `unit_min` | At least `minUnits` drawn from `child`. |

## Other types

| Type | Role |
| --- | --- |
| `Course` | Code, title, units, prerequisite tree (`course`, `all_of`, `n_of`), and offering `fall`, `spring`, `both`, or `unknown`. |
| `Program` | Major, minor, specialization, or progressive degree. `requirements` is one `RequirementNode`. `totalUnits` is the stated total and must be recomputed from the tree before it is trusted. |
| `PolicyRule` | Overlap, unit-cap, or cost rule. `value` is null when the figure is not quoted. |
| `StudentRecord` | Parsed STARS shape: entrance term, one primary program, unit summary, course lines, and remaining-requirement lines. Term codes are `YYYYT` with `1` spring, `2` summer, `3` fall. In-progress courses use status `in_progress`, a null grade, and may carry the `>IP` flag. |
| `AuditResult` | Satisfied and open requirements, courses applied to each node, and units still required. |
| `Opportunity` | `mode` is `add-on` or `switch`. Switch rows list `coursesThatStopCounting`. `crossSchool` attaches `transferRuleId` and the prerequisites the student has or lacks. A transfer row never means admission is likely. |
| `TermPlan` | Remaining courses placed in fall, spring, or summer terms. |
| `TransferRule` | One direction between two schools, with the page URL, catalogue year, quoted text, and `dateChecked`. |
| `CareerFit` | Up to three suggestions. `reason` is a verbatim substring of stored program text, `suggestion` is `true`, and `extraUnits` / `extraTerms` are copied from the engine. `noStrongMatch: true` comes with an empty list. |

## Fixtures

`evals/fixtures/` holds one JSON file per top-level schema. Counts for this scaffold: 40 courses, 3 programs, 3 students. Regenerate them with `npm run fixtures`. The files use the invented `DEMO` subject and invented school names. They are not catalogue data.

| File | Schema |
| --- | --- |
| `courses.json` | `Course[]` of length 40 |
| `programs.json` | `Program[]` of length 3 |
| `students.json` | `StudentRecord[]` of length 3 |
| `policy-rules.json` | `PolicyRule[]` |
| `transfer-rules.json` | `TransferRule[]` |
| `audit-results.json` | `AuditResult[]` |
| `opportunities.json` | `Opportunity[]` |
| `term-plans.json` | `TermPlan[]` |
| `career-fits.json` | `CareerFit[]` |

`tests/fixtures.test.ts` reads that directory and parses every file with the matching schema, then parses every requirement node on its own.
