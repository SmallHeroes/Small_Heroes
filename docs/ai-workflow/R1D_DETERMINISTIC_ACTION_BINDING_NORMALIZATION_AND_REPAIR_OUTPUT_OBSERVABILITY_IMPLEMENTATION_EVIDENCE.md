# R1D Deterministic Action-Binding Normalization and Repair-Output Observability — Implementation Evidence

**Date:** 2026-08-17

**Status:** local implementation green; independent Claude Code QA pending;
unpushed; no Fresh Readiness, live, candidate, Wizard or render authority

## Topology

- Worktree: `C:\GNart\Work\sh-wt-r1d-output-budget`
- Branch: `codex/r1d-deterministic-action-binding-normalization`
- Exact pushed and independently QA-passed base:
  `097282d547cbbeb7aeb1db66988ef9729c7caddf`
- Implementation commit:
  `6c3a4c1966b04f29d4656367dc339e2edfb56be3`
- Decision Gate: `R1D_DETERMINISTIC_ACTION_BINDING_NORMALIZATION_AND_REPAIR_OUTPUT_OBSERVABILITY_DECISION_GATE.md`
- Production: untouched
- Implementation/validation cost: `$0`

## Consumed live evidence

The immutable failed attempt remains under
`outputs/r1d-atomic-binding-template-fresh-097282d5-20260817T102858388Z`.
It must not be rerun or rewritten.

- Source snapshot:
  `f8ac1292d5e225a8ff90c462416a44fe61f89b2c47f1529a1e43dd8025f1a079`
- Authoring request v29:
  `84966a8a88f0e045eee2836d0edabf0b32c8cad796e0049c6334c92ea7959394`
- Fresh Readiness v26:
  `09ce1ba46d0dbe6ad328a253afea96dd1cf3583b36534a642acdd2e34094a8af`
- Execution Request v26:
  `b6ef03a28ac9b6e37219975d58caa67aece2db287afa3159cdff1425f30b8bbc`
- Receipt v32:
  `ecc8b9ec5b6e49162731e8e81a9e9684a5e457b074e36e578f862cbd690f0de3`
- Readiness v30:
  `7ab6531f7544bb16bce998174dd08c60692548b3586fa97eb98e229d1d4a2b9e`

The attempt made exactly two completed logical provider calls, one repair, two
dispatches, zero transport retries and no fallback. Attempt output caps were
`40,000` and `32,000`. Aggregate usage was 23,495 input tokens, 42,654 output,
5,965 reasoning and 66,149 total. Nominal cost was `$1.426457`; conservative
cost was `$1.569111`, below the unchanged `$5` ceiling.

The initial response produced eighteen typed
`action_binding_cardinality_invalid` diagnostics: twelve action locators and
six coverage locators arranged as six exact duplicate components across pages
3, 6, 7, 11 and 12. The second provider response completed the strict
`page_contract_patch` response boundary, but local application rejected it.
Receipt terminal state is `repair_output_invalid / repair_output_failure`, phase
`repair_output_validation`, reason `completed_repair_output_unusable`, with
candidate absent. Supervisor v19 correctly recorded child failure and null
output authority. No Reconciliation, Blueprint, Visual Package, Wizard, image
or render authority exists.

## Root cause

The compiler already owns every value needed to split an exact duplicate
action-binding component into a 1:1 action/coverage graph. Sending the complete
page to a reasoning model forced it to reproduce temporary mechanical beat IDs
and exact Source Evidence bindings, adding cost and a strict local rejection
surface without creative authority.

Separately, the four atomic-component application exceptions were missing from
the closed repair-output identity catalog. The immutable receipt therefore
preserved only `unclassified`; it cannot truthfully distinguish component
scope, staleness, beat-ID or target rejection. The implementation does not
fabricate which one occurred.

## Implementation

`actionBindingComponentNormalization.ts` adds a pure compiler-owned v1
normalizer. It runs before every provider-response assembly and:

- admits only a complete same-page component with at least two actions, one
  valid shared page beat, exactly one total coverage record for that beat,
  exact `{ kind: "action_requirement" }`, and resolvable same-page Source
  Evidence;
- preserves the first action, original coverage record and existing Source
  Evidence ID exactly;
- derives later beat IDs only from normalizer version, page, source beat and
  compiler-owned action/coverage coordinates, never authored prose or Source
  Evidence text/content;
- collision-checks against every action and every coverage disposition;
- appends exactly the missing action-requirement records in deterministic order;
- enforces exact postconditions, does not mutate input, is idempotent and
  consumes no provider call, repair, retry or output-budget slot;
