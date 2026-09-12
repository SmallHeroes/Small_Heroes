# Local rendered-book reader — decision gate

1. Change: load a local book-review manifest into existing ReaderV2 via its QA
   payload source; retain owner decisions separately from automated results.
2. Why: Guy wants the actual reader to judge the completed draft. Existing QA
   reader is allowlisted to older fixtures and reloads legacy story-bank text.
3. Scope: general local-only inspection adapter and story-specific evidence data.
4. Hardcoding: no Dini/child/page special cases in executable code. No layout fork.
5. Files: new local-book-review loader, local page/image routes, focused tests;
   CURRENT/ROADMAP; ignored owner-review and handoff evidence.
6. Expected: exact manifest text and hash-verified copied images in ReaderV2.
   Missing/invalid data fails closed. Owner approval never rewrites QA results.
7. Validation: positive/negative loader and route tests, tsc, repository check,
   HTTP image hashes, desktop/mobile browser navigation.
8. Cost: zero providers, credentials, renders or audio. Existing bytes only.
9. Rollback: stop this loopback dev server and unset LOCAL_BOOK_REVIEW_DIR;
   focused code commit is reversible. Preserve all existing artifacts.
10. Owner decision: explicit request in this task to handle review while Claude
    is paused and supply a reader link; page 7 visually accepted by Guy. Codex
    performs engineering verification, never independent Claude PASS.
11. Do not: publish/deploy/push, create a customer Order, change thresholds,
    mark missing numerical evidence passed, rerender page 7 for this concern.

Stop-check: local reader adapter, not production layout/generation change. Other
stories and tracked fixtures unchanged. No spend. Smallest proof is stored-book
rendering and negative tests, not image generation. Guy judges the actual reader;
no unresolved product decision or Cowork consultation is needed for this scope.
Claude later falsifies byte/text identity, environment gates and QA separation.

Topology at start: sole writer /root, current task, branch
codex/r3b1b-semantic-recovery-m1 at 1bc22ea6, clean, ahead 2 / behind 0 locally.
Worktree C:/GNart/Work/sh-r3b1b-semantic-m1. Protected d53b at 768ccb2f and
accepted-intent-wave-2 at 63ccb484 clean, read-only, locally synchronized.
Prior immutable QA range and original handoffs remain unchanged.
