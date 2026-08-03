# R1D-PVB-D1A1B1 Action Semantic Capability-Gap Hardening — Implementation Evidence

**Status:** original and QA-fix ranges independently PASSed; MINOR-1 and MINOR-2 closed
**Date:** 2026-08-03
**Immutable base:** `01a117570c0ee7c4e3de8d138ae1a8db4d8a00fa`
**Branch:** `codex/r1d-pvb-d1a1b1-action-semantic-capability-hardening`
**Worktree:** `C:\Users\guyna\.codex\worktrees\a7ee\Small_Heroes`
**External cost/actions:** `$0`; none

## Outcome

The closed Action Semantic authority now supports typed entity or exact Source-Evidence phenomenon subjects, cast-only intransitive `sneezes`, phenomenon-capable `touches`, and typed-subject `moves` with a required directional or relation/target spatial result. Every participant resolves locally and exactly. `pushes` cannot substitute for `moves`, and unsupported semantics remain terminal and repair-ineligible.

Blueprint consumes the full typed action and proves participant support, action space, action placement, spatial directions/relations, target regions, and destination placement. Its capacity limit counts unique cast subjects only. Runtime book/frame projections preserve that structural authority.

The lifecycle chain is fail-closed at current versions. The `visual-package/v4` family remains unchanged while its embedded approval, candidate, review, freeze, qualification, Blueprint, and runtime binders move forward. An explicit v1→v2 template migration clones and validates historical evidence; runtime loaders still reject the original bytes as current and never auto-migrate them.

## Independent QA and closed narrow correction

Claude Code independently reviewed exact immutable range `01a117570c0ee7c4e3de8d138ae1a8db4d8a00fa..d31c6021c8196bb31687d83c696feefcfde9d1a1` and returned technical **PASS** with zero BLOCKER, zero MAJOR, two non-blocking MINOR findings, and seven advisory notes. It independently ran repository-local TypeScript, complete-range `git diff --check`, 31 files / 763 tests across the changed specs plus repair-guard spec, and 13 files / 177 tests across the residual historical-v1-fixture consumers. This is Claude Code's range-scoped verdict; Codex does not self-award independent PASS.

Claude Code then independently reviewed exact correction range `d31c6021c8196bb31687d83c696feefcfde9d1a1..b4544a79c00ba4328a5c4af12778a3375cb36804` and returned **PASS**. It verified the exact one-commit/five-file topology, clean target worktree, absent upstream/same-name remote, **2 files / 49 tests PASS**, repository-local TypeScript exit `0`, and correction-range `git diff --check` exit `0`. **MINOR-1 and MINOR-2 are closed; zero BLOCKER, zero MAJOR, and zero MINOR remain in the correction range.**

- **MINOR-1 — closed by independent re-gate:** enforcement already required `style01-runtime-authority/v5`, but the `runtime_authority_missing` diagnostic named v4. The corrected diagnostic names `style01-runtime-authority/v5`; a direct exact-message assertion covers both absent authority and a stale v4 value, preventing required-version/message drift.
- **MINOR-2 — closed by independent re-gate:** the new `source_evidence_id_repair_action_not_unique` guard lacked direct coverage. Tests exercise zero and two actionRequirements matching the bound check ID. A `source_phenomenon` positive control compares the complete output to an expected clone in which only coverage and subject Source Evidence IDs differ, explicitly preserving predicate, object, `spatialEffect`, polarity, laterality, check ID, coverage disposition, and every other action field while proving the input object remains unchanged.
- The authorized QA fix did not rerun `npm run check`; the original full-check limitation below remains unchanged.
- The three micro re-gate observations are advisory only, explicitly require no action, and are not findings. They do not alter either independent PASS, either closed MINOR disposition, or N1–N7.

### Advisory limitations N1–N7

