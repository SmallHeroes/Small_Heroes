# Decision Gate — P1-f #5 writer contract and package wiring

## 1. Proposed change
Make every base-book delivery-input mutation participate in one transactional write barrier:
content mutation + `Order.inputVersion` increment + current-readiness invalidation + removal from `ready` when the readiness feature is enabled. Freeze story product truth at order creation/text finalization, and replace the flag-on package completion path with `commitBaseBookReadiness`.

## 2. Why now?
The send-time CAS is only meaningful when every writer advances the version it verifies. Without this step, a changed book can retain an old passed Manifest. This is the last invasive prerequisite before storage/integration proof and flag-on.

## 3. Scope
General production-flow infrastructure. Covers base-book text, cover/page assets, page audio used by the email payload, PDF/read URL payload fields, page regeneration, and image clearing. No story-, child-, companion-, style-, or page-specific patch.

## 4. Risk of hardcoding
The mutation barrier and frozen-truth builder are generic. Writer reasons are stable categories, not story/page identifiers. Story identity is a normalized repo-relative path plus SHA-256 of the exact source file.

## 5. Files likely affected
- `app/api/orders/route.ts`
- `lib/generation-pipeline/readiness-manifest.ts`
- `lib/generation-pipeline/text-finalization.ts`
- `lib/generation-pipeline/chunk-runner.ts`
- `lib/generation-pipeline/package-delivery.ts` (new)
- `lib/generation-pipeline/frozen-product-truth.ts` (new)
- `lib/single-page-image-regen.ts`
- `lib/generation-chunked/clear-page-images-for-regen.ts`
- the non-production persisted-image debug route
- focused writer/package/frozen-truth tests and reachability guards

## 6. Expected behavior after change
- A committed input mutation and its version/stale state are indivisible.
- If the mutation commits first, the Outbox CAS cannot send the old binding. If the CAS commits first, it sends the previously proven book; later redelivery requires reconciliation.
- Evaluation and asset I/O happen outside writer transactions and only at logical stabilization boundaries.
- Flag-on package completion creates an immutable Manifest and enqueues through the Outbox; it never directly emails.
- Flag-off preserves the existing status and direct-email behavior.
- Missing or changed frozen truth fails closed; package code never live-resolves it.

## 7. Validation plan
Unit tests for barrier atomic co-location, flag-off preservation, stale transition, frozen-truth mismatch, package pass/hold/block routing, recovery rebind, and static writer coverage. Run Prisma validation, `npx tsc --noEmit`, focused tests, and the full suite. No render or provider call.

## 8. Cost impact
No paid generation in validation. Runtime adds small, bounded DB transactions and one integrity evaluation at package/regen stabilization.

## 9. Rollback plan
Keep `READINESS_MANIFEST_ENABLED` off and revert the #5 commits. The flag-off package path remains present.

## 10. What ChatGPT should review
Challenge the lifecycle boundaries: when a ready order becomes generating/stale, when a repaired book may rebind automatically, and when a post-send mutation must enter explicit reconciliation.

## 11. Do not do
Do not enable the flag, deploy migrations, render a book, add Safety/Quality/VCC gates, remove the anchor hold, auto-redeliver after `sendAttempted=true`, or implement the ExceptionCase consumer in this slice.
