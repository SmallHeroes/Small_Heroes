# R1D Coherent QA Release Continuity — Decision Gate

**Status:** approved by Guy on 2026-09-01 for offline implementation, independent Claude Code QA,
one bounded dad-voice audition after PASS, and one full paid QA render only after the complete fresh
path is proven coherent.

## 1. Proposed change

Close the split-deployment release failure without changing the approved Chameleon authoring
artifacts:

1. Integrate the accepted Landing/Wizard/generating presentation from reader commit `4f1c8e2c...`
   onto authority commit `c187bf18...`, preserving the authority branch's runtime tracing and
   package-selection code.
2. Add one exact `wizard-product-binding/v1` produced by the server from the selected Story Source
   and Visual Package. Deployment ID/SHA accompany it as diagnostics; compatibility is decided by
   the release protocol plus exact frozen package bytes, not by pinning forever to one commit.
   The browser treats the binding as an expectation, never as authority.
3. Route the complete fresh QA path through a `release/v1` namespace that does not exist on the
   stale deployment: preorder, Order, checkout, fake-payment confirmation, generating status and
   worker. Each server endpoint re-derives and compares its authority before its first write,
   lease, paid transition or provider boundary. There is no fallback to legacy endpoints.
4. Keep existing unversioned Order/payment/status routes for historical clients and artifacts.
5. Pin package-backed worker dispatch to the initiating Vercel deployment and keep status recovery
   order-scoped; a public poll must not let another deployment sweep unrelated jobs. In Vercel,
   `VERCEL_URL` outranks any stable-domain worker override.
6. After code PASS, deploy one coherent branch and make that branch the durable owner of
   `qa.smallheroes.co.il`; do not use a temporary alias to a differently bound branch.
7. Preserve the internal narration choice `dad`, but change its ElevenLabs provider voice ID to
   `NaMUH1vcebhHvD4z3Lku`. Set Dad preview URLs to null during offline work; do not present an old
   preview recording as the new voice. Bind a new preview only after its bounded audition exists.
8. Apply Guy's separately specified reader polish before the new proof render: one canonical 22px
   desktop text geometry shared by static and moving pages, a physical closed-cover component at the
   open-book scale, a 4–5% desktop-height reduction with reserved controls space, and pixel-equivalent
   static/animated destination geometry so page-turn removal has no terminal jump.

## 2. Why now?

The first completed QA Order was not a new-engine release proof. The Wizard began on deployment
`dpl_DW...` at `c187bf18...`; at `09:22:23Z`, the permanently branch-bound QA domain moved to
`dpl_8k...` at old reader commit `4f1c8e2c...`. Relative browser requests then created and rendered
a legacy v3 Order. The current preorder attestation exists but is not connected to the public
Wizard→Order path, and the generating status endpoint can also dispatch stale work.

This blocks honest product judgement: the approved package and Companion State cannot be assessed
from legacy output.

## 3. Scope

- General release-continuity and stale-deployment protection for fresh Wizard sessions.
- UI integration and reader polish already requested by Guy.
- Provider voice registry configuration for the canonical `dad` choice.
- No Story Source, Blueprint, Visual Contract, Board, Candidate, package, locator or image-prompt
  change.
- No architecture-simplification refactor beyond recording observations.

## 4. Risk of hardcoding

The binding is derived from generic product resolution and frozen authority; it contains no child,
companion-specific exception or Chameleon-only branch. Package-backed and genuine legacy identities
remain distinct. `release/v1` is the explicit package-backed lane and must never manufacture
authority or downgrade a package expectation to legacy. Historical clients retain the separate
legacy endpoints.

## 5. Files likely affected

- `app/api/wizard/product-truth/route.ts`
- new release-binding module under `lib/generation-pipeline/`
- fresh `release/v1` preorder, Order, checkout, fake-payment, status and worker entrypoints plus
  shared handlers
- `app/api/orders/route.ts`, `app/api/checkout/route.ts` only as needed to extract shared logic while
  preserving legacy behavior
- `public/JS/wizard.js`, versioned generating/fake-payment client surfaces, cache-busting HTML
- `lib/generation-chunked/chain-worker.ts` and order-scoped sweeper/status integration
- `backend/config/voices.ts`, `public/JS/content.js`, TTS seam tests
- reader-v2 component/CSS and physical-page-turn tests
- `next.config.js` tracing for every new route
- focused tests, `CURRENT.md`, and implementation evidence

