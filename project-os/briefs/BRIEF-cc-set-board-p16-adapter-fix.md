# BRIEF (CC) — Set Board: the LAST fix — P1-6 in the live vision adapter

## 1. ROUTING + TARGET BRANCH
- **Executor:** Claude Code (CC). **Target:** `feat/chunked-generation` (`sh-wt-style01`).
- **⚠️ BRANCH PRE-CHECK (FIRST):** branch `feat/chunked-generation`; HEAD `c2b5607c` (confirm pushed); clean. Single session.
- **Gate:** board-approval integrity (offline mint QA only — NOT the paid render/resume path). Commit green; STOP. This is the LAST blocker before the mint.
- **Origin:** Codex re-gate round 2 = NO-GO, ONE remaining finding. All 4 P0 + P1-5 PASS (incl. Codex statically confirming the real chunk-runner is snapshot-gated).

## 2. SCOPE
Close P1-6 where it still leaks. The core `qaSetIdentityBoardImage` is correctly fail-closed (requires `{flags:string[]}`, fails any other shape). But the mint tool's LIVE vision adapter erases the evidence BEFORE the core sees it: `mint-set-identity-board.ts:167` coerces `parsed.flags` to `[]` when it isn't an array — so `{"result":"clean"}` / `{"flags":"none"}` / missing `flags` become `{flags:[]}` → `passed` → written to registry → approvable via `--approve` (`:346`, `:406`). Make a malformed vision response fail closed.

## 3. FILES / AREAS
- `scripts/mint-set-identity-board.ts:167` — do NOT coerce to `[]`. Either pass the RAW `parsed` to `qaSetIdentityBoardImage` (let the fail-closed core reject a bad shape), OR throw when `parsed.flags` is not a `string[]`. A missing/non-array/non-string-element `flags` → QA `failed`/`error`, never `passed`.
- `lib/generation-pipeline/chunk-runner.ts:2022` — P2 doc-only: fix the stale comment that wrongly says the flag is checked first (the snapshot is the authority now).

## 4. ACCEPTANCE CRITERIA
- A vision response of `{"result":"clean"}`, `{"flags":"none"}`, `{}` (missing flags), or `{flags:[1,2]}` (non-string elements) → QA `failed`/`error`, NOT written as approvable; `--approve` refuses it.
- A valid `{flags:["..."]}` (and `{flags:[]}` genuinely returned by the model) behaves exactly as today.
- The stale `chunk-runner.ts:2022` comment corrected.
- `npm run check` green (real toolchain — tsc via node).

## 5. TESTS
- An adapter-SEAM test (through the live adapter, NOT `qaSetIdentityBoardImage` directly — the existing tests hit the core and miss this bypass): missing `flags`, string `flags`, non-string-element `flags` → all fail closed.

## 6. WHAT NOT TO TOUCH
- The paid render/resume path, Stage-1 safety, money, reader, and the already-PASS fixes (P0-1..4, P1-5). Only the mint adapter + the one comment.

## 7. GIT HYGIENE
Explicit pathspecs only; NEVER `git add -A`. Commit on `feat/chunked-generation`; Guy pushes.

## 8. FINAL VERIFICATION
- `npm run check` green. Report the adapter fix + the seam test + the comment fix. Then STOP — this is the last item before the fox board mint.
