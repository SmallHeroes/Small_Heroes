# R1D — Compound Page Repair Canonical Context

**Status:** approved by Guy's standing attempt-2 continuation authority on 2026-08-16
**Base:** `a43f2d5dafe2edb6f771721d17bdf1c426ceb4ce`
**Branch:** `codex/r1d-compound-page-repair-canonical-context`

## Decision

Route the already-approved closed union of action-binding cardinality and
page-spatial-reference issues through the existing complete-page compact repair
when the compiler can prove the targets against its own canonical page view.
The repair planner must not reject that authority merely because the provider's
raw page topology was canonicalized in memory or because an unrelated action
field prevents construction of the narrower field-patch `actionContext`.

## Evidence and root cause

The exhausted attempt-2 authority completed one provider response and produced
four sanitized typed issues: three
`coverage_action_binding_cardinality_invalid` locators on pages 7 and 8, plus
one `page_spatial_reference_outside_zone` locator on page 10. The compiler
already owns a compound `page_contract_patch` for exactly this two-family
union, but the planner returned no authority and the lifecycle stopped with
`draft_authority_reference_domain_invalid` before any repair.

The validation boundary inspects page contracts after `canonicalizeTopology`,
while the repair planner currently rechecks the canonical spatial authority
against the raw provider draft. A valid raw alias can therefore disagree with
the compiler-owned canonical zone identity. The compound planner also obtains
its spatial target through `pageSpatialReferenceRepairTargets`, which requires
the full `actionContext` used by the narrower field-only prompt even though the
complete-page prompt never consumes that context. Either mismatch can turn a
closed repairable union into a terminal fallthrough.

## Nine architectural decisions

1. The existing typed issue catalog and exact two-family eligibility remain the
   only authority for this route; no prose parsing or new issue family is added.
2. `DraftAuthorityReferenceDomainError` may carry a deep-cloned canonical page
   repair view in memory only. It is never persisted in receipt/readiness
   evidence and never contains provider output outside the already-held draft.
3. The compound planner validates page number, target index, field role,
   spatial-reference shape, canonical zone authority, non-empty unique
   permitted spatial identities, and duplicate-target rejection.
4. The complete-page compound planner does not require field-patch
   `actionContext`; the field-only spatial repair path keeps that stricter
   requirement unchanged.
5. Repair output remains a complete affected-page response under the existing
   schema, but local application remains target-scoped: only exact beat bindings
   and exact spatial fields may change. Provider drift elsewhere is ignored or
   rejected by existing guards.
6. Raw topology aliases are never trusted as authority. Planning uses the
   compiler-owned canonical page view; application still targets the original
   draft by page/index and the full compiler reruns after every patch.
7. Model, Responses API, service tier, prompts, JSON schemas, 64K ceiling,
   one-initial/two-repair budget, optional terminal cleanup policy, timeout,
   zero transport retry, no fallback and `$4.99125/$5.00` ceilings do not
   change.
8. Regression coverage must prove canonical-zone alias handling, adjacent
   malformed action context, exact target application, invalid/stale authority,
   duplicate targets, non-mutation, and an end-to-end initial-response repair.
9. The lifecycle/version authority advances because repair selection changes.
   Historical artifacts remain immutable and cannot authorize a new attempt.

## Acceptance criteria

- The observed typed union deterministically selects one
  `page_contract_patch` instead of terminal fallthrough when exact canonical
  target authority exists.
- Canonical topology and unrelated malformed context no longer block planning,
  but missing/duplicate/stale page, zone, action, coverage or spatial authority
  still fails closed.
- No raw prompt, response, provider message, exception prose, stack or secret is
  persisted.
- Focused compiler/lifecycle/materialization/Supervisor tests, deterministic
  TypeScript and `git diff --check` pass. One repository gate is run after the
  focused surface is green; the known ignored-output fixture HOLD remains
  separate.

## Rollback

Revert the focused implementation and authority-cutover commits. This restores
the prior terminal behavior without rewriting any historical output artifact or
changing downstream candidate/render state.

## Exclusions

No credential access, pricing/provider call, Fresh Readiness, preflight, live
authoring, image/Vision, render, storage/database, QA deployment, Production or
release action is authorized by this implementation milestone.
