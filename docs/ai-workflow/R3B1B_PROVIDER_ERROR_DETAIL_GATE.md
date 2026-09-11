# Provider error-detail logging — approved offline implementation

2026-09-11. Guy explicitly requested continued implementation without repeated
permission prompts. Scope here is the proposed safe error-detail correction.
Same sole Codex writer/task: C:/GNart/Work/sh-r3b1b-semantic-m1,
codex/r3b1b-semantic-recovery-m1, base e71777ea, clean ahead 1 / behind 0 at start.
Dependencies 768ccb2f / 63ccb484 read-only. Claude docs/runtime PASS 0/0/0 for
0ee03c35..e71777ea received; code PASS remains d0af988c.

## Observed / expected / cause

Real execution received HTTP200 and a generic SDK/provider rejection, before
repair. Exact historical error is irrecoverable from retained evidence. Code
inspection shows distinct detail-loss points: structured SDK codes collapse to
broad classes, SDK type/kind is not fully logged, and direct stream error events
discard their code/param before the transport catch. This proves observability
gaps, not the real provider rejection's root cause. HTTP200 alone does not rule
out an application-level quota/auth/access error embedded in streaming data.

## Proposed solution / scope / rejected alternatives

Preserve a log-only bounded detail sidecar on the existing diagnostic exception:
closed exact provider-code/type allowlists, explicit missing/invalid/unknown
states, digests of bounded unknown codes/types, safe parameter class and source.
Retain direct stream-event details before discarding raw event text. Publish a
v2 supplemental Blueprint log, with SDK kind and revalidated sidecar. Keep all
old classifier outputs, receipt/census/evidence projections, prompts, program
identities, policies and terminal behavior unchanged. No free-form message,
raw unknown identifier, request body/header, key, child data or raw request ID.
No regex-only raw-code logging: a syntactically valid token can contain a secret.
No parsing human error-message prose to invent a diagnosis. No raw response archive.

## Files / plan / acceptance

Shared providerFailureDiagnostics and streaming adapter, Blueprint logger, existing
focused specs, CURRENT/ROADMAP and this gate. General system change, no story or
child exception. First prove a red real-SDK/fake-fetch HTTP200 error-event test.
Then implement; cover known/unknown/missing/malformed code/type, hostile getters,
oversize strings, free-text exclusion, sink failures, successful response silence,
same terminal behavior, one fake dispatch/no retry, and old evidence identity.
Run both typechecks and full npm run check. No inventory/worker/policy weakening.
Preserve original runtime evidence/ledger. Focused local green commit and exact
Claude adversarial handoff; no self-awarded independent code PASS.

## Risks / rollback / authority / stop-check

Risks: raw-data leakage, changed exception routing, altered persisted identities,
unbounded logging, misdiagnosis of missing data, fake transport details treated as
authority. Re-project all fields by own-property descriptors/closed values; cap
unknown-string hashing and serialized log size. Supplemental detail never grants
retry/spend. Revert this isolated code milestone if needed; retain all old artifacts.
No provider/key calls or images for implementation tests (USD0). Standing key
reuse choice unchanged. No reset/chaining of consumed identities. Existing full
continuation instruction does not waive independent QA or establish an unlimited
spend allowance. No payment, deployment, publication, model or creative changes.
Cowork/visual acceptance not applicable to log-only change. All stop-check scope
questions resolved for this implementation; future paid work remains separately
bounded and dependent on a valid reviewed execution route.

## Implemented outcome — independent QA pending

Three production paths, two existing specs, no schema/prompt/program change.
93 focused tests passed, including two real-SDK/fake-fetch regressions proven red
first. Final full npm run check exit 0: both typechecks, 5913 passed / 73 existing
skips / 0 failures, unchanged 392-spec inventory. First actual full run had a
5000ms canonical-materialization-input writer-sentinel timeout; unchanged isolated
rerun passed 15/15, then unchanged full rerun passed. No timeout/worker changes.
Failed logs retained; no untouched-base proof or closure of resource reliability P1.
An earlier launcher quoting error occurred before npm/tests and is also disclosed.
Original 45-entry and prior 45-entry overlapping inventories unchanged; latest live
PREPARATION/execute/replay log hashes and program identities preserved. No spend.
Read-only follow-on predecessor inspection hit the existing dirty/ahead consumer
guard; no successor eligibility or execution is claimed. Local-only full evidence
and QA handoff: outputs/r3b1b-provider-error-detail-20260911 (ignored, no verified
off-machine backup; push does not preserve it). Code PASS remains d0af988c.
