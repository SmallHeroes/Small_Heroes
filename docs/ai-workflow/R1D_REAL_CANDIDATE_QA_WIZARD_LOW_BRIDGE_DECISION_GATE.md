# R1D Real Candidate -> QA Wizard -> LOW Bridge — Decision Gate

**Date:** 2026-08-17

**Last reconciled:** 2026-08-25

**Status:** accepted for implementation under Guy's standing instruction to continue autonomously until a real Wizard render proof; exact approvals of unseen artifact contents remain mandatory checkpoints

**Current implementation base:** `3c6c04ceeb569fab17b749867121621cbba81016`

**Branch:** `codex/r1d-qa-wizard-downstream-lifecycle`

**Worktree:** `C:\GNart\Work\sh-live-chameleon-v3`

## 1. Proposed change

Add the smallest QA-only orchestration bridge that consumes a real persisted Visual Contract candidate and carries it through the repository's existing Source Prompt Reconciliation, Blueprint, Visual Package publication, Wizard freeze, Style01 qualification, and staged LOW render boundaries. The bridge must exercise the same immutable authorities the normal Wizard consumes; it must not substitute fixtures, manually inject frozen authority, or treat a measurement runner as product-path proof.

## 2. Why now / observed root cause

The Visual Contract authoring route is now independently QA-passed and Fresh Readiness is green, but a candidate still cannot honestly reach the normal Wizard. `run-r1d-wizard-low-full-book-measurement.ts` synthesizes a Visual Package fixture and manually supplies frozen authority. Production lifecycle commands stop at zero-write plans, Blueprint authoring has no operator-connected live adapter, and the repository has no approved v5 package locator that `ensureFrozenVisualContract` can select. Another paid authoring attempt before this bridge exists could produce a valid candidate that remains unusable by the Wizard.

## 3. Scope and stop-check

- General lifecycle tooling for every Story Source; no story, child, companion, page, or style literal.
- Immutable local QA evidence first. The real Wizard reads only the canonical
  `visual-packages/approved` locator, so the eventual approved revision must be
  published there on this feature branch with compare-and-swap protection and
  then exercised through a Preview deployment. Production aliases and the live
  Production deployment remain untouched.
- Implementation and offline validation cost `$0`.
- Later spend is bounded independently: Blueprint text authoring has its own
  `$5` fence; Visual Contract v18 has its existing `$10` fence. Image proof uses
  `gpt-image-2` LOW. Guy has authorized one complete book after the real frozen
  path is proven, without re-rendering already accepted assets.
- The smallest honest image stage is not literally one provider call: the real
  Stage 0 may create bounded identity anchors, followed by cover and page 1.
  The proof therefore records every dispatch and asset, stops before unbounded
  continuation on uncertainty, and resumes only for missing pages.
- Product acceptance remains Guy's. Claude Code must independently falsify the implementation before any provider or image spend.
- Claude Cowork is not required for this technical bridge; exact semantic and visual reviews remain Guy checkpoints.

## 4. Nine architectural decisions

### Decision 1 — reuse the canonical authority chain

The bridge reuses candidate v9, `source-prompt-reconciliation/v2`, reconciliation review bundle v2, production authoring context v3, Blueprint v4 and its v3 lifecycle artifacts, Visual Package v5 and its v3/v4 lifecycle artifacts, current locator v3, frozen package authority v3, and Style01 runtime authority v6. It adds only QA orchestration evidence/ledger v1. Historical artifacts remain immutable.

### Decision 2 — Reconciliation is an exact semantic checkpoint

The bridge deterministically builds and persists a reconciliation draft and review packet from the exact candidate, Story Source, source snapshot, and template. It cannot advance until Guy approves the exact completed semantic choices, citations, and digest. A boolean shortcut, inferred approval, or Codex self-signature is invalid.

### Decision 3 — consume only a canonical Supervisor candidate

The bridge accepts only a candidate and receipt produced by the existing canonical Supervisor authoring boundary. It does not load credentials, call a Visual Contract provider, reinterpret raw provider text, or create a second authoring path. Candidate identity, request policy, receipt exhaustion state, source snapshot, and repository authority are verified before downstream work.

### Decision 4 — Blueprint authoring uses existing lifecycle primitives

After approved reconciliation, the bridge constructs production authoring context v3 and invokes the existing `runProductionBlueprintAuthoring` lifecycle through an explicitly injected canonical Responses adapter. It persists the existing Blueprint candidate, provenance, validation, review packet, and review markdown shapes. No alternate camera, staging, action, or layout authority is introduced.

### Decision 5 — exact Blueprint and review approval remains separate

Guy's approval binds the exact Blueprint digest, context, authoring authority, validation, and review content. The consolidated downstream checkpoint may also carry the proposed package review fields, but Blueprint approval does not itself approve a package, qualify the Wizard, or authorize rendering.

### Decision 6 — Board and recurring-prop authority are read-only dependencies

The bridge validates existing Board, Set Identity, recurring-prop, and geometry authorities. Missing, stale, contradictory, or unapproved dependencies fail closed. It cannot mint, mutate, import, approve, or force-fit Board entries, and it cannot replace recurring props with fixed architecture.

