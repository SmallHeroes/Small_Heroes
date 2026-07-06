# 05 — Launch Checklist (Soft Launch 2026-07-15)

**Last updated:** 2026-07-06
Status legend: ✅ done · 🟡 in progress · 🔴 blocker · ⬜ not started · ❓ NEEDS_REVIEW
This is launch-readiness, not a task list. Every 🔴 must clear or be explicitly descoped by Guy before charging real money.

---

## Website / landing
- 🟡 Landing live, honesty/trust band + hero badge restored.
- ❓ Final copy pass for honest promises (no "in minutes", no likeness-without-photo promise).

## Wizard
- 🟡 Wizard → MVP matrix mapping on `feat/chunked-generation`.
- ✅ Photo fairness (no hard block on skin/brightness; "continue without photo" allowed).
- 🟡 Narration voice selection hardened.
- ❓ Final mobile/summary polish state vs launch bar.

## Story / content
- ✅ 8/18 slots sellable (requires `ENABLE_V3_APPROVED_BANK=true`).
- 🔴 Each shippable slot must be manually QA-approved before fulfillment.
- ❓ Confirm which 8 slots are launch-eligible + their QA status.

## Generation (pipeline)
- ✅ Golden path proven live end-to-end on QA (`POST /api/orders` → chunked gen → bank loader → gates → readiness).
- 🟡 P0 visual-contract slice (fail-closed) — green, UNPUSHED, awaiting Codex round-2.
- 🔴 Visual-contract vNext reconciliation for cross-page consistency.

## Image QA / consistency
- 🔴 **#1 blocker:** full-book consistency (no location leak, no size drift, child likeness, family coherence). 5 known defects from first render.
- ✅ Per-page resemblance gate 0.70 (do not change without approval).
- ✅ Color normalization ON.

## Narration / audio
- 🟡 Fairy voice + per-page MP3 → Supabase working.
- 🔴/❓ Niqqud homograph pass not wired into prod (~16/122 bare). **Decide: fix, or ship audio-optional/muted for soft launch.**

## Viewer
- ✅ read-v2 full-bleed single-page overlay, audio support.
- ❓ Reader polish items vs launch bar.

## Payment / order
- ✅ PayMe primary rail; atomic receipt P1s fixed + verified.
- 🔴 Refund **exactly-once** robustness (PayMe no idempotency key) — Codex-gated.
- ✅ `needs_human_qa` hold prevents auto-fulfillment (proven).

## Emails / messages
- ❓ Order confirmation / ready / failure notifications — status NEEDS_REVIEW.

## Admin visibility
- ❓ QA queue / order status dashboard for Guy during supervised launch — status NEEDS_REVIEW.

## QA environment
- ✅ Separate staging Supabase + Vercel Preview; renders run on deployed staging (not local).

## PROD environment
- 🟡 PROD behind feat branch; cutover needs env vars (`ENABLE_V3_APPROVED_BANK`, ANTHROPIC/readiness flags require **redeploy** to take effect) + green `release-check`.
- 🔴 Confirm PROD env parity before charging.

## Failure states
- 🟡 Generation failure → refund path; QA-reject → parked not redriven (verified).
- ❓ End-to-end failure UX for the customer NEEDS_REVIEW.

## Support / refund path
- 🔴 Manual refund + support contact path for supervised launch — confirm exists.

## Soft-launch readiness
- 🔴 Intake throttle (demand ≤ QA throughput) plan.
- 🔴 Go/no-go: all 🔴 above cleared or descoped by Guy.
