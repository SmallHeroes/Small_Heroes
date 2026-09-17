# Claude Code: approved Panda source and pending page-direction candidate

## Status after independent review

Claude supplied PASS0/0/2 for87282474..949a360d and a later full green observation
(6364pass/73skip,exit0). Corrections are in REGATE_HANDOFF.md. The original review
scope below remains historical. No complete render plan or visual quality PASS
is implied by the term candidate: it contains page directions only.

## Immutable review boundary

Worktree `C:/GNart/Work/sh-r3b1b-semantic-m1`, branch
`codex/r3b1b-semantic-recovery-m1`. Base is
`872824744655bee8c3ae1e967687dedc8c16dd8c`. Review its single direct child
whose subject is `feat(story): publish owner-accepted Panda text and visual candidate`.
Resolve that child to a full SHA before reviewing; reconcile any different HEAD.
This same Codex task is the sole writer. Claude's first pass is read-only.
No push is included. Start was clean/ahead57. Protected worktrees remain read-only:
d53b at768ccb2fe20edb1351cb4783796613cbf7a2993c and wave2 at63ccb4846ebe5be9ab392960d389610a1b2b9d42.

Existing independent code PASS is4fd7eda0..95a8d7b1, with evidence-only P2
independently closed over ea3850d7..87282474. Neither constitutes review of the
visual preparation in ea3850d7 or this publication. Do not self-extend either PASS.

## Requirement, authority and implementation

Guy answered "כן מאשר" to the exact revised Panda manuscript. Publish that
text through the reviewed lifecycle, preserve originals, and continue the book
pipeline without wasting render money. DECISION.md scopes implementation and
the observed, necessary test-inventory adjustments. No production code changed.

Actual existing CLIs ran dry, write, reload and identical replay. Text publication
created seven immutable files. Enrichment created five pending candidate files.
Both exact replays were reported as created:false, but their results were not
retained in the original tracked receipts. Fresh later CLI captures are now saved
as publication-replay-receipt.json and enrichment-replay-receipt.json, with
replay-preservation.json. They do not reconstruct the earlier unretained runs.
No acceptance was synthesized for
the visual candidate. No source locator, contract, Blueprint, board, package,
image, audio, reader, credential or provider operation was performed.

The authority timestamp is Codex's observed receipt time for this user decision,
not an independently measured chat-send time. The earlier corpus acceptance
is not reused for rewritten prose. Genuine Editor PASS remains byte-identical.

Identities:

- Accepted story SHA:5bed647c29ca61b6fe75ccd39b3e73fb6be5ea2d775f4add220026dc20714b0e.
- Editor SHA:79271dfb6b000e066b5bbb26eace873705bf88760aa34a62a8aab304e64536d1.
- Published revision:9ea583e13fa979e1105a60f52721f550f518e5eed01295983f2f02e2c7aaf3cb.
- Pending visual candidate:50103b10c6d72866987aa6fbe0a2c5bc4397d14eff5f64f2d3e4433fa6b82a16.
- Candidate manifest digest:82cd0dc2460ed32f25243ffca30164655c27b674f5d548945e9988b85ac82bcf.

See publication-receipt.json, enrichment-receipt.json and verification.json for
full bindings, paths, byte sizes and SHA256 values, not abbreviated identities.

The direction schema contains version,storyKey,pages, not recurringProps or
visualLanguage. It is NOT the draft-render plan schema used in prior auditions.
Canonical recurring-object design and shared style still require downstream
authority, alongside contract/Blueprint/package and bound visual references.
Per-page prose and composition checks do not supply those missing layers.

## Observable runtime consequence

Publishing accepted text with no accepted directions intentionally blocks the
old V3 fallback for this slot. Current Panda source is null, not the new text and
not the old visual plan. runtimeEligibility stays false at both new boundaries.
With ENABLE_V3_APPROVED_BANK=true, sellable count is now17, not18; render-qualified
count remains2. With V3 disabled the existing sellable count remains2.
This is local repository behavior, not a deployment or customer-ready book.

