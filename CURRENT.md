# SmallHeroes — Current Technical State

**Updated:** 2026-07-23
**Maintainer:** Codex
**Working branch:** `codex/r1d-board-spoiler-safe-authority` in `C:\Users\guyna\.codex\worktrees\3f43\Small_Heroes`, based exactly on approved R1D-PREP-RERUN head `f5a248a0887cfc6e841a4a5040d2447eafee9fcc`; implementation commit `94678097568f2e874792f93539ed171859a3f41d`. The prior R1D-PREP-RERUN worktree at `C:\Users\guyna\.codex\worktrees\df0a\Small_Heroes` is read-only evidence. Canonical main and every other worktree/branch remain untouched.

## R1D Board Spoiler-Safe Authority - implemented locally; independent QA pending

Guy approved the Decision Gate and all four product/architecture decisions for this zero-cost code milestone. The implementation is committed locally at `94678097568f2e874792f93539ed171859a3f41d` (`feat: add spoiler-safe board and prop authority`), with immutable implementation range `f5a248a0887cfc6e841a4a5040d2447eafee9fcc..94678097568f2e874792f93539ed171859a3f41d`. This is not independent technical PASS, product acceptance, board approval, visual-package approval/promotion, render qualification, or render authorization.

### Verified root cause and implemented general authority

- The prior `set-board/v1` projection included all authored prop-bound geometry and asked for one continuous full-set view. Registry/runtime selection was set/location-only, and board QA did not establish page spoiler compatibility or exact prop count/placement. The historical Fox board therefore visibly exposed and duplicated the reveal-gated bucket before page 5.
- Set Board authority is now explicitly `set-board/v2` / `set-registry/v2`, with a canonical `set-board-content/v1` policy digest. A reusable board contains only stable materials, lighting, environment, and structured spoiler-neutral geometry. Lifecycle-gated/transient props, prop-bound nodes, dependent relations/fixed facts, page effects/actions, and free-form topology prose are deterministically excluded.
- Board prompts use local neutral area aliases rather than story-authored zone IDs, carry explicit negative excluded-prop authority, and define one physical instance per included recurring prop. Board QA now checks excluded content plus exact count and placement. The historical v1 Fox artifact and its asset SHA-256 `30392c033bba385738ba7399efa78135f869d2b222b3e86ff7a42f8ed0c75083` are unchanged evidence and fail closed for v2 authority.
- The strict authoring schema/compiler now carries `RecurringProp.firstRevealPage` and structured page `propConstraints`. Shared lifecycle functions resolve required/forbidden prop IDs for cover/page contracts. Validation rejects a required prop before its reveal and requires complete explicit pre-reveal page prohibitions; compiler-owned cover prohibitions include every lifecycle-gated prop. Runtime also removes structurally forbidden `propState` from visible recurring-object projection.
- Visual package authority is now `visual-package/v2` / `visual-package-promotion/v2` / `runtime-visual-authority/v2`. Exact v2 board content-policy identities and approved prop-reference catalog/artifact identities flow through candidate preparation, promotion, qualification, frozen authority, and runtime checks. Legacy v1 manifests and boards fail closed as structured validation failures.
- A general page-conditioned reference resolver selects the base set board and only catalogued prop artifacts explicitly required by that exact page. It rehashes local prop bytes, binds artifact/catalog approval identity, validates every set/prop reference's declared visible prop content against the page/cover contract, and blocks forbidden or undeclared content before a render callback can run.
- The same preflight authority is wired into cover, page batch/resume, and single-page regeneration. The provider boundary independently re-resolves the exact references for direct, retry, QA rerender, and regeneration paths. Required prop/set references have explicit roles and priority; only optional style references may be evicted by the budget.
- Legacy isolated-object heuristics no longer choose enforced-path prop authority from story key, page number, object name, or persistence prose. The old structured opt-in remains only for the legacy enforcement-off zone-sheet path.

### Fox data migration and observable result

- `prop_tin_bucket.firstRevealPage` is structured as page 5 through the normal Fox visual-contract template. Pages 1-4 explicitly forbid it and page 5 explicitly requires it; the cover has lifecycle-derived bucket/drip prohibitions. Stable set prose that previously leaked bucket/drip content into the board projection was neutralized.
- `story-bank/v3-approved/fox_uri_adventure.prop-references.json` binds the already Guy-approved isolated asset `story-bank/v3-approved/fox_uri_adventure.zone-sheets/balcony_drip_area/bucket-object.png`, SHA-256 `60ee317551759e42e08dba592b52d206ec4ed22e47d85a43789acfd977b869bc`. No new asset was generated, copied, uploaded, or approved.
- Cover and pages 1-4 resolve the same spoiler-neutral base board and no bucket reference. Page 5 resolves that same board plus exactly one approved bucket reference. Generic synthetic coverage proves projection/filter/reference/preflight behavior; the Fox case is the data migration exercising the general mechanism.
- The prior R1D-PREP-RERUN candidate remains HOLD and was not patched, promoted, qualified, or used as runtime authority. A future candidate must be regenerated pure under the new v2 identities and remains separately gated.

### Validation, known baseline, and limits

- Final focused compiler/Fox/set-board/package/preflight/runtime suite: **PASS - 18 files / 359 tests**.
- `npx --no-install tsc --noEmit`: **PASS** after final changes.
- Literal `npm run check` reached TypeScript **PASS** and Vitest's established assertion baseline: **248 files total; 227 passed, 16 skipped, 5 failed; 2,351 tests passed, 65 skipped, 6 failed**. Those six failures are exactly the previously documented missing ignored-output fixtures in `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`, `set-appearance-ref-budget.spec.ts`, and two cases in `story-read-back-validation.spec.ts`. No ignored output fixture was imported or copied.
- A later literal rerun again displayed only those six fixture failures and passed the release-check CLI, then the Windows/Node Vitest worker ended with `ERR_IPC_CHANNEL_CLOSED` before printing its aggregate summary. `release-check-cli.spec.ts` passed in isolation (**1 file / 2 tests**). The earlier complete-summary run above is the precise assertion baseline; the final 18-file load-bearing suite covers the later code changes.
- `git diff --check`, staged diff check, story-specific-literal scan, runtime legacy-version scan, and the exact bucket asset SHA check passed.
- This worktree uses an ignored local copy of the existing canonical dependency tree because it was provisioned without `node_modules`; no dependency installation or network access occurred.
- Zero image/audio render, provider/live LLM/product API call, storage/database read-mutation or write, storage URL resolution/upload, migration, deployment, flag change, package/board promotion or approval, threshold change, or push occurred. The protected resemblance threshold remains `0.70`.
- No v2 Fox board has been minted or rendered. The historical v1 board cannot satisfy v2 authority. Stories without reveal-gated props preserve lifecycle behavior, but every legacy v1 board/package intentionally requires the explicit safe v2 migration path: offline projection, separately authorized board render and human QA, then separately gated v2 candidate preparation/promotion.

### Next gate

Claude Code must perform the first independent read-only adversarial review against the immutable branch/range above and try to falsify the projection, lifecycle, reference compatibility, caller coverage, budget, offline-qualification, and migration claims. Codex must validate and fix any valid findings in a separate milestone and return for re-gate. Guy then owns product acceptance. Any v2 board render, candidate regeneration, package approval/promotion, or paid/external boundary remains separately gated.

## R1D-PREP-RERUN Fox visual-package candidate - prepared, unapproved, and unpromoted

Guy explicitly authorized the zero-cost offline rerun after accepting/closing R1D-FIX and its documentation micro re-gate. The supplied worktree was clean and detached at exact accepted base `371e470decc249c668b76abf7fba91489eae3fbc`; Codex attached only `codex/r1d-fox-package-prep-rerun`. The accepted extractor/compiler/candidate lifecycle now produces a real human-reviewable Fox candidate without the prior source-fidelity blocker. This is candidate preparation only: it is not independent technical PASS, package approval, product acceptance, promotion, render qualification, or render authorization.

