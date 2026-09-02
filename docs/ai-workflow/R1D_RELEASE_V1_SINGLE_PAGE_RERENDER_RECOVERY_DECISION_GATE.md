# R1D release/v1 single-page re-render recovery — Decision Gate

**Date:** 2026-09-02
**Trigger:** the existing paid Lavi/Chameleon Order remains failed after its one reviewed retained-byte safety attempt was consumed without a positive safety result. A post-attempt inspect proves that no hazard or pass was persisted and that page 6 remains safety-unverified; pages 7–8, narration, and packaging are still missing. The existing debug single-page path deliberately leaves new bytes safety-unverified, while ordinary recovery cannot resume a package-backed release Order.

## 1. Proposed change

Extend the authenticated Preview-only `release/v1` recovery operation with a distinct, audited one-page re-render mode. Inspect must remain provider-free and prove the exact failed Order/payment/package/deployment snapshot, actual artifact inventory, and one selected existing page whose safety state is unverified, hazardless, override-free, SHA-bound, current-evaluator-bound, contract-bound, and backed by its real QA context.

Apply must lock and compare that exact snapshot, invalidate only the selected page's prior evidence, remove only its `ImageAsset` and stale uploaded-candidate pointer, and retire the exact prior page-write `AtomicOperationReceipt` when present so an identical-byte/content-address replay can recreate the deleted row. The old asset URLs, ID, SHA, idempotency key, evidence, candidate, and retired-receipt identity/digests remain in the durable recovery audit. Apply then resets the same Order/job to the normal release worker with the selected page removed from completed progress and dispatches only after commit. The normal worker renders the selected page and every genuinely missing downstream page through the existing candidate persistence, visual/safety/world QA, safety-SHA, readiness, narration, and packaging gates.

## 2. Why now?

The retained-byte safety mechanism correctly fails closed and has exhausted its one database-snapshot claim. Replaying it, inventing a new UUID, or manually clearing safety would defeat the reviewed budget. The old debug re-render does not run the full safety pipeline and would park/corrupt the incomplete release lifecycle. A bounded release-aware page replacement is the smallest safe way to continue the same paid Order.

## 3. Scope

This is a general release/v1 recovery capability for one existing page on one failed package-backed Order. No Order ID, child, story, companion, page number, asset URL, or prompt text is hardcoded. The current Order and page 6 are the live proof only.

## 4. Risk of hardcoding

Eligibility derives entirely from submitted expected inventory plus durable Order, payment, package authority, release continuity, page/asset identity, exact-byte SHA, safety fields, quality evidence, evaluator version, contract hash, override state, job state, and immutable Preview metadata. Apply accepts exactly one page per reviewed attempt and refuses any artifact already replaced by this mechanism.

## 5. Files likely affected

- `lib/generation-pipeline/release-v1-recovery.ts`
- `lib/generation-pipeline/types.ts`
- `lib/generation-chunked/release-v1-worker-reachability.ts`
- `lib/generation-chunked/env-separation-guard.ts`
- `lib/generation-chunked/exception-case.ts`
- `app/api/release/v1/generate/worker/route.ts`
- `backend/providers/image.ts`
- `lib/generation-pipeline/chunk-runner.ts`
- `lib/generation-pipeline/quality-evidence-producer.ts`
- `lib/generation-pipeline/quality-recovery.ts`
- `lib/resemblance-core.ts` (make canonical Style01 and its DB aliases resolve to the already-approved 0.70 threshold)
- focused release recovery and route tests
- delivery-input writer coverage test if required
- `CURRENT.md`

No Prisma migration, prompt, story, Blueprint, Board, image-model/quality, payment, checkout, reader, or Production configuration change is expected. The existing Vercel automation-bypass secret may be injected only into this branch-scoped Preview and is re-probed from the deployed server before any Apply mutation; Deployment Protection remains enabled.

## 6. Expected behavior after change

