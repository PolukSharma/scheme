# Scheme — slide outline

Seven slides. Paste one block into each Google Slides slide. The sentence under "Say this" is the only sentence that slide has to land. Do not add a survey count, a quote, an advisor ratio, a tuition figure, or a popularity ranking until `docs/submission/evidence.md` has it.

Wordmark on the title slide and in any title lockup: the letters **Sc** are `#990000`. The letters h, e, m, and the final e are `#000000`. Do not set text in gold.

STARS remains the official audit on slides 1, 5, and 7.

`LIVE_URL` is blank. Do not put a URL on a slide until the team has imported the repo on Vercel and written the address down.

## Slide 1 — Title

**Title:** Scheme

**Say this:** Scheme shows a USC student which programs add the least extra time, and STARS stays the official audit.

**On the slide:** The wordmark as specified above. One line under it: "A planning aid for adding or switching a USC program." Footer: "Supports advisors. Does not replace them."

**Visual:** Cardinal bar (`#990000`) along the top. No screenshot. No prize amounts.

## Slide 2 — The problem

**Say this:** Adding a minor or switching a major means reading a STARS report against the catalogue, or waiting for an appointment.

**On the slide:** That sentence. Under it, two labelled blanks: "Survey: TO SOURCE" and "Quote: TO SOURCE". Leave both blank. Do not type a number or a name.

**Visual:** A STARS page beside a catalogue page, with the name and ID covered. Use a sample or a teammate's report only with permission. If neither is ready, use two empty frames labelled "report" and "catalogue".

## Slide 3 — What a student sees

**Say this:** Ranked options, the courses that already count, and what remains, each tied to a catalogue line.

**On the slide:** Three captions: "Sample student, phone", "Ranked add-ons", "Requirement with its catalogue link".

**Visual:** The three shots listed first in `docs/submission/screenshots.md`. They are not captured yet. Leave grey boxes until `LIVE_URL` is filled and the demo lead takes them. One of the three must be a phone width.

## Slide 4 — How it works

**Say this:** Code decides what counts toward a degree. AI only explains, and only from those results.

**On the slide:** The diagram below. Do not draw a second box that "checks" the engine.

**Visual:** Paste this into a diagram:

```text
STARS report or sample student
        |
        v
Parsed in the browser (not uploaded)
        |
        v
Engine: audit, rank, term plan
        |
        +--> Screens and advisor PDF
        |
        +--> Career and chat routes
                 |
                 v
             Answer only from engine results
             and catalogue quotes
```

## Slide 5 — Why you can trust it

**Say this:** On the programs in the accuracy table, 60 of 65 audit cases passed and 17 of 18 plans were valid. No person has checked those rows yet.

**On the slide:** Those two figures, cited as `docs/accuracy.md`. A line that every requirement links to its catalogue source. A line that the report is parsed in the browser and is not uploaded. A line that STARS remains the official audit.

**Visual:** A crop of the accuracy table showing the 60/65 and 17/18 summary, or the two figures set in type. Do not mark any row verified.

## Slide 6 — Adoption and cost

**Say this:** It runs today on public catalogue data, with no Registrar account and no login.

**On the slide:** Three phases, one line each. Phase 1, USG pilot on the public site. Phase 2, advisors review the data and the PDF. Phase 3, Experience USC embed. Under them: "Yearly update: `npm run refresh-catalogue`." And: "Running cost: TO SOURCE. No measured hosting bill and no measured token average are in the repo."

**Visual:** Three stacked bars, not a dollar chart.

## Slide 7 — What we ask, and who built it

**Say this:** We ask USG for a pilot on public data. We do not ask for Registrar access.

**On the slide:** The ask, then "What comes next: a person checks the accuracy rows, then more programs, labelled unverified until they are checked."

**Team strip, this slide only:** One blank per teammate. For each person write name, school, program, and what they built. Do not guess a name or pad the row. This strip is the only K1 material. Do not add a slide about Replit. Do not add a slide for honorable mention.

**Visual:** Those blanks in a single row under the ask. No headshots unless the person has agreed.
