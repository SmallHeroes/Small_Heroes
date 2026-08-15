# R1D Book-Surface Presentation/Structural Repair — Implementation Evidence

## Objective and provenance

Implement the approved closed compact route for the exact mixed book-surface
failure proven by the immutable Leo v14 authoring artifacts. The base is
`e28ab0becb6eb883de3ce08dad9527196a09a748` on
`codex/r1d-book-surface-presentation-structural-repair`.

The consumed attempt's initial response had two page-3
`action_binding_cardinality_invalid` identities. Its first
`page_contract_patch` resolved both. Complete validation then reported 42
current issues: 29 `closed_catalog_capability_gap` presentation targets, one
cover `cover_projection_invalid`, and one
`final_structural_invariant_invalid` on each page 1–12. The old page-only lane
could not replace the cover and the selected `full_draft` response reached the
exact 36,000 output-token ceiling. Receipt v21 digest
`89d8b8585ad737003952f5dc6db6dee5b5deefd160ddfc96d723f2236fb8a001`
records three calls, two repairs, zero fallback, terminal
`completion_status_invalid`, input/cache-write/output/reasoning/total usage
`38,261/38,252/67,727/6,189/105,988`, and nominal/conservative accounting
`$2.270930/$2.498037`. It contains no candidate authority.

Focused implementation commit: `cf391de7`.

## Implementation

- Added strict `book-surface-repair-schema/v1` /
  `BookSurfaceRepairPatch`, carrying exactly one cover contract and the exact
  affected complete page-contract set.
- Added one closed authority derivation for presentation targets plus only
  cover projection/final-structure and page final-structure identities. Every
  other family remains on the existing fail-closed path.
- Reused the canonical lossless compact page-repair codec for provider input
  and prove decode/canonical roundtrip before dispatch.
- Added exact world/location/zone/cast and page topology guards, complete exact
  page-set application, input nonmutation, and canonical masked equality for
  every non-target draft field.
- Routed the lane as `book_surface_patch` through compiler provenance,
  provider-schema selection, receipt attempts, prompt authority, canonical
  parser/materializer, B0, Supervisor, and Fresh Readiness.
- Exported the existing strict cover member schema so the repair and original
  draft use one authority rather than duplicated shapes.
- Updated the canonical Vitest inventory from 299/280/19 to 300/281/19 after
  the new direct specification was added. Workload policy and worker limits are
  unchanged.

There is no story, child, companion, page, phrase, or authored-ID literal in
the implementation. Model, service tier, prompt/schema authority outside this
lane, 64K/36K ceilings, three-call/two-repair budget, timeout, retries,
fallback, candidate semantics, Blueprint v4, Wizard, Reader, image generation,
payment, storage/database, and Production behavior are unchanged.

## Authority migration

- Visual Contract request/receipt/readiness: `v19/v22/v20`.
- Live-request materialization/verification: `v17/v17`.
- Execution materialization input/result: `v7/v11`.
- Supervisor request/readiness/result: `v16/v16/v8`.
- Fresh Readiness evidence: `v16`.

Immediate prior Visual Contract request v18, receipt v21, and readiness v19 are
classified `legacy_immutable`. Existing artifacts were not edited or
redigested and cannot authorize a new attempt.

## Validation

- Direct book-surface contract: **1 file / 11 tests PASS**.
- Complete affected compiler/lifecycle/canonical set: **9 files / 406 tests
  PASS**, deterministic single worker, no timeout or RPC/IPC failure.
- `npx --no-install tsc --noEmit`: PASS.
- Focused workload classifier after inventory correction: **1 file / 7 tests
  PASS**.
- `git diff --check`: PASS.
- First literal `npm run check`:
  - TypeScript contracts: PASS;
  - resource-intensive: **19 files / 568 tests PASS**, valid diagnostics;
  - ordinary: the six established missing ignored-output fixture failures plus
    one stale inventory assertion caused solely by the new spec.
- Authorized replacement after the two-number test-only correction:
  - TypeScript contracts: PASS;
  - ordinary: **281 files / 3,232 tests**, exactly the six established fixture
    failures, no seventh assertion or infrastructure failure;
  - resource-intensive: **19 files / 568 tests PASS**, valid diagnostics and no
    timeout, RPC/IPC, reporter, launch, signal, or teardown failure.

The six ignored-output fixtures remain a separate Production/release HOLD.
They are not implementation findings and do not authorize release.

## Acceptance, risk, and rollback

The decisive fake-provider regression proves the bounded sequence: an initial
draft exposes page-cardinality issues, call 2 uses `page_contract_patch`, the
repaired draft exposes the mixed book-surface family, call 3 uses
`book_surface_patch`, and complete validation emits a candidate. Direct tests
also reject malformed schemas, unsafe references, duplicates, incomplete or
unexpected page sets, invalid cover authority, and input mutation. The apply
boundary additionally proves masked canonical equality for every non-target
field; the resulting defensive drift code is an invariant, not a directly
fault-injected rejection test.

Implementation cost was `$0`; no credential, pricing/network/provider call,
real B0/Fresh Readiness, preflight, live authoring, render, storage/database,
deployment, or Production action occurred. Revert the focused implementation
commit to restore the previous full-draft fallback; new-version artifacts then
fail closed and all historical evidence stays immutable.

