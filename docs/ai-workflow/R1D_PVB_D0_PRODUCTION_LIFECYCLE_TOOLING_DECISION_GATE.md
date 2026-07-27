# R1D-PVB-D0 — Production Lifecycle Tooling Decision Gate

**Status:** APPROVED by Guy in the delegated R1D-PVB-D0 implementation brief on 2026-07-27  
**Immutable base:** `4b84f54b79f2ac63582f7efe0760accc1ea6610d`  
**Implementation branch:** `codex/r1d-pvb-d0-production-lifecycle-tooling`  
**Cost boundary:** zero image, audio, provider, Vision, network, storage, or database calls

## 1. Proposed change

Add the missing general production lifecycle between the independently PASSed PVB-B Blueprint libraries and PVB-C immutable `visual-package/v4` runtime authority:

```text
Story Source snapshot
  -> semantic reconciliation draft and exact-citation review
  -> approved reconciliation
  -> stable content-addressed Style01 authority
  -> exact authoring context
  -> whole-book Blueprint authoring preflight/provider seam
  -> independent Blueprint approval
  -> Board/prop compatibility
  -> v4 candidate assembly
  -> independent package review
  -> independent exact Guy package approval
  -> immutable package finalization
  -> separate publication/locator update
```

D0 builds and tests the deterministic tooling only. It performs no real authoring, approval, Board action, publication, promotion, or render.

## 2. Why now?

PVB-B owns Blueprint authoring/review/approval primitives and PVB-C owns immutable v4 runtime consumption, but the base repository lacks a canonical production entry between them. The existing Blueprint CLI consumes local fixture-style validation context, Style01 has no immutable production authority artifact, semantic draft review is not a first-class lifecycle bundle, and v4 approval does not bind an independently reviewed package candidate.

Without this milestone, a future real production attempt would require operator assembly, mutable style prose, or approval propagation. Those are fail-open lifecycle risks.

## 3. Scope

This is a general system change. Every input is parameterized by `storyKey`, exact repository-relative artifact paths, exact digests, and declared style/set authority. Fox is allowed only as a read-only readiness fixture because it is the sole complete real Visual Contract Template at this base.

No shared implementation may contain a Fox, child, companion, page, location, or story literal.

## 4. Risk of hardcoding

The principal risk is accidentally proving only the current Fox story or one simple no-Board shape. The required matrix therefore includes multiple synthetic story shapes, zero/one/multiple Board requirements, multiple locations, no companion, late reveal constraints, incomplete authority, stale exact inputs, wrong historical versions, and portrait-layout contradictions.

## 5. Files likely affected

- `lib/visual-package/` production readiness, context, reconciliation, provider runner, and v4 lifecycle modules
- canonical `style-authorities/style01/` artifact
- `scripts/production-visual-lifecycle.ts`
- `package.json`
- synthetic lifecycle and v4 regression tests
- `CURRENT.md` and this Decision Gate

PVB-C runtime prompt/projection behavior, Story Sources, Boards, provider adapters, database/storage code, feature flags, and deployment configuration remain unchanged.

## 6. Expected behavior after change

- Readiness produces deterministic machine-readable reasons and never fabricates missing authority.
- The authoring context binds exact Story Source raw/normalized snapshots, exact template, approved reconciliation, authored cover authority, and stable Style01 content.
- Reconciliation drafts enumerate exact source requirements and JSON-pointer citation roots while remaining pending and blocked until human coverage is complete.
- Authoring preflight proves the provider seam is unreachable. A future live caller must explicitly inject one provider, exact model/config/call budget, and `noFallback:true`.
- Raw prompts, responses, credential values, and provider failure text are absent from persistable receipts.
- v4 assembly consumes only exact approved Blueprint lifecycle artifacts and compatible Board/prop authority.
- Package review, package approval, finalization, and publication are separate exact-digest states. Blueprint approval does not propagate.
- A Story Source/template/style/reconciliation/Blueprint/Board/package change invalidates dependent authority.
- Historical v1/v3 authority and malformed JSON fail closed.
- D0 CLI commands are zero-write. There is no live, approve, publish-write, render, Vision, network, storage, database, or registry mutation command.

## 7. Validation plan

Smallest proof:

1. TypeScript with `npx --no-install tsc --noEmit`.
2. Focused production foundation and v4 package lifecycle suites.
3. Existing v4/PVB-B/PVB-C regression suites.
4. Literal `npm run check`, with any unchanged ignored-output fixture baseline reported rather than fabricated.
5. `git diff --check`, forbidden-boundary/literal scans, CLI help, and final topology reconciliation.

No image generation or book render is required or authorized.

## 8. Cost impact

Expected spend: **$0**.

Expected generations: **0**.

Only local deterministic TypeScript, Vitest, file fixtures in temporary directories, and Git inspection are permitted.

## 9. Rollback plan

The milestone is isolated in focused commits on its own branch. Rollback is a normal revert of the D0 commits. No migration, database state, remote object, package locator, approval artifact, Board, deployment, or production flag is created.

The v4 approval schema moves from v1 to v2 because v2 binds the exact candidate and review. There is no real v4 production package at the immutable base; historical/synthetic v1 approval is intentionally ineligible for the new lifecycle.

## 10. Review assignment

Guy already decided the product lifecycle, authority separation, zero-cost boundary, v4-only rule, and no-special-case requirement.

Claude Code first-pass review is read-only and should try to falsify:

- exact digest invalidation at every dependency edge;
- no Blueprint-to-package approval propagation or self-approval helper;
- total fail-closed parsing/path/no-overwrite behavior;
- no v1/v3/legacy fallback;
- Blueprint sole composition authority and Boards appearance/geometry-only role;
- provider and external boundaries unreachable in dry/preflight;
- receipt secret safety and exact call/repair/usage accounting;
- one/multiple/no-Board and late-reveal generality;
- D0 having performed no real action.

Claude Cowork review is not required for this zero-cost technical tooling milestone. A later real review bundle may be sent for product/creative review.

## 11. Do not do

- No live authoring/model/LLM, image, render, provider, Vision, fetch, or network call.
- No credential or environment-file loading.
- No Supabase, storage, database, registry, or locator write.
- No Board mint/import/action/approval.
- No real reconciliation, Blueprint, Board, or package approval.
- No publication, promotion, production flag, deployment, PR, push, or cleanup.
- No Story Source rewrite.
- No full-book or page render.
- No Fox/story-specific shared implementation.

## Stop-check record

1. General system fix: **yes**.
2. Cross-story/style risk: **yes**, controlled by exact schemas/digests and multi-shape tests.
3. Production behavior affected: tooling eligibility only; runtime rendering remains unchanged and off.
4. Spend: **none**.
5. Smallest validation: deterministic fixtures, TypeScript, focused suites, full repository check.
6. Remaining Guy decision before D0: **none**; the delegated brief is explicit approval.
7. Claude Code target: exact-authority invalidation, separation, external-boundary reachability, and fallback attempts.
8. Claude Cowork question: **none for D0**.
9. Guy eyeball: later real reconciliation/Blueprint/package review artifacts, not synthetic D0 fixtures.
