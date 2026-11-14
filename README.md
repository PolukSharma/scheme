# Scheme

USC students work out whether they can add a minor or switch a major by reading a STARS report against the catalogue, or by waiting for an advising appointment. Scheme is a planning aid: a student enters a major and start year, adds a STARS report or picks a sample student, and sees which programs add the least extra time. It supports advisors and does not replace them. STARS remains the official audit.

This repository is the skeleton. Rankings on the home page come from an engine stub and from invented `DEMO` courses, so nothing on that page is a USC rule. Real catalogue data, the degree engine, the in-browser STARS parser, and the AI features land in later pull requests.

## Run it

```bash
npm install
npm run dev
```

Open the local URL Next prints. `npm test` checks the fixtures and the stub. `npm run lint`, `npm run typecheck`, and `npm run build` are the same checks CI runs.

Copy `.env.example` to `.env` when the AI layer needs `AI_API_KEY`. The skeleton does not call a model, and sample students work with the key missing.

## What is here

Shared types and validators live in `lib/types/`. The engine signatures live in `lib/engine/index.ts` and are written out in `docs/contracts.md`. Fixtures under `fixtures/` are an invented department, `DEMO`, with 3 programs, 40 courses, and 3 sample students.

| Path | Owner |
| --- | --- |
| `lib/types/`, `fixtures/`, `docs/contracts.md`, CI | Foundations and deploy |
| `data/` (except `data/samples/`), `scripts/` | Program data |
| `lib/engine/` | Engine |
| `lib/stars/`, `components/intake/`, `data/samples/` | STARS intake |
| `app/` (except `app/api/`), `components/` (except `intake/`) | Web experience |
| `app/api/`, `lib/ai/` | AI layer |
| `evals/` | Verification |
| `docs/submission/` | Submission pack |

Colours other than cardinal `#990000` on the letters “Sc” in the Scheme title are placeholders. The Web experience agent should replace type and colour from USC’s published brand guidelines and link the page they used.

## Privacy

A STARS report will be parsed in the browser and will not be uploaded. Do not commit a real report, even a redacted one. Use `fixtures/` and, later, `data/samples/`. The `private/` directory is gitignored.
