# R3-B1b M2b — historical-chain prerequisite

2026-09-08. Implemented locally; FINAL FULL CHECK NON-GREEN. Independent QA pending.
This is a prerequisite inside M2b, not completed M2b or render readiness.

## Received review and authority

Guy supplied Claude Code's read-only PASS P0=0/P1=0/P2=0 for M2a code scope,
exactly `1e97f373..fdd568af`, branch `codex/r3b1b-semantic-recovery-m1`.
The prior wording P2 is closed. Topology reconciles: 1 commit, 0 merges,
14 files, +3631/-7; four production paths; 2654 lines are the raw fixture.
Claude independently ran both typechecks, 216 tests in 7 specs, 30 adversarial
assertions and held replay. It checked exact packet/fixture identities and
the local full-check log by SHA/content. It did not rerun the full gate,
perform a CLI write, verify Linux/fresh clone, or award full M2, semantic/product
acceptance, independent repository PASS or render readiness.

The original six-item P1 semantic HOLD remains P0=0/P1=3/P2=3 pending exact
review/acceptance; M2a technical PASS is not Guy's product decision.
The previous full log still hashes to
`f0dacd55b720ddccf89f1bf75278dfa1ba4879a82e9bd6f54d07a370ff2d19e5`.
Earlier independent ranges are unchanged.

Standing owner approval covers the general recovery implementation, including
historical input and changed-coverage/current-consumer bridge work. The current
task remains sole writer in `C:/GNart/Work/sh-r3b1b-semantic-m1`, from exact base
`fdd568af021623e65539fd607ddde010bbed379c`. Start: clean, cached ahead 10 / behind
0. Protected d53b `768ccb2f` and accepted-intent `63ccb484` were clean, 0/0 and
read-only. No new app task, parallel writer, push or cleanup operation.

## Investigation, root cause and sequencing

M2a proves a correctable original and separate effective template/coverage.
M2b must also prove the original paid chain, then bind fresh current consumer
authority and changed coverage in an explicitly versioned bridge.

Active-code diagnostic against the protected original B0 manifest returned:

```json
{"version":"canonical-live-request-verification/v54","status":"rejected","zeroWrite":true,"reasonCodes":["live_authoring_request_not_canonical_current_policy"]}
```

This is not a corrupt candidate. `verifyCanonicalLiveRequestBundleUnsafe`
reconstructs the old catalog-v3 request through the current catalog-v4 factory.
`loadCanonicalSupervisorArtifacts` calls that verifier before later receipt/
candidate checks, and readiness construction/persistence separately enforce
current prompt/schema authority. The known current-candidate factory pin is
therefore not the only historical boundary.

Expected: full validation of immutable historical inputs without letting that
result satisfy a live preflight, current attestation or approval. Merely skipping
B0 verification, retaining digest-only checks or rebuilding old paid artifacts
as current would lose provenance. Merely changing the bridge's coverage digest
would not repair this earlier failure.

Implementation order: first this read-only historical-chain prerequisite; after
independent review of this authority boundary, add the changed-coverage manifest
and fresh current-consumer/approval cutover. No M2 acceptance criterion is
dropped. This delivery does not claim that the existing bridge can consume the
new correction yet, and does not create a bridge manifest or approval artifact.

Relevant callers/version pins inspected: live-request materialization and its
public verifier; candidate validation and reconciliation preparation/loaders;
readiness construction/persistence; immutable replay and legacy candidate reader;
reconciliation authoring, Blueprint authoring and package lifecycle manifest
version checks. The latter consumer cutover is expressly still outstanding.

## Small general implementation

1. `assertHistoricalVisualContractAuthoringRequestV56` compares an existing
   request to exact frozen-v3 reconstruction. It returns void, not a request
   factory. Current request factory still has no historical-profile argument.
2. Readiness assembly is shared privately, with the existing current wrapper
   selecting the current catalog. The historical assertion first checks the
   exact legacy request/receipt and then reconstructs every readiness field.
   It returns void, never persists or mints current readiness. Public current
   readiness construction and persistence still reject the original tuple.
