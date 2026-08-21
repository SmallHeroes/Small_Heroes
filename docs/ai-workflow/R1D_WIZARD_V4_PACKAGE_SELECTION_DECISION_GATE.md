# R1D Wizard Visual Package v4 Selection Decision Gate

**Owner decision:** Guy authorized publication of revision
`a9c253d989118262ed2b38a671fc7eccf6af44a084512af35285ad2f548a14fb`
and instructed Codex to continue until the Wizard is operational without
requesting routine approvals.

## 1. Proposed change

Make one current, render-qualified Visual Package v4 revision the shared
selection authority for Wizard availability, order-slot validation and Story
Source resolution. The selected on-disk Story Source must match the package's
normalized identity and raw SHA-256 before the slot is offered.

## 2. Why now?

The approved v4 package is published and passes v4 runtime qualification, but
the Wizard matrix still consults the legacy visual-package/v3 manifest path and
the order resolver still prefers `story-bank/v3-approved`. The UI therefore
reports the new Chameleon bedtime story unavailable and an order could select
the older story instead of the source frozen into the approved v4 package.
This blocks the first real new-story Wizard render.

## 3. Scope

General production selection change. It applies to every future story/style
with a valid current v4 locator; it contains no Chameleon-, child- or page-
specific branch.

## 4. Risk of hardcoding

The implementation derives `storyKey` from the matrix companion and direction,
loads the current package through the generic v4 locator, and validates the
package-bound source path and digests. No story names, source directories or
revision digests are embedded in production code.

## 5. Files likely affected

- `lib/visual-package/visualPackageV4.ts` or a focused v4 Wizard-selection module
- `backend/config/mvp-story-matrix.ts`
- `backend/providers/story-product-resolver.ts`
- `lib/web/mvp-matrix-response.ts`
- focused Matrix, resolver and runtime qualification tests
- `CURRENT.md` and implementation evidence

## 6. Expected behavior after change

When a current v4 package and its exact Story Source are valid, the Wizard marks
that matrix slot `production_render_qualified`, order validation accepts it,
the order freezes the package-bound source rather than a legacy story, and the
existing render preflight loads only the immutable revision. Missing, stale or
redigested source/package/locator evidence fails closed before purchase or image
spend. Slots without v4 authority retain their existing legacy behavior.

## 7. Validation plan

1. Unit-test current v4 package plus exact source acceptance and source/path/
   locator/digest tamper rejection.
2. Prove the Chameleon bedtime Matrix row becomes selectable and production-
   qualified while unrelated rows are unchanged.
3. Prove `resolveStoryProductTruth` returns the package-bound autonomous source
   and exact eight-page product.
4. Prove the existing freeze/render preflight binds the published revision and
   rejects source drift before provider access.
5. Run focused suites, TypeScript and `git diff --check`, then browser/API E2E.
6. Only after all provider-free checks pass, run one LOW page through the real
   Wizard authority path.

## 8. Cost impact

Implementation and all initial verification are local and cost $0. The final
proof is limited to one approved gpt-image-2 LOW page; no full-book render is
part of this gate.

## 9. Rollback plan

Revert the focused selection commit and restore/remove the current locator.
Immutable package revisions and prior Story Sources remain untouched, so no
historical artifact rewrite is required.

## 10. Review assignment

Guy has approved the product objective and the exact package publication.
Claude Code must independently try to falsify cross-story selection, stale
source acceptance, legacy fallback preservation, server/client import safety,
order-versus-UI divergence and provider-before-gate behavior. No separate
creative consultation is needed for this wiring milestone.

## 11. Do not do

- Do not overwrite or relabel the legacy `v3-approved` story.
- Do not special-case Chameleon, bedtime or the approved revision digest.
- Do not weaken source/package digest validation.
- Do not alter price, page counts, model, retry, fallback or render quality.
- Do not run a full book or publish/deploy to production in this milestone.
