# Child expression concurrent-clause P2 correction

1. Proposed change: stop child affect extraction at English `as`, alongside
   existing concurrent/contrast boundaries. Preserve cues before that boundary.
2. Why: supplied Claude re-gate of e1bdc90d..81738ff1 is PASS0/0/1, closing all
   three prior P2s but demonstrating another actor's laughter after `watched with`.
   Code confirms the watch-with exception bypasses perception truncation and
   `as` is missing from the earlier clause boundary list.
3. Scope: one general cue boundary, existing expression spec and status/docs.
4. Generality: arbitrary actor names, watch tenses, all three input evidence
   fields; no story/page special case or new NLP framework.
5. Files: lib/style01-visual-polish.ts, existing expression spec, CURRENT.md,
   ROADMAP.md and this gate. No composition or provider code changes.
6. Expected: other-actor laughter after `as` is not attributed to the child;
   an explicit child almost-smile/worry/laughter before `as` remains available.
   Ambiguous `as ...` phrases conservatively fall back to situational. This is
   bounded extraction, not grammatical/coreference completeness.
7. Proof: new failing-before tests, nine focused specs after, tsc and provider-free
   real-package audit. Full repository check is deliberately not repeated for
   this one-token boundary correction: last run NON-GREEN with20 timeouts remains
   open; focused green cannot replace it. No timeout or gate relaxation.
8. Cost: zero providers/renders. Existing key reuse already explicitly authorized;
   presence-only skill check, no key used/modified and no new credential authority.
9. Rollback: revert only the focused correction commit, preserve prior evidence.
10. Review: same Codex task sole writer under Guy's approved correction workflow;
    Claude read-only re-gate afterward. No independent closure of this fix claimed.
11. Exclude: new renders, source/story changes, reader routes, package/Blueprint
    mutation, threshold changes, publication, push, deployment, broad NLP expansion.

Stop-check: general fix with conservative false-negative risk; smallest proof is
offline regressions plus actual assembly. No new creative choice/image to eyeball
or Cowork input required. Reject removing the watch-with exception (loses child's
own reaction) and story-specific overrides. No migration or architecture change.
Other latent Hebrew forms remain outside scope, including pointed deficient
spelling vs full spelling. Niqqud removal is not orthographic normalization.

Topology at start: C:/GNart/Work/sh-r3b1b-semantic-m1,
codex/r3b1b-semantic-recovery-m1,81738ff167d0f8419f35a14a70622f5df607a39e,
clean ahead5/behind0 vs local upstream90dfd387. Protected d53b768ccb2f and
accepted-intent-wave-2 63ccb484 clean/read-only. No overlapping writer observed.
Reader predecessor a5b93ddc remains outside supplied independent PASS.

## Validation

15 new cases/controls in the existing expression spec (13 table rows exercise
all3 text sources; generic/arbitrary-name case; actual assembly/frame case).
Before production edit:7 failed/58 passed, exit1. Six failures demonstrate affect
leakage; one demonstrates the deliberately conservative comparative `as` fallback.
After:284/284 in9 focused specs, exit0; tsc --noEmit exit0. No new spec inventory.
Actual assembly test rejects transferred laughter and preserves the full frame.
Real-book audit exit0; byte-identical to prior audit, SHA256
1c550fd206310cc3964da3c5a53bf3f772b0fd3378639036549edf87de20d76a.
13/13 images intact, unchanged projection, package qualified, providerCalls0.
No new render or visual-quality claim. Audit script prints stdout only; shell
redirection creates outputs/child-expression-as-offline-audit.json.
New logs: outputs/child-expression-as-before.*, -focused.*, -tsc.* (full prefix
on each). Ignored/local-only, no verified off-machine backup; not preserved by push.
Full check not rerun; previous20-timeout NON-GREEN result remains open.
