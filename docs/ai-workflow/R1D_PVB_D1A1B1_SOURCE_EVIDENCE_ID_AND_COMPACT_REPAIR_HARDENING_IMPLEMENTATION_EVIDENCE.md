# R1D-PVB-D1A1B1 Source Evidence ID and Compact Repair Hardening — Implementation Evidence

**Status:** implementation complete; awaiting independent Claude Code first-pass QA
**Date:** 2026-08-01
**Immutable base:** `a9d2fd2c5d3b01d61a7ba598e9b1806e73b115be`
**Branch:** `codex/r1d-pvb-d1a1b1-source-evidence-compact-repair`
**Worktree:** `C:\Users\guyna\.codex\worktrees\600e\Small_Heroes`
**External cost/actions:** `$0`; none

## Outcome

The milestone replaces duplicated model-authored evidence prose with a deterministic compiler-owned Source Evidence Catalog and one model-selected `sourceEvidenceId` binding in `actionSemanticCoverage`. The compiler resolves that ID locally to exact Story Source text and persists only the derived excerpt.

An all-ID-only validation failure now selects a narrow typed repair call containing affected page/beat records and relevant same-page catalog entries. The response contains ID patches only. Patch shape, completeness, uniqueness, page binding, beat binding, and catalog membership are checked locally before the whole draft is reassembled and revalidated. Mixed and non-ID failures continue through the existing complete-draft repair.

## Versioned authority

| Authority | Current version |
| --- | --- |
| Source Evidence Catalog | `source-evidence-catalog/v1` |
| Story Source snapshot | `story-source-authority-snapshot/v2` |
| Visual Contract draft schema | `vc-draft-schema/v9` |
| Compact repair schema | `source-evidence-id-repair-schema/v1` |
| Authoring request / receipt / readiness / candidate | `v6` / `v5` / `v3` / `v3` |
| B0 materialization / verification | `v4` / `v4` |
| Execution Request / readiness | `v3` / `v3` |
| Canonical pre-live readiness evidence | `v3` |

Historical artifacts were not modified. Older recognized versions remain `legacy_immutable` and cannot authorize a future attempt.

## Evidence

### Focused test gate

Command:

```powershell
npx vitest run lib/__tests__/source-evidence-catalog.spec.ts lib/__tests__/action-semantic-catalog.spec.ts lib/__tests__/visual-contract-cover-source-fidelity.spec.ts lib/__tests__/visual-contract-live-authoring.spec.ts lib/__tests__/visual-contract-repair-loop.spec.ts lib/__tests__/visual-contract-s2a.spec.ts lib/__tests__/visual-contract-s2b.spec.ts lib/__tests__/visual-contract-text-first-compiler.spec.ts lib/visual-package/__tests__/canonical-live-authoring-boundary.spec.ts lib/visual-package/__tests__/canonical-pre-live-readiness.spec.ts lib/visual-package/__tests__/live-execution-request-materialization.spec.ts lib/visual-package/__tests__/live-execution-supervisor.spec.ts lib/visual-package/__tests__/live-request-materialization.spec.ts lib/visual-package/__tests__/live-request-verification.spec.ts lib/visual-package/__tests__/openai-responses-structured-output-schema-compatibility.spec.ts lib/visual-package/__tests__/source-authority-lifecycle.spec.ts
```

Result: **16 files / 406 tests PASS**.

The tests prove:

- exact Hebrew/English/Unicode/punctuation excerpts and UTF-16/UTF-8 offsets;
- deterministic ID/digest ordering and duplicate-text disambiguation;
- malformed, unknown, stale/cross-source, and wrong-page fail-closed resolution;
- no `sourcePhrase` in either model-facing draft binding and no evidence field in `actionRequirements`;
- exact compiler-derived persisted evidence;
- an eleven-invalid-ID fixture across pages 6, 8, 9, 10, 11, and 12 selects compact repair, sends eleven affected records only, remains conservatively below 64K including schema/protocol allowance, applies a complete typed patch, and passes complete revalidation;
- mixed ID plus non-ID failures cannot select compact repair and use the pre-existing complete-draft schema/prompt;
- both schemas pass the repository's OpenAI Responses structured-output compatibility profile;
- the canonical adapter, request/receipt/candidate evidence, B0 verifier, Execution Request/Supervisor, and pre-live readiness bind and reject stale compact/catalog authority.

### Deterministic TypeScript and repository gate

- `npx --no-install tsc --noEmit`: **PASS** after focused tests.
- Exactly one literal `npm run check`: TypeScript **PASS**; Vitest reproduced only the six established missing ignored-fixture baseline failures in the same five files. No new or milestone failure occurred. The full check was not rerun.
- `git diff --check`: required and recorded again before commit.
- Ignored test scratch was moved without deletion to `C:\Users\guyna\AppData\Local\Temp\small-heroes-r1d-source-evidence-check-scratch-20260801-600e`.

## Unchanged fences

- model `gpt-5.6-sol`;
- provider OpenAI Responses API and `service_tier: default`;
- max input `64,000`, existing max output and timeout;
- max three provider calls and max two repairs;
- transport retries `0`, no fallback;
- conservative accounting and hard `$5.00` ceiling;
- unsupported Action Semantic Catalog gaps remain terminal;
- no fuzzy text matching or generic repair framework.

## Zero-external-action record

There was no credential loading/check, pricing or network lookup, provider/model call, live authoring, render, image/Vision/audio, storage/database, Board action, Semantic Reconciliation, approval, publication, promotion, production activation, deployment, PR, or push. No historical ignored/live artifact was rewritten. Test-created ignored scratch was preserved at the path above.

## Limitations and next gate

- This milestone proves repository-local behavior only; it creates no Visual Contract candidate and makes no product/visual quality claim.
- Codex does not self-award independent technical PASS.
- Claude Code must first review the final immutable base-to-head range read-only and try to falsify catalog identity/exactness, patch minimality/exclusivity, full revalidation, adapter schema selection, authority versioning, stale rejection, and unchanged budget/policy fences.
- Even after independent technical PASS, any future live attempt requires later B0 rematerialization, Fresh Readiness, current pricing authority, and separate Guy authorization.