- Existing inspect/apply recovery requests remain backward-compatible.
- One-page re-render inspect performs no paid image/Vision/model call. It reuses the exact frozen render/Board preflights and makes one state-free OPTIONS self-probe to prove the protected immutable worker is reachable with the deployed bypass secret; it returns both the pre-action inventory and the exact resume inventory.
- The selected page must be a current completed page with an exact valid asset/evidence/safety binding and the narrow `unverified + zero hazards + zero overrides` state. Safe, hazardous, missing, stale, unbound, contextless, mismatched, already-replaced, or multiple targets are rejected.
- Apply is snapshot-bound, transactionally locked, receipt-fenced, idempotent, and dispatches once. It removes no other page/cover/audio/payment/order data.
- Prior bytes remain identifiable in the recovery audit; the old delivery pointer, stale candidate pointer, and exact prior page-write receipt (if present) are removed atomically with evidence invalidation and lifecycle reset. No storage object is deleted.
- Recovery admission proves the actual worker prerequisites: complete child DNA, approved canonical child anchor, exact frozen package/runtime projection, render-ready Board bindings, Style01 Phase-2, raw `GPT_IMAGE_QUALITY=low`, exact `STYLE_01_GPT_MODEL=gpt-image-2`, `PHASE2_STYLE01_REF_CONFIG=A`, `PAGE_VISUAL_QA_ENABLED=true`, `QA_SOFT_DELIVER=false`, effective resemblance threshold 0.70, required image/storage credentials, conditional ElevenLabs credentials when the selected Order needs narration, dispatch environment separation, and a working protected self-chain. `NEXT_PUBLIC_APP_URL` is bound to the exact immutable HTTPS Preview origin. The same environment-separation guard used by dispatch runs again on Apply before any claim or mutation.
- The reviewed recovery marker requires a numeric resemblance score for every resumed page that expects the child. The provider scores the uploaded raw candidate against the approved canonical child anchor at the Style01 effective threshold (0.70); aliases cannot weaken it. A verified below-threshold score uses the same durable maximum-two quality-replacement budget, while scorer-unavailable/unknown evidence spends no replacement and fails closed.
- The page writer persists that numeric policy atomically with the delivered asset and delivery-input receipt. If presentation changes the bytes, delivered-byte QA scores the delivered URL again against the same canonical anchor; if not, it reuses the raw same-byte evidence. Recovery re-QA reconstructs the persisted policy and cannot erase or weaken the resemblance hold.
- If the Order has an active pre-external `infra_transient` generation ExceptionCase for `base_book`, Apply locks and resolves that exact case in the same transaction before lifecycle reset. Scope, generation source, attempts, retry schedule, claim version, timestamps, lease and absence of refund/notification attempts are snapshot-bound; an unrelated case, live lease, external side effect or concurrent processor claim rejects the recovery before page mutation. Resolution clears its active/retry/lease authority and advances `claimVersion`, so a stale processor cannot later refund the recovered Order.
- The selected page is no longer counted complete. The release worker renders it through the same production path as any missing page; no debug bypass or synthetic safety pass exists.
- A new image that does not obtain complete safety, visual, world and required numeric resemblance QA remains held/fails closed. Exact recovery uses `QA_SOFT_DELIVER=false`, so numeric failure or unknown evidence cannot be soft-shipped. Only normal verified gates can advance to delivery.
- The same Order then continues to its genuinely missing pages, narration, package, and reader.

## 7. Validation plan

Zero-cost local validation:

1. Parser/backward-compatibility tests for legacy recovery and the distinct one-page re-render request.
2. Inspect tests for exactly one eligible page and rejection of multiple, missing, safe, hazardous, overridden, SHA/evidence/context/evaluator/contract drift, prior-replacement, inventory drift, wrong payment/package/deployment, invalid or unrelated ExceptionCase, live lease and any external refund/notification attempt.
3. Apply tests proving exact snapshot CAS, pre-mutation dispatch-environment refusal, exact one-row asset deletion, stale candidate cleanup, exact prior-receipt retirement/CAS, identical-byte replay safety, evidence invalidation without resetting the normal quality-regeneration counter, completed-page recomputation, unchanged commercial/order identity, exact active-generation-case resolution, stale processor fencing, audit persistence, receipt-token dispatch ownership, replay behavior, ambiguous-commit safety, and concurrent/different-UUID refusal.
4. Production-call-path tests proving the resumed worker sees pages 6–8 as missing and routes them through candidate persistence, canonical-anchor raw resemblance scoring, the exact 0.70 threshold, atomic policy/receipt persistence, and delivered-byte QA rather than the debug path. Tests also prove presentation-transformed 0.69 fails, 0.70 passes, scorer-unavailable remains unknown without spending a replacement, and zero-render recovery re-QA cannot discard the gate.
5. Relevant Vitest suites, `npx tsc --noEmit`, `npm run check`, build, and `git diff --check`.
6. Independent read-only Claude Code review of an immutable commit range before deployment or paid calls.
7. After PASS, deploy one exact immutable Preview; inspect; perform one Apply for the existing Order; monitor to terminal state; inspect the generated page(s), reader, audio/package, and prove no new Order/payment was created.

