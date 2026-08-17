# R1D Causal Source-Evidence + Pure Structural Compact Routing — Implementation Evidence

**Date:** 2026-08-17
**Status:** local implementation green; independent Claude Code QA pending; unpushed; no new Fresh Readiness, live, candidate, Wizard or render authority

## Topology

- Worktree: `C:\GNart\Work\sh-wt-r1d-output-budget`
- Branch: `codex/r1d-causal-source-structural-compact-routing`
- Exact pushed base: `a8e2f59c6e02fda5e7e60fee6b8e18e8ae0991be`
- Decision Gate: `R1D_CAUSAL_SOURCE_STRUCTURAL_COMPACT_ROUTING_DECISION_GATE.md`
- Implementation commit: `d6fe25f1e0a2ccbe461637aafb60ec158bd1b246`
- Production: untouched
- Implementation/test provider cost: `$0`

## Consumed live evidence

The single predecessor attempt used Fresh Readiness v26
`322124500400b492901381cce02eaeb050d025332af801ee57223bfd83e35ac1`,
Execution Request v26
`b59f5caf8bd660cbcd8778c8d55b92c526f67316b94e48b83e6b5cada1494d7e`,
authoring request v29
`c793063dcac010c0e961bf72c44fd8d896bf7cffdcccb7287ffc5b6b6270c5f0`,
receipt v32
`8fb94c557c1d63c6e7169e65cd0433722f42c104ea4540dc35eaa672e0901a0e`,
and readiness v30
`85f315140ed8b3d624849568210f4e8634c6efb5eb3aae269b6060a5b9490fec`.
The source snapshot remained
`f8ac1292d5e225a8ff90c462416a44fe61f89b2c47f1529a1e43dd8025f1a079`.

All three logical provider calls completed. Two repairs were consumed, transport
retries were zero and fallback was false. Aggregate usage was 39,506 input,
4,608 cached input, 34,889 cache-write input, 82,670 output, 10,483 reasoning
and 122,176 total tokens. Nominal cost was `$2.700506`; conservative accounting
was `$2.999715`; the projected maximum remained `$4.99125` under the frozen
`$5.00` ceiling.

Attempt 1 produced exactly two current typed issues on page 12:
`source_evidence_id_malformed` and the bound action consequence
`source_phenomenon_binding_mismatch`. Repair 1 selected `full_draft`, resolved
both and exposed fourteen closed structural issues: cover projection, all twelve
page final structures and recurring-props lifecycle. Repair 2 again selected
`full_draft`, resolved lifecycle and left cover plus all twelve pages. Terminal
classification was `draft_validation_repair_exhausted` /
`draft_validation_budget_exhausted`. Supervisor v19 returned
`child_failed / child_nonzero_exit`, exit `1`, with null output authority. No
candidate or downstream authority was created.

## Root cause

The compact Source Evidence repair already owns the exact mechanical fix. Its
applier updates the malformed coverage record and the same-beat
`source_phenomenon` subject atomically, while preserving unrelated action and
coverage fields. The compiler nevertheless threw a generic action-semantic
error before the typed affected records reached the authoring router. It could
therefore not prove that identity repair was the exact prerequisite and fell
back to a destructive whole-draft repair.

The later cover/page/recurring-prop failures already matched the established
closed Book Surface repair schema and applier, but that authority required at
least one presentation target. A pure structural instance of the same safe
surface was therefore also forced into `full_draft`.

## Implementation

`SourceEvidenceIdValidationError` can now carry cloned dependent typed
diagnostics. The compiler exposes that authority at the early mixed source /
action boundary only when all of the following hold:

- at least one affected Source Evidence record exists;
- affected-record count equals dependent-diagnostic count;
- every record identifies one unique positive page, coverage index and beat;
- the current coverage is exact `action_requirement`, uses the same beat and
  unresolved identity, and the record matches it;
- exactly one same-beat action exists;
- that action is `source_phenomenon`, its subject resolves to canonical
  same-page Source Evidence, and it equals the compiler-recorded action subject;
