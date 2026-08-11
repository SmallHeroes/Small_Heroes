# R1D — Reader Production Experience Polish — Decision Gate

Status: product direction authorized by Guy on 2026-08-11. Implementation is QA-only. Production remains blocked.

Base: `d328b3e4220101eb642f09270bc340fe494af477`

## Observed behavior

The tracked full-book QA fixture reaches the real `DesktopBookSpread`, `DesktopPhysicalPageTurn`, `MobileBookPage`, book-layout adapters and Reader CSS through `/dev/viewer`. The desktop book and forward page-turn work, but the surrounding experience is still the developer viewer: an inline-styled `VIEWER` toolbar, a native fixture selector, 20×22px unlabeled arrow buttons and a developer link remain part of the visible reading surface.

The production `/book/[id]/read-v2` Reader already owns the customer controls, order access boundary, narration playback, automatic storytime flow, end screen, power-card flow, mobile edge navigation, loading/error behavior and exit semantics. QA fixtures do not currently pass through that complete experience, so the stable QA URL does not prove the actual customer Reader.

The mobile adapter also sets `showText` for every non-captionless story page. `MobileBookPage` therefore renders every page as full-bleed artwork with one bottom gradient overlay, independent of text density. On the measured 390×844 page, the 482px text overlay begins at y=481 and extends past the 844px viewport while the scene is `overflow:hidden`; content is visibly clipped.

## Expected behavior

- A tracked QA book can be opened through the same customer Reader state machine and controls used for an order, without inventing an order, access key or database row.
- Desktop retains the existing fixed book frame and physical paper-sheet page turn.
- Mobile chooses a deterministic text presentation that never clips the story: short copy may overlay the illustration; dense copy uses a readable paper panel with the illustration still prominent.
- QA-only fixture/library controls are outside the immersive Reader surface and meet accessible target/label requirements.
- The route remains QA/Preview-only and cannot expose local fixtures in Production.

## Root cause and contributing factors

1. QA and Production share rendering components but not the complete Reader controller.
2. The Reader controller couples order fetching to presentation instead of accepting a closed, serializable Reader book source.
3. Mobile presentation derives only from `captionless` versus non-captionless authority and has no deterministic density classification.
4. The developer viewer's inline toolbar was built for inspection rather than a customer reading experience.

## Nine architectural decisions

1. **One Reader controller.** QA fixtures and real orders must reach the same `ReaderV2` navigation, audio, storytime, end-state, loading/error and physical-turn implementation. `DevBookViewer` remains a library/debug surface, not a second customer Reader.
2. **Closed source boundary.** Reader loading becomes an explicit discriminated source: authenticated order fetch or server-resolved QA fixture payload. The QA source is serializable, repository-owned and admitted only behind the existing `isDevEnvironment()` Preview/local guard. It never synthesizes an order, database authority or access key.
3. **Production behavior preserved.** The existing authenticated order path remains the default and retains its URL, fetch, access-key, retry/regeneration and exit behavior. QA injection cannot be selected by a Production request or client-controlled raw filesystem path.
4. **Deterministic mobile text strategy.** A pure book-layout classifier derives `overlay`, `paper_panel` or `captionless` from typed text treatment plus bounded structural density (word, sentence and character counts). It is generic across stories, children and companions and contains no story/page literals.
5. **No clipped prose.** `overlay` is permitted only when the complete text fits the short-copy budget. `paper_panel` gives illustration and prose separate bounded regions and makes prose internally scrollable only as a final viewport fallback. Text must remain selectable, RTL, semantically ordered and available to assistive technology.
6. **Motion contract unchanged.** Desktop forward/backward physical-sheet animation, fixed book frame, adjacent-image preload and reduced-motion instant fallback remain unchanged. Mobile navigation remains instant in this milestone; no fake 3D mobile page curl is added.
7. **Product Reader chrome.** The immersive QA Reader uses the Production control hierarchy. Fixture selection and `open in Creator` stay in the dev library/entry route. All visible navigation controls have names, focus states and at least 44×44px targets.
8. **Narration boundary preserved.** Existing per-page and whole-book audio playback behavior is exercised but no TTS, audio generation, voice selection, storage or provider integration is added. Missing audio remains an explicit no-audio state, not simulated narration.
9. **Versioned, reversible delivery.** The new QA Reader route and source adapter are additive. Rollback removes the route/source adapter and restores the previous mobile adapter/CSS; historical fixtures and book/order data stay byte-unchanged. Existing `/dev/viewer` remains available for debugging.

## Likely files

- `app/book/[id]/read-v2/reader-v2.tsx`
- `app/book/[id]/read-v2/reader-v2.module.css`
- `app/book/[id]/read-v2/components/MobileBookPage.tsx`
- `app/dev/viewer/DevBookViewer.tsx`
- new QA-only Reader route under `app/dev/`
- `lib/book-layout/adapters/mobile-page.ts`
- `lib/book-layout/types.ts`
- Reader/book-layout regression tests
- `CURRENT.md` and implementation evidence

## Acceptance criteria

1. A tracked eight-page fixture opens through the Production Reader controller on local and protected QA Preview.
2. Real order construction/fetch behavior is byte/source compatible except for the closed loader boundary needed for reuse.
3. Desktop forward and backward turns expose exactly one physical-sheet overlay, with no whole-book animation.
4. Reduced motion remains instant.
5. At 390×844, every tested page has complete readable prose without viewport clipping; short and dense cases select the expected presentation.
6. Controls have accessible labels, visible keyboard focus and minimum 44×44px interactive targets.
7. Missing audio does not show a fake playable state; supplied fixture audio uses the existing Reader audio path.
8. Focused tests, deterministic TypeScript, `git diff --check`, `npm run build` and one repository `npm run check` complete with no new failure beyond the separately recorded six fixture HOLDs.
9. Browser evidence covers desktop page 1, an active forward turn, settled page 2, backward turn, mobile short copy, mobile dense copy, loading/error and end state where reachable without external mutation.

## Cost and exclusions

External cost is `$0`. No image/audio generation, credential access, provider/network call, database/storage write, Board action, payment, approval, publication, Production deployment or Production-domain change is authorized. No story, prompt, model, render, authority, Page Contract or Wizard selection behavior changes.

## Risks and rejected alternatives

- **Rejected: polish only `DevBookViewer`.** It would leave QA proving a second controller instead of the customer Reader.
- **Rejected: create fake QA orders.** It would blur order/database authority and require cleanup.
- **Rejected: always overlay mobile prose.** It is the demonstrated clipping defect.
- **Rejected: always place prose below the artwork.** Safe but unnecessarily discards the strong full-bleed experience for genuinely short pages.
- **Risk: loader refactor changes order behavior.** Mitigate with a discriminated source, direct order-path regressions and no shared permissive fallback.
- **Risk: Claude's site branch also touches Reader chrome.** Do not integrate or overwrite that branch. Reconcile its visual-only diff after this branch is green; Reader authority and behavior remain owned here.

## Independent review and product eyeball

Claude Code must falsify source isolation, Production inaccessibility, order-path compatibility, mobile density boundaries, clipped-text prevention, accessible controls, unchanged physical-turn/reduced-motion behavior and exact validation claims. Guy should inspect desktop and mobile QA Readers, page-turn feel, text readability and whether the result feels like a real book rather than a developer tool.
