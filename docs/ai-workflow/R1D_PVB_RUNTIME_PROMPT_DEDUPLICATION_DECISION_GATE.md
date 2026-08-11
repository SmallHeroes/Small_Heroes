# R1D PVB runtime-prompt deduplication — Decision Gate

**Date:** 2026-08-11
**Trigger:** Bunny/Bar page 4 was rejected before image generation because the prompt was 34,687 characters; the exact Runtime Blueprint block appeared three times.

## Decision

1. Keep exactly one serialized Runtime Blueprint frame in the provider prompt.
2. Keep exactly one Visual Contract facts-only block.
3. Use the Blueprint's sanitized narrative summary, not a second serialized frame, as the human-readable scene sentence and expression input.
4. Preserve frame digest, placements, camera, cast, props, continuity, world geometry, facts and all identity/style locks within their surviving authorities.
5. Do not truncate, summarize or cap any authoritative field.
6. Apply the fix generally to every PVB Style 01 page; add no story, child, companion or page literal.
7. Add a provider-boundary regression requiring exactly one Runtime Blueprint marker and excluding untrusted overrides.
8. Resume only pages not already rendered; pages 1–3 remain immutable evidence.
9. Stop if the bounded completion attempt fails again.

## Validation and rollback

Run the direct runtime-world-authority/provider tests, the expression assembly tests, TypeScript and `git diff --check`. Rollback is a focused revert of the deduplication commit; existing rendered bytes are unaffected. No model, schema, Blueprint, budget, retry, fallback, Vision, pricing or production-release policy changes.
