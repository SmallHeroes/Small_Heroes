# R1D — Full-Draft Repair Input Compaction — Implementation Evidence

## Scope and topology

- Base: `d973cacf2fdc6ecfc0120944d5e32638d53ab7b3`
- Branch: `codex/r1d-full-draft-repair-input-compaction`
- Implementation commit: `7239e26e`
- Production surface: one compiler module
- Test surface: four existing test files; no workload-inventory change
- Decision Gate: `R1D_FULL_DRAFT_REPAIR_INPUT_COMPACTION_DECISION_GATE.md`

This milestone is general to every Story Source. It contains no Leo, child,
companion, page, source phrase, or provider-response literal.

## Trigger evidence

The consumed output root
`outputs/r1d-leo-adventure-three-page-proof-v8-20260815-clean-bootstrap`
proved that the prior mixed-validation routing correction worked. The initial
provider response and one compact page-spatial repair completed. The compiler
then selected the existing `full_draft` lane for the final bounded repair.

Provider admission rejected that third attempt before provider reachability as
`input_limit_violation / input_token_ceiling_exceeded`. The receipt recorded:

- logical provider calls: `2`
- repairs completed: `1`
- transport retries: `0`
- fallback: none
- usage: input `17,632`; cache-write `16,990`; output `26,692`;
  reasoning `2,724`; total `44,324`
- nominal authoring accounting: `$0.910158`
- conservative authoring accounting: `$1.002057`
- candidate/reconciliation/Blueprint/render authority: none

The consumed attempt is historical evidence only. No artifact in that output
root was edited or reused as authority.

## Implemented behavior

The full-draft repair user input now uses the existing canonical dictionary
codec already proven by compact page repairs. Its decoded closed root contains:

- story key and page count;
- the exact current validation errors;
- deterministic human identity/role/gender/page-presence facts;
- authored cover authority or explicit `null`;
- relevant exact same-page Source Evidence Catalog entries;
- the complete previous invalid draft.

Before provider reachability, the compiler strictly decodes the emitted
envelope and compares canonical JSON to the original payload. Any omission,
mutation, malformed envelope, unused dictionary entry, or round-trip mismatch
fails locally. The system prompt contains the closed decoder grammar. The
provider still returns the same complete draft through the unchanged
`TEMPLATE_DRAFT_JSON_SCHEMA`.

Prompt authorities cut over from `vc-repair-prompt/v10` and
`vc-repair-user-prompt/v11` to `vc-repair-prompt/v11` and
`vc-repair-user-prompt/v12`. Current lifecycle and materialization expectations
bind the new versions. Historical receipts/readiness remain immutable.

Unchanged: model, Responses endpoint, service tier, reasoning effort, 64K
conservative input ceiling, output/call/repair/cost budgets, timeout, transport
retry count, no-fallback policy, all compact repair lanes, output schema,
candidate semantics, downstream behavior, and the hard `$5` cap.

## Validation

Focused validation:

- `visual-contract-repair-loop.spec.ts`
- `visual-contract-prompt-table-compaction.spec.ts`
- `source-authority-lifecycle.spec.ts`
- `live-request-materialization.spec.ts`
- result: **4 files / 137 tests PASS**

The focused tests prove:

- exact lossless payload reconstruction;
- envelope key-order invariance;
- malformed, extra-key and unused-dictionary tamper rejection;
- a large repetitive complete-draft input fits below the unchanged 64K ceiling
  with more than 4,096 units of headroom;
- a deterministic incompressible oversized input still fails admission before
  a second provider call;
- current prompt-version propagation through lifecycle/materialization;
- existing repair budgets, schemas and strict validation remain active.

Additional validation:

- `npx --no-install tsc --noEmit`: PASS
- `git diff --check`: PASS
- one literal `npm run check`: repository HOLD only
  - both TypeScript contracts: PASS
  - resource-intensive: **19 files**, PASS, valid diagnostic protocol, no
    timeout/RPC/IPC/reporter/launch/signal/teardown failure
  - ordinary: **280 files**, failed on exactly the six established missing
    ignored-output fixtures and no seventh failure
  - canonical inventory: **299 files**

The six-fixture condition is a separate release HOLD. It is not a finding in
this implementation and grants no Production authority.

## Boundaries and cost

Implementation and validation performed no credential access, pricing lookup,
network/provider/model call, B0/Fresh Readiness, canonical preflight, live
authoring, image/audio generation, render, storage/database, QA deployment,
Production deployment, or push. External cost was `$0`.

## Rollback and next gate

Rollback is a focused revert of `7239e26e`; any later live attempt would still
require newly materialized Fresh Readiness. Before push or operational reuse,
Claude Code must independently falsify the implementation claims and return a
technical PASS/HOLD for the exact base-to-head range.
