# R1D Wizard Story/Companion Full-Book Readiness — implementation evidence

Date: 2026-08-11
Base: `5e27f9496d9bec9f3def8da801c954a71ddbd887`
Branch: `codex/r1d-wizard-story-companion-full-book-readiness`

## Observed gap

The public Wizard matrix contained six categories and eighteen category/direction slots, but source selection mixed v5 and v3-approved declarations while runtime preferred v3-approved files when enabled. All eighteen sources and all six companion identity sheets existed, yet the production qualification audit returned zero render-qualified packages. Historical Visual Contract candidates existed for all eighteen stories but were neither current authority nor source/companion bound.

## General correction

1. The matrix binds every public slot to `story-bank/v3-approved/<companion>_<direction>.md` plus its import sidecar.
2. `lib/wizard-render-readiness.ts` validates source frontmatter/page coverage, sidecar identity, the exact matrix companion, all six Style01 views, QA status, the `0.70` resemblance floor and a migrated current-schema Visual Contract template.
3. `scripts/materialize-wizard-qa-catalog.ts` writes new deterministic QA-only candidates and a content-addressed catalog. The historical `_review/vc-live-cheap` inputs are read only and remain unchanged.
4. The Wizard matrix API exposes `storyReady`, `qaAuthoringReady`, `productionRenderQualified`, `selectable`, `availabilityStage` and the exact QA candidate digest. QA resolution requires both the existing dev/Preview guard and `ENABLE_WIZARD_QA_RENDER_CATALOG=true`; Production remains closed.
5. The summary image is derived from the server matrix companion, eliminating the remaining legacy companion-roster lookup from the public path.

## Materialized authority

- Catalog version: `wizard-qa-render-catalog/v1`
- Current catalog digest: `c497e6801bc34daffe473a33caa6c2ffce48fdba26b238f4f838de17cf24799d`
- Candidate version: `wizard-qa-visual-contract-candidate/v1`
- Slots: 18/18
- Companions: 6/6
- Candidate template validation: 18/18 current-valid
- Story/page identity: 18/18 exact
- Six-view companion authority: 6/6 exact
- Production eligibility: false for every candidate

## Validation

- `npx --no-install vitest run lib/__tests__/mvp-story-matrix.spec.ts lib/__tests__/story-product-resolver.spec.ts lib/__tests__/wizard-mvp-matrix-api.spec.ts lib/__tests__/wizard-render-readiness.spec.ts --maxWorkers=1 --no-file-parallelism`: 4 files / 23 tests PASS.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- The one literal `npm run check` passed TypeScript and the complete **19-file resource-intensive phase** with a valid diagnostic protocol. Ordinary reported exactly the six established missing ignored-output fixture failures plus one stale inventory assertion caused by the new Wizard readiness spec (`294/275` expected versus `295/276` actual). The mechanical counts were corrected and the focused classifier plus TypeScript passed afterward; the literal full gate was not rerun. The six fixtures remain a separate Production/release HOLD.

## First canonical Bunny/Bar authoring attempt and local normalization correction

The first canonical attempt used `bunny_ometz_bedtime`, the approved Bar anchor and a fresh readiness rooted at exact pushed base `5e27f9496d9bec9f3def8da801c954a71ddbd887`. Probe, prepare, verify, pricing, preflight and Supervisor verify passed. The consumed authoring request produced receipt `8d864030ccffc7ee2ed8381e230e75b0e8eb3462fd0f79377c7689f7f34b5857` and readiness `f8222461ad23e4c5d6b0fce2a52615f3cca17d2bca9ccc694fcfb4cae23b2028`.

- Provider calls: 2 (one initial response and one `stable_prop_scope_patch` response); repairs: 1; transport retries: 0; fallback: none.
- Usage: input `12,987`, cache-write `12,647`, output `17,070`, reasoning `3,274`, total `30,057`.
- Local accounting: `$0.592844` nominal and `$0.652596` conservative; not a provider-account audit.
- Terminal: `local_processing_failed` / `unexpected_local_error`; candidate absent; no reconciliation, Blueprint, Wizard book, image, render or downstream authority.

Investigation proved that both closed scope failures carry a compiler-owned outcome: a lifecycle-gated or consumer-forbidden stable recurring prop cannot be a Set Board consumer, while the authored support geometry remains valid without that binding. The compiler now performs exactly that omission locally in the initial assembly and emits a sanitized structural note. No model repair is spent and no authored alternative is invented. Prompt authority advances from `vc-template-prompt/v11` / `vc-template-user-prompt/v11` to `v12`; schema, model, budgets, timeout and candidate semantics remain unchanged.

Focused correction validation passes **4 files / 143 tests**, including direct lifecycle-gated, consumer-forbidden and multi-target controls, all 18 Story Source input-ceiling checks with more than 1,024 units of headroom, live-request materialization and source-authority lifecycle. Deterministic TypeScript and `git diff --check` pass. Repository-wide validation is recorded below when complete.

## Second canonical attempt and diagnostic-coordinate correction

