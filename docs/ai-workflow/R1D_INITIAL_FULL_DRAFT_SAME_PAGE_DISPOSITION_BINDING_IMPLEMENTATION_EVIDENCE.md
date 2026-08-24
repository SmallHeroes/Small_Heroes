# R1D Initial/Full-Draft Same-Page Disposition Binding — Implementation Evidence

**Date:** 2026-08-24

**Branch:** `codex/r1d-chameleon-v3-live-authoring`

**Decision:** Guy approved the offline-only Decision Gate.

**Cost/render allowance:** `$0`; no provider, credential, live, Candidate
persistence, Wizard mutation, image, audio or render.

## Requirement and measured cause

The last paid attempt stopped before Candidate creation. Its immutable receipt
contains a complete initial census of 21 unique issues:

- 8 `final_structural_invariant_invalid`;
- 5 `represented_elsewhere_pointer_unresolved`;
- 4 `represented_elsewhere_pointer_out_of_scope`;
- 3 `closed_catalog_capability_gap`;
- 1 `represented_elsewhere_value_mismatch`.

Initial/full-draft structured output still required raw `contractPointer` and
`contractValue` fields. The provider therefore owned an address that the
compiler could derive and verify locally. This milestone removes that
authority mismatch before another paid attempt.

## Implementation

### Provider wire versus canonical internal form

The v21 initial/full-draft wire schema uses:

- `{ kind: "represented_elsewhere", representedValue }`;
- `{ kind: "presentation_requirement", presentationClass, mustShowIndex }`.

Neither branch contains `contractPointer` or provider-authored
`contractValue`. The page-contract, structural and other narrow repair schemas
retain their existing canonical pointer/value representation because those
routes already receive compiler-bounded target authority.

The initial prompt is v19 and the full-draft repair prompt is v16. Both state
that represented values must occur exactly once in the permitted same-page
structured domain and that presentation selects a zero-based `mustShow`
ordinal.

### Compiler-owned materialization

`bindInitialFullDraftSamePageDispositions` clones the provider response before
changing it. It removes Action Semantic Coverage from the lookup projection so
a selector cannot bind to itself, then uses the existing validator-owned
`permittedRepresentedElsewherePointerValuesForPage` projection.

A represented value binds only when:

1. the page number is a unique safe integer in the returned draft;
2. the disposition has the exact wire keys;
3. exactly one permitted same-page pointer has the exact value.

A presentation selection binds only when its exact wire shape has a closed
class, a non-negative safe integer index, and that index resolves to a string
in the same page's `mustShow`. The compiler writes both final pointer and value.

Invalid, ambiguous and provider-authored legacy pointer shapes are replaced by
compiler-owned non-resolving sentinels. Existing complete validation then
emits the closed pointer failure family and can route a bounded repair; no
Candidate can be minted from a sentinel. Only bounded aggregate counts enter
normalization notes—never raw source values, pointers, prompts or responses.

### Authority version boundary

Changed current authority:

- draft schema v20 -> v21;
- initial system prompt v18 -> v19;
- full-draft system prompt v15 -> v16;
- authoring request v49 -> v50;
- receipt v51 -> v52;
- readiness v49 -> v50;
- live-request materialization input v38 -> v39;
- live-request manifest/verification v47 -> v48;
- canonical pre-live evidence v43 -> v44;
- execution materialization input v34 -> v35 and result v38 -> v39;
- execution supervisor request/readiness v43 -> v44 and result v36 -> v37.

The immediately prior request/receipt/readiness versions are explicitly
classified `legacy_immutable`. No existing artifact is rewritten.

## Falsification evidence

The offline tests prove:

1. exact represented values and must-show ordinals materialize the expected
   canonical same-page pairs without mutating input;
2. a selector cannot self-bind or bind across pages;
3. duplicate same-page values fail closed rather than selecting the first;
4. negative, fractional, string and out-of-range ordinals fail closed;
5. a provider-authored raw pointer shape is discarded;
6. initial and full-draft compile paths both output canonical internal
   pointer/value coverage;
7. the production offline harness reaches Candidate in one initial call with
   zero surfaced/complete issues, no repair and `providerCalls: 0`;
8. a residual unmatched value still routes through the existing bounded repair
   path without issue growth;
9. all real provider schemas satisfy the strict OpenAI compatibility profile;
10. lifecycle and canonical request/readiness boundaries accept only the new
    current versions while preserving prior immutable evidence.

## Schema and input-ceiling census

The serialized v21 draft schema is 13,977 bytes, digest
`82f8c6dbb51c2bacea8265eef33b6cb2f9fb2ba76be8dea516344204966a88d6`.
All QA sources and all 18 approved Story Sources remain below the unchanged
64K input ceiling without provider reachability. Exact approved controls:

- `fox_uri_adventure`: 49,995 units; 14,005 headroom;
- worst approved source `lion_shaket_fantasy`: 53,419 units; 10,581 headroom.

Model, provider, service tier, output budgets, call count, repair count,
transport retries, no-fallback policy, cost ceiling, catalogs, Story Sources,
visual packages, locators, Boards, Wizard and renderer are unchanged.

## Validation

Completed locally:

- binding/schema hostile suite: 9/9;
- focused compiler/schema/compatibility group: 135/135;
- offline harness plus repair loop: 57/57;
- source-authority lifecycle: 102/102;
- materialization and canonical readiness: 49/49;
- `npx --no-install tsc --noEmit`: PASS.

Repository-wide `npm run check` reaches the dedicated-worktree baseline:

- resource-intensive: 20 files / 611 tests PASS;
- ordinary: 3,579 pass, 70 skipped, 10 failures;
- 9 failures read ignored historical artifacts absent from this worktree,
  across five unchanged fixture-reading files;
- 1 failure is the unchanged Blueprint-migration assertion exceeding the
  ordinary five-second limit;
- that exact migration suite passes 8/8 in 16.33 seconds with a 30-second
  diagnostic allowance.

No changed file or authority fails. Independent Claude Code review is still
required. This evidence authorizes no Fresh Readiness, provider call, live
attempt, Candidate promotion, Wizard action, render or deployment.
