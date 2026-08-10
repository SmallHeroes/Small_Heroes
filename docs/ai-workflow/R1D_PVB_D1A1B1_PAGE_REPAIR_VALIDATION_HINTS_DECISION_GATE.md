# R1D-PVB-D1A1B1 Page Repair Validation Hints — Decision Gate

## Decision

Proceed under Guy's standing 2026-08-10 authority to reach one local Wizard-connected `gpt-image-2` LOW portrait-page measurement. This gate authorizes only a general page-repair observability correction. It does not authorize production, publication, storage, deployment, a full-book render, or any increase to provider/call/cost policy.

## 1. Proposed change

Carry the exact locally generated validation messages that correspond to each page-local typed `final_structural_invariant_invalid` repair target into the existing in-memory `page_contract_patch` prompt authority. The messages are grouped by the existing structural page locator, canonically deduplicated, and paired with the already-authorized complete affected page authority. They are never added to receipts, readiness, candidates, diagnostics, logs, or repository artifacts.

## 2. Why now?

Two independent live attempts proved the same failure mode. The existing presentation repair resolved its closed semantic gaps. The subsequent page-contract repair received all twelve affected pages but only the generic typed code `final_structural_invariant_invalid`; it received no information identifying which local invariant failed. Both page-contract repairs returned completed provider responses while all twelve page failures remained. The repair had authority to replace the affected pages but lacked the information required to repair them.

This blocks candidate creation and therefore blocks Semantic Reconciliation, Blueprint, Wizard qualification, and the first LOW render.

## 3. Scope

General system change. It applies to every Story Source and every existing page-contract repair family. It does not add a story, page, phrase, ID, character, prop, or Fox-specific rule.

## 4. Risk of hardcoding

No story-specific values are admitted. Eligibility continues to come only from the closed typed issue catalog and structural page locators. Messages originate only from the repository-owned deterministic validator for the same failed attempt. A missing, non-string, cardinality-mismatched, cross-page, or unlocatable message set fails closed rather than falling back to prose parsing.

## 5. Files likely affected

- `lib/visual-contract-compiler/pageContractRepair.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- focused compiler and lifecycle tests
- prompt/version and canonical B0/Execution/Fresh Readiness bindings
- `CURRENT.md` and implementation evidence

## 6. Expected behavior

When a homogeneous page-contract repair is selected, each affected page carries:

- its unchanged complete page contract;
- its unchanged closed typed repair targets;
- its unchanged permitted pointer authority where applicable; and
- only the deterministic validation messages whose typed locators identify that page.

The provider must still return exactly one complete contract for every affected page and no other page. The compiler still enforces exact page identity, applies only the approved page replacements, and reruns complete validation. No validation message is persisted or used as an authority identity.

## 7. Validation plan

- direct construction tests for exact page/message grouping, canonical deduplication, deterministic ordering, and fail-closed message/diagnostic cardinality;
- prompt round-trip tests proving no page authority is omitted and the correct hints survive compact encoding;
- repair-loop tests proving the existing provider call receives the hints and receipts retain typed diagnostics only;
- regression tests for mixed, unsupported, stale, extra/missing page, and non-target behavior;
- canonical materialization, verifier, Supervisor, and Fresh Readiness version/tamper tests;
- deterministic TypeScript, `git diff --check`, and one repository check;
- independent Claude Code adversarial QA before any new spend attempt.

## 8. Cost impact

Implementation and validation cost `$0`. The change does not alter model, service tier, 64K input ceiling, 36K output ceiling, one-initial-plus-two-repair budget, transport retries, fallback, timeout, or the `$4.884/$5.00` ceilings. Validation hints may add input tokens to an eligible repair, but the existing admission guard and per-attempt hard cost gate remain authoritative and fail closed.

## 9. Rollback

Revert the focused implementation and authority-cutover commits. Historical artifacts remain byte-immutable and legacy-only. No data or production migration is required.

## Nine architectural decisions

1. `page_contract_patch` remains the only output schema and apply mechanism; no new general repair framework is introduced.
2. Validation messages are in-memory provider input only and never persisted in canonical evidence.
3. Typed issue identities and locators remain the sole repair-routing authority; messages never select mode or scope.
4. The compiler requires one-to-one message/diagnostic cardinality and groups only by the existing positive page locator; unsafe locators fail closed.
5. Page hints are canonically deduplicated and sorted to make prompt bytes deterministic without parsing or rewriting their content.
6. The existing compact input encoder remains lossless and carries the new `validationHints` field; the strict output schema and apply logic remain unchanged.
7. Prompt authorities cut over explicitly; prior prompt/artifact authorities remain immutable and are not current authority.
8. Model, schema output, token/call/repair budgets, timeout, retry/fallback policy, candidate semantics, and cost ceilings remain unchanged.
9. A new live attempt is allowed only after focused validation, repository gate accounting, independent Claude Code QA, push, Fresh Readiness, pricing, one preflight, and one Supervisor verify.

## Stop-check

- General fix: yes.
- Cross-story risk: bounded to an existing closed page-repair route; covered by general tests.
- Production behavior: authoring repair prompt changes, but production remains blocked and no downstream acceptance is implied.
- Spend: none during implementation; later live spend remains separately gated.
- Smallest proof: focused repair/loop/lifecycle/canonical tests, followed by one bounded live authoring attempt and only then one page LOW render.
- Guy decision: supplied by the standing instruction to continue without repeated approvals while preserving hard boundaries.
- Claude Code falsification: message/diagnostic alignment, cross-page leakage, persistence leakage, prompt determinism, legacy cutover, budget drift, and unsupported-route behavior.
- Claude Cowork: not required; this is a technical repair-input observability boundary, not a product or creative decision.
- Guy eyeball: the first locally rendered LOW portrait page after the complete Wizard-connected path passes.

## Do not do

Do not persist validation prose; parse prose for routing; change the strict repair response schema; change model, reasoning, service tier, token/call/repair budget, timeout, retries, fallback, cost ceiling, candidate policy, Blueprint, Wizard, image prompt, style references, storage/database, production, publication, promotion, activation, deployment, or full-book rendering.
