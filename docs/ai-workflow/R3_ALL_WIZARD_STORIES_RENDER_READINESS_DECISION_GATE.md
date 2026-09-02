# R3 All Wizard Stories Render Readiness — Decision Gate

Date: 2026-09-02
Owner request: Guy asked Codex to make every story currently offered by the Wizard available for render and explicitly told Codex to start.
Implementation branch: `codex/r3-all-wizard-render-readiness`
Base: `f62422a01db3da791861c670e266e91daecfefd8`

## 1. Proposed change

Move the exact current Wizard catalog from **18/18 product-sellable but only
1/18 strict render-qualified** to an explicit, auditable path toward **18/18
strict render-qualified** without weakening the production gate.

The work is split into separately reviewable milestones:

1. **R3-A — zero-cost readiness control plane.** Enumerate the exact 18 Wizard
   slots from `MVP_STORY_MATRIX`, resolve every competing Story Source lineage
   and companion authority, run the real strict qualification contract, and
   report deterministic per-story stages and next actions. The shipped CLI is
   read-only: it cannot materialize authority artifacts, call a provider,
   render, approve, publish, deploy, create an order, or access a database.
2. **R3-B — authoritative corpus cutover and accepted
   source/visual-direction revisions.** After Guy chooses the exact product
   corpus, prepare the 17 missing product review bundles from that source and
   its typed visual directions. Claude Code reviews the immutable technical
   range; Guy reviews and accepts the exact product/visual-direction
   candidates.
3. **R3-C — current Visual Contract authoring.** Run the canonical paid
   text-only Visual Contract boundary only for exact accepted revisions that
   pass preflight. The current policy caps one story at $10 and rejects books
   above 12 beats before provider access. No image generation occurs.
4. **R3-D — current Blueprint authoring.** Run the separate canonical paid
   text-only Blueprint boundary only for exact accepted Story Source + Visual
   Contract inputs. Each story remains independently budgeted,
   content-addressed, and fail-closed. No image generation occurs.
5. **R3-E — Board/prop/package completion.** Materialize and review every
   required Set Board and prop reference, assemble an exact Visual Package,
   collect digest-bound Guy approval, and publish the package locator. This is
   the only phase that may require image generation before a book render.
6. **R3-F — all-slot qualification.** Require the existing strict audit and
   release check to report 18/18, then verify one non-rendering Wizard-to-order
   preflight per slot. Full-book rendering remains a separate product/cost
   decision.

## 2. Why now?

The Wizard currently exposes all 18 stories as products. The QA-only catalog
can derive LOW render authority for all 18, but it explicitly marks every
candidate `productionRenderQualified:false`. The strict production audit on the
current release line resolves only `chameleon_koko_bedtime`; the other 17 fail
primarily with `approved_package_missing`. This means customer choice and
production render authority are not yet aligned.

The user also reported cross-page wardrobe drift. Bypassing the package gate or
reusing the QA-only derived path would make that continuity problem easier to
repeat. The correction must therefore complete the current source → Blueprint
→ Board/prop → Visual Package chain rather than weaken it.

The baseline audit also contains a false-green mode: its
`--require-render-qualified` exit condition filters only slots that remain
`productSellable`, while package rejection itself makes a slot unsellable. It
therefore exits successfully with 17 nominal Wizard slots unqualified. R3-A
must introduce an explicit all-nominal scope instead of silently redefining the
existing sellable-only gate.

## 3. Scope

This is a general system and catalog-authority completion change for the exact
six categories × three directions currently owned by `MVP_STORY_MATRIX`:
18 story keys and six approved companions.

It does not include the wider legacy V5 corpus, future story briefs, historical
review candidates, non-MVP companions, or a rewrite of the 18 story texts.

The same 18 stable story keys currently name different text authorities:

- the V3 fallback corpus used by the current Production flag;
- the newer QA-only autonomous corpus used by the QA catalog; and
- for Chameleon bedtime, a third product-accepted immutable revision bound to
  the current approved package.

