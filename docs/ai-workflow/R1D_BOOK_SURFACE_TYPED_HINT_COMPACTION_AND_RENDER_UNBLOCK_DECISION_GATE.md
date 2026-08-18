# R1D Book Surface Typed-Hint Compaction and Render Unblock — Decision Gate

**Date:** 2026-08-18
**Owner:** Codex (technical)
**Product authority:** Guy explicitly authorized the shortest safe path through a
new bounded live authoring attempt and a full-book render today, without further
product questions
**Base:** pushed `76686edb6d204afb50c373c100a38386abe76a3a`
**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`
**Status:** approved execution brief; implementation in progress

## 1. Observed failure

The sole canonical attempt under
`outputs/r1d-causal-booksurface-fresh-76686edb-20260818T070059265Z`
ended fail-closed and was not retried. Receipt v35
`97016a13d308a31726d199b045e3f1c2c176043249f54d0deb105010af3f8d3c`
records two completed provider calls, one repair, zero transport retries and no
fallback at `$0.900464 / $0.990519` nominal/conservative cost.

The initial draft exposed one page-1 action-binding cardinality issue. The
bounded Page Contract repair resolved it. Full validation then exposed 26
unique identities / 131 emitted diagnostics: twelve presentation gaps, cover,
recurring-prop lifecycle, and all twelve pages with
`page_action_requirements_invalid` structural causes. The final Book Surface
route was not dispatched because its canonical input was 65,769 bytes against
the 59,904-byte route-admission ceiling. The terminal is
`repair_route_input_not_admissible`; no candidate, reconciliation, Blueprint,
Wizard or render authority exists.

All ten content-addressed JSON artifacts recompute exactly, and the persisted
Receipt v35 and Readiness v33 pass their current repository validators with
`write:false`. This is a real prompt-admission boundary, not artifact,
Supervisor, credential, provider-transport or retry failure.

## 2. Root cause

Book Surface v5 already sends the closed causal `repairTargets`, their typed
causes, exact `writableFields`, the current structural projection, and bounded
read-only validator context. It additionally serializes every sanitized raw
validation message into the provider user payload. In the consumed attempt,
those 131 messages duplicate the typed repair authority and push the final
route 5,865 bytes above the immutable admission limit.

The raw messages are necessary inside the compiler for route construction,
diagnostic retention and fail-closed validation. They are not independent
provider authority after causes and targets have been normalized. Sending them
again is redundant prompt prose, increases privacy and input-cost surface, and
can make an otherwise closed route unreachable.

## 3. Approved change

Keep the internal Book Surface authority unchanged and make the provider
boundary a strict causal delta instead of a full-page echo:

- presentation targets remain exact and source phrases remain omitted;
- cover authority retains the exact cover contract and a bounded diagnostic
  count, but not diagnostic prose;
- recurring-prop authority retains the exact recurring props and a bounded
  diagnostic count, but not diagnostic prose;
- every affected page retains its page identity, strict structural projection,
  exact causal repair targets, writable fields and read-only context, plus a
  bounded diagnostic count instead of diagnostic prose; the transmitted
  structural projection contains only page identity and writable fields;
- the provider-facing action-binding context carries only ordered
  `{actionIndex, beatId}` identity already present in the structural projection;
  coverage indexes and Source Evidence IDs remain in the full internal
  authority and are still checked atomically by the applier, but are not
  redundantly serialized to a lane that cannot return coverage;
- reference authority remains exact;
- the prompt explains that typed targets/causes and counts are the repair
  authority and that no validation prose is present.

The v6 response keeps one fixed strict page object for Structured Outputs, but
requires `null` for every non-writable structural field and a non-null typed
value for every writable field. The compiler rejects missing writable values
and non-null overreach, then applies only the causal delta to a clone of the
current draft. This removes the need to resend or echo unrelated page content
without weakening non-target protection.

Book Surface schema/system/user prompt versions advance to v6. The current
authoring request/receipt/readiness become v32/v36/v34; B0 input, manifest and
verification become v21/v30/v30; execution materialization input/result become
v20/v24; Supervisor request/readiness/result become v29/v29/v22; and Fresh
Readiness becomes v29. Candidate v9, policy v12, the standard output budget,
provider evidence, child-output authority and QA bridge remain unchanged.
Historical artifacts remain immutable.

## 4. Safety and unchanged behavior

Unchanged:

- full assembly and validation; no issue waiver;
- exact cause-to-field writable scope and non-target drift guard;
- action count, beat IDs and action/coverage binding preservation;
- presentation pointer/value authority and mustShow freeze;
- read-only context, lifecycle and transition guards;
- model `gpt-5.6-sol`, default tier, medium reasoning;
- standard 3 calls / 2 repairs, `[40000, 32000, 36000]` output caps;
- zero retries, no fallback, 20-minute timeout and hard `$5` fence;
- Story Source, visual semantics, style, anchors, candidate, Blueprint, Wizard,
  render and deployment contracts.

Rejected alternatives:

- raising 64K or removing the 4,096-byte safety margin;
- adding a generic fourth repair or retry;
- lowering validation strictness;
- story/page-specific compression;
- persisting or replaying provider responses;
- changing the visual meaning or deterministically inventing action semantics.

## 5. Validation and acceptance

Before spend:

1. exact v6 decoded payload contains targets/causes/counts/context but no raw
   page, cover or lifecycle validation message;
2. internal authority still retains every sanitized message and rejects blank,
   unsafe, overlong and over-scope input exactly as before;
3. Book Surface schema v6 is strict, compatible and rejects non-null
   non-writable fields, null writable fields, missing/extra/reordered pages and
   malformed values;
4. a 12-page / 131-emission live-shaped fixture is admissible at or below
   59,904 bytes with at least 4,096 bytes additional headroom;
5. exact lifecycle regression follows
   `initial -> page_contract_patch -> book_surface_patch -> candidate` in three
   calls / two repairs with unchanged output caps;
6. hostile output drift, binding mutation, lifecycle regression, malformed
   response and final-slot oversized no-dispatch remain fail-closed;
7. current/legacy prompt and downstream authority versions, digests and tamper
   cases pass;
8. affected focused suites, `npx --no-install tsc --noEmit`, one literal
   `npm run check`, and `git diff --check` complete;
9. Claude Code independently reviews the immutable implementation range before
   new spend.

After push and independent PASS, create a brand-new Fresh Readiness package for
the pushed HEAD. Run at most one canonical live authoring invocation under the
existing hard `$5` fence. If and only if it produces a valid candidate and
downstream render authority, run the explicitly approved full-book LOW render.
No rerun, HIGH render, deployment or production action is implied.

## 6. Stop-check answers

1. General system fix: yes; no story, page, child, companion or style literal.
2. Cross-story risk: prompt detail loss; controlled by typed causes, exact
   context, strict schema and multi-page lifecycle tests.
3. Production behavior: authoring prompt projection changes; runtime render and
   product behavior do not.
4. Spend: implementation/tests `$0`; one later authoring attempt <= `$5`; one
   full LOW render explicitly approved by Guy and still gated on valid authority.
5. Smallest validation: focused prompt/unit/repair-loop/lifecycle/version suites,
   then repository check before any provider call.
6. Product decision: already supplied by Guy; no unresolved creative choice.
7. Claude falsification: missing provider information, forged counts, raw prose
   leakage, schema drift, insufficient real-shaped headroom, route/call-budget
   drift and version-chain gaps.
8. Claude Cowork: not needed; no product/creative/UX decision.
9. Guy eyeball: the completed LOW full book before any HIGH/production action.

## 7. Rollback

Revert the focused Gate/implementation/evidence commits. Never reuse Fresh or
live artifacts created for a reverted HEAD. Historical evidence remains
immutable; no database, storage or production rollback is required.
