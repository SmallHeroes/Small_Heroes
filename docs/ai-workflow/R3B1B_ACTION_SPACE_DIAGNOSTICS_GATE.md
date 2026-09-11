# Action-space repair diagnostics — approved offline milestone

2026-09-11. Guy approved the scoped correction after Claude's offline diagnosis
review. Sole Codex writer continues in C:/GNart/Work/sh-r3b1b-semantic-m1,
codex/r3b1b-semantic-recovery-m1, base41f90dbc, clean ahead1/behind0.
No separate task or parallel writer. Dependencies768ccb2f/63ccb484 read-only.

## Change and verified cause

The zero-compatible action-space branch emits a generic issue although its
acceptance predicate combines multiple independent requirements. Repair already
gets draft and action ID; grouping does not discard them. Exact historical failed
predicate remains unknown because only sanitized census was retained.

Use one evaluator for acceptance and bounded rejection reasons, decomposing
action support subconditions. Keep issue code/message/expected/actual unchanged;
repair-only sidecar must not alter grouping or persisted census identity/caps.
Bound candidate details per issue and total serialized sidecar bytes with explicit
omissions. Preserve acceptance, ambiguity and malformed-input handling.

## Scope / risks / files

General validator/repair prompt change; no Dini-specific exception. Likely files:
preRenderBlueprint, types, authoring/contract, executionProgram and focused specs.
Risks: evaluator drift, diagnostic expansion, leakage, historical program rejection,
changed identity being mistaken for fresh paid authority. Old program remains
replay-supported only, not current. Current-consumer proof still applies to replay.
No automatic successor migration or authorization follows the new program.

## Proof and rollback

Red focused regression before production edits; isolation of support/binding/
geometry reasons, valid/ambiguous behavior, bounded sidecar, identical grouping and
sanitized census, real repair-prompt wiring, old/new program classification.
Run typechecks and npm run check; no exclusions/timeouts weakened. Commit local
green milestone, provide Claude immutable range and falsification brief. Revert
focused code before live use if needed; never erase any receipt/claim/artifact.

## Owner decision / exclusions / stop-check

Approval covers this offline implementation, not another paid run. API/image/audio
costUSD0. Existing key choice unchanged, no key read required. No source/template,
creative change, budget/retry/fallback/gate weakening, deployment, push, raw draft
persistence or new billing authority. CLI reason-code P2 is separate. Cowork not
needed: no unresolved creative decision. Claude must attack predicate equivalence,
sidecar bounds/leakage, census preservation and historical replay classification.
Guy retains product acceptance and any future spend decision. All stop-check
questions resolved for this narrow scope; code PASS remains4e408bda until review.

## Implementation outcome

Implemented the same-evaluator sidecar, capped at 8 candidates and 8192 UTF-8
JSON bytes with explicit omissions. Repair prompt v11, frozen v10 history.
18 new tests; final full check exit 0, 5898 passed / 73 existing skips / 0 failed,
both typechecks passed. First full run's two introduced expectation failures
were corrected; its red logs are retained, not reclassified as inherited.
45 original evidence entries unchanged. No live calls or key reads. Independent
review remains pending; runtime success and another paid attempt are not implied.
