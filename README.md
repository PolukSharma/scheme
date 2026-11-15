# Scheme

Unofficial degree what-if planner for USC students. STARS is the official audit. This repository is a planning aid and is not affiliated with USC.

`docs/project-context.md` was not present when this scaffold was added. Shared types live in [`contracts/`](contracts/README.md). Synthetic rows live in `evals/fixtures/`. Do not commit a real STARS report.

## Scripts

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
```

`npm run fixtures` rewrites the synthetic JSON in `evals/fixtures/`.

Pull requests run lint, type-check, and tests in `.github/workflows/ci.yml`.

The product name in the interface is the shared `Wordmark` component (`components/wordmark.tsx`). The letters `Sc` are `#990000`.
