# R4: preserve returned page images before asynchronous review

## Proposed change and reason

Close R3-F1 in the prospective native CDE boundary. A returned image must have a diagnostic record before its pixel/identity review or the following guard can stop. Reporting then resolves completed, halted and returned-but-unreviewed candidates without treating pixels as approval. R3 independent PASS remains specific to d5baa1d9; its newly discovered sibling is not covered by that PASS.

## Scope, root cause and smallest solution

The current adapter persists image bytes, but native in-memory saved records are only completed page_N or selected unusable-review halted_page_N. Lost/fatal reviews leave neither. Rather than add error-code-specific catches, wrap the actual native CDE render callback and save a versioned drawn_page_N candidate immediately after successful return. This is diagnostic evidence, never a selected/approved page or a retry input. Reuse the same callback for the later page-only boundary.

Report one record per logical frame, preferring completed > halted > drawn > diagnostic, retaining drawing order. The real stopped viewer falls back to returned candidates and marks them review incomplete and not approved. Exclude failed renders with no returned image, reference sheets and invalid frame names. Unmarked execution and saved historical bytes remain unchanged.

Continue this root chat and claude/book-render-20261009 at C:/GNart/Work/sh-book-render-20261009, base d5baa1d9e39fb4877f7d7fdaa095d64e6ef7317d. Codex is sole implementer; Guy manually forwards the frozen correction to Claude Code for first-pass read-only review. No new chat/worktree is needed for this bounded milestone.

## Files, validation and acceptance

scripts/personal-book-e2e-trial.ts; native-book-continuity.spec.ts and simple-book-reviewed-audition.spec.ts; CURRENT.md, ROADMAP.md and this gate. Reproduce with the real audition engine and actual native stopped viewer: nonfatal lost review, unknown-cost review, transport loss, lost identity and cancellation after return. Preserve the exact fatal error, no extra callback/retry/narration, prior completed pages, pending/UNKNOWN accounting, and legacy behavior. Run relevant 18 specs, both nonincremental TypeScript gates, bounded negative controls, original nine-review replay and 321-file hash preservation. Make a focused local commit with explicit paths, then freeze a manual re-gate. Full historical npm check is not declared green.

## Stop-check, exclusions and rollback

General reporting/observability correction, not a story/child/companion patch. Native experimental path only, opt-in; no production customer pipeline or prompt/layout redesign. Zero provider/image/audio calls or key/.env reads; no paid retry, cost reset, new grant/cycle, server, push/merge/deploy, automatic Claude transfer or cleanup. Identity threshold stays0.70. R17 and all old assets, narration, claims, grants and accounting remain immutable. Rollback is a focused future revert, not reset/deletion. No unresolved product/creative decision is needed for truthful diagnostic retention; owner visual acceptance remains separate.

## Follow-up boundary

After this local correction, prepare a separate general page-only envelope at $0 for the already approved at-most-two LOW images / cumulative1,000,000 microUSD including reviews and full pending/UNKNOWN reserves. It must use exact admitted existing source/references, prohibit remaining pages/narration/retry and fail closed if those inputs do not exist. Both steps need independent re-gate before paid dispatch. This gate does not itself authorize a paid call.
