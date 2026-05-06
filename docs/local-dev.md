# Local Dev Workflow

## Static Pages Source of Truth

- Edit static pages only under `public/HTML`, `public/CSS`, and `public/JS`.
- The legacy duplicate root folders (`HTML`, `CSS`, `JS`) are no longer used.
- Next.js serves files from `public/*`, and rewrites in `next.config.js` map:
  - `/` -> `/HTML/index.html`
  - `/wizard.html` -> `/HTML/wizard.html`
  - `/directions.html` -> `/HTML/directions.html`
  - `/generating.html` -> `/HTML/generating.html`
  - `/ready.html` -> `/HTML/ready.html`
  - `/reader.html` -> `/HTML/reader.html`

## Starting Dev Server

- Use `npm run dev`.
- This runs `scripts/dev-safe.js`, which:
  - forces port `3000`
  - refuses to start if port `3000` is already in use
  - prevents accidental second Next.js instance on `3001`

If you intentionally need raw Next behavior, use `npm run dev:raw`.

## Quick Sanity Check

1. Start with `npm run dev`.
2. Confirm terminal shows `http://localhost:3000`.
3. Edit any file in `public/JS`, `public/CSS`, or `public/HTML`.
4. Reload the page and verify your change appears immediately.

If `npm run dev` exits with a port-in-use message, stop the existing local server and restart.
