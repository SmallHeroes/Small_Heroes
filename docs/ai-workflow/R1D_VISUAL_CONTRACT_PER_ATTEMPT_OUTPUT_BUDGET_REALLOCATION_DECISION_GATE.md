# R1D Visual Contract Per-Attempt Output Budget Reallocation — Decision Gate

**Date:** 2026-08-16

**Owner:** Guy (product and budget decision), Codex (technical execution)

**Base:** `f2a0624ab38aae5f312e70ca28a5843b6efe8a32`

**Status:** awaiting Guy's approval of the nine decisions below

## 1. Proposed change

Replace the single output-token limit reused by all three standard authoring
attempts with one deterministic, versioned three-attempt schedule. Preserve
the existing total standard-call output pool and reallocate more of it to the
initial full-draft call, where the latest live attempt proved the present limit
can be exhausted.

Also persist each attempt's applied output limit and a closed, sanitized
provider-incomplete reason. This adds proof of cap exhaustion without storing
provider prose.

## 2. Why now?

The latest 12-page call consumed exactly its `36,000`-token output limit and
returned `incomplete`, while a byte-identical prior request completed at
`15,657`. A provider-completion failure is correctly terminal and cannot enter
repair. The current equal allocation therefore spends `$1.250790`, consumes
the only live invocation and produces no candidate even though later repair
allowance was never used.

The problem is allocation, not the 64K input ceiling, repair-output identity,
prompt contents or provider reachability.

## 3. Verified root cause and constraints

- `authoringMaxOutputTokens(pageCount)` yields `36,000` for 12 pages.
- Compiler, lifecycle, materialization and reservation logic reuse that same
  limit for the initial call and both standard repair calls.
- Three standard calls plus terminal cleanup project to `$4.99125` under the
  unchanged conservative policy, leaving no safe room to raise every call.
- Provider completion failures remain terminal and non-repairable.
- The current product policy admits up to 12 pages. Thirteen-or-more-page
  authoring remains outside this gate and unchanged.

## 4. Scope and likely files

This is a general system change. Expected surfaces include the compiler's
authoring options, lifecycle request/receipt/readiness contracts, live request
materialization and verification, Supervisor bindings, Fresh Readiness
versions, the OpenAI Responses adapter, focused tests and technical evidence.

It introduces no story, child, companion, category, page or provider-response
literal.

## 5. Nine architectural decisions for approval

1. **Closed schedule authority.** One canonical pure function derives an exact
   three-entry standard-attempt output schedule from admitted page count. All
   compiler, lifecycle, materialization, verification and Supervisor paths use
   that same authority; duplicate calculations are forbidden.
2. **Unchanged total exposure.** If the existing per-call base is `B`, the
   standard output pool remains exactly `3B`. Model, Responses endpoint,
   service tier, reasoning, 64K input ceiling, standard-call count `3`, repair
   count `2`, cleanup allowance, timeout, transport retries `0`, no-fallback
   policy and hard `$5.00` ceiling remain unchanged.
3. **Deterministic 4:3:2 allocation.** The schedule is initial
   `floor(4B/3)`, first repair `B`, and second repair the exact remainder
   `3B - initial - firstRepair`. For 12 pages this is
   `[48,000, 36,000, 24,000]`; for an admitted 8-page base of `32,000`, it is
   `[42,666, 32,000, 21,334]`. The reallocation deliberately trades second-
   repair headroom for initial-call headroom; it does not hide that trade-off.
4. **Terminal semantics unchanged.** `incomplete` or otherwise invalid provider
   completion remains terminal, ineligible for repair, retry or fallback. The
   larger initial cap changes admission capacity only, not failure routing.
5. **Explicit version cutover.** Request, receipt, readiness, materialization,
   verification, Supervisor and Fresh Readiness authorities advance together
   and bind the exact schedule and its digest. Previous artifacts remain
   immutable legacy evidence and cannot authorize a new attempt.
6. **Per-attempt accounting and tamper binding.** Every attempt records its
   applied output limit. Projected exposure and runtime reservation sum the
   exact remaining attempt-specific caps plus cleanup rather than multiplying
   one shared cap. Schedule length, ordering, values, pool, cost and attempt
   binding fail closed on tampering.
7. **Sanitized incomplete observability.** The OpenAI adapter maps provider
   incomplete details into a closed local enum such as `max_output_tokens`,
   `content_filter` or `other_or_absent`. Only the enum is persisted; raw
   provider body, message, prompt, response, stack and secret remain forbidden.
8. **Proportional proof.** Tests cover admitted 8- and 12-page schedules, exact
   pool and cost preservation, options applied to each standard attempt, every
   repair route, cap-hit terminal behavior, normalized incomplete reasons,
   persistence/reload, tamper rejection, legacy immutability and unchanged
   cleanup behavior. Focused tests, TypeScript and one repository gate precede
   independent Claude Code review.
9. **Fresh authority and separated preflight work.** After independent PASS,
   any live proof uses a new immutable commit, Git probe, Fresh Readiness and
   one bounded live attempt. Durable canonical-preflight attestation is a
   separate follow-up gate required before Blueprint/Wizard/render authority;
   it is not bundled into this output-budget correction and cannot be
   synthesized inside the live runner.

## 6. Expected behavior

For a 12-page story, the initial call can emit up to `48,000` tokens instead of
`36,000`. If it still ends incomplete, the run stops with a durable normalized
reason and exact cap proof. If it completes with an invalid draft, the first
repair retains the former `36,000` capacity. The second repair receives
`24,000`; the total conservative maximum remains `$4.99125`.

No candidate is accepted without all existing validators. A successful
candidate is necessary but not sufficient for Reconciliation, Blueprint,
Wizard or render authority.

## 7. Rejected alternatives

- Raising all three limits or the hard `$5.00` ceiling.
- Adding provider retries, fallback or a fourth standard call.
- Treating an incomplete provider response as a repairable draft.
- Story-specific prompt shortening or removing validated authority fields.
- Using actual spend from an early attempt to opportunistically exceed the
  pre-authorized worst-case policy.
- Falsely marking process-only preflight as durably attested.
- Applying the change to unsupported 13+ page books without a separate gate.

## 8. Validation, cost and acceptance criteria

The implementation itself costs `$0`. A later live proof may spend at most the
unchanged hard `$5.00` ceiling and requires separate fresh authority.

Acceptance requires:

- one canonical schedule function and no stale shared-limit path;
- exact `[48,000, 36,000, 24,000]` binding for a 12-page request;
- unchanged total output pool, projected cost and hard ceiling;
- exact attempt-level persistence and fail-closed validation;
- no raw provider material in artifacts;
- unchanged terminal, repair, retry, fallback and candidate semantics;
- independent Claude Code technical PASS before any new Fresh Readiness.

## 9. Rollback and review assignment

Rollback is a focused revert before issuing new Fresh Readiness. No historical
artifact is migrated, rewritten or recalculated. If the new schedule fails
twice to produce a usable candidate, stop and return empirical evidence to Guy
before changing the allocation, cost ceiling, model or call budget.

Claude Code must falsify schedule uniqueness, exact arithmetic, all request and
evidence bindings, cost reservations, legacy handling, sanitization, provider
reason mapping and every unchanged policy claim. Guy must approve the nine
decisions and later judge whether the resulting candidate/render is good
enough; technical validation cannot grant product or visual acceptance.

## Explicit exclusions

No implementation, credential access, pricing lookup, provider/model call,
Fresh Readiness, preflight, live authoring, candidate, render, image/Vision,
storage/database mutation, Board action, QA deployment, production deployment
or push is authorized by this document.
