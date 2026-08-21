/**
 * Anthropic model authority verified against the first-party model lifecycle
 * documentation on 2026-08-22. Keep defaults explicit so a retired model cannot
 * silently remain in production call paths.
 *
 * https://platform.claude.com/docs/en/about-claude/model-deprecations
 * https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions
 */
export const ANTHROPIC_MODEL_AUTHORITY_VERSION =
  'small-heroes-anthropic-model-authority/2026-08-22' as const;

export const ANTHROPIC_STORY_MODEL_DEFAULT = 'claude-opus-4-5' as const;
export const ANTHROPIC_SUPPORT_MODEL_DEFAULT = 'claude-sonnet-4-6' as const;
export const ANTHROPIC_VISION_MODEL_DEFAULT = 'claude-sonnet-4-6' as const;
export const ANTHROPIC_PATCH_MODEL_DEFAULT = 'claude-haiku-4-5-20251001' as const;

/** Active IDs/aliases intentionally used by checked-in runtime or tooling defaults. */
export const ANTHROPIC_AUTHORIZED_HARDCODED_MODEL_IDS = [
  ANTHROPIC_STORY_MODEL_DEFAULT,
  ANTHROPIC_SUPPORT_MODEL_DEFAULT,
  ANTHROPIC_VISION_MODEL_DEFAULT,
  ANTHROPIC_PATCH_MODEL_DEFAULT,
  'claude-sonnet-4-5-20250929',
] as const;

/** Retired first-party Claude API IDs that must never re-enter a runtime default. */
export const ANTHROPIC_RETIRED_MODEL_IDS = [
  'claude-sonnet-4-20250514',
  'claude-3-5-haiku-20241022',
] as const;