### Current source, compiler, and review evidence

- The actual offline extractor recomputed `story-bank/v3-approved/fox_uri_adventure.md` as `story-source/v1`, normalized UTF-8 SHA-256 `02629e886a9aaa1e714d9a8d652c24d94ca5843465ff8a9cb70d320a24e2231c`, with exactly pages 1-12. Generated ignored source `outputs/r1d-fox-package-prep-rerun/sources/fox_uri_adventure.source.json` has raw SHA-256 `dc68986428170c364ead55afdcb02fdda67174b4d97b44a7e5d4e416c59c1d05` and canonical digest `8b5773141572dd2bccde806effc5d00e7a0f8cf47d3679ad4eb5dbf17837127f`.
- Current tracked authority is unchanged: location-bible raw SHA-256 `1065f74173ebef138e5d295c861bc820c58f85d0e5359edae1319a11431de762`; corrected template raw SHA-256 `6e3c1293641223b749199b647110e39dfd758b26f2afdd4488b8b74ae21df5a3`, canonical digest `c4215b8fba8faa94968e2db3f3c5c59785fe5844db96a982197456c2f2770112`.
- The accepted offline compiler used that current tracked template as its fixture draft. Frozen original R1D-PREP was used only as the read-only previous-template comparison (`8733a15b...` raw / `4f75dad5...` canonical) so the generated human review visibly demonstrates the resolved blocker rather than hiding it behind current-to-current parity.
- Generated candidate template `outputs/r1d-fox-package-prep-rerun/candidate/fox_uri_adventure.visual-contract-template.json` has raw SHA-256 `d48c2d762ecbf5afa64c499b4440d3697489d74020f3796c7f87934a28bb6658` and canonical digest `35ad5728e6d97177bd609a0b563506d4de1dfc58263bce33151f5588df94d4b8`. Exact structural comparison proves its only difference from the current tracked corrected template is compiler-owned historical `provenance.model`: generated fixture provenance says `gpt-5.5-pro`; the tracked artifact truthfully retains original live-authoring provenance `gpt-5.5`. No model call occurred.
- The candidate cover is exactly `loc_child_room / z_room_window`, cast `["child:hero","companion:fox_uri"]`, with bedroom/listening-window mystery anchors. `mustNotShow` includes visible/metal bucket, drip source, falling water, water-catching object, and rhythm marks plus the authored drift list. Candidate source-fidelity conflicts are empty.
- Generated review `fox_uri_adventure.visual-contract-review.md` has raw/normalized SHA-256 `add950d1241a04ce17569bae9b660348749a2947bb5a2ca9fe36eb30871103b3`. It visibly reports `locationId`, `zoneId`, `castIds`, `mustShow`, `mustNotShow`, the deterministic page-0 mapping, zero candidate conflicts, every original-template conflict, and exact old/new values. It does not make a false parity claim.
- Generated provenance `fox_uri_adventure.visual-contract-provenance.json` has raw SHA-256 `1b23ac31c9385e6af0c49d534820984500c4278b952ae257f5069a390e9cbc83` and canonical digest `8a8749ff83731ea3f94faf2dd19dcb59b5290d05fefe196caa13d0e1a6cc4083`. Review and provenance bind the same source-input digest, story identity, and candidate template digest.

### Candidate package, board binding, and fail-closed state

- The established `promote-visual-package` candidate mode created `outputs/r1d-fox-package-prep-rerun/candidate/fox_uri_adventure.visual-package.json`; raw SHA-256 `b7376f7c578b46182039b8d1b5974c66709753307b86834ad244de8ef1cfca7d`, canonical digest `1d89f0f40e0521b9638b30dfaafb5fd2db22ba9c567b4951e7353bd09b80e87e`.
- It remains `state: "candidate"`, with `approval: null` and `promotion: null`. Guy's already-decided `review.worldMode: "grounded_with_visual_metaphor"` is recorded in the schema-supported review field; `authoredBy`, `reviewedBy`, and `reviewedAt` remain null because no identity or timestamp was invented.
- Coverage binds a cover plus exactly pages 1-12 (`coverDigest` `78aa5e9f...`, `pageContractsDigest` `219fc5ff...`). Candidate evidence binds source input `8b577314...`, review `add950d1...`, and provenance `8a8749ff...`.
- Both `loc_child_room` and `loc_balcony` still require only `set_room_balcony_night`. The package binds the existing registry artifact canonical digest `83609468ea50aed1533930f136e1557989c956809b687a233c2b20e9a7ddccc4`, Git blob `30ab0884b5a9f5d4e1ad8a4c059b26196fb6b259`, definition hash `aaa469afd9c6b0b15fa06d44d64045ba26787988fd2f58740527c2512c1f1f05`, durable storage key `set-identity-boards/fox_uri_adventure/soft_hand_drawn_storybook/set_room_balcony_night/aaa469afd9c6b0b15fa06d44d64045ba26787988fd2f58740527c2512c1f1f05.30392c033bba385738ba7399efa78135f869d2b222b3e86ff7a42f8ed0c75083.png`, and approved asset SHA-256 `30392c033bba385738ba7399efa78135f869d2b222b3e86ff7a42f8ed0c75083`. No URL was resolved and the complete `set-identity-boards/` tree is unchanged from frozen R1D-PREP.
- Pure candidate re-preparation matches the generated manifest before the one explicit `worldMode` decision; basic manifest issues, cover source-fidelity issues, and runtime-world-authority issues are empty. A no-write promotion dry-run fails exactly with `approval_missing` and `review_metadata_missing`. Direct qualification/preflight remains false with only `approved_package_missing`. `visual-packages/approved/` remains absent.

### Validation and limits

- Before and after literal `npm run render-qualification-audit`, with `ENABLE_V3_APPROVED_BANK` unset: **18 nominal slots, 6 product-sellable, 0 render-qualified**. Fox reports only `approved_package_missing`; candidate preparation did not change catalog authority.
- Focused compiler/Fox/location/package/preflight/release/board suite: **PASS - 8 files / 89 tests**.
- `npx --no-install tsc --noEmit`: **PASS**.
- Literal `npm run check`: TypeScript **PASS**; Vitest **FAIL - 247 files total: 225 passed, 16 skipped, 6 failed; 2,336 tests passed, 65 skipped, 7 failed**. Six failures are the already documented absent ignored-output fixtures in five files; the seventh was a full-load 5-second timeout in `order-authority-guard.spec.ts`. That guard passed immediately in isolation (**1 file / 7 tests**). A diagnostic `npm run check -- --silent --reporter=json` rerun reproduced only the known fixture baseline: **2,337 passed, 65 skipped, 6 failed** in the same five fixture-dependent files. No ignored fixture was imported or copied.
- The worktree uses an ignored junction to the existing canonical dependency install; no dependency installation occurred. Generated candidate/evidence files remain ignored and are not committed.
- Zero image/audio render, provider/live LLM/product API/network call, storage/database action, storage URL resolution, migration, deployment, flag change, approved-package write, approval, promotion, release, render qualification, threshold change, or push occurred.

### Required review gates

The candidate is ready for independent read-only Claude Code adversarial QA and for Guy/Claude Cowork product review of the human-facing package. Claude Code must falsify source/template/review/provenance/board identity, full coverage, page-0 fidelity, truthful review output, no-write boundaries, and unchanged audit state. Guy decides whether the candidate's world, cover, set reuse, continuity plan, and prohibitions are product-acceptable. Any later completion of reviewer identities/timestamps, package approval, promotion, or one-LOW-page proof requires its own explicit authority.

## R1D-FIX Cover Source Fidelity - independent technical QA PASS; accepted and closed

