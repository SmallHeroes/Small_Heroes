# Architecture Simplification Findings — Observation Log

**Status:** observations only. The 2026-09-01 completed render used a legacy deployment and Story
Source, so the first successful full render through the new package-backed path remains unproven.
No refactor is authorized by this document.

**Product direction:** preserve fail-closed validation, replay safety and provenance while reducing
moving parts. Finish one correct package-backed render before the post-render architecture review.

## Empirical boundary evidence

The split-deployment incident confirms that the two milestones are separate, but does not establish
a new-path RELEASE PASS:

- **AUTHORING PASS** closed before deployment and customer-flow work: approved Story Source,
  Blueprint `97fad2ac...`, approved Home/Route Boards, Visual Package Candidate `e7fe4e68...`, and
  immutable published package revision `836a3414...` were already complete.
- **RELEASE HOLD** followed: the current Wizard began on deployment `dpl_DW...`, then the QA domain
  automatically moved to old reader deployment `dpl_8k...` before Order creation. Order
  `cmtigpkxr0002l204y3j7bx4q` reached `ready`, but it froze a legacy v3 Story Source and no Visual
  Package authority. Its completed assets prove the legacy release machinery can finish; they do
  not prove the approved package-backed product path.

Therefore this incident is classified under RELEASE, while the immutable authored package remains
AUTHORING PASS. The first correct package-backed render is still the required empirical boundary.

## Milestone boundary

Define two separately visible outcomes:

- **AUTHORING PASS:** Story Source → Blueprint → Visual Contract → required Boards → valid Candidate.
- **RELEASE PASS:** approved Candidate → package → locator/release selection → Wizard eligibility →
  Order → render/delivery.

A package locator or Wizard activation failure is a Release failure, not an Authoring failure.

## Findings to review after the first render

### Duplicated authority

- Frozen Visual Package, Order authority, pipeline cache and resolved contract repeat overlapping
  source/package/template/style/reconciliation identities and then cross-validate them.
- Frozen Board inventory repeats fields derivable from contract + style + Board version. This is
  useful hostile evidence today, but creates many contradiction states and validators.
- Board bind and pre-render assertion both re-derive admission/identity; retain the distinct
  byte-freshness fence, but investigate sharing one validated resolution result.
- Blueprint world topology is authored in both directions: connections carry affordance-ID arrays
  while affordances repeat their connection/zone consumers. Camera reverse links already use the
  preferred pattern — provider supplies the forward choice and the compiler derives the reverse
  frame consumer. Apply that pattern incrementally to the remaining world graph.
- Structured page actions/props/safety are deterministically projected into stored
  `mustShow`/`mustNotShow` prose and later filtered back out at provider egress. For fresh authoring,
  keep structured requirements canonical and persist only genuinely residual creative prose;
  retain expanded prose only behind historical replay adapters.

### Provider-owned data that may be compiler-owned

- Blueprint draft frames still ask the provider for `kind` and `pageNumber`, although exact frame
  coverage and canonical identities are compiler-owned and most technical fields are already
  overlaid deterministically.
- Draft placements still ask the provider to copy placement IDs and cast/prop/check/geometry IDs.
  Replace those with compiler-owned ordered catalogs and bounded semantic choice indexes where the
  source contract makes the binding unique.
- Connections and affordances still ask the provider for IDs and reverse-link inventories. Prefer
  semantic edge kind, bounded endpoints, geometry and camera/composition intent; let one normalized
  compiler graph mint IDs and derive reverse views.
- Continue the established principle: provider expresses semantic intent; compiler owns frame,
  check, prop/consumer and reverse-link plumbing wherever derivable.

### Repeated validation and gates

- Product resolution and sellability can evaluate the same Wizard selection more than once.
- `POST /api/orders` runs the matrix sellability gate and then resolves the product again; the
  matrix response likewise computes its slot summary and separately evaluates v4. Resolve once per
  server operation and pass one validated immutable selection forward.
- Wizard runtime preflight qualifies a package, binds/asserts Boards, then render qualification
  reloads/revalidates the same immutable package.
- Separate real stage-specific freshness/CAS checks from repeated pure identity validation and
  consider one reusable validated authority snapshot.
- Full Blueprint semantics are validated during authoring, lifecycle review/approval and package
  load. Keep validation after each byte reload or trust-boundary crossing, but avoid revalidating
  identical in-memory bytes multiple times inside one operation. A typed `ValidatedBlueprintSnapshot`
  would make that distinction explicit.
- `stableGeometry` is stored even when it is an exact projection of spatial nodes/relations. Keep
  it as a derived compatibility view for fresh artifacts rather than another authored field.

### Legacy isolation

- Fresh product selection still contains ordinary v3/golden fallback for lineages that do not
  require a Visual Package. Review whether fresh authored products can use an explicit package-only
  lane while legacy slots remain isolated.
- Blueprint assembly shares current and legacy schema branches in one core implementation; current
  dispatch is guarded, but replay coupling remains.
- Preserve v6/v7/v8 historical loaders and byte replay, but move them behind explicit adapters so
  fresh authoring cannot silently enter a legacy branch and fresh code does not accumulate replay
  conditionals.
- Delivery currently selects the manifest lane versus the large legacy/OFF lane through a global
  readiness flag rather than the durable Order origin. Use the existing
  `orderRequiresVisualPackageAuthority` discriminator: every package-backed Order takes the new
  release lane, while only a genuine legacy Order may reach legacy delivery.
