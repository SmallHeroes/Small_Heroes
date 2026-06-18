# 0083 · Claude → Claude Code · Goal A: refresh + open the public site (buy = WAITLIST)

**Goal:** make smallheroes.co.il show the CURRENT product (feat/chunked-generation) to the public, with the buy flow in **waitlist** mode (no real money — render is NOT production-ready). Today prod = `main @ voice-pack` (~239 behind), password-protected (only Guy). The branch builds on Vercel but the **deploy fails on serverless function size (>250MB)** — that's the #1 blocker.

**Executor = Claude Code (local, real disk). Commit per milestone with explicit pathspecs. `npm run check` green before each commit. Do NOT merge to main yet — that's a separate gated step after Codex review.**

## Phase 1 — unblock the Vercel deploy (function size)
The deploy fails: 9 serverless functions exceed 250MB because Next bundles `public/companions/*` + `style-references/*` + `story-bank/*` + `@ffmpeg-installer/linux-x64` into the functions.
- Add `outputFileTracingExcludes` in `next.config.js` to exclude the heavy asset dirs + `@ffmpeg-installer` from functions that don't need them (e.g. exclude ffmpeg from everything except the video route; exclude the bundled asset dirs from API routes that read them from disk only at request time — verify each).
- Goal: every serverless function < 250MB. Verify with a Vercel preview build of the branch (the PR #15 preview, or a fresh push) — the deploy must reach READY, not ERROR.
- Report the per-function sizes + the preview URL when it deploys.

## Phase 2 — waitlist buy-mode (no real charges)
There is NO global waitlist flag today (only per-slot "בקרוב"). Build one, env-gated:
- Add `NEXT_PUBLIC_BUY_MODE = 'waitlist' | 'live'` (default `waitlist`). When `waitlist`: every buy/checkout CTA becomes a **waitlist signup** (capture email/child-name interest → store in a simple table or the existing email provider) instead of routing to `/api/checkout`. The wizard can still be browsable but ends in "נודיע לך כשמוכן" — never a real charge.
- Hard guard: when `BUY_MODE=waitlist`, `/api/checkout` returns a clear "waitlist mode" response and CANNOT create a real PayMe charge.
- Keep it simple — a clean waitlist capture, not a full CRM.

## Phase 3 — prod safety gates (verify, report)
- Confirm `/dev/*`, `/api/debug/*`, `/api/dev/*` all return 404 in production (NODE_ENV check).
- Confirm `NEXT_PUBLIC_GENERATION_SECRET` is NOT shipped to the client (GUY-28) — if it is, move it server-side or stub it for the public deploy.
- List every env var the prod build needs (audit `lib/env.ts`) so Guy can set them in Vercel.

## What stays for Guy + Claude (NOT Claude Code)
- **Vercel settings (Guy, Claude-guided):** set prod env vars (incl. `ENABLE_V3_APPROVED_BANK=true`, `NEXT_PUBLIC_BUY_MODE=waitlist`, provider keys); remove the password/Deployment-Protection when we flip live.
- **Codex review of the 239-commit cutover** BEFORE merge→main.
- **Merge feat/chunked-generation → main** (Vercel auto-builds prod) — only after: green preview + Codex review + env set + waitlist confirmed. Keep `main @ voice-pack` as rollback.

## Acceptance
- Vercel preview of the branch deploys READY (all functions < 250MB).
- In `BUY_MODE=waitlist`, no path can create a real charge; buy CTAs capture a waitlist signup.
- `/dev` + `/api/debug` 404 in prod; no NEXT_PUBLIC secret on the client.
- `npm run check` green.
Report as 0084 with: function sizes, preview URL, the env-var list, and confirmation of the waitlist guard.

## Do NOT
- Do NOT merge to main or touch prod / the domain / the password — those are gated (Codex review + Guy).
- Do NOT enable real payments. Waitlist only until render-ready.
