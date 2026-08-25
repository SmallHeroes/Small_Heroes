# R1D Represented-Elsewhere Narrow Patch — Implementation Evidence

**Date:** 2026-08-25
**Branch:** `codex/r1d-represented-elsewhere-narrow-patch`
**Worktree:** `C:\GNart\Work\sh-live-chameleon-v3`
**Base:** `06280b5a3f971996280e6d59a686eca4f890cd8a`

## Result

The approved provider-free milestone is implemented and locally green. A pure
complete represented-elsewhere residual now uses the new
`represented_elsewhere_patch` lane instead of the broad PageContract or
full-draft routes. The lane changes only the existing represented-elsewhere
pointer/value fields selected by the compiler and cannot edit any other draft
surface.

This is Codex implementation evidence, not the independent Claude Code PASS.

## Preserved live evidence and root cause

The last paid run remains byte-preserved at
`outputs/r1d-chameleon-v3-live-20260824T214715731Z`. Its receipt is:

```text
b0/authoring-receipts/08d4e6c00679914313b6e35c17662191a918176e1fd47bae13f74dba28741a25.json
```

The receipt records:

- four logical calls and four transport dispatches;
- three repairs, zero retries and no fallback;
- route `initial -> book_surface_patch -> page_spatial_reference_patch -> page_contract_patch`;
- complete census `17 -> 9 -> 6` before the rejected application;
- six pure represented-elsewhere issues on pages 2, 3, 5, 6, 6 and 8;
- terminal identity
  `page_contract_repair_represented_elsewhere_target_invalid`;
- no Candidate and no render;
- nominal cost `$1.268059`; and
- conservative accounted cost `$1.395553`.

The PageContract response tried to carry six whole-page echoes for six
one-field ordinal selections and failed its wider target-association contract.
The provider had no reason to own the actual pointers or values: the validator
already exposes a finite same-page permitted domain. The general fix is
therefore a narrow compiler-bound selector lane, not more repair budget or a
story-specific patch.

## New closed lane

`lib/visual-contract-compiler/representedElsewhereRepair.ts` defines:

- schema `represented-elsewhere-repair-schema/v1`;
- schema name `RepresentedElsewhereRepairPatches`;
- prompt `represented-elsewhere-repair-prompt/v1`;
- schema digest
  `c15013c5ed2a5482156e19dd95c3e46b10bdb01fa9df5da04c4d78b321c20a4d`;
- system-prompt digest
  `31616197c8bf80963735aa92fa633a725138ff4a5a2ebf2d3fabea0880ff5543`;
  and
- provider output restricted to
  `pageNumber, coverageIndex, beatId, sourceEvidenceId, pointerChoiceIndex`.

For each page, the compiler constructs one deterministic ordered list of
permitted pointer/value pairs. It maps the complete-census global item index to
the actual page-local `actionSemanticCoverage` index and publishes that local
index as target identity. Application compares the expected and returned
identity sets canonically, independent of response order. It rejects any
missing, extra, duplicate or forged target before applying all selections to a
clone. A choice is resolved only inside the target page's compiler-owned
domain. Failure cannot partially mutate the source draft.

The association error surface contains only `pageNumber`, `coverageIndex` and
one closed subreason. Current terminal diagnostics enforce the exact mapping:
`choice_out_of_range` pairs with `reference_authority_invalid`; all other
target-association subreasons pair with `target_identity_invalid`. Raw pointer,
value, prose, prompt, draft and provider payload material is not persisted.

## Scheduler and bounds

The route is eligible only when the complete normalized population is non-empty
and every issue is one of the three represented-elsewhere identities. It runs
after any independently admissible BookSurface or page-spatial repair and
before PageContract/full-draft widening. There is no fallback from the narrow
lane to a broader rewrite.

Route admission is bounded to standard repair attempts 2 through 7. The
compiler and lifecycle now share one pure terminal-reference cleanup predicate:
a mixed spatial-plus-represented residual exhausts after seven calls, while the
pre-existing pure spatial residual can still use the one closed eighth call.
An input-inadmissible represented prompt records route admission and stops
without provider dispatch.

## Production-shaped offline proof

`lib/__tests__/offline-repair-harness.spec.ts` replays a complete production
shape with injected provider responses and no provider construction:

```text
initial (17)
  -> book_surface_patch (9)
  -> page_spatial_reference_patch (6)
  -> represented_elsewhere_patch (0)
  -> Candidate
```

