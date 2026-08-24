# R1D BookSurface Target Association and Bounded Pointer Selection — Implementation Evidence

**Date:** 2026-08-24

**Branch:** `codex/r1d-chameleon-v3-live-authoring`

**Decision:** Guy approved the offline-only Decision Gate.

**Cost/render allowance:** `$0`; no provider, live, image, audio or render.

## Requirement

Close the BookSurface presentation-target association defect before spending
on another live authoring attempt. A provider response must not be able to
cross-bind one target's presentation choice to another target by relying on
array position, and the provider must select only from compiler-owned pointer
authority rather than author a raw JSON pointer.

## Observed failure and root cause

The bounded live attempt under
`outputs/r1d-chameleon-v3-live-20260824T084303866Z` made two calls and failed
before Candidate creation. Receipt
`b0/authoring-receipts/d3040113341d902cf78c5c2cd4d3928bf01e5465c886361cc535ee597ae911da.json`
records:

- route `initial -> book_surface_patch`;
- 21 complete-census draft issues after the initial response;
- terminal legacy identity
  `presentation_requirement_repair_pointer_not_permitted`;
- nominal cost `$0.965705` and conservative accounted cost `$1.062285`;
- no retry, fallback, Candidate or later live attempt.

The mixed BookSurface path restored returned target identity fields from the
authorized target at the same array position before comparing identities.
Consequently, reordered or forged returned association could be overwritten
before validation. The output contract additionally exposed a free-form
`contractPointer` even though every target already supplied a finite ordered
`permittedPointerValues` set.

## Implementation

### Exact target association

- BookSurface validates the original returned target tuples before any
  compiler-owned cover, prop, action or presentation restoration.
- The returned patch list must be an exact ordered bijection with the target
  list. Missing, extra, duplicate, forged and reordered association fails as
  `presentation_requirement_repair_target_association_invalid`.
- No rejected patch is applied to the source draft.
- The dedicated presentation-only lane retains its pre-existing safe behavior:
  association is identity-keyed and response order is irrelevant.

### Bounded pointer selection

- Provider schema and prompts use integer `pointerChoiceIndex`, minimum zero.
- Raw `contractPointer` is absent from the provider output schema.
- The compiler resolves the ordinal against the exact target's ordered
  `permittedPointerValues`, producing the final compiler-owned pointer/value.
- Invalid/out-of-range choice fails as
  `presentation_requirement_repair_pointer_choice_not_permitted`.
- Invalid presentation class fails separately as
  `presentation_requirement_repair_class_invalid`.

### Persisted diagnostic authority

The three new exact terminal identities require a new immutable authority
version. Current repair-output diagnostics advance v3 -> v4. Authoring request,
receipt, readiness and their canonical materialization/execution wrappers each
advance one version. Immediately prior versions remain readable legacy
authority, and the historical
`presentation_requirement_repair_pointer_not_permitted` identity remains a
closed readable identity for historical evidence under diagnostic v4, but no
current repair route emits it. Association maps to bounded failure code
`target_identity_invalid`; choice and class map to `application_rejected`.

Current contract versions changed by this milestone:

- BookSurface response schema v6 -> v7;
- BookSurface system/user prompts v11 -> v12;
- dedicated presentation response schema/prompt v1 -> v2;
- repair-output diagnostics v3 -> v4;
- authoring request v48 -> v49;
- authoring receipt v50 -> v51;
- authoring readiness v48 -> v49;
- live-request materialization input v37 -> v38;
- live-request manifest/verification v46 -> v47;
- canonical pre-live evidence v42 -> v43;
- execution-request materialization input v33 -> v34 and result v37 -> v38;
- execution supervisor request/readiness v42 -> v43 and result v35 -> v36.

## Falsification coverage

The focused offline suite proves:

1. valid multi-page choices resolve only to each target's compiler-owned
   pointer/value;
2. reversed BookSurface patches reject even when each patch is otherwise valid
   for its own page;
3. missing, duplicate and forged identities reject before mutation;
4. out-of-range choice and invalid class have distinct exact identities;
5. the dedicated presentation lane remains order-independent without
   cross-page binding;
6. provider schemas contain `pointerChoiceIndex` and no raw
   `contractPointer` output field;
7. legacy diagnostic/request/receipt/readiness authority remains readable but
   cannot accept the new identities under an old version;
8. request materialization, canonical readiness and receipt lifecycle bind the
   new versions without credential or provider reachability;
9. the offline harness uses zero provider calls.

## Validation

- `npx --no-install tsc --noEmit` — exit 0.
- Focused adversarial Vitest run — **14 files / 642 tests PASS**.
- Resource-intensive repository partition — **20 files / 611 tests PASS**.
- Ordinary repository partition — **3,569 passed / 70 skipped / 11 baseline
  failures**: nine missing ignored historical fixtures in five unchanged files
  and two unchanged Blueprint-migration assertions exceeding the five-second
  ordinary timeout.
- Blueprint-migration diagnostic rerun with `--testTimeout=30000` — **8/8
  PASS** in 27.26 seconds.
- No changed policy, package manifest or lockfile.

## Files and boundaries

Production changes are limited to BookSurface/presentation repair contracts,
terminal diagnostic authority, authoring lifecycle version bindings and the
canonical request/readiness wrappers. Tests cover each changed authority and
the hostile response shapes. `CURRENT.md`, the approved Decision Gate and this
evidence record are the only documentation changes.

No Story Source, visual package, Board, locator, Wizard UI, renderer, model,
budget, retry, fallback, catalog, provider adapter, package dependency or
credential surface changed. No existing live artifact was rewritten.

## Independent QA falsification targets

Claude Code should attempt to falsify:

- whether BookSurface validates provider-returned identities before every
  compiler-owned restoration;
- whether reordering valid own-target patches can still cross-bind choices;
- whether duplicate/forged identities or a malicious ordinal can mutate a
  draft before rejection;
- whether any provider output schema still exposes raw `contractPointer`;
- whether dedicated presentation repair lost its identity-keyed,
  order-independent behavior;
- whether the three exact persisted identities can be written under legacy v3;
- whether any current/legacy request, receipt, readiness or wrapper version is
  misbound;
- whether any model, budget, call, retry, fallback, Story Source, package,
  Wizard or render policy drifted.

This evidence authorizes no push, provider call, Fresh Readiness, live attempt,
Candidate, Wizard mutation, image, audio, render, deployment or product
acceptance.
