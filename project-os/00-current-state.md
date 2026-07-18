# 00 — Current State

**Last updated:** 2026-07-13
**Maintained by:** Claude Cowork (Project Operator)
**Source-of-truth note:** This file is the reasoning/state snapshot. ClickUp remains the task tracker. Repo landmarks: `SMALL_HEROES_PROJECT_BIBLE.md`, `docs/ai-workflow/`, latest `cc-checkpoint-*-for-codex.md`.

---

## MVP status (headline)
Pre-launch, engine-hardening phase. **Not yet sellable at target quality.** Launch target **2026-08-01** (moved from 07-15 per Guy 2026-07-02 — to build the visual-contract engine right; soft launch, Cursor + Guy only, real payment, ~50% launch discount). Binding constraint = story throughput × Guy's manual QA gate. Current focus is closing the **visual-contract engine** so full-book renders are consistent enough to sell.

## Current sprint focus
- **P0 visual-contract slice — round-2 fixes IMPLEMENTED + pushed (`32dcfe3a`, 2026-07-06).** Claude Code closed the 3 Codex fail-open seams (validate-before-freeze + belt at the fence; hardened discriminant dispatch; Resolved validator now enforces Template invariants independently). `materializeContract.ts` untouched → payload/hash byte-identical (validation gates only). `npm run check` green **1333 pass / 15 skip** (+6 negative tests). **Codex round-3 = PASS (2026-07-06)** — all 3 seams confirmed closed, no hash regression. **DEC-002 accepted; P1 authorized.** Fail mode = degrade-to-legacy (hard render block is P1/OQ-T5, untouched).
- Slice is pushed on `origin/feat/chunked-generation` (@ `32dcfe3a`) — feat branch only, **not main/prod**, no customer impact.
- Reconcile toward **BookVisualContract vNext** as single source of truth (LocationBible/registry/QA become projections). ~70% built but stranded across branches — reconcile+complete, do **not** blind-rebase.

## Product status
Personalized Hebrew children's book. Flow: wizard (child details, theme) → story (Hebrew) → storyboard → illustrations (gpt-image-2; Flux/Replicate legacy) → web reader → order/payment. Golden path is defined and asserted (see `05-launch-checklist`). Quality bar (Guy): must feel like a real printed book, child is the active hero, visual consistency across pages. **NEEDS_REVIEW:** exact wizard→matrix mapping current on `feat/chunked-generation`.

## Technical status
- **Branch:** `feat/chunked-generation` (HEAD `0513dc94`). Recent: restore landing hero badge, harden narration voice selection, reject collapsed palette seeds, P0 visual-contract fail-closed fixes.
- **Stability contract:** `npm run check` (tsc --noEmit + vitest). `npm run release-check` requires `ENABLE_V3_APPROVED_BANK=true`. `npm run lint` is an honest skip (real ESLint deferred post-launch).
- **Repo landmines:** EOL/CRLF churn (stage explicit pathspecs, **NEVER `git add -A`**); `docs/` is gitignored (needs `git add -f`); run tsc before every commit; commit per green milestone.
- **Cowork edit-sync caveat:** Claude Cowork Write/Edit may not reliably reach Guy's Windows working tree — commit-bound code/asset changes route through Cursor with exact diffs; verify `git status` staged.

## Story / content status
- 10/10 golden books done; companion roster LOCKED at 30 (10 wizard cats ×3 directions).
- Matrix: **8/18 slots sellable** with `ENABLE_V3_APPROVED_BANK=true` (without it, 6/18 — v3 slots unsellable). Bank routing via `STORY_BANK_V3_DIR` (defaults `v5-fixed-v2`). Manual review mandatory before production.
- Page-count rule locked: bedtime=8 / adventure=12 / fantasy=16 beats, displayed ×2 physical pages. Pricing launch = ₪59 / ₪79 / ₪99.

## Viewer status
`read-v2` single-page overlay, full-bleed, Heebo+Arimo, dark text, audio support. Reader-as-book direction (text on image, full bleed) is the intended UX. **NEEDS_REVIEW:** open reader polish items vs launch bar.

## Audio / narration status
Fairy voice `piI8Kku0DcvcL6TTSeQt` (eleven_v3/he), per-page MP3 → Supabase. **Known gap:** homograph niqqud pass `applyTtsAmbiguityNiqqudPass` NOT wired into prod narration (~16/122 bank files bare). Narration expression tags ([sneeze]/[giggles]) are intentional. Narration likely **deferrable** for soft launch — see `07-qa-gates`.

## Payment / order status
**PayMe = primary rail** for MVP (Israel); Stripe later for international. Golden path: `POST /api/orders` (`resolveStoryProductTruth` + matrix assert) → chunked generation → story-bank-loader → image/style gates → readiness. Atomic receipt / fulfillment launch-gate: 2 P1s fixed & verified (`0210d390`, `36aebe9b`). **PayMe risk:** no idempotency key + uncertain read-after-write → refund exactly-once is fragile (prior confirmed P1 double-refund). Money code = Codex is the gate, never self-certify.

## QA / PROD status
Staging env built: separate staging Supabase + Vercel Preview env scoped per-env. Login blockers documented. Real renders must run on **deployed staging (qa)**, not Cowork/CC local (no local `.env`). First full book rendered end-to-end on deployed QA (order `cmr3lg9tu`) — pipeline + readiness **proven live**, correctly held `needs_human_qa`. PROD runs behind feat branch; cutover requires env vars + release-check.

## Recently completed important work
- P0 visual-contract fail-closed fixes (Codex round-1 HOLD gaps closed).
- Atomic receipt P1 fixes (double-refund / QA-held redrive) fixed + verified.
- First full-book render on deployed QA (proved pipeline + readiness gate).
- Wizard narration voice hardening; landing honesty/trust band.

## Current blockers (see 06-risk-register)
1. Visual consistency across a full book (location leak, size drift, family/child likeness) — **the #1 sellability blocker.**
2. P0 slice: **Codex round-3 PASS (`32dcfe3a`)** — fail-closed at freeze. **P1/OQ-T5 (hard render block) is now the launch-gating engine work** (brief sent to Claude Code; enforcement flag-gated, default OFF prod).
3. PayMe refund exactly-once robustness.
4. Throughput × Guy-QA is the launch rate-limiter.

## Known risks (top)
Demand outrunning QA throughput at soft launch; money-path edge cases under-caught by non-Codex review; scope creep on engine work delaying 07-15; narration niqqud gap surfacing in shipped audio.