The harness asserts equal surfaced and complete counts, deltas
`null, -8, -3, -6`, `monotonicCompleteIssueDelta: true`,
`maxPositiveCompleteIssueDelta: 0`, the exact schema name, absence of
PageContract/full-draft and `providerCalls: 0`.

Counterexamples cover mixed populations, missing/extra/duplicate/forged and
reordered targets, cross-page authority, invalid ordinal types/ranges,
unchanged non-target bytes, input-ceiling refusal, exact-state stagnation,
complete-census regression and standard-attempt exhaustion.

## Authority cutover

| Authority | Current | Immediate predecessor |
|---|---:|---:|
| authoring request | v51 | v50 |
| authoring receipt | v53 | v52 |
| authoring readiness | v51 | v50 |
| repair-output diagnostics | v5 | v4 |
| route-admission diagnostics | v2 | v1 |
| B0 materialization manifest | v49 | v48 |
| B0 verification | v49 | v48 |
| execution request | v45 | v44 |
| execution readiness | v45 | v44 |
| execution materialization result | v40 | v39 |
| Fresh readiness evidence | v45 | v44 |

The lifecycle, canonical parser/rebuilder, B0, execution request/readiness,
Fresh readiness, adapter allowlist and all QA Wizard equality junctions carry
the new schema and prompt authority. Immediate predecessors stay readable and
cannot encode the new current repair identity. Current readers reject
redigested prior versions as current authority.

Unchanged versions are materialization inputs v39 and v35, execution result
v37, Candidate v9, provider evidence v6, draft v21 and authoring policy v17.
The structured-output payload census advances from nine to ten. Model, service
tier, 64K input ceiling, output allocation, standard call/repair counts, cost
ceiling, transport retry and no-fallback policy are unchanged.

## Files

Before documentation, the focused implementation contains 26 tracked
modifications and two new files:

- new compiler module
  `lib/visual-contract-compiler/representedElsewhereRepair.ts`;
- new direct spec `lib/__tests__/represented-elsewhere-repair.spec.ts`;
- compiler mode, policy, routing, exports and repair diagnostics;
- lifecycle and terminal diagnostics;
- canonical authoring, B0 materialization, execution, Fresh and QA Wizard
  bindings; and
- focused harness, compatibility, lifecycle, census and regression specs.

`CURRENT.md`, the approved Decision Gate and this evidence record complete the
milestone documentation. No Story Source, Visual Package, Board, locator,
renderer, payment, database, package manifest or deployment file changed.

## Validation

- Integrated focused suite: **14 files / 675 assertions PASS**. The process
  later reported three known Vitest `onTaskUpdate` RPC timeouts; there were zero
  assertion failures.
- Producer/workload census regressions: **2 files / 27 assertions PASS**.
- Core adversarial read-only audit: **85/85 PASS**, TypeScript exit 0 and clean
  diff check; no finding.
- Cutover adversarial read-only audit: **412/412** core/lifecycle assertions,
  **85/85** downstream/Fresh/QA assertions and **65/65** adapter/module/harness
  assertions pass; its final verdict has no finding. The downstream command
  reported only the same three Vitest RPC timeouts.
- `npx --no-install tsc --noEmit --pretty false`: exit **0**.
- `git diff --check`: exit **0**.
- `npm run check`: TypeScript and the autonomous story typecheck pass. The
  canonical inventory is 329 files. Ordinary reports **286 passed files / 3,628
  passed assertions**, 17 files / 70 assertions skipped and 11 failures in six
  unchanged files: nine missing ignored historical-output fixtures and two
  unchanged Blueprint-migration assertions exceeding the ordinary five-second
  limit. Resource-intensive reports **20 files / 612 assertions PASS**, then
  three known Vitest `onTaskUpdate` RPC timeout errors. Neither phase has a
  changed-file assertion failure.

The first full check exposed two relevant census expectations: one additional
`InvalidTemplateContractError` producer and one additional ordinary spec. They
were corrected to explicit counts and the second full check contains neither
failure.

## Cost and external-state proof

Cost is `$0`. No credential was read and no provider, network, Fresh, live
authoring, Candidate persistence, Wizard order, image, audio, Vision, render,
database, deployment or other external operation occurred. The historical live
receipt was read only.

## Independent gate

This implementation has internal adversarial evidence but does not self-award
the required independent PASS. Claude Code must review the immutable
base-to-head range read-only and try to falsify exact-set binding, local-index
rebinding, atomicity, diagnostic sanitization, route purity, input-ceiling and
call-eight boundaries, legacy replay, every downstream version equality and
the unchanged policy/cost surfaces before any Fresh Readiness or paid attempt.
