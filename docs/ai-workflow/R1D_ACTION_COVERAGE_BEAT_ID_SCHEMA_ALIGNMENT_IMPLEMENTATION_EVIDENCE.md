# R1D Action Coverage Beat-ID Schema Alignment — Implementation Evidence

**Date:** 2026-08-24

**Branch:** `codex/r1d-chameleon-v3-live-authoring`

**Base:** `be2d7e445de37d08811f1640901e12c449586d1a`

**Status:** local green; independent Claude Code review pending

## Outcome

The paid attempt failed closed and was not retried. A general provider-free
correction now makes the structured-output schema express the same beat-ID
lexical authority that the compiler already enforced. Offline replay closes
the observed issue family without weakening the compiler, changing policy, or
spending again.

## Immutable failed-live evidence

- Run: `r1d-chameleon-v3-live-20260824T063821169Z`
- Fresh Readiness: `canonical-pre-live-readiness-evidence/v42`, digest
  `63c595ab996c8f432eedd07c1d6e6098a2774e6cf062eb6003d56fc39b16e35e`
- B0 manifest:
  `2f364632696ebd82b56b3a04f0088b8d3634359ef23700658f720dddd5e1ec28`
- Receipt artifact:
  `outputs/r1d-chameleon-v3-live-20260824T063821169Z/b0/authoring-receipts/4a974edba349d7fce383fba4bc6b7d7c7b39bc7889d220c8e5c4e8aa64f99e5a.json`
- Receipt file SHA-256:
  `850ddb1d3e49faff80c79319c113bc63f2f4cbcf4da16e97e7dfc605b04dce89`
- Calls/dispatches/retries/fallback: `3 / 3 / 0 / none`
- Candidate: absent
- Cost: nominal `$1.967172`; conservative accounted `$2.194321`
- Complete unique issues: `58 -> 47 -> 49`
- Dominant issue: `beat_identity_out_of_scope`, `50 -> 39 -> 41`
- Persistent structural issue: eight
  `page_action_requirements_invalid`, one on every page
- Terminal reason: `repair_increased_complete_issue_count`

The complete-census regression guard behaved correctly and stopped the run at
the first increase. The output root and receipt remained unmodified during
diagnosis and implementation.

## Root cause proved in code

Before this milestone:

- `actionRequirements[].beatId` used
  `^beat:p[1-9][0-9]*:[a-z0-9_]+$` in structured output.
- `actionSemanticCoverage[].beatId` used only `{ "type": "string" }`.
- the compiler independently required coverage identities to match
  `^beat:p{record.pageNumber}:[a-z0-9_]+$` and used exact identity to bind the
  coverage record to a same-page action.

Thus a free-form coverage ID could pass the provider schema and fail the
compiler on every page. This is a schema/validator alignment defect, not a
reason to add calls, budget, retry, fallback, model variants, catalog entries,
or story-specific patches.

## Implementation

1. `templateDraftSchema.ts`
   - exports one canonical lexical pattern;
   - registers it once in the strict action `$defs` authority;
   - reuses the exact same `$ref` for strict action and coverage identities;
   - preserves the equivalent whole-draft action pattern;
   - moves the schema authority from v18 to v19.
2. `compileBookVisualContractTemplate.ts`
   - states `beat:p{pageNumber}:{[a-z0-9_]+}` explicitly;
   - requires `action_requirement` coverage to copy its bound same-page action
     beat ID;
   - moves initial system prompt v16 to v17 and full-draft repair system prompt
     v13 to v14; user-prompt authorities remain unchanged.
3. Canonical lifecycle bindings
   - authoring request v47, with v46 classified as `legacy_immutable`;
   - live materialization input v36;
   - live materialization and verification v45.
4. No compiler coercion was added. Lexically valid wrong-page identities still
   fail at the compiler boundary.

## Falsification and offline proof

- Strict schema test proves every action branch and coverage use the same
  `$ref`, whose definition is the exported canonical pattern.
- Hostile lexical cases (`p1:look`, `beat:page1:look`, uppercase suffixes and
  hyphens) reject; valid page-scoped examples accept.
- A schema-valid `beat:p2:look` placed on page 1 still consumes the one bounded
  repair and fails closed when repeated; no identity is minted.
- The offline production harness replays a historical free-form coverage beat
  plus its page-action structural consequence, injects one corrected full
  draft, and proves:
  - route `initial -> full_draft`;
  - complete census `2 -> 0`, delta `-2`;
  - `candidate` outcome;
  - exact same-page action binding;
  - `providerCalls: 0` and monotonic complete delta.
- Direct compilation of the corrected draft mints
  `action:p1_offline_look` and emits no residual beat/structural issue.

## Input ceiling and compatibility

- Current schema bytes: `14,028`
- Current canonical schema digest:
  `a4c5e664e877a6aa0d7e8791c58e6b3beaa322f6aebb43f5d8ef389d944e77bd`
- 12/12 QA sources are admitted below 64K without provider reachability.
- Tight QA case: `chameleon_koko_adventure`, 62,965 units, 1,035 headroom.
- 18/18 approved sources are admitted below 64K; largest approved input is
  `lion_shaket_fantasy`, 53,466 units, 10,534 headroom.
- OpenAI Responses structured-output compatibility remains green.

## Validation

- Focused matrix: **13 files / 407 tests PASS**
  - action identity/schema authority
  - offline repair harness
  - live authoring adapter
  - prompt compaction and all 30 source ceilings
  - repair loop and typed diagnostics
  - structured-output compatibility
  - source lifecycle
  - request materialization/verification
  - execution materialization/Supervisor
  - canonical pre-live readiness
- `npx --no-install tsc --noEmit`: exit 0
- `git diff --check`: exit 0

Repository-wide `npm run check` reached the documented baseline rather than a
milestone regression:

- resource-intensive partition: **20 files / 611 tests PASS**;
- ordinary partition: **3,560 PASS**, 70 skipped, 11 failed;
- nine failures are missing ignored `outputs/` fixtures in five unchanged test
  files (`story-source-visual-direction-acceptance-lifecycle`,
  `story-read-back-validation`, `page-entity-qa`, `child-lexicon-ages-5-8`,
  and `momentum-gate-koko`);
- two failures are five-second timeouts in the unchanged
  `story-source-revision-blueprint-migration` suite;
- that exact suite passes **8/8** in 23.4 seconds when isolated with the
  established 30-second diagnostic timeout.

No failed full-check assertion belongs to a changed file or changed authority.

## Unchanged boundaries

No credential was read for this correction. No provider, network, Candidate,
approval, package, locator, Wizard, image, Vision, audio or render action ran.
Model, reasoning, token/cost ceilings, call limits, repair limits, retries,
fallback policy, action catalog, accepted Story Source, continuity authority,
Visual Package and renderer remain unchanged.

Independent Claude Code QA is pending because Claude was temporarily
unavailable. This document records Codex implementation evidence and does not
self-award technical PASS or authorize another paid live attempt.