Guy approved the focused zero-cost Decision Gate after the R1D-PREP stop. The product decision is explicit: the Fox cover stays inside the child's bedroom at the listening window and preserves the mystery. It must not show the bucket, drip source, falling water, any water-catching object, or rhythm marks. Whole-book reviewer-owned `worldMode` remains `grounded_with_visual_metaphor`; page-0 prohibitions override that permission on this cover. Implementation is committed at `645f706c` (`fix(visual-contract): enforce cover source fidelity`) on `codex/r1d-cover-source-fidelity`, based exactly on frozen R1D-PREP `5cf68a00`. Independent read-only Claude Code QA reviewed the implementation plus the `8171902c` handoff and returned **PASS (R1D-FIX only)** with all 11 claims proven. The QA correctly found that the original no-upstream/unpushed handoff statement had become false. Remote-tracking reflogs record separate pushes through `8171902c` and `2a73afc4`; Codex attests that it performed neither push. On 2026-07-23 Guy explicitly confirmed both pushes were intentional and authorized, accepted/closed R1D-FIX, and authorized this `CURRENT.md`-only correction. These are durable historical and authority facts, not a claim about any current or future ahead/behind snapshot.

### Corrected general behavior

- The offline source extractor now carries explicit location-bible page-0 authority into the compiler source: source zone, visible anchors, page action, forbidden drift, structured hidden objects, and explicit cover cast.
- One pure compiler-owned mapping resolves the authored source-zone vocabulary to the contract zone graph by exact/canonical ID identity. Zero or multiple matches fail closed; no LLM, prose similarity, page-1 fallback, or story-specific branch chooses the cover.
- When page 0 is explicit, it overrides stale draft cover location, zone, cast, and positive content. Its `forbiddenDrift` plus `visualSpoilerPolicy.hiddenObjects` are projected into `mustNotShow`; hidden spoiler content cannot survive in `mustShow`.
- The human review now diffs all material cover fields: `locationId`, `zoneId`, `castIds`, `mustShow`, and `mustNotShow`. It separately reports candidate and previous-template source-fidelity conflicts and cannot claim parity while any listed field differs.
- The same read-only fidelity gate runs during candidate preparation, promotion, and render qualification. Because shipped Style01 preflight already requires `evaluateRenderQualification`, a structurally valid but page-0-contradictory cover now fails before provider dispatch.
- Sources without an explicit page-0 location plan retain the legacy compiler behavior. No second schema/compiler, runtime authoring path, fuzzy mapper, or story-specific technical exception was added.

### Corrected Fox authority and unchanged scope

- The actual offline extractor/compiler path was run with the tracked Fox template as its saved fixture draft. The corrected cover is `loc_child_room / z_room_window`, with cast `child:hero` and `companion:fox_uri`, bedroom/listening-window mystery anchors, and explicit bucket/drip/falling-water/water-catching/rhythm-mark prohibitions.
- The tracked template raw SHA-256 is `6e3c1293641223b749199b647110e39dfd758b26f2afdd4488b8b74ae21df5a3`; canonical JSON digest is `c4215b8fba8faa94968e2db3f3c5c59785fe5844db96a982197456c2f2770112`. The location-bible raw SHA-256 is `1065f74173ebef138e5d295c861bc820c58f85d0e5359edae1319a11431de762`.
- Generated ignored evidence under `outputs/r1d-cover-source-fidelity/`: source raw SHA-256 `dc68986428170c364ead55afdcb02fdda67174b4d97b44a7e5d4e416c59c1d05`; candidate template raw SHA-256 `d48c2d762ecbf5afa64c499b4440d3697489d74020f3796c7f87934a28bb6658`; review raw SHA-256 `26a4465ef2e9d0371e794ef577a5095762b67c3028445e76b319b718fd002782`; provenance raw SHA-256 `1b23ac31c9385e6af0c49d534820984500c4278b952ae257f5069a390e9cbc83`.
- The generated candidate and tracked corrected artifact differ only in historical `provenance.model`: the compiler fixture records its configured `gpt-5.5-pro`, while the tracked artifact preserves the truthful original live-authoring provenance `gpt-5.5`. No offline fixture run was misrepresented as a new model call.
- Exact JSON comparison against frozen R1D-PREP proves `pageContracts`, `locations`, `zones`, and `recurringProps` unchanged. Both locations still bind only `set_room_balcony_night`. The approved board registry blob is unchanged at Git blob `30ab0884b5a9f5d4e1ad8a4c059b26196fb6b259` and no `set-identity-boards/` path differs from the base; no new board is required.
- `worldMode`, the approved board artifact/asset, story markdown, page contracts, runtime Director behavior, and the `0.70` resemblance gate were not changed. No package candidate manifest was created, approved, or promoted.

### Validation and limits

- Focused compiler/Fox/location/package/preflight/release/board suite: **PASS - 8 files / 89 tests**.
- `npx --no-install tsc --noEmit`: **PASS** after the final implementation changes.
- Literal `npm run check`: TypeScript **PASS**; Vitest **FAIL - 247 files total: 226 passed, 16 skipped, 5 failed; 2,337 tests passed, 65 skipped, 6 failed**. The failures are exactly the previously documented absent ignored-output fixtures in `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`, `set-appearance-ref-budget.spec.ts`, and two cases in `story-read-back-validation.spec.ts`. No R1D-FIX test failed and no ignored fixture was imported or copied.
- Before and after `npm run render-qualification-audit`: **18 nominal slots, 6 product-sellable under local flags, 0 render-qualified**. Every slot still reports its approved package missing; this milestone deliberately did not promote one.
- `git diff --check` and staged diff check passed before the implementation commit.
- The work used an ignored `node_modules` junction to the existing canonical dependency install; no dependency installation occurred.
- Zero image/audio render, provider/live LLM/network/product API call, storage/database write, migration, deployment, flag change, or candidate approval/promotion occurred. Remote-tracking reflogs later recorded pushes through `8171902c` and `2a73afc4`; Codex performed neither, and Guy subsequently confirmed both were intentional and authorized.
- Independent Claude Code technical QA is **PASS (R1D-FIX only)**, and Guy has accepted/closed the milestone. Closure is not package approval, promotion, rendered-cover visual acceptance, render authorization, or approval of the one-LOW-page proof. R1D-PREP rerun/package review and every paid or production boundary remain separately gated.

### Independent R1D-FIX QA verdict and topology correction

- Claude Code reconciled `codex/r1d-cover-source-fidelity` at clean `8171902c`, with reviewed range `5cf68a00..8171902c` intact and local bytes exactly equal to origin. It independently verified all 11 implementation claims and returned **PASS**, closing all three prior R1D-PREP MAJOR findings.
- It independently proved that the mechanism is general and fail-closed, that the shared source-fidelity gate is wired into candidate preparation, promotion, and render qualification, that every material cover field is visible in review, and that the corrected Fox artifact was produced through the compiler path without changing page contracts, topology, `worldMode`, the `0.70` threshold, or the approved Set Board.
- Its independent focused run passed **67 tests**; it reconfirmed board blob `30ab0884b5a9f5d4e1ad8a4c059b26196fb6b259`, no package manifest, and audit state **18 nominal / 6 product-sellable / 0 render-qualified**.
- The sole finding is a non-code MINOR: the prior handoff incorrectly attested no upstream/no push. This section supersedes that stale attestation. The two technical notes - keep the canonical alias/noise table minimal and treat `provenance.model` as a historical label - are informational and require no R1D-FIX code change.
- Remote-tracking history proves pushes through `8171902c` and `2a73afc4`; Codex's first-person attestation and Guy's explicit authorization/closure resolve the governance question that Git alone could not answer. The following documentation-only correction makes no volatile local/remote parity claim and should receive a topology-only micro re-gate.

The earlier R1D-PREP Accept recommendation below is superseded by Guy's stricter page-0 product decision and this general correction. It remains recorded as immutable stop-history, not as the current next action.

## R1D-PREP Fox candidate preparation - historical stop, superseded by R1D-FIX

Guy accepted/closed R1C after independent Claude Code PASS and authorized the zero-cost R1D-PREP artifact milestone. The supplied worktree started clean and detached at exact accepted R1C `515545a8b8867bc0928e5ec399136b67ddc18787`; Codex attached only `codex/r1d-fox-package-prep`. No other worktree or branch was written.

