# R1D-PVB-D1A1B1 Source Evidence ID and Compact Repair Hardening Decision Gate

**Status:** APPROVED by Guy in the delegated implementation brief on 2026-08-01
**Immutable base:** `a9d2fd2c5d3b01d61a7ba598e9b1806e73b115be`
**Implementation branch:** `codex/r1d-pvb-d1a1b1-source-evidence-compact-repair`
**Implementation worktree:** `C:\Users\guyna\.codex\worktrees\600e\Small_Heroes`
**Cost boundary:** zero credential, pricing, network, provider, model, image, Vision, audio, storage, database, Board, render, or deployment actions

## 1. Proposed change

Replace model-authored exact source-text copies with a deterministic Source Evidence Catalog derived from canonical Story Source authority. The authoring draft selects `sourceEvidenceId` once through `actionSemanticCoverage`; the compiler resolves the selected ID locally to the exact same-page excerpt and persists only compiler-derived evidence text.

Add one narrow typed compact repair for validation attempts whose complete failure set consists only of source-evidence-ID failures. It receives only affected page/beat records and relevant same-page catalog entries, returns deterministic ID patches, applies them to the prior draft, and revalidates the complete draft locally. Mixed and other failures retain the existing whole-draft semantic repair.

## 2. Why now?

The post-topology authorized attempt completed one `gpt-5.6-sol` Responses call, then failed on eleven copied source phrases across pages 6, 8, 9, 10, 11, and 12. The existing whole-draft repair payload exceeded the 64,000 input-token ceiling before a repair provider call. There is no candidate or downstream authority.

The systemic cause is a duplicated free-form evidence contract plus a whole-document-only repair boundary. Prompt reinforcement or fuzzy matching would leave model-authored evidence authoritative and would not solve the repair-size failure safely.

## 3. Scope

This is a general Story Source authoring-control change. It includes:

- deterministic, source-identity-bound catalog derivation with exact page/excerpt offsets and duplicate disambiguation;
- Visual Contract draft schema, prompt, compiler, evidence, request, receipt, readiness, and candidate versioning;
- compact repair schema, prompt authority, adapter option validation, and all-ID activation classification;
- B0 materialization/verifier, Execution Request/Supervisor, and Fresh Readiness compatibility bindings;
- repository-local fixtures, tests, and durable documentation.

It does not modify Story Sources, historical artifacts, the closed Action Semantic Catalog, render/runtime contracts, budgets, pricing, credentials, provider settings, storage, production state, or downstream approval.

## 4. Risk of hardcoding

The implementation must not encode a story, language, child, companion, page, location, prop, or observed excerpt. Catalog derivation operates on arbitrary ordered Story Source pages and normalized source identity. Tests cover Hebrew, English, Unicode, punctuation, duplicate excerpts, varied pages, and cross-source/stale bindings.

## 5. Files likely affected

- `lib/visual-contract-compiler/` Source Evidence Catalog, Action Semantic Coverage, draft schema, prompts, compiler, and repair call metadata
- `lib/visual-package/` Story Source authority, authoring lifecycle, request adapter, B0/materialization/verifier, Execution Request/Supervisor, and readiness contracts
- focused fixtures and tests under `lib/__tests__/` and `lib/visual-package/__tests__/`
- `CURRENT.md` and durable Decision Gate/implementation evidence

## 6. Expected behavior after change

- The same Story Source authority deterministically produces the same catalog, IDs, offsets, excerpts, ordering, and digest.
- Duplicate excerpt text receives distinct stable IDs through its source-bound page/position identity.
- The new draft has no model-authored `sourcePhrase` in either `actionRequirements` or `actionSemanticCoverage`.
- `actionSemanticCoverage` is the single authoring evidence binding and selects `sourceEvidenceId`.
- The compiler accepts only an exact current-catalog ID on the exact draft page, resolves the exact catalog excerpt, and persists compiler-derived evidence.
- Malformed, unknown, stale, wrong-source, and wrong-page IDs fail closed. There is no fuzzy or normalized-text fallback.
- Compact repair activates only for an all-source-evidence-ID failure set, returns patches only, and then re-runs complete local assembly and validation.
- Any mixed or other failure retains the existing whole-draft repair behavior.
- `gpt-5.6-sol`, Responses API, `service_tier: default`, 64K max input, three-call/two-repair caps, timeout/output limits, zero transport retries, no fallback, conservative accounting, and the hard `$5.00` ceiling remain unchanged.
- Historical versions remain immutable evidence but fail as current authority. A future attempt requires later B0 rematerialization, independent QA, and Fresh Readiness.

