# Decision Gate — WS0b(d): contractHash → readiness fingerprint + evidence staleness

**Date:** 2026-07-03 · **Proposer:** Claude (CC) · **Reviewer:** Guy (+ Codex on the WS0b PR) · **Branch:** `feat/chunked-generation`
**Predecessors:** WS0b(a) `5327262c` (freeze + stamp `Order.visualContractHash`), WS0b(b) `795ae3d8` (bind `QualityEvidence.contractHash`). Both verified, byte-unchanged.
**Rule:** propose → Guy approves THIS gate → implement (a) commit → stop at SHA. This is the ONE WS0b slice that touches the delivery/readiness path — additive only, extra care.

## 1. Proposed change
Make the frozen visual contract participate in the readiness decision, **additively**:
1. **Order-level, into the TOCTOU fingerprint.** Add `visualContractHash` to `COMMIT_SELECT`, `OrderTruth`, `loadCommitInputs`, and `fingerprintOf` — so a re-freeze between eval and the commit tx drifts the fingerprint and aborts→re-evaluates (same anti-bypass treatment as frozen-truth / inputVersion / quality).
2. **Row-level, into the quality aggregation.** Add `contractHash` to `QualityEvidenceRow` + `loadQualityEvidence`'s select, and wire `isQualityEvidenceContractStale(row.contractHash, activeContractHash)` into `evaluateQualityGate` as a new per-artifact check — a row bound to a superseded contract → `evidence_unknown` (state `contract_stale`), exactly like the existing `stale_version` / `hash_mismatch` checks. The order's active hash is threaded via a new `opts.activeContractHash` from `loaded.order.visualContractHash` at the single call site (`readiness-manifest.ts:784`).

`isQualityEvidenceContractStale` already exists (WS0a, `quality-check-result.ts:113`) and is currently uncalled; this commit is its first consumer.

## 2. Why now?
Completes the freeze→bind→staleness-read chain as one coherent, reviewable unit while (a)/(b) are fresh. Without the read, a QA verdict produced against contract v1 would remain admissible after the order re-freezes to v2 — a stale-PASS delivery risk once steering (WS1) is on. This is the money-critical link; it belongs in the same review as the binding it depends on. It stays **inert** until an order actually carries a `visualContractHash` (i.e., until `VISUAL_CONTRACT_FREEZE` is turned on in WS0c), so landing it now is safe.

## 3. Scope
General system change (readiness/quality gate). Not story-specific. Enforcement stays OFF; no new *required* checks beyond making an already-required artifact re-QA when its evidence is bound to a superseded contract.

## 4. Risk of hardcoding
None — operates on the generic (orderId, artifactKey, contractHash) triple. No story/child/companion/page specialization.

## 5. Files affected (additive)
- `lib/generation-pipeline/readiness-manifest.ts` — `COMMIT_SELECT` (+`visualContractHash`), `OrderTruth` (+field), `loadCommitInputs` (populate), `fingerprintOf` (+`contract` field, hashed), the `evaluateQualityGate(...)` call at :784 (+`{ activeContractHash: loaded.order.visualContractHash }`). **The readiness transaction structure — `runReadinessTxn`, the atomic manifest/readiness/outbox/order/job writes, the receipt fence — is UNCHANGED.**
- `lib/generation-pipeline/quality-evidence.ts` — `QualityEvidenceRow` (+`contractHash`), `loadQualityEvidence` select (+`contractHash`), `evaluateQualityGate` (new `contract_stale` branch + `opts.activeContractHash`).
- Tests: `lib/__tests__/*` for the new truth-table rows.
- `qualityEvidenceFingerprint` is **NOT** changed (it keeps hashing only `[artifactKey, assetSha256, verdict, evaluatorContractVersion, regenCount]`); the row-level `contractHash` does not enter it. The contract's participation in TOCTOU is via the ORDER-level `visualContractHash` in `fingerprintOf` only.

