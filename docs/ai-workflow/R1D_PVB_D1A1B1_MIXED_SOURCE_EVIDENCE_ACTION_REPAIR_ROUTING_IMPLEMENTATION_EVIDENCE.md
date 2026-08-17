# R1D-PVB-D1A1B1 Mixed Source-Evidence / Action Repair Routing — Implementation Evidence

**Date:** 2026-08-17

**Status:** local implementation complete; independent Claude Code QA pending; unpushed; no Fresh Readiness, live, candidate, Wizard or render authority

## Topology

- Worktree: `C:\GNart\Work\sh-wt-r1d-output-budget`
- Branch: `codex/r1d-mixed-source-evidence-action-repair-routing`
- Exact pushed base: `0285df438bd5a8bbcbd9db7563ab0778f50e4599`
- Implementation commit: `2a51e5df0e4ca8cddce327b2e7d4ec8a177442cc`
- Production: untouched
- External implementation cost: `$0`

## Consumed live evidence that motivated the correction

The predecessor attempt used output root
`outputs/r1d-dini-canonical-spatial-repair-20260817T040647206Z` and immutable
Fresh Readiness
`c706f3402272a45ac8f17ca5572d17fc70fd5207e45c01065a8d2440d4983b5e`
with Execution Request
`40c2bb727526b96d60d3a0869139f0404a9eb043f75c7c19667c0f2d92b7763c`.
The source snapshot was
`f8ac1292d5e225a8ff90c462416a44fe61f89b2c47f1529a1e43dd8025f1a079`,
authoring request
`ab1e850f4b137c5626e87308f0773c6dd1b2786ac19ef3a86e47962de9c807fe`,
B0/live-request materialization
`520cbb773c6db743048e885707b3231063996b4eee6965bb1a536d954bee135c`,
readiness evidence
`c240daad6b5b775271deb2be86cb289c216f141ec4bde3fd9de604dcfce8d25a`,
and Supervisor readiness
`d7c427c2e17655f0428f5e2a3c075c728d057f52d1f01bc07ff303042b29f8c8`.

Receipt `visual-contract-authoring-receipt/v32`
`0e61e0472744874fcba434529c8c160638ed406d9dfe672361004a783c6cc2fa`
records exactly three logical provider calls, two repairs, zero transport
retries and no fallback under `[40,000, 32,000, 36,000]`. Aggregate
provider-reported usage was 29,422 input, 29,413 cache-write, zero cached-input,
58,234 output, 9,861 reasoning and 87,656 total tokens. Nominal cost was
`$1.930896`; conservative accounting was `$2.123999`.

The initial response contained two malformed Source Evidence IDs plus a
dependent `action_semantic:disposition_payload_invalid`. Repair 1 selected
`full_draft`, resolved those three diagnostics and introduced
`action_binding_cardinality_invalid`. Repair 2 selected `page_contract_patch`,
resolved that issue but ended with 158 emitted / 26 unique action-semantic and
structural diagnostics. The terminal classification was
`draft_validation_budget_exhausted` / `draft_validation_repair_exhausted`,
phase `draft_validation`, with `repairEligibility: budget_exhausted`. No
candidate, Reconciliation, Blueprint, Wizard, image, render, storage,
deployment or production authority was created.

## Root cause

A valid `unsupported / closed_action_catalog_gap` disposition with an
unresolved Source Evidence identity was being given a second, misleading
`disposition_payload_invalid` diagnostic. That caused an early generic
action-semantic failure before exact Source Evidence repair authority could
survive routing. After the false dependent diagnostic was removed, the exact
later `coverage_missing` diagnostic still traveled through
`ActionSemanticCoverageValidationError`, whose wrapper retained diagnostics and
the canonical pointer template but discarded the compiler-produced
`SourceEvidenceIdRepairAffectedRecord` authority. The router therefore could
not prove that Source Evidence identity repair was the exact prerequisite and
fell back to a destructive whole-draft repair.

## Implementation

