# R1D Page-Contract Repair Scope-Correction Budget — Decision Gate

## Decision

Use the already-approved second standard repair call when, and only when, a
completed `page_contract_patch` is rejected because its action-binding edits
escaped the exact compiler-owned target scope. The correction call receives
the same compact affected-page authority plus a closed, content-free notice
that the preceding response changed too many bindings. It is a logical repair,
not a transport retry or fallback.

This is a general authoring-lifecycle correction for every Story Source. It
contains no story, page, child, companion, authored identifier, source phrase,
provider-output or credential literal.

## Observed attempt evidence

The consumed attempt on immutable `faba79dbce5099bfb0ef110dc2cf2d24f64196b9`
used Fresh Readiness digest
`4c2550d8588bec3071ccea402ed8320ba649f75ec2a71acf7aad460823e40c88`
and Execution Request digest
`f36c45cb5503c8a4bb9da7997011e02a7331810bbfdd9246233dcbcf93605249`.
The initial provider response produced exactly one current
`action_binding_cardinality_invalid` at page 12, `page_actions[1]`. The first
`page_contract_patch` provider response completed, but local targeted
application rejected it as `repair_output_application_rejected`. Receipt v28
digest `cdc952f6bd2d46ad564b9bf2a8c6b90dafae8fa44c6d707a7e72ba346211f23b`
records two logical provider calls, one repair, zero transport retry and no
fallback. Nominal/conservative accounting was `$1.109529/$1.220491`. No
candidate or downstream authority exists.

For a `page_actions` cardinality target, the closed applier can classify stale
identity and invalid beat identity separately. The remaining reachable
`application_rejected` branch is the action-binding scope guard: the completed
response changed more than the permitted target action plus at most one
existing same-page coverage binding. The guard behaved correctly. The
lifecycle defect is that it terminated despite one standard repair remaining.

## Nine architectural decisions

1. **Closed eligibility only.** Only `page_contract_patch` plus the exact
   action-binding-scope rejection may consume the remaining standard repair.
   JSON, shape, target identity, reference authority, unknown application,
   provider, policy, transport, usage and cost failures remain terminal.
2. **No authority widening.** The second repair reuses the same exact affected
   page set, repair targets, permitted values and complete-page response
   schema. It receives no raw prior response or exception text.
3. **Explicit correction context.** The compact user input may carry one closed
   `previousRepairFailure` value meaning target-scope drift. The system prompt
   explains that non-target action and coverage bindings must remain unchanged.
4. **Strict application unchanged.** Exact page keys and sets, action/coverage
   cardinality, source-evidence identity, non-target containment, cloning and
   full post-application validation stay fail-closed.
5. **Existing budget only.** The maximum remains one initial call plus two
   standard repairs, three logical calls total, zero transport retries, no
   fallback and hard `$5.00` ceiling. No optional cleanup is added.
6. **Truthful evidence.** A failed first repair leaves the original draft in
   memory. The next diagnostic attempt therefore truthfully reports the same
   draft issue as persistent. Calls, repairs, usage, cost, retry and fallback
   attestations remain post-hoc observations.
7. **Versioned cutover.** Page-repair prompt/input authority and every current
   authoring/materialization/Supervisor/Fresh-Readiness binding advance
   together. Historical artifacts remain immutable evidence only.
8. **Regression proof.** Tests cover scope rejection classification, one
   invalid-scope repair followed by one valid same-authority repair and a
   candidate, terminal behavior for all non-eligible failures, budget
   exhaustion, evidence roundtrip/tamper rejection and unchanged provider
   policy.
9. **Rollback.** Revert the focused implementation and authority-cutover
   commits before rematerializing. Prior artifacts are not rewritten; the old
   behavior then terminates on the first unusable repair response.

## Rejected alternatives

- Accepting or selecting among multiple changed coverage bindings would weaken
  the exact target scope and can alter story semantics.
- Parsing or persisting the raw provider response would violate the sanitized
  evidence boundary.
- A transport retry, model fallback, extra repair, higher budget or looser
  validator is unnecessary and outside the approved policy.
- A story/page-specific deterministic binding would not generalize and would
  guess authored semantics.

## Acceptance criteria

- The exact attempt-3 failure class is recognized as target-scope drift.
- One unusable first `page_contract_patch` may be followed by one stricter
  `page_contract_patch` within the unchanged 3/2 budget.
- The second prompt carries only closed correction context and the original
  compact authority; no raw response, provider message, stack or prose leaks.
- A valid second response produces a fully revalidated candidate; a second
  unusable response remains terminal with exact counts.
- All other repair-output failures remain terminal after one completed repair.
- Focused tests, deterministic TypeScript, `git diff --check` and the one
  repository gate satisfy repository policy before independent Claude Code QA.

## Explicit exclusions

No story/prompt creative change, draft/output schema change, model, service
tier, reasoning, token/output ceiling, timeout, provider adapter, transport
retry, fallback, cost ceiling, candidate semantics, Blueprint, Wizard, Reader,
image generation, payment, storage/database, QA deployment or Production
change is authorized by this gate.
