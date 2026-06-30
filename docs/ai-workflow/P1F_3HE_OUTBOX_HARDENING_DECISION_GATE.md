# Decision Gate — P1-f #3h-E outbox hardening

## 1. Proposed change
Correct the migration dependency order, cap the email-provider idempotency retry window below the provider TTL, and separate the Outbox fencing token from the provider-send retry counter.

## 2. Why now?
These are correctness prerequisites discovered in the final review before the invasive P1-f #5 writer wiring. A clean migration can currently fail, an unsafe environment override can permit a resend after provider deduplication expires, and lease/rebind activity can consume the provider retry budget.

## 3. Scope
General delivery-infrastructure fix. No story-, child-, companion-, style-, or page-specific behavior.

## 4. Risk of hardcoding
Low. The safe idempotency ceiling is named and documented against the provider contract; the retry counter is generic delivery state.

## 5. Files likely affected
- `backend/schema.prisma`
- `backend/migrations/20260630_outbox_*`
- `lib/generation-chunked/delivery-outbox.ts`
- readiness/outbox and migration-ordering tests

## 6. Expected behavior after change
- Fresh migrations add Outbox binding columns before enforcing `NOT NULL`.
- An invalid or oversized idempotency-window override cannot exceed the safe 23-hour ceiling.
- Claims/rebinds advance only the fencing token; the six-attempt budget counts possible provider sends.
- The readiness feature flag remains off.

## 7. Validation plan
Run Prisma generation and validation, `npx tsc --noEmit`, focused Outbox/migration tests, and the full test suite. No image, audio, or full-book render.

## 8. Cost impact
No paid generation or provider calls.

## 9. Rollback plan
Revert the single hardening commit while the feature flag remains off. No production data migration is deployed by this task.

## 10. What ChatGPT should review
Confirm that the retry policy remains fail-closed and that provider-send ambiguity never creates a new delivery intent automatically.

## 11. Do not do
Do not wire P1-f #5, touch prompt/image generation, enable `READINESS_MANIFEST_ENABLED`, deploy migrations, send email, or render a book.
