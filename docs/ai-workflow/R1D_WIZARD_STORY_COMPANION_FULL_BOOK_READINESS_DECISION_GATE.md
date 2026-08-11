# R1D Wizard Story/Companion Full-Book Readiness — Decision Gate

Date: 2026-08-11
Base: `5e27f9496d9bec9f3def8da801c954a71ddbd887`
Branch: `codex/r1d-wizard-story-companion-full-book-readiness`

## 1. Proposed change

Make the Wizard's public catalog and the canonical render pipeline share one explicit slot authority. Every active Wizard slot must bind the exact Story Source, its matrix-owned companion, a current Style01 identity sheet, a current source-bound Visual Contract candidate, reconciliation/Blueprint inputs and a deterministic render-qualification result. A slot that lacks any required authority is unavailable before checkout or image spend.

The work also provides a QA-only full-book route that exercises the real Wizard selection, story-product truth, candidate, Blueprint and Reader contract without promoting anything to Production.

## 2. Why now?

The repository currently reports 18/18 product-sellable slots but 0/18 render-qualified slots. The Wizard derives six public categories from `MVP_STORY_MATRIX`, while legacy companion data still remains reachable in client code. All 18 approved Story Sources and all six MVP Style01 sheets exist, and 18 historical Visual Contract candidates exist under `_review/vc-live-cheap`, but only two templates are checked in and no approved Visual Package inventory exists. This is a real Wizard-to-render authority gap, not a missing-image problem.

## 3. Scope

General system change plus catalog data migration. It applies uniformly to the six MVP companions and all 18 category × direction slots. It does not add story-, child-, companion- or page-specific runtime branches.

## 4. Risk of hardcoding

High if fixed by copying the Fox/Bunny measurement overlays or by special-casing the 18 filenames. The implementation must enumerate slots from `MVP_STORY_MATRIX`, derive story/companion identities, validate generic authority contracts and use the same qualification code for every slot.

## 5. Architectural decisions

1. **Catalog authority.** `MVP_STORY_MATRIX` remains the only public Wizard catalog: six companions and 18 story directions. The broader 30-companion legacy registry remains content/reference history and dev-only data; it cannot create a purchasable slot.
2. **Single slot state.** Product availability must expose both `storyReady` and `renderQualified`. Checkout/generation may not infer render readiness from the mere presence of Markdown or an import sidecar.
3. **Companion authority.** Every active MVP companion must have an exact Style01 manifest, six present views, passed QA statuses, resemblance at or above `0.70`, and a canonical reference binding. Missing or contradictory identity data fails the slot closed.
4. **Candidate migration.** Historical `_review/vc-live-cheap` files are inputs only. A repository-owned migration validates them against current contracts and rebinds them to the current Story Source. It writes new QA candidate artifacts; it never rewrites, redigests or promotes the historical files.
5. **Blueprint/storyboard authority.** Full-book QA consumes a current page-complete Blueprint derived from the source-bound candidate and Story Source. It must preserve page-specific camera, composition, cast, action, object and location changes; generic repeated frames or measurement overlays do not qualify.
6. **Qualification boundary.** One zero-cost catalog audit reports every slot and every missing authority with closed reason codes. The Wizard API consumes that audit projection and disables a slot before checkout if it is not render-qualified for the active environment.
7. **QA versus Production.** QA may consume reviewed QA candidates through an explicit QA-only authority root. Production remains hard-blocked and cannot resolve QA candidates, local `_review`, `outputs`, measurement fixtures or dev Reader artifacts.
8. **Full-book proof.** After 18/18 zero-cost qualification, prove one complete book through the Wizard-derived QA route and Reader. Use `gpt-image-2` LOW only; persist local/QA evidence and never publish, promote or activate Production. Stop before wider spend if the qualified full-book path is not green.
9. **Migration and rollback.** Existing stories, imported sidecars, historical candidates, approved evidence and rendered outputs remain immutable. Rollback is commit-level for code plus deletion of newly generated QA-only artifacts; no previous authority becomes current by fallback.

## 6. Expected behavior after change

- The public Wizard presents only matrix-owned companions and directions.
- Every visible direction reports its exact render-readiness state from the server.
- A non-qualified slot cannot be ordered or reach image spend.
- QA can select a qualified slot in the Wizard and produce a page-complete book/Reader package using the same story, companion and authority identities.
- Production remains unavailable until separate release and product acceptance.

## 7. Validation plan

1. Zero-cost inventory and schema checks for all 18 stories and six companion sheets.
2. Migration/validation tests against all 18 historical candidates without modifying their bytes.
3. Catalog tests proving complete/disjoint 18-slot coverage and exact matrix/Wizard/order identity.
4. Negative tests for missing sheet view, stale source digest, invalid candidate, missing Blueprint page, duplicate slot, legacy companion injection and QA-root use in Production.
5. Wizard API/order and chunk-runner qualification regression tests.
6. TypeScript, focused tests and one repository `npm run check` after focused PASS.
7. Independent Claude Code review of the immutable implementation range.
8. One complete LOW QA book only after the zero-cost gates are green.

## 8. Cost impact

Investigation, migration, compilation, validation, Wizard wiring and qualification are zero-cost. No provider call is needed merely to ingest the 18 existing candidates. Any later image proof is LOW and limited to one complete selected QA book; Production, Vision, audio and fallback are excluded.

## 9. Rollback plan

Revert the focused implementation commits and remove only newly created ignored QA output roots. Preserve all source stories, historical `_review` candidates, prior evidence, renders and remote deployments byte-for-byte. The Wizard then returns to the prior matrix behavior while Production remains blocked.

## 10. Review assignment

Guy's standing instruction authorizes continuous execution toward a Wizard-connected full-book QA proof. Codex owns the implementation and does not self-award product or independent technical PASS. Claude Code must falsify slot completeness, source/companion/candidate bindings, QA/Production isolation, full-page Blueprint uniqueness, order gating and lack of fallback. Guy retains visual/product acceptance of the resulting book.

## 11. Do not do

Do not enable Production; infer approval from historical candidate files; expose the 24 non-MVP companions as sellable; weaken the `0.70` resemblance gate; use story-specific runtime literals; silently fall back to legacy contracts; rewrite historical evidence; access storage/database/Board; publish/promote/deploy Production; or render more than the one approved QA full-book proof.
