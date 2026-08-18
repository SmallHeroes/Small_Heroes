# R1D BookSurface Action Cardinality Reattachment — Decision Gate

**Decision owner:** Guy
**Technical owner:** Codex
**Date:** 2026-08-18
**Status:** Approved under the standing instruction to continue through Candidate, Wizard and LOW render without further pauses.

## Problem

The consumed recovery live attempt completed `initial -> page_spatial_reference_patch -> book_surface_patch`, then rejected the completed BookSurface response as `book_surface_repair_action_binding_changed`. BookSurface v8 already restores compiler-owned beat IDs and existing Source Evidence subjects when the provider returns the exact action cardinality. It still rejects the entire atomic surface when a response omits or adds an action, even though the compiler has the complete private binding authority and can safely discard the cardinality drift.

## Decision

Treat action cardinality and binding identity as compiler-owned echo state:

- preserve the exact original action count and order;
- when response cardinality matches, retain the existing index-based semantic patch behavior and restore each beat ID;
- when cardinality differs, accept only a unique response action carrying an existing exact beat ID for that authority index;
- fill every missing/unmatched authority index from the original action and discard extra/unrecognized response actions;
- reattach every existing `source_phenomenon` subject exactly;
- reject an unbound provider attempt to introduce `source_phenomenon` by restoring the original subject;
- never alter `actionSemanticCoverage`;
- run the complete existing BookSurface containment checks and full compiler validation after restoration.

The compiler does not invent an action, predicate, subject, object or story fact. It preserves the last valid authority when the provider omits or adds an unbound action.

## Scope and unchanged behavior

Production scope is limited to `bookSurfaceRepair.ts`. Direct unit and compiler/lifecycle regressions may change. No JSON schema, prompt text, model, service tier, reasoning, call/output budget, hard USD 10 fence, retry, fallback, Candidate, Wizard, style or render version changes.

The consumed requests `9d28d522...` and `51dcc7e5...` are terminal and will not be reused. A new Fresh/Execution Request is required after a focused green commit/push.

## Validation

1. Exact-count beat and Source Evidence restoration remains unchanged.
2. Missing action is restored from authority; a recognized sibling semantic repair is retained.
3. Extra/unrecognized action is discarded.
4. Unbound `source_phenomenon` introduction restores the original subject.
5. Malformed action objects, stale authority, non-target drift and invalid final semantics remain fail-closed.
6. Input draft and response patch remain unchanged.
7. BookSurface, repair-loop, lifecycle, canonical-boundary, TypeScript and diff checks pass.

## Cost and exclusions

Implementation cost is USD 0. One new canonical live attempt is permitted after exact Fresh readiness. Wizard and the authorized 12-page QA/non-production LOW render remain strictly gated on a valid Candidate. HIGH, production, deployment and release remain excluded.
