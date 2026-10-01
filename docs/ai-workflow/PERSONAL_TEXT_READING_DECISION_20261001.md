# Decision: edited personal story, no visual planning

Guy explicitly requests proceeding until recording and reviewed facts can become
a whole personalized story to read and judge, without rendering. Continue in this
chat on `codex/personal-book-storyboard-bridge`, sole writer Codex, base `b2552fc4`.
Claude site work remains separate; no merge, deployment or push implied.

Observed: wizard calls the existing five-stage `/book` runner. It makes no image
or audio calls, but unnecessarily reserves and waits for text storyboard/review
when the desired experiment is only story quality. The writer-only route would
omit editing. Reuse the existing book runner with an explicit `story_only` scope;
default `storyboard` remains backward compatible. Same auth/local host/origin,
request identity, operator flags, reservation and ledger. Three stages maximum:
plan, manuscript, editor. Return a distinct diagnostic text result after editing,
never counterfeit storyboard success or render packets.

Separate observed general defect: the real paid planner returned ending evidence
[2,5,6] for eight spreads. Server requires the final spread; provider schema does
not. Constrain provider ending evidence to the actual final spread for all three
lengths, keep all semantic validation/HOLD rules, never alter recorded outputs or
repair a model claim silently. A final anchor is not proof of an earned ending.

Files: book-config/runner/route/preview, StoryPreview, story-openai and adjacent
tests. No new customer pipeline, writer replacement, child/companion override,
catalog mutation, public recording release, image/audio provider or QA threshold.
Forward subordinate writer cancellation while touching the runner; retain
terminal unknown usage instead of allowing a late response to modify rows.
Advisory read-only review found additional boundary gaps: recheck the call cap
at actual invocation, revalidate all failure-observer outcomes before returning
partial prose, and mark text success done only after final observer checks.
General corrections cover both scopes without changing normal stage order.

Acceptance: three calls at every length; no visual call/packet; correct reservation
and browser quote for this scope; unchanged five-stage default; typed planning
HOLD/editorial HOLD, cancellation/source edits/no retry; whole edited manuscript
visible mobile/desktop, no model-approved claim; provider ending schema binds
8/12/16 and rejects the recorded faulty shape without changing those bytes.
Tests use mocked SDK and real route/runner, then local browser. tsc and focused
checks; record full-check limitations. Independent Claude QA still required.

Implementation/verification costs $0. Existing stopped comparison remains closed;
no fresh automatic paid experiment authorized by this technical change. A user
initiated local operator attempt is separately quoted and consumes its existing
pilot ledger. Enable at most one intake ($0.10) and one edited story ($1) for the
existing operator on 127.0.0.1:3443, gpt-6.1-sol medium. This is a smaller manual
activation within Guy's existing key/pilot authorization, not a fresh automatic
comparison. The $1 story budget rejects the retained five-stage mode before key
access. A fresh atomic common-Git pilot claim prevents launcher restart/refill;
process-memory ledgers remain unsuitable for public/multi-instance use. Do not
delete consumed claims or restart to refill them. No automatic provider call on
launch; Guy initiates recording/processing and writing explicitly. No claims of
perfect stories, clinical effectiveness or release.
No unresolved product choice: text-only is Guy's decision; default-off local pilot
is the reversible boundary. Guy should read the resulting story, not the code.
Rollback: revert only this milestone; never delete consumed claims or paid roots.
Stop-check: general change, all companions/lengths covered; production public
flow unaffected; no anchor/model/threshold change; no extra paid verification.
