import { PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION } from './preRenderBlueprintDraftSchema';
import type { PreRenderBlueprintRepairDiagnostic } from './preRenderBlueprintAuthoring';
import { BLUEPRINT_AUTHORING_MAX_REPAIRS } from './blueprintAuthoringPolicy';

export const PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V7 =
  'pre-render-blueprint-authoring-prompt/v7' as const;
export const PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION =
  PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V7;
export const LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V6 =
  'pre-render-blueprint-authoring-prompt/v6' as const;
/** Source-compatibility alias only; historical registries use the absolute name. */
export const LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION =
  LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V6;
export const LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V5 =
  'pre-render-blueprint-authoring-prompt/v5' as const;
export const PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V7 =
  '1cbf39920dba3241dee18e6e0a464a811f009c32d7031d2dde53bace8aa0a21b' as const;
export const PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V7 =
  2_463 as const;
export const LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V5 =
  'e0c01e9907594c38f7ee3fbedb993efff5071655bef29746cfde1b5f071c8227' as const;
export const LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V5 =
  8_419 as const;
export const LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6 =
  '1b6accf0f522b02279db8aa87c388d4ef75d951e71dd21c24a93fb2babfb7051' as const;
export const LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V6 =
  2_144 as const;
export const PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V8 =
  'pre-render-blueprint-repair-prompt/v8' as const;
export const PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION =
  PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V8;
export const LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V7 =
  'pre-render-blueprint-repair-prompt/v7' as const;
/** Source-compatibility alias only; frozen programs use the absolute legacy name. */
export const PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V7 =
  LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V7;
export const LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V6 =
  'pre-render-blueprint-repair-prompt/v6' as const;
/** Source-compatibility alias only; historical registries use the absolute name. */
export const LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION =
  LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V6;
export const LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V5 =
  'pre-render-blueprint-repair-prompt/v5' as const;
export const PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_DIGEST_V7 =
  'fdb174b64a7836bfe1dfc76323b62a9bd157bab5f188b4b2b74932435b8fcb8a' as const;
export const PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_UTF8_BYTES_V7 =
  2_614 as const;
export const LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_DIGEST_V6 =
  '63ada2e930c77d5cd365ad649a83aa902536e51b12daf2981cf86a2176317d33' as const;
export const LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_UTF8_BYTES_V6 =
  2_290 as const;
export const PRE_RENDER_BLUEPRINT_AUTHORING_PROVENANCE_VERSION =
  'pre-render-blueprint-authoring-provenance/v4' as const;
export const PRE_RENDER_BLUEPRINT_MAX_REPAIR_ATTEMPTS =
  BLUEPRINT_AUTHORING_MAX_REPAIRS;

export type PreRenderBlueprintAuthoringPromptVersion =
  | typeof PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V7
  | typeof LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V6
  | typeof LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V5;
export type PreRenderBlueprintRepairPromptVersion =
  | typeof PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V8
  | typeof LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V7
  | typeof LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V6
  | typeof LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V5;

export interface PreRenderBlueprintHistoricalPromptEvidenceProfile {
  promptVersion: PreRenderBlueprintAuthoringPromptVersion;
  repairPromptVersion: PreRenderBlueprintRepairPromptVersion;
  initialSystemPromptDigest: string;
  initialSystemPromptUtf8Bytes: number;
  repairSystemPromptDigest: string | null;
  repairSystemPromptUtf8Bytes: number | null;
}

export function preRenderBlueprintSystemPromptUtf8BytesForDigest(
  systemPromptDigest: unknown,
): number | null {
  if (
    systemPromptDigest === PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V7
  ) return PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V7;
  if (
    systemPromptDigest === PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_DIGEST_V7
  ) return PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_UTF8_BYTES_V7;
  if (
    systemPromptDigest ===
    LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6
  ) return LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V6;
  if (
    systemPromptDigest ===
    LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_DIGEST_V6
  ) return LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_UTF8_BYTES_V6;
  if (
    systemPromptDigest ===
    LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V5
  ) return LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V5;
  return null;
}

