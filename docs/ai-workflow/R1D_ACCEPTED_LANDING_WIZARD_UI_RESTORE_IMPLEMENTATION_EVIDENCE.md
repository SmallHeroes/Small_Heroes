# R1D Accepted Landing and Wizard UI Restore — Implementation Evidence

**Date:** 2026-08-21

**Branch:** `codex/qa-wizard-presentation-dispositions`

**Functional base:** `005438d01c91af9f1722d0f53380a62332182535`

**No-photo anchor commit:** `a38b1d33`

**Accepted presentation source:** `1dc555396065cee9724fa530bc17c262901e8c35`

## Outcome

The accepted 2027 Landing and Wizard presentation is restored on top of the
current Wizard Visual Package, Story Matrix, checkout and generation branch.
This is a presentation reconciliation, not a rollback of current runtime
authority.

The same milestone keeps the separately committed no-photo correction intact:
a Style 01 order that intentionally continues without a child photo can now
mint a canonical description-template child anchor before cover generation.
The historical fake-paid failure remains immutable and was not retried.

## Scope and reconciliation

- Restored the accepted Landing composition, typography, responsive styling,
  hero media, companion spotlight, six idle companion videos and current-start
  presentation from `1dc55539`.
- Restored accepted Wizard CSS/HTML presentation and gave both stylesheets a
  new `wow-2027-v2` cache key.
- Retained the functional branch's `public/JS/wizard.js`,
  `public/JS/content.js`, `lib/web/mvp-matrix-response.ts` and `package.json`
  byte-for-byte.
- Retained the current `next.config.js` tracing authority and added only the
  unreachable `/api/debug/replicate-image` exclusion for restored marketing
  media, preventing those CDN assets from inflating that serverless bundle.
- Preserved stable `CompanionSpotlight` cutout and Wizard-handoff exports used
  by current consumers and tests.
- Added an exact presentation regression covering the accepted Landing seams,
  required media, Wizard stylesheet identity, current no-photo copy, current
  sellability rule and debug-function tracing boundary.
- Updated the canonical Vitest inventory from 307/287 to 310/290 and proves
  the new presentation regression belongs to the ordinary partition.

No Story Source, Visual Package, Set Board, payment, Reader, provider policy,
generation budget or Production setting changed. Four pre-existing untracked
Set Board artifacts remain untouched and unstaged.

## Validation

- Focused no-photo + presentation + workload suite: **5 files / 30 tests PASS**.
- Expanded adjacent suite before the final inventory-only correction:
  **19 files / 141 tests PASS**.
- `npx --no-install tsc --noEmit`: PASS with the generated `.next` cache
  temporarily isolated and then restored byte-for-byte to its original path.
  After `next build`, the generated `.next/types` surface exposes the existing
  unrelated `app/api/generate/route.ts` extra export; the production build has
  long intentionally ignored generated-route TypeScript errors.
- `next build`: PASS; compilation, Prisma generation, static generation and
  route trace creation completed successfully.
- Desktop/mobile local browser proof: Landing, `/start` and Wizard all load;
  no horizontal overflow or overlay; three hero beats and six cards are
  present; the Wizard no-photo control is visible. The only console/network
  noise was the pre-existing `favicon.ico` 404.
- Literal `npm run check` ordinary phase: 269 files passed, 16 skipped,
  5 failed; 3,428 tests passed, 65 skipped, 6 failed. Five failures are the
  established missing ignored `outputs/` fixtures in unchanged historical
  tests. The sixth was the stale workload inventory and is corrected here.
- Literal `npm run check` resource-intensive phase: **20 files / 610 tests
  PASS**. Vitest still returned nonzero after assertions because of three known
  worker `onTaskUpdate` RPC timeouts.
- `git diff --check`: PASS after normalizing one trailing space in the restored
  Suez One license text.

## Cost, external state and release boundary

No provider, image, Vision, storage, database, payment, Order, email, Vercel
deployment, alias, or Production operation was performed by this UI milestone.
Local screenshots live only under ignored `outputs/local-ui-restore-qa/` and
are not release authority.

The next action is independent Claude Code review of the exact two-commit
range. Only after PASS may Codex push/deploy that reviewed head to QA, prove
Production remains unchanged, and run exactly one fresh Chameleon bedtime
no-photo fake-paid full-book order at LOW quality. Any failure stops the lane;
there is no automatic second paid attempt.