- leaves ambiguous, malformed, mixed, partial or unresolved structures byte-
  unchanged for existing fail-closed validation.

Assembly still executes all existing source, action-semantic, structural,
presentation, recurring-prop and final-template validators. No issue is waived
and no candidate is manufactured.

The four component application exceptions now enter the closed sanitized
identity catalog. Component scope maps to `non_target_drift`; component stale,
beat-ID and target errors map to `target_identity_invalid`. All four remain
terminal and cannot enter the legacy scalar scope retry.

## Authority and compatibility

- Repair-output diagnostics current authority advances from
  `visual-contract-repair-output-diagnostics/v1` to v2.
- Exact v1 diagnostics remain read-only only when their identity belongs to the
  frozen pre-v2 domain. A redigested v1 artifact carrying a v2-only component
  identity is rejected.
- The real consumed v32 receipt and derived v30 readiness containing exact v1
  diagnostics validate, persist, reload and rebuild without mutation.
- Current builders write v2 only.
- Authoring request v29, receipt v32, readiness v30, authoring policy v12,
  page-repair schema/prompt/user-prompt/input authority, model, tier, reasoning,
  timeout, call/repair/retry budget `3 / 2 / 0`, output caps
  `[40000, 32000, 36000]`, fallback, `$5` fence and candidate/downstream
  semantics remain unchanged.
- No package, lockfile, database or artifact migration exists.

## Regression contract

The tests prove exact minimum mutation, source-prose-independent identity,
input non-mutation, idempotency, six-component deterministic ordering,
cross-disposition collision handling, malformed/wrong-page Source Evidence,
invalid beat and duplicate page rejection. They also prove local normalization
does not consume a repair, the next genuine book-surface repair retains the
second output cap, and a failed later repair cannot trigger an unauthorized
cleanup call.

The receipt/readiness regressions cover all four current v2 identities, exact
legacy v1 readability, v1-with-v2-identity rejection and outer terminal type
soundness. The repository workload classifier records the new pure in-memory
spec as ordinary.

## Validation

- Focused normalizer, diagnostics, domain and lifecycle:
  **4 files / 166 tests PASS**.
- Adjacent page repair, repair loop and live-authoring lifecycle:
  **3 files / 114 tests PASS**.
- Repository-gate correction slice:
  **2 files / 12 tests PASS**.
- Deterministic `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- Internal adversarial micro re-gates: PASS, zero BLOCKER, MAJOR or MINOR.

One literal `npm run check` was run exactly once and was not retried:

- TypeScript and autonomous-story typecheck: PASS.
- Ordinary phase: 282 files; 3,226 passed; 65 skipped; seven failed
  assertions. Five are the established missing ignored-output fixture HOLD.
  The other two were stale contracts exposed by this implementation: exact
  duplicate bindings now normalize locally, and canonical inventory increased
  by one ordinary spec. Both were corrected and the focused 12-test slice
  passes.
- Resource-intensive phase: **20 files / 599 tests PASS**.
- Both diagnostic protocols were valid. No timeout, RPC/IPC, reporter, launch,
  signal, teardown or other infrastructure failure occurred.

The literal repository gate remains non-green because the five established
fixtures are absent. It was not rerun after the two focused corrections.

## Separate release HOLD

Five unchanged assertions still depend on ignored historical outputs:

- `child-lexicon-ages-5-8.spec.ts` — one missing story fixture;
- `momentum-gate-koko.spec.ts` — one missing page-beats fixture;
- `page-entity-qa.spec.ts` — one missing PNG fixture;
- `story-read-back-validation.spec.ts` — two missing story fixtures.

This release HOLD is neither waived nor classified as an implementation
failure.

## Boundaries, rollback and next gate

No credential or `.env` access, network/provider call, pricing lookup, Fresh
Readiness, canonical preflight, live authoring, image/Vision, render,
storage/database, QA deployment, production deployment or push occurred during
this implementation milestone.

Rollback is a focused revert of the implementation and documentation commits.
Historical artifacts remain immutable. No data or external state rollback is
needed.

Independent Claude Code must review the exact immutable base-to-head range and
try to falsify eligibility, minimum mutation, collision coverage, prose-
independent identity, deterministic ordering, no-budget consumption, full
revalidation, terminal diagnostic mappings, v1 readability, v2-only writing,
unchanged policy and the recorded validation. Codex does not self-award the
independent technical PASS. No push, new Fresh Readiness, provider call or
render is authorized by this implementation evidence alone.
