# BRIEF (CC) — anchor-release: separate AUTHORIZATION from DELIVERY (forward fix on a PUSHED regression)

## 1. ROUTING + TARGET BRANCH
- **Executor:** CC. **Target branch:** `feat/chunked-generation` (worktree `sh-wt-style01`). Branch pre-check first. Single session, ONE agent in this worktree.
- Branch tip = `519b89f4`, **already pushed to origin and deployed to QA**.
- **FORWARD FIX ONLY** — no amend, no rebase, **no force-push**. One new commit on top.
- **Gate: [CODEX-GATE]** — delivery integrity (double-send to a paying customer). Commit locally; STOP. Codex then re-gates `5d9b4068..HEAD` (the three round-3 commits + this fix) as one net effect.

## 2. SCOPE (what + why now)
My round-3 brief said the readiness branch "must pass through it — not around it". Ambiguous — you reasonably read it as *make both paths identical*. I meant: **unify the AUTHORIZATION, keep the per-flag DELIVERY mechanism.** `519b89f4` is correct on authorization and a regression on delivery. My error; you flagged the trade-off explicitly rather than burying it, which is why it was caught before Codex.

`package-delivery.ts:104` states the invariant: **"Flag-on: Manifest + readiness + Outbox only; never a direct email."** `519b89f4` makes anchor-release send a direct email on flag-on. Four protections lost on that path:
1. **Effectively-once delivery** — the Outbox cron sends with `idempotencyKey = dedupeKey`; the route's direct `sendBookReadyEmail` passes **no** idempotencyKey → a customer can be emailed their book twice.
2. **`OutboxReconciliationError` → 409** (`#3h-D`) — a delivery already in flight / delivered / revoked / corrupt required an EXPLICIT redelivery. Nothing checks it now.
3. **Manifest staleness re-eval** — the deleted `B6` comment: *"routes through the readiness path (re-evaluate + Outbox enqueue) instead of a direct send — so a stale book can never be force-shipped past the Manifest."* Staleness (inputs changed since render) is **orthogonal** to the anchor hold being resemblance-only, so the round-3 rationale does not cover it.
4. The stated flag-on invariant itself.

**Why now:** the regression is on the shared launch branch and deployed to QA. Exposure is admin break-glass only (not customer-triggerable) and inert unless `READINESS_MANIFEST_ENABLED === 'true'` on the deployed env — the env var **exists**; its value is being confirmed. **Operational guard until this lands: do not use the anchor-release endpoint on QA.**

**Required shape — keep what `519b89f4` got right; re-split the tail:**
1. **AUTHORIZATION — flag-independent, unchanged from `519b89f4`:** lock `FOR UPDATE` → require the exact unchanged anchor marker → reject any active non-anchor base case or active payment case (**409**) → status+marker CAS → close the anchor case in-tx. Stays exactly as built, both flag states.
2. **DELIVERY — dispatched by flag, AFTER authorization succeeds:** `READINESS_MANIFEST_ENABLED=true` → deliver via `commitBaseBookReadiness` / Outbox, restoring the `OutboxReconciliationError` → 409 handling and the `viaOutbox` response shape. Flag off → the existing direct send.
3. `syncHumanQaHoldCasePostCommit` on **both**.
4. **Design detail to resolve and document:** the authorization CAS already flips the Order to `ready`, and `commitBaseBookReadiness` performs its own transition — do not double-transition, and do not let the readiness path re-derive a decision that contradicts the authorization just granted. If the clean composition is to authorize under lock **without** flipping status and let the readiness path own the transition on flag-on, do that and say so. **If you conclude the two cannot be composed safely, STOP and report — do not resolve it by dropping the Outbox again.**

## 3. FILES / AREAS
- `app/api/admin/anchor-hold-release/route.ts` — **primary**: re-split the tail into authorization (keep) + flag-dispatched delivery (restore).
- `lib/generation-pipeline/readiness-manifest.ts` — `commitBaseBookReadiness` is the flag-on delivery path; compose with it. Do not change its decision logic.
- `lib/generation-pipeline/package-delivery.ts` — **reference only** (the invariant at `:104`). Do not modify.
- `lib/__tests__/anchor-hold-release-isolation.spec.ts` — extend the round-3 parameterized matrix with delivery-channel assertions per flag state.
- `lib/human-qa/sync-hold-case.ts` — post-commit call site; no change expected.

## 4. ACCEPTANCE CRITERIA
- The full adversarial authorization matrix still passes identically under `READINESS_MANIFEST_ENABLED=true` and unset (the round-3 parameterized suite stays green).
- On flag-on: release goes through Manifest/Outbox; **no direct email**; `OutboxReconciliationError` → 409 restored; the invariant at `package-delivery.ts:104` holds.
- On flag-off: behaviour unchanged from today.
- A customer cannot be emailed the same book twice via this endpoint on **either** flag state.
- Hold DECISION outputs and money math still byte-unchanged.

## 5. TESTS
- Flag-on: authorized release enqueues via Outbox and sends **no** direct email; a delivery already in flight → 409, no send.
- Flag-off: authorized release sends directly, exactly once.
- Both: a stronger hold mid-flight → 409 and **no delivery of any kind**.
- Both: repeated release calls deliver exactly once.

## 6. WHAT NOT TO TOUCH
The authorization routine from `519b89f4`; the P0-B reconciler cron/core (`17d1dd0e`, `8f7d254f`); hold DECISION functions; money/coupon math; the board engine; Stage-1 safety semantics. No operator ACTION endpoints (Slice 4).

## 7. GIT HYGIENE
Explicit pathspecs; **NEVER `git add -A`** (CRLF churn landmine); **no force-push, no rebase** — one new commit on top of `519b89f4` on `feat/chunked-generation`; commit locally, **Guy pushes**.

## 8. FINAL VERIFICATION
`npm run check` green (tsc via node; full vitest, ≥2047). Report: the §2.4 composition decision explicitly, the per-flag delivery proof, and the byte-unchanged proof for decisions/money. **Then STOP for the Codex re-gate of `5d9b4068..HEAD`.**
