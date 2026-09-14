# Correction-acceptance fixture isolation — Decision Gate

## Proposed change and why now
Repair the one deterministic full-check assertion at
story-source-visual-direction-correction-acceptance-lifecycle.spec.ts:703.
The test intends to compare a catalog before and after publishing Dini's accepted
visual-direction correction into an isolated accepted-root copy. Since real text
revision f77f4ca5 was added, buildFixture copies both Dini revisions but removes
only historical target64dcd0e7. The unrelated text-only successor therefore
remains in the baseline and changes narration/TTS readiness before the fixture's
publication. Expected exact deltas no longer describe the intended starting state.

## Scope and root-cause proof
Test-fixture-only correction plus canonical status/docs. No production module,
story, source authority, acceptance, runtime selector, narration rule or expected
delta is changed. Candidate fix removes the copied Dini story root from the
fixture before publishing the fixture's own Dini revision. This preserves every
other accepted story and re-establishes the scenario: no Dini accepted lineage at
baseline, exactly one fixture-published Dini accepted source afterward.

Observed before fix: exact isolated test fails deterministically, expected
narration/critical17 vs actual18 and soft review items8 vs10/stories4 vs5. The
differences are exactly one story. Repository inspection shows copied Dini roots
64dcd0e7 and f77f4ca5; fixture deletes only64dcd0e7. The accepted-lineage scanner
counts any valid product-acceptance in the story revisions tree, while strict
authoring inventory considers integrated.md revisions. This mixed baseline is
the contributing state. Prove the fix by changing only fixture construction and
rerunning exact test, entire spec, adjacent readiness specs and full check.

## Topology, risk, rollback and acceptance
Same task sole writer: C:/GNart/Work/sh-r3b1b-semantic-m1,
codex/r3b1b-semantic-recovery-m1; start aa2e0711510cd4a384793ad92c168ce33d76a429,
clean/ahead13. Protected dependencies d53b768ccb2f and accepted-intent-wave-2
63ccb484 remain clean/read-only. Zero provider/render/credential/spend allowance.

Risk is hiding a legitimate interaction by over-isolating. Guard against it by
keeping the exact catalog summary assertions and existing checks that all other
story facts and canonical accepted bytes remain identical. Do not merely update
expected counts. Run full npm check and report actual result. Rollback is a focused
commit revert; no artifact migration. No push. Claude should falsify that the
fixture still tests injected-root isolation and that publication of future Dini
revisions cannot silently change its baseline. Product/creative review is not
needed; Guy has already approved continuing this technical correction.

## Stop-check and exclusions
General test reliability fix, not a Dini-only production patch. It changes no
customer behavior, story, character, prompt, image logic, reader, QA threshold,
fallback, payment or release authority. No image to eyeball. Exact expectations
remain strict. Existing accepted revision,13 reader images, old package, P2 PASS,
reader-route/cake-cart/page7/stability boundaries remain unchanged.

## Execution result

The initial candidate removal of the full Dini story root reproduced a distinct
accepted-target-invalid failure, proving the acceptance publisher requires the
story/revisions skeleton. Final change recreates that skeleton empty. The exact
:703 test then passed1/1 with10 skipped, unchanged assertions. Whole spec11/11;
adjacent wizard readiness, CLI, accepted-authority and resolver total57/57.
npx tsc --noEmit exit0. Diff changes one existing test file plus docs only.

Full npm run check exit1. Ordinary:352 files pass,2 fail,17skip;5322 tests pass,
2 fail,87skip. One30s beforeAll hook timeout in story-source-visual-direction-
review-batch.spec and two5s tests in semantic-correction-approval-bridge.spec.
Resource phase22/22 files,671/671 tests passed. Corrected :703 test passed in the
full run. Total across phases5993 tests pass,2 fail,87skip plus the failed hook.
Both affected unchanged files rerun in isolation: review batch14/14 in32.87s;
semantic bridge131/131 in98.83s, including prior timed tests at3.595s and3.018s.
No timeout/scheduler edit, failure waiver, inherited label or stability closure.

Full logs under ignored/local-only execution-01:
fixture-isolation-full-check.stdout.log SHA256
3384531aeac974c0867bf7b1346613a885cf0614936ca46c7354b07962349e73;
stderr SHA256 44edd1aaef768584542b15be92266abe43477eef762241fa3e9846c1cd7bd178.
No verified off-machine backup; pushing Git will not preserve these logs.
