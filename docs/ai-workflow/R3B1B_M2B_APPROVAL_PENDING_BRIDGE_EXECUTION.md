# M2b exact semantic approval and effective pending bridge

2026-09-09. Base: `4039f4c8c4616ed31146dba1134139533c5dfc8e`.
Delivery-time status at 54dbc4a7: implementation and focused checks complete;
FULL GATE NON-GREEN; independent code review was pending. Subsequent independent
PASS and bounded P2 response are recorded below. NOT complete M2b or render readiness.

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
No independent QA for that new runtime probe is inferred. The verified archive
chronology is recorded here: the baseline extraction post-dated the thirteen-
timeout run and affected the subsequent scanner run, not the earlier timeouts.

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
Exact derivation and executable command: see "P2-2 reproducibility" below;
the recipe was already published in the general Gate before this delivery.
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

## Independent QA and bounded P2 response

2026-09-09: Guy supplied Claude's read-only **PASS P0=0/P1=0/P2=6** for exactly
`4039f4c8c4616ed31146dba1134139533c5dfc8e..54dbc4a7f8e46225d60b1092ca054e1e1bd57dd5`.
Attachment e7463c1c-839c-4944-8ab3-b3b6631ff110/pasted-text.txt raw SHA-256:
`66a99f65e8bdea70c88d9983e0679195dd89dff627e1b3f36d2604dd2ac3b884`.
Its topology matches actual HEAD, 1 commit/0 merges/8 paths/+664/-4. At this
correction's start the worktree was clean, ahead1/behind0, with ls-remote still
at 4039f4c8. Same task/branch/worktree remains sole writer; both protected
dependencies remain at the clean HEADs above. No push or new task.

Claude reports both typechecks, 148 focused, 175 hostile assertions, instrumented
eager-import audit (161 modules; no credential/provider reachability), and a
GREEN independent full run: 5059 ordinary + 671 resource = 5730 passed, 73
existing skips, 0 failed. Resource elapsed219800ms; the formerly timing-out
cases took1272ms/885ms. This records the supplied review, not a Codex rerun or
verification of Claude's raw log/harness, neither of which was supplied here.
The prior three Codex log hashes and packet hash above were rechecked unchanged.
The original Codex full failure remains real. Neither run establishes stable
timing/root cause, complete M2b, product acceptance or render readiness.
Claude also confirmed real execution rejects at current Git parity and minted
no real P1 artifacts. Its scratchpad positive artifacts use mocked Git and
confer no authority. The independent code PASS ends at54dbc4a7, not this correction.

### Disposition and implementation plan

This is the bounded QA correction under the existing approved recovery Gate,
not a new product policy or authority flow. Root causes: missing named inventory
assertion, weak evidence discoverability, misleading chronology framing, and
a redundant comparison after strict canonical/digest verification. Implement
one named pin, two timestamp-behavior tests, the strict-reread simplification,
and these documentation corrections; then focused/negative-control/full checks
and one local correction commit. No migration; rollback is a focused revert.
No artifact identity/category/timestamp policy changes. No provider/key/render,
Blueprint/package/locator/source/payment/publish/deploy/cleanup operation.
The API-key skill was used as the credential boundary; existing-key choice is
already resolved, and this offline work neither inspects nor accesses it.

- **P2-1: fixed, re-gate pending.** Add the new spec's exact ordinary-partition
  name beside the existing named pins. Negative control changed only that
  expectation to a nonexistent name: six tests passed and the new assertion
  failed while both inventory count assertions passed. Restored before full run.
- **P2-2: reproducibility/navigation addressed; premise corrected.** The exact
  serialization and executable recipe were already tracked before this review
  in the general Gate. The quoted execution evidence failed to point to it
  directly. Add the direct recipe/command below, execute it, preserve same hash.
- **P2-3: test gap addressed; proposed plausibility window NOT adopted.** Two
  tests pin canonical1970 and2999 timestamps, unchanged subject, changed digest,
  rejection under original pinned digest and successful reload ONLY when the
  caller explicitly selects the new digest. This deliberately documents the
  existing operator-trust limitation, not a new authorization control. A moving
  wall-clock window during reads could expire valid decisions or make replay
  nondeterministic; an arbitrary creation epoch would not authenticate Guy.
  No authenticity/chronology truth is inferred from approvedAt. Operators must
  record the actual decision time and never manufacture a new Guy decision.
  No independent closure of this residual design observation is claimed.
- **P2-4: retained non-blocking hygiene observation.** Keep bridge-manifests:
  explicit locator/digest/version readers, not directory enumeration, select
  authority; v5 consumers still reject v6. A new directory would add another
  path contract without fixing an observed authority leak. Defer a namespace
  change unless a concrete consumer needs it; no automatic enumeration fallback.