The existing general extractor/compiler/candidate lifecycle cannot currently produce a candidate that both reuses the exact tracked Fox template and satisfies R1C complete cover authority. Per the milestone's stop rule, no candidate manifest was created and no package was promoted.

### Exact blocking evidence

- Current story: `story-bank/v3-approved/fox_uri_adventure.md`, normalized UTF-8 SHA-256 `02629e886a9aaa1e714d9a8d652c24d94ca5843465ff8a9cb70d320a24e2231c`, 12 pages numbered 1-12.
- Current canonical template: `story-bank/v3-approved/fox_uri_adventure.visual-contract-template.json`, `vc-schema/v1`, canonical JSON digest `4f75dad54f7e212aa7de69ee1c7e7dadccbb312d5fe6b584f1c06e7bad88b2b8` (raw file SHA-256 `8733a15b9d1819b3e4ba19fcebc70e6c7d7717801bfc476f5b68c396326b120f`). Its cover exists and page contracts cover exactly 1-12, but its cover has no `zoneId` and no `castIds`.
- The R1C runtime-authority validator returns exactly two issues for that tracked template: `world_authority_incomplete` at `template.coverContract.zoneId` and `world_authority_incomplete` at `template.coverContract.castIds`.
- The accepted compiler, run offline with the tracked template as its descriptive fixture, proposes `coverContract.zoneId = "z_balcony_railing"` and `coverContract.castIds = ["child:hero", "companion:fox_uri"]`. That rebuilt output has canonical digest `ae65bd869d400f776c6b667046a6c0d07587424eefe006e907fab4aceeb367df` (raw SHA-256 `ebd614a35e24de995e9966b9db65a1d2929d61145ecba2553aa856c29aa6e8ee`) and no runtime-world-authority issue under the proposed mode below, but it is not the exact current canonical template.
- The generated compiler review incorrectly says there are no differences from the previous template even though those two cover fields were added. `renderVisualContractReview` does not compare cover zone/cast. That makes the current generated review insufficient approval evidence; it was not patched in this milestone.
- Running the default candidate CLI against only the exact tracked source/template failed closed with `candidate_review_disagreement` and `candidate_provenance_disagreement`, because no tracked review/provenance sidecars exist. It wrote no manifest. A pure, no-write diagnostic candidate build against the rebuilt compiler output resolves successfully, but binds the non-canonical digest above and is not a prepared candidate.

### Board and reviewer state

- Required board registry artifact: `set-identity-boards/fox_uri_adventure/soft_hand_drawn_storybook/set_room_balcony_night/aaa469afd9c6b0b15fa06d44d64045ba26787988fd2f58740527c2512c1f1f05.json`; canonical digest `83609468ea50aed1533930f136e1557989c956809b687a233c2b20e9a7ddccc4`.
- Identity: `set-registry/v1`, `set-board/v1`, story `fox_uri_adventure`, style `soft_hand_drawn_storybook`, set `set_room_balcony_night`, definition hash `aaa469afd9c6b0b15fa06d44d64045ba26787988fd2f58740527c2512c1f1f05`.
- Durable storage key: `set-identity-boards/fox_uri_adventure/soft_hand_drawn_storybook/set_room_balcony_night/aaa469afd9c6b0b15fa06d44d64045ba26787988fd2f58740527c2512c1f1f05.30392c033bba385738ba7399efa78135f869d2b222b3e86ff7a42f8ed0c75083.png`; approved asset SHA-256 `30392c033bba385738ba7399efa78135f869d2b222b3e86ff7a42f8ed0c75083`; board approval `Guy` at `2026-07-17T10:34:57.360Z`.
- No URL was resolved. Registry URLs are environment-specific advisory values; the storage key plus SHA is durable authority, and resolving a URL would cross the prohibited live storage boundary.
- Proposed reviewer-owned `worldMode`: `grounded_with_visual_metaphor`, pending human decision. The authored world is explicitly a real, non-magical bedroom/balcony at night, while small friendly rhythm marks may visualize sound. This is derived from authored physical facts, not from `adventure`, the story key, title, genre, or a runtime fallback.
- `review.authoredBy`, `review.reviewedBy`, `review.reviewedAt`, `review.worldMode`, `approval`, and `promotion` remain null/unresolved. No approval ID is part of `visual-package/v1`, and none was invented.

### Generated local diagnostics and validation

- Generated ignored source: `outputs/r1d-fox-package-prep/sources/fox_uri_adventure.source.json` (raw SHA-256 `2fc3fab72d36d6e4a02dd288b5c2e7f9255d86e271e1fca93ad19e73f9d5b7dc`).
- Generated ignored compiler outputs: `outputs/r1d-fox-package-prep/candidate/fox_uri_adventure.visual-contract-template.json`, `.visual-contract-review.md`, and `.visual-contract-provenance.json`. Candidate evidence binds source-input digest `7cb76e06f3fb41a2c72648ca70d4fc18d73340133fd24af85e61db4548d2f870`, rebuilt template digest `ae65bd...`, normalized review digest `c389e92a6f152ce321dadc0eb1fdd915de4eb6d32bf995cc45acf83953101d70`, and canonical provenance digest `fa2beb853335bda9fb5559ac432377a41f76e5be0d2ac1bf71c7002234ba66ea`.
- Human-readable ignored stop report: `outputs/r1d-fox-package-prep/R1D-PREP-BLOCKED.md`, raw SHA-256 `bfaae123422ead0c3eaa6dadc5e0e9a81c93ffa4afbf8447e9fc16d732ec29c9`. It is presentation only, not a manifest or render authority.
- Existing architecture intentionally treats sources, compiler review/provenance, and candidate manifests as generated ignored outputs. None was force-added. The only durable repository change in this stopped milestone is this canonical state record.
- Focused visual-package/compiler/board/runtime-authority suite: PASS - 6 files / 87 tests.
- `npx --no-install tsc --noEmit`: PASS.
- Literal `npm run check`: TypeScript PASS; Vitest FAIL - 246 files total, 241 passed and 5 failed; 2,328 tests passed, 6 failed, 65 skipped. The six failures are the already-documented absent ignored `outputs/` fixture failures in `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`, `set-appearance-ref-budget.spec.ts`, and `story-read-back-validation.spec.ts`. No fixture was imported or copied.
- Pre- and post-`npm run render-qualification-audit`: 18 nominal slots, 0 render-qualified. Both report the Fox approved package missing. Local product-sellable count was 6 because no catalog-expansion flag was enabled; that does not change the 0/18 render result.
- The worktree used an ignored junction to existing canonical `node_modules` after the first audit command could not resolve `tsx`; no dependency installation occurred.
- `visual-packages/approved/` does not exist; no candidate manifest exists; promotion destinations `story-bank/v3-approved/fox_uri_adventure.visual-contract-template.json` and `visual-packages/approved/fox_uri_adventure.visual-package.json` were untouched.
- Zero image/audio renders, provider/live LLM/network/product API calls, storage/database writes, migrations, deployments, pushes, flag changes, or runtime/product/story/board modifications occurred.

### Required next Decision Gate

Guy chooses accept/change/reject for a focused zero-cost source-artifact correction:

- Accept: authorize adding the compiler-proposed cover zone/cast to the tracked canonical Fox template and fixing the general human review diff so cover changes are visible, with focused tests and independent Claude Code QA; then rerun R1D-PREP from the new immutable commit.
- Change: provide a different explicit cover zone and/or cast decision for that same focused artifact milestone.
- Reject: leave the tracked template unchanged; Fox remains non-render-qualified and candidate preparation/LOW render do not proceed.

Package review, approval, promotion, the one-LOW-page proof, runtime work, and all later milestones remain separately gated.

## R1C independent QA result - latest state

