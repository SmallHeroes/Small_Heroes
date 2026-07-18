# NEXT ACTIONS — resume point (updated 2026-07-17, evening pickup)

## WHERE EACH WORKSTREAM STANDS

### 1. Set consistency (Set Identity Board) — the mandatory #1, nearly proven
- Engine A+B+C + fixes = COMPLETE, Codex-cleared on all dangerous parts (resume/integrity/byte-identity/fail-closed). On `feat/chunked-generation`.
- Fox contract = window + balcony DOOR, **two distinct openings** (`9a27ec57`) — reversed the earlier "no door" call on render evidence (the inside→outside transition is physically a door).
- **Fox board MINTED + APPROVED** (`aaa469af` / image sha `30392c03`, Guy-approved) — passed QA (no panels/text/hybrid). First locked set. Registry entry committed (`eff856a1`, pushed).
- ⛔ **BLOCKER: the board did NOT bind on the first render** (order יובל `cmrotklax` → no snapshot, dna→cover, legacy). Cause = **`SET_IDENTITY_BOARD=true` not active on Vercel Preview**. An order without a snapshot is legacy-for-life → need a FRESH order after the flag.
  - **Unblock:** Guy sets `SET_IDENTITY_BOARD=true` on Preview → Cowork triggers redeploy via connector → Guy creates a fresh fox order on qa → **Cowork verifies the bind in the DB** (snapshot + set_refs + aaa469af/30392c03) → then eyeball 12 pages for set consistency.
  - Cost-safe: `GPT_IMAGE_QUALITY` unset → LOW by default; just don't set it to `high` on Preview.

### 2. Human-QA hold flow — SPECCED, NOT BUILT (a real risk right now)
- A held book (`needs_human_qa`) currently parks SILENTLY — no operator email, no review console. Guy would not know (already happened: cmrnuhsva railing safety-hold sat silently).
- Design DONE: `FLOW-human-qa-hold-review.md` + Codex binding ruling (4 slices: 1 lifecycle foundation, 2 read console, 3 durable re-render, 4 [CODEX-GATE] actions; safety holds = re-render/cancel only, no override).
- **Interim: Cowork is the notifier** — checks staging DB for held orders on demand / watches active renders.
- Queued right after set-consistency. Slice 1 = `HumanQaReviewCase` + operator-notification Outbox + customer `under_review`.

### 3. Branch consolidation — Cowork's job (Guy called it out 07-17)
- Board/contract/money/safety all on `feat/chunked-generation` (the pipeline). Generating-screen redesign + OTP on `feat/otp-email-redesign` (separate) → staging lacked the new UI.
- **Brief ready:** `BRIEF-cc-consolidate-otp-into-chunked.md` — port OTP/UI onto `feat/chunked-generation`, then FF `main`. Route to CC.

### 4. Money / launch blockers (from the 07-15 Codex audit) — still open, parked behind set-consistency
- Payment state machine (Codex-designed, NOT built) — B decision: first F&F batch = manual/comped orders; build payment in parallel.
- Coupon race fix + pricing truth: money port done (`02074a23`) but coupon activation is NO-GO until the payment state machine lands.
- Product-truth copy scrub (video/print post-MVP).

## EVENING PICKUP — Cowork "make order" agenda
1. Get the board actually binding (flag → redeploy → fresh order → verify) and eyeball the 12-page consistency proof.
2. Route the consolidation brief; get to ONE current pipeline.
3. Start the human-QA flow (slice 1) so holds stop being silent.
4. Full status sweep: reconcile all commits pushed/unpushed on `feat/chunked-generation`; confirm nothing stranded.
