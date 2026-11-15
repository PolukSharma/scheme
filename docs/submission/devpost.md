# Scheme — Devpost description

Paste the five sections below into Devpost. Leave the prototype link blank until the team imports this repo on Vercel and writes the address on the `LIVE_URL` line in `docs/submission/README.md`. Do not submit a link that does not open.

Title treatment, if Devpost lets you color the name: the letters **Sc** in Scheme are cardinal red `#990000`. The rest of the word is black `#000000`.

Scheme supports advisors. It does not replace them. STARS remains the official audit.

## The problem

A USC student who wants to add a minor, add a second major, or switch majors has to read a STARS report against the catalogue, or wait for an advising appointment. The catalogue states the requirements. STARS is the official record of what the student has done. Nothing in between ranks the options by extra time.

Scheme does not know how long students wait for appointments, how many students are considering a change, or which programs are most popular. Those figures are not in this entry.

## The solution

Scheme is a planning aid. A student enters a major and a start year, then adds a STARS report, types courses by hand, or opens a built-in sample student. Sample students work with nothing uploaded.

The app ranks minors, second majors, and specializations by extra terms, then by extra units. It also ranks majors the student could switch into, measured against the current path. Each result shows which completed courses already count, what remains, and a link to the catalogue sentence for that requirement. A different school raises a cross-school alert with that school's published transfer requirements and the official link. The alert does not predict admission.

A career goal returns up to three programs. Each reason is quoted from the catalogue. Difficulty is computed by the engine. A chat box answers questions about the plan from those engine results and cites the catalogue. A question about a course or a number that was not supplied is declined.

The term plan places a course only in a season the course record lists. If the offering is irregular, the plan says the term is unknown. The student can print an advisor PDF to take to an appointment.

On the programs in `docs/accuracy.md`, 60 of 65 audit cases passed and 17 of 18 plans were valid. No person has checked those rows by hand. Wider catalogue coverage is future work.

## The tech stack

One Next.js and TypeScript app. The engine is a pure TypeScript library: it audits a record, assigns courses to requirements, ranks add-ons and switches, and builds the term plan. It does not call the network and it does not call a model.

Requirement trees, courses, policy rules, and school transfer rules are JSON in the repo. Each item carries a catalogue URL, the quoted text, and the catalogue year. `npm run refresh-catalogue` is the yearly update command.

The STARS report is parsed in the browser and is not uploaded. Career matching and chat are two server routes. They receive goal text, or course codes plus the question. They do not receive a name or a student ID. With `AI_API_KEY` unset, both routes answer from the engine alone.

There is no database and no account system.

## Challenges faced

Catalogue wording does not always map onto one rule. A graduate list that "may be substituted" cannot be encoded as a required list, so those nodes stay unverified and are not required. A minimum grade is taken from the requirement that states it. The engine does not guess a floor for a requirement that is silent. A course whose term is not printed is left off the calendar instead of being placed in a made-up season.

The checker reads saved catalogue HTML. It does not treat a disagreement as settled. Rows that no person has checked stay unverified.

The career and chat routes can only repeat numbers and course codes that were in their input. That keeps the model from inventing a requirement. It also means the answer is only as good as the engine result it was given.

## Goals for future implementation

Fill `LIVE_URL` after the Vercel import, and demo on that address. Have a person check the accuracy rows. Add programs beyond the table, labelled unverified until they are checked. Run a labelled set of career goals, which is not in the repo yet. Embed in Experience USC only after a USG pilot and an advisor review of the data and the PDF. Do not add Registrar access, SSO, accounts, saved reports, popularity rankings, or a tuition estimate unless the tuition rule is sourced.
