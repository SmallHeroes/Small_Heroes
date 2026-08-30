import { canonicalize } from '@/lib/canonical-json';
import {
  forbiddenPropIdsForPage,
  requiredPropIdsForPage,
} from '@/lib/visual-contract-compiler/propLifecycle';
import { parseStorySourceContent } from '@/lib/visual-contract-compiler/storySourceContent';
import { validateBookVisualContractTemplate } from '@/lib/visual-contract-compiler/validateTemplateContract';

import { canonicalJsonDigest, normalizedTextDigest, nonEmpty } from './integrity';
import {
  buildPreRenderBlueprintAuthoringAuthority,
  buildPreRenderBlueprintIdentity,
  finalizePreRenderBookVisualBlueprint,
  validatePreRenderBookVisualBlueprint,
} from './preRenderBlueprint';
import {
  PRE_RENDER_BLUEPRINT_COORDINATE_SPACE,
  PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION,
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
import { canonicalPreRenderBlueprintTextSafeRegion } from './preRenderBlueprintLayoutPolicy';
import { sourcePromptReconciliationIssues } from './sourcePromptReconciliation';
import {
  serializePreRenderBlueprintProviderWire,
  serializePreRenderBlueprintRepairWire,
} from './preRenderBlueprintProviderWire';
import {
  assertOpenAIResponsesStructuredOutputSchemaCompatible,
} from './openaiResponsesStructuredOutputSchemaCompatibility';
import {
  PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION,
  PRE_RENDER_BLUEPRINT_AUTHORING_PROVENANCE_VERSION,
  PRE_RENDER_BLUEPRINT_MAX_REPAIR_ATTEMPTS,
  PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION,
  type PreRenderBlueprintAuthoringAttempt,
  type PreRenderBlueprintAuthoringProvenance,
} from './preRenderBlueprintAuthoringContract';
import {
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
  blueprintAuthoringInputAccounting,
  type BlueprintAuthoringInputAccounting,
} from './blueprintAuthoringPolicy';
import {
  admitBlueprintAuthoringInputTokens,
  type BlueprintAuthoringInputTokenCounter,
} from './blueprintAuthoringInputTokenAdmission';

export {
  PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION,
  PRE_RENDER_BLUEPRINT_AUTHORING_PROVENANCE_VERSION,
  PRE_RENDER_BLUEPRINT_MAX_REPAIR_ATTEMPTS,
  PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION,
  type PreRenderBlueprintAuthoringAttempt,
  type PreRenderBlueprintAuthoringProvenance,
} from './preRenderBlueprintAuthoringContract';

type Obj = Record<string, unknown>;

export interface PreRenderBlueprintAuthoringConfig {
  model: string;
  reasoningEffort: string;
  maxOutputTokens: number;
  /**
   * Explicit opt-in for materially enforced composition. Omit only when an
   * authority-preserving migration must retain a historical Blueprint's exact
   * validation semantics.
   */
  compositionPolicyVersion?:
    | typeof PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION
    | null;
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

export class PreRenderBlueprintRepairInputNotAdmissibleError extends Error {
  constructor(
    readonly attempts: PreRenderBlueprintAuthoringAttempt[],
    readonly inputAccounting: BlueprintAuthoringInputAccounting,
  ) {
    super(
      `Blueprint repair input is not admissible against the ${BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS} token ceiling (conservative input-token upper bound ${inputAccounting.estimatedBytes}; exact provider count not available or over ceiling)`,
    );
    this.name = 'PreRenderBlueprintRepairInputNotAdmissibleError';
  }
}

export type PreRenderBlueprintRepairDiagnostic =
  | PreRenderBlueprintIssue
  | {
      code: 'draft_assembly_failed';
      message: string;
      field?: string;
      expected?: unknown;
      actual?: unknown;
    };

export type GroupedPreRenderBlueprintRepairDiagnostic = [
  code: PreRenderBlueprintRepairDiagnostic['code'],
  field: string | null,
  message: string,
  expected: readonly [present: 0 | 1, value: unknown],
  actual: readonly [present: 0 | 1, value: unknown],
  count: number,
];

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

/**
 * Lossless grouping for the provider surface. Only byte-identical complete
 * diagnostic identities collapse; no code, field, cause, expected value, or
 * actual value is discarded.
 */
export function groupPreRenderBlueprintRepairDiagnostics(
  diagnostics: readonly PreRenderBlueprintRepairDiagnostic[],
): GroupedPreRenderBlueprintRepairDiagnostic[] {
  const grouped = new Map<
    string,
    GroupedPreRenderBlueprintRepairDiagnostic
  >();
  for (const diagnostic of diagnostics) {
    const expected = Object.prototype.hasOwnProperty.call(
      diagnostic,
      'expected',
    )
      ? ([1, diagnostic.expected ?? null] as const)
      : ([0, null] as const);
    const actual = Object.prototype.hasOwnProperty.call(
      diagnostic,
      'actual',
    )
      ? ([1, diagnostic.actual ?? null] as const)
      : ([0, null] as const);
    const identity = [
      diagnostic.code,
      diagnostic.field ?? null,
      diagnostic.message,
      expected,
      actual,
    ] as const;
    const key = stableJson(identity);
    const existing = grouped.get(key);
    if (existing) {
      existing[5] += 1;
    } else {
      grouped.set(key, [...identity, 1]);
    }
  }
  return [...grouped.values()];
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
    textSafeRegion: canonicalPreRenderBlueprintTextSafeRegion(
      isCover ? 'cover' : 'page',
    ),
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
  compositionPolicyVersion?:
    | typeof PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION
    | null;
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
    ...(args.compositionPolicyVersion
      ? { compositionPolicyVersion: args.compositionPolicyVersion }
      : {}),
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
  if (
    config.compositionPolicyVersion !== undefined &&
    config.compositionPolicyVersion !== null &&
    config.compositionPolicyVersion !==
      PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION
  ) {
    errors.push('authoring compositionPolicyVersion is unsupported');
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
    actionSemanticCoverage: context.actionSemanticCoverage,
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
  return [
    "Author one whole-book portrait 2:3 schematic Blueprint for a children's book.",
    'Return exactly one strict-schema JSON object, never a page fragment or prose.',
    'BLUEPRINT_PROVIDER_WIRE is validated compiler authority: preserve IDs and never infer omitted authority.',
    'TUPLES: story=[page,text]; ref=[kind,id]; cast=[id,role,label,wardrobe,forbidden,stateAuthority];',
    'prop=[id,name,description,scale,firstRevealPage]; location=[id,name,description,topology,anchors];',
    'zone=[id,locationId,name,description,nodesOrLegacyGeometry,relations]; node=[id,kind,description,boundRef];',
    'cover=[locationId,zoneId,castIds,mustShow,mustNotShow].',
    'Page keys p/loc/zone/cast/show/hide/cam/shot/transition/sameLoc/props/actions/safety/castState/',
    'childWardrobe/companionState are binding. prop=[id,state,visibility,stateId,anchorId];',
    'transition=[kind,fromZone,toZone,cue]; safety=[subjectId,relation,targetRef];',
    'castState=[castId,bodyState,injectionArm,bandageArm,freeHand].',
    "Action sub is ['entity',ref], ['cast_group',ids], or ['source',evidenceId,phrase]. effect is",
    "['direction',value] or ['relation',value,targetRef]; state=[relation,targetRef].",
    'Build the complete connection graph, affordances, reveal-safe geometry, cover frame, and every page frame.',
    'Use only declared IDs. Each action_space must support exact subject/predicate/entities/direction/relation;',
    'cast_group includes every member and placement. Movement requires action plus action_destination placements;',
    'relation movement requires spatialTargetRegion. Static constraints use current placements only.',
    'maximumActors counts cast subjects/group members only. Prose never proves geometry.',
    'Reserve cover x0,y0,w1000,h250 and body x0,y750,w1000,h250; keep key cast/actions/destinations/props clear.',
    'For 8+ pages use a true close_up, a wide, 3+ shot types, 3+ angles, and no shot repeated 3 pages.',
    'Geometry must justify camera labels; largest cast scale must be at least 3.5x the smallest.',
    'Compiler overwrites identity, coverage, aspect ratio, location/zone/cast, lifecycle, text-safe, previous-frame,',
    'and transition-kind fields. Never output Boards, assets, render prompts, approvals, timestamps, or extra prose.',
  ].join('\n');
}

export function buildPreRenderBlueprintAuthoringUserPrompt(
  context: PreRenderBlueprintValidationContext,
): string {
  return `BLUEPRINT_PROVIDER_WIRE:\n${serializePreRenderBlueprintProviderWire(context)}`;
}

export function buildPreRenderBlueprintRepairSystemPrompt(): string {
  return [
    'Repair one invalid WHOLE-BOOK Blueprint draft.',
    'Return the complete corrected strict JSON object, not a page fragment.',
    'Preserve valid creative content and fix every supplied deterministic validation error.',
    'Grouped diagnostics are lossless [code,field,message,expectedSlot,actualSlot,count] identities; each slot is',
    '[presentFlag,value], and count collapses only',
    'byte-identical duplicates. Fix every row and every affected occurrence.',
    'REPAIR_WIRE contains a compact authority index plus the complete previous provider-owned draft.',
    'Authority refs list allowed cast, props, zones/spatial nodes, and anchors. Authority pages are',
    '[page,location,zone,castIds,transition,propPlacement[id,visibility,anchor],actions,safety]. Repair action tuples',
    'are [id,subject,predicate,object,effect,state,polarity,side]; repair source subjects omit already-bound prose.',
    'Draft world is [connections,affordances,revealSafeGeometry]. Connection tuples are',
    '[id,kind,from[zone,node],to[zone,node],bidirectional,traversalIds,openingIds,safeBoundaryIds].',
    'Every affordance starts [id,kind,zone,footprint[x,y,w,h],consumers,...kindFields]. Consumer tuples use',
    "['f',frameId], ['a',page,checkId], ['p',page,propId], ['t',page], or",
    "['s',page,subjectId,relation,targetRef]. Kind fields follow the supplied output schema in schema order.",
    'Affordance tails: traversal=[connectionId,direction,minClearance]; opening=[connectionId,openingNode,clearance];',
    'placement_support=[supportRef,supportedRefs,maxOccupants]; action_space=[predicates,subjectKinds,entities,',
    'directions,relations,constraintRelations,targetRegions,maxActors]; camera=[visibleRegion];',
    'safe_boundary=[targetRef,permittedRegion]. Reveal-safe geometry=[id,zone,node,supportedPropIds].',
    'Draft frames are [kind,pageNumber,narrative[purpose,summary],placements,camera,affordanceIds,continuity].',
    'Placements are [id,subject[kind,id],region[x,y,w,h],depth,importance]. Camera is',
    '[shot,angle,affordanceId]. Continuity is [connectionId,carryoverRefs]. Re-expand every tuple into the',
    'named strict-schema object. Preserve exact IDs and unchanged valid values.',
    'The compiler owns text-safe geometry: keep the exact cover top 250 band and every body-page bottom 250 band',
    'clear of all key cast, action, action-destination, and required-prop placements; never return textSafeRegion.',
  ].join('\n');
}

export function buildPreRenderBlueprintRepairUserPrompt(args: {
  context: PreRenderBlueprintValidationContext;
  previousDraft: unknown;
  diagnostics: readonly PreRenderBlueprintRepairDiagnostic[];
}): string {
  return [
    'GROUPED VALIDATION DIAGNOSTICS [code,field,message,expectedSlot,actualSlot,count]:',
    stableJson(groupPreRenderBlueprintRepairDiagnostics(args.diagnostics)),
    'REPAIR_WIRE:',
    serializePreRenderBlueprintRepairWire({
      context: args.context,
      previousDraft: args.previousDraft,
    }),
  ].join('\n');
}

/**
 * The SINGLE canonical, DETERMINISTIC projection from one structured repair diagnostic to
 * the exact error string the compiler persists for it. Both the compiler's error-string
 * construction (validation `issueText` and the draft-assembly catch below) and the census
 * derivation's per-position consistency check use this one function.
 *
 * NOT AN IDENTITY PROOF (do not rely on injectivity). This is a delimiter-joined human
 * string, so it is AMBIGUOUS and NON-INJECTIVE with respect to the sanitized census
 * identity: because `field`/`message` are arbitrary and are concatenated with `(`, `)`, and
 * `: ` separators that can appear inside them, two diagnostics with DIFFERENT sanitized
 * census identities can project to one byte-identical string. Concretely
 * `{field:'x', message:'y (z): q'}` and `{field:'x): y (z', message:'q'}` project
 * identically yet sanitize to different field paths. The census-integrity guarantee is
 * therefore NOT provided by this projection; it is provided STRUCTURALLY by the sealed,
 * runner-private, same-stack capture-minting authority in `productionAuthoringRunner`
 * (`deriveBlueprintAuthoringSanitizedFailureCaptureDisposition`, not exported), whose only
 * inputs are the compiler's own error/diagnostics, and by the mint-authorized persistence
 * gate — never by string comparison. The presence suffix carries only expected/actual
 * PRESENCE as booleans (never the values, so no PII), and adds no diagnostic-category
 * keyword, so the persisted receipt `{count,codes}` category summary is unchanged.
 */
export function preRenderBlueprintRepairDiagnosticErrorText(
  diagnostic: PreRenderBlueprintRepairDiagnostic,
): string {
  const label =
    diagnostic.code === 'draft_assembly_failed'
      ? 'draft assembly failed'
      : diagnostic.code;
  const fieldComponent = diagnostic.field ? ` (${diagnostic.field})` : '';
  const expectedPresent = Object.prototype.hasOwnProperty.call(
    diagnostic,
    'expected',
  )
    ? 1
    : 0;
  const actualPresent = Object.prototype.hasOwnProperty.call(diagnostic, 'actual')
    ? 1
    : 0;
  return `${label}${fieldComponent}: ${diagnostic.message} [expectedPresent:${expectedPresent} actualPresent:${actualPresent}]`;
}

function issueText(issues: readonly PreRenderBlueprintIssue[]): string[] {
  return issues.map(preRenderBlueprintRepairDiagnosticErrorText);
}

export async function compilePreRenderBookVisualBlueprint(
  context: PreRenderBlueprintValidationContext,
  config: PreRenderBlueprintAuthoringConfig,
  deps: {
    callAuthor: PreRenderBlueprintAuthoringCaller;
    /**
     * Optional exact provider input-token count authority. When present it is
     * consulted ONLY for the repair route and ONLY when the conservative byte
     * bound already exceeds the ceiling, so it can open the lane for a repair
     * whose exact token count fits even though its byte bound does not. Absent by
     * default: admission then falls back to the proven conservative bound.
     */
    inputTokenCounter?: BlueprintAuthoringInputTokenCounter | null;
  },
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
    let repairDiagnostics: PreRenderBlueprintRepairDiagnostic[] = [];
    try {
      parsedDraft = parseDraft(rawDraft);
      candidate = assemblePreRenderBookVisualBlueprintFromDraft({
        draft: parsedDraft,
        context,
        compositionPolicyVersion: config.compositionPolicyVersion,
      });
      const validation = validatePreRenderBookVisualBlueprint(candidate, context);
      if (!validation.ok) {
        errors = issueText(validation.issues);
        repairDiagnostics = validation.issues;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      const diagnostic: PreRenderBlueprintRepairDiagnostic = {
        code: 'draft_assembly_failed',
        message,
      };
      repairDiagnostics = [diagnostic];
      // Build the persisted error string from the SAME canonical projection, so the
      // structured diagnostic and its error string can never drift apart.
      errors = [preRenderBlueprintRepairDiagnosticErrorText(diagnostic)];
    }

    if (candidate && errors.length === 0) {
      return {
        blueprint: candidate,
        provenance: {
          version: PRE_RENDER_BLUEPRINT_AUTHORING_PROVENANCE_VERSION,
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

    repairAttempts.push({
      attempt,
      errors,
      draft: parsedDraft,
      diagnostics: repairDiagnostics,
    });
    if (attempt > PRE_RENDER_BLUEPRINT_MAX_REPAIR_ATTEMPTS) {
      throw new PreRenderBlueprintAuthoringRepairExhaustedError(
        repairAttempts,
      );
    }
    const repairSystemPrompt = buildPreRenderBlueprintRepairSystemPrompt();
    const repairUserPrompt = buildPreRenderBlueprintRepairUserPrompt({
      context,
      previousDraft: parsedDraft,
      diagnostics: repairDiagnostics,
    });
    const repairInputAccounting = blueprintAuthoringInputAccounting({
      systemPrompt: repairSystemPrompt,
      userPrompt: repairUserPrompt,
      schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
    });
    const repairAdmission = admitBlueprintAuthoringInputTokens({
      accounting: repairInputAccounting,
      counter: deps.inputTokenCounter,
      request: {
        routeKind: 'repair',
        systemPrompt: repairSystemPrompt,
        userPrompt: repairUserPrompt,
        schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
        model: config.model,
      },
    });
    if (!repairAdmission.admitted) {
      // Fail closed before a second provider call: the honest input-token quantity
      // for the exact repair wire (the proven conservative bound, or — when that
      // bound is inconclusive — the exact provider count, else unavailable)
      // exceeds the approved token ceiling.
      throw new PreRenderBlueprintRepairInputNotAdmissibleError(
        repairAttempts,
        repairInputAccounting,
      );
    }
    try {
      callCount += 1;
      rawDraft = await deps.callAuthor(
        repairSystemPrompt,
        repairUserPrompt,
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
