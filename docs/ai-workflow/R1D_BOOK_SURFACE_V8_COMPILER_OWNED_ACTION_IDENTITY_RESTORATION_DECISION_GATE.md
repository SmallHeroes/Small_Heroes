# R1D Book Surface v8 — Compiler-Owned Action Identity Restoration Decision Gate

**Date:** 2026-08-18
**Owner:** Guy (product intent and spend/render approval), Codex (technical design and implementation)
**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`
**Base:** `371a7bdcea15491d412e75a1b3323fe41b11294f`

## 1. Proposed change

Keep Book Surface action semantics provider-writable by existing action index, but make compiler-owned binding identity non-provider output authority. Before atomic application, the compiler restores each exact ordered `beatId` and any existing `source_phenomenon` Source Evidence subject from the validated Book Surface authority. Existing cardinality, ordering, stale-authority, non-target drift and full-template validation remain unchanged.

Book Surface schema remains v6. Its system and user prompt authorities advance from v7 to v8 to state the exact semantic/index contract. The current authoring and canonical execution authority chain advances because it binds those prompt versions and digests.

## 2. Why now?

The sole v7 canonical attempt under `outputs/r1d-booksurface-v7-lifecycle-fresh-371a7bdc-20260818T090537741Z` failed closed after three completed provider calls. Receipt `b1119ee62546de204086f2df561ec573b01c6b7a57e1078f62ba7bf76410a83f` records route `initial -> page_spatial_reference_patch -> book_surface_patch` and exact repair-output identity `book_surface_repair_action_binding_changed`. No Candidate or render authority exists.

The provider had enough authority to repair action semantics, but was still required to echo compiler-owned identity bytes exactly. That paid echo surface is unnecessary and blocked the approved full-book LOW render.

## 3. Scope

This is a general compiler and canonical-authority correction. It is not specific to Dini, one child, one page, or one story. It applies to every Book Surface repair where `actionRequirements` is an authorized writable field.

## 4. Risk of hardcoding

No story, page, action predicate, Source Evidence value, or generated identifier is hardcoded. Restoration is derived only from the already-validated ordered Book Surface authority for the current draft. A different action count, malformed action record, stale authority, invalid source identity or unrelated drift still rejects.

## 5. Files affected

- `lib/visual-contract-compiler/bookSurfaceRepair.ts`
- authoring/canonical materialization, execution, Supervisor and Fresh version constants
- focused Book Surface, lifecycle and authority-chain tests
- this Decision Gate, implementation evidence and `CURRENT.md`

No image-generation, renderer, pricing, model, tier, timeout, retry, fallback, candidate, payment or deployment implementation changes are included.

## 6. Expected behavior after change

- A provider may repair semantic fields for the exact existing ordered action slots.
- Provider-returned `beatId` values are ignored and replaced with the exact compiler-owned ordered bindings.
- For an existing `source_phenomenon` action, the exact compiler-owned Source Evidence subject is restored before validation and apply.
- Action count or record-shape drift still fails through the existing closed binding guard.
- `actionSemanticCoverage` remains absent from provider output and is never rewritten by this lane.
- Full compilation and validation remain mandatory before Candidate persistence.

## 7. Validation plan

Minimum technical proof:

1. Direct applier test: hostile replacement beat/source identity is restored; semantic repair applies; input remains immutable.
2. Direct negative: missing actions still produce `book_surface_repair_action_binding_changed`.
3. Lifecycle test: a schema-valid/final-invalid `looks_at` action is repaired; the response returns a forged beat; the compiler restores the original binding; full revalidation persists a Candidate in exactly two calls/one repair.
4. Existing mixed/repeated Book Surface, route admission, lifecycle, tamper and version-cutover suites remain green.
5. Deterministic TypeScript and `git diff --check` pass.
6. Claude Code performs independent read-only adversarial review of the immutable implementation range.
7. Only after PASS: brand-new Fresh package and at most one bounded live authoring attempt. A valid Candidate is mandatory before render.

## 8. Cost impact

Implementation and tests cost $0 and perform no provider or image calls. After independent PASS, one bounded canonical authoring attempt is authorized under the unchanged hard `$5` fence. If and only if it yields a valid Candidate, Guy has explicitly authorized one full-book LOW render today. No HIGH or production render is authorized.

## 9. Rollback plan

Revert the focused v8 implementation commit. Historical v7 request/receipt/readiness and downstream canonical artifacts remain immutable and cannot be rewritten or promoted as current authority.

## 10. Review assignment

Guy approved uninterrupted progress to a visible book, including the bounded authoring attempt and full-book LOW render after Candidate. Claude Code must try to falsify ordering/cardinality preservation, source-phenomenon identity restoration, semantic-authority boundaries, coverage immutability, atomic failure, full revalidation and the complete current/legacy version cutover.

Claude Cowork review is not required because this milestone changes no product, story, visual or UX choice.

## 11. Do not do

- Do not accept action count, order or coverage drift.
- Do not let the provider author compiler-owned beat or Source Evidence identity.
- Do not bypass full validation, Candidate persistence, spend gates or `$5` fence.
- Do not retry a consumed live root.
- Do not render without a valid Candidate.
- Do not run HIGH, production deployment, payments or product acceptance.