Guy accepted/closed R1B after independent Claude Code PASS and explicitly authorized R1C as a zero-cost implementation milestone. R1C is implemented locally in `a1002e86` (`feat: enforce R1C runtime world authority`) on `codex/r1c-runtime-world-authority`, based exactly on frozen R1B `be11768d05336299bc62007d5d8789a0f398849a`. Independent read-only Claude Code QA returned **PASS (R1C only)** with all 12 implementation claims proven and no blocker, major, minor, or implementation defect. Codex reconciled the findings against the live branch and code; no fix or re-gate is required. Guy's accept/close, push, package-review, and any cost authorization remain separate decisions.

### R1C topology at handoff

- R1C implementation authority: `C:\Users\guyna\.codex\worktrees\d775\Small_Heroes`, branch `codex/r1c-runtime-world-authority`, implementation commit `a1002e86`, no upstream and no push. Immediately after the implementation commit it was 1 commit ahead / 0 behind frozen R1B and 14 ahead / 0 behind both local and remote `main`; the following `CURRENT.md` commit is documentation-only.
- Frozen R1B: `C:\Users\guyna\.codex\worktrees\0ef3\Small_Heroes`, `codex/r1b-visual-package-promotion` at `be11768d`, clean and equal to `origin/codex/r1b-visual-package-promotion`. It remained read-only.
- Frozen R1A: `C:\Users\guyna\.codex\worktrees\2d64\Small_Heroes`, `codex/r1a-render-loop-phase1` at `4a5dd041`, clean and equal to its origin. It remained read-only.
- Canonical main: `C:\GNart\Work\Small_Heroes`, `main` at `ed1da86c`, equal to `origin/main` in commits, with pre-existing user-owned untracked review/project/script files untouched.
- Legacy feature worktree: `C:\GNart\Work\sh-wt-style01`, `feat/chunked-generation` at `ef543312`, 4 ahead / 0 behind its origin, with its pre-existing modified `.env.example` and untracked artifacts untouched.
- No other worktree or branch was created, written, cleaned, merged, pushed, or deployed.

### Implemented R1C behavior

- Reviewer-owned `review.worldMode` is copied into an exact approved-package binding inside the materialized resolved contract and therefore its frozen hash. Runtime never derives it from story prose, direction, genre, story key, template name, world type, or fallback labels.
- Render qualification now requires a complete authoritative cover and every page: explicit location, zone, supported time of day, environment class, lighting, cast, transition authority, required/forbidden content, and exact Set Identity Board artifact identities. Missing, stale, contradictory, incomplete, or changed authority returns structured fail-closed reasons.
- The frozen resolved contract is checked against the current approved manifest/template, its exact source/template/coverage/board digests, the persisted `Order.visualContractHash`, and the exact runtime board snapshot before a provider callback can run.
- Enforced non-production Style01 materializes only the exact qualified local package template. Runtime compilation/live authoring is unreachable there. The previous best-effort artifact/dynamic-compiler path remains only behind enforcement-off legacy development behavior.
- One shared provider boundary projects the approved cover/page contract into exact location, zone, reality mode, time/lighting, transition, cast, wardrobe, required props/content, forbidden content, and board reference. Direct provider callers without the preflight-issued context fail before provider invocation.
- Caller story text, direction/genre/category labels, generic home/night derivation, free-form character sheets, arbitrary reference images, operator prose, and legacy wardrobe/world helpers are removed or bypassed on the enforced path. They remain reachable only when enforcement is off or production hard-off applies.
- Director and operator output is deterministically constrained to a closed presentation vocabulary for framing, placement, staging, pose/blocking, interaction, eyeline, and emotion. It cannot introduce or rename worlds, locations, zones, sets, cast, props, required/forbidden content, or board identity.
- Shipped cover and page calls in `chunk-runner`, every internal page QA regeneration attempt, and operator single-page regeneration use the same preflight-issued authority. Single-page regeneration preflights before legacy story selection/DNA/photo/model/storage work and rechecks beside the provider call.
- Enabling non-production Style01 enforcement now implies freeze, steering, and board activation so a secondary disabled flag cannot leak an enforced request back into inferred-world rendering. Enforcement off is unchanged, Style02 is unchanged, and Vercel production remains hard-off.
- The strict offline draft schema now authors `setIdentityId`/`setReference` and explicit cover zone/cast. Compatibility proposals for older drafts occur only in the offline compiler before review; no runtime inference was added.
- The protected Style01 page resemblance threshold remains exactly `0.70`.

Primary implementation seams are `lib/visual-package/runtimeAuthority.ts`, `lib/generation-pipeline/render-qualification-preflight.ts`, `lib/generation-pipeline/runtime-visual-authority.ts`, `backend/providers/image.ts`, `backend/providers/director.ts`, `lib/style01-prompt-assembly.ts`, the frozen-contract/board/chunk/single-page callers, and the existing compiler/package validators. No second compiler, parallel package schema, sequential runtime LLM memory layer, database migration, or real package was added.

### R1C validation and limitations

- Final pre-implementation-commit validation: `npx --no-install tsc --noEmit` **PASS**; focused compiler/package/board/caller suite **PASS - 10 files / 233 tests**.
- Post-commit broad zero-cost non-fixture suite, excluding only the five known ignored-output fixture files: **PASS - 225 files / 2,319 tests passed; 16 files / 65 tests skipped**.
- Caller-level adversarial coverage includes direct page and cover provider rejection, exact reviewer `worldMode`, explicit cover/page location-zone-cast-content-board projection, malicious caller/Director/operator/reference/wardrobe override removal, shipped cover provider assembly, verified-QA regeneration retries, stale package/changed world/missing page/wrong board/incomplete world rejection, bounded Director output, `0.70`, enforcement-off, and production hard-off.
- Package/freeze/board coverage also proves exact materialization, current source/package binding, `Order.visualContractHash`, exact board SHA/metadata/URL, enforcement-implied freeze/steering/board activation, Style02 compatibility, and absence of direct runtime imports to compiler authoring, promotion writing, provider, network, storage, or database seams.
- Literal `npm run check` on committed `a1002e86`: TypeScript **PASS**; Vitest **FAIL - exactly 6 tests** in the five known files `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`, `set-appearance-ref-budget.spec.ts`, and `story-read-back-validation.spec.ts`. Every failure is the previously documented missing ignored `outputs/` story/JSON/PNG/board fixture; no R1C test or non-fixture regression failed.
- Actual `npm run render-qualification-audit`: **18 nominal slots, 0 render-qualified**. No real package was promoted and no ignored user output fixture was imported or copied.
- All provider/storage/QA seams in R1C tests are mocks and global network access is made throwing. No image/audio render, live LLM/provider/product API call, live compilation, database/storage write, migration, deploy, push, or production/staging flag change occurred.
- The existing ignored `node_modules` junction points to canonical dependencies and is not a repository change. No dependency installation was performed in R1C.
- There is no claim of a real runtime/provider/database boundary proof, visual quality, product acceptance, or launch readiness. The one-LOW-page proof, R2 durable recovery/state machine, catalog/story authoring, Lion work, shared-board generalization, full-book work, and production cutover remain explicitly out of scope.

### Independent R1C QA verdict

- Claude Code reconciled the exact branch, clean `657a6eea` HEAD, two-commit `be11768d..657a6eea` range, absent upstream/remote branch, and read-only authority before reviewing.
- It independently proved all 12 claims and the load-bearing property: no enforced Style01 provider render is reachable from any caller without complete, exact, fresh runtime authority; the shared `generateImage` seam fails closed before provider dispatch.
- It independently ran the 10 load-bearing compiler/package/board/caller specs: **PASS - 233/233 tests**. Its independent audit also confirmed **18 nominal slots / 0 render-qualified**, all currently blocked by missing approved packages.
- No implementation finding requires a Codex fix or re-gate. The known six missing ignored-output fixture failures remain baseline-only and outside the R1C surface.
- Binding future invariant from QA: `Style01RuntimeAuthority` is per-invocation state. Do not cache or memoize it across orders or renders. The preflight comparison to the live persisted `Order.visualContractHash` remains the freshness authority; the provider seam validates the issued authority object's internal integrity as defense in depth.
- Informational note: the development-only `app/api/debug/replicate-image/route.ts` direct caller also reaches the shared seam and correctly fails closed under enforcement.