## 7. Validation plan

1. Catalog unit tests for deterministic IDs/digests, exact excerpts/offsets, Hebrew/English/Unicode/punctuation, duplicates, and wrong-page/wrong-source/stale/unknown/malformed IDs.
2. Compiler tests proving exact derived evidence and absence of draft `sourcePhrase`.
3. A general twelve-page fixture with eleven invalid IDs shaped like the observed failure; prove the compact prompt plus schema remains below 64K without budget changes.
4. Negative tests proving mixed/other failures cannot activate compact repair and continue through whole-draft repair.
5. Structured-output compatibility tests for both schemas.
6. B0/materialization/verifier/Execution Request/Supervisor/readiness tests for current-version bindings and stale rejection.
7. Focused Vitest suites and deterministic repository-local TypeScript, then exactly one literal `npm run check`.
8. `git diff --check`, exact topology reconciliation, explicit-path staging, and local focused commits only.

The full check may remain non-green only for the six established absent ignored-fixture baseline failures in the five documented files.

## 8. Cost impact

Expected external spend: **$0.00**. Expected provider/model/image generations: **0**.

## 9. Rollback plan

Revert the focused local implementation commits. Because no external action, migration, remote write, or historical artifact rewrite is permitted, rollback has no production, storage, database, billing, or provider state to unwind. Old artifacts remain immutable evidence but do not become current authority.

## 10. Review assignment

Guy approved the architecture, failure boundaries, unchanged budgets, versioning requirement, and exclusions in the delegated brief.

Claude Code first-pass review is read-only and should try to falsify:

- catalog determinism, source identity binding, duplicate disambiguation, exact Unicode excerpts, and offset correctness;
- malformed/unknown/stale/cross-source/wrong-page fail-closed behavior;
- complete removal of model-authored `sourcePhrase` from the new draft contract;
- compiler-only evidence derivation and candidate/receipt digest binding;
- compact repair activation only for all-ID errors, minimal payload contents, deterministic patch application, and full local revalidation;
- unchanged whole-draft repair behavior for mixed/other errors;
- both schemas' Responses compatibility and every B0/verifier/Execution Request/readiness version/digest binding;
- unchanged model, provider, retry, timeout, token, call, repair, cost, and fallback fences;
- absence of external actions and story-specific shared logic.

Claude Cowork review is not required for this technical code-only milestone. Guy will inspect a future real candidate only after a separately authorized live attempt and Semantic Reconciliation.

## 11. Do not do

- No credential loading/check, pricing or network lookup, provider/model call, live authoring, render, image/Vision, audio, storage/database, Board action, Semantic Reconciliation, approval, publication, promotion, production activation, deployment, PR, push, or cleanup.
- No budget increase, weakened guard, fallback, fuzzy matching, generic repair framework, Story Source edit, or historical ignored/live artifact rewrite.

## Stop-check record

1. General system fix: **yes**.
2. Cross-story risk: **yes**, controlled by source-bound deterministic catalogs, fail-closed resolution, and multilingual/multi-shape fixtures.
3. Production behavior affected: future authoring authority only; no render/runtime activation.
4. Spend: **none**.
5. Smallest safe validation: deterministic local TypeScript and focused suites, then one full repository check.
6. Remaining Guy decision: **none**; the delegated brief is explicit approval.
7. Claude Code targets: catalog identity, exact evidence, repair activation exclusivity, compactness, compatibility, stale authority, and unchanged fences.
8. Claude Cowork question: **none**.
9. Guy eyeball: no visual artifact in this milestone; a future separately authorized candidate.

## Implementation disposition — 2026-08-01

Implementation and repository-local validation are complete on the dedicated branch. The final focused gate passed at 16 files / 406 tests. Repository-local TypeScript passed. The one permitted literal `npm run check` reproduced only the six established ignored-fixture baseline failures and was not rerun. No external action or spend occurred. The detailed evidence is recorded in `R1D_PVB_D1A1B1_SOURCE_EVIDENCE_ID_AND_COMPACT_REPAIR_HARDENING_IMPLEMENTATION_EVIDENCE.md`.

The milestone is ready for independent Claude Code first-pass read-only QA. This statement is not an independent technical PASS and creates no B0, Fresh Readiness, provider, live-authoring, render, or downstream authority.