## 6. Expected behavior after change
- **No frozen contract (today / flag OFF):** `Order.visualContractHash` is null and every `QualityEvidence.contractHash` is null → `isQualityEvidenceContractStale(null, null) === false` → no artifact is marked `contract_stale`. `fingerprintOf` folds in `contract: null` for every order — a constant that changes the absolute hash value but is computed identically at eval and commit, so no order's TOCTOU behavior changes. **Byte-identical to today.**
- **Frozen contract, evidence matches (normal path once on):** `row.contractHash === activeContractHash` → not stale → gate decides on the real verdict, exactly as before the change.
- **Frozen contract, evidence bound to a superseded contract (the point):** mismatch → `evidence_unknown` (`contract_stale`) → quality status `evidence_unknown` → readiness BLOCKS → the existing `quality_evidence_unknown` recovery path re-QAs the delivered bytes (zero renders) and re-binds fresh evidence to the active contract. Self-heals within the existing `QUALITY_REGEN_BUDGET`.
- **Re-freeze between eval and commit:** `visualContractHash` in the fingerprint drifts → TOCTOU abort → reload FRESH + re-evaluate against the new contract (no stale enqueue).

## 7. Validation plan (unit/integration only — NO full render)
- `evaluateQualityGate`: null/null → NOT stale (today unchanged); `row.contractHash='v1'` vs `activeContractHash='v2'` → `evidence_unknown` state `contract_stale`; `'v1'` vs `'v1'` → decides on verdict; evidence carries a hash but order none (`'v1'` vs null) → stale (phantom-contract, matching the helper's fail-closed rule).
- `fingerprintOf`: two orders with different `visualContractHash` → different fingerprint; same everything incl. null hash → identical fingerprint (proves null is neutral vs pre-change ONLY in the eval-vs-commit sense — documented).
- Full `npm run check`: ALL existing atomic-receipt / readiness / recovery / soft-deliver / TOCTOU tests green (the additive field must not disturb them).

## 8. Cost impact
Zero direct spend. The staleness→re-QA path re-QAs DELIVERED BYTES (no re-render) and is bounded by the existing single `QUALITY_REGEN_BUDGET`; no second budget, no new render loop. Inert until `VISUAL_CONTRACT_FREEZE` is on.

## 9. Rollback plan
Two layers: (i) `VISUAL_CONTRACT_FREEZE` OFF → no order carries a hash → the whole path is a no-op regardless of this commit; (ii) `git revert` of the (d) commit is clean (additive, no migration, no data written by this commit). No forward-migration to undo.

## 10. What Guy / Codex should review
- The **mass-invalidation hazard** is neutralized by the (a)→(b)→(d) ordering + the null/null rule: confirm there is no window where `Order.visualContractHash` is set while its `QualityEvidence` rows are null AND this reader is live for a real (flag-on) order. In-flight-across-deploy orders that predate (b)'s binding self-heal via the `contract_stale` → re-QA path (bounded by the regen budget) — confirm that's acceptable vs. gating on a deploy drain.
- Confirm placing the check in `evaluateQualityGate` (the decision) and NOT in `qualityEvidenceFingerprint` (the row hash) is correct: the contract's TOCTOU coverage is the ORDER-level `visualContractHash`, and the row-level staleness is a decision-time admissibility check.
- Confirm `contract_stale → evidence_unknown` (not `failed`) is the right disposition (re-QA, never refund-terminal).

## 11. Do NOT do
- Do NOT change the readiness atomic-commit STRUCTURE, the receipt fence, `AtomicOperationReceipt`, `DeliveryOutbox`, `ExceptionCase`/refund, or PayMe.
- Do NOT add `contractHash` to `qualityEvidenceFingerprint`.
- Do NOT enable any steering or turn `VISUAL_CONTRACT_FREEZE` on.
- No migration (columns already exist from WS0a). No full-book render.

## Approve? (Guy)
- [ ] The two additive integrations (fingerprint + `evaluateQualityGate` staleness) as written
- [ ] `contract_stale → evidence_unknown → re-QA` disposition
- [ ] Proceed to the (d) commit, stop at SHA
