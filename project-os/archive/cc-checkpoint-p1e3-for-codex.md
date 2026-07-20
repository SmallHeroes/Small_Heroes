# P1-e3 checkpoint — Outbox terminal-recovery + suppression atomicity + fresh-now (Codex final 2+1)

**Branch:** `feat/chunked-generation` · **6 commits** (unpushed), green per-commit (`npm run check`: 854 pass, 2 skipped = staging-DB specs). Flag `READINESS_MANIFEST_ENABLED` default-OFF · **zero renders · chunk-runner.ts untouched** (verified `39027fcf..HEAD`).

| Commit | What |
|---|---|
| `3999f73d` | **B-r3-1** terminal recovery |
| `f3d0288f` | **B-r3-2** atomic suppression |
| `b691ead8` | **B-r3-3** fresh now |
| `c4544260` | P1-f bump helper |
| `fcb3be12` | migration ordering fix |
| `856ee340` | review-driven test hardening |

## The three fixes
- **B-r3-1 (no "ready behind a dead Outbox").** `enqueueDelivery` is now status-aware: no row → create `scheduled`; `scheduled|processing|sent` + same payloadHash → idempotent live success (different payload → throw); **`suppressed|failed` → never report live, roll `fulfillmentVersion+1`** to a fresh `scheduled` row (the commit persists the rolled `fulfillmentVersion` on the Order in the **same tx**, conditional on `inputVersion` so B4 still holds); all rolled fulfillments dead → throw `outbox_terminal_recovery_exhausted`. Kills the no-op-success-on-a-terminal-row → re-`ready` bug.
- **B-r3-2 (atomic, fence-gated suppression).** `markBaseBookStale` → `suppressAndInvalidateDelivery`, ONE tx: (1) fence the row → `suppressed` (`id` + `status='processing'` + `attempts===token`); (2) **only if the fence held** → invalidate the EXACT manifest (`currentManifestId===expectedManifestId`) + drop the order from `ready`. A lost-lease worker matches 0 at step 1 → returns false, changes nothing (the old code invalidated *before* the fenced write). The global `alreadySent` count is **gone** — the suppressed row is by construction not-sent, so a v1 `sent` can no longer block a v2 invalidation. Injected via a new `OutboxDeps.suppress` dep; the cron recheck is now read-only.
- **B-r3-3 (fresh now).** `processDelivery` captures `now` **after** the (possibly long) recheck (renewal + retry backoff) and **again after** the send completes (`sentAt`) / fails (`failNow` → 24h-window + backoff). No more lease renewal written already-in-the-past.

## P1-f pre-conditions (locked in now, not forgotten)
- **`bumpOrderInputVersion(db, orderId)`** — the SINGLE writer-side bump helper (one place so no writer is forgotten). Documented contract: every writer of a gate/payload input bumps `inputVersion` in the same tx as its write. **Not wired into any producer yet — chunk-runner untouched until P1-f.** Unit-tested.
- **Migration ordering fixed:** `20260629_add_input_version` → `20260630_add_input_version` so it sorts **after** `20260629_base_book_integrity` (it ALTERs the table base CREATEs; a fresh `migrate deploy` would otherwise fail). Guarded by a new test.
- **Staging `_prisma_migrations` baselined** (`prisma migrate resolve --applied` ×21 → `migrate status`: "up to date"). Manual SQL is no longer the only path; normal `migrate deploy` now works on staging. *(Prod likely needs the same readiness-table apply + baseline before flag-on — separate.)*

## Adversarial review (pre-checkpoint)
A 4-lens panel (concurrency / contract / completeness / test-gaps), each finding independently verified to refute false positives: **no real defect found in B-r3-1/2/3** — the implementation held under every concrete race/contract scenario raised. 4 test-coverage gaps were confirmed and closed in `856ee340`: the invalidation-free suppress fallback seam; the cron route wiring (new spec — recheck forwards payloadHash, suppress delegates, flag/auth short-circuits); B-r3-3 on the send-failure path; the migration-ordering invariant.

## Next: P1-f
Wire `bumpOrderInputVersion` into every Order/GeneratedBook/BookPage/ImageAsset writer that affects the gate or payload, in the same transaction. Expected approval gate per Codex ("after these 3 → P1-f").
