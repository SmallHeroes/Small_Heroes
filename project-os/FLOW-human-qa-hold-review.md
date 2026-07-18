# FLOW — human-QA hold: notify → review → decide → act (end-to-end)

**Why now:** the fox render just held on a real safety hazard (`needs_human_qa`, page 4). The hold system (Stage-1) fires correctly, but there is **no operator loop around it** — no notification, no review surface, no approve/re-render/cancel action, and the customer sees an endless spinner. This is launch-critical for the supervised soft launch: holds WILL happen. This is the "hold-path #3" fully characterized.

## The lifecycle (states already exist; the loop around them does not)
```
generating → [QA gates] → ready → delivered (customer email)
                  │
                  └── HOLD → needs_human_qa  ← we are here, dead-ended
                              hardHoldKind ∈ { safety | contract_world | anchor_low_confidence }
                              deliveryHoldReason = "safety_hold:hazard:page:4:unsupported_at_height|unsafe_pose"
```
`needs_human_qa` + `deliveryHoldReason` + `hardHoldKind` are BUILT. `start.ts` + exception-processor already PARK the book (refuse redrive). Missing = everything that turns a park into a decision.

## The operator loop to build (4 pieces)

### 1) NOTIFY — how you get the info
On entry to `needs_human_qa`, fire an **operator notification** (separate from any customer email):
- **Channel:** email to you (+ optional Slack later). Reuse the outbox/notification infra with a new `operator_review` type.
- **Payload:** order id · child name · direction/companion · `hardHoldKind` · human-readable reason ("page 4 — unsafe pose on the balcony railing") · which page(s) · **deep link to the review console**.
- **Customer in parallel:** the customer must NOT get "ready". They get a held-state message ("הספר שלך בבדיקה אישית — נעדכן במייל בקרוב"), and the `/generating` screen must render the held state instead of spinning forever (the bug you just hit).

### 2) REVIEW — how you see the book + the "deliberations"
An **admin review route** (e.g. `/admin/review/[orderId]`), gated by the site password / admin auth:
- **The whole book** — contact sheet of all pages (like the gallery I built) + reader preview, held page(s) flagged.
- **The deliberations = the layered QA evidence per page** (this is the "התלבטויות"):
  - safety: the `safetyHazards` (`unsupported_at_height`, `unsafe_pose`) + the image.
  - contract_world: the structured contract vs. what vision saw (the diff that failed).
  - anchor: the resemblance/identity confidence.
- So you can look at page 4 and judge: **real hazard → re-render**, or **false positive → release**.

### 3) DECIDE — your options (per hold kind)
| Hold kind | Default action | Also available |
|---|---|---|
| **safety** (child-safety) | **Re-render the page** (get a safe image) | Release only if a confirmed FALSE POSITIVE (audited); Cancel + refund if unfixable |
| **contract_world** (drift) | Re-render, OR Release (accept the drift) | Adjust the contract for that page |
| **anchor_low_confidence** | Release (if the likeness is fine) | Re-render |

**Guardrail:** releasing a **safety** hold is a rare, explicit, **audited** human action (who / when / which hazard overridden) — never a casual button, never automatic. For a real "child on the railing", the answer is re-render, not release. This protects the whole product promise.

### 4) ACT — approve / re-render / cancel (the endpoints Codex told us to build)
Re-port the manual-review release gate idea from `fix/visual-contract-live-wiring@e1ed97f5` onto the current `hardHoldKind` architecture (NOT the whole branch):
- **Re-render page(s):** use the existing `single-page-image-regen` primitive → regenerate the flagged page (optionally with a stronger safety/pose constraint or a new seed) → **re-run safety + contract QA on the new image** → clears the hold if now safe, else re-holds (bounded attempts).
- **Release/Approve:** audited override → book → `ready` → the normal customer delivery email fires.
- **Cancel + Refund:** exactly-once refund (the existing RefundAttempt fence) → customer "couldn't complete" message.
- Every action writes an **audit row** (actor, timestamp, hold reason, decision).

## End-to-end, start to finish
```
render → HOLD (needs_human_qa) → operator email to Guy
   → Guy opens /admin/review/[order] → sees book + page-4 hazard + image
   → Guy decides:
        • Re-render page 4 → new image → auto re-QA → safe? → ready → customer "ready" email
        • Release (false positive, audited) → ready → customer "ready" email
        • Cancel → refund (exactly-once) → customer "couldn't complete" email
   → customer /generating screen reflects "under review" the whole time (never an infinite spinner)
```

## What exists vs. what to build
- **Exists:** `needs_human_qa`, `deliveryHoldReason`, typed `hardHoldKind`, parking (start.ts + exception-processor), `single-page-image-regen`, the outbox/notification infra, the refund fence.
- **Build:** (a) operator-notification on hold; (b) `/admin/review/[orderId]` console (book + per-page QA evidence); (c) release / re-render / cancel endpoints (audited, safety-gated); (d) customer `/generating` "under review" state.
- **[CODEX-GATE]** the release + refund endpoints (money/safety lifecycle) — do not self-certify.

## Decisions for Guy (before I write the briefs)
1. Notification channel for launch: **email only**, or email + Slack?
2. For a **safety** hold specifically — do you ever want a "release/override" button at all during soft launch, or **only re-render / cancel** (safest: no human can ship a flagged-unsafe image; a false positive just gets re-rendered)?
3. Review console: a **new minimal `/admin/review` page**, or extend the existing dev QA console?
4. Priority: this is now **launch-critical** (holds fire in the supervised flow) — slot it before or alongside the payment state machine?
