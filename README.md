# Scheme

USC students work out whether they can add a minor or switch a major by reading a STARS report against the catalogue, or by waiting for an advising appointment. Scheme is a planning aid: a student enters a major and start year, adds a STARS report or picks a sample student, and sees which programs add the least extra time. It supports advisors and does not replace them. STARS remains the official audit.

The home page ranks programs with the engine and the catalogue files in `data/`. A sample student is two taps from the landing page. A STARS report is parsed in the browser and is not uploaded. Career matching and chat call `/api/career` and `/api/chat` when those routes exist, and stay on the engine when they do not.

## Run it

```bash
npm install
npm run dev
```

Open the local URL Next prints. `npm test` checks the fixtures, the engine, and the screens. `npm run lint`, `npm run typecheck`, and `npm run build` are the same checks CI runs.

Copy `.env.example` to `.env` when the AI layer needs `AI_API_KEY`. Sample students work with the key missing.

## What is here

Shared Zod schemas live in `contracts/`. The running app still imports `lib/types/`. The engine signatures live in `lib/engine/index.ts` and are written out in `docs/contracts.md`. Fixtures under `fixtures/` and `evals/fixtures/` are an invented department, `DEMO`, with 3 programs, 40 courses, and 3 sample students. The product name in new UI is `components/wordmark.tsx`.

| Path | Owner |
| --- | --- |
| `contracts/`, `lib/types/`, `fixtures/`, `evals/fixtures/`, `docs/contracts.md`, CI | Foundations and deploy |
| `data/` (except `data/samples/`), `scripts/` | Program data |
| `lib/engine/` | Engine |
| `lib/stars/`, `components/intake/`, `data/samples/` | STARS intake |
| `app/` (except `app/api/`), `components/` (except `intake/`) | Web experience |
| `app/api/`, `lib/ai/` | AI layer |
| `evals/` | Verification |
| `docs/submission/` | Submission pack |

## Prizes

Names and awards are copied from the organizers' Devpost page (https://ai-usc.devpost.com/) and rules (https://ai-usc.devpost.com/rules), read Saturday, November 14, 2026. The rules say prizes may be updated before the event. Placement is the target. The mapping of each prize to a sentence, slide, or screenshot, and the decision to skip Best Use of Replit, is in `docs/submission/README.md`.

| Prize | Award, as published |
| --- | --- |
| 1st place | $8,000 cash to the team. Judged on the four rubric criteria. |
| 2nd place | $4,000 cash. Same rubric. |
| 3rd place | $2,000 cash. Same rubric. |
| Best Use of Replit | AirPods Pro 3 for each team member, up to 4. "Awarded by Replit to the project that makes the best use of Replit." |
| Honorable Mention | An Arc'teryx backpack for each team member, up to 4. "Awarded to a standout project that judges want to recognize beyond the top three." |
| K1 Investments Career Prize | A PS5 for each team member, up to 4, plus consideration for roles with K1 Investment Management and a pre-interview lunch with Managing Partner Hasan Askari. No criteria published. |

Colour and type follow USC’s published brand guidelines. [Colour](https://identity.usc.edu/identity/color/) sets USC Cardinal `#990000`, USC Gold `#FFCC00`, black `#000000`, white `#FFFFFF`, and gray `#767676` (70K). In every title, the letters “Sc” in Scheme are cardinal and the rest of the word is black. Gold is a bar, not text, because gold on white does not meet WCAG AA. [Typography](https://identity.usc.edu/identity/typography/) names Adobe Caslon Pro and National 2, and names Source Sans 3 as the digital substitute for National 2. This app uses Source Sans 3. Adobe Caslon Pro is not embedded. Tertiary colours are not used for text.

## Privacy

A STARS report will be parsed in the browser and will not be uploaded. Do not commit a real report, even a redacted one. Use `fixtures/` and, later, `data/samples/`. The `private/` directory is gitignored.
