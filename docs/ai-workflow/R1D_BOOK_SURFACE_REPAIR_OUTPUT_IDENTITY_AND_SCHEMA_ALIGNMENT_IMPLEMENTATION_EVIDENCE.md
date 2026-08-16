# R1D Book Surface Repair-Output Identity and Schema Alignment — Implementation Evidence

**Date:** 2026-08-16

**Branch:** `codex/r1d-book-surface-repair-output-identity-schema-alignment`

**Worktree:** `C:\Users\guyna\.codex\worktrees\repairidentity3\Small_Heroes`

**Base:** `425ffccefad1421c0a45a68cf9dbd60fba585d49`

**Code commit:** `3fc0dbb4`

**Independent QA:** technical PASS for
`425ffccefad1421c0a45a68cf9dbd60fba585d49..bd9e1d2623eff0e7c6617439fcf56835593abd2c`;
zero BLOCKER, zero MAJOR, three non-blocking MINOR findings

## Problem and evidence boundary

The preceding exhausted live attempt completed a Book Surface repair response
but produced no candidate. Claude Code's read-only artifact audit found that
the receipt retained only `repair_output_application_rejected`; the exact safe
compiler identity was lost. It also found that two Book Surface recurring-prop
failures were collapsed into the broad application bucket, the provider schema
admitted values rejected by deterministic application, and the persisted count
did not distinguish 39 carried draft diagnostics from the one repair-output
failure.

This milestone treats the consumed receipt and readiness as immutable historical
evidence. It does not rewrite, migrate or recalculate either artifact.

## Implemented behavior

1. `templateRepairOutputDiagnostics.ts` owns a closed catalog of every safe
   repair mode, broad failure code and compiler-generated repair-output identity.
   Unknown errors collapse to `unclassified`; arbitrary error messages never
   cross the persistence boundary.
2. `TemplateRepairOutputInvalidError` now carries the sanitized exact identity
   together with repair attempt, mode and broad failure code.
3. The broad taxonomy adds `recurring_prop_invalid`. Both
   `book_surface_repair_prop_invalid` and
   `book_surface_repair_prop_change_not_authorized` map to that class without
   losing their distinct exact identities.
4. Visual Contract terminal failures gain exact-key
   `visual-contract-repair-output-diagnostics/v1` containing:
   `repairAttempt`, `repairMode`, `failureCode`, `identity`,
   `carriedDraftDiagnosticCount` and `repairOutputDiagnosticCount: 1`.
5. The Visual Contract-specific validator binds those fields to terminal code,
   diagnostic code and capped aggregate count. The shared
   `authoringTerminalFailureIsValid` exact shape and count semantics are
   unchanged; its closed diagnostic-code enum gains the required
   `repair_output_recurring_prop_invalid` member and remains closed. Blueprint
   receipt v4 is unchanged.
6. The shared structured-output schema requires a non-whitespace recurring-prop
   ID and a positive integer page number. These constraints apply before
   provider dispatch to every draft/repair schema that reuses the members.

## Authority migration

| Authority | Prior | Current |
|---|---:|---:|
| Visual Contract draft schema | v14 | v15 |
| Page Contract repair schema | v1 | v2 |
| Structural Bundle repair schema | v1 | v2 |
| Book Surface repair schema | v2 | v3 |
| Authoring request / receipt / readiness | v27 / v30 / v28 | v28 / v31 / v29 |
| Live materialization input / manifest / verification | v16 / v25 / v25 | v17 / v26 / v26 |
| Execution materialization input / result | v15 / v19 | v16 / v20 |
| Supervisor request / readiness / result | v24 / v24 / v16 | v25 / v25 / v17 |
| Canonical Fresh Readiness evidence | v24 | v25 |

Immediate predecessors classify as `legacy_immutable`. Later unknown versions
remain unsupported. Prompt versions, OpenAI evidence/provider-failure evidence,
Blueprint v4 and candidate artifacts are unchanged because their shapes did not
change.

## Security and privacy properties

- Only a closed compiler identity or `unclassified` is persisted.
- Tests prove raw prose-like errors are not promoted into the identity field.
- Receipt/readiness round-trips preserve the exact typed diagnostic through
  canonical JSON key sorting.
- Extra/missing keys, duplicate or reordered items, count/truncation drift,
  failure-code mismatch, invalid locator and unknown identity are rejected.
- No raw prompt, response, provider message, source phrase, authored identifier,
  stack, path, credential or secret is introduced into the evidence shape.

## Validation

Focused validation completed before the repository gate:

- compiler/diagnostic set: 4 files / 118 tests PASS;
- exact lifecycle persistence regression: PASS;
- final prompt-compaction and complete source lifecycle set: 2 files / 81 tests
  PASS;