The V3 and QA texts differ for 18/18 keys, including titles, plots, and some
gender metadata. R3-A reports both. R3-B cannot begin until Guy chooses which
corpus becomes product-authoritative; a package may not conceal that cutover.

R3-A may add a pure batch inventory/orchestration module, a read-only CLI,
tests, and durable documentation. Later milestones may add exact
content-addressed accepted revisions, Blueprints, Boards, prop references,
packages, approvals, and locators through their existing lifecycle APIs.

## 4. Risk of hardcoding

The control plane must derive all slots from the canonical matrix and route
every story through the same authority predicates. It may not contain a list of
17 exceptions, special-case one companion, infer readiness from a direction
label, or mark a story ready because a similarly named historical artifact
exists.

The one already-qualified Chameleon package is a regression fixture and a
reference output, not a template whose story-specific facts can be copied.

## 5. Files likely affected

- A new `lib/visual-package` or `lib` readiness-program module that composes the
  existing matrix, Story Source, QA catalog, and strict qualification APIs.
- A new `scripts/` CLI for deterministic all-slot audit/materialization.
- Focused tests under `lib/**/__tests__` and CLI coverage.
- Content-addressed story-source review artifacts and later existing
  Blueprint/package authority roots, only through their canonical lifecycle
  tools.
- `CURRENT.md`, this Decision Gate, and milestone evidence documents.

No production route, qualification threshold, fallback policy, payment code,
reader layout, narration logic, or order row is expected to change in R3-A.

## 6. Expected behavior after change

### R3-A acceptance

- One deterministic report contains exactly 18 unique current Wizard slots and independently compares them with the
  canonical nominal key set.
- It distinguishes at least: source ready, QA LOW ready, strict source visual revision accepted, published-package-
  bound Visual Contract template, approved Blueprint and required Boards/props, Visual Package published, and strict
  production render-qualified. A false package-bound stage means “not proven through a structurally valid published
  package”; it does not claim that no ignored/unpublished authoring artifact exists.
- With `ENABLE_V3_APPROVED_BANK=true`, the current baseline is reported honestly as 18/18 sellable, 18/18 QA LOW ready,
  and 1/18 strict render-qualified.
- Each row reports the V3, QA-only, and product-accepted source identities
  independently and refuses to call them interchangeable.
- Every non-ready story has closed reason codes and one next canonical action;
  no missing story is silently dropped.
- Dry-run/materialization is provider-, credential-, network-, render-,
  database-, order-, publication-, and approval-unreachable.
- Rerunning against unchanged inputs produces the same semantic output and
  content digest.
- `--require-all-render-ready` exits nonzero for any unqualified nominal slot,
  including a slot that package rejection made unsellable.
- The report exposes the six 16-beat fantasy stories as blocked by the current
  Visual Contract authoring policy's 12-page ceiling rather than allowing a
  paid call to discover it.
- Narration readiness is evaluated against the exact selected source and both
  supported boy/girl projections; no QA-only narration claim can qualify a
  different product source. The current `other`-gender and age-range contract
  mismatch is reported, not silently certified.
- The narration claim is named automated preflight, not final readiness: all 432 selected boy/girl page projections
  execute through the production TTS builder, while 12 soft `שם` review items across six stories and the separate
  human ear gate remain visible.

### Program completion

- The unchanged strict render-qualification audit and release check report
  18/18.
- Every package binds the exact current Story Source revision, approved
  Blueprint, reconciliation, style authority, companion authority, required
  Boards/props, and exact Guy approvals.
- The Wizard/order preflight can resolve any of the 18 without a QA flag or
  legacy fallback.
- The resemblance floor remains `0.70` and all existing fail-closed behavior is
  preserved.

## 7. Validation plan

For R3-A, use zero-cost fixtures and the real repository catalog:

1. Baseline and post-change all-slot strict qualification audits.
2. Focused tests covering all 18 slots, uniqueness, missing/stale artifacts,
   competing source lineages, the six policy-blocked fantasy slots, the one
   qualified package, deterministic digests, exit semantics, and unreachable
   forbidden boundaries.
3. Relevant visual-package, Wizard matrix, source-authority, and release-check
   suites.
