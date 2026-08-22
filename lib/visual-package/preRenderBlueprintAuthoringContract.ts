import { PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION } from './preRenderBlueprintDraftSchema';

export const PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION =
  'pre-render-blueprint-authoring-prompt/v5' as const;
export const PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION =
  'pre-render-blueprint-repair-prompt/v5' as const;
export const PRE_RENDER_BLUEPRINT_AUTHORING_PROVENANCE_VERSION =
  'pre-render-blueprint-authoring-provenance/v4' as const;
export const PRE_RENDER_BLUEPRINT_MAX_REPAIR_ATTEMPTS = 2 as const;

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
  promptVersion: typeof PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION;
  repairPromptVersion?: typeof PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION;
  passingAttempt: number;
  callCount: number;
  systemPromptDigest: string;
  userPromptDigest: string;
}