At pushed HEAD `cb59140a5a183bd5a8db6873a9a9e265bd2ec1fa`, the fresh Bunny/Bar attempt used output root `outputs/r1d-wizard-bunny-bedtime-full-book-cb59140a-20260811T1946Z`. Probe `59938307…`, Fresh Readiness `7da97545…`, Execution Request `c794cceb…`, Supervisor readiness `9172d790…`, official pricing, the sole preflight and the sole Supervisor verify all passed. The one live invocation completed after 216.7 seconds and exited 1.

- Receipt: `66d035d74bcef03edd65c0ea35dec4cb4e359e3539abd0ec5b0d47d23ea7790b`; readiness: `7cfb3f6571c827b9489b3fbc68ff4e62c9a1fe2816b05076efee75ab62558693`.
- Provider calls / repairs / transport retries / fallback: `1 / 0 / 0 / none`.
- Usage: input `12,650`; cache-write `12,647`; cached `0`; output `15,906`; reasoning `2,403`; total `28,556`.
- Local accounting: `$0.556239` nominal and `$0.611867` conservative; not a provider-account audit.
- Terminal: `local_processing_failed` / `unexpected_local_failure` / `unexpected_local_error`. Candidate and all downstream authorities remained absent.

The exact response was intentionally not persisted, but the generic local signature was reproduced without provider access by giving the compiler a structured draft whose page identity is non-positive. Before correction it throws `draft authority/reference diagnostic contract invalid` from `normalizeDraftAuthorityReferenceIssues`, exactly bypassing the repair loop. The root is a trust-order defect: the compiler emits closed authority issues before final draft validation, while their persisted structural locators correctly reject non-positive page identities.

The correction preserves the locator validator and fail-closed issue catalog. `DraftAuthorityReferenceDomainError` catches only failure to normalize its own untrusted structural coordinate and converts it to a sanitized `InvalidTemplateContractError` with a root-authority locator. The existing full-draft repair then receives the fixed instruction; it must still produce a completely valid draft. A direct red/green regression proves an invalid initial page identity consumes one repair and returns the unchanged valid page identity from the corrected response. The adjacent focused set passes **4 files / 157 tests**; deterministic TypeScript and `git diff --check` pass.

The correction's one literal `npm run check` passed TypeScript and all **19 resource-intensive files** with valid diagnostics. Ordinary reported the six established missing ignored-output fixture failures plus one AST producer-census mismatch: the new intentional `InvalidTemplateContractError` raised the exact compiler producer count from `15` to `16`. Only that frozen test expectation was corrected; its focused regression and TypeScript passed, and the literal full gate was not rerun. The six fixtures remain a separate Production/release HOLD.

## Third canonical attempt and compiler-boundary normalization correction

At pushed HEAD `da8bf931819a66a60631c5abf43d825ca4b3d932`, output root `outputs/r1d-wizard-bunny-bedtime-full-book-da8bf931-20260811T171008861Z` passed canonical probe `59938307…`, Fresh Readiness plus replay verify `f91e5177…`, Execution Request `31e55139…`, Supervisor readiness `f9044a17…`, official pricing, one canonical preflight and one Supervisor verify. The one live invocation ran for 225.3 seconds and exited 1 after one completed provider response.

- Receipt: `ce0d7c7aa97690c3e6adfbbb2c2adb945c35d5359f58f4568f25b8a0e86776dd`; readiness: `a38716922f5dadf13d448ce15a1269975c738d774e456ce9ed48b7c6e963fde8`.
- Provider calls / repairs / transport retries / fallback: `1 / 0 / 0 / none`.
- Usage: input `12,650`; cache-write `0`; cached `12,647`; output `16,275`; reasoning `2,531`; total `28,925`.
- Local accounting: `$0.494589` nominal and `$0.624044` conservative; not a provider-account audit.
- Terminal: `local_processing_failed` / `unexpected_local_failure` / `unexpected_local_error`; candidate and all downstream authorities absent. The Supervisor alone read the approved credential source and cleared its authority; raw stdout/stderr were suppressed.

The sanitized receipt intentionally cannot identify the exact producer because neither raw provider output nor exception material is persisted. Therefore the correction does not invent that provenance. What the repeated result does falsify is the earlier constructor-only scope: provider-authored structural coordinates pass through several typed diagnostic producers, and rejection by either closed diagnostic normalizer must reach the bounded draft-repair boundary rather than collapse into a generic local terminal.

The compiler boundary now admits exactly two internal error identities into that route: `draft validation diagnostic contract invalid` and `draft authority/reference diagnostic contract invalid`. Both become the same sanitized `draft_contract/final_structural_invariant_invalid` root-authority issue and retain the existing full-draft repair semantics. Every other `Error`, including arbitrary programming failures, remains terminal and cannot consume repair spend. A direct regression freezes the two-value allowlist and rejects arbitrary errors/non-Error strings; the non-positive-page repair regression remains green.

Validation passes **4 files / 270 tests** (`draft-reference-domain-hardening`, `draft-validation-diagnostics`, `source-authority-lifecycle`, and `canonical-live-authoring-boundary`), deterministic TypeScript and `git diff --check`. No second repository-wide check was run; the earlier recorded literal gate and its separate six-fixture release HOLD remain the repository-wide evidence for this branch.

