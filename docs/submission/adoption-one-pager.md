# Scheme — adoption path

One page for USG. Scheme supports advisors and does not replace them. STARS remains the official audit.

`LIVE_URL` is blank. This page does not claim a public deployment. The team fills the address after importing the repo on Vercel.

## Phase 1 — USG pilot

A public page, the programs already in the accuracy table, and the built-in sample students. Students can also parse their own STARS report in the browser.

**Needs from USG:** a decision to share the link, and a named contact for questions. Nothing else.

**Does not need:** Registrar access, SSO, a database, accounts, or a copy of anyone's report.

**What we can say today:** On the programs in `docs/accuracy.md`, 60 of 65 audit cases passed and 17 of 18 plans were valid. No person has checked those rows by hand, so the pilot should say the rows are unchecked.

## Phase 2 — Advisor partnership

Advisors in the departments that own those programs review the requirement data and the PDF layout. They do not have to enter grades or run the tool for the student.

**Needs from a department:** time to read the catalogue quotes in the data and to say whether the PDF is useful in an appointment.

**Does not need:** a new advising system, write access to STARS, or a change to how appointments are booked.

Scheme still tells the student to compare the plan with STARS.

## Phase 3 — Experience USC embed

A link or an embed inside Experience USC, only after the pilot and the advisor review.

**Needs from USG:** a place to put the link, and the same privacy note the app already shows.

**Does not need:** Scheme to become the system of record. STARS remains the official audit. Embedding is not required for the pilot.

## Keeping it current

Once a year, a maintainer runs:

```bash
npm run refresh-catalogue
```

That refreshes the catalogue files in the repo. New or changed programs stay unverified until a person checks them. The engine does not invent a requirement the page does not state.

## Running cost

TO SOURCE. The repo has no measured hosting bill and no measured token average from a live key. What is known, without a dollar figure: one Next.js app, no database, and no accounts. Sample students run with `AI_API_KEY` unset. Career and chat are the only routes that can call a model, and they log token counts when they do. Do not print a monthly cost until someone records the host invoice and those counts.

## Privacy

The STARS report is parsed in the browser and is not uploaded or stored. Career matching receives the goal text. Chat receives course codes and the question. A body that includes a name or a student ID is rejected. Do not commit a real report.

## Out of scope

Full catalogue coverage, SSO, Registrar integration, accounts, saved reports, popularity rankings, and any tuition or extra-cost estimate that does not cite a published rule.
