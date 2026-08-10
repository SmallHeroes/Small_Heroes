# R1D-PVB-D1A1B1 Stable Prop Scope Compact Repair — Implementation Evidence

## Status

- Exact base: `72d25784454de9da61f081bbf42546f3a121e7cc`
- Branch: `codex/r1d-pvb-d1a1b1-stable-prop-scope-compact-repair`
- Implementation commit: `50cf1b2f`
- Technical state: local green; independent Claude Code QA pending
- External implementation cost: `$0`
- Production state: blocked

## Observed failure and root cause

The consumed post-input-compaction live attempt completed one provider response and produced no candidate. Complete local validation reported two homogeneous `recurring_prop_lifecycle_gated` issues at compiler-owned Set Board node locators. The underlying draft was otherwise available for a narrow deterministic correction, but the existing routing treated every authority-reference-domain issue as terminal.

The missing capability was not another Story Source semantic, prompt-budget increase or provider fallback. It was a closed repair route that could remove an invalid stable consumer binding without choosing or copying any recurring-prop identity and without allowing unrelated draft mutation.

## Implemented contract

`stable-prop-scope-repair-schema/v1` and its v1 prompt authority are eligible only when every issue:

1. has code `recurring_prop_lifecycle_gated` or `recurring_prop_consumer_forbidden`;
2. uses locator kind `set_area_node`;
3. uses reference class `recurring_prop`;
4. uses field role `spatialNodes.stablePropId`; and
5. points to a current non-empty stable binding in the draft.

Duplicate issue identities at the same locator collapse to one target with sorted closed reason codes. The provider receives only `authorityIndex`, `areaIndex`, `nodeIndex`, the closed field role and the closed reason codes. The response must contain exactly one patch per target and can express only `stablePropId: null`.

The apply boundary rejects invalid JSON, unknown or missing keys, empty patch sets, non-integer indices, wrong field roles, non-null values, missing/extra/duplicate patches and stale targets. It clones the draft, applies null only at the target paths, masks the target values and compares canonical JSON before/after to prove non-target containment. The existing compiler then reruns complete validation before candidate creation.

Mixed issue families, unknown-reference identities, wrong locator classes/roles and already-unbound targets remain terminal. The existing initial-call plus two-repair budget, 64K ceiling, provider/model/tier, timeout, zero transport retries, no fallback and `$4.884/$5.00` ceilings are unchanged.

## Authority and migration

Current authority versions are:

- Visual Contract request `v18`, receipt `v21`, readiness `v19`;
- canonical live-request materialization and verification `v16`;
- canonical live Execution Request and Supervisor readiness `v15`;
- execution-request materialization result `v10`;
- canonical Pre-Live Readiness evidence `v15`.

The new strict schema compatibility authority and prompt digest are bound through request construction, adapter verification, B0 materialization/verifier, Execution Request materialization, Supervisor verification and Fresh Readiness. The immediately preceding versions are legacy immutable. Historical output roots and the consumed live attempt were not changed or rematerialized.

## Validation

- `stable-prop-scope-repair.spec.ts` plus `draft-reference-domain-hardening.spec.ts`: **2 files / 45 tests PASS**.
- `source-authority-lifecycle.spec.ts` plus `canonical-live-authoring-boundary.spec.ts`: **2 files / 201 tests PASS**.
- Materialization/verifier/Execution Request/Supervisor/Fresh Readiness subprocess set: **5 files / 145 tests PASS** at one worker.
- Final stable repair plus compatibility-tamper set: **2 files / 55 tests PASS**.
- Workload classifier: **1 file / 7 tests PASS**, canonical inventory `290 = 271 ordinary + 19 resource-intensive`.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.

The single literal `npm run check` completed in 140.9 seconds. TypeScript passed. The resource-intensive phase passed all 19 files in 100,794 ms with a valid diagnostic protocol and no timeout, RPC/IPC, reporter, launch, signal or teardown class. The ordinary phase reported exactly the established six ignored-output fixture failures and no additional assertion. Those failures remain a separate repository/release HOLD in:

- `child-lexicon-ages-5-8.spec.ts`;
- `momentum-gate-koko.spec.ts`;
- `page-entity-qa.spec.ts`;
- `set-appearance-ref-budget.spec.ts`; and
- two cases in `story-read-back-validation.spec.ts`.

No missing fixture was copied, fabricated or waived for release.

## Rollback and exclusions

Rollback is the focused implementation commit plus its later documentation closeout; no historical artifact needs rewriting. No credentials, provider/network call, live authority, render, image/Vision, storage/database, Board, publication, deployment or production action was used. The implementation grants no candidate, Blueprint, Wizard, render or release authority.

## Independent QA handoff

Claude Code must review the exact immutable implementation range, prove the closed eligibility and exact patch set, attempt mixed/stale/non-null/non-target mutations, verify the adapter and all authority bindings, confirm legacy cutover, and falsify any change to budgets/provider/downstream behavior. A PASS must be attributed to Claude Code and recorded separately; Codex does not self-award it.
