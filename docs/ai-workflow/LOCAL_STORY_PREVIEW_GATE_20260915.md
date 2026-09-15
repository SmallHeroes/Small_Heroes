# Local story-to-reader preview — approved implementation

## Proposed change / why now
Guy explicitly approved the simpler automatic creative-preview workflow, continuing
without repeated questions and using the existing key for renders. Today accepted
replacement prose is intentionally excluded from production until an integrated
source and reviewed visual package exist. That release boundary is not a useful
way to audition a new story. Add a separate, explicitly unaccepted LOCAL preview
CLI; do not forge production package or independent QA authority.

## Scope and topology
General source-to-preview orchestration, not a Dini/page-specific runtime patch.
Current sole-writer worktree C:/GNart/Work/sh-r3b1b-semantic-m1, branch
codex/r3b1b-semantic-recovery-m1, start fb339a744725056bfee6cbe753b361357925bb27,
clean/ahead16. Protected dependencies remain read-only at 768ccb2f / 63ccb484.
Continue in this task; no overlapping execution task. First input: accepted Dini
replacement f77f4ca5 and the existing canonical Bar/companion reference assets.

## Files and behavior
Add local preview core, CLI, focused tests and evidence. Reuse image transport and
the existing local reader manifest format. Plan the whole book automatically:
visual continuity, recurring props, location identity, child actions/expressions,
varied compositions, then LOW images. Preserve original source bytes. Checkpoints
bind input and reference hashes; completed steps are reused exactly. Interrupted
paid steps without persisted results are held rather than silently repeated.
All images remain unaccepted preview candidates, with missing/failed QA disclosed.

## Validation and acceptance
Offline mocked provider tests for source binding, plan validation, resume identity,
dispatch fences, cost accounting and manifest honesty; tsc; source/old-image hashes.
Run the explicitly approved full local LOW draft, inspect its actual images, open
it in the reader. No full-repository PASS claim; known stability failures remain.
Claude remains independent QA when available; Codex does not self-award its PASS.

## Cost / stops
Existing key only, never print/copy credentials into artifacts. At most one initial
planner call, one recurring-prop board and one image per cover/interior; no hidden
retries. Conservative dispatch reservations under USD10 for this first book;
usage costs are estimates, not invoices or a provider-enforced dollar ceiling.
Unknown paid outcomes keep their reservation. No HIGH, audio, production spend or
automatic expansion to all eighteen books. Product eyeball follows the draft.

## Risks / alternatives / rollback
An automatically planned draft may contain continuity or scene errors: show them,
do not relabel it production ready. Reject weakening production gates, claiming
text-only acceptance grants runtime authority, or hand-authoring Dini page patches.
Exact resume is in scope; semantic selective reuse across rewritten stories is not
yet promised. New outputs are ignored/local-only, not backed up by a git push.
Rollback is reverting the focused additive code commit; retain paid outputs.
No deployment, push, story edits, old-book overwrite, threshold changes or cleanup.
