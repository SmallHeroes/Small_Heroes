# BRIEF (CC/Cursor) — `/ready` screen: restore the two buttons + detect per-page audio

**Origin:** Codex render diagnosis. This is NOT a branch regression — the buttons were added to the EMAIL, but the `/ready` screen kept the OLD implementation, and its audio detection reads a single legacy field that the new pipeline no longer fills.
**Branch:** `feat/chunked-generation`.

## The bug
- `public/JS/ready.js:167` shows the audio button only `if (book.audioUrl)` — a SINGLE legacy URL. The new pipeline stores audio **per page**: `book.pages[].audioUrl` (see the order API `app/api/orders/[orderId]/route.ts` audio field). So on a real new book, `book.audioUrl` is empty → the "listen now" affordance never appears.
- The two buttons Guy expects — **"פתח את הספר" (open book)** and **"השמע עכשיו" (listen now)** — are not on `/ready` (`public/HTML/ready.html`).
- Per-page listening already WORKS in the reader: `app/book/[id]/listen/ListenMode.tsx` plays per-page audio.

## Fix
1. **Audio detection:** on `/ready`, detect audio by `book.pages?.some(p => p.audioUrl)` (the per-page model), not the single `book.audioUrl`. Keep a fallback to the legacy single URL if still present.
2. **The two buttons on `/ready`:**
   - **"פתח את הספר"** → opens the reader (the book view).
   - **"השמע עכשיו"** → opens the per-page listen experience (route to / reuse `ListenMode`), which already handles `pages[].audioUrl`.
3. **Unify the button model** across email ↔ `/ready` ↔ reader so the three agree (same actions, same audio-detection logic) — no third divergent copy.

## Files
- `public/JS/ready.js`, `public/HTML/ready.html` (the `/ready` screen).
- Reuse `app/book/[id]/listen/ListenMode.tsx` for "listen now"; do not reimplement per-page playback.
- Confirm the order API returns `pages[].audioUrl` to the `/ready` payload; if not, thread it through.

## Acceptance
- On a book that has per-page audio, `/ready` shows BOTH buttons; "listen now" opens per-page playback and plays; "open book" opens the reader.
- On a book with NO audio, "listen now" is hidden/disabled gracefully (no broken control).
- `npm run check` green. **Guy visual verify** (screenshot desktop + mobile — the same eyeball as the reader screens). Explicit pathspecs, commit on `feat/chunked-generation`, no push.
