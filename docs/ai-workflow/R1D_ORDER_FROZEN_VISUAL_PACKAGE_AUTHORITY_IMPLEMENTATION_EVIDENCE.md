# R1D Order-Frozen Visual Package Authority — Implementation Evidence

**Date:** 2026-08-27
**Implementation owner:** Claude Code (explicit temporary transfer from Codex by Guy)
**Branch / worktree:** `codex/r1d-order-package-authority-binding` / `C:\GNart\Work\sh-order-package-authority`
**Base:** `983a09ee835be92ddeaf1134a56a5d122b61a328`
**Immutable code range:** `983a09ee..608aeee0` — `f982f9f8` (authority binding), `c38a18ac` (prompt v20), `59efadb5` (prompt v21), `0e49b8f6` (first-handoff docs), `3cfbae8f` (Codex round-1 correction: transitions v22/v14, `..`-aliases, fresh-row gate, debug route), `fc8b08a0` (Codex round-2 correction: producing-snapshot delivery binding), `5e79c45f` (round-2 docs), `157fe750` (Codex round-3 correction: total producing-provenance invariant), `53c62285` (round-3 docs), `ce35ee42` (Codex round-4 correction: executable-SQL cache truth, barrier-owned inventory, repository-wide census, ON caller leg, anchor-release TOCTOU, debug-route producing provenance, send_ambiguous named exception), `f1dafa1b` (round-4 docs), `296fe47c` (Codex round-5 correction: one total snapshot invariant — exact caller/fresh/producing identity, fresh-derived anchor disposition, hold-write discipline, debug persistence re-proof, send_ambiguous identity binding, field-level census, production ON receipt branch), `2e3a511e` (round-5 docs), `677c6644` (Codex round-6 correction: legacy ship CAS=0 bounded fresh re-evaluation, retryable exhaustion abort, ON CAS=0 classification pinned), `d1b320e1` (round-6 docs), `608aeee0` (Codex round-7 correction: CAS=0 re-evaluation classifies durable non-anchor dispositions — terminal markers, the payment fence, active strong QA cases). This document is finalized in the docs-only commit immediately following `608aeee0` on the same branch.
**Decision Gate:** `docs/ai-workflow/R1D_ORDER_FROZEN_VISUAL_PACKAGE_AUTHORITY_DECISION_GATE.md` (gitignored, SHA-256 `341f3912…`)
**External cost:** $1.06 conservative ($0.94 nominal), 4 provider calls, 0 transport retries, 0 fallbacks, 0 images, 0 renders

## Commit inventory

1. `f982f9f8` — `feat(orders): bind Orders to frozen Visual Package authority, fail closed everywhere` (46 files, +2452/−189; includes the new migration `backend/migrations/20260827_order_visual_package_authority/`).
2. `c38a18ac` — `fix(visual-contract): give catalog-inexpressible beats a legal classification` (vc-template-prompt v19→v20).
3. `59efadb5` — `fix(visual-contract): state the transition arrival scheme the validator enforces` (v20→v21).

## Architecture chosen

One central durable discriminator, `lib/generation-pipeline/order-visual-package-authority.ts`:

- `orderRequiresVisualPackageAuthority(order)` — package-backed iff the Order's
  frozen `selectionFilename` parses byte-canonically as an accepted revision;
  any spelling that merely *claims* the accepted namespace under hostile
  normalization (trim, `\`→`/`, duplicate separators, `.` segments,
  case-folding) throws instead of degrading to legacy.
- `requireOrderVisualPackageAuthority(order)` — returns the validated
  `FrozenVisualPackageAuthority` for a package-backed Order (envelope shape,
  canonical `packagePath`/`sourcePath`, `packagePath` must name its own
  `packageRevisionDigest`, story/source-digest/style equality against frozen
  Order truth), `null` for a genuine legacy Order, and throws on an origin mix
  (legacy path carrying authority).

Consumers (all flags/`VERCEL_ENV`-independent for package-backed Orders):
`app/api/orders/route.ts` (creation + both idempotent-replay paths, style
sellability moved before resolution), `backend/providers/story-product-resolver.ts`
(style-aware selection returning `frozenAuthority`), `text-finalization.ts`,
`ensure-frozen-visual-contract.ts` (freeze from Order authority, cache/produced
digest equality, no locator reread), `render-qualification-preflight.ts`
(`style01-runtime-authority/v7` + `orderVisualPackageAuthorityRequired`),
`runtime-visual-authority.ts` + `backend/providers/image.ts`
(`runtimeVisualAuthorityRequired` provider fence, cover + pages),
`set-identity-board-stage.ts` (mandatory activation + fail-closed assert),
`chunk-runner.ts` (fresh + resume + `requireRenderableFrozenContract(order,…)`),
`single-page-image-regen.ts`, `readiness-manifest.ts`
(`orderVisualPackageAuthorityDecision` hard-hold before asset inspection,
authority digest + `illustrationStyle` in the TOCTOU fingerprint,
`contract_world_hold:visual_package_authority_invalid`).

Delivery bypasses found by adversarial audit and closed:

- readiness-OFF legacy ship path (`package-delivery.ts`) — authority pre-gate
  parks `authority_hold` before the ship CAS/email;
- break-glass anchor release (`app/api/admin/anchor-hold-release/route.ts`) —
  flag-independent 409 guard;
- delivery reissue (`exception-case.ts`) and invalid-payload repair
  (`delivery-outbox.ts`) — re-prove authority before re-arming a send;
- `app/api/debug/replicate-image` — refuses package-backed Orders outright.

Provider egress hardening: final composed Style01 prompt re-asserted after
role-map/copy-instruction/operator-note concatenation (`image.ts`), Set
Identity Board prompt asserted (`boardPrompt.ts`), provider spatial projection
v2 tag pinned by test.

## Rejected alternatives

- Enabling rollout flags in Production (configuration is not per-order product
  authority; Decision Gate already rejected it).
- Path normalization at the trust boundary (an alias that "means" the
  canonical path would bypass byte-equality comparisons; aliases fail closed
  instead).
- Bumping the authoring request/receipt/readiness version trio for the prompt
  changes (the prompt identity is already digest-bound inside the request;
  stale v19/v20-era chains are rejected by byte-replay without version churn).
- The deferred historical-loader commit `8fcd122b` was not merged: it exists
  solely for the Candidate-overlay salvage lane, which this closure does not
  use.

## Migration

`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "visualPackageAuthority" JSONB;`
applied to **small-heroes-staging** (`qvksgpzzosotubcbizay`, us-east-1) via the
Supabase management API after verifying it was the exact QA target (latest
applied migration `20260725_page_upload_candidate`; only this migration
pending), and recorded in `_prisma_migrations`
(checksum `1121abdbc47ec30788c83f1924a502b91a445b69b34139a19f9e694f63f6209b`
= sha256 of `migration.sql`, name
`20260827_order_visual_package_authority`). Verified:
`information_schema.columns` shows `visualPackageAuthority jsonb`.
**small-heroes-prod was not touched.**

## Validation

- `npx --no-install tsc --noEmit` — exit 0 (re-run after every commit).
- `DATABASE_URL/DIRECT_URL`-stubbed `prisma validate` — schema valid.
- `git diff --check` — clean.
- Focused suites (all PASS): order-visual-package-authority (26),
  order-visual-package-authority-route (6), story-path, visual-package-v4 (11,
  incl. new loader-alias rejections), readiness-manifest (51, incl. the
  8-case hard-hold family under `QA_SOFT_DELIVER=true`), package-delivery,
  qa-soft-deliver, exception-case, delivery-outbox,
  anchor-hold-release-isolation (28), board-stage-lifecycle, board-prompt (22,
  incl. the marker egress case), render-qualification-preflight,
  runtime-world-authority (32), ensure-frozen-visual-contract (13),
  accepted-revision-text-finalization, wizard-runtime-qualification,
  delivery-input-writer-coverage, visual-contract-stage3,
  visual-contract-prompt-table-compaction (11),
  source-authority-lifecycle + live-request-materialization +
  visual-contract-authoring-lifecycle (154 across the prompt-version suites),
  book-ready-email-reachability, accepted-revision-story-loader,
  vitest-workload-classifier.
- Literal `npm run check` after `f982f9f8`: both TypeScript phases pass;
  ordinary partition 317 files — 3,893 pass / 70 skip / 9 fail, all nine in
  the five established fixture-reading specs (absent gitignored `outputs/`
  fixtures); resource partition 20 files — 623 pass / 4 fail, and all four
  re-pass in a focused run (48/48), i.e. the established subprocess/Git
  load-timeout class, plus the known `onTaskUpdate` RPC timeouts. The literal
  command remains honestly exit 1 and is not called a clean PASS.

## Lantern authoring attempts (the paid boundary) and stop-rule closure

Preconditions per attempt: branch pushed at exact HEAD, clean tree,
`canonical-pre-live-readiness` `prepare` → `ready_for_spend_gate`
(evidence v49) and supervisor `verify` → `ready`, zero reason codes.
Credential source `C:\GNart\Work\Small_Heroes\.env.local`
(path digest `00a49570…`); no credential printed or copied.

| Attempt | Run root (`outputs/…`) | Calls | Cost (conservative) | Terminal |
|---|---|---|---|---|
| 1 | `r1d-lantern-fresh-readiness-20260826T234631Z` | 1 | $0.412748 | `action_semantic_capability_gap` (3 beats: `beat:p3:satchel_tightened`, `beat:p4:key_turns`, `beat:p8:closes_eyes`) |
| 2 | `r1d-lantern-fresh-readiness-20260827T000426Z` | 3 (initial + 2 repairs) | $0.646333 | `draft_validation_repair_stagnated` (6 × `page_transition_*` on pages 2,3,4,6,7,8) |

Causal map (each trap is a prompt-vs-validator contract gap, general to every
future story, fixed at root):

1. **v19 classification trap.** The compiler terminally requires a same-page
   presentation classification for a closed-catalog gap
   (`compileBookVisualContractTemplate.ts` — "closed action catalog gap
   requires a same-page presentation requirement classification") while
   prompt v19 forbade `presentation_requirement` for every entity-acting
   beat. An honest draft had no legal disposition → deterministic terminal.
   Fixed in v20 (`c38a18ac`). Verified by attempt 2: zero `unsupported`
   records. Exact classifications (correcting the first handoff's claim):
   p3 tail-tightens-satchel → `presentation_requirement`/`static_state`
   (`beat:p3:satchel_strap_state`), p4 distant key →
   `presentation_requirement`/`ambient_event` (`beat:p4:distant_lock`), and
   **p8 eye-closing → `non_visual`/`temporal_context`
   (`beat:p8:eyes_close_sequence`)** — a reviewer-visible non-visual
   classification (each `non_visual` record is enumerated per-beat in the
   reconciliation content review), not a presentation binding; whether the
   closing-eyes moment must appear visually is a reconciliation-review
   decision for Guy.
2. **v20 transition-scheme ambiguity.** `analyzeTransitionSequence` enforces
   arrival-carried transitions (a page in a new zone must itself carry
   `after_transition`/`threshold`; `before_transition`/`steady` pages must
   stay in the previous page's zone), which the prompt never stated. The
   model's symmetric departure scheme was self-consistent under the prompt
   text; two `book_surface_patch` repairs re-asserted payload-identical
   transitions and the stagnation fence correctly stopped spend. Partially
   fixed in v21 (`59efadb5`); the COMPLETE transition correction is v22 plus
   `book-surface-repair-prompt/v14` (the Codex-QA correction milestone below),
   which added the page-1 and threshold-origin rules and put the identical
   contract on the repair route itself.

Durable per-attempt artifact digests (content-addressed filenames under each
run root; the gitignored bytes remain on the implementation machine and their
identities are recorded here):

| Artifact | Attempt 1 (`…20260826T234631Z`) | Attempt 2 (`…20260827T000426Z`) |
|---|---|---|
| source snapshot | `35fe04ab5601031735bd7bdd283bab7a8d897bc399427d592e39fe56aa1f6a6c` | same (identical source bytes) |
| authoring request (v54) | `fb94e9479f3e01b4bd4c7e6ac157b42db578d6f988c508af390265aba7e5f097` | `c430dfdd7269bcbeb6dca348461236c924c9d0e479ff55d98d9689b9a7fe4ddf` |
| authoring receipt (v57) | `37939e232b18112c517cd580035f5f308b0c98f97e8b5fd87742bee205368636` | `4a8fce8dd139b32f7dc24957ddd8e58bc7fde858d3a637d0863a24b87367dd7d` |
| b0 readiness evidence (v54) | `61cd315b1077d7a760984ed6a5712b30d1c419aefa4583d89a2e2491d8d721a7` | `12675491ba2a4fc5a9f4281f6b03118c258cc09c2f59638020a2a74581ff5a06` |
| structured-draft replay evidence | `703482561958773d4285a43493f6607168ca58a5160570fabd2c81c07a0d8e8e` | `e4c1c74848610d046cec7f1872d385c4fcaba66b80e195a572b66744deda754b` |
| live-request materialization | `ca253d7c735a6116cfdd36ebe8c6f9f357fa965ae588e733f12112a29f7cbfac` | `959092242e8ba1eef53e04527187acffa44edcec6369ea95fe978985da31323b` |
| source-authority request | `c2a8f1dacaa3fd970471afda56a4ea1906f768e50b8c866ee46e8d7c3a11cb9f` | same |
| pre-live readiness evidence (v49) | `251677b62467fb009dc521d917247228ef53c356eff55dfa190a8d1783cee1b8` | `bf0d46fe7f82f0d883b68b85fe9309a894138fab723e1f23e491807053312974` |
| canonical execution request (v49) | `aa1e5c85a86d23e965ee498f45fc828aa913bdd4696c859f9679ec708aef70dc` | `67ee1e807a257f1f92e37926c3a0c559cdde636b447be6f48285efe2200202b4` |

The exact attempt-2 captured structured payloads are additionally TRACKED as test fixtures
under `lib/visual-contract-compiler/__tests__/fixtures/lantern-transition-frontier/`
(initial draft + the payload-identical stagnating repair both paid repair
calls returned + the arrival-scheme corrective repair). These are the exact
captured STRUCTURED payloads: parsed values and canonical payload digests
match the run's replay evidence; raw provider file bytes do not survive
re-serialization and are not claimed.

Offline proof of the remaining distance:

- **Tracked repair-route convergence proof** (supersedes the first handoff's
  `transition-scheme-proof.ts`, which pre-edited the draft and therefore
  proved only compiler acceptance):
  `lib/visual-contract-compiler/__tests__/lantern-transition-frontier.spec.ts`
  drives the EXACT captured attempt-2 structured payloads through the REAL offline repair
  route. Queuing the captured stagnating repair twice reproduces the paid
  terminal exactly (`draft_validation_repair_stagnated`, complete census
  6→6→6, every issue a `page_transition_*` on pages 2,3,4,6,7,8); queuing the
  corrective repair — identical to the captured one except the six flagged
  transitions rewritten to the arrival scheme — converges through
  `book_surface_patch` to `outcome: candidate` with 0 surfaced / 0 complete
  issues and 0 provider calls. The spec also pins the rebuilt source snapshot
  to the captured content address (`35fe04ab…`), asserts both prompt routes
  now state the identical arrival contract, and carries validator
  counterexamples for the page-1 (opening threshold/after_transition
  rejected) and threshold-origin (must depart from the previous page's
  established zone) semantics plus a fully-clean arrival-chain positive
  including threshold continuation.
- 4-defect-class scan (`attempt2-draft-pseudo-candidate.json` against the
  calibrated scanner that FAILs the legacy `be2d3202…` candidate on 3 of 4
  classes): attempt-2 draft PASSES all four — 0 cover no-spoiler
  contradictions, distinct spatial targets, kindergarten guard present in
  `humanCast` (garment origin bound to `שומרת הגן`, p7), 0 false eye-beat
  closures.

## Codex independent-QA correction milestone (post-`0e49b8f6`)

Codex's first-round review returned HOLD with one BLOCKER, two MAJOR and three
MINOR findings; all are closed in the correction commit:

- **BLOCKER (transition correction incomplete):** the arrival contract now
  exists in BOTH prompt routes — `vc-template-prompt/v22` adds the page-1
  restriction and the threshold departs-from-previous-zone rule to the
  initial prompt, and `book-surface-repair-prompt/v14` states the full
  arrival contract (including threshold continuation and "never re-assert the
  current transitions unchanged") on the exact repair route that stagnated.
  The captured six-issue frontier is exercised end-to-end through the real
  repair route to 0 in the tracked spec above; page-1 and threshold-origin
  counterexamples are pinned; the input-ceiling pins were re-measured for v22
  (net +1 unit after offsetting compressions; min headroom stays above the
  1,024 floor) and the BookSurface admission accounting pins for v14
  (systemBytes 3,523→4,216; both page counts remain ≥4,096 under the 59,904
  admission ceiling).
- **MAJOR 1 (`x/../…` alias):** the hostile namespace detector now lexically
  resolves parent segments (leading, nested, interior, escaping) and also
  claims on a segment-boundary containment of the accepted prefix, so
  `x/../story-pipeline/…`, `story-pipeline/x/../04_…`, `../story-pipeline/…`
  and `a/b/story-pipeline/…` all fail closed across the discriminator, full
  authority validation, text finalization and the preflight cache guard.
  Covered by new detector unit tests (13 claiming / 7 non-claiming
  spellings), six new discriminator+validator alias cases, and three new
  text-finalization cases proving the legacy selector stays unreachable.
- **MAJOR 2 (stale-args delivery TOCTOU):** the readiness-OFF authority gate
  now validates the FRESH row loaded in the same read that binds the ship
  CAS (`inputVersion`/`deliveryFenceVersion` + the four authority fields),
  never the caller's `args.order` snapshot; a post-read mutation is excluded
  by the CAS's inputVersion binding (all authority-field writers cross the
  delivery-input barrier). New tests: stale-VALID args + fresh-null and
  fresh-mismatched rows → `authority_hold`, zero ship, zero email; fresh
  origin-mix row → hold; stale-INVALID args + fresh legacy-clean row →
  ships (the fresh row is the sole authority).
- **MINOR (debug route):** `POST /api/debug/replicate-image` now runs the
  FULL `requireOrderVisualPackageAuthority` validation — package-backed,
  malformed/aliased, and legacy-carrying-authority (origin mix) orders are
  all refused with 409.
- **MINOR (evidence corrections):** the p8 classification claim and the
  review-range wording are corrected above; the paid receipt/readiness/
  request digests are recorded durably in the table above.

## Codex re-gate round 2 — delivery producing-snapshot binding (`fc8b08a0`)

Codex's re-gate (0 BLOCKER / 1 MAJOR / 2 doc MINORs; transitions, aliases and
the debug route PASS) reproduced offline that a fresh Order row internally
self-consistent under Package B authorized shipping a payload produced under
Package A: the round-1 fresh-row gate proved consistency, not provenance.

`fc8b08a0` adds `requireProducingSnapshotBinding` as the one shared delivery
predicate: a package-backed Order's fresh authority must BE the producing
snapshot's authority — the freeze-written `pipelineCache.visualPackageAuthority`
must canonical-digest-equal the fresh Order authority, the Order's
`visualContractHash` stamp must equal the canonical hash of the producing
cache contract, and the contract-embedded
`approvedRuntimeAuthority.packageRevisionDigest` must equal the fresh
authority's revision. Genuine legacy Orders keep exact prior behavior.

Readiness-OFF evaluates the binding on the same fresh CAS-bound read (now
including the stamp, the producing cache and the Book payload rows) and
additionally parks when the caller-supplied readUrl/cover/pdf/audio payload
diverges from the fresh Book snapshot
(`contract_world_hold:delivery_snapshot_binding_invalid`). Readiness-ON runs
the identical binding before asset inspection, folds the producing cache
authority digest and contract digest into the TOCTOU fingerprint, and records
the producing authority digest in the blocked evidence/inputsHash; the
in-transaction Outbox payload was already built from the freshly loaded Book,
and the quality gate's contract-hash binding is now exercised by the
package-bound fixture. Writer coverage tracks `visualContractHash` (its one
post-creation writer is the freeze's barrier mutation, made lexically visible
to the scan) and `illustrationStyle` (no post-creation writer today; any
future one must cross the barrier).

Adversarial regressions on BOTH branches: the exact A→B reproduction (fresh
self-consistent B + producing A → hold, zero ship CAS success, zero email),
missing producing snapshot after a clean fresh row, stamp↔bytes mismatch,
contract-revision mismatch, payload/readUrl divergence, and the fully-bound
package-backed OFF-path ship that proves no false park. Battery: 446 tests
across 18 suites, `tsc --noEmit` exit 0, `git diff --check` clean; the
transition/frontier and alias suites all re-ran green, and the debug route
gained a real route-boundary regression spec
(`lib/__tests__/replicate-image-route-boundary.spec.ts`) in the round-3
correction.

## Codex re-gate round 3 — total producing-provenance invariant (`157fe750`)

Codex's round-3 review (0 BLOCKER / 3 MAJOR) named the remaining root cause:
producing provenance was not yet a TOTAL, atomic invariant shared by every
post-render delivery consumer. `157fe750` closes all three MAJORs:

1. **A→legacy laundering.** `requireProducingSnapshotBinding` no longer
   early-returns for a fresh-legacy row: "legacy" is valid only when every
   producing side is genuinely legacy. A producing cache carrying Visual
   Package authority, a producing contract embedding a package revision, a
   stamp without a producing contract (or vice versa), and a stamp↔bytes
   mismatch all fail closed; a legacy freeze whose stamped legacy contract
   matches the producing bytes still ships (pinned positive control). The
   readiness-OFF path additionally holds when the CALLER'S snapshot is
   package-shaped while the fresh row and producing snapshot read legacy.
2. **Structural writer-fencing of the producing cache.**
   `lib/generation-pipeline/pipeline-cache-store.ts` is now the only ordinary
   cache writer: replacement semantics for ordinary keys, while the SQL
   overlays the DATABASE row's own `visualContract`/`visualPackageAuthority`
   onto every write, so an in-memory value for the producing keys cannot
   reach disk outside the freeze's barrier mutation (whose writes bump
   `inputVersion`, bound by every ship/send CAS). `saveCache`, job
   re-seeding and the dev anchor-approval route use it; creation seeds are
   stripped; `updateStage` type-excludes `pipelineCache`. The writer census
   now covers `GenerationJob.pipelineCache` (window rule for spread
   payloads, creation-seed exemption, pinned classifier cases) with zero
   unprotected writers, and the eval→commit producing-cache drift is a
   pinned TOCTOU abort-and-retry.
3. **Total adoption.** Anchor-hold-release (flag-independent, plus a
   canonical-readUrl requirement for package-backed direct sends), delivery
   reissue and invalid-payload repair all run the same
   `requireProducingSnapshotBinding` over the producing cache loaded in
   their own fresh selects. Consumer census: package-delivery OFF/ON,
   readiness commit, safety-release (via the commit), anchor release,
   reissue, repair — one shared evaluator; the send-time CAS remains
   transitively bound (manifest + inputVersion + fence + the structural
   cache immutability above).

Origin matrix pinned on both readiness branches: A/A/A eligible; A→B hold;
A→legacy hold; legacy-produced→fresh-A hold; genuine legacy/legacy ships;
missing/ambiguous cache-or-stamp hold; package-shaped caller over a legacy
fresh row hold — every hold with zero ship CAS success and zero email.
Round-3 battery: 468 tests across 21 suites, `tsc --noEmit` exit 0,
`git diff --check` clean, zero provider/live/render operations.

## Codex re-gate round 4 — executable-SQL truth + boundary closure (`ce35ee42`)

Codex's round-4 review (0 BLOCKER / 6 MAJOR / 1 MINOR) falsified the round-3
claims at the integration and transaction boundaries. `ce35ee42` closes all
of it; the round-3 evaluator core (`requireProducingSnapshotBinding`) is
byte-preserved.

1. **Ordinary persistence mutated frozen JSON (MAJOR 1).** The round-3 store
   wrapped the DB-owned overlay in `jsonb_strip_nulls`, which PostgreSQL
   applies RECURSIVELY: the real approved `a9c253d9…` contract template
   (8 nested nulls in `transition`/`sameLocationAs` fields) had its canonical
   digest rewritten `51901523…` → `6c28adf8…` on every ordinary cache write —
   and the round-3 spec inspected SQL text, positively expecting the
   destructive function, without ever executing SQL semantics. The store now
   overlays key-existence-gated (`?`) CASE arms copying each present key
   VERBATIM (nested nulls, null array entries, explicit top-level JSON null);
   an absent key can never be created. The proof EXECUTES on real PostgreSQL
   (PGlite, offline, part of the ordinary battery,
   `lib/generation-pipeline/__tests__/pipeline-cache-store.pg.spec.ts`): the
   store's own tagged-template statement, the REAL freeze write via
   `ensureFrozenVisualContract`'s barrier callback, and the Board statement
   extracted verbatim from module source — with both digests of the real
   approved artifact pinned as constants.
2. **`setIdentityBoards` joins the protection set (MAJOR 2).** The
   barrier-owned inventory is now DERIVED: the census extracts every
   `jsonb_set` path key targeting `pipelineCache` from the barrier writers
   and pins set-equality with `BARRIER_OWNED_PIPELINE_CACHE_KEYS`
   (`visualContract`, `visualPackageAuthority`, `setIdentityBoards`) — a new
   barrier-owned key cannot appear without joining the store's protection.
   Creation seeds strip the full set (`withoutBarrierOwnedPipelineCacheKeys`;
   the census's seed exemption now requires that helper at the call site
   rather than trusting a file path). Freeze-vs-ordinary and
   Board-vs-ordinary run in BOTH commit orders on real SQL: the barrier value
   wins deterministically, which is also why a receipt REPLAY (which skips
   the already-applied barrier mutation) can never meet a cache an ordinary
   write hollowed out.
3. **Repository-wide writer census (MAJOR 3).** The census now scans
   `app`/`lib`/`backend`/`scripts` across `.ts/.tsx/.js/.mjs/.cjs`, raw
   `GenerationJob` SQL (exhaustive allowlist: the freeze writer, the Board
   writer, the structural store), and migration SQL (no `pipelineCache`
   rewrite anywhere). The ~15 direct script cache-writers found by Codex are
   explicitly RETIRED — moved to `scripts/retired/` (exact file list pinned;
   its README states why and what reviving one requires); the remaining
   active operational scripts are sanctioned per-file AND per-exact-write-
   signature (`ACTIVE_SCRIPT_WRITER_ALLOWLIST`), with `pipelineCache` writes
   prohibited outside stripped creation seeds. Zero unprotected writers is
   now empirically true repository-wide. **Honest bounded scope:** active
   scripts are operator-run fixture harnesses executed against dev/staging
   data outside the runtime barrier; that boundary is the allowlist itself —
   a new writer script or a new write shape inside one fails the census.
4. **Readiness-ON caller-origin leg (MAJOR 4).** Round 3's caller leg ran
   only on the OFF branch — `finalizePackageDelivery` returned through the
   readiness commit before reaching it, and `CommitArgs` carried no caller
   shape, so a package-shaped caller over a genuinely legacy fresh row
   shipped through ON (Codex's probe: manifest passed, enqueued, one Outbox
   create, one ship CAS). `CommitArgs.callerVisualPackageClaim` now threads
   the claim (computed once in `finalizePackageDelivery`, and independently
   by the anchor-release route); the commit's authority decision blocks a
   legacy fresh row + producing snapshot under a package claim BEFORE
   inspection, with the same
   `contract_world_hold:delivery_snapshot_binding_invalid` marker as the OFF
   leg. The COMPLETE origin matrix now runs through the REAL ON and OFF
   implementations (`lib/__tests__/package-delivery-origin-matrix.spec.ts`
   drives the real `commitBaseBookReadiness` — no blocked-result mock):
   A/A/A eligible; B-self-consistent/A, A→legacy, legacy→A(missing),
   ambiguous-stamp, package-caller-over-legacy all hold with zero enqueue,
   zero ready-ship CAS, zero email; genuine legacy stays eligible.
5. **Anchor-release eval→release TOCTOU (MAJOR 5).** The flag-OFF release
   had checked provenance on the pre-transaction read, locked only
   status/reason, released through a CAS that bound neither `inputVersion`
   nor authority, and emailed the stale pre-lock payload. The release
   transaction now re-proves the producing binding and the package
   canonical-readUrl rule from ONE fresh snapshot read UNDER the FOR UPDATE
   lock; `executeAnchorReleaseCas` additionally binds that snapshot's exact
   `inputVersion` + `deliveryFenceVersion`; and the sent email payload is
   captured from the same in-tx snapshot. An injected delivery-input
   mutation between the initial evaluation and the release yields 409, zero
   release CAS, zero email (pinned in
   `anchor-hold-release-isolation.spec.ts`, plus real-SQL staleness rows in
   the PG harness). The valid ON path and genuine anchor release are
   preserved (positive controls re-pinned).
6. **Debug image route (MAJOR 6).** The route had loaded no GenerationJob
   and checked only the Order shape, so a legacy-looking Order with a
   package-shaped producing cache reached `generateImage` in Preview/dev. It
   now loads the producing cache and runs `requireProducingSnapshotBinding`:
   exact-package (fully bound), aliased reference, origin-mix, A→legacy,
   A→B, missing snapshot and ambiguous stamp all refuse 409 with ZERO
   provider calls and ZERO writes (the persistence barrier sentinel is
   asserted untouched even when persistence is requested); genuine legacy —
   including a stamped legacy freeze whose bytes match — still proceeds.
7. **`send_ambiguous` reconciliation — a NAMED EXCEPTION (MINOR 7).** Ruling:
   the ambiguous-send replay is a sanctioned CONTINUATION of an
   already-authorized provider attempt, not a new send, and therefore does
   not re-run the fresh producing-snapshot gate. Its bounds, each enforced
   and pinned: the Outbox row exists only because a delivery gate passed at
   enqueue; the replay carries the EXACT captured payload
   (`hashPayload(payload) === payloadHash` — a drifted payload refunds with
   zero replay, new test) under the EXACT `dedupeKey` as the provider
   idempotency key; only within the provider's idempotency window (expiry
   refunds, never resends); and its sole purpose is recovering the provider
   message id for state reconciliation. Every OTHER post-render surface runs
   the fresh gate — "every send surface" claims elsewhere in this document
   are qualified by exactly this one named exception.

Round-4 battery: 37 suites, 630 tests passed (22 environment-gated real-PG
staging skips), `tsc --noEmit` exit 0, `git diff --check` clean, zero
provider/live/render operations. New devDependency: `@electric-sql/pglite`
(offline real-Postgres engine; no network at test time).

## Codex re-gate round 5 — one total snapshot invariant (`296fe47c`)

Codex's round-5 review (7 MAJOR / 1 MINOR) demanded a single restored
invariant, not per-assertion patches. `296fe47c` rebuilds delivery around
two primitives; the round-4 JSONB/cache correction is byte-preserved.

**The invariant.** `requireConsistentProducingIdentity` (one evaluator,
`order-visual-package-authority.ts`) proves the fresh row ↔ producing
snapshot binding AND binds the CALLER'S exact delivery identity — its
package revision digest, or `null` for a genuinely legacy snapshot — to the
fresh producing identity by STRICT equality: A≠B, package→legacy and
legacy→package (both directions) all fail closed as
`DeliverySnapshotIdentityError` →
`contract_world_hold:delivery_snapshot_binding_invalid`; an INVALID caller
snapshot can never be granted an identity and always parks. The
delivery/anchor DISPOSITION is DERIVED from the authoritative fresh
producing snapshot (`pipelineCache.childAnchorLowConfidence`, fail-closed
on malformed shape) — `finalizePackageDelivery` and `CommitArgs` no longer
accept any caller-supplied gate; `requireHold` is the one sanctioned human
override (it releases exactly the fresh-derived marker); the disposition
source joins the TOCTOU fingerprint; and the ship CAS binds the observed
`childAnchorLowConfidence` value (`producingAnchorBind`), so a post-read
band flip — which bumps no `inputVersion` — matches zero rows (executed on
real PostgreSQL via the PGlite adapter, which splices composed `Prisma.sql`
fragments exactly as Prisma's serializer does).

Finding-by-finding: (1) the hostile cell — caller Package A / fresh Order B
/ producing B / fresh `hard_band` while the stale caller believed allow —
holds on BOTH branches with zero Outbox, zero ship CAS, zero email, plus
the identity-consistent A/A/A + `hard_band` variant that isolates the
anchor leg; (2) the anchor-release route re-proves the pre-lock identity
UNDER the release lock — the downgrade direction (pre-read fully-bound
package → in-lock genuinely legacy) now refuses alongside the upgrade
direction; (3) every terminal park is result-checked:
`input_drift`/`lost` → `AuthorityHoldRaceError` aborts the park transaction
(the job is NEVER marked done/packaged; the chunk runner's standard
failed+retryable+case path owns the redrive), `superseded` completes the
stage under the stronger marker without touching its owner's case
lifecycle, and only `applied` resolves recovery cases; (4) debug-route
persistence re-proves the same identity from a fresh in-tx read inside the
barrier before any write — a legacy→package flip during the provider call
aborts with zero ImageAsset/Page mutations; (5) the `send_ambiguous`
named-exception replay additionally binds source identity and the CANONICAL
idempotency key before ANY disposition (a valid `payloadHash` under a
drifted or cross-source `dedupeKey` refunds with zero replay, and a
cross-source `sent` row can no longer resolve the wrong case as delivered —
the strict check also exposed and fixed a non-canonical spec fixture key);
(6) the census now tracks every real generation input (`childImageUrl`,
`characterAnchors`, `childGender`, `childAge`, `coverImageUrl`): the regen
flow's family-coherence anchor write moved INSIDE the barrier, the
generation-stage anchor/cover writes and the child-photo privacy scrub
(runtime + `scripts/audit-child-photos.ts`, resolving it) are sanctioned by
EXACT model+method+field-set pins with helper-reference requirements, the
script allowlist is field-level per site, raw SQL is SHAPE-pinned
(statement counts + exact allowed SET columns / the exact four
GenerationJob statements), and all 13 retired scripts carry a mechanical
top-level retirement guard pinned by the census; (7) the origin matrix runs
through the REAL production ON branch — `READINESS_MANIFEST_ENABLED=true`,
real `commitBaseBookReadiness` through `runAtomicOperation`'s receipt fence
with the recorded-result update asserted — 10 cells on both branches with
positive and negative controls.

The API change is deliberate: `finalizePackageDelivery` lost
`deliveryGate`/`anchorLowConfidence`, `CommitArgs` lost
`anchorAllowsDelivery`/`anchorOrderStatus`/`anchorReason`/
`anchorLowConfidence` and carries `callerPackageRevisionDigest` instead of
the round-4 boolean claim; the safety-release route consequently no longer
force-allows the anchor leg, and the operator anchor-release/recommit paths
pass no disposition at all.

Round-5 battery: 41 suites, 740 tests passed (22 environment-gated real-PG
staging skips), `tsc --noEmit` exit 0, `git diff --check` clean, zero
provider/live/render operations.

## Codex re-gate round 6 — legacy ship CAS=0 re-evaluation (`677c6644`)

Codex's round-6 review found one broken boundary in the round-5 build: the
readiness-OFF caller mishandled a ship CAS that matched 0 rows (correctly
prevented by `producingAnchorBind`) — it logged, unconditionally marked the
GenerationJob done/packaged, and returned `deliveryHeld: true` while the
Order could remain `generating` with `deliveryHoldReason = null`. No-send
safety held, but the order wedged, violating the durable-disposition
invariant.

`677c6644` makes the OFF branch's read→prove→derive→ship/park sequence a
BOUNDED FRESH RE-EVALUATION LOOP (3 attempts): CAS=0 triggers a fresh
re-read + re-proof + re-derivation, so Codex's hostile cell — clear anchor,
`hard_band` flip between the disposition read and the ship CAS without an
`inputVersion` change — converges to the CORRECT durable
`anchor_low_confidence:hard_band` park (zero email, zero ready transition).
Budget exhaustion (or a vanished order) throws
`AuthorityHoldRaceError` — an explicit retryable abort owned by the chunk
runner's standard failed+retryable+case recovery path. The job is marked
done/packaged ONLY after a durable outcome (ship, or applied/superseded
park) exists; `deliveryHeld` is only reported with that durable state; the
soft-deliver warnings are captured from the exact iteration that shipped.

The readiness-ON CAS=0 classification was examined and pinned: a band flip
between eval and the in-tx reload drifts the TOCTOU fingerprint
(`childAnchorLowConfidence` is a bound sub-value) and the SAME call
re-evaluates to the correct durable anchor hold; a flip inside the
in-tx-reload→CAS window raises `DeliveryFenceError`, which rolls the WHOLE
readiness transaction back — the job-done write (sequenced after the CAS)
is never reached, the package stage stays un-concluded, and the worker's
next chunk re-enters it fresh. Recoverable re-entry on both windows.

End-to-end `finalizePackageDelivery` regressions (not raw-CAS-only): the
hostile flip cell, budget exhaustion (job never done, zero email, all
three fresh reads asserted), the vanished order, and the same-source
positive control shipping exactly once. The verified JSONB/cache, exact
identity, and fresh-disposition behavior are untouched.

Round-6 battery: 41 suites, 745 tests passed (22 environment-gated real-PG
staging skips), `tsc --noEmit` exit 0, `git diff --check` clean, zero
provider/live/render operations.

## Codex re-gate round 7 — CAS=0 classifies durable dispositions (`608aeee0`)

Codex's round-7 review (1 MAJOR): the round-6 loop spun against a ship
CAS=0 CAUSED by an already-durable non-anchor disposition — the fresh
select omitted `status`/`deliveryHoldReason`/`manualReviewRequired`, so a
terminal marker, the payment fence, or an active strong QA case produced
three fruitless re-evaluations and a retryable abort (zero job-done) on an
order the world had already durably decided.

`608aeee0` completes the convergence contract — shipped / recognized
durable disposition / retryable abort ONLY when no durable disposition
exists:

- Each iteration first RECOGNIZES a governing durable disposition from the
  now-selected Order fields: a terminal marker (`isDeliveryTerminalHold`,
  the TS twin of the ship CAS's SQL blocklist) or the payment fence
  concludes the stage held under THAT disposition — zero ship CAS
  attempts, zero marker/fence rewrite, job done once, zero email; the
  disposition's owner keeps its lifecycle.
- A CAS=0 on a clean row classifies the one durable disposition the Order
  row cannot show: an ACTIVE STRONG `HumanQaReviewCase` (the skip_weaker
  shape), via exactly the set the CAS's `NOT EXISTS` rejects — found →
  held under `human_qa_case:<kind>` after exactly one CAS attempt; a weak
  (anchor) case does NOT classify.
- Otherwise round-6 behavior is unchanged: a clear-anchor mutation
  re-evaluates fresh to its correct durable anchor hold, and truly
  unexplained repeated CAS=0 still exhausts into the retryable
  `AuthorityHoldRaceError` with the job never marked done.

`executeReadinessShipCas` is untouched; no blanket CAS=0→held conversion.
Hostile regressions: concurrent safety_hold, concurrent
contract_world_hold, payment fence (each zero-CAS/zero-rewrite
conclusions), the skip_weaker strong-case cell (one CAS, case
classification asserted), the weak-case exhaustion control, and all
round-6 cells unchanged.

Round-7 battery: 41 suites, 750 tests passed (22 environment-gated real-PG
staging skips), `tsc --noEmit` exit 0, `git diff --check` clean, zero
provider/live/render operations.

## Codex re-gate round 8 — HOLD; round 9 corrective (`608aeee0..HEAD`)

Codex's round-8 review (1 MAJOR): the round-7 skip_weaker branch performed
zero Order-authority writes. After the ship CAS returned 0 the code found
a strong case, set `durable=true`, and broke. The Order stayed
`status='generating'`, `deliveryHoldReason=null`, `packageStatus='running'`.
The status API maps only `status='needs_human_qa'` → `under_review`; the
customer was permanently wedged. A bare `findUnique` case read also gave
no atomic proof at commit (close/supersede race window).

**Round-9 corrective (Claude Code temporary implementation owner, 5 files,
`608aeee0..HEAD`): `lib/generation-pipeline/order-authority.ts`,
`lib/generation-pipeline/package-delivery.ts`,
`lib/__tests__/package-delivery.spec.ts`,
`lib/__tests__/generate-status-route.spec.ts`,
`lib/generation-pipeline/__tests__/pipeline-cache-store.pg.spec.ts`.**

`canonicalStrongCaseRestoration` (pure, exported) validates the case's
immutable rawReason against its kind/scope before using it as Order
authority. Valid restoration reconstitutes the canonical marker family
verbatim: `safety_hold:` (rank 3, existing release lifecycle),
`contract_world_hold:` (rank 2), or `manualReviewRequired=true` + coupon
reason (payment fence, scope=payment). Incompatible rawReason → null →
fail-closed `continue` (nothing landed, retryable exhaustion).

`writeOrderHoldFenced` gains `requireOpenCaseId`: the fenced pre-read
probes `EXISTS(... id=<caseId> AND status='open')` (early `'lost'` if
closed) and the hold UPDATE carries the same EXISTS clause atomically.
`package-delivery.ts` calls `writeOrderHoldFenced` with `inputVersion`,
`requireNotDelivered`, and `requireOpenCaseId`. Only `'applied'` concludes
held (Order is `needs_human_qa` + canonical marker; status API →
`under_review`). `'superseded'`/`'input_drift'`/`'lost'` re-evaluate
fresh: case close → next iteration ships; stronger marker → loop-top
round-7 classification; repeated misses → retryable exhaustion.
`executeReadinessShipCas` untouched.

Test cells added: 3-cell canonical-restoration matrix (safety / contract_world
/ payment_integrity — asserts `needs_human_qa` + verbatim canonical marker
+ `packageStatus` in the UPDATE body + `case-id` bind + payment-fence flag);
close-race (nothing lands, ships cleanly on next iteration); supersede-race
(rank 3 > rank 2 → 'superseded' immediately, loop-top recognizes the
terminal safety marker); malformed-evidence (3 ship CAS only, hold funnel
never entered, retryable exhaustion, job never done). Status-route boundary:
persisted `needs_human_qa` + safety marker + packageStatus=done → `under_review`.
Real-PG (PGlite offline): `requireOpenCaseId` EXISTS bind lands the hold
when the case is open and returns `'lost'` with zero writes when closed.

Round-9 battery: 342 suites total (17 env-gated skipped); 4645 passed /
18 failed. All 18 failures are pre-existing baselines in
`lib/visual-package/__tests__/` unrelated to this milestone (baseline
before this change: 4632 passed / 24 failed — this branch improved by +13
pass, −6 fail net). `tsc --noEmit` exit 0, `git diff --check` clean, zero
provider/live/render operations.

**Stop-rule closure:** the milestone brief states "If two consecutive
paid/live attempts fail, stop spending and produce a causal map rather than
patching the latest symptom." Both attempts failed; all paid operations
stopped there. No third authoring attempt, no Blueprint call, no Board mint,
no package assembly/publication, no locator change, no Wizard order, no
payment, no render. The current locator still selects legacy package
`2b488f2d…` bound to `20a12801…`.

## Codex re-gate round 10 — already-delivered convergence (double-email closure)

Codex empirically reproduced (real-function probe) the remaining race in the
readiness-OFF loop: iteration 1 reads a clean `generating` row; the ship CAS
returns 0 because an active strong `HumanQaReviewCase` exists; the case then
closes and a COMPETING worker ships the Order; the round-9 case-derived hold
sees `status='ready'` and returns `superseded` (`requireNotDelivered`); the
next iteration re-reads the ALREADY-`ready` row, and `executeReadinessShipCas`
matched that row again — this invocation shipped a second time and sent a
second direct ready email (probe: 2 ship/hold CAS calls, 1 duplicate send,
`result: legacy, deliveryHeld=false`).

Round-10 corrective (2 layers, preserving the two authorized partial edits):

1. **Shared ship CAS (SQL):** `executeReadinessShipCas` gains
   `AND "status" NOT IN ('ready','partial')` — the exact non-retraction pair
   `writeOrderHoldFenced.requireNotDelivered` already names. A delivered row
   can never be re-shipped by ANY caller of the shared statement, so a lost
   race can never blank a shipped row's `deliveryHoldReason` (e.g. a
   `qa_soft_deliver:` marker) or re-fire the ready transition.
2. **Loop classification (TS):** each fresh iteration now recognizes the
   delivered state as the SECOND durable disposition, immediately after the
   round-7 terminal-marker/payment-fence classification (hold precedence
   byte-preserved: a delivered row that also carries a terminal marker still
   concludes held under that marker's owner). `ready`/`partial` →
   `alreadyDelivered`: the loop concludes BEFORE identity/payload validation
   and disposition derivation — deliberate, because both remedies (ship or
   park) are forbidden against a non-retractable delivered row. The stage
   converges NON-HELD (`deliveryHeld:false` — the book IS delivered; reporting
   held would be the false-held result round 9 forbids), sends ZERO email
   (the competing worker that shipped owns the one direct ready email; a
   distinct suppression log replaces the misleading "held for human QA" line),
   and still performs the coherent idempotent job/package completion
   (`generationJob` done/packaged once; post-commit case sync no-ops).

Without layer 2, layer 1 alone converts the duplicate email into a new wedge:
three CAS=0 iterations against a permanently-`ready` row would exhaust into
`AuthorityHoldRaceError` and redrive forever. Without layer 1, layer 2 alone
leaves every OTHER caller of the shared SQL able to re-ship a delivered row.
Both are required.

Hostile regressions (all six required cells):

1. Reproduced race (case closes + competing worker ships): mock cell drives
   iteration-1 generating + CAS=0 + strong case, funnel pre-read
   `status='ready'` → `superseded`, iteration-2 fresh read `ready` → exactly
   ONE ship CAS total, zero `needs_human_qa` writes, ZERO email,
   `deliveryHeld:false`, job done once.
2. `ready` at loop entry (with a deliberately hostile `hard_band` producing
   snapshot): zero ship CAS, zero park (no retraction attempt), zero email,
   non-held, ≤2 order reads.
3. `partial` at loop entry: identical non-retraction convergence.
4. Ordinary clean `generating` Order: the pre-existing round-6 positive
   control (exactly one ship CAS, exactly one email, job done) passes
   unchanged.
5. Active strong case on a `generating` Order: the round-9 3-cell canonical
   restoration matrix passes unchanged (durable hold still restored).
6. Real-PG proof of the changed shared SQL (PGlite, offline, ordinary
   battery): `ready` rejects (0 rows; status AND the shipped
   `qa_soft_deliver:` marker byte-unchanged), `partial` rejects (0 rows),
   `generating` still ships (1 row → `ready`). The docker-gated
   `delivery-fence.pg.spec.ts` harness gained the same two rejection cells
   (inert locally by design; lock-step with the PGlite proof).

Plus a precedence pin: `ready` + terminal `safety_hold:` marker still
concludes HELD under the marker owner (round-7 classification remains first).

Red proof: with the delivered-state classification disabled
(`if (false && …)` mutant), exactly the three delivered-state cells fail and
the precedence pin stays green; reverted, the battery is green again.

Round-10 battery: focused delivery/order-authority/status/PGlite —
8 files / 188 tests passed (`package-delivery`, `package-delivery-origin-matrix`,
`qa-soft-deliver`, `readiness-manifest`, `order-authority-guard`,
`delivery-input-writer-coverage`, `generate-status-route`,
`pipeline-cache-store.pg`). `npx --no-install tsc --noEmit` exit 0;
`git diff --check` clean; zero provider/live/render/Wizard/payment operations.

Round-10 limitations: the docker-gated `delivery-fence.pg.spec.ts` additions
were not executed here (no throwaway Postgres in this environment — the
harness is `describe.skipIf`-inert; the identical SQL is executed by the
PGlite cell). The mock cells assert loop behavior with mocked CAS results;
real READ COMMITTED interleaving of the full loop remains covered only at the
statement level. `alreadyDelivered` intentionally skips identity/payload
validation and anchor derivation for delivered rows (rationale above) — a
delivered row with a mismatched producing identity is NOT parked by this
stage (retraction is forbidden); detection of post-delivery integrity drift
belongs to its own audit surface, not the delivery loop.

## Round 12 — the authorized product-story attempt SUCCEEDED (first clean Candidate)

Guy authorized exactly one bounded paid authoring attempt on the product
revision `3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a`
(no re-authorization was requested). Executed at branch HEAD `0ba9a767`
(pushed, clean, single-writer verified across all worktrees).

Offline preflight (all $0, all green, before any provider contact):

- Source re-derived from disk with the production `normalizedTextDigest`:
  `9acf0433…` exact. Negative bindings proven: accepted-root bus-stop
  `story.md` → `1128839f…`; legacy `20a12801…/integrated.md` → `5efdd53a…`;
  QA bank `story-bank/v3-approved/chameleon_koko_bedtime.md` → `ba71f2b3…`;
  legacy package bound-source digest ≠ product digest. The legacy Visual
  Package locator is not an input to the authoring chain at all.
- Visual Directions: `visual-directions.json` sha256 `51e3bb3e…`
  (canonical digest `bc8b3d7d…`), byte-pinned by the revision manifest;
  all 8 prior-snapshot `pageImageDirections` proven composed projections
  (setting + mainAction containment) of exactly this record.
- Versions read from production sources (not docs):
  `vc-template-prompt/v22`, `book-surface-repair-prompt/v14`,
  `visual-contract-authoring-policy/v20`, request/receipt/readiness
  v54/v57/v54, model `gpt-5.6-sol`, 7-call/6-repair budget.
- Credential: exactly one `OPENAI_API_KEY` line present in the recorded
  source path; never printed, never persisted.
- Canonical harness checks: 10-file battery — 417 passed; the 8 failing
  cells were the established 5-second parallel subprocess/Git timeouts and
  re-passed 81/81 at `--testTimeout=30000 --maxWorkers=1` (the 2 residual
  errors are the known post-assertion Vitest worker RPC noise).

Run root `outputs/r1d-lantern-fresh-readiness-20260829T155643118Z`
(gitignored bytes on the implementation machine; identities durable here):

| Artifact | Digest / value |
|---|---|
| Fresh Readiness prepare | `ready_for_spend_gate`, evidence v49 `9cd9719044b9e5535e281ec67e17458398671c8fe15764355e6af5ddec2fd744` |
| source snapshot (fresh rebuild) | `35fe04ab5601031735bd7bdd283bab7a8d897bc399427d592e39fe56aa1f6a6c` — byte-identical to the prior attempts' snapshot (content-addressed reproducibility) |
| authoring request (v54) | `4fe7652c29ce620ba003990dfdf56a814493e43cb7b8382717c1e8ef3687e57d` |
| live-request materialization | `5fa2e0d93a7ee6dffad5e088d762cda472147e9babb99b01de29676822c15f83` |
| execution request (v49) | `b6a98e02838e1d8d6d4280d8bdcc33b259c3deb20b72ca7b7f49dacfdb9c4195`; supervisor `verify` → `ready`, zero reasons |
| supervisor live result (v42) | `child_completed`, exit 0; captured artifact `3241a07a503be9dcacc361888dacf6ffbe42cc23d72db69be24de0599dafe99c` under `execution/canonical-live-execution-results/` |
| authoring receipt (v57) | `96b187a350383bf6d2f4eb7250336ea1638b6930cac0e4f93e6c7bfcdfe73b19` — status `completed`, 2 calls / 1 repair (`initial → book_surface_patch`), complete census 1→0, failure `null` |
| provider cost | nominal **$0.461044**, conservative **$0.507156**; tokens 9,783/18,655 (initial) + 5,851/489 (repair) |
| CANDIDATE (v9) | `6f52a3181aad5e96304775e5f2b6462cfaf3261d9c11325f121992dff7b481e0`, template digest `9dbaa8a375375ce6cd10040ac70d1a9cc08c859a509c59b9b1157991799df9be`, 8 pages, 70 action-semantic coverage records, `human:kindergarten_guard` in `humanCast` |
| authoring readiness (v54) | `fa0481553cf6083a10c68b3459e442a25fcb4a295b40e4702fb098fb23e9a3d3` |
| structured replay evidence | `93157006482b7a84764e4243a6dbf7781accb55067b700dda552010e3679823d` |
| candidate validation attestation (v1) | `845a68d86a870a090de2ae57d955a68dd2301bf6152227a91f13d0e473eb9702` — validation `passed`; `doesNotAuthorize` reconciliation approval, Blueprint authoring/approval, package authoring/approval, wizard qualification/render, provider call, image render, publication, deployment |

No `approvedBy: "Guy"` was written anywhere; product acceptance and
adversarial Codex QA both remain pending. One operator mis-step was made
and corrected during capture: the first `capture-supervisor-result` used
`--out …/bridge`, which the attestation's containment fence correctly
rejected (`executionResultPath` must live under `<root>/execution`); the
capture was re-run to the canonical location and the mis-located duplicate
(same content address) was removed. The fence worked as designed.

Round-12 validation on the final bytes: 5 files / 50 tests PASS
(`story-product-resolver` 12, `visual-contract-prompt-table-compaction` 11,
`lantern-transition-frontier` 9, `wizard-runtime-authority-preflight` 5,
`qa-wizard-candidate-bridge` 13); `npx --no-install tsc --noEmit` exit 0;
`git diff --check` clean. No image, audio, Board, Blueprint, package,
locator, Wizard order, payment, render, deployment or production mutation.

**Required general legacy-fallback correction (documented only — not
implemented in this paid round):** `backend/providers/story-product-resolver.ts`
branch 1 falls back to the v3-approved bank story whenever branch 0 is not
render-qualified and `ENABLE_V3_APPROVED_BANK=true` — and
`story-bank/v3-approved/chameleon_koko_bedtime.md` exists, so a superseded
product lineage could silently sell the bank text if its v4 package were
missing or disqualified. The general fail-closed rule must be
authority-driven, never a storyKey special case: **a companion/direction
whose accepted story-source lineage carries a product-accepted revision
(`product-acceptance.json` in the accepted lineage) must never be served
from the v3 bank — if its v4 package selection is not render-qualified, the
resolver refuses (`StoryProductResolutionError`) instead of falling
through.** Equivalent formulation: the v3-bank branch is only legal for
storyKeys with NO accepted-revision product lineage. This derives entirely
from artifacts the resolver can already read (the accepted lineage on
disk), requires no new registry, and turns a silent wrong-story sale into
an explicit refusal. It needs one regression cell: product lineage present
+ branch-0 disqualified → refusal, not bank fallback.

## Round 13 — immutable cover semantic correction ($0)

Codex resumed implementation while Claude Code was paused. The Round-12 paid
Candidate was not edited or rebuilt. The additive implementation introduces:

- `lib/visual-package/visualContractCandidateCoverCorrection.ts` — a closed
  `cover_visible_recurring_prop` operation and content-addressed pending
  Plan/Correction/Review preparation lifecycle;
- `scripts/qa-wizard-candidate-cover-correction.ts` plus the package command
  `qa-wizard-candidate-cover-correction` — strict offline prepare-only CLI;
- `lib/visual-package/__tests__/visual-contract-candidate-cover-correction.spec.ts`
  — exact-before-state, stale/cross-bound, duplicate, replay/no-op and
  extra-key regressions.

The operation binds an exact Story Source snapshot, Candidate, passed
Candidate-validation attestation, recurring-prop identity, lifecycle,
cover-positive index/value and compiler-derived no-spoiler index/value. It
deletes only the bound `firstRevealPage` and exact derived cover prohibition.
It cannot accept a JSON Pointer, raw patch or replacement text. The lifecycle
validates the effective template and compares a normalized before-state with
the result to prove zero unrelated drift. Before the first immutable write it
preflights every JSON and Markdown target, so a late conflicting Correction
cannot orphan a newly written Plan.

Real-artifact preparation against Candidate
`6f52a3181aad5e96304775e5f2b6462cfaf3261d9c11325f121992dff7b481e0`
and validation attestation
`845a68d86a870a090de2ae57d955a68dd2301bf6152227a91f13d0e473eb9702`
produced:

| Artifact | Digest / SHA-256 |
|---|---|
| correction Plan | `cd76d90242e8a41972d8fd1f17bf1395aece8ec4fe60f2f131fd6598d26b5d47`; file SHA-256 `f52d896e1114d0d117e16bb416c3fb924d259131fff1079a1c55ed2042ab52e3` |
| effective Correction | `1662ea9dc4e66ccf217b2c49e42aa4a5644835d955d65b1413aa127e9d5d9c12`; effective template `2fe93bc90140dd4d6529262b361d86a4409f93f30a8cfad52b035176d7ea1c0d`; file SHA-256 `19d99f50ceab5e2e0ad4d3013e4ff3ebc1ccecc574093d8423b5db9a56e521ee` |
| pending Review | `e89b0639e391eb7ed6ab914fc1c85dbcd97945e1ae1d2ff5728a507fbf4fc522`; JSON SHA-256 `d4a02d77570adbd11fb9466f6fbba66ab8eb0699258dc018d73781863912309b`; Markdown SHA-256 `d258270575d3873d50eb70149859682b07b37f3db5da73beda0ef7003b29c584` |
| original Candidate | unchanged file SHA-256 `635efe0ae123836536d17c165cace5d93a411097aa700f72bb2acdee9373b3ca` |

The effective template preserves all five cover `mustShow` entries. It removes
only the lantern/cart/route-label page-1 no-spoiler projections and their
three `firstRevealPage` fields; the bread-roll page-3 and blank-label page-5
lifecycles remain. Full `pageContracts`, `cast`, `humanCast` and Action
Semantic Coverage digest are byte/identity-equivalent to the Candidate. The
Review is `pending` with null reviewer/timestamp and explicitly authorizes no
approval, Blueprint, package, Wizard, provider, render, publication or deploy.

Validation: correction + cover-source-fidelity + workload-classifier 22/22
PASS; both TypeScript projects and `git diff --check` exit 0. The real CLI
preview and immutable write replayed to
the same identities with zero external counters. A hostile pre-existing
Correction collision exited non-zero and `PLAN_CREATED=False`, proving the
preflight stops before partial artifact output. The unchanged Candidate Bridge
suite was started separately but stopped after several minutes of silent
Windows fixture execution; it is not claimed as a PASS. Literal `npm run
check` reached 4,036 passing assertions and exposed the established nine
missing-local-output fixture failures plus one new-spec inventory count; the
inventory expectation was corrected and its focused 7-test suite then passed.
Independent Claude Code review remains pending while Claude is paused. No
provider, image, audio, Vision, network, database, Production, Wizard, payment
or render action ran.

## Round 14 — exact Candidate cover-correction approval

Guy approved the exact Round-13 Plan, effective Correction and Review and
explicitly limited the semantic change to removing lifecycle/no-spoiler
authority from the paper moon lantern, delivery cart and route labels. The
implementation adds a separate immutable approval envelope rather than
rewriting the pending Review or the provider-produced Candidate.

The recorder fails closed unless it can replay, byte-for-byte, the canonical
Plan JSON, Correction JSON, Review JSON and Review Markdown from unique,
non-aliased files, then re-run the full correction preparation against the
original Candidate, passed validation attestation and current Story Source.
Only exact approver `Guy` and a millisecond UTC timestamp that round-trips via
`toISOString()` are accepted. The approval target is collision-preflighted
before the content-addressed store is prepared; replay is immutable.

| Artifact | Digest / evidence |
|---|---|
| approved Plan | `cd76d90242e8a41972d8fd1f17bf1395aece8ec4fe60f2f131fd6598d26b5d47` |
| approved Correction | `1662ea9dc4e66ccf217b2c49e42aa4a5644835d955d65b1413aa127e9d5d9c12` |
| approved Review | `e89b0639e391eb7ed6ab914fc1c85dbcd97945e1ae1d2ff5728a507fbf4fc522` |
| effective template | `2fe93bc90140dd4d6529262b361d86a4409f93f30a8cfad52b035176d7ea1c0d` |
| exact approval | `937ffe515bda0eff83eba03479b46cc7b38dc3b4b92bb86fab2380d691375586`; `approvedBy: Guy`; `approvedAt: 2026-08-29T17:45:11.966Z` |
| approval path | `outputs/r1d-lantern-fresh-readiness-20260829T155643118Z/cover-correction/candidate-cover-correction-approvals/937ffe515bda0eff83eba03479b46cc7b38dc3b4b92bb86fab2380d691375586.json` |

The CLI preview, first write and replay write all returned the same approval
identity and zero credential/provider/image/network/database/Production
counters. A separate `loadApprovedCandidateCoverCorrection` invocation replayed
all three approved digests and the effective template digest. A lexically
aliased approval path was rejected as an invalid filesystem identity. The
approval explicitly does not authorize Candidate mutation, reconciliation,
Blueprint/package approval, Wizard qualification or render, provider/image
calls, publication or deployment.

Final validation: correction/cover-source-fidelity/workload-classifier 24/24;
Candidate bridge 13/13 inside the full resource partition; both TypeScript
projects and `git diff --check` exit 0. Literal `npm run check` remained
honestly red: ordinary 4,039 pass / 73 skip / the same nine missing ignored
`outputs/` fixtures in five unchanged files. Resource-intensive ran 627
assertions successfully but four Git-heavy assertions crossed their fixed
five-second timeout under concurrent Windows load and produced four
`onTaskUpdate` RPC errors. Re-running the readiness spec alone passed 14/14
under its existing limits; re-running materialization with a ten-second test
timeout passed 21/21, including the two assertions measured at 5.275s and
5.757s. No semantic assertion failed under sufficient execution time.

## Round 15 — versioned corrected Candidate bridge ($0)

Bridge manifest v5 introduces an exact optional correction authority. A normal
current manifest carries `candidateCorrection: null`; a corrected manifest
must bind the approved correction envelope and exact correction path/digest,
original provider template digest, and effective approved template digest.
The provider Candidate and its receipt-bound digest are never rewritten. Its
Action Semantic Coverage remains the coverage authority. Only the template
projection and reconciliation derived from Story Source + effective template +
original Coverage change.

The bridge loader replays the correction approval and full packet, the passed
Candidate-validation attestation, Story Source snapshot, original Candidate,
effective template projection, Supervisor authority and pending/approved
reconciliation. The reviewer lifecycle uses the effective template for all
JSON-pointer evidence and validation but preserves the original Candidate
digest as provenance. Both direct approval and reviewer-authored approval feed
the same effective template into Production Context. Legacy v4, v3, v2 and v1
manifests remain exact read-only inputs; v5 is the only writable version.

Real offline evidence:

| Artifact | Digest / result |
|---|---|
| corrected bridge manifest v5 | `2d7e576a1fc3d00f9374c4ec35e0948e4f5b4005435ff367747b531e1cecd266` |
| effective template projection | `2fe93bc90140dd4d6529262b361d86a4409f93f30a8cfad52b035176d7ea1c0d` |
| original Candidate | `6f52a3181aad5e96304775e5f2b6462cfaf3261d9c11325f121992dff7b481e0` (unchanged) |
| original Action Semantic Coverage | `20c4c1786b201cf791d51c074321b21465c58937b79ead3fd464236988d9077e` (unchanged) |
| pending reconciliation | `459845334a2e45357afaf5333efa8ce0569f8ca0a1fa8e8765d39ce186cb5f2e` |
| pending review bundle | `14816960d3205c33cdb465d0c0f7395240b312c6a3dbc024ba968f75744d9f7b` |
| write/replay | first write `created:true`; exact replay `created:false` |
| external counters | credentials/provider/image/network/database/Production all zero |

The hermetic regression creates a valid receipt-bound Candidate with the same
cover contradiction class, prepares and approves the closed correction, then
advances the consumer repository HEAD. The ordinary current bridge rejects the
stale attestation. The corrected bridge succeeds under the frozen historical
authority, preserves Candidate bytes, reloads its own manifest, passes the
strict CLI, authors reviewer evidence from the effective template, records a
temporary exact approval, advances to `reconciliation_approved`, and reloads
an identical Production Context. Separate legacy coverage proves v4–v1 replay
without upgrading.

Validation: 53/53 correction/Blueprint/package; 2/2 corrected bridge and
legacy compatibility; full bridge 14/14 inside the repository resource
partition. Literal `npm run check` remains honestly red: ordinary 4,039 pass /
73 skip / the same nine missing ignored-`outputs/` fixtures in five unchanged
files; resource 628 pass plus four Git-heavy tests that crossed their fixed
five-second timeout and emitted the known `onTaskUpdate` RPC classification.
All four re-passed in isolation with one worker and a ten-second test allowance
(4.872–5.966s). Both TypeScript projects and `git diff --check` pass. No
provider, live, paid, image, audio, Vision, database, Production, Wizard,
payment or render operation ran.

The real bridge is intentionally `reconciliation_pending`: Guy has not yet
approved exact corrected reconciliation content. This milestone grants no
Blueprint/package approval, publication, Wizard qualification or render.

## Remaining chain to the end product (documented, not executed)

From the current corrected pending bridge:
prepare-reviewed-reconciliation (reviewer decision plan: cover + 8
image-direction requirements + one disposition per presentation record) →
approve-reviewed-reconciliation (`approvedBy: "Guy"`) → advance →
Board mints from the fresh candidate-template projection (LOW + Vision QA +
`--approve`; commit + push `set-identity-boards/`) → Blueprint
`prepare-live-request`/`execute-live` (≤3 calls, ≤$5)/`approve-blueprint` →
`prepare-package`/`approve-package`/`publish-package` (locator CAS) →
promotion-coupled test updates (`story-product-resolver.spec`
`CHAMELEON_ACCEPTED_REVISION`, `accepted-revision-text-finalization.spec`
`SOURCE_REF`, `accepted-revision-story-loader.spec`,
`accepted-story-source-authoring-authority.spec`) → offline wizard
runtime-authority preflight (cover+8 pages, providerCalls 0) → QA Wizard
order for Bar (photo `public/Images/Bar.png` through the normal upload path,
category TRANSITION, `dad` voice) on the branch preview
(`small-heroes-git-codex-r1d-order-pa-cff336-smallheroes-projects.vercel.app`)
→ fake payment → the one bounded paid render.

## Limitations and unresolved risks

- The end-product objective (a delivered QA Wizard lantern book) was **not**
  reached. The successful Candidate and approved cover correction now have a
  current pending bridge; exact reconciliation content, independent QA,
  Blueprint/package authority and the final Wizard render remain.
- The outbox send-time CAS binds authority only transitively (fingerprint +
  writer barrier), not by re-reading `visualPackageAuthority` in the claim
  SQL; a future direct-SQL writer that skips the barrier would not be caught
  at send time (documented residual, writer-coverage guard in place).
- For a legacy Style-01 Order with the enforcement flag on (non-prod), the
  freeze still reads the mutable current locator at render time — the
  pre-existing R1C legacy behavior, unchanged by design.
- `lib/__tests__/visual-contract-prompt-table-compaction.spec.ts` min
  headroom over the 64K input ceiling is now ~1,026 units — above the 1,024
  floor but with little slack for future prompt growth.
- The staging `_prisma_migrations` row was inserted manually (the direct DB
  port is unreachable from this machine); `prisma migrate deploy` from a
  networked host would have been the cleaner path.
