# R1D Wizard Sellability Checkout Unblock — Implementation Evidence

**Date:** 2026-08-12

**Branch:** `codex/r1d-wizard-sellability-checkout-unblock`

**Worktree:** `C:\Users\guyna\.codex\worktrees\wizardcheckout1\Small_Heroes`

**Exact base:** `388dc4336c17487b9c0ef35da2f98ec8000c7db7`

**Base source:** pushed `origin/codex/r1d-reader-premium-site-qa-integration` and exact deployed QA commit

**Cost:** `$0`

## Report and reproduction

Guy reported that the previous evening's book-creation flow did not pass the step before fake payment.

Read-only Vercel inspection identified the stable QA deployment as `dpl_FgJuU2HpfavbAxUspiCbBr7M2Xeo` for exact commit `388dc4336c17487b9c0ef35da2f98ec8000c7db7`. Runtime logs for the reported interval contained `/start` activity but no `/api/orders`, `/api/checkout`, or fake-payment request for the reproduced path. This localizes the observed stop before order creation rather than inside the fake checkout handler.

Authenticated browser reproduction selected a public challenge and advanced through the Wizard with synthetic, non-sensitive values. At the product step, bedtime, adventure, and fantasy were all disabled and labeled “coming soon”; Continue was disabled and the browser console had no error. The reproduction stopped there. It created no order, payment, generation, or other external side effect.

## Root cause

Commit `7d1d98565f2063fef15ab1f4fc5f3d3e10e69741` added distinct Wizard metadata:

- `sellable`: product/catalog availability;
- `qaAuthoringReady`: QA candidate authority;
- `productionRenderQualified`: approved Production render authority;
- `selectable`: the union of QA authoring or Production render readiness.

The same commit changed the customer product cards and restored-state validation from `sellable` to `selectable`. On the current QA deployment, unavailable filesystem-backed QA/render authority makes `selectable` false while the story matrix still reports the slot `sellable`. All customer choices were therefore disabled before `/api/orders`.

This contradicts the canonical separation in `PROJECT.md`: a product-sellable slot may be offered to the customer, while render qualification is the later fail-closed prerequisite for a paid image call. The server order route independently calls `enforceMvpOrderSlot`, so the browser is not the final authority.

## Implemented correction

The implementation changes only the two customer availability consumers in `public/JS/wizard.js`:

1. product cards show “coming soon” only when `sellable === false`;
2. restored product selection is cleared only when the direction is not `sellable`.

The internal `selectable` field and all QA/render metadata remain present and unchanged for internal consumers. Missing matrix directions retain the existing `{ sellable: false, selectable: false }` fallback. No story, category, direction, companion, child, or environment literal was added.

No changes were made to:

- `lib/web/mvp-matrix-response.ts` readiness calculation;
- `/api/orders` server authority;
- fake-payment or site-password flags;
- checkout/payment provider behavior;
- pricing or coupons;
- visual contract, Blueprint, render qualification, generation, Reader, stories, or companions;
- dependencies, `package.json`, or `package-lock.json`.

## Direct tests

`lib/__tests__/wizard-customer-sellability.spec.ts` extracts and executes the shipped `renderProductCards` function with minimal deterministic DOM/state seams. It proves:

- `sellable:true/selectable:false` creates an enabled card, retains restored selection, and binds the click handler;
- `sellable:false/selectable:true` disables the card, applies “coming soon”, binds no click handler, and clears restored selection;
- the two shipped customer predicates reference `sellable`, not `selectable`;
- missing directions remain fail-closed;
- `/api/orders` still calls `enforceMvpOrderSlot` with client direction and companion.

`lib/__tests__/wizard-mvp-matrix-api.spec.ts` now makes the architecture explicit: in a real Production environment with QA flags ignored, every enabled-bank slot remains `sellable:true` while QA authoring, Production render qualification, and internal `selectable` remain false.

## Validation evidence

