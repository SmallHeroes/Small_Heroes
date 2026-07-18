# BRIEF (CC) — READY screen: hide the print + video buttons for MVP

**⚠️ TARGET BRANCH: `feat/chunked-generation`.** Small, standalone task (separate from the reader/READY UI work).

## Change
On the `/ready` screen, **remove the two non-active buttons** for MVP:
- **"קובץ מוכן להדפסה"** (print-ready file)
- **"סרטון MP4 של הספר"** (MP4 video)

These are not active for the MVP (print = fast-follow, video = post-MVP per prior decisions). **Keep** the three live actions: **"פתח את הספר"**, **"השמע עכשיו"**, **"העתקת הקישור"**.

## How
Prefer **flag/comment out** over hard delete (both are planned fast-follows) — e.g. a `SHOW_PRINT`/`SHOW_VIDEO = false` (or an MVP flag) so they can return without re-implementing. If a flag is heavier than the value, commenting the two button blocks with a `TODO: post-MVP` note is fine.
Files: `public/HTML/ready.html`, `public/JS/ready.js` (+ `public/JS/content.js` if the labels live there).

## Acceptance
- `/ready` shows exactly: פתח את הספר · השמע עכשיו (when audio) · העתקת הקישור. Print + video are gone.
- No dead click handlers / console errors for the removed buttons.
- `npm run check` green. Explicit pathspecs, commit on **`feat/chunked-generation`**, no push. Guy visual-verifies on the next `/ready` load.
