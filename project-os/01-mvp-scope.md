# 01 — MVP Scope

**Last updated:** 2026-07-06
**Target:** Soft launch 2026-07-15 (Cursor + Guy supervised, real payment, ~50% launch discount).
**Governing principle (Guy):** Quality > speed. A book must feel like a real printed children's book, not a set of pretty AI images. If a decision does not serve "sellable, emotionally strong, visually consistent book," challenge it.

---

## Must-have for MVP (launch blockers)
- Working wizard → order → generation → reader → payment happy path on PROD (golden path only).
- **Visual consistency** good enough to sell: same child, companion, location, and key objects across a full book. No location leak, no character size drift.
- At least the **8/18 sellable slots** (with `ENABLE_V3_APPROVED_BANK=true`), each manually QA-approved before fulfillment.
- Full-bleed book-style reader (text on image).
- PayMe charge + **refund exactly-once** on failure/QA-reject.
- `needs_human_qa` hold path working (no auto-fulfillment of unreviewed books) — proven live.
- Order/failure states + a manual refund/support path.
- Honest product copy (no "in minutes" promise; no visual-resemblance promise without a photo; state limitations when no child photo).

## Should-have if fast (pre-launch polish, not blocking)
- Narration/audio on shippable books (deferrable if niqqud gap unresolved — ship muted or audio-optional).
- Reader micro-polish (typography, transitions).
- Admin visibility into order/QA queue.
- More than 8 sellable slots.

## Explicit post-MVP
- Style02 to customers (gated — not sellable yet).
- Printable / physical product; Power Card fridge-magnet add-on.
- International (Stripe rail, non-Hebrew).
- Full automation of QA (only after reliability proven).
- LoRA / advanced style-consistency upgrades beyond vNext.
- Marketing scale beyond the "first 30 families" organic pilot.

## Not doing before launch
- No full render runs without explicit approval (page-only / 5-page sample first, eyeballed).
- No opening Style02 to customers.
- No photo gate that hard-blocks a child on skin tone / brightness / sharpness / face area (soft warning only; always allow "continue without photo").
- No story-specific patches passed off as product solutions.
- No moving to HIGH / matrix-flip / production because a LOW run looked beautiful.

## Sellable MVP promise (what the customer receives)
A personalized Hebrew storybook where their child is the named, active hero of an emotionally meaningful story, illustrated with a consistent character and world, readable full-bleed in the web reader, delivered after human QA. Optional child photo improves likeness; without it, the book is still personalized (name/traits/theme) with a stated likeness limitation.

## What is NOT promised yet
Instant/"minutes" delivery; photo-accurate likeness without a photo; audio narration on every book; physical/printed copy; Style02; non-Hebrew.

## Hard scope boundaries
- Golden path is the ONLY customer path. Dev/experiment pipelines (`lib/story-generator/*`, `lib/story-gen-v2/*`, `lib/story-gen-v3/*` writers-room, `app/api/debug/*`) stay dev-only.
- Any change to what the customer receives = written proposal + owner approval (+ Codex if technical). See `02-decision-log` / `03-agent-roles`.
