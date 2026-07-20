# #7-b staging proof — runbook (turnkey)

**Status:** harnesses built + committed (`b57adba2` on `feat/chunked-generation`), skipped by default so `npm run check` stays green. NOT yet executed — blocked on the two preconditions below.

**Safety contract (all proofs):** each spec is gated `RUN = <opt-in env> && canAccessStagingQa()`, calls `assertEnvSeparation()` first (refuses to run against any prod resource), lazy-imports Prisma (a skipped run never connects), and self-cleans its throwaway order. **Production flag stays OFF. Do NOT touch prod.**

---

## Preconditions (Guy)

1. **Push** `feat/chunked-generation` (currently ahead of origin — includes `#6-fix-4` + these harnesses).
2. On **staging** (Vercel Preview) set: `READINESS_MANIFEST_ENABLED=true`, `CRON_SECRET`, and provide the staging `DATABASE_URL` (Supavisor pooler, `pgbouncer=true`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`.
3. **Seed one matrix-sellable fixture order** on staging for the hash-proof (a renderable order — child photo + story assigned). Note its `orderId`.

Local runner model: point the specs at the **staging** DB/keys via env; `VERCEL_ENV=preview ALLOW_STAGING_QA=true` opens `canAccessStagingQa()`. `assertEnvSeparation()` aborts if any value looks prod.

---

## STEP 1 — HASH-PROOF (LOAD-BEARING — run FIRST)

Renders ONE page + cover from the fixture (LOW, page-only via `CHUNKED_IMAGE_PAGE_FILTER=1` — ~2 images, NOT a full book) through the real pipeline, then proves the durable evidence binds to the delivered bytes.

```bash
VERCEL_ENV=preview ALLOW_STAGING_QA=true RUN_HASH_PROOF=true READINESS_MANIFEST_ENABLED=true \
  IMAGE_PROVIDER=gpt-image GPT_IMAGE_QUALITY=low HASH_PROOF_ORDER_ID=<seeded-sellable-order-id> \
  DATABASE_URL='postgresql://...pooler...:6543/postgres?pgbouncer=true' \
  OPENAI_API_KEY=sk-... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx vitest run lib/generation-chunked/__tests__/quality-hash-proof.staging.spec.ts
```

- Tip: if the fixture is pre-rendered (`run-bunny-smoke-render --pages cover,1 --quality low`), the drive loop is a no-op and the proof is instant.
- **PASS:** test green; console prints `[HASH-PROOF] cover  evidence=<sha> delivered=<sha>` and `[HASH-PROOF] page:1 evidence=<sha> delivered=<sha>` with **each pair equal**. Report the two hashes.
- **FAIL (mismatch):** `assetSha256 !== inspectAsset(delivered).sha256` → the quality gate would see `hash_mismatch` for a good image → **every book blocks**. **STOP. Fix the delivered-URL binding (raw vs presentation) before any real order.**

---

## STEP 2 — LIVE-DB proofs (no render; run after step 1 is green)

```bash
VERCEL_ENV=preview ALLOW_STAGING_QA=true RUN_7B_PROOFS=true \
  DATABASE_URL='postgresql://...pooler...:6543/postgres?pgbouncer=true' \
  npx vitest run \
    lib/generation-chunked/__tests__/readiness-delivery.staging.spec.ts \
    lib/generation-chunked/__tests__/exception-recovery.staging.spec.ts
```

(`READINESS_MANIFEST_ENABLED=true` is set inside each test; the staging env value is fine too.)

### Pass/fail criteria per proof

| Proof | Green means | Rows to observe |
|-------|-------------|-----------------|
| **PASS** | `manifestStatus=passed`, `enqueued=true`, exactly **one** send, 2nd drain claims 0, Order `ready` | `BookReadinessManifest.status=passed`; one `DeliveryOutbox` → `sent`, `sendAttempted=true` |
| **QUALITY-FAIL** | `manifestStatus=blocked`, **no** outbox row, Order `needs_human_qa` | blocked manifest; `ExceptionCase(kind=quality_failed, status=refund_pending)`; `DeliveryOutbox` count 0 |
| **CONCURRENCY** | send **not** called, `delivery_blocked=1` | `DeliveryOutbox.status=delivery_blocked`, `sendAttempted=false` (rebind-eligible) |
| **FAILURE→EXCEPTION (recoverable)** | outcome `retry_scheduled`, `redriveGeneration` called, no email | case `infra_transient` re-driven |
| **FAILURE→EXCEPTION (terminal)** | case opens `status=refund_pending`, no outbox | `ExceptionCase(kind=quality_failed, status=refund_pending)` |
| **RECOVERY** | `reQa.nowFailed=[{page:1,regenCount:0}]`; reserve #1/#2 grant (regenCount→1→2, image cleared, `regenPending` set); reserve #3 declined (regenCount stays 2) | `QualityEvidence.regenCount` progression; page `ImageAsset` deleted after clear |

---

## Report back

1. The two hashes from STEP 1 (must be equal ×2).
2. Green/red per proof in STEP 2, plus the manifest / outbox / ExceptionCase rows observed.
3. Any `assertEnvSeparation()` abort (means an env value looked prod — do NOT override).

On all-green: **#7-b CLOSED → #7-a CLOSED.**

## Cleanup / notes
- Each test deletes its own throwaway order (`sevenb-*`); the hash-proof fixture is Guy's seeded order and is NOT deleted.
- The 5 live-DB proofs stub the email/refund providers and image bytes — they never render or send. Only STEP 1 renders (~2 LOW images).
