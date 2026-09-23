# Paid sequence measurement: HOLD, not a completed pair — 2026-09-23

## Outcome first

Two bounded runs finished, both native2/sample_held. Only page1 was generated and
then edited once. Page2 never dispatched; pages3-5 remain incomplete. No same-scene
predecessor image was actually sent to generation because page1 never passed.
Do NOT claim measured sequence continuity or five finished pages from this run.

First run: one image, two completed QA calls, held_repair_limit for a multi-spoke
wheel instead of the specified three spokes. Other seven categories passed.
Follow-up: imports exactly that image as UNASSESSED, rejudges it, invokes the existing
one-repair loop, and rejudges the new image. One new image/four completed QA calls.
Props still fail (four or more divisions); judge additionally flags wheel scale.
Codex visual inspection agrees the explicit three-spoke correction was not achieved;
the scale verdict is retained as the judge's approximate assessment, not a measured
pixel ratio. Anatomy, identity, scene, environment, framing and safety passed.
These are automated diagnostics, not independent QA or product acceptance.

Original candidate4de520dd875e240d2793d1ee47032bf13304c604eb64e3f57e772183b08d6176
remains byte-identical in both roots. Repair90b103dc542cfa042ce361f0bb462a68525508f23dce38b7e91d99a7e02e7897
is a separate file. No pass override, threshold/model change, unbounded retry or
historical evidence mutation. Run locks removed normally. No new unknown paid call.

## Cost, including the inconvenient part

| Measurement | Known usage estimate USD | Conservative accounted USD |
| --- | ---: | ---: |
| First pair attempt | 0.120325 | 0.72273 |
| One-repair follow-up | 0.2196905 | 1.36683 |
| This turn: two image calls + six QA calls | 0.3400155 | 2.08956 |

Nominal estimates use the existing official-price snapshot dated19Sep2026 in
five-page-sample/PRICING.json; this is NOT a fresh pricing query or a verified
invoice. New image subtotal0.086873, QA0.2531425. Rejudging the imported candidate
costs two QA calls: safe current behavior, not free reuse of previous authority.
No raw key is printed or persisted. Only the explicitly authorized existing file
was used by the real CLI; all paid requests remain in its official-origin fence.

All four Panda measurement roots together: known usage estimate0.932674; old
unknown reservation1 retained separately. Conservative cumulative6.65329 remains
below9.50. The unknown reservation is already included in6.65329, not added twice.
Unused admission capacity is not a charge. Stop further paid attempts in this task
after this failed correction; no budget increase, refill, or rerun of either root.

## What the experiment establishes / does not establish

Source and references were not dropped. The recorded first request has three
canonical references; repair has those plus the failed image as reference4.
Source/plan/sequence, selected prop atlas, styles, framing and identities were unchanged.
The raw anatomy/contextual records agree with the effective reviews (including
the existing anatomy override rule). The wheel error survived an explicit bound
correction and the actual four-reference transport, so another text-only retry is
not justified by this evidence. It does not prove every image editor will fail.

The current owner repair is a full-image reference edit: ownerDraftRepairPrompt
asks for locality in prose, while makeImage/generateGPTImage supplies no spatial mask.
There is no pixel-level unchanged-region enforcement. Whole-book relation memory
and geometric object fidelity are different problems; this run reached the latter
before it could test the former. Correct page1 station geometry is not proof that
the previous page2 occupant-displacement defect has been fixed.

Recommended next engineering investigation, not implemented or declared proven:
general object-region repair with bound localization and before/after checks for
count/scale and unaffected content. Fail closed when localization is uncertain.
Separately review which art-design details deserve hard constraints; do not silently
relax the active gate or reclassify this wheel just to finish a book. Keep full-book
source entailment, scene-state QA and shot variety as independent requirements.
Potential later cost reduction: reuse completed QA only through an explicit binding
to candidate/context/model/instructions/transport and cumulative accounting, never
by copying a prior PASS across roots. Neither proposal changes today's authority.

