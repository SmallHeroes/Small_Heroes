# QA cost experiment — owner approved 2026-09-15

1. Change: isolated Flex control versus compact-context/concise-report experiment.
   No active judge, renderer, reader, calibration or release gate changes.
2. Why:29QA calls cost estimated3.340410USD; contextual14 cost2.449830, blind
   anatomy15 cost0.890580. All cached_tokens0. Full21,801-character plan repeated.
   Known serious anatomy defects still missed. Savings alone are not acceptance.
3. Scope: generic experiment transport/helpers plus four existing panda fixtures.
   This task sole writer in semantic-m1 at4a66197d, ahead28/behind0, clean start.
   Protected d53b768ccb2f and accepted-intent63ccb484 clean/read-only. No new task.
4. Hardcoding: page selection is experiment data, never runtime conditionals.
5. Files: scripts/lib/qa-cost-experiment.ts, scripts/run-qa-cost-experiment.ts,
   lib/qa-cost-experiment.spec.ts, CURRENT.md, this gate. outputs separate/local-only.
6. Expected: compare same gpt-5.5 medium/high-detail pixels and same eight categories.
   Shared fresh blind anatomy per image; two contextual arms use the SAME anatomy.
   Control retains current full context/instruction/schema; compact uses current
   state, canonical inventory, current page and book camera summary, stable refs
   before dynamic data, concise observations. Output limits unchanged10000/4500.
   Counterbalance arm order. No claim to isolate each compact-bundle subcomponent.
7. Validate: unit request contracts, projection state/change coverage, no future-state
   leakage, strict category/binding validation, served-tier check, immutable replay,
   no fallback; tsc. Four cases0/3/9/12 original image bytes. Anatomy negatives0/9
   are implementer-observed controls only, not gold all-category product approvals.
   Positive3/12 have extra conductor hands. Expectations never sent to the judge.
8. Cost: up to12new Responses calls (4shared anatomy+8contextual), Flex only, no
   images/audio.8USD conservative accounting ceiling using shared checkpoint30/M
   upper rate, not invoice hardcap.1USD admission per call, one dispatch, no retries.
   Stop on unknown outcome, non-Flex served tier, transport error or budget fence.
   Known incomplete responses remain billed and never become PASS. Same-token
   standard/Flex list-price comparison distinguished from observed token changes.
9. Rollback: stop experiment; original artifacts/runtime remain untouched.
10. Review: Guy explicitly approved running this proposed experiment and previously
    authorized existing-key reuse. No new unresolved owner choice in this scope.
    Independent Claude QA pending: falsify cost attribution, equivalence claims,
    held-to-pass conversion, frozen inputs, side effects and preservation.
11. Do not: change model/effort/0.70threshold, shorten output cap, remove image crops,
    promote diagnostic PASS, rerender, deploy, push, read other credentials, create
    keys or broaden permissions. No automatic retry on Flex unavailability.

Stop-check: general isolated prototype; no production behavior; paid small bounded
sample explicitly approved; no creative acceptance requested or inferred. Need
matched detection of known defects and no new false anatomy positives before any
quality recommendation; four-case sample cannot establish population reliability.

Official docs checked: https://developers.openai.com/api/docs/guides/flex-processing
and https://developers.openai.com/api/docs/pricing. Flex slower/occasionally unavailable;
gpt-5.5 rates2.5/.25/15USD per million input/cached/output (standard5/.5/30).