`ActionSemanticCoverageValidationError` now carries a defensive clone of typed
Source Evidence affected records. The compiler supplies those records only
when all co-reported action-semantic issues are the exact `coverage_missing`
consequence of unresolved, otherwise-valid
`unsupported / closed_action_catalog_gap` records on the same pages. The outer
authoring loop preserves the records only when that exact authority is
non-empty.

The invalid dependent `disposition_payload_invalid` emission was removed for
this unresolved-but-valid disposition. The precise malformed Source Evidence
issue and causal `coverage_missing` remain visible. The existing router can
therefore select `source_evidence_id_patch` first. Full deterministic
compilation then runs again; if the valid identity reveals a genuine
closed-catalog capability gap, the already-authorized
`presentation_requirement_patch` handles it within the same two-repair budget.

Independent source-evidence plus unrelated semantic failures are not waived. A
direct negative regression proves that the combined closed-gap trigger,
dependent `coverage_missing`, and an independent semantic pointer error retain
`full_draft`; an empty affected-record array cannot become source-repair
authority by truthiness. No prose parsing, fuzzy matching, story-specific
literal, new fallback, retry, schema, prompt, model, budget, timeout, candidate
or downstream behavior was introduced.

## Regression contract

The new end-to-end lifecycle regression begins with two malformed Source
Evidence IDs, including one attached to a dependent closed-catalog gap. It
proves:

- exact route sequence `[initial, source_evidence_id_patch, presentation_requirement_patch]`;
- completion with a candidate in exactly three calls / two repairs;
- unchanged caps `[40,000, 32,000, 36,000]`;
- compact schemas `SourceEvidenceIdRepairPatches` and the existing presentation-requirement schema;
- whole-book authority excluded from both compact prompts;
- input draft non-mutation;
- predicate, object, unrelated action binding and non-target identity preservation;
- valid final source identities and the expected action/presentation dispositions.

A second regression combines the dependent closed-gap source failure with an
independent out-of-scope action-semantic pointer and proves
`[initial, full_draft]`, preserving fail-closed routing. The constructor census
was updated so future wrappers cannot silently drop the new typed parameter.

## Validation

- Final causal guard slice: **4/4 PASS**.
- Complete affected focused aggregate: **9 files / 254 tests PASS**.
- `npx --no-install tsc --noEmit`: PASS after the final causal guard.
- `git diff --check`: PASS.
- One literal `npm run check`:
  - TypeScript and autonomous story typecheck: PASS.
  - Ordinary phase: 3,209 passed, 65 skipped, only 5 failed assertions across the 4 established missing-output fixture tests; no new implementation failure.
  - Resource-intensive phase: **19 files / 586 tests PASS**.
  - No timeout, RPC/IPC, reporter, launch, signal, teardown or diagnostic-protocol failure.

The known missing-output fixtures remain a separate release HOLD. They are not
waived and do not make the literal repository gate green. The final causal
narrowing was added after that single repository gate and then proved by the
4/4 guard slice, final TypeScript and `git diff --check`; the repository gate
was not rerun.

## Preserved boundaries, migration and rollback

- No prompt/schema, model, service tier, 64K input ceiling, per-attempt output schedule, call/repair budget, timeout, transport retry, fallback, `$5.00` ceiling, candidate semantics, Blueprint, Wizard or render-policy change.
- Receipt/readiness/evidence versions are unchanged; historical artifacts remain immutable and no migration is required.
- No credential access, pricing/network/provider call, Fresh Readiness, preflight, live authoring, image/Vision, render, storage/database, QA deployment, production deployment or push occurred during implementation.
- Rollback is the focused revert of `2a51e5df0e4ca8cddce327b2e7d4ec8a177442cc` and its documentation closeout; no data or artifact rewrite is required.

## Independent Claude Code QA

Pending. Claude Code must review the exact immutable base-to-head range and try
to falsify typed authority preservation, the exact causal eligibility
predicate, source-patch priority, independent-error fail-closed routing,
non-target immutability, prompt sanitization, full revalidation, unchanged
versions/budgets/policies, and the recorded validation. Codex does not
self-award independent technical PASS.
