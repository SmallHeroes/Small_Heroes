# M2b exact semantic approval and effective pending bridge

2026-09-09. Base: `4039f4c8c4616ed31146dba1134139533c5dfc8e`.
Status: implementation and focused checks complete; FULL GATE NON-GREEN;
independent code review pending. NOT complete M2b or render readiness.

## Owner decision and prior review

Guy explicitly replied `מאשר` to the immediately preceding question asking
acceptance of the exact Dini correction packet linked through REVIEW_SUMMARY.md.
This is exact product/content acceptance of packet
`b7fdd4e5fbf8f8685de7e25baa9bcefe78df95829ad30a66ab6d23981f15c1c2`,
raw SHA-256 `d2020e7381679502380fa44c0e1c357da4204155f73885adabb479759eb3c4ba`.
Do not ask again for the same content. A changed packet needs a new exact
decision. This does not approve reconciliation, Blueprint, package or release,
waive code QA or change the original paid candidate's HELD0/3/3 record.
No machine approval artifact for real P1 is minted by this unreviewed delivery.

The supplied Claude documentation PASS P0=0/P1=0/P2=0 covers only
`aa3eade8..4039f4c8`, one commit/three Markdown paths/+258/-2. It verified
log/fixture/archive evidence and did not rerun the full gate or award full M2b.
The earlier current-consumer code PASS remains `f59fe086..aa3eade8`.
The latest complete pre-implementation local gate was 5693 passed/73 existing
skips/zero failed, not an independent repository verdict. Timing cause unresolved.

Before this implementation, the real current-consumer CLI and a real-Git probe
passed at clean 4039f4c8; three malformed packet cases reached their intended
read/reconstruction errors, not the Git gate. Evidence (not a reusable approval):
`outputs/qa-m2b-real-consumer-20260909/READOUT.md`. Full proof digest
`f762911c5817fba7f553388e3289546db525871f6c7678bab89ab502910221c8`.
No independent QA for that new runtime probe is inferred. A minor contradictory
observation in the supplied review is not transcribed: the baseline extraction
post-dated the thirteen-timeout run and affected the subsequent scanner run.

## Intake, investigation and execution plan under the approved Gate

Existing approval: R3B1B_GENERAL_SEMANTIC_RECOVERY_DECISION_GATE.md, especially
§3C and §5. Same sole-writer task, worktree C:/GNart/Work/sh-r3b1b-semantic-m1,
branch codex/r3b1b-semantic-recovery-m1, starting clean 0/0 at 4039f4c8.
Dependencies d53b 768ccb2f and accepted-intent 63ccb484 are read-only. Topology
inventory inspected; no new task, parallel writer, cleanup or push. The prior
propagation was observed, not performed by this implementation or actor-attributed.

Observed: current-consumer validation returns only proof/packet/history and
explicit null approval/bridge fields. The cover-only approval/bridge consumes
unchanged original coverage, so it cannot represent this changed-coverage packet.
Expected: record the exact human decision, freshly validate the full original
chain/current consumer on each use, and project effective template AND coverage
into the established source-snapshot reconciliation builder. Keep the draft
pending until its separate review and keep all old consumers strict.

Implementation order: additive approval/pending-bridge module; strict offline
CLI; hostile and compatibility tests; full gate; focused local code commit and
Claude handoff. No source/data migration. Rollback: stop consuming these new
artifacts, or focused revert of this code milestone; original candidate/receipt
and v5 path remain intact. Never delete the original evidence or force-reset Git.

Rejected alternatives: edit the paid candidate; relax v5's coverage equality;
trust serialized validation proofs; turn content acceptance into an approved
production context; call the current paid factory with the historical receipt.
Scope is general (no story/person/page branches), zero provider cost. Existing
key reuse was already owner-selected; no credential inspection/use was needed.
Stop-check: approval/production authority is affected, so fresh validation,
strict version separation, compatibility tests and independent QA are required.
Owner content decision is now resolved; no new visual/creative choice or Cowork
consultation is needed for this code slice. Guy will review later output, not
be asked to reconfirm unchanged packet content. No image is used as a test.

## Implementation

- `semanticCorrectionApprovalBridge.ts`: exact allow-listed JSON argument
  snapshots before awaits; explicit Guy/canonical UTC timestamp and expected
  packet digest; additive approval v1 producer/reader. Approval binds request
  locators, original candidate/source/template/coverage and effective packet/
  plan/correction/template/coverage/catalog identities. Content approval does
  not pin a permanently current Git HEAD: each consumption freshly validates
  the real chain and current consumer. Load also re-reads approval bytes after
  async replay and reconstructs the whole envelope, not only its hash.
- Pending bridge manifest **v6** is distinct from the untouched current v5
  route. It embeds effective template/coverage and the result of the existing
  `buildProductionReconciliationDraftFromSourceSnapshot`, with current proof
  identity and exact approval locator/digest. Stage is reconciliation_pending,
  productionContext null. Reader repeats validation and entire reconstruction;
  stale current proof, rehashed content and after-await byte changes reject.
- One immutable JSON object is published per call using the existing contained
  content-addressed store. Only normalized outputs subdirectories are permitted;
  aliases/hardlinks/collisions are rejected. Current Git is reobserved immediately
  before publication. Existing bytes are checked before and after persistence:
  the shared store's legacy formatting tolerance cannot make this new boundary
  return noncanonical bytes as success. Default is no-write. Exact replay is
  byte-idempotent; an approval and a bridge are separate operations, not one
  cross-file transaction. No deletions/rollback of preexisting files occurs.