Five changed specs make the current inventory explicit: Wizard readiness, actual
audit CLI, package lifecycle, matrix helpers and Wizard matrix API. They require Panda held
and unavailable, do not silently skip missing sources, still exercise432 text
projections (408 selected +24 held), and keep all16 unqualified nominal slots
blocked. The older sellable-only strict scope blocks15, also returning failure.
No timeout, exclusion, threshold, gate implementation or production file changed.

## Storage and reproducibility

Original execution roots are ignored/untracked local files:

- outputs/panda-approved-source-20260917/ (five inputs, two requests and test logs).
- outputs/panda-visual-enrichment-20260917/50103b10c6d72866987aa6fbe0a2c5bc4397d14eff5f64f2d3e4433fa6b82a16/.

They do not accompany a clone/push; no off-machine backup was verified. All seven
authoritative source files are committed under the accepted revisions subtree.
Both requests, receipts, exact five candidate copies and verifier output are
preserved in this tracked evidence directory. Logs are local only unless a
specific summary/copy is identified. Reconstructing inputs cannot reproduce
historical execution timestamps or unretained console logs.

On this machine verify.cjs reads the original roots. On a fresh clone first
rehydrate in a separate disposable checkout: copy story.md/editorial-review.json/
creative-brief.json from the accepted revision into the first root; copy
visual-directions.json/continuity-intent.json from sibling visual-preparation;
copy both tracked requests there; copy visual-candidate's five files into the
second exact digest root. Compare every bound hash before running the verifier.
These are byte copies, not a new publication or a paid regeneration.

## Validation and falsification

Exact test outcomes and failed attempts are recorded in VALIDATION.md. The original
Codex full check was NON-GREEN:6360pass/4fail/73skip. Three timeouts remained unresolved
at full-suite scope; one inventory assertion was fixed after that run. Subsequent
isolated/serial results do not retroactively turn this full result green.
Final six-spec serial run passed74/74; the specifically timed-out bridge test
passed1/1 in isolation (130 filtered). tsc0. No independent stability closure.
The read-only verifier reloads both genuine lifecycle outputs, recomputes all
seven/five files, verifies18 original source records against retained inspection,
proves12 directed pages and exact prose preservation, then exercises real
readiness and requires the hold. Intake --check remains18 stories/216 pages.

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log -1 --format=fuller
git diff --check 872824744655bee8c3ae1e967687dedc8c16dd8c HEAD
git diff --stat 872824744655bee8c3ae1e967687dedc8c16dd8c HEAD
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/source-publication/verify.cjs
node story-pipeline/06_editorial_refresh/2026-09-16/prepare-intake.cjs --check
npx tsc --noEmit
```

Attack exact-content acceptance vs visual authority; original evidence preservation;
actual created:false replay; source/candidate hashes; fresh-clone reproducibility;
the held slot and every changed inventory assertion. Confirm no fallback restores
old visuals. Review the previously unreviewed visual data in ea3850d7 separately:
its source fidelity, object/occupant separation and composition claims are not
established by syntax validation. Reject any claim that numeric framing, anatomy,
visual consistency, narration sound or final book quality has been proven here.

Cost this milestone:$0. No new provider calls, no new audio/images. Previously
paid Editor cost is unchanged; this is not a new whole-book cost estimate.
Next: exact visual review/acceptance, contract/Blueprint/package and bound
references, then a bounded LOW sample through the system. Full book remains open.

## Optional push, only on Guy's explicit instruction

The local commit is already made at handoff. These commands inspect then push;
the push carries ALL local branch commits, not only this reviewed milestone.

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log --oneline origin/codex/r3b1b-semantic-recovery-m1..HEAD
git push origin codex/r3b1b-semantic-recovery-m1
```
