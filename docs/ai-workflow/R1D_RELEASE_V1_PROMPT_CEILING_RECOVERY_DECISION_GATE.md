# R1D release/v1 image-prompt ceiling recovery — Decision Gate

**Date:** 2026-09-02
**Trigger:** the approved Lavi/Chameleon release Order `cmtj2vvrw0002ju04a9covxqv` reused its accepted child anchor, completed the cover and pages 1–6, then page 7 failed before image bytes because the exact GPT Image request was 32,603 characters against the provider's 32,000-character limit.

## 1. Proposed change

1. Remove redundant prose copies of PVB frame fields from the Style 01 render prompt while retaining one exact serialized Runtime Blueprint frame, one Visual Contract facts block, the typed action-geometry authority, and all identity/style/safety locks.
2. Add an exact final-wire GPT Image prompt ceiling assertion so an over-limit request fails locally before reference downloads or a provider call.
3. Add an authenticated, Preview-only `release/v1` recovery operation that atomically re-pins an exact failed, retryable job from its expected old immutable deployment to the current immutable deployment. It may clear only failure/lease state and requeue the same job; it must preserve the Order, payment, frozen package/source binding, Book, cover, existing pages/assets, completed-page evidence and attempt counters.

## 2. Why now?

This is the current release-proof blocker. The provider rejected page 7 before rendering, and immutable release continuity correctly prevents corrected code on a new deployment from silently taking over the job. Retrying payment, creating another Order, using a legacy resume route or running the old deployment would either violate the release contract or reproduce the failure.

## 3. Scope

This is a general system correction for every package-backed Style 01 render and every reviewed Preview recovery of a failed `release/v1` job. The incident Order is evidence and the recovery target, not a runtime special case.

## 4. Risk of hardcoding

No story key, child, companion, page number or Order ID may enter runtime implementation. A regression may load the approved dense Chameleon package as a realistic fixture, but production logic must operate from typed frame authority and expected immutable state.

## 5. Files likely affected

- `lib/style01-prompt-assembly.ts`
- `lib/generate-image.ts`
- `lib/generation-pipeline/release-v1-recovery.ts`
- `app/api/release/v1/generate/resume/route.ts`
- focused prompt/provider and release-recovery tests
- release route tracing/middleware declarations only if required by the existing routing contract
- `CURRENT.md`

## 6. Expected behavior after change

- Dense PVB pages stay below the exact 32,000-character GPT Image request limit with explicit headroom without truncating authority.
- The provider receives the Blueprint frame exactly once and Visual Contract facts exactly once. Camera, placements, action, cast, props, continuity, geometry, wardrobe, identity, style and safety requirements remain authoritative.
- Any future overflow fails before network/provider work with an actionable measured error.
- A reviewed Preview recovery can resume only the exact failed, retryable release job whose frozen binding and previous continuity match the request. The new continuity is derived on the server from the current immutable deployment, not supplied by the caller.
- Resume recomputes persisted progress, reuses the cover and pages 1–6, and renders only missing pages 7–8 before audio/package stages.

## 7. Validation plan

Zero-cost validation first:

1. Provider-boundary regression over the approved dense page-7 package, measuring the exact request after reference prefix and negative prompt and requiring `<= 32,000` with headroom.
2. Authority-preservation assertions for the one Blueprint marker, one facts marker and surviving frame/contract/typed-action/identity categories.
3. Synthetic overflow assertion proving rejection occurs before provider I/O.
4. Recovery tests covering authentication/environment gates, binding and old-continuity mismatch, non-retryable/leased/held jobs, CAS loss, preserved cache/progress/assets, and one dispatch only after a successful commit.
5. Relevant Vitest suites, `npx tsc --noEmit`, `npm run check`, build as required, and `git diff --check`.
6. Independent Claude Code review of the focused immutable commit range before mutating the live job.
7. After PASS: deploy one corrective Preview, dry-run/inspect the exact Order, perform one guarded recovery, monitor to terminal status, then inspect Reader, page assets, audio/package evidence and absence of another Order/payment.

No test image is needed before the existing Order resumes.

## 8. Cost impact

Implementation and tests cost $0 in image/audio APIs. The authorized recovery reuses the accepted anchor, cover and pages 1–6. Expected new image work is only pages 7–8 at GPT Image LOW, subject to the existing bounded visual-QA retry policy, followed by the already-selected Dad narration and package work. No duplicate checkout, payment or Order is allowed.

## 9. Rollback plan

Revert the focused code commit and do not invoke recovery. If recovery has already committed, the job remains bound to immutable persisted assets and can be failed/held again without deleting them; no rollback may erase the Order, payment, Book, page/image rows or storage bytes. Production remains untouched throughout this Preview proof.

## 10. Review assignment

Guy has already authorized technical recovery and completion of this same Order, with the explicit constraint that no additional Order be created. No unresolved product or creative choice remains.

Claude Code must try to falsify: authority loss or hidden truncation; an actual wire prompt above 32,000; differences on the legacy/non-PVB path; recovery without exact binding/continuity/auth/environment/failed+retryable/no-lease/no-hold predicates; cache or completed-asset reset; double dispatch; and any path that could create or repay an Order.

Claude Cowork is not needed because no product, story, UX or creative direction changes.

Guy should eyeball the final recovered pages and Reader after technical PASS; visual acceptance is not inferred from tests.

## 11. Do not do

- Do not truncate or summarize authoritative Blueprint/contract fields.
- Do not change the frozen source, package, Blueprint, model, quality, reference policy, resemblance threshold, QA budgets, payment state or Production deployment.
- Do not rerender the child anchor, cover or completed pages 1–6.
- Do not call payment confirmation, legacy generation/resume routes or create another Order.
- Do not expose a general unauthenticated recovery surface or accept a caller-authored target deployment.
- Do not push without Guy's explicit request.

## Stop-before-major-actions answers

1. **General or story-specific?** General PVB egress and exact release-job recovery; the current Order is only the incident and final proof.
2. **Could another story/style break?** PVB Style 01 prompts and release recovery are affected; legacy/non-PVB and other styles must remain unchanged and are regression-tested.
3. **Production behavior?** Code is production-capable, but this milestone deploys and mutates only QA Preview. Production alias/environment is excluded.
4. **Spend money?** No during implementation/QA. The final already-authorized resume may render only missing pages 7–8 at LOW plus existing bounded retries and narration.
5. **Smallest validation?** Exact prompt planning and mocked-provider tests, then one guarded resume of the existing job after independent PASS.
6. **What must Guy decide?** Already decided: finish this same Order and do not create another.
7. **What should Claude Code falsify?** Authority preservation, final-wire ceiling, legacy isolation and every recovery predicate/preservation claim.
8. **Claude Cowork?** No; there is no new product/creative decision.
9. **What should Guy eyeball?** Final pages 7–8 and the complete Reader once technical gates pass.