export function legacyPreRenderBlueprintPromptEvidenceForSystemPromptDigest(
  systemPromptDigest: unknown,
): PreRenderBlueprintHistoricalPromptEvidenceProfile | null {
  if (
    systemPromptDigest ===
    LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V5
  ) {
    return {
      promptVersion: LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V5,
      repairPromptVersion: LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V5,
      initialSystemPromptDigest:
        LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V5,
      initialSystemPromptUtf8Bytes:
        LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V5,
      // No immutable prompt-v5 repair receipt exists in the durable corpus.
      // Fail multi-attempt v5 history closed rather than inventing its identity.
      repairSystemPromptDigest: null,
      repairSystemPromptUtf8Bytes: null,
    };
  }
  if (
    systemPromptDigest ===
    LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6
  ) {
    return {
      promptVersion: LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V6,
      repairPromptVersion: LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V6,
      initialSystemPromptDigest:
        LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6,
      initialSystemPromptUtf8Bytes:
        LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V6,
      repairSystemPromptDigest:
        LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_DIGEST_V6,
      repairSystemPromptUtf8Bytes:
        LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_SYSTEM_PROMPT_UTF8_BYTES_V6,
    };
  }
  return null;
}

/**
 * Absolute historical prompt identity registry for programless request
 * generations. A request version alone cannot identify the prompt: request-v4
 * existed during both the prompt-v5 and prompt-v6 eras. Completed evidence
 * therefore derives its prompt versions from the immutable first-attempt
 * system-prompt digest and rejects unknown history rather than guessing via a
 * mutable "legacy" alias.
 */
export function legacyPreRenderBlueprintPromptVersionsForSystemPromptDigest(
  systemPromptDigest: unknown,
): {
  promptVersion: PreRenderBlueprintAuthoringPromptVersion;
  repairPromptVersion: PreRenderBlueprintRepairPromptVersion;
} | null {
  const profile = legacyPreRenderBlueprintPromptEvidenceForSystemPromptDigest(
    systemPromptDigest,
  );
  return profile
    ? {
        promptVersion: profile.promptVersion,
        repairPromptVersion: profile.repairPromptVersion,
      }
    : null;
}

export function preRenderBlueprintAuthoringPromptVersionIsSupported(
  value: unknown,
): value is PreRenderBlueprintAuthoringPromptVersion {
  return (
    value === PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V7 ||
    value === LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V6 ||
    value === LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V5
  );
}

export function preRenderBlueprintRepairPromptVersionIsSupported(
  value: unknown,
): value is PreRenderBlueprintRepairPromptVersion {
  return (
    value === PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V8 ||
    value === LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V7 ||
    value === LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V6 ||
    value === LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION_V5
  );
}

export interface PreRenderBlueprintAuthoringAttempt {
  attempt: number;
  errors: string[];
  draft: unknown;
  /**
   * Structured validation diagnostics for this attempt, carried in-memory only so
   * a failure-path observability capture can build a sanitized structural census.
   * Never persisted into a receipt; the persisted receipt keeps sanitized
   * category codes + count. Absent when no structured diagnostics were produced
   * (e.g. a raw provider/transport call failure).
   */
  diagnostics?: PreRenderBlueprintRepairDiagnostic[];
}

export interface PreRenderBlueprintAuthoringProvenance {
  version: typeof PRE_RENDER_BLUEPRINT_AUTHORING_PROVENANCE_VERSION;
  blueprintDigest: string;
  authoringAuthorityDigest: string;
  model: string;
  reasoningEffort: string;
  maxOutputTokens: number;
  noFallback: true;
  draftSchemaVersion: typeof PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION;
  promptVersion: PreRenderBlueprintAuthoringPromptVersion;
  repairPromptVersion?: PreRenderBlueprintRepairPromptVersion;
  passingAttempt: number;
  callCount: number;
  systemPromptDigest: string;
  userPromptDigest: string;
}