- **N1 — schema-depth headroom:** Visual Contract draft schema v10 has depth 9 against the Structured Outputs profile limit of 10, leaving one level of headroom after the subject/spatial additions.
- **N2 — duplicated object-kind values:** `PHYSICAL_OBJECT_KINDS` is currently value-identical to `ACTION_SEMANTIC_ENTITY_KIND_VALUES`; a future entity-kind expansion could make them silently diverge.
- **N3 — unreachable legacy readers:** tolerant `actorId` readers remain in `pageCheckIds.ts` and `projectContractProse.ts`, including the `unresolved:legacy_actor` prose sentinel. Both are unreachable for v2-validated contracts; the prose reader nevertheless feeds the image-prompt block if that invariant is ever bypassed. This QA fix does not remove them.
- **N4 — migration exposure by convention:** the offline v1→v2 migration is re-exported from the public barrel. No production caller exists, so the statement that runtime loaders never invoke it currently holds by convention rather than structural inaccessibility.
- **N5 — pre-existing unqualified batch callers:** `generateAllPageImages` has pre-existing callers outside the qualification wrapper in `lib/qa-console-run.ts`, `app/api/dev/story-bank/route.ts`, debug routes, and `scripts/run-guarded-v2-risk-pages.ts`. They were not introduced by this range; the debug routes are non-production per repository guidance, while the dev story-bank route is not explicitly scoped out.
- **N6 — full-check residual empirically closed with a boundary:** the 43→(27+12+4) classification was transcript-only. Claude identified and ran all 13 historical-v1-fixture consumer specs outside the changed/rerun set; all 177 tests passed because the bytes enter as draft input and are normalized. Database/network-dependent `*.staging.spec.ts` tests were not run and remain unverified by that review.
- **N7 — test-worker environment:** vitest-worker `onTaskUpdate` RPC timeouts appeared under parallel load in a worktree whose `node_modules` is junctioned to the source worktree. Claude classified this as an environment artifact, not a regression.

N1–N7 remain advisory limitations only. They do not expand the authorized correction and do not grant product, visual, Visual Contract candidate, Blueprint approval, Wizard product acceptance, render/readiness, live-authoring, release, or deployment acceptance. Closeout intake reverified exact clean target `HEAD` `b4544a79c00ba4328a5c4af12778a3375cb36804`, the expected branch, and absent upstream/same-name remote. The sandbox's `safe.directory` ownership checks limited a fresh non-target worktree status sweep; no global Git configuration changed, unreadable non-target worktrees were skipped, and no non-target state was touched.

## Versioned authority

| Authority | Current version |
| --- | --- |
| Action Semantic Catalog / Coverage | `action-semantic-catalog/v2` / `action-semantic-coverage/v3` |
| Visual Contract / draft schema | `vc-schema/v2` / `vc-draft-schema/v10` |
| Blueprint / draft schema | `pre-render-book-visual-blueprint/v3` / `pre-render-blueprint-draft-schema/v4` |
| Blueprint authoring authority and lifecycle evidence | `v2` |
| VC request / receipt / readiness / candidate | `v7` / `v6` / `v4` / `v4` |
| Visual Package family | `visual-package/v4` |
| Package locator / candidate / review / approval / freeze / offline qualification | `v2` / `v2` / `v2` / `v3` / `v2` / `v2` |
| B0 materialization input / manifest / verification | `v3` / `v5` / `v5` |
| Execution Request / readiness / result | `v4` / `v4` / `v2` |
| Execution Request materialization input / result | `v2` / `v2` |
| Pre-live readiness evidence / failure | `v4` / `v2` |
| Approved PVB / Style01 runtime authority | `v5` / `v5` |
| Runtime Blueprint book / frame / frame evidence | `v2` / `v2` / `v2` |

## Three green milestones

1. `630ba4db` — Action contract/catalog/compiler/validators, Source Evidence binding, projections/check IDs, neutral and calibration tests. Gate: **10 files / 256 tests PASS**, TypeScript PASS, diff check PASS.
2. `8ce86273` — Blueprint schema/types/authoring/validation/feasibility and focused tests. Gate: **9 files / 386 tests PASS**, TypeScript PASS, diff check PASS.
3. Lifecycle/runtime/Wizard migration — current version/digest chain, explicit historical migration, package/B0/execution/readiness binders, runtime projections, Wizard qualification, `CURRENT.md`, and this evidence. This record is included in the third focused commit.