### Decision 7 — publication is branch-local canonical promotion

The bridge assembles and qualifies a real Visual Package v5 using existing lifecycle functions. Only after Guy approves the exact package review, `worldMode`/reality conclusions, Blueprint binding, and promotion digest may it persist an immutable package revision and compare-and-swap the canonical current locator on this feature branch. A parallel QA registry would not prove the real Wizard. Production deployment state remains out of scope until a separately verified Preview deployment is requested.

### Decision 8 — the proof crosses the real Wizard freeze

Qualification must call `ensureFrozenVisualContract` and `requireStyle01RenderQualification` against the published QA locator, then bind the exact frozen revision to a fresh QA order. The provider seam is blocked during the dry-run. The first paid proof is one portrait LOW page through the actual Wizard path; after visual acceptance, the remaining pages render once each under the same frozen authority and ledger.

### Decision 9 — fail-closed evidence, idempotency, and rollback

Content-addressed QA bridge manifest/ledger v1 binds all input digests, approvals, package/locator revisions, frozen authority, page set, provider counts, and cost. Stale, legacy, missing, duplicate, path-escaping, or tampered artifacts fail closed. Evidence never stores raw prompts, raw responses, provider messages, secrets, credentials, or stacks. Failures do not retry or fall back silently.

## 5. Likely files and commit boundaries

1. Reconciliation bridge and checkpoint: new QA bridge module/CLI and focused tests around existing reconciliation builders and persistence.
2. Blueprint operator adapter and persistence: canonical Responses adapter injection, bounded policy tests, and exact approval ingestion.
3. Package publication and real Wizard freeze: v5 QA registry publication, locator selection, freeze/runtime-v6 dry-run, Board/prop guards, and tests.
4. Staged LOW runner and evidence: one-page / remaining-pages ledger semantics, CURRENT/evidence, and independent-QA handoff.

Core v2/v4/v5/v6 validators are not changed unless investigation proves a serialized-shape defect. `package-lock.json` and dependency versions remain unchanged.

## 6. Expected behavior

A real candidate can be inspected and semantically approved, authored into an exact Blueprint, reviewed/promoted as an immutable QA Visual Package, selected by a real fresh Wizard order, frozen once, qualified through runtime v6, and rendered at LOW without any manual authority injection. Any missing authority stops before image spend. Identical reruns are idempotent; changed inputs invalidate downstream state.

## 7. Validation and acceptance criteria

- Exact version/digest/path binding and tamper rejection at every edge.
- Incomplete reconciliation cannot advance; no forged Guy approval.
- Blueprint approval cannot imply package approval; package approval cannot bypass Wizard qualification.
- Existing Board/prop gaps fail before publication or render.
- QA locator update is separate from immutable revision persistence; frozen orders never reread a mutable locator.
- A provider-blocked dry-run exercises catalog resolution -> `ensureFrozenVisualContract` -> `requireStyle01RenderQualification` for all page references.
- LOW ledger proves one call for the first page and exactly the not-yet-rendered pages afterward; duplicates/stale authority are rejected.
- Sanitization census proves no raw prompt/response/provider text/secret/stack.
- Focused tests, deterministic TypeScript, `git diff --check`, one repository check, and independent Claude Code PASS.

## 8. Cost boundaries

- Implementation, fixtures, publication dry-run, and Wizard qualification: `$0`.
- Blueprint authoring uses its independent current-price policy: OpenAI Responses,
  `gpt-5.6-sol`, default tier, medium reasoning, 64K input, 48K output,
  3 calls / 2 repairs, zero retries, no fallback, and a `$5.00` hard ceiling.
- A later Visual Contract attempt retains policy v18: the existing model/tier,
  64K input ceiling, seven standard calls / six repairs plus one already-bounded
  terminal cleanup call, zero transport retries, no fallback, and a `$10.00`
  hard ceiling.
- Image proof: `gpt-image-2` LOW through the real Wizard worker. Stage 0,
  cover and page 1 are measured first; the rest of the book may continue under
  the same frozen authority and append-only ledger, and accepted assets are not
  rendered twice.

## 9. Rollback

Before publication, revert the bridge commits and delete only the new ignored QA output root after inventory review. After publication, never rewrite historical immutable revisions: restore or remove only the QA current locator, leave the unreferenced revision auditable, and create a fresh order rather than mutating frozen authority. No production or database rollback exists because neither is touched.

## 10. Rejected alternatives

- Treating the synthetic full-book measurement runner as Wizard proof.
- Auto-approving reconciliation, Blueprint, review reality, or package promotion.
- Calling image generation directly from the bridge.
- Rewriting historical artifacts or adding story-specific fallbacks.
- Creating parallel core schema versions without a demonstrated serialized-shape need.
- Spending on a full book before one-page real-path proof.

## 11. Explicit exclusions

No Production deployment or alias, Board mutation, raw credential handling
outside the canonical child, retry/fallback expansion, unapproved exact content,
or release acceptance. A fresh QA order, QA database state, fake payment,
Preview deployment, bounded text-provider execution and one complete LOW book
are authorized only after their offline lifecycle, independent QA and exact
artifact approvals have passed.
