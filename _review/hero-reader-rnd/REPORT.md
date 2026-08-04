# SmallHeroes — Hero & Animated Reader R&D Report

Date: 2026-08-04 · Status: **experimental, uncommitted** (branch `feat/design-system-refresh`, working tree only)
Entry points: `/dev/hero-experiment` · `/dev/reader-flip-experiment` (both `isDevEnvironment()`-guarded, prod-404)

---

## 1 · Current-state findings

**Hero (production landing):** static illustration + copy. No book object on screen, no personalization moment —
the product's core promise ("ספר שנוצר במיוחד לילד שלכם") is stated in words but never *happens*. The emotional
beat depends entirely on the (good) fox illustration.

**Reader (read-v2):** already composites a photographed physical book (OpenBook.png + masked illustration +
live HTML prose + torn-paper overlay) — a real head start for physicality — but scene changes are a plain 0.45s
opacity fade. Hebrew nav conventions already correct (forward = ArrowLeft / left control). Audio: per-scene clips,
leaving-page stop, 1.5s arrival delay, storytime auto-advance, gesture-unlock. Mobile = single-page card.
Adjacent-image preload hook exists (±1). No page physicality anywhere.

## 2 · Options evaluated

### Hero implementation approaches
| Approach | Strengths | Weaknesses | Cost/Risk | Verdict |
|---|---|---|---|---|
| Lottie | Cinematic control | **Dynamic Hebrew text effectively impossible** (glyph shaping unreliable → outlines → no live name), can't reuse real DOM/product assets, 200KB–1MB asset, AE pipeline to maintain | Med/Med | ✗ fails personalization |
| **Layered HTML/CSS 3D** | Live name in real Rubik instantly, real product assets, tiny payload (reuses existing images), native RTL, trivial reduced-motion/fallback | Needs craft to avoid flatness | Low/Low | **✓ chosen** |
| Hybrid (video/Lottie open + DOM settle) | Fancier camera moves | Frame↔DOM sync fragile, double asset weight, moves we don't need | Med/High | ✗ |
| Canvas/WebGL | Cloth-level realism | Payload + complexity + a11y cost for a marketing hero | High/High | ✗ overkill |

