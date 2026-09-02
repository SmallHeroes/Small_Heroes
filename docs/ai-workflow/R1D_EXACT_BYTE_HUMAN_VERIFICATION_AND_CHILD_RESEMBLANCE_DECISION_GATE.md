# R1D exact-byte human verification and child-resemblance proof — Decision Gate

**Date:** 2026-09-02
**Approval:** Guy explicitly approved the exact current page 6 and a controlled human-verification path without bypassing the 0.70 resemblance threshold.
**Live boundary:** the existing paid Lavi Order `cmtj2vvrw0002ju04a9covxqv` only. No new Order, checkout, payment, image, audio, PDF, or Production mutation.

## 1. Proposed change

Add a Preview-gated `human_verified_unverified_release/v1` readiness mode for a single exact-byte `safety_hold:unverified:page:N` incident. The mode may replace only malformed/unknown machine safety evidence with a separately attributed human safety determination for the exact current asset bytes. It must not reuse or weaken the existing confirmed-hazard false-positive release.

Correct the package-backed child-presence check so authoritative cast IDs such as `child:hero` require the page resemblance gate. Replace the inappropriate whole-scene color-histogram comparison for this gate with a versioned, scene-aware Vision identity assessment that compares the approved canonical child anchor with the exact delivered page bytes, ignores background/lighting/pose, and returns strict typed evidence. The numeric threshold remains exactly 0.70.

For already-rendered held Orders, the operation may backfill missing current-byte resemblance evidence without generating new images. It evaluates only child-present pages that lack admissible current evidence, persists exact-byte proof, and completes readiness atomically only when every required page has a current score `>= threshold >= 0.70` and every other gate passes.

## 2. Why now?

The same paid Order is complete but held on page 6 because three same-byte safety checks returned `vision_malformed`. There is no supported human path for an `unverified` hold. Investigation also proved that package pages use `child:hero` while the generator checked only the legacy literal `child`, so pages 6–8 skipped the intended numeric resemblance policy. Finally, the existing scorer is a 48-value whole-frame RGB histogram, not a face/subject identity measure; its approximately 0.05 scores cannot validly establish or refute identity at 0.70.

Expected behavior is: exact current bytes approved by the product owner may receive an audited human safety determination, but release remains impossible until an independent, fit-for-purpose numeric identity proof meets 0.70 on every child-present page.

## 3. Scope

This is a general system change, not a Lavi/page-6 patch. Eligibility is derived from current Order, case, payment, package/runtime authority, artifact identity, SHA-256, contract/evaluator, canonical anchor, structured child presence, and readiness state. The current Order is only the live proof.

The endpoint is disabled unless explicitly enabled on a branch-scoped Preview. Production-capable library code remains fail-closed when the feature is disabled, and the service layer also rejects any non-Production runtime whose app, Supabase, database, or service-role authority points at a known Production resource.

## 4. Risk of hardcoding

No Order ID, name, age, story, page number, cast ID suffix, URL, SHA, or visual outcome is hardcoded. Package-backed pages use the authoritative runtime Blueprint `entityPresence.childPresence`; legacy pages retain their legacy presence rule. The operation accepts one target derived from the sole unverified marker and refuses mixed, stale, hazardous, already-released, or ambiguous states.

The new Vision score is not treated as a universal replacement for historical anchor election. It is a distinct versioned page-to-child-identity contract used only where page identity evidence is required.

## 5. Files likely affected

- `backend/providers/image.ts`
- `lib/generation-pipeline/chunk-runner.ts`
- a shared authoritative child-presence helper
- a versioned child-page Vision resemblance evaluator and typed evidence parser
- `lib/generation-pipeline/quality-evidence.ts`
- `lib/generation-pipeline/quality-evidence-producer.ts`
- a distinct human-unverified verification/readiness module
- an authenticated Preview-only admin action route
- focused unit, route, source-boundary, and transaction tests
- `CURRENT.md`

No Prisma migration is planned. Existing `QualityEvidence.review*` fields record the human decision and a strict versioned `HumanQaOperatorAction.outcome` records immutable artifact, URL-hash, SHA, evaluator, contract, anchor, score, threshold, payment, case, and readiness bindings. Fresh automated evidence must clear all human-review fields. The normal machine verdict/reason and raw provider evidence remain preserved as provenance.

## 6. Expected behavior after change

