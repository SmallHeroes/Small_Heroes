# Decision Gate — R1D-PVB-D1A1B1 Cross-Family Page Repair Routing

**Base:** `824e8b3acb0c64e9220bd44542c6821553cd284d`
**Goal:** prevent already-present presentation and final page-structure failures from consuming separate repairs after an earlier repair, while preserving the three-call/$5 hard boundary.

## Observed / expected / root cause

The consumed live attempt used one successful page-spatial repair and one successful presentation-requirement repair. Only then did final template validation expose one final-structure issue on every page. The expected behavior is that failures already present in the same draft are visible to one bounded repair plan. The cause is the early `ActionSemanticCapabilityGapError`, which prevents the final template validator from observing page structure until the next provider response.

## Nine decisions

1. Defer only the closed capability-gap throw through final template validation; every earlier authority/schema/source failure keeps its existing ordering.
2. Admit the combined route only when the second family is entirely `final_structural_invariant_invalid` with exact positive page locators.
3. Reuse `page_contract_patch` and its unchanged structured output schema; do not create a new provider call kind or repair framework.
4. Build the exact union of structural pages and presentation-gap pages, require one unique draft page for every identity, and reject malformed, duplicate or unlocatable authority.
5. Carry each presentation target's exact beat/evidence identity, source phrase and compiler-projected same-page pointer/value choices. The provider may select only one closed presentation class and one permitted pair.
6. Apply complete replacement pages only for the exact page set, then rerun all compiler overlays and validators before candidate persistence.
7. Advance only page-contract repair system/user prompt authority from v8 to v9. Schema, model, service tier, token ceilings, call/repair budget, timeout, retries, fallback, cost ceiling and candidate policy stay unchanged.
8. Test the real bounded sequence: initial spatial failure, field-scoped spatial repair, combined presentation/structure page repair, and a valid candidate on call three; retain homogeneous presentation and structural routes.
9. Rollback is the focused implementation commit. Historical requests, receipts, readiness and failed attempts remain immutable and cannot authorize a new attempt.

## Acceptance

- Exact mixed-family input produces one `page_contract_patch` with no fourth call.
- Same-page pointer authority is explicit and full candidate validation remains mandatory.
- Unsupported mixtures, non-final structural diagnostics and unusable repair output remain terminal.
- Focused compiler/lifecycle/canonical tests, TypeScript and diff check pass; repository gate has no new unresolved failure beyond the six known fixture HOLDs.
- Independent Claude Code QA passes before new Fresh Readiness and live spend.

## Exclusions

No initial prompt/schema/model/budget change, no credential/provider call in implementation, no render, storage/database, publication, deployment, production activation or release waiver.