- CLI `scripts/semantic-correction-approval-bridge.ts`: one `--request` pointing
  to a bounded regular single-link JSON file. Envelope exactly operation and
  arguments; operations approve / prepare-bridge / read-bridge. Write is an
  explicit Boolean within producer arguments; read accepts no write argument.
  Repeated/unknown flags reject, failures print only rejected/providerCalls0.

The existing read-only validator, current paid factory, cover correction,
bridge v1-v5 and downstream reconciliation/Blueprint/package code are untouched.
Tests explicitly show the old loader rejects a new v6 pending manifest.
The v6 reader currently supports ONLY this pending state; it is not a bypass
around the established reviewed reconciliation or production authoring loaders.
Remaining M2b work: reviewed reconciliation binding/advancement and real async
consumer cutovers into Blueprint/package. No acceptance criterion was dropped.

## Validation and limitations

Initial TypeScript runs caught ES2020 Object.hasOwn use, then two test-only
literal-widening errors; corrected before validation. Initial focused run was
35/35. Final focused run: **148/148 across seven specs**, including 37 new tests,
32 current-consumer, 27 atomic correction, 27 historical chain, 11 cover-only,
7 reconciliation and 7 inventory. Root and autonomous typechecks passed before
the final full gate; the gate repeated both successfully. Final full-gate result:
**exit 1, 5728 passed / 73 existing skips / 2 failed**. Ordinary: 5059 passed,
73 skipped, 117217 ms; resource: 669 passed / 2 failed, 275907 ms. Both failures
were 5000 ms test timeouts in unchanged resource specs:

- story-source-visual-direction-correction-acceptance-lifecycle.spec.ts:675,
  isolates injected accepted-source facts from canonical package qualification,
  observed 7121 ms.
- live-request-materialization.spec.ts:1180, help mixture CLI rejection,
  observed 9410 ms.

One bounded diagnostic ran both complete affected specs unchanged: **47/47**,
exit 0, 12.93 seconds. Those cases took 3092 ms and 884 ms respectively. This
suggests timing depends on execution conditions, but proves neither an exact
resource-contention cause nor inherited failure. No untouched-base failure was
reproduced this turn, and no full gate was rerun until green. Repository stability
remains open. Only the new CLI/spec import the additive new module; the two
failing specs and their existing production paths were not edited.

Precommit `npx tsc --noEmit` also exited 0 (silent; Tee-Object did not create an
empty log). This focused delivery is retained as a local review checkpoint with
an explicit non-green repository gate, not a release-ready green milestone.
Inventory rises by one ordinary spec: 391/369/22, workers 4/2 unchanged.
No timeout, skip policy, worker policy or QA criterion was modified.

Retained evidence SHA-256:

- full-check.log: `75811451c6eff01d3c9cad94f67b7c7a50a585d5746b62b9299ea24bb99b3102`
- final-focused.log: `bb42aeb51c88b2a8edb3001bc0108819bc107c94dda5ed9859dd9e6e457c24cf`
- timeout-two-spec-diagnostic.log: `6e300adbe5a02ab51b7aeeb6d50fbbf6db91ba22913c25c4622881d4c8c29309`

Final protected-P1 inventory recheck: 14 files / 412516 bytes, SHA-256
`cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`.
Packet raw SHA still matches the owner-decision identity above. Both protected
dependency worktrees remain clean at their stated HEADs. Immediately before
the review checkpoint, ls-remote still reports 4039f4c8; no push performed.

New tests use the real P1 fixture/packet, canonical file store and reconciliation
projection, with current-consumer validation/Git mocked at their already
separately reviewed boundaries. They cover preview/write/reload, idempotency,
exact digest/reviewer/time/key checks, rehashed approval/manifest substitution,
hardlinks/category junctions, collision preservation, input mutation across
awaits, current Git drift before write, approval/manifest drift during reload,
stale bridge proof and noncanonical bytes introduced during store preparation.
Three real subprocess CLI rejections run under the network sentinel. The
original/effective packet is checked unchanged by reconciliation projection.

This is an offline trusted-operator CLI, following the existing cover-approval
trust model: approvedBy=Guy is not cryptographic identity authentication. The
operator must possess Guy's exact decision and retain the expected digest.
Content addressing is integrity, not authorization against an attacker who
controls both filesystem and operator-supplied expected digests. No new global
single-approval ledger, revocation or cross-root exactly-once claim is made.
Repeated exact decisions are idempotent at their content address; different
operator timestamps create distinct records requiring explicit digest selection.

Before/after observation is not an OS lock against arbitrary external ABA
changes. The shared store can create directories/probe files during preparation;
failure is not promised to leave zero filesystem metadata, and interrupted
writes do not grant downstream authority. A loader always validates again.
No real P1 approval/bridge was generated against this dirty/unpropagated new
code. No synthetic-Git run is presented as current authority. Actual execution
requires reviewed code, clean parity and fresh validation; Guy's exact content
decision is already recorded above and must not be requested again unchanged.

Logs: `outputs/qa-m2b-approval-bridge-20260909/`. Final commit, log hashes,
PowerShell inspection/optional propagation commands and adversarial Claude
brief are supplied in HANDOFF.md there. Independent code review is pending;
Codex does not self-award PASS. Application spend USD 0; no render/provider/key,
source/locator/Blueprint/package/publication/deployment/payment operation.
