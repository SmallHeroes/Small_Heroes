# R1D Product-Accepted Lineage Fail-Closed Selection — Implementation Evidence

Date: 2026-09-01

Branch: `codex/r1d-order-package-authority-binding`

Decision Gate:
`docs/ai-workflow/R1D_PRODUCT_ACCEPTED_LINEAGE_FAIL_CLOSED_SELECTION_DECISION_GATE.md`

## Root cause

Post-Order execution already uses immutable frozen package authority correctly. The missing
invariant was before Order creation: `resolveStoryProductTruth` and `isSlotSellable` attempted v4
and then fell through to v3/QA/golden sources when v4 was absent or unsuitable. A technically
valid v4 package could also bind a superseded accepted revision.

The current Chameleon locator demonstrates both risks. It selects package `2b488f2d...`, whose
source is legacy accepted revision `20a12801...`, while Guy's product-accepted final enriched
revision is `3ef64541...`.

## Implemented general authority boundary

`acceptedProductLineageDisposition` inspects only the canonical direct revision inventory below
`story-pipeline/04_approved_story_sources/accepted/<storyKey>/revisions`. Its total result is:

- `absent`: no revision-level product acceptance; legacy fallback remains allowed;
- `present`: at least one canonical direct `product-acceptance.json`; v4 is mandatory;
- `invalid`: unsafe/unreadable/malformed inventory; v4 remains mandatory and fresh selection
  fails closed.

The broad trigger does not choose a revision. It validates each direct acceptance artifact as
canonical JSON and requires a nonempty version, `status: accepted`, exact
`acceptedBy: Guy`, exact story/revision identity, and a valid self-consistent digest. Unsafe,
unreadable, malformed or aliased inventory is an `invalid` required lineage, never `absent`.
For a required lineage, `evaluateWizardVisualPackageSelection` validates the package-selected
source with the existing `loadAcceptedStorySourceAuthoringAuthority` strict loader. That loader
accepts only the exact final v3 accepted-revision inventory and validates canonical bytes, Guy
acceptance, Claude technical review, continuity authority, story key, revision identity, and all
file digests.

An adversarial pre-handoff review then demonstrated that recomputable digests alone were not a
complete authorization boundary: a fully canonical product acceptance could be re-digested with
`runtimeEligibility.eligible: true` and consistently re-bound into a re-digested manifest. The
strict loader now enforces the complete v1 product-acceptance and technical-review top-level key
sets, canonical UTC approval time, digest algorithms, closed exclusions, exact runtime
ineligibility equal to the manifest, closed accepted-MINOR records, and manifest approval binding.
A hostile regression re-digests both files after the contradictory runtime mutation and proves
fresh Wizard selection returns `renderQualified: false`, `visualPackageRequired: true`, with
package, frozen authority, source digest/path and page count all null.

This produces the intended deterministic split without a story-specific registry:

- legacy `20a12801...`: v2 authority, rejected for fresh selection;
- intermediate `eca8b3c8...`: not final accepted-v3 authority, rejected;
- final `3ef64541...`: strict accepted-v3 authority, eligible once a current v4 package binds it.

The returned Wizard selection now carries `visualPackageRequired`. Matrix sellability and product
resolution both stop before legacy fallback when it is true. The Wizard matrix API suppresses
legacy QA-catalog readiness for that same required lineage, so its public `selectable`,
`qaAuthoringReady`, `candidateDigest`, availability and sellability fields cannot contradict the
Order resolver. Runtime preflight consumes the same selection boundary.

Every fresh legacy-bank probe involved in this route now receives the caller's explicit
`repoRoot`; an empty or isolated root cannot discover v3/QA assets from `process.cwd()`. The
all-slot render audit uses the policy-aware Wizard selection for required lineages and keeps
source/package provenance atomic. The current rejected package therefore records a null source
beside its attempted v4 package path rather than pairing that package with an unrelated v3-bank
source. A positive synthetic `3ef64541...` package is both sellable and render-qualified and is
not falsely rejected by strict release mode.

## Historical replay preserved

No Order, render, delivery, or frozen-authority production code changed. Tests that previously
constructed a historical Order by calling the mutable fresh resolver were corrected to load the
exact immutable legacy package revision directly. Historical `20a12801...` Orders continue to
validate and replay their frozen package; only creation of a new Order consults current lineage.

## Offline evidence

- focused changed-path gate: **10 files / 141 tests PASS**;
- includes final accepted package positive case, legacy package negative case, missing package,
  v3/QA flags, alternate style, malformed acceptance content, hard-linked acceptance, 17
  lineage-absent counterexamples, alternate/empty root isolation, atomic audit provenance,
  Wizard API, runtime preflight, frozen Order authority, and accepted-revision
  resume/finalization;
- independent internal contamination sweep: **8 files / 111 tests PASS**, with no active
  fresh-Wizard, UI, resolver, style, flag, alternate-root, audit or frozen-Order bypass;
- `npx --no-install tsc --noEmit`: exit 0;
- `npm run story:autonomous-typecheck`: exit 0;
- `git diff --check`: clean.

Literal `npm run check` reproduced the established ordinary ignored-output baseline only: five
unchanged fixture files / nine assertions failed because their gitignored `outputs/` inputs are
absent; 4,317 tests passed and 73 skipped. Its resource partition completed all 20 files / 632
tests successfully, followed by the three known Vitest worker `onTaskUpdate` RPC timeout errors.
The literal command therefore remains exit 1 and is not represented as green. Independent Claude
Code Opus/max review of the focused immutable commit remains pending and is not pre-claimed here.

## Explicit exclusions

No provider, count endpoint, credential read, network, image, audio, render, Order/payment,
database, deployment, Visual Package publication, locator mutation, or push occurred. The current
slot is intentionally unavailable until a new package bound to `3ef64541...` is approved and
promoted.
