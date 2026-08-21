# Anchor QA Diagnostics and Anthropic Model Authority — Implementation Evidence

**Date:** 2026-08-22
**Branch:** `codex/qa-wizard-presentation-dispositions`
**Base:** `539dd1f1e0898d84f5ee3569a1fda9bb82d14ff4`
**Status:** Implemented and provider-free locally; independent Claude Code review pending.

## Requirement

Before spending on another Wizard Order, preserve the exact bounded reasons why
a no-photo child-anchor candidate failed and stop using retired Anthropic model
defaults. Do not weaken QA, retry the old Order, alter generation prompts or
attempt budgets, or touch Production.

## Root cause confirmed

The existing description-template path derived semantic sub-results and Style QA
notes in memory, then persisted only `semanticPass`, `stylePass` and `passed`.
After the process ended, the canonical row could prove that QA failed but could
not prove whether gender, hair, face detection, style match, photorealism,
portrait framing or missing Style evidence was responsible.

The production source also contained two retired defaults. Anthropic documents
`claude-sonnet-4-20250514` as retired on 2026-06-15 with Sonnet 4.6 as its
replacement, and `claude-3-5-haiku-20241022` as retired on 2026-02-19 with
Claude Haiku 4.5 as its replacement. The failed QA Order independently observed
the Sonnet 4 default returning model-not-found before the existing OpenAI
fallback supplied a usable description.

## Implementation

### Closed candidate diagnostics

`lib/generation-pipeline/stage0-qa-diagnostics.ts` defines one versioned record:

- exact keys: `version`, `reasonCodes`, `styleNotes`;
- a closed and canonical reason order;
- a nonempty reason set for failed candidates and an empty set for passed ones;
- NFKC normalization, control-character removal, URL/email/secret-like redaction,
  whitespace normalization and a 240-code-point cap for Style notes;
- a terminal summary containing only attempt counts and closed reason codes.

The chunk runner derives and persists this record before saving every
description-template candidate. It still uses the same semantic booleans, face
threshold and Style QA result to decide promotion. The record adds observability;
it does not authorize a candidate.

### Recovery compatibility

Historical rows without `qaDiagnostics` remain readable. If a row claims the new
field, recovery validates the exact keys, version, closed values and canonical
ordering and cross-binds the reason families to `semanticPass`, `stylePass` and
`passed` before it can be reused. Malformed or contradictory present evidence
stops recovery.

### Model authority

`backend/providers/anthropic-model-authority.ts` centralizes current defaults and
the closed list of known retired IDs. Production call sites now import:

- story/default support: existing `claude-opus-4-5` behavior retained;
- support and Vision: `claude-sonnet-4-6`;
- personalization patch: `claude-haiku-4-5-20251001`.

Environment overrides remain visible and unchanged. Before the next paid Order,
the operational gate must verify the deployed environment and query Anthropic's
Models API for the effective model; the source change alone does not claim that
an account-specific model is available.

## Validation

Provider-free focused suites:

```text
8 test files passed
78 tests passed
```

The coverage includes diagnostics derivation, canonical ordering, sanitization,
redaction and cap behavior, unavailable Style evidence, exact-shape tampering,
terminal messages, legacy recovery, malformed-present recovery rejection, and a
recursive production-source census for retired hardcoded Claude IDs.

Additional results:

- isolated `npx --no-install tsc --noEmit`: PASS;
- `git diff --check`: PASS;
- literal `npm run check`: both TypeScript projects PASS; ordinary partition
  271 files passed / 3,435 tests passed / 5 tests failed solely on four absent
  historical `outputs/` fixture paths; resource partition 20 files / 610
  assertions passed, with three known `onTaskUpdate` worker RPC timeout errors.
  Those external baseline failures were neither rewritten nor hidden by this
  milestone.

## Runtime and cost boundary

This implementation made no provider, image, audio, Vision, storage, database,
deployment, Order, payment or render call. It did not read a provider credential.
The existing failed Order and its anchor remain immutable runtime evidence.

## Unchanged behavior

- no prompt, Style reference, semantic rule or resemblance threshold changed;
- no anchor attempt count, fallback or retry policy changed;
- the photo-backed and Style 02 paths are unchanged;
- the payment and fake-payment flows are unchanged;
- no Production alias or deployment changed;
- no database schema or migration was added;
- the four pre-existing untracked Set Board artifacts were not staged or modified.

## Independent falsification targets

Claude Code should attempt to prove that:

1. a failed candidate can persist an empty, reordered, duplicated or unknown reason;
2. raw provider material, child appearance text, URLs, email addresses, tokens or
   unbounded notes can cross the diagnostic boundary;
3. a malformed present diagnostic can be promoted during recovery;
4. a legacy candidate without diagnostics is accidentally rejected;
5. the diagnostics alter pass/fail policy rather than merely report it;
6. a retired Claude ID remains on any production call path;
7. an unrelated Anthropic default, environment override, prompt, attempt budget or
   generation route changed;
8. the implementation caused a provider, deployment, database or render side effect.

No new Wizard Order is authorized by this evidence alone. The next operation is
one fresh photo-backed QA Order for Bar only after independent PASS and a fresh
deployment/model/photo/spend gate.
