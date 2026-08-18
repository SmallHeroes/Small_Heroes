# R1D Book Surface v7 Lifecycle Context and Failure Identity — Decision Gate

**Date:** 2026-08-18
**Owner:** Codex (technical)
**Product authority:** Guy explicitly authorized the shortest safe path through
technical correction, one justified bounded live attempt, and a full-book LOW
render today without further product questions
**Base:** pushed `bbb8afd7f9ebdd7f24c61bbd19a3c2f18afd7e9a`
**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`
**Status:** approved implementation; local validation complete; independent QA pending

## 1. Observed failure

The sole v6 canonical attempt under
`outputs/r1d-booksurface-v6-fresh-bbb8afd7-20260818T081428231Z`
ended fail-closed and was not retried. Receipt v36
`03029a6d3aa7d203aac22af8edc5c63d8e685221c3d767ba1b88a37d8d10c8cd`
records three completed provider calls, two repairs, zero transport retries and
no fallback at `$1.207983 / $1.328794` nominal/conservative cost.

The route was `initial -> page_spatial_reference_patch -> book_surface_patch`.
The first repair cleared nine spatial-reference identities and exposed 128
emissions / 25 unique identities: eleven presentation gaps, cover, recurring
prop lifecycle and twelve page structural identities. The v6 Book Surface input
was 43,192 bytes and the provider completed its response, but the compiler
rejected the repair locally before revalidation. The terminal is
`repair_output_invalid`; no Candidate, reconciliation, Blueprint, Wizard or
render authority exists.

The artifact boundary proves that the response reached the atomic applier but
does not persist raw provider content or the raw exception. Three new v5/v6
Book Surface guard identities were absent from the closed repair-output
diagnostic enum, so the otherwise sanitized receipt recorded `unclassified`.

## 2. Root cause and approved correction

The lifecycle repair asked the provider to choose `firstRevealPage`, while its
compact prompt supplied only current per-page pre-reveal obligations. It did
not provide the complete, prose-free relationship between each recurring prop,
its current reveal, every page that forbids it and every page that requires it.
The provider therefore lacked the exact information needed to choose a repair
that the compiler's unchanged lifecycle validator could prove.

Book Surface v7 adds a compact read-only lifecycle context for each recurring
prop:

- `propId`;
- `currentFirstRevealPage`;
- sorted `forbiddenPageNumbers`;
- sorted `requiredPageNumbers`.

The context is derived only from the current draft, included only when recurring
props are writable, excluded otherwise, recomputed at application time and
compared canonically before any mutation. It contains no Story Source prose,
validation message, state description, anchor or credential material. The
provider must keep all pre-reveal pages forbidden and may not place a required
page before the chosen reveal. The existing effective-book lifecycle validator
remains the final authority.

The v7 prompt also explicitly requires preserving every existing
`sourceEvidenceId` in writable action requirements. Action count, ordered beat
IDs and the full compiler-owned action/coverage binding remain unchanged and
atomically checked.

The closed repair-output identity domain adds:

- `book_surface_repair_action_binding_changed`;
- `book_surface_repair_action_binding_stale`;
- `book_surface_repair_lifecycle_obligation_invalid`.

The first two map to `target_identity_invalid`; the lifecycle identity maps to
`recurring_prop_invalid`. Unknown errors still collapse to `unclassified`.

## 3. Authority cutover

The response shape does not change, so Book Surface schema remains v6. System
and user prompt authority advance to v7. Repair-output diagnostics advance to
v3, preserving v2 and v1 as read-only legacy domains.

Current versions advance to:

- authoring request/receipt/readiness: v33/v37/v35;
- B0 input/manifest/verification: v22/v31/v31;
- execution materialization input/result: v21/v25;
- Supervisor request/readiness/result: v30/v30/v23;
- Fresh Readiness: v30.

Unchanged: draft v15, Page Contract v2, Structural Bundle v3, Book Surface
schema v6, authoring policy v12, standard output budget v2, Candidate v9,
OpenAI evidence v6, child-output authority v1 and QA bridge v2. Immediate
authoring predecessors v32/v36/v34 remain immutable legacy authority.

## 4. Safety and exclusions

Unchanged:

- complete assembly and validation; no issue waiver;
- exact causal writable-field and non-target drift enforcement;
- model `gpt-5.6-sol`, default tier, medium reasoning;
- standard 3 calls / 2 repairs and `[40000, 32000, 36000]` output caps;
- zero retries, no fallback, 20-minute timeout and hard `$5` fence;
- Story Source, creative semantics, style, Candidate, render and deployment
  contracts.

Rejected alternatives: blind retry of v6, widening repair count/budget, raw
provider-response persistence, raw validation prose, weakening lifecycle or
binding guards, story/page-specific patches, and deterministic invention of
visual semantics.

## 5. Acceptance before new spend

1. exact lifecycle context round-trips through the compact prompt and is absent
   when recurring-prop repair is not authorized;
2. context tamper, action rebinding, Source Evidence drift and lifecycle
   regression reject atomically without mutating input;
3. all three formerly unclassified identities are closed and mapped to stable
   failure codes with current/legacy diagnostics tests;
4. live-shaped lifecycle and routing suites preserve calls, repair counts,
   output caps, full revalidation and Candidate semantics;
5. every current/downstream version and immediate-predecessor rejection is
   tested;
6. focused tests, deterministic TypeScript and diff-check pass;
7. Claude Code independently reviews the immutable implementation range.

Only after push and independent PASS may a brand-new Fresh package be created.
At most one canonical live authoring invocation may run for that pushed HEAD.
A full-book LOW render is allowed only if the run produces a valid Candidate
and downstream render authority. No HIGH render, deployment or production
promotion is authorized.

## 6. Rollback

Revert the focused implementation/evidence commits. Never reuse Fresh or live
artifacts from another HEAD. Historical artifacts remain immutable; there is
no database, storage or production rollback.