### R1C next independent gate

The independent technical gate is complete. Guy now decides whether to accept/close R1C and authorize its push. A subsequent no-cost milestone may prepare the first real Fox visual-package candidate for Guy's review, but technical PASS is not approval to promote a real package, enable enforcement, call a provider, or run the one-LOW-page proof. That paid proof still requires separate explicit cost approval after the package is reviewed and render-qualified.

## R1B independent QA result - latest state

R1B is implemented and locally committed at `da1914cb` (`feat(visual-package): add approved promotion lifecycle`), with the implementation handoff recorded at `57291998`. Independent read-only Claude Code QA returned **PASS (R1B only)** with no blocker, major, or minor implementation defect. Codex reconciled the verdict against the live branch and Decision Gate; no fix or re-gate was required. Guy subsequently accepted/closed R1B and explicitly authorized R1C. R1B remains frozen at `be11768d`.

### Live topology at implementation

- Canonical `main`: `C:\GNart\Work\Small_Heroes`, `main` at `ed1da86c`, tracked clean with pre-existing user-owned untracked files, and 0 ahead / 0 behind `origin/main` at dispatch.
- Accepted/frozen R1A: `C:\Users\guyna\.codex\worktrees\2d64\Small_Heroes`, `codex/r1a-render-loop-phase1` at `4a5dd041`, clean and 0 ahead / 0 behind its origin at dispatch. It remained read-only.
- R1B implementation: `C:\Users\guyna\.codex\worktrees\0ef3\Small_Heroes`. The supplied worktree was detached at accepted R1A `4a5dd041` because the R1A branch was already checked out in the frozen worktree, so the existing worktree was attached to the new milestone branch `codex/r1b-visual-package-promotion`; no new worktree or merge was created.
- Frozen legacy feature line: `C:\GNart\Work\sh-wt-style01`, `feat/chunked-generation` at `ef543312`, 4 ahead / 0 behind its origin, with the pre-existing `.env.example` modification and user-owned untracked artifacts untouched.

### Implemented R1B behavior

- One versioned `visual-package/v1` manifest now carries candidate and approved lifecycle state, exact normalized story-source identity, canonical template digest/schema, cover/page coverage identity, candidate review/provenance digests, structured author/reviewer reality metadata, Guy approval, and exact approved Set Identity Board artifact identities.
- `worldMode` is reviewer-owned structured metadata (`grounded`, `grounded_with_visual_metaphor`, or `fantastical`). It is not inferred from direction and is not consumed by runtime prompts or Director logic in R1B.
- The existing offline extractor/compiler now emits source-bound candidate evidence. No second compiler or visual-contract schema was added.
- `promote-visual-package` prepares a candidate by default, validates an exact approval as a dry run, and writes only with explicit `--promote`. It rejects missing/wrong approval, wrong story, stale source/template, unsupported/invalid templates, missing cover, incomplete/duplicate/out-of-range pages, unresolved or changed boards, and review/provenance/evidence disagreement.
- Promotion and qualification reuse the existing template validator and Set Identity Board registry validation/projection. The pure board registry path builder was separated from live storage resolver dependencies so offline paths cannot reach storage.
- The reusable qualification evaluator returns structured issue codes and never counts a legacy contract or enforcement-off fallback as qualified.
- The all-slot audit emits one record for every 18 nominally sellable slots, with `productSellable` and `renderQualified` reported separately. With the v3 product flag enabled, the actual audit reports 18/18 product-sellable and 0/18 render-qualified because no real approved visual package was promoted.
- `release-check` remains report-only by default and explicitly says it is not a render-readiness claim. `--require-render-qualified` is the deliberate fail-closed strict mode.
- The shipped Style01 cover and page provider entry points are wrapped by a synchronous qualification preflight. When existing visual-contract enforcement is enabled in a non-production environment, a missing/stale/contradictory package throws before the provider callback. Enforcement off preserves the documented non-qualified legacy path, and Vercel production remains hard-off even if the flag leaks on.
- No real story, template, board, visual-package, world prompt, Director behavior, customer availability, or `0.70` resemblance threshold was changed.

### R1B validation and limitations

- Focused lifecycle/runtime/release/compiler/board regression suite: **PASS - 11 files, 182 tests**.
- `npx --no-install tsc --noEmit`: **PASS** after the final implementation changes.
- Actual all-slot audit with `ENABLE_V3_APPROVED_BANK=true`: **18 records, 18 product-sellable, 0 render-qualified**; every current record reports structured `approved_package_missing`.
- Full remaining repository suite excluding only the five known ignored-output fixture files: **PASS - 224 files / 2,305 tests passed; 16 files / 65 tests skipped**.
- Literal `npm run check -- --silent`: TypeScript **PASS**; Vitest **FAIL - 8 tests in 7 files**. Six failures are the recurring absent ignored `outputs/` fixtures in `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`, `set-appearance-ref-budget.spec.ts`, and `story-read-back-validation.spec.ts`. Under the full parallel load, `qa-console-anchor-durable.spec.ts` and `generate-board-model.spec.ts` also exceeded their 5-second timeouts; both passed immediately in isolation (**2 files / 5 tests**) and passed again in the full non-fixture suite. No user-owned output artifact was copied into this worktree.
- Tests and audit used only local files and mocks. No image/audio render, live compiler, LLM, network/product API, database write, migration application, deployment, push, or production action occurred.
- The worktree had no dependency installation; validation used an ignored junction from this worktree's `node_modules` to canonical `C:\GNart\Work\Small_Heroes\node_modules`. It remains available for independent QA and is not a repository change.
- R1C runtime world authority/Director changes, R2 recovery, story/catalog authoring, Lion work, board reuse/generalization, real promotion, production cutover, and any render remain out of scope.

### Independent R1B QA verdict

- Claude Code reconciled the exact branch, clean worktree, `57291998` HEAD, `4a5dd041..57291998` range, two-commit lead over R1A, 12-commit lead over main, absent upstream, and absence of real story/template/board/package artifacts in the diff.
- It independently proved all 13 implementation claims, including the source-bound package identity, dry-run-by-default promotion, structured fail-closed qualification, all-slot accounting, strict release mode, pre-provider cover/page guards, production hard-off, offline-only dependency boundary, and exact Set Identity Board re-resolution.
- It independently ran the three load-bearing visual-package/preflight/release specs: **PASS - 28/28 tests**. The broader reported suites and baseline fixture/time-out limitations remain documented above.
- Non-blocking operational note: enabling non-production enforcement while the catalog is still 0/18 qualified deliberately hard-throws before image-provider invocation. Keep enforcement off until reviewed packages are promoted, and verify downstream order-to-hold handling before any staging enablement.
- Declared runtime limitation: provider guards are proven by code and zero-cost tests, not by a real end-to-end order or provider boundary. That later proof still requires the separately approved smallest-runtime milestone.

### R1B next gate

The independent technical gate completed with PASS; Guy accepted/closed R1B and authorized R1C as a separate zero-image execution milestone. That decision did not authorize a real package promotion, enforcement enablement, provider call, one-LOW-page proof, or Lion/catalog work.

## R1A independent QA result — latest state

R1A is implemented and locally committed. Independent Claude Code adversarial QA returned **PASS (R1A only)** with no blocker, major, or minor implementation defects. Guy subsequently accepted/closed R1A and authorized R1B. This section records the external QA verdict and historical R1A evidence; it is not a Codex self-award.

### Topology and commits

