# Decision Gate — P1-f #5 hardening

## 1. Proposed change
Close the fail-closed stuck-book gap in the delivery-input write barrier. When a flag-on mutation atomically moves an order from `ready` to `generating`, reset its `GenerationJob` in the same transaction to a resumable stage. Stable input replacements resume at `package`; clearing page images resumes at `page_images`.

Also strengthen the static writer-coverage test so aliased transaction clients, destructured model delegates, raw SQL, and dev routes cannot silently bypass the barrier. Pin the existing rule that every null frozen-truth field blocks readiness.

## 2. Why now?
`clearOrderPageImages` can currently stale a delivered book while leaving its job terminal (`done/done/packaged=true`). The sweeper cannot reclaim that state, so the order remains `generating` forever. This must be closed before the readiness flag is enabled.

## 3. Scope
General system correctness and test hardening. No story-, child-, companion-, page-, or style-specific behavior.

## 4. Risk of hardcoding
Recovery is selected by mutation class, not by order/story identity. The central barrier owns the lifecycle invariant; callers do not manually repair jobs.

## 5. Files likely affected
- `lib/generation-pipeline/readiness-manifest.ts`
- `lib/generation-chunked/clear-page-images-for-regen.ts` (only if an explicit recovery hint is required)
- `lib/__tests__/readiness-manifest.spec.ts`
- `lib/generation-chunked/__tests__/readiness-inputversion.staging.spec.ts`
- `lib/__tests__/delivery-input-writer-coverage.spec.ts`
- `app/api/dev/story-bank/route.ts`
- `lib/__tests__/integrity-gate.spec.ts`

## 6. Expected behavior after change
- A flag-on input mutation against a ready order makes readiness stale, bumps `inputVersion`, removes `ready`, and makes the generation job reclaimable in one transaction.
- Cleared page images resume at `page_images`; already-stabilized replacement inputs resume at `package`.
- Flag-off behavior remains unchanged.
- Unknown direct writers or raw SQL fail CI; dev story-bank writes are unavailable while readiness mode is enabled until that route is migrated.
- Any missing frozen truth blocks the integrity gate.

## 7. Validation plan
Unit tests for the atomic recovery branches, hardened static writer audit, integrity-gate null matrix, Prisma validation, TypeScript, and the full test suite. No image/audio generation and no book render.

## 8. Cost impact
Zero provider/API spend. Database-only tests; the real staging test remains opt-in and skipped by default.

## 9. Rollback plan
Revert the hardening commit. The readiness flag remains off throughout.

## 10. What ChatGPT should review
Confirm the recovery-stage taxonomy and that disabling the legacy dev story-bank route under flag-on is preferable to allowing unbound writes.

## 11. Do not do
- Do not enable `READINESS_MANIFEST_ENABLED`.
- Do not render images, audio, pages, or a full book.
- Do not widen the sweeper into a second source of lifecycle truth.
- Do not weaken fail-closed behavior or add a live frozen-truth fallback.