Initial focused run after the runtime correction:

- **5 files / 56 tests PASS**.

Strengthened executable client regression:

- **5 files / 58 tests PASS**.

Final focused run after the workload inventory correction:

- `lib/__tests__/wizard-customer-sellability.spec.ts` — 6/6;
- `lib/__tests__/wizard-mvp-matrix-api.spec.ts` — 5/5;
- `lib/__tests__/fake-payment-gating.spec.ts` — 37/37;
- `lib/__tests__/mvp-story-matrix.spec.ts` — 6/6;
- `lib/__tests__/wizard-render-readiness.spec.ts` — 4/4;
- `lib/__tests__/vitest-workload-classifier.spec.ts` — 7/7;
- total **6 files / 65 tests PASS**.

Deterministic TypeScript:

- an initial run against the primary worktree's shared Prisma client correctly exposed that the client had been generated from another branch's schema;
- this worktree then received its own offline `npm ci --ignore-scripts` and local `npx prisma generate`;
- `npx tsc --noEmit` — **PASS** before and after the count correction.

Other checks:

- `git diff --check` — **PASS**.
- package and lockfile tracked blob IDs remain byte-identical to exact base.

## Literal repository gate

`npm run check` ran once, literally, after focused green and TypeScript. It was not rerun.

- TypeScript: **PASS**.
- Canonical inventory: **296 files** after adding this milestone's one spec.
- Ordinary: **277 files**, valid bounded diagnostic protocol, exit `1` for eight assertions at the time of the run.
- Resource-intensive: **19/19 files PASS** in `113,100ms`, exit `0`, valid bounded diagnostic protocol.
- No timeout, RPC/IPC, reporter, launch, signal, termination, teardown, or diagnostic-protocol failure occurred.

The ordinary assertions were:

1. the six established absent ignored-output fixture cases in the five unchanged files `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`, `set-appearance-ref-budget.spec.ts`, and two cases in `story-read-back-validation.spec.ts`;
2. the pre-existing stale single-line string assertion in unchanged `r1d-dini-bar-five-page-measurement-authority.spec.ts`, already documented on the exact Reader/QA base;
3. one workload inventory assertion caused solely by the newly added spec (`295/276` expected versus `296/277` actual).

Only item 3 was changed. Focused classifier validation then passed 7/7, the complete focused set passed 65/65, TypeScript passed, and the literal full gate was not rerun. Items 1 and 2 remain pre-existing repository/release HOLDs and are not reclassified as acceptable.

## Topology and boundaries

- The dedicated worktree was created only after verifying exact pushed/deployed base identity, all worktrees, relevant status, branch/upstream state, and package/lockfile identity.
- The source QA worktree is clean and one documentation-only commit ahead of the deployed/pushed base; it was not modified.
- The Product Owner's primary worktree contains unrelated untracked files; none was modified or staged.
- The worktree-local dependency install is ignored and changes no dependency manifest or lockfile.
- The previously created shared-dependency junction was moved out of the repository worktree to preserve it before the isolated install; the primary dependency tree was never modified.

No credential access/check/load, environment mutation, provider/model/network generation call, image/audio/Vision action, order, checkout, payment, database/storage read-write, migration, render, deployment, promotion, merge, push, or cleanup occurred.

## Independent QA required

Codex does not self-award technical PASS. Claude Code's first pass must be read-only against the exact immutable base-to-head range and should try to falsify:

- whether any customer availability path still consumes `selectable` or other render/QA metadata;
- whether non-sellable or missing slots can remain selected or reach the server;
- whether the executable regression runs the shipped function faithfully rather than a reimplementation;
- whether `/api/orders`, fake-payment safety, pricing, QA metadata, and render qualification remain unchanged;
- whether the full-gate, topology, exclusions, and limitations are recorded exactly.

A separately authorized push and QA Preview deployment are required before browser-confirming the fix on `qa.smallheroes.co.il`.