- Existing hazard release continues to reject `safety_hold:unverified:*` and remains otherwise unchanged.
- Package pages whose authoritative frame says the child is present always construct and persist a required numeric resemblance policy. Required-policy absence fails closed.
- The identity evaluator returns a finite 0–1 score only from strict schema-valid output where the child is visible enough to assess. Malformed, unavailable, ambiguous, or insufficiently visible results are evidence-unknown, never a pass.
- A score below 0.70 fails. Exactly 0.70 passes. Neither human approval nor configuration aliases can lower or bypass the threshold.
- Same-byte retries are bounded to two only for malformed/transport-unknown evaluation. They never regenerate or alter an image.
- Inspect is provider-free and mutation-free. It returns a redacted exact snapshot and the set of child-present pages requiring proof.
- Apply is invoked through the authenticated ceremony service principal `admin:exact_byte_human_verification` plus a mandatory `Idempotency-Key`. The actor is server-derived and cannot be supplied by the caller; this records the authenticated service ceremony, not an individual human identity. It claims one immutable request before any paid Vision call. Same-key replay returns the recorded result only while the complete current authority still validates inside the Order-locked receipt transaction; authority drift refuses. The same key with different input refuses.
- Apply hashes only current DB-selected asset URLs, never caller-selected URLs. Every result binds the current artifact ID, delivered URL hash, delivered SHA, evaluator contract, visual contract, canonical-anchor hash, case revision/fingerprint, Order marker/fence/input version, and paid payment snapshot.
- The target must be the sole `safety_hold:unverified:page:N` marker with exactly one open matching safety case; hazards and overrides must be empty and machine evidence may be unknown only for the narrow safety reason. Payment authority requires a nonblank Order provider and payment ID, a timestamped paid `PaymentRecord` for that exact provider, exact amount/ILS currency, the Stripe paid flag where applicable, and no payment/refund/reconciliation fence. Any confirmed hazard, failed evidence, payment fence, refund/reconciliation activity, other hold, or state drift refuses.
- The human decision is stored as separate review provenance; original machine uncertainty is retained. Gate 2 recognizes the exact current-byte human verification as the effective safety determination only while every binding still matches.
- One readiness transaction rechecks all authority under Order/GenerationJob locks, persists/reuses current resemblance proofs, records the succeeded action, resolves the exact case, transitions through a distinct human-verified marker, writes a passed readiness manifest, enqueues the normal DeliveryOutbox once, and moves the same Order to `ready`. The receipt replay path repeats the full current Order/payment/case/asset/evidence/anchor/byte-authority validation under the same lock before returning success. Failure before provider start rolls back or leaves a reclaimable no-provider claim; a `provider_started` or ambiguous provider outcome is never auto-reclaimed and requires manual reconciliation; a settled terminal outcome prevents any second key from spending against the same proof inputs. No direct email or external commercial call occurs.

## 6A. Implemented safety and concurrency boundaries

- Inspect and Apply are separate authenticated Preview routes. Inspect is redacted, provider-free, and mutation-free; both service entry points enforce the exact Preview flags and environment separation before any DB/provider work. Abort and human readiness commit enforce the same environment separation before mutation.
- Vision spend is durably marked `provider_started` before the first call. Each page has at most three attempts (initial plus two retries), total book spend is capped at 24 calls, and `Promise.allSettled` waits for already-launched calls before terminalizing the claim. A shared batch fence is checked immediately before every attempt, so once any page returns a deterministic refusal no sibling may start another retry.
- A definite readiness refusal after proofs have settled cannot erase provider/proof provenance. Abort reconstructs the exact original proof-input digest from the validated prepared request and records a strict post-score terminal with request, inspection and case-revision bindings. A different idempotency key for the same proof input is then rejected before any provider attempt; malformed terminal records also fail closed.
- Page resemblance evidence is strict-normalized at both normal producer seams: evaluator version, finite score, subject visibility, same-child decision, exact delivered/reference SHA-256 values, threshold floor and status/score consistency must all agree. A claimed pass below 0.70 or malformed evidence becomes evidence-unknown.
- Package-backed child presence comes from `runtimeVisualAuthority.entityPresence.childPresence`; legacy behavior is retained only for legacy pages. Every package-backed child-present page requires numeric resemblance evidence, not only the live incident.
- Fresh QA writes and regeneration reservations run through the Order-first delivery-input barrier. They stale readiness, advance input authority and prevent a late evidence/asset write from racing a send. Direct barrier paths, ExceptionCase producers and atomic receipts use the same Order-first lock discipline.
- Human review provenance is dedicated (`human_verified_unverified_release/v1`) and never writes the confirmed-hazard safety override fields. The strict loader reconstructs the entire current proof set from current `QualityEvidence`, asset IDs/URLs/SHAs and anchor bytes and compares the exact proof digest to the committed outcome/receipt.
- Canonical anchor rebind/finalization locks `GenerationJob` after `Order`. Ordinary cache persistence locks `Order` first and freezes `characterAnchorStore` once the Order is ready, preventing a queued stale cache write from changing the release anchor after readiness/outbox commit.

## 7. Validation plan

Zero-image local validation:

