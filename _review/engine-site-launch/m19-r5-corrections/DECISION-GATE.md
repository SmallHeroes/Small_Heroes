# M19 — R5 money-visibility correction, USD0

## Intake / authority / topology
Guy forwarded the completed Claude Code R5 HOLD and required M19 corrective handoff. This continues the approved local USD0 engineering loop, with manual review routing through Guy. Same sole Codex task, worktree C:/GNart/Work/sh-engine-site-launch, branch codex/engine-site-launch-20261104, base/HEAD 36bd62daf98cc73c1b3e49a2f3c3b23548d4bddd. No other active source writer or reviewer; persistent Claude parent/broker are idle, and R5 READY records reviewer exit. Intake re-hashed R5's final11 files and M18's99 pins/321 evidence. Index empty. Cumulative uncommitted owner-recovery workflow remains in effect.

## Observed / expected / root cause
R4 cleanup deliberately closes obsolete checkout-attempt proof notices once an order advances. It also suppresses a different provider-confirmed paid sale with a wrong amount/currency. The strict verifier correctly refuses that payment, but automatic extra-capture refund needs a fully verified receipt, so neither path preserves an operator signal. Expected: a server-confirmed, exact-sale/exact-order paid mismatch for a non-primary sale remains a separate audited operator-required notice on every order status. It cannot approve, refund, revive or demote an order, and cannot be closed by settlement/read/terminal cleanup.

## General solution / boundaries
First reproduce through the real signed webhook, actual verifier and PGlite PostgreSQL plus operator read path. Add explicit paid-mismatch evidence derived only from the independent get-sales reply, not callback/browser fields. Require exact sale and order binding; retain raw-evidence digest and safe normalized observed values. Separate `engine_site_payment_capture_notice/` scope from primary-attempt proof notices AND from automatically refundable `engine_site_extra_payment/` cases. Reuse the authenticated exact-notice/digest/reason/idempotency dismiss path. Keep existing primary cleanup and exact verified extra-capture refund behavior.

Cheap related corrections: require queried sale id before any definitive proof-refusal notice (R5 P3-6 sale identity), fix stable-host/drain wording and add free self-chain smoke precondition (P3-2/4), and remove only a verified owned native extraction directory on ENOENT rebuild (P3-8 leak). If these introduce wider changes, retain as disclosed debt rather than expand. Other P3s remain explicit qualification/backlog.

## Files / work order / acceptance
1. New regression spec, existing payment/return/operator controls; RED proof first.
2. lib/payme.ts; signed webhook caller; payment-proof-alert; reuse existing operator handlers/UI without relaxing auth; native-media resolver + synthetic filesystem test; runbook.
3. Positive/negative: all order statuses, replay, pending/primary/foreign/ambiguous/nonpaid, signed vs unsigned, read/settlement/terminal cleanup, dismiss exact actor/digest/reason, no order/PaymentRecord/refund changes. Existing verified extra refund still works. Native archive/peer tamper still refuses; only owned dead cache dir removed.
4. Full same73-file relevant gate plus new spec; both Node-direct TS gates; preserved historical321/R17 279, fixed rules/assets/build config and old QA. No full npm check claimed green; prior failures retained. Existing Linux full build is baseline only; no fresh full build unless justified by changed packaging/dependencies.
5. Freeze new cumulative owner recovery package; inspection-only/fake-Git safety controls; final hashes and writer release; manual Claude R6 handoff. No self-awarded independent PASS.

## Risks / rejected alternatives / rollback
Main risk is confusing unverified amount evidence with refundable money authority. No new refund receipt/action, no raw receipt promotion, and separate manual-only scope avoid it. Do not waive verification, reuse the auto-refund scope, or leave every old checkout notice open. Existing callbacks, renewals, status/retry/price/quality/cost/flags remain unchanged. No schema migration/dependency install. Rollback source changes only from exact prior M18 pins under sole-writer authority; no resets or rewriting historical packages. Preserve every failure and old package.

## Stop-check
General system fix, not a story patch. Production payment-notice behavior changes locally, no production execution. USD0, provider0, no image/audio/book/payment call. Minimal proof is synthetic signed callback + PGlite + read endpoint. No new product decision required for accurate visibility; any broader money/UX decision returns to Guy. Claude independently falsifies authority/binding/cleanup/idempotency/legacy preservation. Guy's future live-staging/product/paid approval remains separate.

## Do not do
No real .env/key read, provider/service/remote SQL, server or new book, actual project index/commit, push/merge/deploy, automatic Claude transfer, other-worktree write, dependency install, historical cleanup or gate/budget enlargement. Native resolver cleanup is limited to its own verified temporary extraction and is not repository cleanup.