3. `verifyHistoricalLiveRequestBundle` uses the complete existing B0 graph
   verifier with a private historical profile. Before its compatibility checks,
   the frozen request is equality-validated; the current-only request checker
   is not substituted with an unchecked digest. Source, canonical bytes,
   descriptors, schema compatibility, budgets and bundle bindings remain checked.
   Its public result is `historical-live-request-verification/v1` with status
   `historical_verified`, never the live `verified` result/version. Scope is
   immutable historical input only, with explicit non-authorizations.
4. The existing Supervisor graph loader privately selects the same profile.
   `loadHistoricalCanonicalSupervisorArtifacts` is an explicit read-only wrapper.
   Existing callers retain the default current profile; an extra runtime
   `profile` property in public current arguments cannot switch that profile.
5. New `historicalCandidateChain.ts` checks canonical disk identity, the exact
   source/request/receipt/readiness/candidate tuple, B0/Fresh Readiness/Supervisor
   provenance, and exact captured-response replay. Live mode, completed outcome,
   canonical execution accounting, template/coverage/catalog/source bindings and
   zero retry/fallback are required. Every original input is only read.

The result binds the 13 relevant authority identities in a deterministic
`historical-candidate-chain-validation/v1` proof. `currentConsumerAuthority` and
`semanticApproval` are explicitly null. No write/output/approval/current-consumer
argument is accepted. This result is not a persisted attestation, and later
bridging must recompute history and bind fresh consumer authority separately.
The old live-HEAD candidate-validation attestation is not consumed as current.

No story, child, companion, page or prop literals occur in production logic.
Story-specific regression inputs are byte copies of the real request, receipt
and readiness plus the already tracked M2a candidate/source fixture. Fixture
raw hashes and original locations are in `semantic-recovery-provenance.md`.

## Actual runtime evidence

`outputs/qa-m2b-history-20260908/verify-real-history.ts` ran active code against
the original protected d53b artifacts with external networking denied.
The historical B0 result passed; the current result still rejected the same
original with the same reason. The complete chain and exact replay passed,
providerCalls 0, zeroWrite true. Historical repository HEAD remains `18f22e75`,
not the active consumer HEAD. Deterministic proof digest:

`3fa83ab299f7807907e5ebc6769e58b1562f2af8581bbbb09b545eac4ee9b437`.

`probe-real-history.ts` additionally ran **18 assertions / zero failures**:
positive controls for credential-read and write sentinels, a valid real graph,
noncanonical-byte attacks on candidate/request/receipt/readiness/Fresh Readiness/
execution request/result/B0/source authority/snapshot/replay, current-verifier
profile injection rejection, current-attester rejection, deterministic replay
after attacks, and zero implementation write/credential attempts. Attacks are
in-memory read overrides, never edits to the original. Network denial is
preloaded; the credential sentinel covers `.env` file reads and the write
sentinel covers `writeFileSync`, not every possible OS side effect. Code paths
were also inspected; no broad OS sandbox claim is made.

Raw evidence hashes:

| Log | SHA-256 |
| --- | --- |
| real-history.log | `ec69029a17d577c5c78796e0123f96fd4324a4a6aba6cdbaa0e6a098ae62ae22` |
| adversarial-history.log | `a87e91d0fa0d30ba7da91b8e6e2bcb6bb547943050d1f502b968173c21f02190` |
| focused-core.log | `946b1aa802c7c2e86947e036590ac3d6b3b329aeddd217e5f06689d9f3c9d253` |

## Validation

Focused core: 61/61 in 3 specs, exit 0, including 27 new historical tests,
27 M2a tests and 7 workload tests. Tests reject rehashed request fields, invalid
mode/version/catalog/schema, unknown fields, forged readiness approval/blockers/
accounting, candidate substitutions, receipt accounting laundering and source
relabeling. New assertions accept no write/approval/current-consumer argument.

