# Companion presence correction — independent code review requested

## Requirement / topology

Restore an omitted primary companion when the exact accepted typed visual direction
requires presence, without inventing secondary humans or changing the paid candidate.
General code, not a Panda/page6 branch. Same sole-writer task/worktree
`C:/GNart/Work/sh-r3b1b-semantic-m1`, branch `codex/r3b1b-semantic-recovery-m1`.
Base `3fb03452398b8724df2785ecc715114cc9d90b4b`; review the single following
implementation commit (its immutable HEAD is supplied in the accompanying message).
Start clean/ahead3. Protected dependencies d53b768ccb2f and wave263ccb484 read-only.
No push, credentials, provider, image/audio call or cost. No independent PASS claimed.

Claude's evidence PASS e9a859d3..3fb03452 is recorded, not expanded to this code.
All earlier semantic HOLD findings remain except that an offline remedy for the
page6 presence omission is now implemented and demonstrated, pending code QA.

## Implementation

- `lib/visual-package/visualContractSemanticCorrection.ts`: one additive typed
  operation, exact before-state and primary identity checks, private effective
  facts/cast/presence updated before cast-consuming operations, full validation.
  v2 only when presence operations exist; rehashed v1 downgrade fails closed.
- `lib/visual-package/acceptedCompanionPresenceEvidence.ts`: bounded UTF-8 source
  proof; raw SHA from validated accepted snapshot, exact story/version/page inventory,
  and literal typed present required. No prose inference. This helper does NOT
  establish acceptance by itself; its expected hash must come from validated authority.
- One new32-case spec, source-bound fixture builder, semantic copy of paid candidate.
  Candidate identity41d40069 is pinned by canonical digest, NOT raw fixture SHA.
  Source files, original candidate, receipts, compiler/extractor, provider paths,
  thresholds, reader and other production modules unchanged.
- `verify.cjs` uses the actual local paid candidate, not only the fixture. Normal
  invocation is read-only. `--record` created verification.json once with wx.

Why embed exact direction bytes in the operation: preserves existing source snapshot
and historical replay identity while transporting independently verifiable typed
evidence through every existing packet reconstruction. Larger operations are bounded
and review-only. Existing preview/consumer size limits remain; no silent truncation.
Old plans/packets retain shape, version and exact digest. No new CLI switches.

## Demonstrated results

Focused command (PowerShell, repository root):
```powershell
npx vitest run lib/visual-package/__tests__/semantic-companion-presence.spec.ts lib/visual-package/__tests__/semantic-correction.spec.ts lib/visual-package/__tests__/semantic-correction-consumer.spec.ts lib/visual-package/__tests__/semantic-correction-approval-bridge.spec.ts lib/visual-package/__tests__/accepted-supporting-cast-review.spec.ts lib/__tests__/supporting-cast-review.spec.ts --maxWorkers=1
```
Exit0, 6specs269/269:32+27+32+131+18+29. New spec tests actual network-denied CLI,
pending packet write/replay, fail-before-output, unchanged input and old packet,
wrong source/page/identity, stale/duplicate/downgraded operations, typed absence,
malformed versions/inventories, order-independent projection, rehashed tampering.

Current-consumer v2 tests use REAL disk accepted-source validation and reconstruction;
historical replay and current Git observation are mocked there. Existing131 bridge
tests rerun, but no real new semantic approval, full production bridge, Blueprint
or render was issued. Prompt materialization is real and includes companion6.

Actual witness result: plan9dad12a8, correction6e2db082, effective templatedc9ee910.
Only companion presence and castIds change on6. Every other page and all coverage
are deep-equal. Three negative controls. Six original run files preserve hash,
size and mtime. Prior verify/semantic-witness/review-attribution also exit0; prior
paid replay remains exact/providerCalls0. Nine accepted source files preserved.

## Full gate / limitations

`npm run check` final native exit1. Both preceding typechecks exit0; standalone
`npx tsc --noEmit` also exit0 after final code edits. `git diff --check` clean.
Ordinary389 files:1 failed/371 passed/17 skipped; tests1 failed/5724 passed/73 skipped.
Failure: `wizard-all-story-readiness-cli.spec.ts:109`, narration preflight expected2,
actual3, not a timeout. Previously documented Panda publication already raised this
count; no baseline execution is claimed here and this unrelated test is unchanged.
Focused and full runs briefly overlapped; no machine-reliability conclusion follows.
Resource22 files:1 failed/21 passed, tests1 failed/670 passed. Failure is the
acceptance-lifecycle package-qualification isolation test timing out at5000ms
(observed5829ms). No baseline run or claim that either failure is inherited.
Final runner diagnostic JSON retained in full-check-summary.json; full stdout/stderr
archive not retained. Overall:2 failed,6394 passed,73 skipped across411files.

Original outputs are ignored/untracked, local-only without verified off-machine
backup. The new tracked candidate fixture is a semantic copy only, not preservation
of original logs, file bytes or receipt archive. No scope/authority is broadened.
Presence supports additive corrections only. It does not decide ambiguous prose,
arbitrate contradictory story/visual content, repair absence, or create companions.
Supporting cast, moments5/8/12, cover, staging7/10, telescope custody and capacity
remain HELD. No stability closure, full-book/QA-accuracy/product/launch claim.

## Falsification targets

1. Forge/reformat/swizzle accepted bytes, page inventory or identity while keeping
   caller hashes internally consistent. Does current consumer reject against disk?
2. Downgrade version, duplicate operation, inject/remove cast, stale before state.
   Does it reject atomically, without source/candidate/output mutation?
3. Permute presence and presentation operations. Is cast visible consistently and
   final fact authority still strict? Can unknown presence become present?
4. Rehash effective suppression in the review packet. Can any approval/bridge path
   evade real reconstruction? Test old v1 packet b7fdd4e5 remains identical.
5. Confirm actual Panda remedy changes exactly two fields, not other semantic holds.

## PowerShell inspection / optional push

No stage/commit commands needed: Codex creates the focused local commit.
Push is a separate owner-authorized action, not performed or implied by this brief.
```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log -1 --format=fuller
git diff --stat 3fb03452398b8724df2785ecc715114cc9d90b4b HEAD
git diff --check 3fb03452398b8724df2785ecc715114cc9d90b4b HEAD
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/companion-presence/verify.cjs
if ($LASTEXITCODE -ne 0) { throw 'Presence witness failed' }
# Only after explicit push instruction:
# git push origin codex/r3b1b-semantic-recovery-m1
```
