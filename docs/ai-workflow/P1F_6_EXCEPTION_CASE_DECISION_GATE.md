# Decision Gate — P1-f #6 ExceptionCase consumer

## 1. Proposed change
Add a durable, autonomous recovery state machine for reachable `base_book` delivery failures. Terminal Outbox/readiness/generation failures open one active `ExceptionCase`; a fenced cron processor reconciles email delivery, repairs safe pre-send corruption, performs bounded generation/readiness retries, and carries refund obligations until the payment provider confirms them.

## 2. Why now?
The readiness pipeline classifies terminal failures but does not act on them. Enabling the Manifest flag without a recovery consumer would silently strand books or financial obligations.

## 3. Scope
General `base_book` delivery recovery only. Reachable Phase-1 producers are Outbox terminals, integrity blocks, and failed generation jobs. Future Phase-3 kinds remain representable but are not falsely advertised as complete workflows.

## 4. Risk of hardcoding
Kinds, transitions, retry ceilings, and provider adapters are generic. No story, child, companion, page, or style-specific rules.

## 5. Files likely affected
- `backend/schema.prisma` + additive migration
- `lib/generation-chunked/exception-case.ts`
- `lib/generation-chunked/exception-processor.ts`
- `lib/payment-refunds.ts`, `lib/payme.ts`, `backend/lib/email.ts`
- `lib/generation-chunked/delivery-outbox.ts`
- `lib/generation-pipeline/readiness-manifest.ts`
- generation failure writers
- `app/api/generate/cron/exceptions/route.ts`
- `vercel.json`
- provider email/payment modules and tests

## 6. Ratified contract amendments
- One active case is enforced by a nullable unique `activeKey` plus a database CHECK tying it to active statuses. Every transition has a separate immutable audit row.
- Processor concurrency uses a lease and monotonic claim token; all writes are fenced.
- Generation/readiness retries are bounded. Exhaustion becomes `refund_pending`.
- A refund is a durable liability: provider outages never auto-resolve or silently cancel it. Calls use capped backoff until provider-confirmed success or a provider-confirmed non-refundable terminal result.
- Resend reconciliation:
  - with `providerMessageId`, query the provider;
  - without it, replay the exact payload/key only while the provider's idempotency window is safely live, solely to recover the message ID;
  - after the window, never resend; route to refund.
  - provider-confirmed failure may create exactly one explicit new fulfillment intent (new version/key), atomically with retiring the ambiguous source and resolving its case.
- `invalid_payload` with `sendAttempted=false` is explicitly rebuilt/rebound under the same delivery intent. It is never blindly revived after a possible send.
- Stripe refunds use provider idempotency keys.
- PayMe exposes no idempotency-key field on `refund-sale`; use query-before/query-after and full-refund remaining-balance semantics. A real sandbox crash/retry proof is mandatory in #7 before flag-on.
- `unusable_photo` customer-action is not reachable in Phase 1 and no secure same-order replacement-photo flow exists. If accidentally produced, fail closed to refund; Phase 3 owns the real replacement-photo workflow.
- Provider-confirmed `send_ambiguous` resolution updates the Outbox and ExceptionCase in one transaction. A crash cannot leave a sent row whose still-open case later refunds it.
- Pre-send payload repair is crash-idempotent: a committed repair is recognized on replay rather than misclassified as non-repairable.
- Historical terminal sources are consumed once; the safety-net scanner cannot reopen a resolved case for the same incident.
- A refund/reconciliation action outranks a later readiness PASS. Readiness never enqueues a book while an active external-action case exists, preventing deliver-and-refund races.

## 7. Validation plan
Unit and concurrency tests for producer idempotency, audit atomicity, fencing, no-blind-resend, bounded retry, provider refund reconciliation, and flag-off no-op. Add opt-in real staging tests for Supavisor claims, Resend lookup/replay, Stripe test refunds, and PayMe sandbox query/refund/query. No provider call runs in the default suite.

## 8. Cost impact
Zero renders and zero default-suite provider calls. Staging financial/email probes require explicit opt-in during #7.

## 9. Rollback plan
Keep `READINESS_MANIFEST_ENABLED=false`, remove the cron registration, and revert the additive code/schema commit. Existing rows remain inert.

## 10. What Claude should review
No-double-anything traces, PayMe ambiguity handling, refund-liability semantics, and whether any future failure kind is accidentally treated as currently reachable.

## 11. Do not do
- Do not enable the readiness flag.
- Do not render images/audio/books.
- Do not blind-resend after a provider idempotency window.
- Do not mark an unconfirmed refund resolved.
- Do not invent a photo-replacement flow in this phase.