No Prisma/schema migration is planned. If implementation proves one is required, stop and reopen
this gate before changing the database.

Rejected as unnecessary complexity: an HMAC over client expectation (the server re-derives every
field and trusts none of it), new Order deployment-provenance columns (the durable product authority
already exists), and deployment-pinned cross-origin browser requests (they weaken same-origin and
cookie protections). A compatible later deployment may recover the exact frozen package; an old
deployment is excluded by route absence.

## 6. Expected behavior after change

- Matrix or exact product-binding failure disables fresh checkout; stale cached truth is cleared.
- The Wizard submits the exact binding it displayed to a versioned Order endpoint.
- A `release/v1` page sent to the stale deployment receives 404 because the namespace is absent.
  A later compatible `release/v1` deployment may continue only when it can load and validate the
  exact frozen package/source; a missing/different package fails before mutation.
- A package expectation cannot resolve or replay as legacy; package A cannot replay as package B.
- Exact replay remains idempotent and uses the historical Order's frozen package/source bytes.
- Checkout and fake payment reject a missing/different frozen package before charge or paid
  transition.
- A package-backed job is dispatched only to the versioned worker on the initiating deployment;
  the versioned status poll recovers exactly its Order and cannot sweep unrelated jobs.
- The success response exposes the exact frozen source/package identity used, so QA verifies it
  before payment instead of inferring from `bookName`.
- The coherent QA domain cannot be reclaimed by the old reader branch.
- `dad` reaches ElevenLabs voice `NaMUH1vcebhHvD4z3Lku` with existing tuning and TTS niqqud gates.
- The reader meets the four visual/animation acceptance points above.

## 7. Validation plan

Offline first:

- stale namespace 404, v4→legacy downgrade, package A→B, stale session replay,
  malformed/missing binding and absent versioned endpoint;
- assert zero storage/DB/payment mutations on every mismatch;
- exact replay and legacy-route compatibility regressions;
- checkout/fake-confirm mismatch before lease, coupon, payment or generation writes;
- generic worker rejects package-backed jobs; versioned worker validates the frozen package before
  lease/provider work; worker-base precedence and order-scoped status recovery regressions;
- product-truth/Wizard fail-closed tests, including network/schema failure and no legacy fallback;
- current package/locator/runtime-preflight suites;
- mocked TTS request proves the new Dad provider ID and existing settings/niqqud behavior;
- reader component/animation tests plus visual browser QA at target viewport;
- `npx tsc --noEmit`, focused suites, build, `npm run check` with honest baseline accounting, and
  `git diff --check`.

Claude Code then reviews the immutable implementation range read-only and must return PASS before
any provider, deployment mutation or render.

After PASS: deploy the coherent branch, bind the QA domain to it, verify domain branch + deployment
SHA + product/package attestation, audition one short Dad sample, create one new Bar/age-5 Order,
inspect its frozen accepted source/package authority before fake payment, then perform exactly one
authorized full render. Guy visually judges the Companion State, scale, cover, reader and voice.

## 8. Cost impact

Offline implementation and QA cost $0 in provider spend. After PASS, the only planned provider
spend is one short Dad TTS audition and one explicitly authorized full QA render. There are no blind
retries; any failure stops before another paid attempt.

## 9. Rollback plan

- Revert each focused commit independently.
- Legacy routes and historical artifacts remain intact throughout.
- Rebind the QA domain to the last reviewed coherent deployment if the new deployment fails before
  any payment; never point it back to the stale reader branch.
- Preserve the legacy incident Order unchanged as evidence.

## 10. Review assignment

Guy has decided the product direction, voice ID, reader requirements and bounded render authority.
Claude Code must try to falsify exact equality, no-write ordering, replay, route absence on old code,
checkout/payment TOCTOU, worker host pinning, tracing completeness, UI/authority merge preservation,
voice mapping and reader regressions. Guy performs final visual/product acceptance.

## 11. Do not do

- Do not rerender or call TTS before offline PASS and independent Claude PASS.
- Do not reuse, mutate or delete Order `cmtigpkxr0002l204y3j7bx4q`.
- Do not temporarily alias QA to a branch other than its durable configured owner.
- Do not fall back from a fresh versioned route to an unversioned legacy route.
- Do not use real PayMe in this bounded QA milestone; production callbacks need the same versioned
  admission before the fresh protocol is enabled for real money.
- Do not weaken package, Story Source, Board, replay, payment or delivery fail-closed checks.
- Do not change approved authoring artifacts or open the broad simplification refactor.