### Hero concepts (evaluation: emotion / clarity / personalization / brand / mobile / perf / risk / a11y / maintainability / real-content)
- **A · "הספר קם לחיים"** — closed personalized cover opens into a real spread. Strong open beat; every criterion high. **9/10 real-content honesty** (cover is DOM-built from product pieces; spread = production reader assets).
- **B · "הילד הופך לגיבור"** — photo→character transformation. Emotionally strongest *in theory*, but no honest "before" asset exists (can't fabricate a child photo) → fails real-content + privacy optics. Rejected.
- **C · "הסיפור נרכב מול העיניים"** — wizard fragments assemble into the book. Great product story, but busy; motion fights the restraint principle; hardest to keep calm on mobile. Runner-up.
- **D · "ספר פתוח אינטראקטיבי"** — open book with pointer depth + live detail. Tactile but loses the opening "wow".
- **Selected: A+D hybrid + name moment** — one strong opening motion (A), settled interactive depth (D), and the
  personalization moment done as the product actually behaves: typing a name rewrites the cover + title page
  ("הסיפור של …") — AI expressed through adaptation, zero AI clichés.

### Reader page-turn approaches
| Approach | Strengths | Weaknesses | Verdict |
|---|---|---|---|
| **Custom CSS-3D sheet + pointer drag** (1+3 merged) | Exact Hebrew physics, DOM text stays live/sharp/selectable, no deps, aligns to the photographed paper bounds, drag-with-cancel intent | Must hand-build state machine + shadows (done) | **✓ chosen** |
| Library: StPageFlip / react-pageflip | Ready-made curl | **RTL unsupported/hacky** (LTR index model), imposes its own DOM (breaks live-HTML requirement), maintenance stale, ~26KB | ✗ |
| Library: turn.js | Classic | jQuery, abandoned, non-free commercial license | ✗ |
| Lightweight layered slide (4) | Cheap, robust | Less physical | ✓ **used on mobile intentionally** + as reduced-motion crossfade |

Timings tested by driving the engine at 380/450/520/650ms: 380 feels snappy but clips the illustration reveal;
650 feels theatrical; **520ms with cubic-bezier(0.45, 0.05, 0.25, 1)** (accelerate → soft landing) reads most
book-like; cancel spring 260ms. Drag threshold 50%, tap-vs-drag discrimination at 4% travel.

## 3 · Selected concepts — why strongest
**Hero:** the only concept where the product's exact promise happens on screen with 100% honest assets, in
~0 added bytes (all assets already ship), fully RTL, with a static fallback that is itself a finished design
(closed personalized cover / pre-opened book). CTA never blocked; JS-free page remains complete.
**Reader:** the custom sheet engine is the only approach satisfying all three hard constraints — correct
Hebrew physics (left page folds rightward over the spine), live HTML prose, zero dependencies — while reusing
the production reader's own composite recipe (same 3 assets, same layer order), so a production port is a
mapping exercise, not a rebuild.

## 4 · Prototype implementation

**Files created (ALL new — nothing existing was modified):**
```
app/dev/hero-experiment/page.tsx                    dev-guarded route
app/dev/hero-experiment/HeroExperiment.tsx          hero component (~150 lines)
app/dev/hero-experiment/hero-experiment.module.css  hero styles
app/dev/reader-flip-experiment/page.tsx             dev-guarded route
app/dev/reader-flip-experiment/FlipBook.tsx         flip engine (~450 lines)
app/dev/reader-flip-experiment/flip-experiment.module.css
app/dev/reader-flip-experiment/sample-story.ts      real bank prose + real assets
_review/hero-reader-rnd/*                           evidence + this report
```
**Files modified:** none. **Dependencies added:** none. **Commits:** none.
**Flags/routes:** dev routes only (same guard as existing `/dev/*`); production `/` and `/book/[id]/read-v2` untouched.
**Assets used (all existing):** OpenBook.png, BookImageBottomMask.png, MaskOnBook.png, gallery-1..6.jpg,
companions/fox_uri front.png, voice-samples/4RZ84U1b….mp3; prose = approved bank story
(bunny_ometz medical, `{{childName}}`→"נועה" exactly as production substitutes).

**Architecture decisions:** screen-space book geometry pinned `direction:ltr` (RTL page direction must never
mirror physics); sheet aligned to the photographed paper bounds (x 2.6→97.4%, y 2→97.6%) with window math
recomputed in sheet-space; page window = current ±1 mounted; single `EngineState` machine
(idle/dragging/animating) is the double-nav guard; audio start/stop mirrors production policy
(stop at turn start, start after completion + delay).

## 5 · Evidence (`_review/hero-reader-rnd/`)
- `hero-desktop.webm` — closed→open→typing "דניאל" live cover/title rewrite→pointer depth
- `hero-mobile.webm`, `hero-mobile-390.png` — mobile order (book first), full sequence
- `hero-closed.png` / `hero-opening-mid.png` / `hero-open-1440.png` — static fallback + sequence stills
- `hero-reduced-motion.png` + probe `{opened:'yes', coverOpacity:'0'}` — pre-opened, still, complete
- `flip-desktop.webm` — forward ×2, backward, keyboard both ways, drag-cancel, drag-complete, 6× rapid hammer
- `flip-drag-hold.png` — held mid-drag (~65°): foreshortening, reveal, shadows
- `flip-idle-1440.png`, `flip-midturn-early/late.png`, `flip-drag-cancelled.png`
- `flip-mobile.webm`, `flip-mobile-390.png` — intentional slide turn
- `flip-reduced-motion.png` + probe `{sheetMounted:false, physical:'off', page advanced}` — crossfade path
- Perf probes (in `evidence.mjs` output): **60 FPS steady, worst frame 17ms during turns; heap 44.2→36.2MB
  after 40 turns (no leak); rapid 6× hammer → clean sequential turns, no double-nav, no stuck layers.**
  Audio probe: silent until arrival gesture-armed page; `paused:false` only after turn completes (+400ms);
  leaving stops the clip. No autoplay violations (toggle = gesture).

## 6 · Production recommendation
- **Hero: strong candidate for production.** Zero new bytes, honest personalization, static fallback is
  shippable by itself. Needs: product copy pass (Guy), a real cover-art asset pass (current cover is DOM-built),
  and an A/B against the current hero for conversion.
- **Reader flip: promising — one iteration from production-ready.** The engine + physics are proven; the port
  into read-v2 needs: wiring to `StoryScene` data + `reader-nav` (cover/power-card/dedication branches),
  narration integration behind the existing timers, wide-spread (`isWide`) handling, and Safari verification.
  Recommend shipping behind `?flipExperiment=1` on read-v2 as step 2 — **which touches the Decision-Gate
  reader surface and therefore needs Guy's gate approval + Codex ownership.**

## 7 · Risks & next steps
- **Browser:** CSS 3D + backface on Safari/iOS needs a verification pass (translateZ hack occasionally needed);
  Firefox mask-image behavior on the illustration layer to confirm. (Chrome/Edge verified here.)
- **RTL:** physics are correct *because* geometry is pinned LTR — any future refactor must preserve that pinning.
- **Audio:** production narration adds storytime auto-advance + unlock state; the coupling policy demonstrated
  here matches it, but rapid-turn + auto-advance interplay must be re-verified in the real reader.
- **Performance:** the composite renders OpenBook.png up to 6× during a turn (4 half-windows + 2 sheet faces).
  Fine on desktop (60fps); for low-end mobile the slide mode avoids it by design. A production port should
  share one decoded image (it does — same URL → one cache entry; GPU layers are the cost, measured OK).
- **Maintenance:** engine is ~450 self-contained lines; the main coupling risk is the paper-bounds constants
  if the OpenBook.png asset ever changes — extract to shared constants with the reader on port.
- **Hero:** the name input must never imply an account/photo was created — copy currently says "הכריכה מתעדכנת" only.

## 8 · Cleanup / preservation
- **Remove everything:** delete `app/dev/hero-experiment/`, `app/dev/reader-flip-experiment/`,
  `_review/hero-reader-rnd/` (all untracked — `git status` returns to prior state; zero tracked files touched).
- **Keep only the hero:** delete `app/dev/reader-flip-experiment/` only.
- **Keep only the reader:** delete `app/dev/hero-experiment/` only.
- **Preserve for later:** leave as-is (untracked) or `git add app/dev/hero-experiment app/dev/reader-flip-experiment`
  + commit on a side branch when Guy decides. Nothing in production references either route.
```
git status (before): feat/design-system-refresh, only _review/* + project-os/ + scripts/check-order-anchor-readiness.ts untracked
git status (after):  identical + the 8 new experiment files (all untracked) — no commits made
```