- every dependent diagnostic is the unique matching
  `action_semantic / source_phenomenon_binding_mismatch` at that action index.

Any duplicate, ambiguous, partial, independent or unrelated issue rejects the
compact classifier. The outer lifecycle then reuses the existing
`source_evidence_id_patch`; no prompt, schema, output, retry or fallback was
added.

`bookSurfaceRepairAuthority` now permits empty presentation targets only for the
existing closed structural family. It still requires at least one cover issue
and at least one page final-structure issue, admits only the optional exact
recurring-props lifecycle issue, and rejects all unrelated diagnostics,
locators, collections and unsafe validation hints. Pure structural page
coordinates are derived through the existing typed page authority; mixed
presentation-plus-structural behavior is unchanged. The compile loop retains a
typed wrapper solely long enough to route the already compiler-normalized cover
and page authority into the existing `book_surface_patch` path.

## Regression contract

The live-shaped positive lifecycle begins with one malformed coverage identity
and its exact valid phenomenon subject, then introduces the closed cover,
twelve-page and recurring-prop surface. It proves:

- route sequence `[initial, source_evidence_id_patch, book_surface_patch]`;
- completion with a candidate in exactly three calls / two repairs;
- unchanged output caps `[40,000, 32,000, 36,000]`;
- existing compact Source Evidence and Book Surface schemas;
- both initial typed diagnostics remain visible;
- the structural family appears only after exact identity repair;
- the final attempt resolves all fourteen structural issues;
- the canonical identity reaches final Action Semantic Coverage;
- the input draft remains byte-equivalent.

A direct negative combines the causal pair with an independent malformed
non-action Source Evidence record. The one-to-one prerequisite fails and the
route remains `[initial, full_draft]`. Existing unit coverage continues to
reject cover-only, page-only, unrelated and unsafe Book Surface mixtures. The
bounded-exhaustion lifecycle now proves that two successive Book Surface
repairs consume the ordinary budget and cannot open a fourth cleanup call.

## Validation

- Changed focused aggregate: **2 files / 108 tests PASS**.
- Adjacent Source Evidence, diagnostics and repair-loop aggregate: **3 files /
  82 tests PASS**.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- One literal `npm run check`, exactly once and without retry:
  - TypeScript and autonomous-story typecheck: PASS.
  - Ordinary phase: 282 files; 3,230 passed; 65 skipped; exactly five failed
    assertions, all in the established missing ignored-output fixture HOLD.
  - Resource-intensive phase: **20 files / 599 tests PASS**.
  - Both diagnostic protocols valid; no timeout, RPC/IPC, reporter, launch,
    signal, teardown or other infrastructure failure.

The literal repository gate remains red solely because of the five separate
fixture assertions in `child-lexicon-ages-5-8`, `momentum-gate-koko`,
`page-entity-qa`, and two `story-read-back-validation` cases. This release HOLD
is not waived.

## Unchanged boundaries, migration and rollback

- No story-, page-, child-, companion- or Dini-specific literal.
- No model, provider, endpoint, tier, reasoning, timeout, retry, fallback,
  64K input ceiling, `[40,000, 32,000, 36,000]`, `3 / 2 / 0`, optional
  reference-only cleanup, `$5` fence or candidate-policy change.
- No prompt, repair schema, persisted envelope or authority version change.
- Historical artifacts remain immutable and readable; no migration exists.
- No credential access, provider/network call, new Fresh Readiness, preflight,
  live authoring, image/Vision, render, storage/database, QA deployment,
  production deployment or push occurred during implementation.
- Rollback is a focused revert of
  `d6fe25f1e0a2ccbe461637aafb60ec158bd1b246` and its
  documentation closeout. No artifact rewrite or data cleanup is required.

## Independent QA

Pending. Claude Code must review the exact immutable base-to-head range and try
to falsify causal one-to-one eligibility, same-page/same-beat binding,
independent/mixed failure rejection, compact-applier completeness, pure
structural Book Surface eligibility, presentation-path compatibility, repeated
repair budget enforcement, input immutability, policy/version invariants and
the recorded repository gate. Codex does not self-award independent technical
PASS.
