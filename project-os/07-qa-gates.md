# 07 — QA Gates

> Superseded as the active gate set by root `QUALITY_GATES.md` on 2026-07-22. Retained as historical product/launch context.

**Last updated:** 2026-07-06
No customer book ships without passing every applicable gate. Gates are layered — vision alone is never the source of truth (story/pageAction → approved seed / LocationBible / SetTopology → set-plate vision → rendered-page vision → human approval). Guy is the final eyeball on quality; Codex is the gate on money/technical.

---

## G1 — Story / content approved
- **Checks:** child is active hero + makes a meaningful choice; real child-native humor; per-page visual value; setup/payoff; companion doesn't emotionally disappear; non-cheap ending; re-readable; no moralizing/worksheet feel. Hebrew correct (niqqud where needed).
- **Owner:** Guy · **Reviewer:** ChatGPT
- **Pass:** Guy approves slot as launch-eligible.
- **Blockers:** manual review mandatory before production; generic/AI-ish story fails even if cute.

## G2 — Full-book generation approved
- **Checks:** golden path only; matrix assert passes; `ENABLE_V3_APPROVED_BANK=true`; page-only/5-page sample eyeballed before full render.
- **Owner:** Guy · **Reviewer:** Codex (pipeline) 
- **Pass:** sample eyeballed + Guy approves full render. **No full render without explicit approval.**

## G3 — Image consistency approved (#1 gate)
- **Checks:** same child / companion / clothing / room / key objects / lighting across pages; no location leak; no character size drift; per-page resemblance ≥ **0.70** (do not change threshold without approval); family coherence with child ethnicity.
- **Owner:** Guy · **Reviewer:** ChatGPT + vNext QA projection
- **Pass:** Guy eyeball PASS on the full book. LOW audition → review → targeted fix → HIGH → final eyeball.
- **Blockers:** 5 known defects (location leak, bunny size drift, doctor gender flip, mom hair drift, weak child likeness) must be resolved via vNext, not per-story patches.

## G4 — Viewer approved
- **Checks:** full-bleed pages, text-on-image legibility, typography, audio playback, mobile.
- **Owner:** Guy · **Reviewer:** Cursor (impl) → Guy
- **Pass:** Guy approves reader on a real book.

## G5 — Audio / narration approved OR deferred
- **Checks:** per-page MP3 present, correct fairy voice, niqqud homograph pass applied.
- **Owner:** Guy
- **Pass:** either niqqud pass wired into prod + spot-checked, **or** Guy explicitly defers audio (ship audio-optional/muted) for soft launch.
- **Blockers:** `applyTtsAmbiguityNiqqudPass` not in prod narration (~16/122 bare).

## G6 — Payment / order lifecycle approved
- **Checks:** charge → generate → QA-hold → fulfill/refund; refund **exactly-once both directions**; `needs_human_qa` never auto-fulfilled or auto-redriven; atomic receipt coverage.
- **Owner:** Guy · **Reviewer:** **Codex (mandatory gate)**
- **Pass:** Codex PASS (file:line-cited) on any money-path change. Never self-certify.

## G7 — QA / PROD separation approved
- **Checks:** staging Supabase/env separate from PROD; renders run on deployed staging; PROD env vars set + redeployed (flags take effect only after redeploy); `release-check` green.
- **Owner:** Guy · **Reviewer:** Codex
- **Pass:** PROD env parity confirmed before charging real money.

## G8 — Failure states approved
- **Checks:** generation failure → refund; QA-reject → parked (not redriven); customer-facing failure UX; support/refund path exists.
- **Owner:** Guy · **Reviewer:** Codex (refund path)
- **Pass:** each failure path exercised once on staging.

## G9 — Soft launch approved (go/no-go)
- **Checks:** all launch-checklist 🔴 cleared or explicitly descoped; intake throttle in place; ≥8 slots QA-approved; Guy sign-off.
- **Owner:** Guy
- **Pass:** Guy go decision.

---

**Stability contract (every commit):** `npm run check` (tsc --noEmit + vitest) green. **Release:** `npm run release-check` green with `ENABLE_V3_APPROVED_BANK=true`.
