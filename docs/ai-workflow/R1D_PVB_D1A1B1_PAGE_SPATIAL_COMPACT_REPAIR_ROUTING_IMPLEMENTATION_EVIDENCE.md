# R1D-PVB-D1A1B1 — Page-Spatial Compact Repair Routing Implementation Evidence

Date: 2026-08-09

Status: implementation complete locally; independent Claude Code QA pending

## Authority and topology

- Exact base: `22857995df578d366809226a5d693cd783a10ed7`
- Branch: `codex/r1d-pvb-d1a1b1-page-spatial-compact-repair-routing`
- Worktree: `C:\Users\guyna\.codex\worktrees\spatialcompact1\Small_Heroes`
- Green implementation commits:
  - `3d92615b` — `feat(authoring): route page spatial repairs compactly`
  - `bc2c1311` — `feat(authoring): cut over spatial repair authority`
- No merge, push, credential access, network/provider call, B0/Fresh Readiness, preflight, live authoring, candidate generation, render, or downstream action occurred.

## Observed failure and root cause

The consumed live attempt on the base completed one provider response and returned five typed `page_spatial_reference_outside_zone` failures on pages 1, 2, and 4. Existing classification correctly considered the family repairable, but the router fell through to `full_draft`. The complete draft plus complete schema exceeded the unchanged `64,000` input ceiling before a second provider dispatch. The local ceiling stop was correct; the routing granularity was unnecessarily broad.

The existing `page_contract_patch` boundary already owns strict complete-page replacement, exact affected-page-set enforcement, non-mutation, and full post-patch revalidation. What it lacked was a closed spatial reference authority for the affected pages.

## Implemented behavior

### Closed eligibility and exact targets

- Only `DraftAuthorityReferenceIssue.code === page_spatial_reference_outside_zone` is admitted.
- Every issue must carry the exact `page_spatial_selection` reference class and a `page_spatial_action` locator.
- The only compact field roles are the four roles represented by the strict draft-page schema: `subject`, `object`, `spatialEffect.target`, and `spatialConstraint.target`.
- Final-only `safetyConstraints.target`, mixed families, malformed locators, missing authority, and all other failures retain the prior full-draft or terminal route.
- Typed `pageNumber`, `actionIndex`, and the closed field-role union select the target. Rejected authored values, raw prose, fuzzy matching, and story-specific IDs never select repair scope.

### Compiler-owned spatial authority

- The compiler captures the exact page-to-zone-to-spatial-node projection at `assertPageSpatialReferenceDomains`, after Set Board projection has populated the effective zone authority.
- Every affected page must resolve uniquely to one zone and a non-empty, unique set of `{id, kind, description}` spatial references.
- The compact payload includes complete affected page contracts, typed targets, and only the permitted spatial references for each exact page zone.
- The prompt directs the provider to preserve action meaning, copy only an exact permitted spatial ID when retaining a spatial reference, never change `zoneId`, and never invent an ID.
- Patch application remains exact-set, complete-page, clone/non-mutating, and followed by the complete compiler, authority, semantic, feasibility, and candidate checks.

### Authority cutover

- Page-contract repair system/user prompts: v3.
- Visual Contract authoring request/receipt/readiness: v13/v16/v14.
- Canonical live-request materialization/verification: v11/v11.
- Canonical Execution Request/readiness: v10/v10.
- Canonical Pre-Live Readiness evidence: v10.
- Immediately prior request v12, receipt v15, readiness v13, and their dependent outer authorities are legacy/immutable and cannot authorize a new attempt.
- Draft schema v13, page repair schema v1, candidate v7, Blueprint v4, Wizard and render contracts are unchanged.

## Invariants preserved

- No prompt/schema/model/service-tier/reasoning change outside the compact repair prompt authority.
- The `64,000` input ceiling, one initial call plus at most two repairs, timeout, zero transport retries, no fallback, `$4.884` conservative reservation, and `$5.00` hard ceiling are unchanged.
- No Source Evidence, Action Semantic Catalog, recurring-prop, Set Board, Blueprint, Wizard, candidate, or render acceptance rule was weakened.
- No raw prompt, provider response/message, validator prose, stack, credential, executable, or shell surface is persisted or introduced.

## Validation evidence

### Focused compiler and lifecycle

- Direct compact routing, authority projection, sanitization, tamper rejection, non-mutation, and ceiling coverage: **4 files / 96 tests PASS**.
- Full Visual Contract source-authority lifecycle after the final cutover: **1 file / 52 tests PASS**.
- Canonical live boundary, Pre-Live Readiness, Execution Request materialization, Supervisor, and live-request materialization under the repository's two-worker resource bound: **5 files / 233 tests PASS**.
- Deterministic `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS before each implementation commit.

The calibration regression reconstructs the exact five typed page/action positions from the consumed attempt and proves the router emits only pages 1, 2, and 4. The compact prompt plus strict repair schema remain below `64,000` with more than `4,096` conservative units of headroom and do not contain the full authoring-facts block.

### Single literal repository gate

`npm run check` ran exactly once after focused and TypeScript PASS. It completed in `135.5 s` and was not retried.

- Canonical inventory: **287 files** — **268 ordinary**, **19 resource-intensive**.
- Resource-intensive phase: PASS, exit `0`, `96,383 ms`, two workers, valid diagnostic protocol, zero assertion/timeout/RPC/IPC/reporter/launch/signal/teardown/protocol failure.
- Ordinary phase: exit `1`, `34,316 ms`, four workers, exactly the six established missing ignored-output fixture assertions and no seventh failure.
- The six failures remain the separate repository/release HOLD in `child-lexicon-ages-5-8`, `momentum-gate-koko`, `page-entity-qa`, `set-appearance-ref-budget`, and two `story-read-back-validation` assertions. This implementation neither causes nor waives them.

## Rollback

Revert `bc2c1311` and `3d92615b` in reverse order. Historical artifacts remain byte-immutable. The prior behavior returns: this closed issue family can only reach whole-draft repair and may stop locally at the unchanged input ceiling.

## Limitations and next action

- Independent Claude Code technical QA is pending; Codex does not self-award independent PASS.
- No Fresh Readiness or live authority exists for this local head.
- After independent technical PASS and an explicit push, create Fresh Readiness on the exact pushed head, then run one bounded authoring attempt.
- Candidate success must still traverse Semantic Reconciliation, Blueprint feasibility, Wizard qualification, render pricing, and a separately authorized one-page `gpt-image-2` LOW portrait render.
- This milestone grants no product, visual, candidate, Blueprint, Wizard, render, release, deployment, or push acceptance.