- Text finalization and contract production each combine strict package-backed resolution with
  story-bank/cache/artifact fallbacks. Dispatch once into `package_v4` or `legacy_story_bank`, then
  keep legacy selection and degradation entirely inside the legacy adapter.
- The fresh Wizard still sends a legacy `length` claim beside canonical `direction`. Stop emitting
  it for fresh sessions; accept it only as server-side compatibility for historical sessions.

### Earlier failure classification

- Visual Contract provider failures use rich sanitized classification; Blueprint provider failures
  currently collapse more cases into generic `provider_call_failed`. Reuse early structural
  classification without exposing raw provider prose or PII.
- Report failure ownership at the first stable boundary: `authoring`, `publication`, `selection`,
  `checkout`, `render`, `delivery`, or `reader`. This prevents a release failure from being reported
  as “book creation failed” and bounds the investigation surface before repository-wide work.
- Wizard availability currently defaults to selectable when matrix data is absent, swallows the
  matrix-load failure, and can ignore product-truth fetch failure; the server remains fail-closed at
  Order creation, so this is not an authority bypass. For fresh package-backed products, disable
  selection/submission until both matrix and product truth are present so the UI fails closed too.

### Authoring versus release

- Package lifecycle artifacts distinguish candidate, approved and published, but publishing the
  current locator effectively activates Wizard sellability. Clarify whether locator publication is
  a Release action and whether a separate explicit release authority is needed.
- Track package/locator/Wizard/Order failures under RELEASE PASS rather than presenting them as book
  authoring failure.

## Prioritized simplification candidates

1. **Fresh semantic-only provider contract (highest value).** Remove duplicated derived prose and
   replace copyable technical identities with compiler-owned catalogs/choice indexes. Preserve old
   schemas as replay-only.
2. **One normalized Blueprint world graph.** Author forward semantic relationships once; derive IDs,
   reverse consumers and compatibility views deterministically.
3. **One validated immutable release snapshot per operation.** Revalidate on disk/database trust
   crossings, but share the pure validated result among adjacent package, Board and render checks.
4. **Explicit fresh-package release lane.** Dispatch from the durable Order package authority, not
   a global readiness flag. Keep lineage-absent legacy products in an isolated compatibility lane;
   do not let package-backed Orders reach ordinary v3/golden, cache or readiness-OFF fallback.
5. **Fail-closed fresh Wizard UI.** Require matrix plus product truth before selection or checkout,
   and stop emitting the legacy `length` claim from new sessions.
6. **Visible failure ownership.** Surface AUTHORING versus RELEASE and the narrower release stage in
   receipts/status/operations before deciding whether a local, integration or hostile full review
   is warranted.

Suggested first implementation milestone: item 1, limited to one fresh schema cutover plus replay
adapters and an offline production-scale harness. It has the highest evidence-backed reduction in
contradiction states without weakening provenance or changing historical bytes. Item 3 should wait
until the exact freshness/trust-boundary invariants are enumerated; removing repeated checks
prematurely would be unsafe.

## Evidence anchors

- Provider-authored technical fields: `lib/visual-package/preRenderBlueprintDraftSchema.ts:330`
  and `:365`; deterministic frame/camera overlays:
  `lib/visual-package/preRenderBlueprintAuthoring.ts:289` and `:371`.
- Derived stored prose and provider filtering:
  `lib/visual-contract-compiler/validateBookVisualContract.ts:1640` and
  `lib/visual-package/preRenderBlueprintProviderWire.ts:140`.
- Derived stable geometry: `lib/visual-contract-compiler/validateBookVisualContract.ts:688`.
- Repeated Blueprint validation: `lib/visual-package/preRenderBlueprintAuthoring.ts:775`,
  `lib/visual-package/preRenderBlueprintLifecycle.ts:325` and `:1121`, and
  `lib/visual-package/visualPackageV4.ts:640`.
- Canonical Board identity and repeated consumers: `lib/set-identity-board/expectedIdentity.ts:53`,
  `lib/visual-package/artifacts.ts:229`, `lib/set-identity-board/resolveBoards.ts:276`,
  `lib/generation-pipeline/wizard-runtime-authority-preflight.ts:187`, and
  `lib/generation-pipeline/render-qualification-preflight.ts:342`.
- Fresh/legacy selection overlap: `backend/config/mvp-story-matrix.ts:275` and
  `backend/providers/story-product-resolver.ts:178`; accepted lineages already fail closed before
  fallback at `backend/providers/story-product-resolver.ts:223`.
- Repeated server selection: `app/api/orders/route.ts:167` and `:215`, plus
  `lib/web/mvp-matrix-response.ts:77`.
- Wizard fail-open presentation and legacy input:
  `public/JS/wizard.js:496`, `:517`, `:925`, `:1159`, and `:2755`.
- Package/legacy generation overlap: `lib/generation-pipeline/text-finalization.ts:70` and `:144`,
  `lib/generation-pipeline/ensure-frozen-visual-contract.ts:100` and `:152`, and
  `lib/generation-pipeline/package-delivery.ts:266` and `:287`. The existing durable discriminator
  is `lib/generation-pipeline/order-visual-package-authority.ts:77`.

## Review constraints

- No weakening of validation, provenance, replay or fail-closed behavior.
- Prefer one canonical owner plus derived views over duplicated authored truth.
- Do not invalidate historical artifacts merely to simplify fresh authoring.
- Tier future work: local/content → focused regression; contract/compiler → affected integration;
  authority/provenance/replay → full hostile QA and independent review.
