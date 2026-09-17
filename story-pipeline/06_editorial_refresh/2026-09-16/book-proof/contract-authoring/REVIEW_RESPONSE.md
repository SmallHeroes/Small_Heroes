# Paid Panda contract: review reconciliation and page-6 witness

## Decision and scope

Continue the authorized diagnostic/correction workflow in the same task and
worktree C:/GNart/Work/sh-r3b1b-semantic-m1, branch
codex/r3b1b-semantic-recovery-m1. Base e9a859d310eb59e645a55d6115f688b87accb434,
clean ahead2/behind0 at start, Codex sole writer. Protected dependencies remain
768ccb2f and63ccb484, read-only. This is a bounded evidence correction, not an
engine change, story-specific runtime workaround, or creative rewrite. Cost$0.

Expected outcome: retain genuine evidence PASS, verify the new companion finding,
and distinguish raw typed actions from generated prose before choosing a repair.
Files: CURRENT.md, this response, review-attribution.cjs and its generated JSON.
Validate the immutable run, exercise three negative controls and tsc; preserve all
historical verdicts/observations, paid artifacts and accepted source. Rollback is
reverting this evidence-only commit, never deleting or rewriting paid evidence.
No new product decision, Cowork review or pixel check is needed for this diagnosis.
No provider/key access, render, narrative edit, production policy change, approval
fabrication or push. Runtime fixes belong to a separate tested milestone.

## Genuine review received

Guy supplied Claude's report in attachment
11550ac4-0cde-4f42-b183-26e93222bce6/pasted-text.txt. Claude issued evidence PASS for
508f49b4..e9a859d3 and agreed with the semantic HOLD; the report did not assign a
fresh numeric P0/P1/P2 verdict. It independently reproduced196/196, tsc0, receipt
costs0.437444 nominal /0.481196 conservative, exact offline replay and preservation.
Those observations remain attributed to Claude, not claimed as rerun tests here.
No prior PASS extends to this response or to semantic/product acceptance.

## Accepted new finding: companion missing on page6

The accepted direction explicitly says "the companion waits nearby" and
"companion present". Actual page6 has castIds=["child:hero"] and
characterPresence.companion=false. All other pages include the companion.
The story-text-only extractor returns present pages1,2,3,4,5,7,8,9,10,11,12.
Its companion loop reads page.text, not the separately accepted page direction.
The supporting-cast assembly spreads those facts without changing that vector.
An empty, source-bound in-memory control review reproduces the same vector; it
is not a proposed cast review or an assertion that there are no supporting humans.

This is separate from missing supporting cast. Simply filling humanCast will
not solve it. The current correction operation schema also has no explicit
companion-presence operation. Do not bypass that absence with an unbound castIds
edit or by pretending the approved story text mentions Anat on page6.

## Attribution corrections requested from Claude

### CAST: omission and normalization are different

The captured draft's humanCast ids are exactly ["child"]. Compiled humanCast is
empty; the primary child survives correctly as cast.child.id="child:hero".
This discarded child row is not an Adam/teacher row. None of Adam, station_driver,
ticket_child, teacher or station_friends existed in the raw humanCast to be deleted.
The fifth is an ensemble, not a fifth individually identified human.

Our earlier "all12 cast lists omit supporting identities" means exactly that,
not empty lists: lengths are [2,2,2,2,2,1,2,2,2,2,2,2]. The legacy extractor's
empty supporting-human authority and the absent source-bound review remain the
system gap. Do not preserve arbitrary model humanCast entries as the repair;
that would defeat the current anti-fabrication boundary.

### MOMENT: raw typed actions already contain the conflicting requirements

Claude correctly measured mustShow growth5->13,5->10,5->14. But those arrays are
not the entire raw draft. Decoded responseJson.pageContracts[].actionRequirements
already contains the same ordered predicates/polarities as the compiled template:

| Page | Raw typed must actions, before compilation |
| --- | --- |
| 5 | turns, turns, looks_at, peeks_at |
| 8 | reaches_toward, holds, pushes |
| 12 | walks, pushes, places |

The compiler adds readable action prose and prop-presence prose to mustShow; it
does not invent these typed actions. The model's raw mustShow can be static while
its typed actions contradict the selected moment. Thus our prior statement that
the captured draft requests these actions is supported. A projection-only deletion
would leave conflicting structured requirements available to other consumers.
Fix the effective action/coverage selection first, then re-project consistently.
This does NOT prove a prompt-only fix is sufficient or that the compiler needs no
additional validation. It locates the observed defect without choosing that leap.

COVER attribution is accepted unchanged: before-firstRevealPage prohibitions are
added by deterministic cover projection. STAGING7 already exists in the raw draft;
custody and10 remain open. Page9 wheel possession is only partial progress.

## Reproduction and limitations

review-attribution.cjs decodes the real captured draft, asserts the predicate lists,
confirms draft/compiled cast identities and6's presence conflict, then recomputes
all6 paid artifact raw hashes against the prior verification manifest. It creates
no network/client and blocks fetch. Normal runs write nothing; --record was used
once to produce review-attribution.json with exclusive-create semantics.

Three in-memory negative controls must fail the witness: remove an original raw
action on8, remove one on12, or restore companion presence on6. No disk artifacts
are edited by these controls. Witness exit0 means observations reproduced, NOT
that the contract passes. This is not a general semantic judge or a runtime fix.
The original HANDOFF, semantic-observations, request, receipt, candidate, replay,
source, approvals and logs remain unchanged. Previous local-only storage disclosure
still applies. New evidence is tracked here; no third unlisted output root was made.

## Next implementation, ordered by dependencies

Validation in this response milestone: attribution witness exit0 with3 negative
controls; prior integrity/cost/offline-replay verifier exit0; historical semantic
witness exit0; npx tsc --noEmit nativeExit0. The196 tests were NOT rerun here.
No full check. Protected worktrees remain clean at their recorded HEADs. Git diff
confirms zero changes in lib/, scripts/, app/, accepted sources and original handoff,
semantic-observations.json or verification.json. All additions are new evidence.

1. Add source-bound, explicitly reviewed companion-presence authority for accepted
   visual directions through the correction/consumer chain. Fail closed on stale
   source, unsupported identity, page mismatch and unreviewed directions. Preserve
   legacy behavior without authority; never a Panda/page6 special case.
2. Prepare four individuals plus the recurring ensemble from exact source evidence,
   with membership avoiding duplicate station children. Use the existing supporting
   cast mechanism, not free-form model additions to protected cast authority.
3. Correct selected moments and typed coverage together, then project prose. Preserve
   action evidence for unpictured narrative beats instead of drawing multiple moments.
   Bind single prop custody and correct7/10 staging; explicitly resolve cover visibility.
4. Verify effective-artifact consumers, obtain independent QA of that correction,
   and proceed to Blueprint/references/sample only from coherent effective authority.

No new live authoring attempt is justified by this review. No render yet.

## Read-only re-gate brief and PowerShell

Review base e9a859d3 to the commit containing this response (git log -1 -- this file).
Try to disprove the raw-action claims by reading actionRequirements, not mustShow
alone. Verify child normalization vs missing supporting identities, the independent
companion finding, three negative controls, and zero mutation of previous evidence.
Scope is evidence correction only; no repair completion, independent self-PASS,
full-check/stability, render readiness or product acceptance is claimed.

```powershell
Set-Location 'C:/GNart/Work/sh-r3b1b-semantic-m1'
git status --short --branch
git log -2 --oneline
git diff --stat e9a859d3 HEAD
git diff --check e9a859d3 HEAD
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/contract-authoring/review-attribution.cjs
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/contract-authoring/verify.cjs
npx tsc --noEmit
# Commit is already created at delivery. Only after Guy authorizes push:
git push origin codex/r3b1b-semantic-recovery-m1
```
