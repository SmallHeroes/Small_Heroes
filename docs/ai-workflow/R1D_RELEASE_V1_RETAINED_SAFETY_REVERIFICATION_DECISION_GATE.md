# R1D release/v1 retained-byte safety re-verification — Decision Gate

**Date:** 2026-09-02
**Trigger:** the reviewed recovery inspection for the existing paid Lavi/Chameleon Order stopped before mutation because retained page 6 was not durably safety-cleared. Runtime evidence shows one successful page render/upload followed by one visual-QA call and two same-image retries, all ending `vision_malformed`; the durable result is safety unverified, not a confirmed hazard.

## 1. Proposed change

Extend the authenticated Preview-only `release/v1` recovery operation so a retained artifact with `safetyVerified=false`, no confirmed hazards, empty overrides, an exact durable content SHA, and a current stored QA context can be re-verified on the exact already-stored bytes. The operation downloads and fully decodes the allowlisted asset once, hashes those bytes, durably consumes one safety-evaluation claim keyed by the database snapshot before any provider call, supplies those same bytes to bounded visual QA, runs world QA when the frozen context requires it, and permits recovery only on a full verified pass with `safetyStatus=safe` and an empty hazard list.

On success, one short transaction must lock and compare the complete recovery snapshot, atomically persist matching Gate-1 `QualityEvidence` and Gate-2 asset safety fields for the same SHA, increment the delivery-input version through the existing mutation barrier, perform the existing same-Order/job recovery transition, and dispatch only after commit.

## 2. Why now?

The current recovery correctly fails closed but cannot distinguish recoverable evidence transport failure from a confirmed unsafe image. The existing general quality-recovery path can re-QA stored bytes but updates only Gate 1; the retained asset's readiness-independent Gate-2 signal remains false, so the job cannot legally resume even after a positive same-byte result.

## 3. Scope

This is a general release-recovery rule for retained cover/page assets. No child, story, page number, Order ID, payment provider, or deployment URL enters production logic. The current Order is the runtime proof only.

## 4. Risk of hardcoding

No incident literal may enter runtime implementation. Eligibility and compare-and-swap predicates derive from durable artifact identity, URL, SHA, stored QA context, evaluator version, frozen contract binding, safety fields, overrides, Order authority, and release continuity.

## 5. Files likely affected

- `lib/generation-pipeline/asset-integrity.ts`
- `lib/generation-pipeline/page-visual-qa.ts`
- `lib/generation-pipeline/release-v1-recovery.ts`
- `lib/generation-pipeline/readiness-manifest.ts`
- `lib/generation-pipeline/types.ts`
- focused asset, QA, safety-writer, recovery, and route tests
- `CURRENT.md`

No Prisma migration is expected.

## 6. Expected behavior after change

- Already safe retained assets remain byte-for-byte and behaviorally unchanged.
- A retained unverified/hazardless asset is inspectable only when its exact bytes, safety SHA, current evaluator/contract binding, stored QA context, and empty override state are coherent.
- Before provider access, Apply atomically consumes one claim keyed by Order plus database-snapshot digest. Replays, concurrent calls, different UUIDs, or different deployments cannot re-evaluate the same durable state.
- Apply evaluates the already-downloaded bytes, never a second mutable URL fetch, with a maximum of three provider-side Vision calls total. Required strict-crib and world checks reserve capacity from the same allowance before malformed/transport re-QA is granted; world QA has its own bounded timeout.
- Only `verified_pass` + `safe`, plus world pass when required, may write a positive safety signal and resume.
- Any non-empty hazard list dominates a contradictory status or verdict and is durably written to both safety gates. Existing hazards, visual/world failures, skipped/error/timeout/malformed evidence, missing context, or any state drift remain blocked. No known hazard is cleared or reinterpreted.
- Gate-1 evidence, Gate-2 signal, input-version invalidation, recovery audit, Order/job state, and cache continuity commit atomically. Dispatch occurs once after commit.

## 7. Validation plan

Zero-image-cost validation:

