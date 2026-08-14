# Story Engine vNext — QA Bank and Wizard Cutover Decision Gate

Date: 2026-08-15
Owner decision: Guy authorized continuous implementation, QA integration, push, and a complete Wizard story run; Production remains untouched.

## Observed behavior and root cause

The autonomous pipeline now has independently audited story-text candidates for seventeen slots plus the already accepted Dini adventure, completing the six-companion by three-direction matrix. The runtime bank still serves the prior eighteen stories. Its QA catalog binds historical Visual Contract templates that were authored for those prior story texts; only two templates are adjacent to the active bank. Rebinding either template to a new source digest would be syntactically valid but semantically stale.

The new stories also intentionally contain no `imageDirection` lines. The legacy LOW renderer therefore lacks the page-local scene facts it needs when strict Visual Package enforcement is disabled for a QA audition. Importing prose alone would make the Wizard appear ready while neither the legacy LOW path nor the strict path is honestly ready.

## Nine approved implementation decisions

1. **Product-accepted text is immutable input.** Promote all seventeen independently audited candidates beside the accepted Dini story without rewriting their prose. Bind exact story and editorial-review digests plus Guy's 2026-08-15 acceptance and Claude Code's exhaustive `816f0df7..dc7f1542` PASS.
2. **Page visual directions are a separate typed authority.** Generate one closed, English scene-direction record per page from the immutable Hebrew Story Source. It may describe visible setting, cast presence, action, hero object, composition, light, and continuity references; it may not rewrite prose, invent dialogue, specify child identity traits, imitate an artist, or grant Visual Contract/Blueprint/render authority.
3. **One bounded text call per story.** Use `gpt-5.6-sol` through the Responses API, Standard service tier, `store:false`, no retry, no fallback, one structured-output call per story, and a hard corpus cap of USD 5.00. The existing credential is read only by the launcher and inherited only by the private child.
4. **Deterministic integration.** A materializer verifies source bytes, story/page identity, exact page coverage, closed keys, normalized values, continuity references, and provider receipt digests, then inserts exactly one `imageDirection:` line after each page body. Story prose remains byte-identical after removing those inserted lines.
5. **Reversible QA bank cutover.** The eighteen integrated stories replace the same eighteen `story-bank/v3-approved` slot files on this feature branch only, with new content-addressed import sidecars. Git is the byte-exact rollback. Existing unrelated bank data remains untouched.
6. **No stale visual authority.** Delete or quarantine adjacent visual-contract/location/shot-plan artifacts whose source story digest is no longer current. QA readiness v2 must bind the new story digest and page-direction digest and must not consume a historical template. Strict Visual Package/Production qualification remains false until a new source-bound package exists.
7. **Explicit QA-only Wizard readiness.** Behind the existing Preview/dev guards and `ENABLE_WIZARD_QA_RENDER_CATALOG=true`, a slot may be selectable as `qa_ready_for_low_story_generation` when story, import sidecar, page directions, and companion sheet authority all validate. This does not satisfy strict render qualification and is unreachable as an authority upgrade in Production.
8. **Prove the customer path without Production.** Validate all eighteen slots, both gender paths, 8/12/16 text pages (16/24/32 displayed pages), price binding, fake-checkout routing, story loading, page directions, and fail-closed tamper behavior. Then run one smallest end-to-end QA LOW book only if the existing QA image-generation boundary is intentionally selected; no Production alias, publication, promotion, or deployment.
9. **Independent QA before push/deploy.** Focused tests, TypeScript, `git diff --check`, and the repository gate precede a local green commit. Claude Code must independently falsify source immutability, page coverage, cost/credential attestations, stale-artifact absence, Wizard availability, and Production isolation. Push uses the authenticated `SmallHeroes` GitHub account; only the QA Preview branch/domain may be aligned afterward.

## Expected behavior

- The Wizard exposes exactly eighteen new story slots in QA.
- Each selected slot resolves the new accepted source, canonical page count, price, companion, and page visual directions.
- A QA LOW generation can proceed without pretending an old Visual Contract belongs to a new story.
- Strict Visual Package enforcement still stops before image spend when a current package is absent.
- Disabling the QA catalog flag or reverting the focused bank commit restores the previous behavior.

## Validation and rollback

Smallest proof: materialize and load all eighteen stories without provider/image calls, exercise both gender paths, then run matrix/API/checkout/story-loader tests. A single QA LOW full-book run is a product proof, not Production acceptance. Rollback is a focused revert of the accepted-source, direction, bank, catalog, and QA wiring commits plus reassignment of the QA alias to its prior Ready deployment. No database migration is required.

## Explicit exclusions

No Production deployment or alias, payment capture, storage/database write, Board approval, publication, promotion, artist imitation, model/budget/retry/fallback change, or reuse of stale Visual Contract authority.
