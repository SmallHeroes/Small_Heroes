# R1D Book Surface v9 — Implementation Evidence

**Date:** 2026-08-18
**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`
**Base:** `cf0c9534ed7fe4f56c94c0f784bb5fc984bb25f5`

## Implemented

- Added compiler-owned restoration of cover `worldType`, `locationId`, `zoneId`
  and ordered `castIds` after strict response parsing and before atomic apply.
- Preserved semantic cover repair authority for `timeOfDay`, `mustShow` and
  `mustNotShow`.
- Kept malformed identity shape fail-closed.
- Advanced Book Surface system/user prompts to v9 and advanced the bound current
  authoring/Fresh chain; prior request/receipt/readiness versions are registered
  legacy immutable.
- Added direct hostile-identity, malformed-shape and full compiler Candidate
  regressions.

## Validation

- Book Surface + repair loop + lifecycle: **157/157 PASS**.
- Canonical boundary/materialization/verification/Supervisor/Fresh: **327/327
  assertions PASS**. Vitest reported two known post-assertion `onTaskUpdate` RPC
  timeouts; no test assertion failed.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.

## Unchanged

No model, tier, reasoning, pricing, hard cost fence, standard call/repair count,
retry, fallback, schema, Candidate, image generation, renderer, payment,
deployment or production behavior changed. Implementation validation used no
credential, provider, network, Fresh, live or image call.

This document is implementation evidence, not independent QA, render quality or
product acceptance.