- **P2-5: fixed, re-gate pending.** Replace "not transcribed" framing with the
  positively stated verified chronology. Do not attribute a disputed sentence
  to a reviewer or pretend the archive caused earlier timeouts.
- **P2-6: fixed, re-gate pending.** Keep the post-persist readCanonical call
  (including exact external digest, envelope hash and canonical-byte checks),
  remove the redundant bytes comparison/error branch only. Under the system's
  SHA-256 integrity assumption, the second equality check adds no protection.
  Existing during-prepare injection still rejects as artifact_not_canonical
  and leaves injected/preexisting bytes untouched. Reader/writer limits remain.

Stop-check: general guard/evidence fixes, no story-specific runtime branch;
the existing strict persistence rejection must remain unchanged. No product
choice is reopened, and no visual output needs approval in this correction.
Acceptance is focused/full evidence plus independent re-gate of these exact
dispositions, not six self-awarded closures or a timing stability claim.

### P2-2 reproducibility

Canonical source: [general Gate, Preparation evidence and independent review handoff](R3B1B_GENERAL_SEMANTIC_RECOVERY_DECISION_GATE.md#preparation-evidence-and-independent-review-handoff),
the "Exact inventory serialization" paragraph and `$p1InventoryScript` block
(lines431-470 at reviewed54dbc4a7). Paths include the repo-relative outputs
prefix, use slash separators, and sort with ordinal JS comparison. Rows have
insertion-order keys path/bytes/sha256/nlink. SHA-256 hashes UTF-8 compact
JSON.stringify(rows), no BOM/newline, NOT the artifact canonical-JSON form or
the printed summary. This explains why natural line-oriented recipes differ.

Copy-ready read-only execution of that already-published block in the protected
repository where the original14files reside (does not copy/rewrite artifacts):

```powershell
Push-Location 'C:\Users\guyna\.codex\worktrees\d53b\Small_Heroes'
try {
  $gateText = Get-Content -Raw docs/ai-workflow/R3B1B_GENERAL_SEMANTIC_RECOVERY_DECISION_GATE.md
  $inventoryMatch = [regex]::Match($gateText, '(?s)\$p1InventoryScript = @''\r?\n(.*?)\r?\n''@')
  if (-not $inventoryMatch.Success) { throw 'Inventory script missing' }
  node -e $inventoryMatch.Groups[1].Value
  if ($LASTEXITCODE -ne 0) { throw 'Protected P1 inventory mismatch' }
} finally { Pop-Location }
```

Executed at correction start: exit0, count14, bytes412516, rawInventorySha256
`cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`.

### Correction validation

Final focused150/150 across7specs, exit0 (39approval/bridge +32consumer
+27atomic +27historical +11cover +7reconciliation +7classifier). First run was
143/143 across6specs because the reconciliation path filter was mistyped;
corrected command ran the real source-prompt-reconciliation spec. Both logs
retained. Negative-control failure described above is intentional and restored.
Full correction gate: **GREEN, exit0, 5732 passed/73 existing skips/0 failed**.
Ordinary5061 (96288ms), resource671 (212048ms). Both TypeScript stages passed;
precommit root TypeScript separately exited0. Previous timeout cases passed
at1214ms and834ms. Only one full run was made for this correction. It is local
validation of these changes, not a fix for intermittent timing or independent
re-gate. The prior failed delivery log remains unmodified.
No timeout/worker/skip policy modified; inventory391/369/22 remains unchanged.
No real positive approval/bridge run: dirty/ahead code is not bypassed.
Logs and exact correction-range handoff: outputs/qa-m2b-approval-p2-20260909/.

Correction evidence SHA-256:

- full-check.log: `33139d81ab62c76bc219630dee0fe266afb977bd42f9976f9fa7e2be59d2c8ec`
- final-focused.log: `4eaa7cef856f9051ec4f23a96a425d04ea542414240112a96e1392c2cde8195d`
- named-pin-negative-control.log: `4fccd2ef2651b651a2c4a0e80fa17e58d8fdf7d898a3db2e3f787f217e2c6c51`
- protected-inventory.log: `5c1b41edbdd9369214b2956749a5333370a0d8ce0857941c84c02d45ab812198`

The exact published PowerShell block above was also extracted and executed
successfully, not just paraphrased. An initial wrapper used a relative Tee path
while Push-Location was active and failed to save its log; using an absolute
implementation-worktree log path fixed the wrapper. No protected file or directory
was created. Final dependency statuses are still clean; original inventory and
packet hashes unchanged. No reviewer was dispatched or independent closure
self-awarded. The correction commit remains outside the54dbc4a7PASS boundary.