1. Semantic child-presence tests for canonical `child:hero`, child-absent package frames, and legacy pages.
2. Evaluator parser/transport tests: schema strictness, privacy, finite score, visibility, malformed/timeout retry cap, `0.699999` fail and `0.70` pass.
3. Evidence tests proving asset/anchor/URL/SHA/evaluator/contract binding and fail-closed missing/stale/malformed proof.
4. Admission matrix for exact marker/case/payment/package/runtime/artifact/evidence state, including hazards, failures, other blockers, and drift between inspect/evaluate/commit.
5. Route tests proving authentication occurs before body parsing, required idempotency, server-derived actor, safe redacted responses, and no provider/order/payment/checkout/image-generation surface.
6. Transaction/idempotency tests proving one action/manifest/outbox, replay without a second provider call only while current authority remains valid, stale-success replay refusal, different-payload refusal, concurrent-key exclusion, rollback, and exact case resolution.
7. Regression tests proving fresh automated evidence invalidates a prior human review and existing hazard release still refuses unverified.
8. Relevant Vitest suites, `npx tsc --noEmit`, `npm run check`, build, and `git diff --check`.
9. Independent read-only Claude Code review of the immutable commit range before any live call.
10. After PASS, one exact branch Preview; provider-free inspect; one Apply against the existing Order; monitor to terminal state; confirm the Order/payment IDs are unchanged and no new Order/payment/image was created.

No full-book render is authorized or required. Guy already eyeballed and approved the exact page 6 SHA; final Reader/product acceptance remains his.

## 8. Cost impact

Image/audio/PDF generation cost is zero. The live action may make one Vision identity call for each child-present page that lacks valid current proof, with at most two same-byte retries only after malformed/transport-unknown output. The hard ceiling is 24 Vision calls for an eight-page book; the expected number is lower because current admissible proofs are reused. No provider call occurs during inspect, local tests, or replay. Calls already launched concurrently are allowed to settle, but the shared attempt fence prevents every later retry after a deterministic below-threshold result.

## 9. Rollback plan

Before Apply, revert the focused commit or remove the Preview feature flag; no Order data changes. After a failed Apply, the same Order remains held and all original assets stay intact. After a successful atomic readiness commit, the immutable action/evidence audit explains the human and numeric authority; reverting code does not delete it or create a second delivery. Production remains untouched throughout this milestone.

## 10. Review assignment

Guy decided the product question: he approved the exact page 6 and the controlled human path, with 0.70 non-negotiable.

Claude Code must try to falsify structured child presence, scorer fitness and strict parsing, exact 0.70 behavior, same-byte/anchor/contract/evaluator/payment/case bindings, review provenance, fresh-evidence invalidation, claim/replay/concurrency behavior, transaction atomicity, readiness/outbox exactly-once behavior, and all forbidden order/payment/provider side effects.

Claude Cowork is not required because no story, UX, visual direction, or child likeness decision remains open. Human product acceptance remains with Guy.

## 11. Do not do

- Do not create, clone, repay, or restart checkout for an Order.
- Do not regenerate, replace, crop, retouch, upload, or delete any image, anchor, audio, or PDF.
- Do not replay the consumed retained-byte or page-rerender UUIDs.
- Do not clear DB holds, fabricate hazards, overwrite the machine verdict, or reuse the confirmed-hazard override fields.
- Do not lower, alias around, or manually waive 0.70.
- Do not use the whole-scene histogram as page identity proof.
- Do not accept caller-supplied asset URLs, actor identity, score, or evaluator evidence.
- Do not expose customer URLs/bytes, access keys, prompts, provider payloads, or secrets in logs/responses.
- Do not mutate Production, push, or create a deployment before independent QA PASS.

## Stop-before-major-actions answers

1. **General or story-specific?** General exact-byte human verification and page-identity proof; Lavi/page 6 is the live incident only.
2. **Could another story/style break?** Yes if presence or evidence semantics are broadened incorrectly; package authority, legacy fallback, feature gating, and fail-closed regressions bound the risk.
3. **Production behavior?** Production-capable code changes, but the action stays disabled outside an explicitly enabled immutable Preview and Production is excluded.
4. **Spend money?** No generation spend. Only bounded Vision identity evaluation on existing bytes after independent QA.
5. **Smallest validation?** Offline tests and review, then provider-free inspect and one same-Order Apply.
6. **What must Guy decide?** Decided explicitly: page 6 is approved; use the controlled human path; never bypass 0.70; no new Order.
7. **What should Claude Code falsify?** Exact-state admission, scorer validity, provenance, idempotency, concurrency, atomic release, and forbidden side effects.
8. **Claude Cowork?** No unresolved product/creative question.
9. **What should Guy eyeball?** The exact page 6 is already approved; after release, final Reader availability and unchanged content/order identity.
