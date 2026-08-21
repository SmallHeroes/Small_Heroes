# Decision Gate — Anchor QA Diagnostics and Anthropic Model Authority

**Date:** 2026-08-22
**Owner:** Guy (product) / Codex (technical)
**Branch:** `codex/qa-wizard-presentation-dispositions`
**Status:** Approved under Guy's standing instruction to finish the Wizard path without routine approval pauses; implementation is offline and reversible.

## 1. Proposed change

Make the failed no-photo child-anchor gate diagnosable without another image run, and remove retired Anthropic model IDs from production defaults.

- Persist a closed, ordered reason-code set and a bounded sanitized Style QA note on each description-template anchor candidate.
- Make the terminal hold message identify the consumed attempt budget and the closed reason-code union.
- Replace the retired Claude Sonnet 4 defaults with Anthropic's documented replacement, Claude Sonnet 4.6.
- Replace the retired Claude Haiku 3.5 patch default with Claude Haiku 4.5.
- Add an offline source census that rejects known retired hardcoded Anthropic model IDs.

## 2. Why now?

The first new-story Wizard Order reached the new no-photo anchor lane, generated one candidate and stopped correctly at QA. The in-memory semantic and style sub-results were reduced to booleans before persistence, so the precise failure cannot be reconstructed. The same run also spent an avoidable request on a Claude Sonnet 4 model retired by Anthropic on 2026-06-15.

## 3. Scope

General system change. It is not tied to Chameleon, one child, one gender, one story, one page or one image.

## 4. Risk of hardcoding

The model IDs are provider-version authority and therefore deliberately explicit. The source census prevents retired IDs from silently returning. Environment overrides remain possible and are not silently rewritten. QA reasons are a closed vocabulary derived from existing typed booleans; no story or child text enters the vocabulary.

## 5. Files likely affected

- `backend/providers/anthropic-model-authority.ts`
- `backend/providers/story-bank-loader.ts`
- `backend/providers/pipeline.ts`
- `lib/generation-pipeline/stage0-method-b.ts`
- `lib/generation-pipeline/types.ts`
- `lib/generation-pipeline/chunk-runner.ts`
- focused unit tests
- `CURRENT.md` and implementation evidence

No database migration is needed: `GenerationJob.pipelineCache` is the existing JSON payload and all new candidate fields are optional for legacy readability.

## 6. Expected behavior after change

- A rejected description-template candidate persists exact closed reasons such as `gender_mismatch`, `hair_trait_missing`, `face_detect_low`, `style_mismatch`, `style_photoreal`, or `style_portrait`.
- Style notes are normalized, stripped of control characters and URLs/email-like material, and capped before persistence.
- A bounded hold names attempts used and reason codes, without raw model output or child appearance text.
- Existing photo and Style 02 paths, thresholds, prompts, references, recovery rules and default attempt budget remain unchanged.
- Anthropic defaults no longer point at retired models.

## 7. Validation plan

- Pure tests for reason ordering, completeness, sanitization, unavailable-evidence handling and legacy optionality.
- Static production-source census proving no known retired Anthropic model ID remains.
- Existing Stage 0 generation/reference/recovery tests.
- TypeScript, focused suites, literal `npm run check`, and `git diff --check`.
- Independent Claude Code adversarial review before any new Order.

## 8. Cost impact

This milestone costs $0: no provider, image, audio, storage, database, deployment or render call. A later model-availability preflight may query Anthropic's Models API without generating content, but it is outside this implementation.

## 9. Rollback plan

Revert the focused commit. Legacy candidate rows never require the new optional keys, so no data rollback or migration is necessary.

## 10. Review assignment

Guy has already set the product outcome: complete a real new-story Wizard book without weakening QA. Claude Code should try to falsify exact reason derivation, sanitization, legacy readability, model census completeness, route isolation, and the no-spend/no-policy-drift claims.

## 11. Do not do

- Do not retry or resume the failed Order.
- Do not create another Order, call a provider, deploy, render, or mutate Supabase.
- Do not change prompts, thresholds, style references, resemblance policy, attempt counts, payment flow or production aliases.
- Do not manually approve the rejected anchor.
