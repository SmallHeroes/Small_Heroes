# #7-a Quality gate fail-closed — checkpoint (for Claude re-verify → Codex gate)

**Branch:** `feat/chunked-generation`. **Flag:** `READINESS_MANIFEST_ENABLED` OFF (unchanged). **Renders:** 0.
**Gate:** `npm run check` green per-commit. **Migrations:** additive only, NOT deployed.

## DONE — the fail-closed Quality gate core (4 commits, green per-commit)

1. `79e48e00` — **QualityEvidence model + migration** (`backend/migrations/20260701_quality_evidence/`).
   One durable row per required delivered artifact (cover + each page): `assetSha256` (of the EXACT delivered
   bytes = presentationUrl ?? url), `verdict` (passed|failed|evidence_unknown, CHECK-constrained), durable
   `regenCount`, `evaluatorContractVersion`, `providerModel`, `evidence` JSON. `@@unique(orderId, artifactKey)`,
   FK cascade, RLS enabled + no client policy (service-role only, mirrors ExceptionCase/ReissueBudget).

2. `17ddf23e` — **`lib/generation-pipeline/quality-evidence.ts`** (pure evaluator + durable helpers, 16 tests):
   `QUALITY_EVALUATOR_CONTRACT_VERSION='qa-v1'`, `QUALITY_REGEN_BUDGET=2`, artifact-key helpers,
   `evaluateQualityGate` (the anti-bypass aggregate), `persistQualityEvidence`, `loadQualityEvidence`,
   `reserveQualityRegen` (durable atomic budget reservation), `qualityEvidenceFingerprint`.

3. `f37d4c0f` — **page-visual-qa: durable `verdict` + regen cap 5→2** (8 tests). Vision missing/HTTP-error/throw
   now yield `verdict=evidence_unknown` (was a silent fail-OPEN pass); `passed` is untouched so the in-loop
   render accept/regen decision is byte-identical (flag-off parity). `resolvePageVisualQaConfig` hard cap 5→2.

4. `b118354f` — **fail-closed wiring into `commitBaseBookReadiness`** (`decideReadiness`, +5 tests). Loads
   QualityEvidence, combines with the integrity gate FAIL-CLOSED:
   - PASS only when EVERY required artifact has `passed` on the CURRENT delivered-bytes hash (from the integrity
     `inspect`) at the current evaluator version.
   - quality `failed` (after budget) → immutable BLOCKED manifest + BookReadiness=blocked + order hold +
     ExceptionCase(`quality_failed` → `refund_pending`) in ONE atomic tx; **NO Outbox row**.
   - `evidence_unknown`/missing/stale-version/hash-mismatch → BLOCKED manifest + ExceptionCase(`infra_transient`,
     `quality_evidence_unknown` → retry); **NO Outbox row**.
   - **Anti-bypass:** a PASS row for other bytes cannot authorize the delivered image (hash-match vs the inspect
     sha256); an old `evaluatorContractVersion` is stale; NO assume-passed default (empty evidence BLOCKS).
     Quality evidence is folded into BOTH the manifest `inputsHash` AND the tx TOCTOU fingerprint → a re-QA
     between eval and commit aborts + re-evaluates fresh.

   The `quality_failed` and `refund_pending` enum values + the `initialDisposition`/`KIND_PRECEDENCE` routing
   (infra_transient=1 < quality_failed=6, so an unknown case can UPGRADE to quality_failed) already existed.

## REMAINING #7-a — the render-path wiring + recovery (needs a render-enabled/reviewed slice)

These were deliberately NOT done here because they (a) touch the LIVE render provider and (b) hinge on a
hash-match that can only be validated with a real render (which this task forbids). **Enabling
`READINESS_MANIFEST_ENABLED` before 5a is wired would fail-closed BLOCK all delivery — by design; 5a must land
before flag-on.**

- **5a — DONE (`840d7b77`).** `lib/generation-pipeline/quality-evidence-producer.ts`
  (`persistDeliveredQualityEvidence`) wired at the chunk-runner page seam (post presentation transform) + cover
  seam, flag-gated. Honors carry-in #1 (re-QA delivered bytes when a transform applied; reuse the genuine
  in-loop verdict when not — the render loop now surfaces `style01Meta.pageVisualQa.verdict` + `qaInput`), #2
  (genuine cover verdict, never a synthesized PASS), #3 (`assetSha256 = inspectAsset(deliveredUrl).sha256`,
  computed OUTSIDE the tx), #4 (persist omits `regenCount`). **presentationUrl** = a WebP from
  `buildPresentationWebpFromBuffer` (warm-bias fit + directional-mask composite + flatten-on-paper + WebP q88
  re-encode) via `storePresentationBuffer`; null when presentation off / signal-fail; cover has NO transform.
  ⚠ #7-b staging: prove `persist assetSha256 == inspectAsset(presentationUrl??url).sha256` on a FIXTURE render.

- **5b — DONE (`045758a6`).** `image.ts` kept DB-free via `ImageInput.reserveQualityRegen?: () => Promise<boolean>`
  + `CoverImageInput.reserveQualityRegen` + `generateAllPageImages` config `makeReserveQualityRegen(pageNumber)`;
  chunk-runner binds them to `{prisma, orderId, artifactKey}` ONLY when the readiness flag is on. Loop budget
  decision reserves via `input.reserveQualityRegen?.()` BEFORE each regen (false → stop + accept-best); only a
  deterministic QA fail consumes budget (evidence_unknown leaves passed:true → no reserve); no reserver bound →
  legacy in-memory budget (byte-identical flag-off). Helpers `ensureQualityEvidenceRow` (create-at-0/update-no-op)
  + `makeQualityRegenReserver` (ensure-row THEN atomic conditional increment). 5a persist preserves regenCount
  (carry-in #4). **⚠ OPEN (Codex): a page renders MULTIPLE candidates (anchor election) that SHARE the page-level
  durable budget** (fail-closed: over-budget QA-failed final blocks at readiness). Confirm per-page-total vs
  per-candidate is intended.

- **6 — DONE (`4c2205b6`).** Producer persists `qaContext`+`deliveredUrl`; `quality-recovery.ts`
  (`reQaUnknownQualityEvidence`) re-QAs every inadmissible row (evidence_unknown / stale version) vs the STORED
  delivered bytes (ZERO renders); authoritative rows untouched; missing context stays evidence_unknown;
  regenCount preserved. `exception-processor` re-QAs a `quality_evidence_unknown` case BEFORE `recommitReadiness`;
  the recommit + `decideReadiness` + `openExceptionCase` then resolve (all passed) / UPGRADE infra_transient→
  quality_failed (failed-after-budget → refund_pending) / re-block→retry→refund (persistent unknown). reissue
  budget untouched. **⚠ OPEN (Codex): a `failed`-WITH-budget artifact re-blocks→retries→refunds** (fail-closed);
  the targeted-page-regen rescue (clear failed page + redrive, reusing the 5b reserve) is deferred pending the
  candidate-election budget ruling above.

## Verify focus (per the brief)
fail-closed (no PASS without every artifact `passed`) · anti-bypass (hash/version/inputsHash+TOCTOU, no escape
hatch) · atomicity (BLOCKED manifest + readiness + hold + case all-or-nothing, no Outbox) · budget-crash-safety
(5b) · flag-off legacy path unchanged · 5a byte-binding (delivered-bytes verdict, never raw→presentation hash).
