# BRIEF (CC/Cursor) — reader + READY UI fixes (Codex-audited)

**⚠️ TARGET BRANCH: `feat/chunked-generation`** (staging deploy target → eventually main). Every commit here.
**Supersedes** the standalone READY brief. Narration-niqqud is separate.

**Branch-audit resolved (Codex):** the reader-branch verdict is IN — some items are already on target (do NOT redo), some need a PORT (do NOT rewrite), some are genuinely missing (implement). Follow exactly:

## 1. Mobile — kill the top header + left exit button — PORT, don't rewrite
Genuinely missing: `SiteHeader` still renders at `app/book/[id]/read-v2/page.tsx:39`, and only a generic `×` exists at `reader-v2.tsx:786`. **Port from `fix/reader-mobile`:** `28b42b7c` (mobile shell / exit / preload) + `51e0251b` (header hiding). Then finish the **left-side exit control** for reading mode. Result: full-screen book on mobile, no top header, working exit. (Three-way port — do NOT merge the branch wholesale; skip docs-only `02ce23b0`.)

## 2. Mobile — line-spacing — ALREADY DONE, DO NOT TOUCH
Codex: line-spacing already present at `reader-v2.module.css:1748` (later tightened to 17px/1.55), and RTL nav already corrected (`reader-v2.module.css:1127`). **Skip this — do not re-merge the old branches.**

## 3. Desktop — bottom nav buttons clipped — IMPLEMENT
Cause: the reader consumes `100dvh` beneath an external header (`reader-v2.module.css:1294`), so bottom controls fall off-screen. Fix so the bottom buttons are fully inside the viewport (account for the header height / reduce the bottom offset). Implement directly against current code.

## 4. READY screen — two buttons + per-page audio — IMPLEMENT
Only exists as untracked `_review` mockups. `ready.js:167` gates audio on a single legacy `book.audioUrl`; new pipeline stores per-page `book.pages[].audioUrl`. Detect audio via `book.pages?.some(p => p.audioUrl)` (legacy fallback). Add **"פתח את הספר"** (→ reader) + **"השמע עכשיו"** (→ reuse `app/book/[id]/listen/ListenMode.tsx`). Unify the button model across email ↔ `/ready` ↔ reader.

## 5. Power Card — wrong shared Bolly fallback — FIX
Codex flagged target still has the wrong shared Bolly fallback at `lib/power-cards/resolve-from-order.ts:80`. Correct it (bring the intended fallback, per `fix/reader-mobile@e3a35dac`).

## Acceptance
- Mobile: full-screen book, no top header, working left exit; (line-spacing untouched).
- Desktop: bottom nav fully visible + clickable.
- READY: both buttons; "listen now" plays per-page audio; graceful when no audio.
- Power Card: correct fallback.
- `npm run check` green. **Guy visual verify: desktop + mobile screenshots (reader + READY).** Explicit pathspecs, commit(s) on **`feat/chunked-generation`**, no push. Record the source SHAs ported (28b42b7c/51e0251b/e3a35dac) in the commit message for the consolidation ledger.
