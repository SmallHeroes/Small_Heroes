# R1D Product-Accepted Lineage Fail-Closed Selection — Decision Gate

Date: 2026-09-01

Branch: `codex/r1d-order-package-authority-binding`

Prior owner decision: Guy designated Story Source revision `3ef64541...` as the Chameleon
product lineage and `20a12801...` as legacy. The approved Order-frozen authority Decision Gate
states that legacy must not be silently re-selected. `CURRENT.md` Round 12 separately records the
required general rule: once an accepted lineage has a revision-level product acceptance, fresh
selection may not fall back to v3.

## 1. Proposed change

Make fresh Wizard selection derive a total product-lineage disposition from canonical accepted
revision artifacts. Any lineage with a direct revision-level `product-acceptance.json` becomes
Visual-Package-required. A current v4 package is eligible only when its selected source passes the
existing strict final accepted-revision authority loader. Missing, legacy, intermediate, malformed,
or aliased authority stops fresh selection before v3, QA-bank, golden, or generic fallback.

## 2. Why now?

The current Chameleon locator selects render-qualified package `2b488f2d...`, which binds legacy
Story Source `20a12801...`. The approved product revision is `3ef64541...`. Without this gate a new
Wizard Order can freeze the wrong story even after the new Blueprint pipeline is fixed.

## 3. Scope

General fresh-order admission rule. No story-key or revision-digest branch is added. Product
designation comes from accepted-lineage artifacts; the approved current v4 locator continues to
choose which valid final accepted revision is current.

## 4. Risk of hardcoding

No code constant names Chameleon, Bar, either revision, or a page. The same rule applies when any
future story lineage receives revision-level product acceptance. Lineage-absent slots preserve
their existing v3/golden behavior.

## 5. Files likely affected

- `lib/visual-package/acceptedStorySourceAuthoringAuthority.ts`
- `lib/visual-package/wizardVisualPackageSelection.ts`
- `lib/visual-package/audit.ts` and its structured reason type
- `backend/config/mvp-story-matrix.ts`
- `backend/providers/story-bank-index.ts`
- `backend/providers/story-product-resolver.ts`
- `lib/web/mvp-matrix-response.ts`
- focused selection, matrix, resolver, Wizard API, and frozen-order tests
- `CURRENT.md` and implementation evidence

## 6. Expected behavior after change

- Current legacy Chameleon package is not production-qualified or sellable for a new Order.
- Flags cannot reopen v3 or QA-bank fallback for a product-accepted lineage.
- QA catalog readiness cannot contradict production admission for a required lineage.
- Every explicit repository-root audit/selection uses that root rather than borrowing legacy
  assets from the process working directory.
- Audit source/package provenance always comes from one authority lane.
- A package bound to the exact final accepted revision becomes eligible without a code change.
- The other 17 lineage-absent MVP slots behave as before.
- Existing frozen legacy/package Orders replay from their own immutable authority and never consult
  the mutable lineage rule.

## 7. Validation plan

Use only offline tests: present/absent/invalid lineage, hard-link rejection, missing package,
legacy package, final accepted package, alternate style, QA/v3 flags, Wizard matrix response,
explicit alternate/empty roots, atomic audit provenance, Order route, runtime preflight,
historical text finalization, and frozen authority. Then run both TypeScript phases,
`git diff --check`, the repository check, and independent Claude Code Opus/max review.

## 8. Cost impact

Zero. Filesystem reads only. No provider, token-count endpoint, image, audio, render, database, or
deployment operation.

## 9. Rollback plan

Revert the focused implementation commit. No artifact, locator, Order, schema, or database data is
migrated.

## 10. Review assignment

The product choice is already explicit: new Orders must not silently serve legacy `20a12801...`.
Claude Code must try to falsify artifact discovery, alias/hard-link handling, strict positive
binding, non-product counterexamples, flag bypasses, and historical frozen-order replay.

## 11. Do not do

- Do not hardcode a story or revision.
- Do not choose “latest” by timestamp, directory order, or lexical digest.
- Do not delete fallback globally.
- Do not make historical Order replay consult current locator/lineage state.
- Do not promote a locator, call a provider, create an Order, render, deploy, or push in this
  milestone.
