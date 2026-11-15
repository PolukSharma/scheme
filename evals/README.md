Owner: Verification. Golden cases and the accuracy runner.

`npm run accuracy` compares saved catalogue pages with `data/programs` and rewrites `evals/accuracy.json`. `npm run hand-accuracy` scores the engine against the hand rules in `evals/hand-rules.ts` and rewrites `evals/hand-accuracy.json`, `evals/REPORT.md`, and `docs/submission/pitch.md`. Either command with `--check` fails when its files drift. The engine is called and not modified. STARS remains the official audit.