- Supervisor and live-request verification set: 2 files / 84 tests PASS;
- deterministic `npx --no-install tsc --noEmit`: PASS;
- `git diff --check`: PASS before stage and for the staged code range.

The first broad version-propagation run exposed two stale exact-byte assertions
in the prompt-compaction spec. This was the expected effect of the intentional
schema constraint change, not a production failure. Only the frozen
measurements were updated and the affected set then passed. Current production
measurements are:

- Fox: 50,260 estimated units; 13,740 headroom;
- worst-case Lion: 53,684 estimated units; 10,316 headroom;
- all 18 registered sources remain below the unchanged 64K ceiling;
- schema delta: +43 bytes;
- schema digest:
  `9732f88a64e0ab9e65dd80d041e3797afec105bdab74ceab168a9a9aaf02fe92`.

### Single repository gate

Literal `npm run check` was invoked exactly once and was not retried.

- TypeScript and autonomous-story typecheck: PASS.
- Canonical inventory: 300 files = 281 ordinary + 19 resource-intensive.
- Ordinary: 261 files passed, 16 skipped and 4 failed; 3,196 tests passed,
  65 skipped and 5 failed.
- Resource-intensive: 19/19 files and 577/577 tests PASS at the repository's
  bounded policy; diagnostics were valid and reported no timeout, RPC/IPC,
  reporter, launch, signal, termination, teardown or protocol failure.
- The five ordinary failures are missing ignored historical artifacts only:
  `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`,
  `page-entity-qa.spec.ts` and two cases in
  `story-read-back-validation.spec.ts`.

The repository historically recorded six fixture assertions in five files.
The former sixth case, `set-appearance-ref-budget.spec.ts`, was changed by
pre-base commit `7763ae2e5cc2820528762865d8bf3cf17bc13cf2` to build its board
fixture in an isolated temporary directory. That test now passes without the
historical ignored PNG. The current release HOLD is therefore the five directly
observed assertions above. No missing fixture was copied, manufactured or
waived, and the full gate was not rerun.

## Unchanged behavior

- model, Responses API endpoint, service tier and reasoning;
- system/user prompts and prompt budgets;
- 64K input ceiling and 4,096-unit admission margin;
- three logical calls, two repairs and existing terminal allowance;
- timeout, zero transport retry and no provider fallback;
- nominal/conservative accounting and hard `$5.00` ceiling;
- repair routing, candidate semantics, Blueprint v4, Wizard and rendering.

## Rollback and next gate

Rollback is a focused revert of code commit `3fc0dbb4` and its documentation
closeout. It requires no artifact or database migration. Any readiness created
under the new authority versions becomes inapplicable after rollback; historical
evidence remains byte-immutable.

Claude Code independently reviewed the exact base-to-head range and returned
technical PASS. That review independently reran the 4-file/118-test,
2-file/81-test and 2-file/84-test sets, TypeScript and `git diff --check`. The
second Supervisor pair passed on a clean rerun after one pre-existing flaky
filesystem-fence observation. Claude did not rerun the single-use repository
gate and verified the five-fixture baseline explanation from Git history.

The review recorded three non-blocking MINOR findings:

1. Repair-input construction failures inside dispatch are currently attributed
   to repair-output validation. Correcting this generally requires a distinct
   `repair_input_invalid` terminal/phase, evidence binding, authority-version
   cutover and new Fresh Readiness; it is deferred to a separate Decision Gate.
2. Known exact identities are not yet validator-bound to their one canonical
   broad failure code. Future hardening should expose and enforce the pure
   identity-to-code mapping while retaining broad-code freedom for
   `unclassified`.
3. The original documentation overstated that the shared validator was wholly
   unchanged. This closeout corrects the claim: its structural/count semantics
   are unchanged, while its closed diagnostic-code enum intentionally gains one
   member.

The first two findings are retained under future milestone
`R1D-REPAIR-INPUT-ATTRIBUTION-AND-IDENTITY-CODE-BINDING-HARDENING`; they do not
reopen or block the technical PASS for this range. Advisory notes remain: the
Supervisor-pair filesystem fence can be flaky; `diagnosticCountOverride` is
redundant but correct; and the pre-existing Book Surface input-roundtrip throw
outside the dispatch `try` remains out of scope.

The reviewed head may now be pushed and used only to prepare a brand-new
zero-cost Fresh Readiness. This PASS grants no live, candidate, Reconciliation,
Blueprint, Wizard, render, QA deployment, Production or release authority.

## Exclusions and cost

No credential was opened or checked. No pricing lookup, network/provider/model
call, B0/Fresh Readiness, canonical preflight, live authoring, candidate,
image/Vision/render, storage/database/Supabase, Board, publication, deployment
or push occurred. External cost: `$0`.