4. `npx tsc --noEmit`, `git diff --check`, and `npm run check` before commit.
5. Independent read-only Claude Code review of an immutable commit range.

No full book and no image are required to prove R3-A. Later phases use the
smallest Board/prop sample that proves each new authority before wider spend.

## 8. Cost impact

R3-A and R3-B candidate preparation are zero-cost. R3-B authority publication
still requires exact human review even though it has no provider cost.

R3-C Visual Contract authoring has a compiler-owned hard ceiling of **$10 per
story**. R3-D Blueprint authoring has a separate hard ceiling of **$5 per
story**. For 17 missing stories, the theoretical combined text-authoring
ceiling is therefore **$255** (`17 × ($10 + $5)`), although prior one-call
executions were materially lower. This gate does not authorize those calls
yet; Codex must first produce exact per-story preflight and a wave budget. The
six 16-beat fantasy stories are currently rejected before spend and require a
separate policy/partition Decision Gate.

R3-E image cost cannot be stated honestly until approved Blueprints reveal the
deduplicated set/prop inventory. Codex must report the exact image count,
quality, and maximum spend before generating any Board or prop reference.

Book-page rendering is excluded from this program unless Guy separately
approves a bounded proof.

## 9. Rollback plan

Each milestone is a focused commit. Revert only that milestone and remove only
its newly created ignored output root if needed. Existing Story Sources,
historical evidence, the approved Chameleon package, Boards, locators, orders,
renders, narration work, and remote state remain byte-for-byte intact.

Publication milestones must use content-addressed revisions and
compare-and-swap locators so rollback can restore the preceding exact locator.

## 10. Review assignment

Guy has approved the product objective and the zero-cost start. Guy must still
eyeball and approve exact story/visual-direction candidates, exact Blueprints,
Boards/props, and Visual Package candidates; broad intent is not forged into a
digest-bound approval.

Claude Code must try to falsify catalog completeness, source identity, stage
classification, determinism, forbidden-boundary isolation, stale/historical
artifact rejection, package qualification parity, and the claim that no
approval or paid side effect occurred.

Claude Cowork is optional for story/visual-direction quality questions; it does
not replace Guy's acceptance or Claude Code's technical gate.

## 11. Stop-check answers

1. **General or story-specific?** General all-slot control plane plus exact
   per-story authority data through one lifecycle.
2. **Could this break another story/child/companion/style?** Yes if selection,
   source binding, or shared package logic is weakened; all 18 and six
   companions are therefore mandatory test coverage.
3. **Does it affect production?** R3-A does not. Later locator publication does
   and is separately gated.
4. **Does it spend money?** R3-A/R3-B preparation: no. R3-C/R3-D and parts of
   R3-E: yes, only after explicit wave budgets.
5. **Smallest safe validation?** An 18-slot dry run with zero provider access,
   closed exit semantics, and no materialization.
6. **What must Guy decide?** Which of the conflicting V3 versus QA story
   corpora becomes product authority; the 16-page authoring policy; exact
   product/visual approvals; paid wave budgets; Board/prop visual acceptance;
   the supported `other`-gender/age contract; and final catalog activation.
7. **What should Claude Code falsify?** Completeness, identity, isolation,
   determinism, closed reasons, and parity with the real strict gate.
8. **Should Claude Cowork review?** Only where Guy wants additional creative or
   story-quality advice.
9. **What should Guy eyeball?** Per-wave visual directions and Blueprints first;
   then the minimum Board/prop contact sheet before package approval.

## 12. Do not do

Do not mark QA-only derived authority as production-ready; weaken or bypass the
strict gate; lower the `0.70` resemblance threshold; reuse stale source-bound
artifacts; invent Guy or Claude approvals; call a provider from dry-run; render
a full book; create/modify orders; access database/storage; publish, deploy, or
activate Production; add story-specific runtime fallbacks; merge unrelated
branches; treat the V3 and QA corpora as byte-equivalent; expand the 12-page
authoring policy without a separate approved Decision Gate; or push without
explicit instruction.
