# R3-B1b semantic recovery M1a — source-bound cast foundation

Historical implementation evidence below describes `768ccb2f..081410dd`.
Claude Code subsequently independently passed that exact range with
P0=0/P1=0/P2=2, reproducing 153 focused + 198 additional legacy tests and both
typechecks. The optional-marker and final-full-check P2s are addressed in
`R3B1B_SEMANTIC_RECOVERY_M1A_P2_CORRECTION_EVIDENCE.md`; they are not claimed
independently closed by Codex. The earlier full run is not the final corrective
tree's evidence. In particular its stale 383-file inventory assertion was a
real M1a regression (two new specs), not an inherited baseline failure.

Date: 2026-09-06. Status: M1a IMPLEMENTED; FOCUSED VALIDATION GREEN;
FULL CHECK NON-GREEN; INDEPENDENT QA PENDING. M1/M2 NOT COMPLETE.

## Requirement, authority and exact scope

Guy approved the provider-free semantic-recovery Gate and both visual choices:
cake/cart visible on cover, tablecloth forbidden, and cart visibly parked by
the p12 serving area. Claude Code independently closed planning P2s with PASS
P0=0/P1=0/P2=0 for `581adc14..768ccb2f`. Codex does not self-award QA PASS.

Current task: sole M1a writer. Branch `codex/r3b1b-semantic-recovery-m1`;
worktree `C:/GNart/Work/sh-r3b1b-semantic-m1`; immutable base
`768ccb2fe20edb1351cb4783796613cbf7a2993c`. It was created clean, without an
upstream, from the reviewed/pushed base. Final handoff supplies the exact head.

Read-only dependencies: d53b worktree, branch
`codex/r3b1b-p1-a1-post-cardinality-authoring`, clean 0/0 at `768ccb2f`;
`C:/GNart/Work/sh-r3b1b-accepted-intent-wave-2`, branch
`codex/r3b1b-accepted-intent-wave-2`, clean 0/0 at `63ccb484`.
No overlapping task, new app task, branch deletion or worktree deletion.
The new worktree reuses the existing d53b `node_modules` through a new local
junction. No install or env/credential copy. Focused tests use `--no-cache`;
the normal full-check command may use its ordinary dependency cache.

M1a is a bounded submilestone, not the whole M1. The inspected schema boundary
requires coordinated changes to groups, persisted contract shapes, validators,
prose, Blueprint/runtime and catalog bindings. Rather than claim those are
implemented by adding a group label, this foundation keeps unsupported classes
closed before the injected compiler caller. M1b owns group rendering and fast
motion, after foundation QA. M2 owns atomic P1 recovery, coverage changes,
cover/cart application and effective bridge artifacts. Existing owner approval
covers the sequence; downstream/spend gates remain separate.

## Observed cause and implemented change

The extractor's closed three-role lexicon omits source-accepted supporting
people. The compiler builds cast exclusively from those facts, and unknown
roles lack appearance policy. Its old `id OR role` draft lookup can also take
the wrong descriptive fields when two distinct people share a role.

- `supportingCastReview.ts`: strict, bounded `supporting-cast-review/v1` input;
  separate individual/group/non-human variants; exact same-page source or
  accepted integrated Visual Direction quotes; identity, gender, presence and
  relationship evidence; collision checks including known child/companion and
  reserved family identities. No guessed group count, member gender or family.
- `acceptedSupportingCastReview.ts`: prepare/load operations rebuild the source
  snapshot through the existing strict accepted-revision loader. Bind snapshot,
  accepted revision and authority, source digest, Visual Directions raw SHA and
  the entire compiler input. Loading a serialized review recomputes all of it,
  so changing a lineage field and rehashing is insufficient. No persistence.
- The shared fact assembler combines review individuals with extractor facts;
  conflicting identity, role, gender or removal of known page presence fails.
  No candidate prose is used to discover people. Non-individual entries stay
  classified and cannot silently become one human.
- The real template compiler's explicit preview dependency reloads accepted
  authority, checks input binding, isolates the source across asynchronous
  caller boundaries and rejects unsupported classifications before its caller.
  Current paid lifecycle calls do not supply this dependency.
- Explicit reviewed non-relatives can use deterministic palette traits with
  an audited generic hair policy. Family restrictions remain strict; unknown
  unclassified roles still fail. Default legacy appearance provenance remains
  `role-policy/v2`; review previews report `reviewed-cast-appearance/v1`.
- Draft descriptive fields match exact IDs first. Shared-role fallback is
  allowed only when one fact has that role; a missing person's clothes are not
  borrowed from another person. Missing garments remain missing, not invented.
- Preview result carries `supportingCastReviewDigest`. The current
  `buildVisualContractCandidateArtifact` rejects it before paid-candidate
  creation. Its existing current-catalog assertions remain strict.

