# R1D — Reader Production Experience Polish — Implementation Evidence

Status: implementation complete locally; independent Claude Code QA pending. This document does not self-award technical or product PASS.

## Authority and topology

- Base: `d328b3e4220101eb642f09270bc340fe494af477`
- Branch: `codex/r1d-reader-production-experience-polish`
- Worktree: `C:\Users\guyna\.codex\worktrees\readerpolish1\Small_Heroes`
- External cost: `$0`
- Production: unchanged and blocked
- Parallel website work: isolated in `C:\Users\guyna\.codex\worktrees\sitewow1\Small_Heroes` on `codex/r1d-2027-premium-playful-site-experience`

## Observed defect and root cause

The tracked full-book QA fixture previously reached shared spread/page components through the developer viewer but did not traverse the real Reader controller. The visible experience therefore retained a developer toolbar, native fixture selector and tiny navigation buttons instead of proving the customer navigation, storytime, narration and end-state flow.

At 390×844, a dense page's mobile overlay began at y=481 and measured 482px high. The scene was `100dvh` with hidden overflow, so part of the story text was outside the viewport and unavailable.

The implementation browser pass found one additional runtime defect: `ReaderV2` defaulted `devLayoutFlags` to a new `{}` on every render. The new QA route omitted that optional prop, so the book-loading effect saw a changed dependency on every render and entered `Maximum update depth exceeded`. A module-stable empty value fixes the identity loop without changing any layout flag semantics.

## Implemented contract

1. `ReaderBookSource` is a closed union: `order` or `qa_fixture`.
2. The order variant preserves the existing authenticated fetch/access-key and retry/regeneration behavior.
3. The QA variant carries a server-resolved serializable payload and no credential authority.
4. `/dev/reader` is admitted only by `isDevEnvironment()` and an exact `trackedQaReaderFixtureForDir` match. A client cannot supply a raw filesystem path or arbitrary payload.
5. The dev library exposes a Reader URL only for a real order or a tracked QA fixture; arbitrary audition directories remain debug-viewer-only.
6. Mobile presentation is one of `overlay`, `paper_panel` or `captionless`. The classifier is pure and story-agnostic. Overlay is capped at 180 characters, 36 words and 5 sentences; exceeding any cap selects the paper panel.
7. Dense prose and illustration occupy separate bounded mobile regions. The prose region can scroll as a last viewport fallback. Mobile edge controls are 44×44px and retain accessible names.
8. Desktop physical-sheet animation and reduced-motion behavior are unchanged.

## Changed paths

- `app/api/dev/viewer/library/route.ts`
- `app/book/[id]/read-v2/components/MobileBookPage.tsx`
- `app/book/[id]/read-v2/page.tsx`
- `app/book/[id]/read-v2/reader-v2.module.css`
- `app/book/[id]/read-v2/reader-v2.tsx`
- `app/dev/reader/page.tsx`
- `app/dev/viewer/DevBookViewer.tsx`
- `lib/book-layout/adapters/mobile-page.ts`
- `lib/book-layout/types.ts`
- `lib/dev-viewer-library.ts`
- `lib/reader-book-source.ts`
- `lib/__tests__/reader-page-turn.spec.ts`
- `lib/__tests__/dev-viewer-library-resilient.spec.ts`
- `CURRENT.md`
- this evidence document
- Decision Gate `R1D_READER_PRODUCTION_EXPERIENCE_POLISH_DECISION_GATE.md`

## Validation

### Focused executable proof

```text
npx --no-install vitest run lib/__tests__/reader-page-turn.spec.ts lib/__tests__/reader-nav.spec.ts lib/__tests__/reader-narration-src.spec.ts lib/__tests__/reader-storytime-dwell.spec.ts lib/book-layout/__tests__/open-book-layout.spec.ts lib/__tests__/dev-viewer-library-resilient.spec.ts
```

Result: **6 files / 36 tests PASS**.

Additional checks:

- `npx --no-install tsc --noEmit`: PASS
- `git diff --check`: PASS
- `npm ci --offline --ignore-scripts`: PASS; no network fallback
- `npx --no-install prisma generate`: PASS
- `npm run build`: PASS after stopping the local Reader dev server. The first launch stopped before Next compilation because that server held Prisma's Windows engine DLL; the single replacement completed Prisma generation, Next compilation, linting, page-data collection and all 36 static pages. The new `/dev/reader` route is present in the build output.

### Browser proof

The local QA-only route loaded the exact tracked eight-page Bunny/Bar fixture through `ReaderV2`. After the stable-default correction:

- the prior maximum-update-depth error was absent;
- the hands-free start overlay dismissed after activation;
- the forward Reader control rendered one two-segment physical page sheet;
- the page visibly rotated while the book frame remained fixed;
- the transition landed on page 2 with the correct image/text pair;
- no provider, credential, database or storage boundary was required.

### Literal repository gate

`npm run check` ran once and was not rerun.

- TypeScript: PASS.
- Ordinary phase: exit 1 after 47,354ms. It contained the six established missing ignored-output fixture failures in the five documented baseline files plus one pre-existing stale string assertion in `r1d-dini-bar-five-page-measurement-authority.spec.ts`. The runner already contains the intended nested `clientCompanionId` branch, but the assertion still expects the older single-line string. No changed Reader test failed.
- Resource-intensive phase: exit 1 after 2,778,224ms. `canonical-materialization-input.spec.ts` reported two subprocess failures (one 5s timeout and one null status after child non-completion); `canonical-pre-live-readiness.spec.ts` reported one 5s and one 30s timeout; Vitest reported three unhandled `onTaskUpdate` RPC timeouts. The diagnostic protocol itself was valid and classified `on_task_update_rpc_timeout`, `test_timeout` and `signal_or_exit_failure`.

The full repository/release gate therefore remains HOLD. None of these failures authorizes a retry, timeout change, fixture fabrication or unrelated correction inside this Reader milestone.

## Acceptance evidence

- One Reader controller serves both order and tracked-QA sources.
- Production order semantics and URL remain intact.
- QA cannot inject raw JSON, filesystem paths, order authority or access keys.
- Dense mobile story text cannot remain in the clipping-prone overlay mode.
- Physical page-turn behavior remains the sole desktop book transition.
- Narration selection and storytime dwell tests remain green.
- No story, child, companion or page literal exists in the classifier or source boundary.

## Exclusions and rollback

No narration/TTS generation, image/provider call, credential read, storage/database operation, payment, publication, Production deployment or push occurred. Rollback removes the QA route/source adapter and reverts the mobile presentation field/CSS; all fixture, book, order and rendered image bytes remain unchanged.

Independent Claude Code QA must falsify the implementation before Guy treats it as technically closed. Guy retains product acceptance.
