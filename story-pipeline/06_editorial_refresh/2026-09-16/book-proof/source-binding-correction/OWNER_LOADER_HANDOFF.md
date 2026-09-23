# Owner-loader invariant follow-up — 2026-09-23

Read-only Claude re-gate. Base254404b6709a5a602527dcd047d2e9b7070a99db;
single successor commit, codex/r3b1b-semantic-recovery-m1 in
C:/GNart/Work/sh-r3b1b-semantic-m1. Codex sole writer in the same task;
start clean/ahead14/behind0. Protected d53b768ccb2f and wave-2 63ccb484 remain
clean/read-only. No push, key access, paid call or render. Cost$0.

## Finding, scope and fix

Claude PASS0/0/2 on9d0bbe1d..254404b6 closed detached-text source binding. New P2:
owner loader derived page count/texts directly before an optional sequence check;
legacy/atlas had no provenance check. Verified raw read+parse already supplied
correct data, so no current exploit under the stated non-hostile-process model.
Expected invariant nevertheless should match the automatic compiler.

Only runtime change: scripts/run-owner-book-draft.ts imports previewStoryEvidence,
calls it immediately after previewStory, and supplies its texts to BOTH plan page
count and continuity validation, before optional sequence handling. Source and plan
raw-byte reads still precede parsing; this is validation ordering, not a claim
that no file is read before provenance. Existing conditional sequence check stays.
No helper API, parser, serialized output, prompt, model, threshold, timeout, budget,
story or image changed. No migration needed. Rollback this one follow-up commit.

Nine new cases in lib/owner-book-draft.spec.ts: three valid modes assert invocation
order and exact evidence-array identity at the continuity validator; six inject
mutated/cloned parser results and assert rejection BEFORE either validator, with
no generation/QA call or output creation. Injection is a regression probe, NOT a
claim of an exploitable current parser. Atlas uses a schema-valid minimal empty
prop inventory; existing real-entry five-page tests still cover populated atlas
and sequence dispatch with mocked providers. No existing assertion removed.

## Results and unchanged boundaries

- New cases9/9 (72 skipped in targeted run); full focused250/250 on first attempt:
  preview42, sequence32, planning51, owner81, quality28, judge16. Native exit0.
- npx tsc --noEmit0; npm run story:autonomous-typecheck0; diff --check0.
- Four existing witnesses exit0: source bypass baseline still reproduced/rejected;
  serialized old/new parser output equal;56 historical snapshots/3 reader hashes/
  2 images unchanged and new paid root absent; corpus18/216/432 INPUT ONLY;
  repair82 attributes and6 full/6 anatomy/1 none at schema maximum unchanged.
- Full check NOT rerun for this small guard reuse. Previous native1/6490passed/
  16timeouts/73skipped stays RED; no stability closure, waiver or root-cause claim.

The helper tests equality of the SERIALIZED REPRESENTATION, not all JS properties.
Undefined/function/symbol/non-enumerable metadata may be omitted by serialization;
it never supplies the private texts/hash. Do not upgrade this to an object-byte
identity claim. Source approval, semantic entailment of quotes and pixel quality
remain outside the check. All semantic/product/release holds remain; original
Claude-authoredf6bdf5f7..a2d30f89 still has no independent PASS from Claude.

Focused raw logs: outputs/owner-source-boundary-validation-20260923/:
stdout1802B SHA256 f1348c68fea3f5dee98ef30b6d19d730f5fa519b792c46ef6a97fd886b72f7db;
stderr0B SHA256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.
Logs and saved inputs remain ignored/local with no verified off-machine backup;
push does not preserve them. Earlier handoffs/logs are not overwritten.

## Falsification and inspection

Attack all three modes, particularly missing config.sequence. Prove both validators
run after provenance, consume its texts, and cannot precede rejection of a changed
or reconstructed parse. Verify valid data/return values and saved bytes unchanged.
Do not repeat the old helper review as if it closed stability or visual semantics.
First pass read-only; no keys/providers, edits or push. Freeze the actual successor
and reconcile if HEAD differs. This report does not self-award independent PASS.

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
$base = '254404b6709a5a602527dcd047d2e9b7070a99db'
$head = git rev-list --reverse "$base..codex/r3b1b-semantic-recovery-m1" | Select-Object -First 1
if (-not $head -or (git rev-parse "$head^1") -ne $base -or (git rev-parse HEAD) -ne $head) { throw 'review_topology_mismatch' }
git status --short --branch
git show --stat $head
git diff --check "$base..$head"
npx.cmd tsc --noEmit
npx.cmd vitest run lib/__tests__/local-book-planning.spec.ts lib/__tests__/local-book-sequence.spec.ts lib/owner-book-draft.spec.ts lib/__tests__/local-preview-quality.spec.ts lib/__tests__/local-preview-judge.spec.ts lib/__tests__/local-story-preview.spec.ts --silent
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/source-binding-correction/verify.cjs
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/sequence-recovery/verify.cjs
# Codex commits locally; no staging/commit reconstruction needed.
# Push only on Guy's explicit instruction, carrying ALL ahead commits:
# git push origin codex/r3b1b-semantic-recovery-m1
```