- Dispatch started from a clean detached worktree at feature commit `ef543312` (4 ahead / 0 behind `origin/feat/chunked-generation` at `b4813c04`).
- Canonical `main` and `origin/main` were both `ed1da86c`; feature versus main was 4 unique feature commits / 9 unique main commits.
- The existing Codex worktree was attached to `codex/r1a-render-loop-phase1`; no additional worktree was created.
- `ec6c2ec7` — clean merge of canonical `main` through `ed1da86c`, preserving the four feature commits and governance documents.
- `f4c335f6` — `fix(render-loop): gate regeneration on verified QA`.
- `74a73863` — `fix(render-loop): persist cover candidate before QA`.
- `2d5ed60d` and `1f26cb58` — focused `CURRENT.md` implementation handoff updates.
- Claude Code independently reviewed runtime range `ec6c2ec7..74a73863` and verified topology at `1f26cb58` on `codex/r1a-render-loop-phase1` with a clean worktree.
- At that reviewed topology, the branch was 9 ahead / 0 behind both `main` and `origin/main`, and 18 ahead / 0 behind `origin/feat/chunked-generation`; it had no upstream. This `CURRENT.md` update changes documentation only.

### Implemented behavior

- Durable QA classification now distinguishes `verified_pass`, `verified_visual_failure`, and `evidence_unknown`.
- Only a verified visual defect/hazard on the persisted Style01 candidate can reserve regeneration and render replacement bytes.
- Malformed, transport/HTTP, timeout, skipped/unavailable, strict-follow-up unknown, and inconsistent evidence all hold without reserving regeneration.
- Retryable evidence failures get at most two same-candidate re-QAs; skipped/unavailable vision is not pointlessly retried in-process.
- Every primary QA and strict-crib fetch gets a fresh dedicated `AbortSignal.timeout`; the default is 30 seconds and `PAGE_VISUAL_QA_TIMEOUT_MS` can lower/override it.
- Candidate persistence failure remains non-throwing but now immediately holds before QA, budget reservation, or replacement generation.
- The shipped cover path now persists its uploaded candidate as durable page `0` before QA; pages and cover share the same upsert helper.
- The caller enforces the visible one-candidate plus two-replacement bound even if a durable reserver incorrectly keeps granting.
- Shipped ordering is covered as upload → awaited candidate persistence → QA of that exact durable URL.
- OpenAI `images.generate` and `images.edit` both have explicit request-option and live-abort coverage.
- No resemblance threshold changed; `0.70` remains intact.

### Files in the R1A commit

- `backend/providers/image.ts`
- `lib/generation-pipeline/page-visual-qa.ts`
- `lib/generation-pipeline/chunk-runner.ts`
- `lib/__tests__/image-style01-qa-regeneration.spec.ts`
- `lib/generation-pipeline/__tests__/page-visual-qa-timeout.spec.ts`
- `lib/generation-pipeline/__tests__/page-visual-qa-requa.spec.ts`
- `lib/__tests__/generate-image-cancellation.spec.ts`

### Validation evidence and limitations

- Independent Claude Code adversarial QA: **PASS (R1A only)**. It independently read the shipped page and cover paths and concluded that no evidence-unknown outcome can reserve regeneration budget or generate replacement bytes, with visual readiness both enabled and disabled. It found all 20 claims in the QA brief supported.
- Focused R1A suite: **PASS — 6 files, 65 tests**.
- `npx tsc --noEmit` / local `tsc --noEmit`: **PASS**.
- Literal `npm run check`: TypeScript **PASS**; Vitest **FAIL — 6 tests in 5 unrelated files** because this clean worktree lacks their untracked, ignored `outputs/` fixtures. The affected files are `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`, `set-appearance-ref-budget.spec.ts`, and `story-read-back-validation.spec.ts`. Every missing artifact is ignored by `.gitignore:65`; none is tracked.
- Full remaining suite with only those five fixture-dependent files excluded: **PASS on the first run**. A later diagnostic rerun exposed a Vitest/tinypool `ERR_IPC_CHANNEL_CLOSED` infrastructure flake, so no stronger full-suite claim is made.
- The clean worktree had no dependency directory. Validation used a temporary ignored junction to canonical `node_modules`, then verified and removed the junction. An initial `npx` attempt before that junction may have fetched a transient Vitest package into the user npm cache; it did not modify the repository or call any product/paid API.
- Zero image renders, audio renders, paid/product API calls, database writes, migrations, deployments, pushes, or production actions were performed.
- R1B/R1C, promotion/preflight, `worldMode`, Lion, story/catalog content, Set Board reuse, and full-book work remain out of scope and untouched.
- Claude Code noted one deferred recovery concern: the operator-only single-page regeneration path does not supply `onPageCandidateUploaded`, so it lacks the page/cover crash-recovery record. The R1A safety gate still applies and there is no regeneration bypass; track the recovery wiring for R2 rather than expanding R1A.
- Claude Code also noted that evidence-unknown results now hold for human review instead of being accepted by legacy behavior, which may increase human-QA volume. This is the intended fail-closed R1A tradeoff.
- No real database or paid image boundary was exercised. Candidate-persistence wiring is statically and locally tested, while a real runtime boundary remains a separately authorized later proof.

## Active task

R1C and R1D-FIX are accepted/closed. Guy authorized the zero-cost R1D-PREP rerun, and the general offline lifecycle has now prepared the source-bound Fox candidate documented above. No implementation code changed. The active gates are independent Claude Code first-pass read-only QA and Guy/Claude Cowork product review of the unapproved candidate. Package approval, promotion, render qualification, and every image render remain unauthorized.

The governing brief is `docs/ai-workflow/DECISION_GATE_IMAGE_GENERATION_ARCHITECTURE_2026-07-22.md`.

## Executive finding

The repository does not need a second image architecture or another general compiler. It needs the missing lifecycle between the components already present:

```text
approved story
  → reviewed/promoted visual package
  → zero-cost render preflight
  → frozen source-bound contract + board bindings
  → bounded page render
  → uploaded candidate persisted
  → QA on the same bytes
  → accepted, verified regeneration, or hold
  → durable resume and human release
```

The immediate risk is not merely weak prompting. Product/story sellability currently permits more stories than the visual system can safely render.

## Verified repository facts

- With `ENABLE_V3_APPROVED_BANK=true` and the DB check intentionally skipped, `npm run release-check` reports **18/18 product-sellable slots**. The historical 8/18 statement is stale.
- The bank currently contains **2 visual-contract templates** (`bunny_ometz_adventure`, `fox_uri_adventure`), **1 legacy visual contract** (`bunny_ometz_adventure`), and **6 location bibles**.
- A tracked approved Set Identity Board exists for `fox_uri_adventure`.
- Offline text-first extraction/compilation, strict validation/materialization, frozen contract hashing, contract steering, world QA, and the Set Identity Board engine already exist on the common code line.
- Bank runtime does not live-compile a missing contract. With enforcement on, missing authority blocks; with enforcement off, the path degrades to legacy behavior.
- Visual-contract freeze/enforcement/steering are hard-off in Vercel production, so production cutover requires an explicit reviewed code/config milestone.
- R1B now provides explicit approved visual-package promotion, structured qualification, all-slot audit, and strict release qualification. No real package has been promoted, so all current slots remain unqualified.
- The strict offline draft schema now authors `setIdentityId`/`setReference` and explicit cover zone/cast bindings; the enforced runtime consumes only a reviewed, promoted, exact source-bound package.
- Literal `home-night`, generic derived locations, direction/genre/category world choices, and other legacy world fallbacks remain in the enforcement-off development path but are projected out or bypassed before the enforced shared provider seam.
- Runtime Director/operator output is now constrained to deterministic presentation vocabulary; the complete frozen page contracts own continuity and physical reality.
- Set Board registry/storage is deliberately story-scoped. Cross-story reuse is not yet proven and will not be generalized now.

## Historical render-loop Phase 1 re-gate (before the R1A fix)

Feature commits through `ef543312` add useful foundations: no hidden OpenAI image retry, cancellation plumbing, same-image malformed re-QA, and pre-QA uploaded-candidate persistence. `npm run check` passes.

At `ef543312`, the slice remained **NO-GO**:

1. The same-image helper returns persistent malformed QA as unverified, but the shipped Style01 caller treats unverified as regeneration-eligible and can spend a new image. That violates the requirement that only a verified visual failure may consume regeneration budget.
2. The visual-QA fetch has no dedicated AbortSignal/timeout.
3. Tests cover the helper but not the caller-level budget decision, so the green suite is false confidence for this requirement.
4. Candidate persistence has no regression test proving the shipped Style01 order: upload → persist candidate → QA.

That historical blocker was corrected by `f4c335f6` and `74a73863`, then independently PASSed for R1A. This does not itself authorize a measurement render.

## Binding technical decisions

- **Two gates:** product-sellable and render-qualified are separate. Only both together permit a paid image.
- **Approved package first:** a current source-bound template, explicit `worldMode`, complete cover/page plan, and every required approved board must exist before render.
- **No runtime authoring:** contracts are compiled offline, reviewed, explicitly promoted, then frozen/materialized per order.
- **One world authority:** frozen cover/page contracts own location, zone, transition, cast, props, required/forbidden content, and reality mode.
- **Bounded Director:** runtime creative prose may choose camera/blocking only within the contract. Direction labels cannot choose or transform the world.
- **No new sequential LLM memory:** deterministic page contracts are the continuity state. Add runtime sequence only if later evidence identifies a fact that the contract cannot express.
- **QA evidence is not image failure:** malformed/error/timeout/skipped QA may retry the same candidate and then hold; it may not consume regeneration.
- **Story-scoped boards stay:** shared world kits are deferred until two reviewed stories intentionally share one canonical set.
- **Lion stays blocked:** no `lion_shaket_adventure` render until the general system passes, the story receives product review, its visual package is approved, and Guy explicitly authorizes the cost.

## Planned sequence

1. Correct render-loop Phase 1 with caller-level tests and bounded QA; run `npm run check`; Claude Code re-gate. **Complete locally; independent R1A PASS received.**
2. Implement visual-package promotion and all-slot render-qualification audit/release gate, with zero image calls. **Complete locally at `da1914cb`; independent R1B QA PASS received with no implementation defects.**
3. Consume reviewer-owned `worldMode` at runtime, extend strict draft support for board bindings, and bound/remove legacy world fallbacks from the sellable path. **Complete locally at `a1002e86`; independent R1C QA PASS received with no implementation defects.**
4. With explicit Guy approval, run one LOW page on `fox_uri_adventure` and inspect runtime artifacts.
5. Based on measurement, land the durable candidate/QA/resume state machine and prove it at a real DB/runtime boundary.
6. Compile candidates for all 18, but review/promote only Guy's chosen launch set; then consider a five-page sample and eventually one explicitly approved full book.

## Branch and worktree state

- Guy explicitly reported pushing the canonical workflow/documentation range after its handoff was prepared. `origin/main` contains that range and the later repository-topology governance commit through `6748b813` as verified on 2026-07-22.
- The earlier handoff statement "No push" was true at preparation time but was not a durable current-state claim. It is withdrawn as a description of the later repository state; the push was performed explicitly by Guy, so there was no unauthorized executor push.
- Local/remote divergence is volatile operational state. Before every implementation start, QA handoff, and PowerShell handoff, Codex reads it from Git rather than relying on this snapshot.
- Local `feat/chunked-generation` is ahead of its origin by four Phase 1 implementation commits.
- The feature worktree has a pre-existing modified `.env.example` and untracked review/checkpoint/artifact files. They are user work and remain untouched.
- Main also has pre-existing untracked `_review/`, `project-os/NOW.md`, and `scripts/check-order-anchor-readiness.ts`; they remain untouched.
- Before implementation resumes, the feature line must preserve/merge the canonical documents without sweeping unrelated work into a commit.

## Evidence recorded this turn

- Implemented the general R1C runtime-world-authority boundary at `a1002e86` from frozen R1B `be11768d`, with no story/child/companion/page-specific runtime exception.
- Final focused validation passed `npx --no-install tsc --noEmit` and 233/233 tests; the post-commit non-fixture suite passed 2,319/2,319 tests across 225 files, with 65 tests skipped.
- Literal `npm run check` passed TypeScript and reproduced only the six known missing ignored-output fixture failures in five files; the real all-slot audit remained 0/18 render-qualified.
- Read-only topology audit confirmed R1A/R1B clean/frozen, R1C as the sole writer, and all unrelated main/legacy worktree changes untouched.
- No render, external/provider/LLM call, database/storage write, migration, deployment, push, production/staging flag enablement, real package promotion, or ignored fixture import occurred.
- Claude Code independently reviewed `ec6c2ec7..74a73863` plus the handoff/topology at `1f26cb58` and returned **PASS (R1A only)** with no blocker, major, or minor implementation defects.
- Claude Code independently reviewed R1B range `4a5dd041..57291998` and returned **PASS (R1B only)** with all 13 claims proven, 28/28 independently run load-bearing tests passing, and no finding requiring a Codex fix or re-gate.
- Claude Code independently reviewed R1C range `be11768d..657a6eea` and returned **PASS (R1C only)** with all 12 claims proven, 233/233 independently run load-bearing tests passing, and no finding requiring a Codex fix or re-gate.
- The independent report explicitly confirmed the load-bearing page and cover claim across readiness ON/OFF: only verified visual failure can reserve regeneration or create replacement bytes; malformed/error/timeout/skipped/unavailable evidence holds without either action.
- Its non-blocking observations are preserved above; neither its later LOW-page recommendation nor the PASS itself is treated as render authorization.
- Read the attached Codex architectural verdict and traced its claims through loaders, guards, compiler scripts, Director call sites, board registry/storage, tests, and feature commits.
- Ran `npm run check` on `feat/chunked-generation`: PASS, while caller review still found the regeneration-evidence bug above.
- Ran `npm run release-check` on `main` with `ENABLE_V3_APPROVED_BANK=true` and `SKIP_DB_SCHEMA_CHECK=true`: PASS and 18/18 product-sellable. This was a catalog/config check only, not a database release proof.
- Enumerated tracked contract and board artifacts from Git.
- No image, audio, external API, database write, migration, deployment, or production action was performed.
- Claude Code reviewed `b4813c04..8ba57d18` and correctly found that the post-handoff Git state no longer matched this file. Guy's preceding message establishes that he performed the push after preparation; the finding is accepted as a stale-state defect, not an authorization breach.
- Claude Code separately PASSed the repository-topology rules in `8ba57d18..6748b813`, then issued PASS WITH MINOR NOTES for the state-reconciliation range through `6f82ef84`, closing the authorized-push defect. The resulting explicit-deletion-approval follow-up is isolated in `4ea19395` for its own micro re-gate; no runtime or product scope is implied.

## Blockers

- The R1D-PREP-RERUN candidate has not received independent Claude Code PASS or Guy's product acceptance. It deliberately lacks author/reviewer identities, review timestamp, approval, and promotion authority.
- Literal `npm run check` remains non-green only for the six known ignored-output fixture failures; the additional first-run guard timeout passed in isolation and did not reproduce in the diagnostic rerun. No fixture was imported to manufacture green.
- Any later push remains a separate explicit action. This handoff records immutable base/head evidence and does not rely on a durable ahead/behind claim.
- The one-LOW-page proof requires separate explicit cost approval.
- Lion requires separate product/content acceptance; technical readiness alone is insufficient.

## Next action

Commit this `CURRENT.md`-only handoff, then Claude Code performs first-pass read-only adversarial QA against the immutable base-to-head range and the generated ignored evidence in this worktree. Guy/Claude Cowork review the candidate's human-facing cover/world/continuity package. If both gates are accepted, Guy may authorize a separate approval/promotion milestone; this rerun does not supply that authority. Do not approve or promote the candidate, render, push, import ignored fixtures, change flags, resolve storage URLs, exercise a live storage/database boundary, or begin R2/Lion/catalog/full-book work.