Initial `npm run check` exited 2 at root TypeScript, before any suite:
the new adversarial test incremented a nullable dispatch count without an
explicit fixture guard. The test now requires the observed count to be non-null
before incrementing it. No production rule was weakened. That failed output
is preserved as `full-check-typecheck-failed.log`; it was not overwritten.
After that fix, `full-check.log` completed with exit 1: ordinary 4990 passed /
73 existing skips; resource-intensive 668 passed / 3 failed. All three failures
were 5000ms timeouts in unchanged tests: canonical pre-live readiness's
one-attempt/resume test (6245ms), and live-execution request materialization's
Windows-path/Unicode test (6567ms) and branch/ref/divergence movement test.
No assertion mismatch, native root cause or inherited classification is claimed.
The failed full log SHA-256 is
`6fe3bee4b9ebc83202f6a5b4d816fea668c599a0f5c447f7b7881a5fc3f72503`;
the initial typecheck-failed log is
`83fda67b6f1686d7f8f1042ba1e88167a895eb55bfeff0ca8feb50ae00f3217f`.

All three passed in separate targeted runs with unchanged 5000ms limits:
3861ms (pre-live), 3824ms and 4016ms (materialization). Selection excluded
13 and 19 other tests respectively; those are targeted-run exclusions, not
new repository skips. Both process exits were 0. This establishes an
intermittent timing failure on this code, not its cause or that it is inherited.
One further complete uninstrumented run, without code/worker/timeout changes,
is recorded separately as `full-check-final.log`: exit 1, both typechecks pass,
ordinary 4990 passed / 73 existing skips (367 files, 121530ms), resource 670
passed / one timeout (22 files, 338392ms). Total **5660 passed / 73 existing
skips / one failed**. All three earlier timeout tests passed in this full run.
The remaining failure is the unchanged `live-execution-supervisor.spec.ts:1565`
test, "runs the real verify entry beneath credential/provider/network/write
sentinels with positive controls", at the unchanged 5000ms limit. Final log
SHA-256: `a906d9f0b734ae436b0246d4ea3cfc59bb96654e841abb467c5e2ea05c683b03`.
This is not a full green gate and is not relabeled passed by combining separate
runs. No timeout/worker/skip changes or repeated full-run loop follows.
The remaining Supervisor test then passed alone at 3448ms with the same 5000ms
limit, exit 0 (`isolated-supervisor.log`; 47 other tests excluded by selection).
That strengthens the intermittent-timing observation only; the final full gate
is still non-green and the underlying cause remains unresolved.

One new ordinary spec: inventory 388/366/22 becomes 389/367/22. Worker limits
remain 4/2; no dependency, timeout, diagnostic protocol or skip policy changes.
Full graph filesystem evidence is from this Windows workspace, not a fresh
clone or Linux run. The committed pure tuple/reader tests use portable tracked
copies; they do not claim to independently exercise the entire Supervisor
graph. Existing B0/Supervisor/bridge regressions are included in the full gate.

## Stop-check, risks, remaining work and rollback

General fix, potentially shared with all historical candidates; old/current
behavior needs regression evidence. It changes read-only authority validation,
not paid generation. Cost USD 0. Smallest useful proof is the original exact
graph plus current-lane rejection and hostile/rehashed input tests, performed.
No new product choice is needed for this prerequisite. Claude should falsify
profile leakage, skipped validation, replay/receipt mismatch, self-rehashed
authority, silent current factory relaxation and incomplete graph claims.
Cowork review is not needed for this read-only compatibility boundary; Guy's
exact semantic acceptance still belongs to the existing M2a before/after packet.

Remaining M2b: new changed-coverage bridge manifest and consumers, fresh
current-consumer validation, exact correction approval/reconciliation binding,
and full before/after product acceptance. Only then downstream Blueprint,
Boards/package qualification and the bounded LOW sample. Current consumer
attestation also requires a clean propagated implementation HEAD; no push is
inferred from standing render approval. No approval artifact is created now.

Rollback: revert this focused prerequisite or stop invoking the new historical
reader. The current route remains unchanged and the original paid files remain
intact. No data migration, source change, paid call, credentials, images, audio,
package, locator, publication, deployment, payment, branch or worktree deletion.
No independent PASS is self-awarded. The immutable QA range and inspection/push
commands are in the local HANDOFF after the local commit.

Local `claude auth status` at 21:06:57 +03:00 again returned loggedIn false /
authMethod none, exit 1. No review was dispatched and no model work occurred.
The authenticated external review route used by Guy remains the handoff route;
this is not a claim that local login was repaired or an invitation to disclose
credentials in chat.
