import { canonicalize } from '@/lib/canonical-json';
import {
  forbiddenPropIdsForPage,
  requiredPropIdsForPage,
} from '@/lib/visual-contract-compiler/propLifecycle';
import { parseStorySourceContent } from '@/lib/visual-contract-compiler/storySourceContent';
import { validateBookVisualContractTemplate } from '@/lib/visual-contract-compiler/validateTemplateContract';
import {
  ACTION_SEMANTIC_CATALOG,
  ACTION_SEMANTIC_CATALOG_VERSION,
} from '@/lib/visual-contract-compiler/actionSemanticCatalog';

import { canonicalJsonDigest, normalizedTextDigest, nonEmpty } from './integrity';
import {
  buildPreRenderBlueprintAuthoringAuthority,
  buildPreRenderBlueprintIdentity,
  finalizePreRenderBookVisualBlueprint,
  projectPreRenderBlueprintReconciliationSemanticContent,
  validatePreRenderBookVisualBlueprint,
} from './preRenderBlueprint';
import {
  PRE_RENDER_BLUEPRINT_COORDINATE_SPACE,
  PRE_RENDER_BLUEPRINT_PORTRAIT_ASPECT_RATIO,
  PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION,
  type BlueprintSpatialAffordance,
  type BlueprintWorldConnection,
  type PortraitBlueprintFrame,
  type PreRenderBlueprintIssue,
  type PreRenderBlueprintValidationContext,
  type PreRenderBookVisualBlueprint,
  type RevealSafeSupportingGeometry,
} from './preRenderBlueprintTypes';
import {
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
  PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
  PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION,
} from './preRenderBlueprintDraftSchema';
import { sourcePromptReconciliationIssues } from './sourcePromptReconciliation';
import {
  assertOpenAIResponsesStructuredOutputSchemaCompatible,
} from './openaiResponsesStructuredOutputSchemaCompatibility';

export const PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION =
  'pre-render-blueprint-authoring-prompt/v3' as const;
export const PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION =
  'pre-render-blueprint-repair-prompt/v3' as const;
export const PRE_RENDER_BLUEPRINT_MAX_REPAIR_ATTEMPTS = 2 as const;

type Obj = Record<string, unknown>;

export interface PreRenderBlueprintAuthoringConfig {
  model: string;
  reasoningEffort: string;
  maxOutputTokens: number;
}

export interface PreRenderBlueprintAuthoringCallOptions {
  model: string;
  reasoningEffort: string;
  maxOutputTokens: number;
  jsonSchema: {
    name: typeof PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME;
    schema: typeof PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA;
    strict: true;
  };
  noFallback: true;
}

/**
 * Deliberately injected. This module imports no provider and has no implicit live implementation.
 * Every invocation is one whole-book structured call; bounded repairs use the same whole-book schema.
 */
export type PreRenderBlueprintAuthoringCaller = (
  systemPrompt: string,
  userPrompt: string,
  options: PreRenderBlueprintAuthoringCallOptions,
) => Promise<unknown>;

export interface PreRenderBlueprintAuthoringAttempt {
  attempt: number;
  errors: string[];
  draft: unknown;
}

