# Sequence source binding correction

Owner's standing instruction: implement general fixes, then Claude QA. Same task,
sole writer in C:/GNart/Work/sh-r3b1b-semantic-m1, branch
codex/r3b1b-semantic-recovery-m1. Base9d0bbe1d, clean/ahead13. Protected worktrees
768ccb2f/63ccb484 are read-only. No push or paid execution.

Claude PASS0/0/2 covers the original sequence/planning ranges and the last tests;
it excludes Claude-authored a2d30f89. Valid P2: validateBookSequence accepts detached
texts/sourceSha. Current callers verify source bytes, but the helper cannot enforce
that relationship. Expected: exact personalized prose and original source digest
must come from one parser invocation, never caller-assembled fields.

Small general fix: previewStory retains a private process-local provenance record
in a WeakMap, with serialized output and derived source/text snapshot. The evidence
accessor rejects an unregistered/modified object and returns a defensive copy.
Sequence validation and automatic compilation use that accessor; detached legacy
texts/sourceSha input is removed. No new file/schema/prompt fields; fresh parsing of
the same source on replay still works. Persisted story JSON is not evidence: reparse
the original source instead. This is integrity, NOT editorial/accepted-source authority.

Files: local-story-preview, local-book-sequence, local-book-planning, owner runner,
offline preparation caller and corresponding tests/evidence. No story-specific logic.
Rejected: another caller-supplied digest, an unenforced comment, accepting serialized
clones as provenance, or changing paid artifacts. Plan byte identity remains verified
by existing callers; semantic entailment is still not established by quote matching.

Validation: original bypass fails; both personalization variants work; modified title,
page text, ordering, source digest, clone and hand-built story reject; defensive-copy
tampering does not mutate provenance; real entry plus saved artifact replay; tsc and
focused/full checks. Rollback one focused commit, no artifact migration required.

P2 test instability: investigate subprocess startup separately and preserve observed
failures. No automatic timeout increases, quarantine, reduced assertions or claim
that all failures are inherited. Any runtime performance fix needs its own measured
root cause and milestone. Cost0/no keys/providers/renders. No unresolved product
choice for this integrity correction; Claude should fault-inject the new boundary.