## Independent QA and focused correction

Claude Code independently reviewed exact range
`e28ab0becb6eb883de3ce08dad9527196a09a748..f1b0fedff301cca9b54cdfa8902e1d6c5c1a4bba`
and returned technical **PASS** with zero BLOCKER and zero MAJOR against the
approved contract. This record attributes that verdict to Claude Code; Codex
does not self-award it.

The review identified two non-blocking coverage/documentation MINORs. The
focused correction adds direct coverage for the remaining closed cover issue
identity (`cover_projection_invalid/world_type`) and for a valid multi-cover
issue set, while preserving the exact affected-page set. It also corrects the
evidence and Decision Gate wording: the apply boundary proves masked canonical
equality for every non-target field, while
`book_surface_repair_non_target_drift` remains a defensive invariant rather
than a directly fault-injected rejection test. The direct specification now
passes **1 file / 12 tests**; deterministic TypeScript and `git diff --check`
also pass. Closure of those two MINORs awaits a read-only micro re-gate of the
focused correction range.

Claude also recorded a non-blocking operational risk: although the new repair
lane is narrower than `full_draft`, the exact output size of a complete
12-page live `book_surface_patch` is not provider-proven in advance. The next
bounded attempt is the real measurement. This risk does not authorize any
change to the model, 36K output ceiling, three-call/two-repair budget, timeout,
retry/fallback policy, or `$5.00` hard cap.

Implementation and correction cost was `$0`; no credential, provider,
Fresh Readiness, preflight, live-authoring, render, storage/database,
deployment, or Production action occurred.

## Leo v15 operational evidence and normalized-authority correction

Fresh Readiness v16 passed at digest
`878727cf126a11d0a0d4b5171b947773d1f936e4e0609086ae800b9170108d6c`;
Execution Request v16 digest was
`9375b3718bf15fbdd0d9fd1d1aac32f3136441f55a8540128b3118d6d5afb6f1`.
Official Standard/default `gpt-5.6-sol` pricing matched the frozen request.
Exactly one preflight and one Supervisor verify passed, followed by one live
Supervisor invocation. The credential source was read only inside that live
child, ambient inheritance was false, authority was cleared, and raw
stdout/stderr were suppressed.

Receipt v22 digest
`a7bde3cdc1d92f6ce5744fd19031acc04fc73c8ec9aa505e62924698270d18e2`
records three completed logical provider calls, two repairs, zero transport
retry and no fallback. Aggregate provider-reported usage is input/cache-write/
cached/output/reasoning/total `36,795/36,786/0/46,322/5,720/83,117`;
nominal/conservative accounting is `$1.619618/$1.781593`.

The first validation pass exposed twelve `out_of_scope_reference` page action
references. Call 2 used `page_spatial_reference_patch` and resolved all twelve.
The second pass exposed seven `closed_catalog_capability_gap` presentation
targets plus one cover `cover_projection_invalid/final_structure` and twelve
page `final_structural_invariant_invalid/final_structure` issues. The intended
book-surface lane was not selected; call 3 used `full_draft`, resolved all seven
presentation targets, and left exactly the thirteen cover/page structural
issues persistent. The terminal classification was
`draft_validation_repair_exhausted` / `draft_validation_budget_exhausted` with
`repairEligibility:budget_exhausted`. Candidate, Reconciliation, Blueprint,
Wizard and render authority are all absent.

The root cause is an authority-domain mismatch: the validator emitted the
mixed failure from the compiler-normalized template, while
`bookSurfaceRepairAuthority` derived cover/reference authority from the raw
provider draft. A provider-authored cast or topology value that normalization
correctly drops can make the raw authority ambiguous and return null. The
focused correction carries the exact normalized projection on the typed
mixed-failure object and uses it only for cover/reference authority. Affected
pages and targets still derive from the raw draft; the patch still applies to
that raw draft with every existing guard.

Validation after correction: **9 files / 408 tests PASS**, deterministic one
worker, including a fake-provider regression that would previously choose
`full_draft`; TypeScript and `git diff --check` PASS. No public schema, prompt,
model, budget, timeout, retry/fallback, candidate or downstream behavior
changed. The new Decision Gate is
`R1D_PVB_D1A1B1_BOOK_SURFACE_NORMALIZED_AUTHORITY_PROJECTION_DECISION_GATE.md`.

Claude Code independently reviewed exact correction range
`f1b0fedff301cca9b54cdfa8902e1d6c5c1a4bba..120d5c1f` and returned **PASS**
with zero BLOCKER and zero MAJOR. It upheld all eight falsification claims,
including the original-draft target/application boundary and the unchanged
public contracts. Its first advisory correctly reserves live proof for the
next bounded attempt. Its second advisory noted that an optional
`authorityDraft` could be omitted by a future caller; the follow-up makes that
argument mandatory and passes it explicitly at every call site, without a
runtime-policy change. Claude Code micro-re-gated exact range
`120d5c1f..7a4f47ce` and returned **PASS** with no technical finding. It
source-verified the required signature, absence of a fallback, every call site
and unchanged public surfaces; it did not independently rerun the recorded
43-test, TypeScript or diff-check commands.
