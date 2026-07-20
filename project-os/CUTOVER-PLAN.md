# PRODUCTION SETUP — clean build (supersedes the reconciliation-bridge plan, 2026-07-20)

## Why this replaced the previous plan
The previous plan was built on a false premise **introduced by Cowork**: it measured 244 orders / 190 books / 70 payment records in the `ozxjmnzybzetqudivlbw` project and framed them as *live production data at risk*, then designed a Reconciliation Bridge, a nine-dimension equality proof, two clone rehearsals, and a quarantine to preserve them. **Nobody ever asked whether that data was real.** Codex approved the plan on the numbers Cowork supplied.

**Verified 2026-07-20, confirmed by Guy:**
- The project has **never been live**. Orders stop at **2026-06-18** — the exact day the staging project was created. It was the original *development* database, later labelled production.
- **No customer payment has ever occurred.** 67 payment records use provider `fake` (test books). 2 Stripe records (₪158, 2026-04-22) are self-tests — and Stripe is not the rail for Israel; PayMe is.
- **No book needs to remain accessible.** Everything of value was rendered on QA.

There is therefore nothing to migrate, reconcile, baseline against, or quarantine. **The correct action is to build production clean.**

## What was wasted, and what survives
**Dead:** the bridge (`build-bridge`), the quarantine design + script, the migration-history archaeology (the coupon 25%→50% restore), and the two clone rehearsals.

**Survives — and is unaffected, because it is product code, not data plumbing:**
- The **delivery fence** (`deliveryFenceVersion`, the `order-authority.ts` funnel, marker precedence, the ship/hold/release CAS, receipt keying, the Outbox fence). Six Codex rounds found real P0s here — automatic shipping of an unsafe book, double email, a force-ship window on the path every book takes. All would have been live bugs the moment a real customer ordered.
- **Human-QA Slice 1** — review case, operator notification, customer `under_review`, the scheduled reconciler.
- The **structural funnel guard** — the build fails if any authority write bypasses the funnel.
- The **real-Postgres harness** (21 tests, fail-closed).
- The **child-photo deletion fix** — cleanup never ran on order failure; a genuine leak for future customers.
- **Security**: Data API disabled; the held RLS/grants migration; the private-bucket + signed-URL work.
- The **schema-equality checker** — built for the bridge, but permanently useful for proving environment parity and catching drift.
- The **baseline migration** (Track-2 P0-1) — now the critical path.

## Region decision
`vercel.json` pins **no region**, so functions run in Vercel's default (Virginia) while the old database sits in **Tokyo** — every query crossing the Pacific, dozens per book. Never noticed because production never ran.

**What matters is database-to-function proximity, not database-to-user**: the user makes one request; the pipeline makes dozens of round trips inside it.

**Decision: Frankfurt for both.** New Supabase project in `eu-central-1`; pin `"regions": ["fra1"]` in `vercel.json`. Closest major region to Israel (~50ms to users), database adjacent to the functions, and correctly positioned for the later international opening.

**Accepted divergence:** staging stays in `us-east-1` for now. This is **correctness-neutral** — same Postgres, same schema, latency only — unlike the `READINESS_MANIFEST_ENABLED` split, which changed code paths. Move staging after launch.

## Steps

**1. Baseline migration.** The canonical chain cannot deploy from an empty database — the first migration only ALTERs an existing enum and the second runs `UPDATE "Order"`. An initial migration is required. *Owner: CC. This is the only surviving piece of Track 2 and it blocks everything below.*

**2. New Supabase project in `eu-central-1`.** *Owner: Guy. Cowork verifies.*

**3. Deploy the chain from empty**, then prove the result with `assert-schema-equality` against a freshly built reference. *Owner: CC + Cowork.*

**4. Point production at it** — `"regions": ["fra1"]` in `vercel.json`; update the Production environment variables in Vercel (database URL, Supabase URL, service key). PayMe / Resend / OpenAI / Replicate keys are unchanged and Guy holds them.

**5. Retire the old project** — pause, keep as a backup for a month, then delete. The 14 residual dev child-photos go with it; no separate cleanup needed.

**6. One canary order** end-to-end in the new production: render → safety → readiness → Outbox → CAS → exactly one email.

## Still open, unchanged by this
- Human-QA console (Slice 2, Cursor) and operator actions (Slices 3+4, briefed).
- Unit 1b: the private-bucket write/read flip, needing a real signing test and wizard-repo coordination.
- The held RLS/grants migration.
- The Set Identity Board proof.
