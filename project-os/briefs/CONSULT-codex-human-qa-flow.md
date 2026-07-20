# CODEX CONSULT — human-QA hold flow + operator UX (notify → review → decide → act)

## 1. ROUTING + TARGET
- **Reviewer:** Codex (design + lifecycle-safety review). **Mode:** read-only over the existing hold primitives on `feat/chunked-generation` (`needs_human_qa`, `deliveryHoldReason`, `hardHoldKind`, `start.ts`, exception-processor, `single-page-image-regen`, the outbox/notification infra, the RefundAttempt fence) + the proposed flow; cite `files:lines`.
- **Gate type:** design consult; the release/re-render/refund endpoints will be **[CODEX-GATE]** money/safety-lifecycle when built. Full proposed flow = `project-os/FLOW-human-qa-hold-review.md` (read it).

## 2. ORIGIN / CONTEXT
The hold system just FIRED on a real render (fox, `needs_human_qa`, `safety_hold:hazard:page:4:unsupported_at_height|unsafe_pose`) — and page 4 was a **FALSE POSITIVE** (child kneels safely on the floor by the railing). The parking works (fail-closed, correct), but there is **no operator loop**: no notification to Guy, no review console, no release/re-render/cancel action, and the customer sees an infinite "generating" spinner. This must be closed before the supervised soft launch (holds WILL fire). During soft launch, **Guy IS the operator/reviewer**.

## 3. PROPOSED FLOW (harden it — see FLOW doc for detail)
1. **NOTIFY** — on entry to `needs_human_qa`, fire an OPERATOR email (order, child, `hardHoldKind`, human-readable reason, page, deep link) — separate from any customer email; customer gets an "under review" state, not "ready".
2. **REVIEW** — an admin route `/admin/review/[orderId]` (site-password/admin-gated) showing the whole book + the per-page QA evidence ("deliberations": safetyHazards / contract-world diff / anchor confidence).
3. **DECIDE** — per hold kind: safety → default **re-render** (release only for confirmed false-positive, audited); contract_world → re-render / release; anchor → release / re-render; unfixable → cancel + refund.
4. **ACT** — release / re-render (via `single-page-image-regen`, then re-run safety+contract QA) / cancel+refund — each **audited** (actor/time/reason/decision). Re-port the manual-review release-gate IDEA from `fix/visual-contract-live-wiring@e1ed97f5` onto the current `hardHoldKind` arch (NOT the whole branch).

## 4. QUESTIONS FOR CODEX (rule on each)
1. **The central safety question:** should a "release/override" button exist for a **safety** hold at all during soft launch, or **re-render-only + cancel** (no human can ship a flagged-unsafe image; a false-positive just gets re-rendered)? The fox page-4 false-positive is the motivating case — weigh false-positive friction vs. the risk of a human waving through a genuinely unsafe child image. Give the safe default.
2. **Endpoint lifecycle safety:** for release / re-render / cancel — what are the fail-closed invariants? (re-render must re-run QA before clearing; release must be audited + never auto; cancel must refund exactly-once via the existing fence; an in-flight order can't be double-actioned.)
3. **State machine:** is `needs_human_qa` + `deliveryHoldReason` + `hardHoldKind` enough, or do we need an explicit review-decision state (e.g. `under_review → released|re_rendering|cancelled`) to make the operator actions atomic and idempotent?
4. **Notification split:** operator vs. customer — reuse the outbox, or a separate channel? How to avoid the customer getting a premature/である "ready" while held.
5. **False-positive calibration:** where should the page-4-class over-sensitivity be tuned (the safety evaluator) so safe "near-railing" poses don't hold — without weakening real hazard detection?
6. **UX sufficiency (operator loop):** is the proposed review surface enough for Guy to (a) get informed, (b) see the deliberations, (c) approve, (d) re-render — or what's missing? (Note: the visual/UI polish of the console is a separate ChatGPT pass; this consult is the flow correctness + safety.)

## 5. CONSTRAINTS
Fail-closed on safety · every state-changing action audited · exactly-once refund both directions · reuse existing primitives (don't rebuild the hold system) · works for the supervised single-operator (Guy) model first.

## 6. OUTPUT
Harden the flow; rule on the safety-release question (Q1) and the endpoint invariants (Q2); specify whether an explicit review-decision state is needed (Q3); name the endpoints + their safety contracts; flag anything missing. This becomes the implementation brief(s).