## Validation evidence

### Action and Blueprint gates

- Action gate: **10 files / 256 tests PASS**.
- Blueprint gate: **9 files / 386 tests PASS**.
- The tests cover all three semantic classes, subject/object/spatial resolution, exact same-page phenomena, prop lifecycle, exact sanitized gaps, compact-repair exclusion, prose/check IDs, push non-substitution, Blueprint action placement and destination feasibility, and cast-only `maximumActors`.

### Lifecycle and Wizard gate

- Lifecycle/runtime gate: **14 files / 353 tests PASS**.
- The exact Wizard qualification test uses `MEDICAL_PROCEDURE × adventure`, resolves the real approved 12-page Story Source through product truth, freezes its exact raw digest, publishes only a test-temporary immutable `visual-package/v4`, loads that exact frozen revision, and projects cover plus twelve page frames into `runtime-blueprint-book-projection/v2`.
- A stale order/source binding is then passed through `runWithStyle01RenderQualification`; the injected provider sentinel remains uncalled. Static chunk-runner assertions prove both cover and page provider entries are nested under that qualification wrapper. `fetch` remains unreachable.
- Historical template migration and stale full-check fixture repairs: **6 files / 72 tests PASS**. The original tracked v1 bytes are re-read after migration and proven unchanged, while the current loader rejects them.

### TypeScript, full repository check, and diff integrity

- Repository-local `npx --no-install tsc --noEmit`: **PASS** after all code changes.
- Exactly one literal `npm run check` ran. TypeScript passed. Its Vitest snapshot reported 49 failures: the six established absent ignored-fixture baseline failures plus 43 newly exposed stale test assumptions that treated immutable `vc-schema/v1` artifacts as current authority.
- Those 43 were fully accounted for as 27 `visual-package-lifecycle`, 12 bunny/fox historical-template, and 4 adjacent direct-template failures. They were corrected through explicit in-memory migration and rerun at **6 files / 72 tests PASS**. The literal full check was not rerun, preserving the exactly-once instruction. No milestone failure remains in the reproduced failure inventory; the six established ignored-fixture failures remain the repository baseline.
- Final focused aggregate after the correction: **20 files / 425 tests PASS** (required before commit).
- `git diff --check`: passed before the third commit and final handoff and was independently reproduced by Claude Code for the complete implementation range. Working, staged, and committed QA-fix range checks are recorded at correction handoff.

## Unchanged fences

- `gpt-5.6-sol`, Responses API, service tier, prompt budget, 64K input ceiling, output limit, timeout, maximum three calls, maximum two repairs, zero transport retries, no fallback, accounting, and hard `$5.00` ceiling;
- Source Evidence compact repair remains ID-only and cannot handle semantic gaps;
- visual-package family remains `visual-package/v4`;
- per-page resemblance threshold remains `0.70`;
- no story-specific production literal or special-case predicate mapping.

## Zero-external-action record

No credential loading/check, pricing/docs/network lookup, provider/model call, live authoring, real B0 or readiness execution, render, image/Vision/audio, storage/database, Board action, Semantic Reconciliation, approval, publication, promotion, production activation, deployment, PR, or push occurred. Test publication was confined to a uniquely created temporary directory and removed by the test. Cost was exactly `$0.00`.

## Limitations, rollback, and next gate

- This is repository-local technical qualification only. It creates no candidate, Semantic Reconciliation, product/visual acceptance, render readiness, production authority, or launch decision.
- Revert the narrow QA-fix commit to remove only the diagnostic/test/documentation correction; revert the three original local commits to roll back the implementation. There is no external state to unwind.
- Codex does not self-award either PASS. The original immutable implementation range and separate QA-fix correction range carry Claude Code's independent technical PASS verdicts.
- MINOR-1 and MINOR-2 are closed. N1–N7 and the three no-action micro observations remain advisory and out of correction scope. No additional Claude Code round is required unless this closeout transcription is factually disputed.
