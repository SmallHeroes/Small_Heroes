# Claude Code: fresh Panda visual preparation, read-only first pass

Requirement: a lively, coherent complete book through existing general systems,
with restrained spend. Prepare fresh source-bound illustrations rather than
reusing old directions or repeatedly paying to discover predictable conflicts.

Worktree C:/GNart/Work/sh-r3b1b-semantic-m1, branch
codex/r3b1b-semantic-recovery-m1. Base95a8d7b15f4f59abed6f3ebc33c72cfb40b64263.
Review head is the direct child commit named
docs(stories): prepare source-bound Panda visual directions. Resolve and freeze
its hash with the commands below, then review ONLY that base-to-head range.
If parent/subject differ, reconcile instead of silently widening the review.
Codex is sole writer. Protected d53b768ccb2f and wave2 63ccb484 remain read-only.

Files: CURRENT.md and this directory only. New creative-brief.json,
visual-directions.json, continuity-intent.json, source-grounding.json,
DESIGN_LOCKS.md, DECISION.md, verify.cjs, verification.json and this handoff.
No production module, manuscript, approval, intake, accepted source or locator edit.

## Claims and evidence

The directions are authoring data in the actual existing record/v1 schema,
not a new renderer. Shared brief, direction, continuity, protected-authority and
composition validators run on the actual data. Shared injectDirections runs in
memory; both source byte round-trip and actual parseStoryMarkdown prose equality
hold. Twelve nonempty quotes are verified against their respective source pages.
Five wide frames, two close-focus, six shots, four angles, zero repeated adjacent
pairs, maximum same-shot run one. Each assembled direction is634..744 characters,
under the actual integration ceiling1600. These are metadata, not image metrics.

The real predecessor inspector verifies old accepted authority. New proposed
source and Editor review match pinned5bed647c/79271dfb. No old approval is applied
to new text. No publication request with acceptedBy, decision or date is created.

Verification: offline verify.cjs exit0,10 negative controls; existing enrichment
spec8/8; npx tsc --noEmit exit0; prepare-intake --check18/216 unchanged. Full check
not rerun; prior6364pass/73skip is historical code evidence, not a new QA verdict.
The verifier first compared an inspector return without storyKey to a stored row
with storyKey; the assertion was corrected to add the already bound key. No
underlying evidence or production validator changed to satisfy it.

## Falsification targets

1. Read the Hebrew source and challenge each selected moment, roles and geography.
   Verify a single frame does not accidentally demand multiple copies of a body.
2. Follow wheel attachment, parked rover, telescope custody and rug transitions.
   Labels ending inferred are assumptions, not claimed quotes. Excerpt presence
   alone does not prove all English instructions follow from it.
3. Confirm child name/gender/wardrobe and companion identity are not overridden.
   No pause ritual or extra accessory is invented; actual anchors remain pending.
4. Re-run shared validators; perturb a page, source hash, quote and direction.
   Do not mistake the local verifier for a hardened adversarial trust boundary.
5. Verify no production consumer selects this packet and no source was published.
   Neither design notes nor state labels are claimed to be runtime-enforced.
6. Verify no images/audio/provider calls occurred. Existing cumulative text-review
   estimates remainUSD0.367503 / conservativeUSD0.83016, not invoice verified.

## Limits

No visual accuracy, human-like QA, scale measurement, independent PASS, Guy
acceptance, runtime readiness or full-book completion. Pending new original-source
lifecycle code has its separate handoff/range4fd7eda0..95a8d7b1. Nothing in this
data review extends earlier code PASS. Reader, anatomy and continuity findings
remain open until actual consumer/pixel evidence closes them. No new spend.

## Reproduction / optional propagation

```powershell
Set-Location 'C:/GNart/Work/sh-r3b1b-semantic-m1'
git status --short --branch
git log -1 --format='%H %P %s'
git diff --stat 95a8d7b15f4f59abed6f3ebc33c72cfb40b64263 HEAD
git diff --check 95a8d7b15f4f59abed6f3ebc33c72cfb40b64263 HEAD
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/visual-preparation/verify.cjs
npx vitest run lib/__tests__/story-source-visual-direction-enrichment-lifecycle.spec.ts
npx tsc --noEmit
node story-pipeline/06_editorial_refresh/2026-09-16/prepare-intake.cjs --check
# Only if Guy separately asks to push. This carries ALL ahead commits, not just this range:
# git push origin codex/r3b1b-semantic-recovery-m1
```
