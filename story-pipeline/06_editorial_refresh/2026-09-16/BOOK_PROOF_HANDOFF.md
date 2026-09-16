# General review-only Editor entry and first real review

Goal: good story plus a good complete system presentation, prudent spending,
general solutions. Not complete. Base bfbf54731b030afbb5d769212b48c07dff651da2;
endpoint is the first commit adding this file. Same task/sole writer/worktree
C:/GNart/Work/sh-r3b1b-semantic-m1, branch codex/r3b1b-semantic-recovery-m1.
Start clean ahead51; protected d53b768ccb2f / wave2 63ccb484 unchanged.
Guy authorized ongoing work and existing-key reuse. BOOK_PROOF_DECISION caps
this milestone at one text review, USD1.50 admission budget, zero image/audio calls.

## Claims to independently falsify

New scripts/review-story-candidate.cjs is a general review-only entry for existing
canonical neutral-gender prose. No new writing wave, story-specific branching or
QA relaxation. Uses shared parser/resolver, editorial contract/schema/validator,
companion psychology and existing gpt-5.6-sol provider. Its default is a read-only
preflight. --live requires an explicit bounded budget and existing credentials.
API body store:false; provider uses official Responses origin and no retry loop.
No secrets are printed or written to artifacts. No provider key was created.

Input SHA checked before review. Request includes exact story and two real
boy/girl text projections. Claim-first existing previewCheckpoint preserves paid
results BEFORE validation. Unknown outcomes hold, incomplete/malformed outcomes
persist and never rebill on resume. Exclusive lock, immutable input identity,
source snapshot, request, result, review and cost report. No automatic rewrite or
pass coercion; valid pass/revise/reject all persist. No publication authority.

Preflight source02d337de762d2be2e920289027051f2231cb58490ecf6271a069c9681fc3cc63,
request290e13a6b5ab6457935d032e192c1020623ddf6963bbcecbe00d4b2fcdbadc1e.
One real call completed: model gpt-5.6-sol/default; review verdict REVISE,
single major category_energy_mismatch: strong social story but stationary
adventure. Original source/approval/intake manifest remain unchanged.

Paid evidence: outputs/panda-approved-editor-20260916 (ignored, machine-local,
off-machine backup unverified). Exact copies of request, provider result, review
and report are tracked under book-proof/editorial, no push performed. Source
already tracked at intake/panda_anat_adventure.md. No invented Editor/Claude PASS.
Usage5853input/3993output (3470reasoning;5850cacheWrite reported by shared provider).
Configured-rate estimate0.1563675USD, accounted upper0.29538, reservation0.96051,
budget1.50; invoiceVerified:false. No claim these estimates are a provider bill.
Real replay with a provider that always throws proved providerCalls0 and identical
report. It reuses the persisted result, not a new provider request.

## Tests and evidence

- New review spec16/16: source/companion drift, unresolved token, fixed hero,
  budget-before-effects,3 verdicts,4 paid malformed/incomplete/identity cases,
  unknown-outcome hold, replay, changed-input collision, CLI default/traversal.
- Adjacent creative-replacement lifecycle27/27: total43/43 focused, exit0.
- Initial tsc found our test's ES-target-incompatible replaceAll; corrected with
  split/join before the live call. Subsequent full check passed both typechecks.
- npm run check FINAL exit1: ordinary5667pass/2fail/73skip; resource671/671pass.
  New spec passes in full run. Failures: classifier expects393 specs, now410;
  model scanner truncates anthropic/claude-4.5-sonnet to claude-4. Read-only code
  inspection identifies mechanisms, NOT a baseline run or stability closure.
- Actual wizard audit:18 slots,2 renderQualified/narrationPreflight (existing Dini
  adventure/Kim bedtime sources). Panda still v3 fallback/source_text_not_ready.
- Canonical intake --check18/216 unchanged; no approved manuscript edited.

## Separate proposed revision

book-proof/panda_anat_adventure_revision01.md addresses the diagnosed static
journey with a walking cardboard rover, distinct play-space traversal, turn-sharing
as navigation setup, and return invitation. It is NOT Guy-approved or Editor-passed;
original approved content remains. No second paid review. New source01712a5c...
passes real editorial structural preflight and8 names/genders through actual shared
personalization gate;12 pages and no authored dash punctuation. Review this change
as proposed prose only. It must not borrow the parent's acceptance or visual assets.

No render, narration, production-source/locator change, deploy or push. Prior
independent PASS ends bfbf5473; this work has no independent technical self-PASS.
Questions for QA: can malformed evidence rebill, can input drift reuse a root,
can non-live mode touch credentials/provider/output, can a verdict grant authority,
do tracked copies really match the paid records, and is the live request bound to
the approved manuscript rather than the later proposal? Please review read-only.

```powershell
Set-Location C:/GNart/Work/sh-r3b1b-semantic-m1
$bookBase = 'bfbf54731b030afbb5d769212b48c07dff651da2'
$bookHead = git log --diff-filter=A --format=%H -- story-pipeline/06_editorial_refresh/2026-09-16/BOOK_PROOF_HANDOFF.md | Select-Object -First 1
if ((git rev-parse "$bookHead^") -ne $bookBase) { throw 'Review range mismatch' }
git status --short --branch
git diff --stat "$bookBase..$bookHead"
git diff --check "$bookBase..$bookHead"
npx --no-install vitest run lib/__tests__/story-candidate-review.spec.ts lib/__tests__/story-source-creative-replacement-lifecycle.spec.ts
npx --no-install tsc --noEmit
node story-pipeline/06_editorial_refresh/2026-09-16/prepare-intake.cjs --check
# No --live in QA. Only on Guy's explicit push request, all outstanding history:
# git push origin codex/r3b1b-semantic-recovery-m1
```