export interface PreRenderBlueprintAuthoringProvenance {
  version: 'pre-render-blueprint-authoring-provenance/v1';
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

export interface PreRenderBlueprintAuthoringResult {
  blueprint: PreRenderBookVisualBlueprint;
  provenance: PreRenderBlueprintAuthoringProvenance;
  repairAttempts: PreRenderBlueprintAuthoringAttempt[];
}

export class InvalidPreRenderBlueprintAuthoringInputError extends Error {
  constructor(readonly errors: string[]) {
    super(`Invalid Blueprint authoring input: ${errors.join('; ')}`);
    this.name = 'InvalidPreRenderBlueprintAuthoringInputError';
  }
}

export class PreRenderBlueprintAuthoringRepairExhaustedError extends Error {
  constructor(readonly attempts: PreRenderBlueprintAuthoringAttempt[]) {
    super(
      `Blueprint authoring repair exhausted after ${attempts.length} attempt(s); no candidate was returned`,
    );
    this.name = 'PreRenderBlueprintAuthoringRepairExhaustedError';
  }
}

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function lexicalCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function parseDraft(raw: unknown): unknown {
  if (typeof raw !== 'string') return clone(raw);
  return JSON.parse(raw) as unknown;
}

function normalizeNullableDraftFields(raw: unknown): unknown {
  const draft = clone(raw);
  if (!isObj(draft) || !isObj(draft.worldPlan)) return draft;
  const connections = Array.isArray(draft.worldPlan.connections)
    ? draft.worldPlan.connections
    : [];
  for (const connection of connections) {
    if (!isObj(connection)) continue;
    for (const endpoint of [connection.from, connection.to]) {
      if (isObj(endpoint) && endpoint.spatialNodeId === null) {
        delete endpoint.spatialNodeId;
      }
    }
  }
  const affordances = Array.isArray(draft.worldPlan.affordances)
    ? draft.worldPlan.affordances
    : [];
  for (const affordance of affordances) {
    if (
      isObj(affordance) &&
      affordance.kind === 'opening_clearance' &&
      affordance.openingSpatialNodeId === null
    ) {
      delete affordance.openingSpatialNodeId;
    }
  }
  const frames = Array.isArray(draft.frames) ? draft.frames : [];
  for (const frame of frames) {
    if (
      isObj(frame) &&
      isObj(frame.continuity) &&
      frame.continuity.connectionId === null
    ) {
      delete frame.continuity.connectionId;
    }
  }
  return draft;
}

function expectedPreviousFrameId(
  pageNumber: number,
  sourcePageNumbers: readonly number[],
): string {
  const offset = sourcePageNumbers.indexOf(pageNumber);
  return offset <= 0
    ? 'frame:cover'
    : `frame:page:${sourcePageNumbers[offset - 1]}`;
}

function deterministicFrameOverlay(args: {
  raw: Obj;
  context: PreRenderBlueprintValidationContext;
}): PortraitBlueprintFrame {
  const { raw, context } = args;
  const kind = raw.kind;
  const pageNumber = raw.pageNumber;
  const isCover = kind === 'cover' && pageNumber === null;
  const isPage =
    kind === 'page' && Number.isInteger(pageNumber) && Number(pageNumber) >= 1;
  if (!isCover && !isPage) {
    throw new Error('draft frame must use cover/null or page/positive-integer identity');
  }

  const page = isPage
    ? context.template.pageContracts.find(
        (candidate) => candidate.pageNumber === pageNumber,
      )
    : null;
  const authority = isCover ? context.template.coverContract : page;
  if (!authority?.zoneId || !Array.isArray(authority.castIds)) {
    throw new Error(`draft frame ${String(kind)}:${String(pageNumber)} has no complete Visual Contract authority`);
  }

  const requiredPropIds = isCover
    ? []
    : requiredPropIdsForPage(context.template, Number(pageNumber)).sort(
        lexicalCompare,
      );
  const forbiddenPropIds = isCover
    ? context.template.recurringProps
        .filter((prop) => prop.firstRevealPage !== undefined)
        .map((prop) => prop.id)
        .sort(lexicalCompare)
    : forbiddenPropIdsForPage(context.template, Number(pageNumber)).sort(
        lexicalCompare,
      );
  const continuityRaw = isObj(raw.continuity) ? raw.continuity : {};
  const transitionKind = isCover ? 'steady' : page?.transition?.kind ?? 'steady';
  const connectionId =
    transitionKind !== 'steady' && nonEmpty(continuityRaw.connectionId)
      ? continuityRaw.connectionId
      : undefined;

  const common = {
    id: isCover ? 'frame:cover' : `frame:page:${String(pageNumber)}`,
    aspectRatio: { ...PRE_RENDER_BLUEPRINT_PORTRAIT_ASPECT_RATIO },
    coordinateSpace: PRE_RENDER_BLUEPRINT_COORDINATE_SPACE,
    narrative: clone(raw.narrative) as PortraitBlueprintFrame['narrative'],
    locationId: authority.locationId,
    zoneId: authority.zoneId,
    castIds: [...authority.castIds],
    propLifecycle: { requiredPropIds, forbiddenPropIds },
    placements: clone(raw.placements) as PortraitBlueprintFrame['placements'],
    camera: clone(raw.camera) as PortraitBlueprintFrame['camera'],
    textSafeRegion: clone(raw.textSafeRegion) as PortraitBlueprintFrame['textSafeRegion'],
    affordanceIds: clone(raw.affordanceIds) as string[],
    continuity: {
      previousFrameId: isCover
        ? null
        : expectedPreviousFrameId(
            Number(pageNumber),
            context.source.pageNumbers,
          ),
      transitionKind,
      ...(connectionId ? { connectionId } : {}),
      carryoverRefs: clone(continuityRaw.carryoverRefs) as PortraitBlueprintFrame['continuity']['carryoverRefs'],
    },
  };
  return isCover
    ? { ...common, kind: 'cover' }
    : { ...common, kind: 'page', pageNumber: Number(pageNumber) };
}

export function assemblePreRenderBookVisualBlueprintFromDraft(args: {
  draft: unknown;
  context: PreRenderBlueprintValidationContext;
}): PreRenderBookVisualBlueprint {
  const normalized = normalizeNullableDraftFields(args.draft);
  if (!isObj(normalized) || !isObj(normalized.worldPlan) || !Array.isArray(normalized.frames)) {
    throw new Error('whole-book draft must contain worldPlan and frames arrays');
  }
  const authoringAuthority = buildPreRenderBlueprintAuthoringAuthority({
    storyKey: args.context.template.storyKey ?? '',
    source: args.context.source,
    template: args.context.templateIdentity,
    reconciliation: args.context.reconciliation,
    reconciliationArtifactPath: args.context.reconciliationArtifactPath,
    style: args.context.style,
  });
  return finalizePreRenderBookVisualBlueprint({
    version: PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION,
    identity: buildPreRenderBlueprintIdentity({ authority: authoringAuthority }),
    visualContract: clone(args.context.template),
    worldPlan: {
      connections: clone(
        normalized.worldPlan.connections,
      ) as BlueprintWorldConnection[],
      affordances: clone(
        normalized.worldPlan.affordances,
      ) as BlueprintSpatialAffordance[],
      revealSafeSupportingGeometry: clone(
        normalized.worldPlan.revealSafeSupportingGeometry,
      ) as RevealSafeSupportingGeometry[],
    },
    frames: normalized.frames.map((frame) => {
      if (!isObj(frame)) throw new Error('every draft frame must be an object');
      return deterministicFrameOverlay({ raw: frame, context: args.context });
    }),
  });
}

export function preRenderBlueprintAuthoringInputErrors(
  context: PreRenderBlueprintValidationContext,
  config: PreRenderBlueprintAuthoringConfig,
): string[] {
  const errors: string[] = [];
  if (!nonEmpty(config.model)) errors.push('authoring model is required');
  if (!nonEmpty(config.reasoningEffort)) {
    errors.push('authoring reasoningEffort is required');
  }
  if (
    !Number.isInteger(config.maxOutputTokens) ||
    config.maxOutputTokens < 1
  ) {
    errors.push('authoring maxOutputTokens must be a positive integer');
  }
  const templateValidation = validateBookVisualContractTemplate(context.template);
  if (!templateValidation.ok) {
    errors.push(
      ...templateValidation.errors.map(
        (entry) => `Visual Contract: ${entry}`,
      ),
    );
  }
  const templateDigest = canonicalJsonDigest(context.template);
  if (context.templateIdentity.digest !== templateDigest) {
    errors.push('Visual Contract identity digest is stale');
  }
  if (
    context.templateIdentity.schemaVersion !== context.template.schemaVersion
  ) {
    errors.push('Visual Contract schema identity is stale');
  }
  if (canonicalJsonDigest(context.styleContent) !== context.style.digest) {
    errors.push('style authority content digest is stale');
  }
  try {
    const parsed = parseStorySourceContent(context.rawStorySource);
    if (
      normalizedTextDigest(context.rawStorySource) !== context.source.digest ||
      parsed.pages.length !== context.source.pageCount ||
      stableJson(parsed.pages.map((page) => page.pageNumber)) !==
        stableJson(context.source.pageNumbers)
    ) {
      errors.push('Story Source identity/content is stale');
    }
  } catch (error) {
    errors.push(
      `Story Source cannot be parsed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const reconciliationIssues = sourcePromptReconciliationIssues({
    raw: context.reconciliation,
    storyKey: context.template.storyKey ?? '',
    sourceIdentity: context.source,
    rawStorySource: context.rawStorySource,
    template: context.template,
    templateDigest,
    authoredCoverAuthority: context.authoredCoverAuthority,
    requireComplete: true,
  });
  errors.push(
    ...reconciliationIssues.map(
      (entry) => `Source Prompt Reconciliation: ${entry.code}: ${entry.message}`,
    ),
  );
  return errors;
}

export function buildPreRenderBlueprintAuthoringSystemPrompt(): string {
  const actionCatalog = ACTION_SEMANTIC_CATALOG.map(
    (definition) =>
      `${definition.predicate} (subjects=${definition.subjectKinds.join('|')}; object=${definition.objectRule}; objectKinds=${definition.objectKinds.join('|') || 'none'}; spatialResult=${definition.spatialEffectRule}; laterality=${definition.lateralityAllowed ? 'allowed' : 'forbidden'})`,
  ).join(', ');
  return [
    "You author one whole-book, portrait 2:3 schematic Blueprint for a children's picture book.",
    'Return exactly one strict JSON object matching the supplied schema. Never author one page at a time.',
    '',
    'AUTHORITY PRECEDENCE (highest first):',
    '1. exact Story Source prose and authored product authority;',
    '2. structured Visual Contract;',
    '3. approved Source Prompt Reconciliation;',
    '4. this Blueprint draft;',
    '5. historical imageDirection, which is advisory presentation evidence only.',
    '',
    'Historical direction may affect only approved action, interaction, expression, camera, composition, or',
    'staging beats. It never controls world, location, zone, cast, wardrobe, props, reveal timing, or prohibitions.',
    'Every preserved/superseded conflict is already explicit in reconciliation; do not invent another disposition.',
    '',
    `ACTION SEMANTIC CATALOG (${ACTION_SEMANTIC_CATALOG_VERSION}; closed, no free text):`,
    actionCatalog,
    'Every action_space must explicitly support the typed subject kind, predicate, entity participants, and any',
    'closed spatial direction/relation. Every required spatial action needs both an action evidence placement and',
    'an action_destination placement inside its unique action space. Relation movement also needs one exact typed',
    'spatialTargetRegion whose geometry proves the destination relation; prose is never feasibility evidence.',
    'maximumActors counts only unique cast entity subjects, never objects, prop subjects, or source phenomena.',
    'All supported predicate/subject/result values must come from this catalog. Blueprint support does not',
    'self-approve Action Semantic Coverage or Semantic Reconciliation.',
    '',
    'Author the complete connection graph, spatial affordances, reveal-safe supporting geometry, and one frame',
    'for the cover plus every exact Story Source page. Each frame must show text-safe layout, placements, actions,',
    'props, camera access, transitions, and safety support. The compiler will overwrite all upstream deterministic',
    'identity, coverage, aspect-ratio, location/zone/cast, lifecycle, and transition-kind fields after this call.',
    'Do not include Board identities, image assets, render prompts, approval, lifecycle timestamps, or prose outside JSON.',
  ].join('\n');
}

export function buildPreRenderBlueprintAuthoringUserPrompt(
  context: PreRenderBlueprintValidationContext,
): string {
  return [
    `storyKey: ${context.template.storyKey ?? ''}`,
    `styleId: ${context.style.styleId}`,
    `styleAuthorityDigest: ${context.style.digest}`,
    `authoringAuthorityInputs: source=${context.source.digest} contract=${context.templateIdentity.digest}`,
    '',
    'EXACT STORY SOURCE:',
    context.rawStorySource,
    '',
    'STRUCTURED VISUAL CONTRACT (higher authority than Blueprint):',
    stableJson(context.template),
    '',
    'APPROVED SOURCE PROMPT RECONCILIATION SEMANTICS:',
    stableJson(
      projectPreRenderBlueprintReconciliationSemanticContent(
        context.reconciliation,
      ),
    ),
    '',
    'IMMUTABLE STYLE AUTHORITY CONTENT:',
    stableJson(context.styleContent),
  ].join('\n');
}

function buildRepairSystemPrompt(): string {
  return [
    'Repair one invalid WHOLE-BOOK Blueprint draft.',
    'Return the complete corrected strict JSON object, not a page fragment.',
    'Preserve valid content and fix every supplied deterministic validation error.',
    'The same authority precedence and prohibitions from the initial call remain binding.',
  ].join('\n');
}

function buildRepairUserPrompt(args: {
  previousDraft: unknown;
  errors: string[];
  originalUserPrompt: string;
}): string {
  return [
    'VALIDATION ERRORS:',
    ...args.errors.map((error, index) => `${index + 1}. ${error}`),
    '',
    'PREVIOUS WHOLE-BOOK DRAFT:',
    typeof args.previousDraft === 'string'
      ? args.previousDraft
      : stableJson(args.previousDraft),
    '',
    'ORIGINAL AUTHORITATIVE INPUTS:',
    args.originalUserPrompt,
  ].join('\n');
}

function issueText(issues: readonly PreRenderBlueprintIssue[]): string[] {
  return issues.map(
    (entry) =>
      `${entry.code}${entry.field ? ` (${entry.field})` : ''}: ${entry.message}`,
  );
}

export async function compilePreRenderBookVisualBlueprint(
  context: PreRenderBlueprintValidationContext,
  config: PreRenderBlueprintAuthoringConfig,
  deps: { callAuthor: PreRenderBlueprintAuthoringCaller },
): Promise<PreRenderBlueprintAuthoringResult> {
  const inputErrors = preRenderBlueprintAuthoringInputErrors(context, config);
  if (inputErrors.length > 0) {
    throw new InvalidPreRenderBlueprintAuthoringInputError(inputErrors);
  }
  assertOpenAIResponsesStructuredOutputSchemaCompatible(
    PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
  );

  const systemPrompt = buildPreRenderBlueprintAuthoringSystemPrompt();
  const userPrompt = buildPreRenderBlueprintAuthoringUserPrompt(context);
  const callOptions: PreRenderBlueprintAuthoringCallOptions = {
    model: config.model,
    reasoningEffort: config.reasoningEffort,
    maxOutputTokens: config.maxOutputTokens,
    jsonSchema: {
      name: PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
      schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
      strict: true,
    },
    noFallback: true,
  };
  const repairAttempts: PreRenderBlueprintAuthoringAttempt[] = [];
  let callCount = 0;
  let rawDraft: unknown;
  try {
    callCount += 1;
    rawDraft = await deps.callAuthor(systemPrompt, userPrompt, callOptions);
  } catch (error) {
    throw new PreRenderBlueprintAuthoringRepairExhaustedError([
      {
        attempt: 1,
        errors: [
          `authoring call failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
        draft: null,
      },
    ]);
  }

  for (let attempt = 1; attempt <= PRE_RENDER_BLUEPRINT_MAX_REPAIR_ATTEMPTS + 1; attempt += 1) {
    let parsedDraft: unknown = rawDraft;
    let candidate: PreRenderBookVisualBlueprint | null = null;
    let errors: string[] = [];
    try {
      parsedDraft = parseDraft(rawDraft);
      candidate = assemblePreRenderBookVisualBlueprintFromDraft({
        draft: parsedDraft,
        context,
      });
      const validation = validatePreRenderBookVisualBlueprint(candidate, context);
      if (!validation.ok) errors = issueText(validation.issues);
    } catch (error) {
      errors = [
        `draft assembly failed: ${error instanceof Error ? error.message : String(error)}`,
      ];
    }

    if (candidate && errors.length === 0) {
      return {
        blueprint: candidate,
        provenance: {
          version: 'pre-render-blueprint-authoring-provenance/v1',
          blueprintDigest: candidate.digest,
          authoringAuthorityDigest:
            candidate.identity.authoringAuthority.digest,
          model: config.model,
          reasoningEffort: config.reasoningEffort,
          maxOutputTokens: config.maxOutputTokens,
          noFallback: true,
          draftSchemaVersion: PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION,
          promptVersion: PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION,
          ...(attempt > 1
            ? { repairPromptVersion: PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION }
            : {}),
          passingAttempt: attempt,
          callCount,
          systemPromptDigest: canonicalJsonDigest(systemPrompt),
          userPromptDigest: canonicalJsonDigest(userPrompt),
        },
        repairAttempts,
      };
    }

    repairAttempts.push({ attempt, errors, draft: parsedDraft });
    if (attempt > PRE_RENDER_BLUEPRINT_MAX_REPAIR_ATTEMPTS) {
      throw new PreRenderBlueprintAuthoringRepairExhaustedError(
        repairAttempts,
      );
    }
    try {
      callCount += 1;
      rawDraft = await deps.callAuthor(
        buildRepairSystemPrompt(),
        buildRepairUserPrompt({
          previousDraft: parsedDraft,
          errors,
          originalUserPrompt: userPrompt,
        }),
        callOptions,
      );
    } catch (error) {
      repairAttempts.push({
        attempt: attempt + 1,
        errors: [
          `repair call failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
        draft: null,
      });
      throw new PreRenderBlueprintAuthoringRepairExhaustedError(
        repairAttempts,
      );
    }
  }

  throw new PreRenderBlueprintAuthoringRepairExhaustedError(repairAttempts);
}
