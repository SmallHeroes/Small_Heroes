# Decision Gate: length-scaled personal book output budgets

## 1. Proposed change

Replace the diagnostic runner's fixed storyboard/review caps with one validated
length policy. Use that policy in reservation, runner dispatch, SDK validation
and the operator GET status. Continue in the existing Codex implementation chat,
sole writer on `codex/personal-book-storyboard-bridge`, base `bcd8a226`.

## 2. Why now / observed versus expected

Claude issued HOLD with one P2 on `07d3c8d3..bcd8a226`. The code really supplies
12,000 storyboard and 6,000 review output tokens with medium reasoning, for every
length. A 16-spread book has 17 illustrated frames and 75 review observations.
Output includes reasoning; cap exhaustion can return incomplete without useful
visible text. This is a verified configuration risk, NOT an observed live failure.

Official guidance recommends initially allowing at least 25,000 tokens for
reasoning plus visible output. The repo's authoring precedent uses a 32,000 floor
and about 3,000 per page. Neither establishes the exact need of this new pipeline.
Sources: https://developers.openai.com/api/docs/guides/reasoning#allocating-space-for-reasoning
and `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts:309`.

## 3. Scope / root cause / contributing factors

General diagnostic-system correction, not a story patch. The old caps ignore
frame/check counts, and the reservation and SDK guard reuse those undersized caps.
There is no live calibration. JSON byte lengths are not output-token counts.
The base writer's separate 5,000/12,000 limits remain unchanged and unreviewed.

## 4. Policy and rejected alternatives

- Storyboard: max(32,000, 3,000 * (spreads + cover)).
- Review: max(32,000, 16,000 + 512 * actual required check count), rounded up to
  1,000. Count comes from the existing seven book groups and four per-frame groups.
- Result for 8/12/16 spreads: storyboard 32k/39k/51k; review 39k/47k/55k.

The review allowance is an initial engineering estimate for concise observations,
including reasoning headroom, not a promise to fit every maximum-length field.
Both configured models document a 128k output maximum, above these per-call caps.
Keep medium reasoning, every check, the 1,200-character validation bound, complete
coverage, no retry/fallback and fail-closed handling. Reject lowering reasoning,
truncating reviews, silently raising the money ceiling, or presenting offline
success as a real book. Live usage calibration is the next evidence step after QA.

## 5. Likely files / dependency order

`book-config.ts` pure policy/reservation -> runner -> OpenAI adapter -> local GET
status -> runner/real-route regression tests -> fresh evidence and CURRENT/ROADMAP.
No dependency/schema migration, UI change, shared compiler edit or site merge.

## 6. Acceptance criteria

Every supported length uses identical caps in calculation and actual SDK payload.
Invalid lengths and wrong caps fail closed. Full four-stage reservation happens
before key/provider access. GET lists all length reservations without a misleading
flat quote. Insufficient money is refused before any paid attempt. Existing
accounting, incomplete-response handling, cancellation and holds remain intact.

## 7. Validation / risks

Mocked real SDK payloads for all three lengths, all required groups, independent
reservation arithmetic, under-budget HTTP refusal before key access, wrong-cap
negative cases. Run tsc, focused suites and full `npm run check`, preserve prior
logs and distinguish a red full gate from focused success. No live call is needed
to fix cap wiring; offline tests cannot prove adequacy or creative quality.

## 8. Cost impact / owner authority / stop-check

This milestone costs $0. Existing approval to implement and fix valid QA findings
covers the narrow correction; no new paid run is authorized by this document.
Keep the existing $10 configured ceiling. With existing rate cards, long Astra's
new reservation exceeds $10, so it must refuse before key access; never downscale
the caps to fit a budget. GET must make this visible. A future larger-budget
pilot requires a separate owner decision, not an automatic env change.

Stop-check: general across stories/companions; local default-off diagnostic only;
no production/images/anchors/payments/QA thresholds; no money; smallest proof is
mocked real consumer + SDK. No unresolved creative/product decision here. Guy will
judge an actual story/sample only after its separate technical and live gates.

## 9. Rollback

Revert this focused correction after preserving its evidence. No migration or
artifact deletion. Returning to the base returns to Claude's HOLD, not readiness.

## 10. Review assignment

Claude Code re-gates the correction and whole runner read-only, attacking cap and
reservation agreement, invalid lengths, real payloads, pre-key budget refusal,
and accidental weakening of existing tests. No independent PASS awarded by Codex.
Earlier writer/bridge QA and full repository stability stay open.

## 11. Do not do

No key load, provider/render/audio, push, deployment, site work, cap overrides,
retries, automatic approval, changed prose or mutation of prior evidence.
