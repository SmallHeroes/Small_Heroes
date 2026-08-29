import { PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION } from './preRenderBlueprintDraftSchema';

export const PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION =
  'pre-render-blueprint-authoring-prompt/v6' as const;
export const LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION =
  'pre-render-blueprint-authoring-prompt/v5' as const;
export const PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION =
  'pre-render-blueprint-repair-prompt/v6' as const;
export const LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION =
  'pre-render-blueprint-repair-prompt/v5' as const;
export const PRE_RENDER_BLUEPRINT_AUTHORING_PROVENANCE_VERSION =
  'pre-render-blueprint-authoring-provenance/v4' as const;
export const PRE_RENDER_BLUEPRINT_MAX_REPAIR_ATTEMPTS = 2 as const;

export type PreRenderBlueprintAuthoringPromptVersion =
  | typeof PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION
  | typeof LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION;
export type PreRenderBlueprintRepairPromptVersion =
  | typeof PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION
  | typeof LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION;

export function preRenderBlueprintAuthoringPromptVersionIsSupported(
  value: unknown,
): value is PreRenderBlueprintAuthoringPromptVersion {
  return (
    value === PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION ||
    value === LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION
  );
}

export function preRenderBlueprintRepairPromptVersionIsSupported(
  value: unknown,
): value is PreRenderBlueprintRepairPromptVersion {
  return (
    value === PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION ||
    value === LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION
  );
}

export interface PreRenderBlueprintAuthoringAttempt {
  attempt: number;
  errors: string[];
  draft: unknown;
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