## Meaning and limitations of the review input

`source_bound_review_required` is deliberately not an approval state. Citation
and digest checks cannot prove that a quoted sentence logically establishes
gender/classification, or that a human-authored inventory omitted no one.
Those semantic/completeness claims still require independent/source review.
The core pure builder checks shape/citations; canonical accepted authority is
established by the package loader, which the compiler preview calls afresh.
Do not bypass that loader with a rehashed object and call it accepted authority.

The P1-backed integration fixture exercises only the individual plumbing. Its
scene, coverage and apron are synthetic test scaffolding, NOT a faithful P1
recovery or an accepted visual design. No claim that all six semantic findings
are closed, that a group can render, or that an arbitrary full story is ready.
The omission regression deletes an already source-bound person and all its
page IDs while leaving prose without that person; the fact invariant rejects
it. It is not an automatic detector for an omitted review-input entry.

## Consumer and version inventory / dispositions

Paths below are relative to the execution worktree. This inventory is for
M1a's unchanged persisted shapes; M1b must expand the contract/group consumer
proof before its schema cutover. `humanCast` and cast-reference searches also
include the additional filenames flagged informationally by Claude Code.

| Consumer | M1a disposition / reason |
| --- | --- |
| `lib/visual-contract-compiler/extractDeterministicFacts.ts` | Add optional in-memory reviewed class; legacy lexicon/extraction behavior unchanged. |
| `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts` | Preview binding and fact assembly, class injection, exact-ID match, rejection before caller. |
| `lib/visual-package/visualContractAuthoringLifecycle.ts` | Reject preview in paid factory; default authoring request/receipt path unchanged. |
| `lib/visual-package/acceptedStorySourceAuthoringAuthority.ts`, `storySourceAuthority.ts` | Reused unchanged: strict accepted inventory, snapshot and input derivation. |
| `lib/visual-contract-compiler/templateDraftSchema.ts`, `types.ts`, `contractTemplateTypes.ts` | Unchanged. `cast_group` still means 2+ declared individual IDs, not an unnamed ensemble. M1a cannot project ensemble input. |
| `lib/visual-contract-compiler/validateTemplateContract.ts`, `validateResolvedContract.ts`, `validateVNextVisualContract.ts`, `validateBookVisualContract.ts` | Unchanged individual contract shape; existing compiler/materializer validators exercised. M1b must extend group resolution/presence explicitly. |
| `lib/visual-contract-compiler/materializeContract.ts`, `projectContractProse.ts`, `buildVisualContractPromptBlock.ts`, `adapters.ts`, `castPresenceContradiction.ts`, `writeVisualContractReview.ts` | Unchanged consumers of typed individual IDs/traits; materialized/prose proof and existing regression suites. New source completeness lives in fact assembly, not prose alias discovery. |
| `lib/visual-contract-compiler/compileBookVisualContract.ts`, `bookSurfaceRepair.ts`, `structuralBundleRepair.ts` | Legacy authoring/repair structures unchanged; compiler supplies assembled individual IDs through existing fact/reference channels. No group instructions or repair authority added. |
| `lib/visual-package/runtimeAuthority.ts`, `preRenderBlueprint.ts`, `preRenderBlueprintProviderWire.ts`, `blueprintAuthoringSanitizedFailureCapture.ts`, `lib/generation-pipeline/runtime-blueprint-projection.ts` | No runtime/Blueprint shape or live path changed. Existing cast-ID consumers remain individual-only; full group proof is M1b, not inferred from M1a tests. |
| `lib/visual-package/sourcePromptReconciliation.ts`, `reconciliationLifecycle.ts`, `qaWizardCandidateBridge.ts`, `visualContractCandidateCoverCorrection.ts` | Protected `/humanCast`, existing coverage equality and approval gates unchanged. No recovery/bridge execution in M1a. |
| `lib/set-identity-board/setDefinition.ts` | Existing cast projection unchanged; no new group enters its input, no Board generation. |
| `lib/visual-package/visualContractAuthoringReplayRunner.ts`, replay evidence and offline harness | No replay/catalog/schema version changes. Exact historical paid replay is still required for M1b/M2; not rerun in this foundation. |
| `scripts/preflight-personalization-sweep.ts` | Existing source-bank consumer unchanged; preview does not publish/change source or runtime contract. |

Unchanged pins: action catalog v3, template draft v21, template/resolved schema
v4, materializer v2, palette v1, source snapshot v4, accepted authority v1,
candidate artifact v9, current receipt v59 and cover-only bridge v5. Only the
new review-input and explicit preview appearance policy introduce v1 tags.
The held v3 receipt must still not be fed through a future post-catalog-bump
current factory. M1b must preserve the original v9 loader/frozen v3 binding;
M2 must create separate effective authority rather than manufacture a receipt.

