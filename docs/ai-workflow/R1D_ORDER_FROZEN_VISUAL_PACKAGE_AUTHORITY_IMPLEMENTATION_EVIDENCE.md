# R1D Order-Frozen Visual Package Authority — Implementation Evidence

**Date:** 2026-08-27
**Implementation owner:** Claude Code (explicit temporary transfer from Codex by Guy)
**Branch / worktree:** `codex/r1d-order-package-authority-binding` / `C:\GNart\Work\sh-order-package-authority`
**Base:** `983a09ee835be92ddeaf1134a56a5d122b61a328`
**Review range:** `983a09ee..59efadb5` (3 commits, all pushed)
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
   records; the three micro-beats came back as `presentation_requirement`.
2. **v20 transition-scheme ambiguity.** `analyzeTransitionSequence` enforces
   arrival-carried transitions (a page in a new zone must itself carry
   `after_transition`/`threshold`; `before_transition`/`steady` pages must
   stay in the previous page's zone), which the prompt never stated. The
   model's symmetric departure scheme was self-consistent under the prompt
   text; two `book_surface_patch` repairs re-asserted byte-identical
   transitions and the stagnation fence correctly stopped spend. Fixed in
   v21 (`59efadb5`).

Offline proof of the remaining distance (both in run root 2):

- `transition-scheme-proof.ts` — the exact attempt-2 draft with only the six
  flagged transitions rewritten to the arrival scheme compiles through
  `runOfflineRepairHarness` to `outcome: "candidate"`,
  `finalSurfacedIssueCount: 0`, `finalCompleteIssueCount: 0`,
  `providerCalls: 0` (candidate template digest `cd4df688…`).
- 4-defect-class scan (`attempt2-draft-pseudo-candidate.json` against the
  calibrated scanner that FAILs the legacy `be2d3202…` candidate on 3 of 4
  classes): attempt-2 draft PASSES all four — 0 cover no-spoiler
  contradictions, distinct spatial targets, kindergarten guard present in
  `humanCast` (garment origin bound to `שומרת הגן`, p7), 0 false eye-beat
  closures.

**Stop-rule closure:** the milestone brief states "If two consecutive
paid/live attempts fail, stop spending and produce a causal map rather than
patching the latest symptom." Both attempts failed; all paid operations
stopped there. No third authoring attempt, no Blueprint call, no Board mint,
no package assembly/publication, no locator change, no Wizard order, no
payment, no render. The current locator still selects legacy package
`2b488f2d…` bound to `20a12801…`.

## Remaining chain to the end product (documented, not executed)

After Guy's explicit go for one further authoring attempt (~$0.55, v21):
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
  headroom over the 64K input ceiling is now ~1,027 units — above the 1,024
  floor but with little slack for future prompt growth.
- The staging `_prisma_migrations` row was inserted manually (the direct DB
  port is unreachable from this machine); `prisma migrate deploy` from a
  networked host would have been the cleaner path.