## Artifacts, storage and preservation

Six new ignored roots, retained only locally; no verified off-machine backup:
- outputs/panda-sequence-pair-input-20260923: immutable config.
- outputs/panda-sequence-pair-sample-20260923: first image, request, receipts, raw QA,
  manifest, readout.json and standalone index.html.
- outputs/panda-sequence-pair-execution-20260923: invocation, before/after, separate
  stdout/stderr and execution.json with native status.
- outputs/panda-sequence-pair-repair-input-20260923: separate repair config.
- outputs/panda-sequence-pair-repair-sample-20260923: imported original, separate
  repair, both attempt reviews, receipts/manifest and standalone reader.
- outputs/panda-sequence-pair-repair-execution-20260923: same evidence categories.

First preservation110/110; follow-up137/137 exact SHA/bytes/mtime before/after.
Existing sequence witness still verifies56 historical files/3 reader hashes/2 old
images. Old proposed unexecuted root stays absent. Both protected dependency trees
remain clean at768ccb2f and63ccb484. Original paid candidate and approved source
were never promoted or edited. New readers are diagnostic views, not pointer cutovers.

## Independent QA handoff

Requirement: Guy requested story-wide identity/situation continuity and paid progress
toward five consecutive pages. The authorized smallest pair was the next measurement,
with one bounded recovery justified after a concrete wheel defect. Both gates were
recorded before their corresponding dispatch. No further owner approval was requested.

Worktree C:/GNart/Work/sh-r3b1b-semantic-m1, branch codex/r3b1b-semantic-recovery-m1.
Read-only first QA pass, no keys/providers/writes/push. Freeze HEAD before review.
Base56fbe397b3daebfbcdc06e580492fe4ae72187cc; review through the local commit containing
this file. Commits:10e11493 preflight/harness;32307df2 first hold/one-repair gate;
final readout/evidence closeout. No app/, scripts/, lib/ production files changed.
Only CURRENT, ROADMAP and evidence harness/readout/gates under sequence-recovery.
Claude PASS254404b6..56fbe397 remains range-bound; this is not independently passed.

Observed validation:155/155 focused (32 sequence+81 owner+42 preview), tsc0 before
each local commit; both native preflights0; repair prompt18918<24000; source-binding
witness0 and sequence witness0. read-pair.cjs verifies actual recorded prompt/ref
hashes/image checkpoint fingerprint, sequence/context binding, raw/effective reviews,
image identities and cost recomputation for both roots. It does not claim wire-byte
capture or independent semantic/visual certification. Full check was not rerun:
prior16timeouts/native1 remains RED, not release-ready. Claude-authored repair
rangef6bdf5f7..a2d30f89 remains without independent PASS and is not the owner repair
consumer used by these runs. Narration, publication, release and product acceptance
are outside this milestone. No push.

Falsification targets: verify exactly two new generated images and six completed
QA calls, no page2/repair2/unknown dispatch; recompute cumulative accounting rather
than only the latest root; verify imported image is rejudged, both raw holds kept,
and source/anchors/old evidence byte-unchanged. Inspect pixels and retained quote-
entailment limitation separately from the technical binding proofs. Attack the
new readout verifier without allowing it to manufacture a PASS.

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log --oneline 56fbe397b3daebfbcdc06e580492fe4ae72187cc..HEAD
git diff --check 56fbe397b3daebfbcdc06e580492fe4ae72187cc..HEAD
node story-pipeline/06_editorial_refresh/2026-09-16/book-proof/sequence-recovery/read-pair.cjs
node story-pipeline/06_editorial_refresh/2026-09-16/book-proof/sequence-recovery/read-pair.cjs --repair
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/sequence-recovery/verify.cjs
npx.cmd tsc --noEmit
# Inspect all ahead commits. Only after Guy explicitly requests push:
git log --oneline '@{upstream}..HEAD'
git push origin HEAD:refs/heads/codex/r3b1b-semantic-recovery-m1
```