## Validation and remaining gate

Final focused command (exit 0, 7/7 files and 153/153 tests):

```powershell
npx vitest run lib/__tests__/supporting-cast-review.spec.ts lib/visual-package/__tests__/accepted-supporting-cast-review.spec.ts lib/__tests__/visual-contract-s2a.spec.ts lib/__tests__/visual-contract-text-first-compiler.spec.ts lib/__tests__/visual-contract-materialize.spec.ts lib/__tests__/visual-contract-template.spec.ts lib/visual-package/__tests__/accepted-story-source-authoring-authority.spec.ts --maxWorkers=2 --no-cache
```

The two new files contain 27 + 11 = 38 tests. Coverage includes two synthetic
story identities, arbitrary roles, known relatives, same-role distinct people,
exact-ID garment matching and no borrowing on omission, group/non-human holds,
malformed/unknown fields, exact quotes/pages, alias and reserved-identity
collisions, rehashed substitutions of all five accepted/source binding hashes,
source mutation across the async caller, the real accepted P1 loader and
individual compiler/materializer/validator/prompt path, absent-person rejection
without a prose mention, and refusal at the paid candidate factory.

Both `npx tsc --noEmit` and `npm run story:autonomous-typecheck` exited 0 after
the final code hardening. `git diff --check` exits 0.

`npm run check` was run, exit **1**. Both typecheck phases passed. The ordinary
phase reported **337 passed / 10 failed / 17 skipped files**, and **4,834 passed
/ 21 failed / 73 skipped tests**; diagnostic classes `test_timeout` and
`signal_or_exit_failure`. The resource-intensive phase reported **20 passed /
1 failed files**, **642 passed / 11 skipped tests**, plus three unhandled
`onTaskUpdate` RPC timeouts; diagnostic classes `on_task_update_rpc_timeout`
and `signal_or_exit_failure`. Supervisor `gateStatus: failed` is authoritative;
passed assertions are not a green process result. This full run began before
the final reserved-alias/relative-ID and pure-assembler rejection hardening;
the 153-test battery and both typechecks above cover the final code. A second
full run was not performed, and no final full-repository PASS is claimed.

Failures include missing ignored output fixtures, the historical storyboard
review/correction binding and timeouts. The review-batch mismatch was separately
reproduced at clean base `768ccb2f` in d53b: expected `7a8434c7...`, received
`6a549d1339ce364659e521b1d280a7250a3d331e0205b3a4c69b0a203e3efd6a`, exit 1.
The resource-intensive suite failure is the same correction-batch binding
class; its 11 tests were skipped after setup failed.

Do not classify every timing failure as proven inherited: the isolated Wizard
digest/environment test still timed out at the default 5,000 ms in the new
worktree (5,278 ms), while the same base-tree test passed at 4,688 ms. A
diagnostic-only rerun in the new worktree with `--testTimeout=20000` passed its
assertions at 5,070 ms (1 passed / 11 skipped, exit 0). The repository timeout
was NOT changed; the diagnostic does not replace the failed canonical gate.
Whether the worktree/dependency layout or host timing accounts for this small
margin is not established. These limits remain visible to independent QA.

The original P1 root was checked from d53b using the exact inventory script
already independently reviewed in the Gate: 14 regular, single-link files /
412,516 bytes, raw inventory SHA-256
`cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`, exit 0,
matching the prior independently verified baseline. No paid replay, real
recovery preview or standalone Wizard catalog audit was run. The generic
test fixture must not be mistaken for any of those operations.

No live provider,
credential, image/audio, database, publication, package, promotion, deployment
or payment operation was run. Unit-test provider transports are injected mocks.
No P1 attempt/recovery artifacts were created. Test-run diagnostics and build
caches are tooling output, not story authority.

Rollback is a focused revert of M1a. Original source, paid candidate, receipt,
replay and locators are untouched. No migration, cleanup or deletion is needed.

## Ready-to-copy independent QA brief

> Review M1a, NOT the whole semantic recovery. Branch/worktree and immutable
> base are above; Codex's final handoff supplies exact HEAD. Original requirement:
> repair supporting-cast authority generally without paying to repeat P1.
> Challenge the accepted-loader binding and rehashed substitutions; cited
> pages, aliases, family/non-human classification; omitted-person and same-role
> regressions; source mutation across async calls; no provider on rejected
> classes; and the current paid-factory rejection. Confirm unchanged legacy
> schema/catalog/default behavior and distinguish synthetic plumbing proof from
> actual P1 salvage. Read the consumer dispositions and finalized test evidence.
> P1 must remain HELD and M1b/M2 unimplemented. First pass read-only/offline:
> no credentials, provider, correction output, Blueprint, render, promotion,
> publication, deployment or payment. Return technical PASS/HOLD with P0/P1/P2.
