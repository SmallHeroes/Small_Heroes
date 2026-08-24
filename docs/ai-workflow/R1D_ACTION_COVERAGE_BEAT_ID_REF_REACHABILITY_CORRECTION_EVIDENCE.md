# R1D Action Coverage Beat-ID Reference Reachability — Correction Evidence

**Date:** 2026-08-24

**Branch:** `codex/r1d-chameleon-v3-live-authoring`

**Correction base:** `2072fd527a97515a65484e08318fa9045364f218`

**Status:** local green; narrow independent Claude Code re-gate pending

## Outcome

Claude Code's HOLD on the first beat-ID schema-alignment commit is accepted.
The provider-free correction removes both dangling references at their source
and adds a general fail-closed reachability check so the same defect cannot be
hidden by a syntactically valid `$ref` again. No provider, network, credential,
Candidate, Wizard or render operation ran.

## Accepted findings

At commit `2072fd52`, `actionSemanticCoverage[].beatId` used
`{"$ref":"#/$defs/ar0"}`. The strict action schemas were wrapped with the
matching `$defs`, but two actual provider payloads were not:

| Provider payload | local refs | local definitions | unresolved refs |
| --- | ---: | ---: | ---: |
| `BookVisualContractTemplateDraft` | 1 | 0 | 1 |
| `PageContractRepairPatches` | 1 | 0 | 1 |
| `StructuralBundleRepairPatch` | 18 | 18 | 0 |
| `BookSurfaceRepairPatch` | 18 | 18 | 0 |

The compatibility profile accepted a hostile
`#/$defs/does_not_exist` reference because it checked only the allowed syntax.
The offline repair harness cannot exercise provider-side schema validation, so
its green result did not prove wire-schema reference integrity.

## Correction

1. `templateDraftSchema.ts`
   - retains one exported lexical authority:
     `^beat:p[1-9][0-9]*:[a-z0-9_]+$`;
   - retains `$defs` references for strict action branches that are deliberately
     wrapped with their definitions;
   - emits `actionSemanticCoverage[].beatId` inline from the same exported
     pattern in the self-contained initial and page-repair payloads;
   - moves the draft wire schema to v20.
2. `openaiResponsesStructuredOutputSchemaCompatibility.ts`
   - upgrades compatibility profile and evidence to v2;
   - resolves every permitted local reference against the fully serialized
     root before returning compatible;
   - supports root `#` and RFC 6901 `~0` / `~1` token decoding;
   - rejects missing targets and malformed escapes through the existing
     sanitized `OAI_SO_REFERENCE_INVALID` identity.
3. Provider-payload census
   - tests use the production schema-name constants rather than handwritten
     labels;
   - all nine payloads that can reach the provider are checked:
     `BookVisualContractTemplateDraft`, `SourceEvidenceIdRepairPatches`,
     `PageContractRepairPatches`, `PageSpatialReferenceRepairPatches`,
     `BookSurfaceRepairPatch`, `StructuralBundleRepairPatch`,
     `PresentationRequirementRepairPatches`,
     `StablePropScopeRepairPatches`, and `PreRenderBlueprintDraft`;
   - every payload is compatible and emits zero unresolved local references.
4. Hostile and positive controls
   - a missing local definition rejects;
   - an invalid JSON Pointer escape rejects;
   - an escaped definition name containing `/` and `~` resolves;
   - initial and page-repair coverage schemas equal the canonical inline
     beat-ID pattern exactly;
   - a lexically valid wrong-page beat ID remains rejected by the compiler.

## Authority versioning

The first commit's wire identities are not reused after the corrected bytes:

- draft schema: v19 -> v20;
- page-contract repair schema: v2 -> v3;
- structural-bundle repair schema: v3 -> v4;
- initial system prompt: v17 -> v18;
- full-draft repair system prompt: v14 -> v15;
- authoring request: v47 -> v48, with v47 retained as `legacy_immutable`;
- materialization input: v36 -> v37;
- materialization manifest and verification: v45 -> v46;
- structured-output compatibility profile/evidence: v1 -> v2.

No provider/model, reasoning, call-count, repair-count, retry, fallback, token,
cost, catalog, Story Source, Visual Package, locator, Wizard or render policy
changed. Equivalent prompt wording was compacted only to retain the unchanged
input-admission headroom after the inline wire schema grew.

## Input ceiling

- current schema bytes: `14,066`;
- current canonical schema digest:
  `cc29c6c630f95de2b090f157935b6857d8670141fd453e7a8ab6dcefdc11581f`;
- 12/12 QA sources remain below 64,000 conservative input units;
- tight QA source: `chameleon_koko_adventure`, 62,914, headroom 1,086;
- 18/18 approved sources remain below 64,000;
- Fox: 49,991, headroom 14,009;
- worst approved source: `lion_shaket_fantasy`, 53,415, headroom 10,585.

No admission threshold or budget was weakened.

## Validation

- focused matrix: **13 files / 411 tests PASS**;
- compatibility suite after the complete nine-payload census: **32/32 PASS**;
- `npx --no-install tsc --noEmit`: exit 0;
- `git diff --check`: exit 0.

Literal `npm run check` reached the existing dedicated-worktree baseline:

- ordinary partition: **3,564 passed**, 70 skipped, 11 failed;
- nine failures are missing ignored historical `outputs/` fixtures in five
  unchanged test files;
- two failures are the unchanged Blueprint migration tests exceeding the
  ordinary five-second timeout;
- that exact migration suite passes **8/8 in 29.37 seconds** with the
  established 30-second allowance;
- resource-intensive partition: **20 files / 611 tests PASS**; Vitest then
  reports the same three `onTaskUpdate` worker RPC timeouts.

No failed assertion belongs to a changed file or changed authority.

## Boundaries and next gate

The immutable failed-live root
`outputs/r1d-chameleon-v3-live-20260824T063821169Z` remains unchanged and no
second paid attempt was made. This evidence does not self-award independent
technical PASS. Claude Code must re-gate the correction range from `2072fd52`
through the focused corrective commit, with special attention to both original
findings, all nine provider payloads, hostile reference handling, version
identity and unchanged operational policy. Only a PASS permits one bounded
paid live authoring attempt.