1. Asset inspection regression proving returned bytes, full decode metadata, and SHA describe the same payload while preserving SSRF, redirect, timeout, byte-cap, and pixel-cap protections.
2. Same-byte re-QA tests proving the identical data URL is reused, retries are bounded, and logs never contain the image/base64 or customer asset URL.
3. Recovery tests for unverified/hazardless eligibility; malformed/malformed/pass; persistent unknown; skipped; visual failure; world failure; confirmed or contradictory hazard; pre-existing hazard rejection; missing context; SHA/URL/asset/context/contract/evaluator/override/snapshot drift; a pre-provider database-snapshot claim shared across UUIDs; atomic dual-gate write; input-version bump; ambiguous-commit replay; one dispatch; and unchanged commercial/product bytes.
4. Existing safe recovery behavior remains unchanged.
5. Relevant Vitest suites, `npx tsc --noEmit`, `npm run check`, build, and `git diff --check`.
6. Independent read-only Claude Code review of an immutable commit range before any live QA call or database write.
7. After PASS, deploy one new immutable Preview, inspect the existing Order, apply one guarded attempt, and monitor the same Order to terminal status. Verify no second Order/payment exists.

## 8. Cost impact

Implementation/tests use zero image/audio renders. Live safety re-verification may use at most three provider-side Vision calls total on each eligible retained artifact, inclusive of any required strict-crib or world check; the incident is expected to require page 6 only. The database snapshot can consume this allowance only once. No image generation occurs during this milestone. After successful recovery, the already-authorized same Order may render only missing pages 7–8 at LOW under existing bounded policies and produce its selected narration/package.

## 9. Rollback plan

Before apply, revert the focused code commit and do nothing to runtime state. Apply first records only a fail-closed, snapshot-keyed evaluation claim; an indeterminate result cannot spend the same snapshot again. A confirmed hazard records negative evidence in both gates, while every other blocked result writes no positive signal and does not resume. A successful apply records exact byte/evidence/recovery audit and leaves all generated assets intact; any later failure remains recoverable without deleting the Order, payment, Book, pages, or storage objects. Production remains untouched.

## 10. Review assignment

Guy has authorized finishing the same Order with broad technical discretion and explicitly prohibited creating another Order. No unresolved product decision remains.

Claude Code must try to falsify exact-byte proof, data leakage, hazard erasure, missing/stale context acceptance, dual-gate atomicity, input-version invalidation, lock/CAS completeness, idempotency, double dispatch, payment/Order mutation, and any implicit render.

Claude Cowork is not required because no product, story, UX, or creative direction changes.

Guy retains final visual acceptance of the completed Reader.

## 11. Do not do

- Do not create, repay, clone, or restart checkout for an Order.
- Do not manually flip safety fields, delete detector findings, or use an operator override for unverified evidence.
- Do not re-render the anchor, cover, or retained pages 1–6.
- Do not weaken the resemblance threshold, quality gates, retry budgets, model/quality pins, frozen story/package authority, or release continuity.
- Do not expose image bytes, data URLs, QA prose, secrets, or customer asset URLs in logs/responses.
- Do not mutate or alias Production.
- Do not push without Guy's explicit request.

## Stop-before-major-actions answers

1. **General or story-specific?** General retained-asset recovery; the incident Order is only proof.
2. **Could another story/style break?** Only the reviewed release/v1 recovery path changes; already-cleared assets retain existing behavior and focused regression coverage is required.
3. **Production behavior?** Production-capable code, but runtime proof is Preview-only and Production is excluded.
4. **Spend money?** No image/audio spend in implementation. At most three same-byte Vision checks for the incident page, then only the previously authorized missing-page/narration work.
5. **Smallest validation?** Mocked exact-byte tests, independent QA, then one inspected same-Order Preview recovery.
6. **What must Guy decide?** Already decided: complete the same Order; create no additional Order.
7. **What should Claude Code falsify?** Byte identity, safety fail-closed behavior, dual-gate atomicity, races, privacy, idempotency, and unchanged payment/assets.
8. **Claude Cowork?** No; no new product or creative choice.
9. **What should Guy eyeball?** The final complete Reader, especially recovered downstream pages 7–8; technical QA does not self-award visual acceptance.