## All-slot qualification and complete LOW book proof

The general runner mode `wizard-catalog-full-book` accepts only an exact catalog `storyKey` plus the canonical child anchor and output root. It resolves the selected Story Source, direction, companion and Visual Contract candidate from the current content-addressed catalog, then derives the page-complete shot plan, Visual Package, Blueprint and runtime authority. It does not accept story prose, prompt text, raw schema or a story-specific overlay.

All eighteen public Wizard slots passed the same zero-cost qualify-only path: six companions multiplied by bedtime, adventure and fantasy. The completed validation also exposed and fixed three general legacy-input defects before spend: missing structured cover zone/cast, time-of-day values outside the current closed domain, and final-page replacement erasing the only member of a required shot-plan quota. Focused validation after correction passed `3 files / 13 tests`; deterministic TypeScript and `git diff --check` passed.

The selected proof was `bunny_ometz_bedtime`, eight pages, Bar and the approved canonical Style01 anchor SHA-256 `3715cf8f6dcb1775abba4a81138ac41a2bb2db437b38efaad6aaea936cdbcb88`. Output root:

`outputs/r1d-wizard-bunny-bedtime-full-book-low-9a58a967-20260811T2100Z`

- Authority status: `rendered_local_low_wizard_catalog_full_book_measurement`.
- Story Source SHA-256: `99f0782c666d4eac95e20b7c3059a273a4a5478910835f74c99f595a243af6f1`.
- Shot-plan SHA-256: `80fc2d873e448a10140c005c2302c46416c154543ae35cd06b817b6721529e6b`; distinct measured frame signatures: `8`.
- Visual Package v5 revision: `d7b5edb0b7b1ef3cb9ec5039e83bc52e3beaff6b4e4e0cfb42ce4a4446259258`.
- Blueprint v4 digest: `0d706f6cd4db84ef77e2517c86315245e533a2658236f9d5e18e362dde7f782f`.
- Runtime v6 contract: `c1811709535789b29ca5ced9abf68f1b585aad1a50b5594cabe04267793dccb6`.
- Calls/retries/fallback/Vision: `8 / 0 / false / 0`; quality `low`; size `1024x1536`.
- Contact sheet SHA-256: `a4b83b15dbd826448a34e9991ee657daedc90cc56565c8180d54d6117216328e`.
- Provider cost estimate: unavailable (`estimatedCostUsd:null` on every page), so this evidence makes no invoice or billing-account claim.
- Remote database/storage, Board, publication and Production: none. `productionEligible:false`, `productionBlocked:true`.

Visual inspection confirms one recognizable Bar and Buni, one coherent watercolor treatment and a changing expression/story arc across eight distinct compositions. It also records two LOW defects rather than calling the book final: the shoes shift between brown and blue, and the pajama shirt briefly loses its star pattern. The complete book is therefore a meaningful Wizard-connected visual proof and a product-review candidate, not Production acceptance.

The eight exact rendered pages were compressed to tracked WebP assets without regeneration and bound to `bunny_ometz_bedtime.md` through the existing `tracked-qa-reader-fixture/v1` loader. Reader/library and physical-page-turn validation passed `2 files / 12 tests`, deterministic TypeScript and `git diff --check`.

Vercel Preview `dpl_rwujqqBokG9ofi4DCsbA5MhoHF63` reached Ready after `ALLOW_STAGING_QA=true` was scoped only to `codex/r1d-wizard-story-companion-full-book-readiness`. The authenticated remote API returned the exact fixture id, title, pages `1..8`, eight distinct deployable image URLs, authority `tracked-qa-reader-fixture/v1` and source-render HEAD `9a58a967e0b6486af4a7897c67314d8f199cd17d`. Deployment Protection remains enabled; the anonymous in-app browser reached Vercel login rather than the app.

The same committed fixture was exercised in the real Reader locally because the connected Chrome browser blocked the protected Vercel host before HTTP. Forward mid-flight exposed one `data-physical-page-turn="forward"` sheet and `data-page-turn-mode="physical-sheet"`; backward sampling at 45/125/225 ms exposed one `backward` sheet throughout. The outer Reader bounds stayed exactly `917.359375 × 561.59375` at `173.8203125,120.3984375`; the host animation name was `none`, confirming the former whole-book motion is absent. At rest the sheet unmounted and mode returned to `instant`.

Preview URL:

`https://small-heroes-qiy70umby-smallheroes-projects.vercel.app/dev/viewer?dir=r1d-bunny-bar-full-bedtime-book-reader-qa-9a58a967&root=outputs`

This Preview is the QA handoff. It was not promoted, aliased to Production or made anonymous; Production remains blocked.

## Boundaries

This milestone does not promote a Production candidate, approve Production reconciliation, build a Production Visual Package, write database/storage, publish or open Production. The complete LOW book uses explicitly QA-only derived authority and tracked Reader fixtures. All eighteen slots are proven through the zero-cost qualification boundary; only the selected eight-page Bunny bedtime slot was rendered. No claim is made that all eighteen have Production Blueprints or packages.
