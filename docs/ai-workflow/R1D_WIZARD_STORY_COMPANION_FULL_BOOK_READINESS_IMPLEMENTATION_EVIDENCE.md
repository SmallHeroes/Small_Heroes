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
- Catalog digest: `fe3bb36235a94cc169e0f017e89ab9f9f529dadfab2159799ce1b58fa229e4cf`
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

## Boundaries

This milestone does not promote candidates, approve reconciliation, author a Blueprint, build a Production Visual Package, access credentials, call a provider, render images, write database/storage, publish, deploy or open Production. It proves that all active Wizard slots have exact general inputs for the next Blueprint-authoring boundary; it does not claim that all eighteen have pre-authored Blueprints or Production packages.
