TYPE: RESULT
AUTHOR: Claude Code
DATE: 2026-06-18
RELATED: 0083 (Goal A brief — prod-refresh; note: a second 0083 file, my scene-time wardrobe RESULT, shares the number — flagged for renumber), 0070 (deploy size-fail)

# 0084 · Goal A — function-size fix + waitlist buy-mode + prod safety gates

Executor = Claude Code. Commits per phase, explicit pathspecs, `npm run check` green throughout.
**Not merged to main; prod / domain / password untouched.** Branch `feat/chunked-generation`, PR #15.

## Phase 1 — serverless function size (>250MB)  → SIZE BLOCKER RESOLVED (deploy not yet READY)
Commits: `c994a572`, `2fbd6e37`, `00b87f10` — `next.config.js` `outputFileTracingExcludes`:
- ffmpeg + ffprobe installers excluded from every non-video function (only `backend/providers/video.ts`
  → `/api/orders/[orderId]/video` needs them; `/api/generate`'s video stage is dynamic/optional/non-fatal).
- `@sparticuz/chromium` + `puppeteer-core` excluded from every non-power-card function.
- `public/companions` + `style-references` excluded from the payment/webhook routes AND the generation
  routes (image refs are passed to the image API by CDN URL, not read from the function disk; `story-bank`
  text stays via the existing `outputFileTracingIncludes`).
- `00b87f10`: removed the per-function `memory` setting from `vercel.json` (Vercel reports it "ignored on
  Active-CPU/Fluid billing"; recommended removal).

**Build evidence (preview `dpl_FWPaNCFvkwLJwgFNdZwcLosGDuxp`, commit 2fbd6e37):**
- `✓ Compiled successfully in 27.0s` · `✓ Generating static pages (29/29)`
- `Created all serverless functions in: 2.576s` · `Build Completed in /vercel/output [51s]`
- **NO "Max serverless function size" warning or error** (0070 had it for 9 functions; the f415324
  build still had it for 4 generation functions; THIS build has none) → every function < 250 MB. ✅
- Vercel does not print per-function MB unless over the cap, so the proof is the *absence* of the size
  warning/error + clean function creation. The flagged functions across iterations: 9 (0070) → 4
  (f415324, kept assets) → **0** (2fbd6e37, assets excluded from generation routes).

**REMAINING BLOCKER — deploy still ERRORs post-build (READY not reached).** `dpl_FWPaNCFvkwLJwgFNdZwcLosGDuxp`
went BUILD-success → "Deploying outputs..." → ERROR ~125s later. This is a SECOND blocker the size
error was masking — *every* prior `feat/chunked-generation` deploy is ERROR (only `main`/`feat/dini-*`
ever reached READY). The cause is NOT in the build logs (clean) nor runtime logs (none — deploy never
went live), and the MCP `get_deployment` exposes no error field. The `memory`-removal push
(`00b87f10`, `dpl` building now) is the next experiment; if it still ERRORs, **Guy: please open the
Vercel dashboard deploy error for the latest `feat/chunked-generation` deployment** (or grant deploy-events
access) — likely candidates: a plan/Fluid-compute limit, function upload total-size/timeout, or cron.

## Phase 2 — waitlist buy-mode (no real charges)  → DONE (commit 9ac4db63)
- `lib/env.ts`: `NEXT_PUBLIC_BUY_MODE: 'waitlist' | 'live'`, **default `waitlist`**; `isWaitlistMode()` helper.
- `/api/checkout`: a hard guard at the very top of POST — in waitlist mode it captures the order as a
  lead (logs email + child name; the draft order row is the lead) and returns `{ mode: 'waitlist' }`
  BEFORE any PayMe/fake-payment path. **No real charge can be created in waitlist mode.**
- `public/JS/wizard.js`: on `{ mode: 'waitlist' }` the buy CTA shows "נרשמת לרשימה ✓ … נודיע לך כשהספר מוכן"
  and does NOT redirect to payment.
- The wizard stays browsable; only the final checkout becomes a waitlist signup.

## Phase 3 — prod safety gates  → DONE (commit f415324c)
- `middleware.ts` (new, general): 404s `/dev/*`, `/api/debug/*`, `/api/dev/*` when NODE_ENV=production
  (covers 6 routes that lacked a per-route gate). Compiled in the preview (`ƒ Middleware 35.4 kB`).
- `NEXT_PUBLIC_GENERATION_SECRET` no longer ships to the client (GUY-28): `reader-v2.tsx` reads it only
  outside production, so Next dead-code-eliminates the reference from the prod bundle (the in-reader
  regen tool is simply disabled on the public site).

## Env vars the prod build needs (audit of `lib/env.ts`)
REQUIRED (build throws if missing, non-build): `DATABASE_URL`, `GENERATION_SECRET`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_APP_URL` (or `APP_URL`).
Behavior/keys to set for the public waitlist deploy:
- `NEXT_PUBLIC_BUY_MODE=waitlist`  ← required for the safe launch
- `ENABLE_V3_APPROVED_BANK=true` (serves the v3-approved stories)
- `PAYMENT_PROVIDER` (payme) + `PAYME_API_BASE_URL` / `PAYME_API_KEY` / `PAYME_WEBHOOK_SECRET` /
  `PAYME_WEBHOOK_ALLOWED_IPS` / `PAYME_VERIFY_PATH` / `PAYME_REDIRECT_TRUST_MODE` (can stay unset/empty
  in waitlist mode — checkout never reaches PayMe)
- `SUPABASE_STORAGE_BUCKET` (default `book-images`)
- `STORY_PROVIDER`, `IMAGE_PROVIDER`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `REPLICATE_API_TOKEN`,
  `ELEVENLABS_API_KEY`, `RESEND_API_KEY`, `EMAIL_PROVIDER` (generation/voice/email — not exercised in
  waitlist mode but needed when generation is enabled)
- Do NOT set `NEXT_PUBLIC_GENERATION_SECRET` on the public build (GUY-28); `ENABLE_FAKE_PAYMENT` /
  `ALLOW_FAKE_PAYMENTS` must be false in prod.

## Preview URL
Branch alias: `https://small-heroes-git-feat-chunked-generation-smallheroes-projects.vercel.app`
(serves once a deploy reaches READY — currently blocked by the post-build error above).

## Acceptance status
- functions < 250 MB: ✅ (size error gone)
- deploy READY: ❌ not yet (separate post-build error — needs dashboard diagnosis)
- waitlist: ✅ no path creates a real charge; buy CTA captures a signup
- `/dev` + `/api/debug` 404 in prod + no NEXT_PUBLIC secret on client: ✅ (code; will confirm live once READY)
- `npm run check` green: ✅

## UPDATE (memory-removal experiment result)
`00b87f10` (drop `memory`) → `dpl_5MxUxQuWKUFGRgwu9FBzQLfWKTJv` (commit `8afceafd`) = **still ERROR**
(~190s; build clean: compiles, 29 static pages, build traces, NO size warning/error). So the `memory`
setting was NOT the cause. The post-build deploy error is **opaque to every tool I have**: build logs
end clean at the route table / "Deploying outputs"; runtime logs are empty (deploy never went live);
MCP `get_deployment` has no error field; no `gh` CLI on this machine.

**ACTION FOR GUY (only the dashboard exposes this):** open the deploy error for the latest
`feat/chunked-generation` deployment —
`https://vercel.com/smallheroes-projects/small-heroes/5MxUxQuWKUFGRgwu9FBzQLfWKTJv` — and paste the
ERROR text. Given build success + ERROR ~2-3 min after "Deploying outputs", and that it is NOT size
(fixed) and NOT memory (tested), likely culprits: a Fluid-compute/plan limit (serverless function
**count** or **total deployment upload size**), a deployment-promotion timeout, or a project-setting
mismatch. With the dashboard error text I can fix it immediately.

I am NOT pushing further blind experiments (each is an ~8-min failing build). Size + waitlist + gates
are done and committed; the remaining gate is this one dashboard-only diagnosis.

## Next
1. Guy pastes the dashboard deploy error for `dpl_5MxUxQuWKUFGRgwu9FBzQLfWKTJv` → I fix → green preview.
2. After green preview: Codex review of the 239-commit cutover → Guy sets prod env + flips
   `NEXT_PUBLIC_BUY_MODE=waitlist` + removes password → merge to main (all gated, NOT done here).
