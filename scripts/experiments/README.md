# scripts/experiments/

One-off QA / validation / repro scripts from engine milestones (J2, J2.5, 0046–0048, etc.).
Not part of the production golden path — kept for reproducibility.

Run with the server-only shim from repo root, e.g.:

```bash
npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs scripts/experiments/run-j2.5-r2-validation.ts
```
