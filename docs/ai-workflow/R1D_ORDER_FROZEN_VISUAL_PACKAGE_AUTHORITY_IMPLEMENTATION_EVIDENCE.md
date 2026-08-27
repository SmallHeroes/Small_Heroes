# R1D Order-Frozen Visual Package Authority — Implementation Evidence

**Date:** 2026-08-27
**Implementation owner:** Claude Code (explicit temporary transfer from Codex by Guy)
**Branch / worktree:** `codex/r1d-order-package-authority-binding` / `C:\GNart\Work\sh-order-package-authority`
**Base:** `983a09ee835be92ddeaf1134a56a5d122b61a328`
**Review range:** `983a09ee..HEAD` — at first handoff `f982f9f8`, `c38a18ac`, `59efadb5`, then `0e49b8f6` (this document) and the Codex-QA correction commit that amends it; the exact final head is the pushed branch tip
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
   text; two `book_surface_patch` repairs re-asserted byte-identical
   transitions and the stagnation fence correctly stopped spend. Fixed in
   v21 (`59efadb5`).

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

The exact attempt-2 provider bytes are additionally TRACKED as test fixtures
under `lib/visual-contract-compiler/__tests__/fixtures/lantern-transition-frontier/`
(initial draft + the byte-identical stagnating repair both paid repair calls
returned + the arrival-scheme corrective repair).

Offline proof of the remaining distance:

- **Tracked repair-route convergence proof** (supersedes the first handoff's
  `transition-scheme-proof.ts`, which pre-edited the draft and therefore
  proved only compiler acceptance):
  `lib/visual-contract-compiler/__tests__/lantern-transition-frontier.spec.ts`
  drives the EXACT captured attempt-2 bytes through the REAL offline repair
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

**Stop-rule closure:** the milestone brief states "If two consecutive
paid/live attempts fail, stop spending and produce a causal map rather than
patching the latest symptom." Both attempts failed; all paid operations
stopped there. No third authoring attempt, no Blueprint call, no Board mint,
no package assembly/publication, no locator change, no Wizard order, no
payment, no render. The current locator still selects legacy package
`2b488f2d…` bound to `20a12801…`.

## Remaining chain to the end product (documented, not executed)

After Guy's explicit go for one further authoring attempt (~$0.55, under
v22 + repair v14):
capture-supervisor-result → attest-candidate-validation →
prepare-reconciliation (git-clean+pushed gates) → prepare-reviewed-
reconciliation (reviewer decision plan: cover + 8 image-direction
requirements + one disposition per presentation record) →
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
  reached; it is blocked exclusively on the paid-attempt stop rule.
- A third authoring attempt samples a new draft; further undiscovered
  prompt-contract traps are possible (two were found in two attempts). Each
  has so far cost ~$0.5 and yielded a permanent general fix.
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
