# 0085 · CONSULT (for Codex) · Production rendering architecture + environment topology

**Type:** architecture consult. We're moving from "renders only on Guy's local machine (dev qa-console)" to "real users order → books render in the cloud." Before we build the production rendering environment, we want Codex to pressure-test the architecture + the environment plan. Guy is upgrading Vercel to **Pro** (Hobby's 12-serverless-function cap blocked the deploy; we have 45 functions).

## Where we are (facts)
- **Product:** AI-personalized Hebrew children's storybooks. Per-book = ~16 pages, each an gpt-image-2 render + an approved Stage0 child anchor + cover; plus optional ElevenLabs narration.
- **Production golden path (in code, never run in the cloud yet):** `wizard → POST /api/orders → lib/generation-pipeline/chunk-runner.ts (CHUNKED) → backend/providers/story-bank-loader → image/style gates + world-lock (location-bibles/scene-graph) → Supabase (state + Storage)`. A Vercel **cron** (`/api/generate/cron/sweep`) resumes leased/stale jobs across invocations.
- **Dev/audition path (what we actually run today):** a LOCAL qa-console / `scripts/run-*-gate.ts` on Guy's PC → gpt-image-2 → writes PNGs to local `outputs/`. **Same shared `lib/` code + same `story-bank/` bibles** as prod — so the world-lock work IS production-applicable.
- **Recent engine work (proven on LOW samples):** child+companion identity locks; **world/object identity lock** (per-slot `*.location-bible.json` sceneGraph + RECURRING OBJECT LOCK + post-render World-QA hard-fail). 5/18 slots have full world-lock bibles; bible-authoring is generalizing.
- **Launch posture:** open the marketing site with **BUY_MODE=waitlist** (no real charges, no fulfillment) until render is production-ready. **HIGH render only from a real prod order; everything else (dev/audition/gallery/preview) = LOW.**
- **Constraints/landmines:** Vercel **Hobby→Pro** in progress; one gpt-image HIGH call ≈ 30–60s, 16+ per book ⇒ far exceeds a single function's duration ⇒ the chunked+cron design. PayMe (not Stripe) for payments. Supabase for DB + Storage. Photo-privacy: child photos deleted immediately on completion (+ a sweep backstop).

## Decisions already made (review, don't re-derive)
- Upgrade to Vercel Pro (the only realistic path; 45 functions ≫ 12).
- World-lock lives in shared `lib/` + `story-bank/` (applies to prod).
- Waitlist for launch; HIGH-only-from-prod.
- A 3-tier environment topology (local / staging / prod) — see Q2.

## Questions for Codex

### Q1 — Production rendering compute: Vercel serverless+cron vs a dedicated worker?
Today's design = Vercel Serverless Functions (`/api/generate`, `/api/generate/worker`, 300s cap) + a cron that resumes chunked jobs + Supabase for job state. A 16-page HIGH book ≈ 18–20 image calls ≈ 13–18 min wall-clock, spread across several cron-paced invocations.
- Is **Vercel serverless + chunked + cron** robust enough for LAUNCH volume (low, F&F → early sales)? What are the concrete failure modes (lease expiry races, partial-chunk failures, cron cadence vs Pro limits, function timeout mid-image, concurrency)?
- At what point (volume / reliability bar) should we move generation to a **dedicated background worker / job queue** (e.g., Inngest, QStash, Railway/Render/Fly worker, Supabase queue)? Is it worth doing that BEFORE launch, or is serverless+cron fine for v1 and the worker is a scale-up?
- Recommend a concrete v1 target + a clear "upgrade trigger."

### Q2 — Environment topology (local / staging / prod)
We want a **staging/QA environment** to catch cloud-only issues (the 12-function cap is exactly the class of bug that never shows locally) and to run the dress rehearsal off-prod.
- Proposed: **Vercel Preview environment** (per-branch deploys, Pro) as staging, with **Preview-scoped env vars** pointing to a **separate Supabase staging project** + test API keys + a test BUY_MODE. Local dev stays as-is; Production = main + Supabase-prod.
- Is this the right shape? Pitfalls (Preview deployment protection, env-scope leakage, Supabase branching vs a second project, cron behavior on Preview, cost)? How should secrets + Supabase be separated cleanly so staging can never touch prod customer data?

### Q3 — Chunked/cron robustness (the heart of prod rendering)
Review the chunk-runner + cron-resume design for: idempotency (re-render a page safely), lease/heartbeat correctness, partial-failure recovery, ordering, and the duration budget per invocation (how many HIGH pages per 300s function call is safe). What hardening is mandatory before real orders?

### Q4 — Data + storage prod readiness
Supabase prod: schema/RLS for orders/books/assets, image Storage + retention, the photo-deletion privacy guarantee, and a separate staging DB. What's the minimum bar before taking the first real order?

### Q5 — Dress rehearsal plan
Define the end-to-end dress rehearsal in STAGING (real order → full HIGH render in the cloud → reader delivery → my-books) that must pass before we flip BUY_MODE=live in prod. What are the acceptance gates?

## What we want back
A concrete recommendation on Q1 (serverless+cron vs worker, with a v1 decision + upgrade trigger), a thumbs-up-or-fix on the Q2 environment topology, the mandatory Q3 hardening list, the Q4 minimum bar, and the Q5 dress-rehearsal gates. Flag anything in the chunked/cron design that you'd consider a launch blocker.