## 8. Cost impact

Implementation and tests spend $0. The live run is expected to create exactly three initial LOW candidates: the one approved replacement page and missing pages 7–8. The existing durable quality policy may create up to two additional LOW replacements per page only after a verified visual or below-threshold resemblance defect; evidence-unknown outcomes do not spend replacements. No cover/anchor/pages 1–5 re-render and no new checkout/payment are permitted.

## 9. Rollback plan

Before Apply, revert the focused commit and remove the branch-scoped Preview bypass injection if desired; runtime/order data remains untouched. Apply is irreversible only with respect to the selected old image pointer, candidate pointer, and exact prior page-write receipt; their recovery-critical identities/digests and the old source/presentation/raw/delivered URLs are durably audited, and the storage object is not deleted. If dispatch or rendering fails, the same Order remains recoverable with the selected page honestly missing and prior evidence invalidated. Reverting code after Apply does not fabricate safety or delivery. Production remains untouched.

## 10. Review assignment

Guy has explicitly authorized Codex to take the reins and do what is needed to finish this same Order, while prohibiting any additional Order. That is treated as approval for one LOW page replacement plus the already-missing pages 7–8 under the existing bounded QA policy.

Claude Code must try to falsify target eligibility, snapshot/byte binding, one-page bound, prior-attempt bound, evidence invalidation, exact deletion scope, candidate and prior-receipt cleanup, identical-byte replay, active ExceptionCase eligibility/resolution and stale-processor fencing, audit completeness, delivery-input invalidation, lifecycle CAS, idempotency/ambiguous replay, dispatch ownership, protected-worker reachability, canonical-anchor/0.70 raw and delivered resemblance enforcement, unknown-evidence fail-closed behavior, normal-worker QA routing, and any mutation of payment/commercial/product authority.

Claude Cowork is not required because this milestone changes no story, visual direction, UX, or product promise. Guy retains final visual/product acceptance.

## 11. Do not do

- Do not create, repay, clone, or restart checkout for an Order.
- Do not retry the consumed retained-byte safety Apply or issue a new UUID for the same mechanism/snapshot.
- Do not manually flip safety/readiness fields or treat empty hazards as proof of safety.
- Do not call the legacy debug single-page endpoint on this Order.
- Do not re-render the child anchor, cover, or pages 1–5.
- Do not change prompt/story/Blueprint/Board authority, model/quality pins, the approved `0.70` resemblance threshold, or safety/quality policy. Correcting canonical/DB Style01 alias resolution so both paths actually enforce 0.70 is in scope; changing the numeric policy is not.
- Do not delete the old storage object, expose secrets/customer URLs/bytes, mutate or alias Production, or push without Guy's explicit request.

## Stop-before-major-actions answers

1. **General or story-specific?** General one-page release recovery; the incident page is only proof.
2. **Could another story/style break?** The route is package-backed Style01 release recovery only; legacy requests remain covered and exact eligibility fails closed.
3. **Production behavior?** Production-capable code changes, but the action endpoint remains hidden outside explicitly enabled Vercel Preview and Production is excluded.
4. **Spend money?** Local work costs $0. Live expectation is three LOW candidates; extra bounded replacements occur only for verified defects.
5. **Smallest validation?** Mock/database tests, independent QA, then one inspect and one Apply against the existing Order.
6. **What must Guy decide?** Already decided: finish this Order, use Lavi, and create no additional Order.
7. **What should Claude Code falsify?** Exact target/snapshot/transaction bounds, QA routing, auditability, prior-receipt retirement and identical-byte replacement, idempotency, dispatch ownership/reachability, and unchanged payment/order authority.
8. **Claude Cowork?** No product or creative decision changes.
9. **What should Guy eyeball?** Replacement page 6, pages 7–8, continuity/resemblance, Hebrew layout, and the final Reader/audio before product acceptance.
