/**
 * Brief 1, Component 3 — text-first TEMPLATE compiler (offline, human-in-the-loop).
 *
 * Flow (deterministic facts BEFORE the LLM; facts overlaid LAST so a draft can never overwrite them):
 *   1. extractDeterministicFacts(input)         — gender / evidence / presence / laterality (pure, no LLM)
 *   2. LLM drafts ONLY descriptive fields        — locations/zones/cast/props/cover + humanCast appearance
 *   3. assemble: draft scaffold + facts overlaid — identity + presence + laterality come from (1), never (2)
 *   4. assertValidBookVisualContractTemplate     — FAIL-CLOSED; an invalid candidate is never returned
 *
 * This NEVER runs on the paid/frozen path: it emits a `.visual-contract-template.json` CANDIDATE for human
 * review. Only a human-approved template is ever materialized/frozen/hashed. The LLM caller is injected, so the
 * compiler is verifiable with a stub (no live model, no cost) — the deterministic overlay is what's under test.
 *
 * Kept in a SEPARATE module from the dormant vNext `compileBookVisualContract` so that path stays untouched.
 */
import type {
  BookVisualContractTemplate,
  HumanAppearanceTraits,
  TemplateHumanCastMember,
  TemplateTraitBinding,
} from './contractTemplateTypes';
import { PALETTE_VERSION, VISUAL_CONTRACT_SCHEMA_VERSION } from './contractTemplateTypes';
import type {
  BookVisualContract,
  SetBoardStableAuthority,
  SpatialRelation,
  VisualZone,
} from './types';
import { assertValidBookVisualContractTemplate, InvalidTemplateContractError } from './validateTemplateContract';
import { sourceEvidenceValidation } from './validateSourceEvidence';
import { parseContractJson } from './compileBookVisualContract';
import type {
  ContractLlmCaller,
  ContractLlmCallOptions,
} from './compileBookVisualContract';
import {
  extractDeterministicFacts,
  type DeterministicFacts,
  type DeterministicFactsInput,
  type HumanFact,
} from './extractDeterministicFacts';
import {
  TEMPLATE_DRAFT_JSON_SCHEMA,
  TEMPLATE_DRAFT_SCHEMA_NAME,
  TEMPLATE_DRAFT_SCHEMA_VERSION,
} from './templateDraftSchema';
import {
  assertOpenAIResponsesStructuredOutputSchemaCompatible,
} from '@/lib/visual-package/openaiResponsesStructuredOutputSchemaCompatibility';
import { assertSourceHasRealProse } from './assertSourceProse';
import {
  applyAuthoredCoverAuthority,
  AuthoredCoverAuthorityError,
  coverSourceFidelityIssues,
  type AuthoredCoverAuthority,
} from './coverSourceAuthority';
import {
  projectCoverMustNotShow,
  projectZoneStableGeometry,
} from './projectContractProse';
import {
  VISUAL_CONTRACT_AUTHORING_ENDPOINT,
  VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
  VISUAL_CONTRACT_AUTHORING_MODEL,
  VISUAL_CONTRACT_AUTHORING_NO_FALLBACK,
  VISUAL_CONTRACT_AUTHORING_PROVIDER,
  VISUAL_CONTRACT_AUTHORING_REASONING_EFFORT,
  VISUAL_CONTRACT_AUTHORING_SERVICE_TIER,
  VISUAL_CONTRACT_AUTHORING_TIMEOUT_MS,
  VISUAL_CONTRACT_AUTHORING_TOOLS_DISABLED,
  VISUAL_CONTRACT_AUTHORING_TRANSPORT_RETRIES,
} from './authoringPolicy';
import {
  ACTION_SEMANTIC_CATALOG,
  ACTION_SEMANTIC_CATALOG_VERSION,
} from './actionSemanticCatalog';
import {
  ACTION_SEMANTIC_COVERAGE_VERSION,
  ActionSemanticCapabilityGapError,
  NON_VISUAL_RATIONALE_VALUES,
  actionSemanticCoverageValidation,
  type ActionSemanticCapabilityGap,
  type ActionSemanticCoverageRecord,
} from './actionSemanticCoverage';
import {
  buildDraftValidationDiagnosticTrail,
  draftValidationLocatorForUntrustedPage,
  type DraftValidationAttemptDiagnostics,
  type DraftValidationIssue,
  type DraftValidationLocator,
} from './draftValidationDiagnostics';
import {
  normalizeDraftAuthorityReferenceIssues,
  type DraftAuthorityReferenceFieldRole,
  type DraftAuthorityReferenceIssue,
} from './draftAuthorityReferenceDiagnostics';
import {
  assertValidSourceEvidenceCatalog,
  resolveSourceEvidenceId,
  type SourceEvidenceCatalog,
  type SourceEvidenceCatalogEntry,
  type SourceEvidenceStoryIdentity,
} from './sourceEvidenceCatalog';
import {
  SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA,
  SOURCE_EVIDENCE_ID_REPAIR_PROMPT_VERSION,
  SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_NAME,
  SOURCE_EVIDENCE_ID_REPAIR_USER_PROMPT_VERSION,
  applySourceEvidenceIdPatches,
  buildSourceEvidenceIdRepairSystemPrompt,
  buildSourceEvidenceIdRepairUserPrompt,
  parseSourceEvidenceIdPatches,
  type SourceEvidenceIdRepairAffectedRecord,
} from './sourceEvidenceIdRepair';
import {
  PAGE_CONTRACT_REPAIR_JSON_SCHEMA,
  PAGE_CONTRACT_REPAIR_PROMPT_VERSION,
  PAGE_CONTRACT_REPAIR_SCHEMA_NAME,
  PAGE_CONTRACT_REPAIR_USER_PROMPT_VERSION,
  applyPageContractRepairs,
  buildPageContractRepairSystemPrompt,
  buildPageContractRepairUserPrompt,
  pageContractRepairAffectedPages,
  parsePageContractRepairs,
  type PageContractRepairAffectedPage,
} from './pageContractRepair';

/** The child's cast id is a fixed constant — the hero anchor. NEVER taken from the LLM draft. */
const CHILD_ID = 'child:hero';

// ── Dedicated authoring call (Stage 1 of the live-authoring fix) ─────────────
// The template draft is a large relational doc; it needs a real reasoning model + budget + strict structured
// output, not the support default. These are REQUESTED by the compiler; the injected caller executes them.
const AUTHORING_REASONING_EFFORT =
  VISUAL_CONTRACT_AUTHORING_REASONING_EFFORT;
export const TEMPLATE_PROMPT_VERSION =
  'vc-template-prompt/v10' as const;
export const TEMPLATE_USER_PROMPT_VERSION =
  'vc-template-user-prompt/v10' as const;
/** Stage 3 — at most this many SEMANTIC repair attempts AFTER the initial authoring call (bounded safety net). */
const MAX_REPAIR_ATTEMPTS = 2;
export const REPAIR_PROMPT_VERSION =
  'vc-repair-prompt/v9' as const;
export const REPAIR_USER_PROMPT_VERSION =
  'vc-repair-user-prompt/v10' as const;

/** The production authoring model is exact and never environment-overridable. */
export function resolveAuthoringModel(): string {
  return VISUAL_CONTRACT_AUTHORING_MODEL;
}

/**
 * Output token budget for the authoring call. On the Responses API `max_output_tokens` INCLUDES reasoning tokens —
 * reasoning='medium' can burn ~10k — so the budget must cover reasoning headroom AND the full JSON (a valid
 * template ≈ 6.3k). The candidate output budget is ~3000 tokens/page, floored at 32000, capped at 64000
 * (12 pages → 36000); the separate source-authoring
 * request preflight combines it with exact call and dollar ceilings before
 * any future provider adapter can be reached.
 */
export function authoringMaxOutputTokens(pageCount: number): number {
  const pages = Number.isFinite(pageCount) && pageCount > 0 ? pageCount : 12;
  return Math.min(64000, Math.max(32000, Math.round(pages * 3000)));
}

/** Provenance for the authoring call (recorded beside the candidate; NOT part of the frozen hash). */
export interface TemplateAuthoringProvenance {
  authoringModel: string;
  reasoningEffort: string;
  maxOutputTokens: number;
  schemaVersion: string;
  promptVersion: string;
  /** The compiler-owned appearance role-policy version (S2a). */
  policyVersion: string;
  /** The attempt the candidate passed on: 1 = initial authoring call, 2 = after repair #1, 3 = after repair #2. */
  attempt: number;
  /** The repair-prompt version — set only when the candidate needed ≥1 repair (attempt > 1). */
  repairPromptVersion?: string;
}

/** In-memory repair state. Exact prose and rejected drafts never cross the compiler boundary. */
interface TemplateRepairAttempt {
  /** 1 = the initial authoring call; 2 = repair #1; 3 = repair #2. */
  attempt: number;
  /** The exact validator/assembly errors this attempt failed with. */
  errors: string[];
  /** Closed compiler-owned sibling identities; never used to select repair input or mode. */
  diagnosticIssues: readonly DraftValidationIssue[];
  /** The descriptive draft object this attempt failed with; retained only for the next repair prompt. */
  draft: unknown;
  /** Narrow patch or existing whole-draft repair selected after this failure. */
  nextRepairMode?:
    | 'source_evidence_id_patch'
    | 'page_contract_patch'
    | 'full_draft';
}

export interface TemplateRepairSummary {
  attempt: number;
  diagnosticIssues: readonly DraftValidationIssue[];
  nextRepairMode?:
    | 'source_evidence_id_patch'
    | 'page_contract_patch'
    | 'full_draft';
}

function sourceEvidenceIdDiagnosticIssues(
  affectedRecords: readonly SourceEvidenceIdRepairAffectedRecord[],
): DraftValidationIssue[] {
  return affectedRecords.map((record) => ({
    family: 'source_evidence_id',
    code: record.failureCode,
    locator: draftValidationLocatorForUntrustedPage({
      positiveKind: 'source_evidence',
      fieldRole: 'source_evidence',
      pageNumber: record.pageNumber,
      fallbackCollectionRole: 'page_action_semantic_coverage',
      itemIndex: record.coverageIndex,
    }),
  }));
}

export class SourceEvidenceIdValidationError extends InvalidTemplateContractError {
  constructor(
    readonly affectedRecords: SourceEvidenceIdRepairAffectedRecord[],
    errors: string[],
  ) {
    super(
      errors,
      sourceEvidenceIdDiagnosticIssues(affectedRecords),
    );
    this.name = 'SourceEvidenceIdValidationError';
  }
}

/** Deterministic closed-domain failures are never eligible for provider repair. */
export class DraftAuthorityReferenceDomainError extends Error {
  readonly issues: readonly DraftAuthorityReferenceIssue[];

  constructor(issues: readonly DraftAuthorityReferenceIssue[]) {
    super('draft authority/reference domain invalid');
    this.name = 'DraftAuthorityReferenceDomainError';
    this.issues = normalizeDraftAuthorityReferenceIssues(issues);
    if (this.issues.length === 0) {
      throw new Error('draft authority/reference diagnostic contract invalid');
    }
  }
}

type RepairablePageSpatialReferenceIssue = DraftAuthorityReferenceIssue & {
  code: 'page_spatial_reference_outside_zone';
  locator:
    | Extract<
        DraftAuthorityReferenceIssue['locator'],
        { kind: 'page_spatial_action' }
      >
    | Extract<
        DraftAuthorityReferenceIssue['locator'],
        { kind: 'page_spatial_safety_constraint' }
      >;
};

function pageSpatialReferenceIssueIsRepairable(
  issue: DraftAuthorityReferenceIssue,
): issue is RepairablePageSpatialReferenceIssue {
  return (
    issue.code === 'page_spatial_reference_outside_zone' &&
    issue.locator.referenceClass === 'page_spatial_selection' &&
    (issue.locator.kind === 'page_spatial_action' ||
      issue.locator.kind === 'page_spatial_safety_constraint')
  );
}

/**
 * The only authority/reference-domain family that the descriptive author can
 * correct without guessing compiler-owned authority. Eligibility is all-or-
 * nothing so a mixed deterministic-authority failure still exits terminally.
 */
export function pageSpatialReferenceIssuesAreRepairable(
  issues: readonly DraftAuthorityReferenceIssue[],
): issues is readonly RepairablePageSpatialReferenceIssue[] {
  return issues.length > 0 && issues.every(pageSpatialReferenceIssueIsRepairable);
}

function pageSpatialReferenceRepairDiagnostic(
  issue: RepairablePageSpatialReferenceIssue,
): DraftValidationIssue {
  return {
    family: 'draft_contract',
    code: 'out_of_scope_reference',
    locator:
      issue.locator.kind === 'page_spatial_action'
        ? {
            kind: 'page_item',
            collectionRole: 'page_actions',
            fieldRole: 'reference',
            pageNumber: issue.locator.pageNumber,
            itemIndex: issue.locator.actionIndex,
          }
        : {
            kind: 'page_item',
            collectionRole: 'page_safety_constraints',
            fieldRole: 'reference',
            pageNumber: issue.locator.pageNumber,
            itemIndex: issue.locator.safetyConstraintIndex,
          },
  };
}

function pageSpatialReferenceRepairInstruction(
  issue: RepairablePageSpatialReferenceIssue,
): string {
  const structuralPath =
    issue.locator.kind === 'page_spatial_action'
      ? `page ${issue.locator.pageNumber} actionRequirements[${issue.locator.actionIndex}].${issue.locator.fieldRole}`
      : `page ${issue.locator.pageNumber} safetyConstraints[${issue.locator.safetyConstraintIndex}].target`;
  return (
    `page_spatial_reference_outside_zone: ${structuralPath} must use an exact spatialNodes id declared by that page's zone, ` +
    'or a schema-valid non-spatial typed reference; do not change page zone authority'
  );
}

/** Stable compiler-owned action identity derived only from a page-scoped beat. */
export function compilerOwnedActionCheckId(
  pageNumber: number,
  beatId: string,
  actionIndex?: number,
): string {
  const match = new RegExp(
    `^beat:p${pageNumber}:([a-z0-9_]+)$`,
  ).exec(beatId);
  if (!match) {
    throw new DraftAuthorityReferenceDomainError([
      {
        code: 'action_beat_id_outside_page_authority',
        locator:
          Number.isSafeInteger(actionIndex) &&
          (actionIndex as number) >= 0
            ? {
                kind: 'page_action',
                referenceClass: 'action_identity',
                fieldRole: 'actionRequirements.beatId',
                pageNumber,
                actionIndex: actionIndex as number,
              }
            : {
                kind: 'page_action_field',
                referenceClass: 'action_identity',
                fieldRole: 'actionRequirements.beatId',
                pageNumber,
              },
      },
    ]);
  }
  return `action:p${pageNumber}_${match[1]}`;
}

/**
 * Thrown when the bounded repair loop is exhausted (the initial call + MAX_REPAIR_ATTEMPTS repairs were ALL invalid).
 * Extends the fail-closed error so existing `instanceof InvalidTemplateContractError` handlers still catch it, and
 * carries only sanitized typed attempt summaries so the lifecycle can project diagnostics even though NO template
 * was produced (the Stage-3 contract: write nothing unless an attempt fully passes).
 */
export class TemplateRepairExhaustedError extends InvalidTemplateContractError {
  readonly draftValidationDiagnostics: readonly DraftValidationAttemptDiagnostics[];
  readonly attempts: readonly TemplateRepairSummary[];

  constructor(attempts: readonly TemplateRepairAttempt[]) {
    super(
      [
        `template repair loop exhausted after ${attempts.length} attempt(s) — wrote nothing`,
      ],
      attempts[attempts.length - 1]?.diagnosticIssues ?? [],
    );
    this.name = 'TemplateRepairExhaustedError';
    this.attempts = attempts.map((attempt) => ({
      attempt: attempt.attempt,
      diagnosticIssues: attempt.diagnosticIssues,
      ...(attempt.nextRepairMode
        ? { nextRepairMode: attempt.nextRepairMode }
        : {}),
    }));
    this.draftValidationDiagnostics = buildDraftValidationDiagnosticTrail(
      attempts.map((attempt) => attempt.diagnosticIssues),
    );
  }
}

/**
 * A completed repair response that cannot become the next descriptive draft.
 * This is not validation exhaustion: the remaining repair budget was never
 * exercised because the returned repair bytes were unusable. The raw output
 * and parse/provider exception stay inside the call stack and are never
 * carried by this error.
 */
export class TemplateRepairOutputInvalidError extends Error {
  readonly draftValidationDiagnostics: readonly DraftValidationAttemptDiagnostics[];
  readonly attempts: readonly TemplateRepairSummary[];

  constructor(
    attempts: readonly TemplateRepairAttempt[],
    readonly repairAttempt: number,
    readonly repairMode:
      | 'source_evidence_id_patch'
      | 'page_contract_patch'
      | 'full_draft',
  ) {
    super('completed template repair output was unusable');
    this.name = 'TemplateRepairOutputInvalidError';
    this.attempts = attempts.map((attempt) => ({
      attempt: attempt.attempt,
      diagnosticIssues: attempt.diagnosticIssues,
      ...(attempt.nextRepairMode
        ? { nextRepairMode: attempt.nextRepairMode }
        : {}),
    }));
    this.draftValidationDiagnostics = buildDraftValidationDiagnosticTrail(
      attempts.map((attempt) => attempt.diagnosticIssues),
    );
  }
}

/**
 * The AUTHORITATIVE companion CAST id, derived from the order's companion (input.companion) — namespaced the same
 * way as child:hero / human:role. Never from the draft. Returns null when the order has no companion.
 */
function authoritativeCompanionCastId(input: { companion?: { id: string; name?: string } | null }): string | null {
  return input.companion ? `companion:${input.companion.id}` : null;
}

export interface TemplateCompileInput extends DeterministicFactsInput {
  /** Full story text (page-marked) — the LLM's descriptive input. */
  fullStoryText: string;
  childName?: string;
  /** Optional hint; the LLM may set worldType from the text when omitted. */
  worldType?: string;
  /** Explicit author-owned page-0 cover authority extracted from the adjacent location-bible. */
  authoredCoverAuthority?: AuthoredCoverAuthority;
  /** Exact compiler-owned Story Source excerpt authority. */
  sourceEvidenceCatalog: SourceEvidenceCatalog;
  /** Source identity from which the catalog must deterministically rebuild. */
  sourceIdentity: SourceEvidenceStoryIdentity;
}

export interface TemplateCompileResult {
  template: BookVisualContractTemplate;
  facts: DeterministicFacts;
  /**
   * Non-authoritative whole-book review evidence. Every record keeps its exact
   * same-page citation and remains explicitly unreviewed until later Semantic
   * Reconciliation.
   */
  actionSemanticCoverage: ActionSemanticCoverageRecord[];
  /** Non-fatal notes: e.g. a draft human the extractor did not detect (dropped as non-text-verified). */
  notes: string[];
  /** The authoring call's provenance (model / reasoning / budget / schema+prompt version / attempt). */
  provenance: TemplateAuthoringProvenance;
  /** Sanitized FAILED-attempt metadata. Exact errors and drafts never leave the in-memory repair loop. */
  repairAttempts: TemplateRepairSummary[];
  /** Complete validated-attempt trail, including a zero-current successful final attempt. */
  draftValidationDiagnostics: readonly DraftValidationAttemptDiagnostics[];
}

// ── LLM prompt (real path; the pilot injects a stub) ─────────────────────────

export const ACTION_SEMANTIC_CATALOG_PROMPT_COLUMNS = [
  'predicate',
  'subjectKinds',
  'objectRule',
  'objectKinds',
  'spatialEffectRule',
  'spatialConstraintRule',
  'spatialConstraintRelations',
  'lateralityAllowed',
  'proseProjection',
] as const;

export const SOURCE_EVIDENCE_CATALOG_PROMPT_COLUMNS = [
  'pageNumber',
  'excerptOrdinal',
  'startOffsetUtf8',
  'endOffsetUtf8',
  'sourceEvidenceId',
  'excerpt',
] as const;

/**
 * Deterministic, lossless prompt projection of the closed Action Semantic
 * Catalog. The first JSON tuple is the sole column declaration; every
 * following tuple preserves catalog order and contains every prompt field.
 */
export function actionSemanticCatalogPromptTable(): string[] {
  return [
    JSON.stringify(ACTION_SEMANTIC_CATALOG_PROMPT_COLUMNS),
    ...ACTION_SEMANTIC_CATALOG.map((definition) =>
      JSON.stringify([
        definition.predicate,
        definition.subjectKinds,
        definition.objectRule,
        definition.objectKinds,
        definition.spatialEffectRule,
        definition.spatialConstraintRule,
        definition.spatialConstraintRelations,
        definition.lateralityAllowed,
        definition.proseProjection,
      ]),
    ),
  ];
}

/**
 * Shared deterministic Source Evidence prompt projection. The initial prompt
 * and relevant full-draft repair subset use this exact serializer.
 */
export function sourceEvidenceCatalogPromptTable(
  entries: readonly SourceEvidenceCatalogEntry[],
): string[] {
  return [
    JSON.stringify(SOURCE_EVIDENCE_CATALOG_PROMPT_COLUMNS),
    ...entries.map((entry) =>
      JSON.stringify([
        entry.pageNumber,
        entry.excerptOrdinal,
        entry.startOffsetUtf8,
        entry.endOffsetUtf8,
        entry.sourceEvidenceId,
        entry.excerpt,
      ]),
    ),
  ];
}

export function buildTemplateCompileSystemPrompt(): string {
  return [
    "You are a visual-continuity compiler for a children's picture book, producing a DRAFT for human review.",
    'You are given DETERMINISTIC FACTS already extracted from the story text (recurring humans, their gender, the',
    'pages they appear on, and any laterality). Those facts are AUTHORITATIVE and will be overlaid onto your output —',
    'you MUST NOT restate or contradict them.',
    '',
    'Draft ONLY the DESCRIPTIVE fields:',
    '- worldType, locations[] (including authored setIdentityId/setReference bindings), zones[] (with stableGeometry',
    '  plus exact spatialNodes/spatialRelations selection authority for zones not projected from stable areas),',
    '- setBoardAuthorities[]: for every pending/ready set identity, author a SEPARATE stable, character-free physical',
    '  projection. Each area declares exact zoneProjection cardinality+zoneIds. Use only environmental light, fixed',
    '  architecture as unbound nodes, and exact recurring-prop stablePropId node bindings safe on every consuming page.',
    '  fixedObjects is compiler-derived and MUST NOT be authored. Never',
    '  copy page action, cast/name/appearance, portable light, reveal language, or transient props into this field.',
    '- Prop consumers: stable_set=one ungated/never-forbidden stablePropId; page_frame=required at/after-reveal+',
    '  Blueprint placement_support. Else unbound; never infer.',
    '  cast.child + cast.companion wardrobe,',
    '  recurringProps[] (material/scale/persistence/firstRevealPage), forbiddenGlobalElements[], coverContract, and per-page',
    '  mustShow/mustNotShow/propState/propConstraints/actionRequirements/camera/transition/zoneId/locationId.',
    `- Action Semantic Catalog authority is ${ACTION_SEMANTIC_CATALOG_VERSION}. Use this JSON tuple table:`,
    ...actionSemanticCatalogPromptTable(),
    '- actionRequirements[] carries structured action only: typed subject, predicate, typed object, and when required',
    '  a closed spatialEffect (directional or relation+target). A cast_group uses only exact same-page castIds and',
    '  carries at least two unique members. spatialConstraint is separate current-frame state, never movement.',
    '  Never encode a movement result or static relation in prompt prose.',
    '- source_phenomenon subjects select one exact same-page sourceEvidenceId. The compiler resolves and persists its',
    '  exact excerpt; never invent a label, cast member, prop, or fuzzy identity for an environmental phenomenon.',
    '- Every required same-page Story Source visual beat gets one stable page-scoped actionSemanticCoverage[] record:',
    '  select one exact sourceEvidenceId from the compiler-owned catalog on that same page; never copy or invent',
    '  source prose. Historical imageDirection is never action authority and cannot supply source evidence.',
    '  action_requirement binds by the same exact beatId carried on one actionRequirement; the compiler derives',
    '  checkId and rewrites both records. represented_elsewhere cites an exact same-page contract JSON',
    '  pointer and its exact current string value; non_visual uses only a closed rationale; unsupported uses reason',
    '  closed_action_catalog_gap. Never force-fit a broader/narrower predicate. Coverage is unreviewed evidence only',
    '  and cannot approve its own semantic classification.',
    `- Closed non_visual rationales: ${NON_VISUAL_RATIONALE_VALUES.join(' | ')}.`,
    '- For each given human, draft ONLY garments (each colour an explicit value) and forbiddenAppearance. Do NOT',
    '  output appearance (skinTone/hairColour/hairTexture/hairStyle) — the compiler injects those from a role policy.',
    '',
    'Topology: describe ONE location/zone graph in zones[] (each zone has a parent locationId). Stable-board area',
    'zoneProjection uses exact zone ids; one_to_one carries exactly one and one_to_many carries at least two. The',
    'compiler projects area nodes into those page zones; never assume an area id is a zone id. Every per-page',
    'zoneId and every transition fromZoneId/toZoneId MUST be an EXACT id from that zones[] list. A zone change',
    'between consecutive pages must be carried by a transition; before_transition renders in the ORIGIN zone,',
    'after_transition in the DESTINATION, threshold at either endpoint. Do not restate zones with new ids.',
    '',
    'You MUST NOT output: a human\'s gender, pagesPresent, textEvidence, or aliases; page castIds or characterPresence;',
    'or any laterality (injectionArm/bandageArm/freeHand). Those are supplied by the deterministic extractor. Do not',
    'invent a human who is not in the given facts.',
    '',
    'Historical imageDirection is ADVISORY evidence only. It may help preserve visual action, interaction, expression,',
    'camera, composition, or staging. It MUST NOT select or change worldType, location, zone, set topology, cast,',
    'wardrobe, props, reveal timing, action authority, or forbidden content. Story prose and authored page-0 authority win every',
    'conflict. A later source-prompt reconciliation review records preserved or intentionally superseded direction.',
    '',
    'Output ONLY the JSON object, no prose, no markdown fences.',
  ].join('\n');
}

export function buildTemplateCompileUserPrompt(input: TemplateCompileInput, facts: DeterministicFacts): string {
  const humanLines = facts.humans.map(
    (h) =>
      `- ${h.id} (role=${h.role}, gender=${h.gender}); present on pages [${h.pagesPresent.join(', ')}]; draft ONLY garments/forbiddenAppearance for this person.`,
  );
  return [
    `storyKey: ${input.storyKey}`,
    `pageCount: ${input.pageCount}`,
    `child: ${input.childName ?? '(child)'}${input.childGender ? ` (${input.childGender})` : ''}`,
    input.companion ? `Companion: ${input.companion.name ?? input.companion.id} (id=${input.companion.id}).` : 'No companion.',
    '',
    'DETERMINISTIC FACTS (authoritative — do NOT restate gender/presence/laterality; draft descriptive fields only):',
    ...humanLines,
    facts.laterality.length
      ? `Laterality (from the text): ${facts.laterality.map((l) => `p${l.page}:${l.side}`).join(', ')}`
      : 'Laterality: none stated in the text (do NOT invent left/right).',
    ...(input.authoredCoverAuthority
      ? [
          '',
          'AUTHORED PAGE-0 COVER AUTHORITY (compiler-owned; the draft cannot override it):',
          JSON.stringify(input.authoredCoverAuthority),
        ]
      : []),
    '',
    'Produce a JSON BookVisualContractTemplate DRAFT (descriptive fields only) with keys: worldType, locations[],',
    'zones[{id,locationId,name,description,stableGeometry[],spatialNodes[],spatialRelations[]}],',
    'setBoardAuthorities[{setIdentityId,locations[],areas[{id,locationId,zoneProjection,spatialNodes,spatialRelations}]}],',
    'cast{child,companion?}, humanCast[{id, garments, forbiddenAppearance}],',
    'recurringProps[{id,name,description,material?,scale?,persistence?,firstRevealPage?}],',
    'forbiddenGlobalElements[], coverContract{worldType,locationId,zoneId,castIds,timeOfDay,mustShow,mustNotShow},',
    'pageContracts[{pageNumber, locationId, zoneId, sameLocationAs?,',
    'mustShow[], mustNotShow[], propState[], propConstraints[{propId,visibility,stateId?,anchorId?}], camera, transition}].',
    'Each page carries actionRequirements[{beatId,subject,predicate,object?,spatialEffect?,spatialConstraint?,polarity,laterality?}].',
    'beatId is the exact same page-scoped key as its one actionSemanticCoverage record; never emit checkId.',
    'subject is {kind:"entity",entity:{kind,id}}, {kind:"cast_group",castIds:[...]}, or',
    '{kind:"source_phenomenon",sourceEvidenceId}; use []',
    'when no beat binds to a catalog action; do not invent an action merely to populate the array.',
    'and actionSemanticCoverage[{beatId,sourceEvidenceId,disposition}] arrays. beatId must use beat:p{page}:name.',
    'Prop scopes: stable_set or page_frame only; follow system rules.',
    'sourceEvidenceId must be selected exactly from the same-page catalog below. represented_elsewhere uses a root',
    'JSON pointer under the exact current pageContracts[] item.',
    '',
    `SOURCE EVIDENCE CATALOG (${input.sourceEvidenceCatalog.version}; compiler-owned exact excerpts)`,
    ...sourceEvidenceCatalogPromptTable(
      input.sourceEvidenceCatalog.entries,
    ),
    '',
    'FULL STORY TEXT:',
    // Build the page-marked story text from input.pages — the SAME field assertSourceHasRealProse validated — so
    // the LLM reads exactly the guarded prose. A source whose independent fullStoryText was empty/markers-only can
    // therefore never smuggle emptiness past the pages guard into the authoring call.
    input.pages
      .slice()
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
      .join('\n\n'),
    '',
    'HISTORICAL IMAGE DIRECTIONS (OPTIONAL, ADVISORY PRESENTATION EVIDENCE ONLY):',
    ...(input.pageImageDirections ?? [])
      .slice()
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((candidate) => `--- Page ${candidate.pageNumber} ---\n${candidate.imageDirection}`),
  ].join('\n');
}

// ── Repair prompt (Stage 3 — bounded semantic repair of the DESCRIPTIVE draft) ─

export function buildTemplateRepairSystemPrompt(): string {
  return [
    "You are REPAIRING an INVALID descriptive draft for a children's-book visual-continuity contract.",
    'You will be given the previous draft, the EXACT validator errors it failed, and the authoritative facts.',
    'Return the COMPLETE corrected JSON draft (SAME schema as before) — fix ONLY what the errors require; keep',
    'everything else identical.',
    '',
    'You MAY edit ONLY these DESCRIPTIVE fields:',
    '- worldType (the semantic world type)',
    '- locations[] (name/description/lighting/timeOfDay/environmentClass/anchors/topology/setIdentityId/setReference)',
    '- setBoardAuthorities[] stable location light and fixed physical nodes/relations with exact zoneProjection;',
    '  architecture uses null stablePropId; only one uniquely declared, ungated, never-forbidden prop with one stable',
    '  placement may use exact stablePropId; never author fixedObjects; never',
    '  include cast, page action/staging, portable light, reveal language, or unsafe props',
    '- prop scopes are only stable_set via stablePropId or page_frame via required at/after-reveal propConstraint plus',
    '  Blueprint placement_support; every other state stays unbound, and scopes are never inferred',
    '- zones[] (name/description/stableGeometry/spatialNodes/spatialRelations exact page selection authority)',
    '- cast.child/cast.companion wardrobe; each human\'s garments (each colour an explicit value) + forbiddenAppearance',
    '- recurringProps[] (name/description, material/scale/persistence, and firstRevealPage — NO empty string in a field you include)',
    '- forbiddenGlobalElements[]; coverContract mustShow/mustNotShow/locationId/zoneId/castIds/timeOfDay',
    '- pageContracts[] mustShow/mustNotShow/propState/propConstraints/actionRequirements/',
    '  actionSemanticCoverage/camera and the transition kind/cue; action subject/object/spatialEffect/spatialConstraint remain typed',
    '- actionSemanticCoverage sourceEvidenceId values may change only to exact same-page catalog IDs supplied in',
    '  the repair input; actionRequirements never carries a copied source-evidence field',
    `- actionRequirements predicates must remain in ${ACTION_SEMANTIC_CATALOG_VERSION}; unsupported coverage is a`,
    '  terminal capability gap under this catalog, not a repairable shape/relationship error',
    '',
    'You MUST NOT change these (they are COMPILER-owned or FACT-derived; your edits to them are IGNORED and',
    'overwritten, so changing them only wastes the repair):',
    '- any human appearance (skinTone/hairColour/hairTexture/hairStyle) — injected from a role policy',
    '- any human gender/pagesPresent/textEvidence/aliases; page castIds/characterPresence; any laterality',
    '- cast identity/ids; location + zone IDs and their references (the compiler canonicalizes them)',
    '- coverContract.worldType (the compiler copies it from the top-level worldType)',
    '',
    'Output ONLY the corrected JSON object, no prose, no markdown fences.',
  ].join('\n');
}

export function buildTemplateRepairUserPrompt(
  previousDraft: Record<string, unknown>,
  errors: string[],
  facts: DeterministicFacts,
  input: TemplateCompileInput,
): string {
  const affectedPages = new Set<number>();
  if (
    errors.some((error) =>
      error.startsWith('source_evidence_id_invalid:'),
    )
  ) {
    for (const error of errors) {
      const match = /\bpage (\d+)\b/.exec(error);
      if (match) affectedPages.add(Number(match[1]));
    }
  }
  const relevantCatalogEntries =
    input.sourceEvidenceCatalog.entries.filter((entry) =>
      affectedPages.has(entry.pageNumber),
    );
  return [
    `storyKey: ${input.storyKey}  pageCount: ${input.pageCount}`,
    '',
    'The previous draft FAILED validation with these EXACT errors — fix EACH one (and change nothing else):',
    ...errors.map((e, i) => `${i + 1}. ${e}`),
    '',
    'AUTHORITATIVE FACTS (do NOT restate gender/presence/laterality — they are overlaid after you):',
    ...facts.humans.map((h) => `- ${h.id} (role=${h.role}, gender=${h.gender}); present on pages [${h.pagesPresent.join(', ')}]`),
    ...(input.authoredCoverAuthority
      ? [
          '',
          'AUTHORED PAGE-0 COVER AUTHORITY (compiler-owned; keep the zone vocabulary mappable):',
          JSON.stringify(input.authoredCoverAuthority),
        ]
      : []),
    ...(relevantCatalogEntries.length > 0
      ? [
          '',
          'RELEVANT SOURCE EVIDENCE CATALOG ENTRIES (exact same-page IDs only):',
          ...sourceEvidenceCatalogPromptTable(
            relevantCatalogEntries,
          ),
        ]
      : []),
    '',
    'PROP SCOPES: stable_set=one ungated/never-forbidden stablePropId; page_frame=required at/after-reveal+',
    'Blueprint placement_support; every other state stays unbound and never inferred.',
    '',
    'PREVIOUS (INVALID) DRAFT — return a corrected COMPLETE version of this exact JSON object:',
    'Historical imageDirection remains ADVISORY only for action, interaction, expression, camera, composition, and',
    'staging. It cannot alter world/location/zone/cast/wardrobe/props/reveal timing/forbidden content; story prose and',
    'authored page-0 authority win conflicts. It is not action authority and cannot supply sourceEvidenceId.',
    '',
    JSON.stringify(previousDraft),
  ].join('\n');
}

// ── Assembly ─────────────────────────────────────────────────────────────────

function asObj(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function isStr(v: unknown): v is string {
  return typeof v === 'string';
}

/**
 * Canonicalize only valid string group membership order. Malformed values and
 * duplicates are preserved byte-for-member for the validator to reject; the
 * caller's draft is never mutated.
 */
export function canonicalizePageActionCastGroups(
  value: unknown,
): Record<string, unknown>[] {
  return asArr(value).map((raw) => {
    const action = { ...asObj(raw) };
    const subject = asObj(action.subject);
    if (subject.kind === 'cast_group') {
      const authoredCastIds = Array.isArray(subject.castIds)
        ? subject.castIds.slice()
        : subject.castIds;
      action.subject = {
        ...subject,
        castIds: Array.isArray(authoredCastIds) && authoredCastIds.every(isStr)
          ? authoredCastIds.sort()
          : authoredCastIds,
      };
    }
    return action;
  });
}

/** Format a real evidence phrase into the textEvidence string (never fabricated — a real page + phrase). */
function formatEvidence(h: HumanFact): string {
  if (!h.genderEvidence) return `role ${h.role} (gender ${h.gender}; evidence not localized)`;
  return `עמוד ${h.genderEvidence.page}: "${h.genderEvidence.phrase}"`;
}

// ── S2a: compiler-owned appearance injection (closed, versioned role policy) ──
// The LLM no longer authors appearance modes/origins/values. The compiler injects the binding SKELETON by role:
// relatives → family_profile (UNRESOLVED, no value); known non-relatives → deterministic_palette (UNRESOLVED,
// canonical paletteId = the cast id, which is also the palette selection key — never a fabricated string);
// hairStyle → an explicit policy value + policy_default origin. An UNKNOWN role FAILS (never auto-classified).
const FAMILY_PROFILE_ROLES = new Set(['mother', 'father', 'parent', 'sibling', 'grandparent']);
const APPEARANCE_POLICY_VERSION = 'role-policy/v1';
const HAIR_STYLE_POLICY: Record<string, { value: string; policyId: string }> = {
  mother: { value: 'medium-length, worn loose in a simple everyday style', policyId: 'mother-hair-style' },
  father: { value: 'short, tidy everyday cut', policyId: 'father-hair-style' },
  parent: { value: 'medium-length, worn in a simple everyday style', policyId: 'parent-hair-style' },
  sibling: { value: 'a simple age-appropriate everyday style', policyId: 'sibling-hair-style' },
  grandparent: { value: 'short, neatly kept', policyId: 'grandparent-hair-style' },
  doctor: { value: 'short, neatly combed, side part', policyId: 'doctor-hair-style' },
  nurse: { value: 'neat, tied back for work', policyId: 'nurse-hair-style' },
  teacher: { value: 'neat, simple everyday style', policyId: 'teacher-hair-style' },
};

/** Inject the appearance binding skeleton for a human's role. Throws (fail-closed) for an unknown role. */
export function injectAppearance(role: string, humanId: string): HumanAppearanceTraits<TemplateTraitBinding> {
  const hair = HAIR_STYLE_POLICY[role];
  if (!hair) {
    throw new InvalidTemplateContractError([
      `humanCast "${humanId}" role "${role}" has no appearance policy — a role that is neither a known relative nor a known non-relative must be authored by a human (never auto-classified).`,
    ], [{
      family: 'draft_contract',
      code: 'fact_authority_mismatch',
      locator: { kind: 'root', fieldRole: 'appearance' },
    }]);
  }
  const skinHair = (): TemplateTraitBinding =>
    FAMILY_PROFILE_ROLES.has(role)
      ? { mode: 'family_profile', origin: { kind: 'family_profile' } }
      : { mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: humanId, version: PALETTE_VERSION } };
  return {
    skinTone: skinHair(),
    hairColour: skinHair(),
    hairTexture: skinHair(),
    hairStyle: { mode: 'explicit', value: hair.value, origin: { kind: 'policy_default', policyId: hair.policyId, version: 'v1' } },
  };
}

/** Merge the deterministic identity facts (win) with the compiler-injected appearance + the draft's garments. */
function mergeHuman(fact: HumanFact, draftHuman: Record<string, unknown>): TemplateHumanCastMember {
  return {
    id: fact.id,
    role: fact.role,
    gender: fact.gender,
    // Identity is DETERMINISTIC: aliases come from the extractor, NEVER the draft. Appearance modes/origins are
    // COMPILER-owned (injected by role from the closed policy — the LLM does not author them). Only garments and
    // forbiddenAppearance are descriptive draft fields.
    aliases: fact.aliasesFound,
    textEvidence: formatEvidence(fact),
    pagesPresent: fact.pagesPresent,
    appearance: injectAppearance(fact.role, fact.id),
    garments: (draftHuman.garments as TemplateHumanCastMember['garments']) ?? [],
    forbiddenAppearance: asArr(draftHuman.forbiddenAppearance).filter((a): a is string => typeof a === 'string'),
  };
}

/** Action authority is descriptive; evidence text is compiler-resolved only. */
function sourceGroundPageActionSemantics(
  pageDraft: Record<string, unknown>,
  sourceEvidenceCatalog: SourceEvidenceCatalog,
): {
  page: Record<string, unknown>;
  coverage: ActionSemanticCoverageRecord[];
  capabilityGaps: ActionSemanticCapabilityGap[];
  issues: string[];
  diagnosticIssues: DraftValidationIssue[];
  sourceEvidenceIssues: SourceEvidenceIdRepairAffectedRecord[];
} {
  const pageNumber =
    typeof pageDraft.pageNumber === 'number'
      ? pageDraft.pageNumber
      : -1;
  const pageCollectionLocator = (
    collectionRole: 'page_actions' | 'page_action_semantic_coverage',
    itemIndex: number,
    fieldRole: DraftValidationLocator['fieldRole'],
  ): DraftValidationLocator =>
    Number.isSafeInteger(pageNumber) && pageNumber > 0
      ? {
          kind: 'page_item',
          collectionRole,
          fieldRole,
          pageNumber,
          itemIndex,
        }
      : {
          kind: 'collection_item',
          collectionRole,
          fieldRole,
          itemIndex,
        };
  const issues: string[] = [];
  const diagnosticIssues: DraftValidationIssue[] = [];
  const authorityIssues: DraftAuthorityReferenceIssue[] = [];
  const sourceEvidenceIssues: SourceEvidenceIdRepairAffectedRecord[] = [];

  const out = { ...pageDraft };
  let groundedActions: Record<string, unknown>[] = [];
  if (pageDraft.actionRequirements !== undefined) {
    groundedActions = asArr(
      pageDraft.actionRequirements,
    ).map((raw, index) => {
      const action = { ...asObj(raw) };
      if (Object.prototype.hasOwnProperty.call(action, 'checkId')) {
        authorityIssues.push(
          {
            code: 'action_check_id_forbidden',
            locator: {
              kind: 'page_action',
              referenceClass: 'action_identity',
              fieldRole: 'actionRequirements.checkId',
              pageNumber,
              actionIndex: index,
            },
          },
        );
      }
      delete action.sourcePhrase;
      delete action.sourceEvidenceId;
      if (
        action.subject === undefined &&
        typeof action.actorId === 'string'
      ) {
        action.subject = {
          kind: 'entity',
          entity: { kind: 'cast', id: action.actorId },
        };
      }
      delete action.actorId;
      if (action.object === null) delete action.object;
      if (action.spatialEffect === null) delete action.spatialEffect;
      if (action.spatialConstraint === null) delete action.spatialConstraint;
      if (action.laterality === null) delete action.laterality;
      delete action.checkId;
      return action;
    });
  }

  const beatIdPattern = new RegExp(
    `^beat:p${pageNumber}:[a-z0-9_]+$`,
  );
  const actionsByBeatId = new Map<
    string,
    Array<{
      action: Record<string, unknown>;
      actionIndex: number;
    }>
  >();
  for (const [index, action] of groundedActions.entries()) {
    const beatId =
      typeof action.beatId === 'string' ? action.beatId : '';
    if (!beatIdPattern.test(beatId)) {
      authorityIssues.push(
        {
          code: 'action_beat_id_outside_page_authority',
          locator: {
            kind: 'page_action',
            referenceClass: 'action_identity',
            fieldRole: 'actionRequirements.beatId',
            pageNumber,
            actionIndex: index,
          },
        },
      );
      continue;
    }
    const matches = actionsByBeatId.get(beatId) ?? [];
    matches.push({ action, actionIndex: index });
    actionsByBeatId.set(beatId, matches);
  }
  for (const matches of actionsByBeatId.values()) {
    if (matches.length !== 1) {
      authorityIssues.push(
        ...matches.map(({ actionIndex }) => ({
          code: 'action_beat_binding_cardinality_invalid' as const,
          locator: {
            kind: 'page_action' as const,
            referenceClass: 'action_identity' as const,
            fieldRole: 'actionRequirements.beatId' as const,
            pageNumber,
            actionIndex,
          },
        })),
      );
    }
  }

  const coverage: ActionSemanticCoverageRecord[] = [];
  const capabilityGaps: ActionSemanticCapabilityGap[] = [];
  const coverageByCheckId = new Map<
    string,
    {
      coverageIndex: number;
      beatId: string;
      sourceEvidenceId: string;
      sourcePhrase: string;
      resolutionOk: boolean;
      record: Record<string, unknown>;
      disposition: Record<string, unknown>;
    }
  >();
  const rawCoverage = asArr(pageDraft.actionSemanticCoverage);
  const actionCoverageIndices = new Map<string, number[]>();
  const allCoverageIndices = new Map<string, number[]>();
  if (rawCoverage.length === 0) {
    issues.push(
      `page ${pageNumber}: action_semantic_coverage_missing`,
    );
    diagnosticIssues.push({
      family: 'action_semantic',
      code: 'coverage_missing',
      locator: Number.isSafeInteger(pageNumber) && pageNumber > 0
        ? { kind: 'page', fieldRole: 'coverage', pageNumber }
        : { kind: 'collection', collectionRole: 'page_action_semantic_coverage', fieldRole: 'coverage' },
    });
  }
  for (let index = 0; index < rawCoverage.length; index += 1) {
    const label =
      `page ${pageNumber}.actionSemanticCoverage[${index}]`;
    const record = asObj(rawCoverage[index]);
    const rawBeatId =
      typeof record.beatId === 'string' ? record.beatId : '';
    const beatId = beatIdPattern.test(rawBeatId)
      ? rawBeatId
      : '';
    if (!rawBeatId) {
      issues.push(`${label}.beatId is missing`);
      diagnosticIssues.push({
        family: 'action_semantic',
        code: 'beat_identity_missing',
        locator: pageCollectionLocator('page_action_semantic_coverage', index, 'identity'),
      });
    } else if (!beatId) {
      issues.push(
        `${label}.beatId "${rawBeatId}" must be stable and page-scoped (${String(beatIdPattern)})`,
      );
      diagnosticIssues.push({
        family: 'action_semantic',
        code: 'beat_identity_out_of_scope',
        locator: pageCollectionLocator('page_action_semantic_coverage', index, 'identity'),
      });
    }
    if (beatId) {
      const indices = allCoverageIndices.get(beatId) ?? [];
      indices.push(index);
      allCoverageIndices.set(beatId, indices);
    }
    const disposition = asObj(record.disposition);
    const resolution = resolveSourceEvidenceId({
      catalog: sourceEvidenceCatalog,
      sourceEvidenceId: record.sourceEvidenceId,
      pageNumber,
    });
    if (!resolution.ok) {
      const actionRequirement =
        disposition.kind === 'action_requirement' &&
        beatId
          ? actionsByBeatId.get(beatId)?.[0]?.action ?? null
          : null;
      if (beatId) {
        sourceEvidenceIssues.push({
          pageNumber,
          coverageIndex: index,
          beatId,
          failureCode: resolution.code,
          coverageRecord: {
            beatId,
            sourceEvidenceId: record.sourceEvidenceId,
            disposition: structuredClone(disposition),
          },
          actionRequirement: actionRequirement
            ? {
                beatId,
                subject: structuredClone(
                  actionRequirement.subject,
                ),
                predicate: actionRequirement.predicate,
                object: structuredClone(
                  actionRequirement.object,
                ),
                spatialEffect: structuredClone(
                  actionRequirement.spatialEffect,
                ),
                spatialConstraint: structuredClone(
                  actionRequirement.spatialConstraint,
                ),
                polarity: actionRequirement.polarity,
                laterality: actionRequirement.laterality,
              }
            : null,
        });
      }
    }
    const sourceEvidenceId = resolution.ok
      ? resolution.entry.sourceEvidenceId
      : typeof record.sourceEvidenceId === 'string'
        ? record.sourceEvidenceId
        : '';
    const sourcePhrase = resolution.ok
      ? resolution.entry.excerpt
      : '';
    if (disposition.kind === 'unsupported') {
      if (
        disposition.reason !== 'closed_action_catalog_gap'
      ) {
        issues.push(
          `${label}.disposition.reason must be closed_action_catalog_gap`,
        );
        diagnosticIssues.push({
          family: 'action_semantic',
          code: 'disposition_reason_invalid',
          locator: pageCollectionLocator('page_action_semantic_coverage', index, 'reason'),
        });
      } else if (beatId && resolution.ok) {
        capabilityGaps.push({
          pageNumber,
          coverageIndex: index,
          beatId,
          sourceEvidenceId,
          sourcePhrase,
          reason: 'closed_action_catalog_gap',
        });
      } else if (beatId) {
        issues.push(
          `${label}.disposition unsupported is a terminal action_semantic_capability_gap and is not eligible for compact ID repair`,
        );
        diagnosticIssues.push({
          family: 'action_semantic',
          code: 'disposition_payload_invalid',
          locator: pageCollectionLocator('page_action_semantic_coverage', index, 'payload'),
        });
      }
      continue;
    }

    let typedDisposition:
      | ActionSemanticCoverageRecord['disposition']
      | null = null;
    if (disposition.kind === 'action_requirement') {
      if (Object.prototype.hasOwnProperty.call(disposition, 'checkId')) {
        authorityIssues.push(
          {
            code: 'coverage_check_id_forbidden',
            locator: {
              kind: 'page_coverage',
              referenceClass: 'action_coverage',
              fieldRole: 'actionSemanticCoverage.checkId',
              pageNumber,
              coverageIndex: index,
            },
          },
        );
      }
      if (beatId) {
        const coverageIndices =
          actionCoverageIndices.get(beatId) ?? [];
        coverageIndices.push(index);
        actionCoverageIndices.set(beatId, coverageIndices);
        const matches = actionsByBeatId.get(beatId) ?? [];
        if (matches.length !== 1) {
          authorityIssues.push(
            {
              code: 'coverage_action_binding_cardinality_invalid',
              locator: {
                kind: 'page_coverage',
                referenceClass: 'action_coverage',
                fieldRole:
                  'actionSemanticCoverage.actionRequirementBinding',
                pageNumber,
                coverageIndex: index,
              },
            },
          );
        } else {
          const checkId = compilerOwnedActionCheckId(
            pageNumber,
            beatId,
            matches[0]!.actionIndex,
          );
          matches[0]!.action.checkId = checkId;
          delete matches[0]!.action.beatId;
          typedDisposition = {
            kind: 'action_requirement',
            checkId,
          };
          coverageByCheckId.set(checkId, {
            coverageIndex: index,
            beatId,
            sourceEvidenceId,
            sourcePhrase,
            resolutionOk: resolution.ok,
            record,
            disposition,
          });
        }
      }
    } else if (disposition.kind === 'represented_elsewhere') {
      if (
        typeof disposition.contractPointer !== 'string' ||
        typeof disposition.contractValue !== 'string'
      ) {
        issues.push(
          `${label}.disposition represented_elsewhere requires contractPointer and exact string contractValue`,
        );
        diagnosticIssues.push({
          family: 'action_semantic',
          code: 'disposition_payload_invalid',
          locator: pageCollectionLocator('page_action_semantic_coverage', index, 'payload'),
        });
      } else {
        typedDisposition = {
          kind: 'represented_elsewhere',
          contractPointer: disposition.contractPointer,
          contractValue: disposition.contractValue,
        };
      }
    } else if (disposition.kind === 'non_visual') {
      if (
        typeof disposition.rationale !== 'string' ||
        !NON_VISUAL_RATIONALE_VALUES.includes(
          disposition.rationale as (typeof NON_VISUAL_RATIONALE_VALUES)[number],
        )
      ) {
        issues.push(
          `${label}.disposition.rationale is not in the closed non-visual rationale catalog`,
        );
        diagnosticIssues.push({
          family: 'action_semantic',
          code: 'disposition_reason_invalid',
          locator: pageCollectionLocator('page_action_semantic_coverage', index, 'reason'),
        });
      } else {
        typedDisposition = {
          kind: 'non_visual',
          rationale:
            disposition.rationale as (typeof NON_VISUAL_RATIONALE_VALUES)[number],
        };
      }
    } else {
      issues.push(`${label}.disposition.kind is invalid`);
      diagnosticIssues.push({
        family: 'action_semantic',
        code: 'disposition_kind_invalid',
        locator: pageCollectionLocator('page_action_semantic_coverage', index, 'disposition'),
      });
    }
    if (beatId && typedDisposition) {
      coverage.push({
        version: ACTION_SEMANTIC_COVERAGE_VERSION,
        pageNumber,
        beatId,
        sourceEvidenceId,
        sourcePhrase,
        disposition: typedDisposition,
        reviewState: 'unreviewed',
      });
    }
  }
  for (const coverageIndices of allCoverageIndices.values()) {
    if (coverageIndices.length !== 1) {
      authorityIssues.push(
        ...coverageIndices.map((coverageIndex) => ({
          code: 'coverage_beat_cardinality_invalid' as const,
          locator: {
            kind: 'page_coverage' as const,
            referenceClass: 'action_coverage' as const,
            fieldRole: 'actionSemanticCoverage.beatId' as const,
            pageNumber,
            coverageIndex,
          },
        })),
      );
    }
  }
  for (const [beatId, actions] of actionsByBeatId) {
    const coverageCount =
      actionCoverageIndices.get(beatId)?.length ?? 0;
    if (coverageCount !== 1) {
      authorityIssues.push(
        ...actions.map(({ actionIndex }) => ({
          code: 'action_coverage_cardinality_invalid' as const,
          locator: {
            kind: 'page_action' as const,
            referenceClass: 'action_coverage' as const,
            fieldRole:
              'actionRequirements.actionSemanticCoverage' as const,
            pageNumber,
            actionIndex,
          },
        })),
      );
    }
  }
  if (authorityIssues.length > 0) {
    throw new DraftAuthorityReferenceDomainError(authorityIssues);
  }
  for (const [actionIndex, action] of groundedActions.entries()) {
    const subject = asObj(action.subject);
    if (subject.kind !== 'source_phenomenon') continue;
    const checkId =
      typeof action.checkId === 'string' ? action.checkId : '';
    const binding = coverageByCheckId.get(checkId);
    if (!binding) {
      issues.push(
        `page ${pageNumber} actionRequirement "${checkId}" source_phenomenon subject must bind one same-page Action Semantic Coverage record`,
      );
      diagnosticIssues.push({
        family: 'action_semantic',
        code: 'action_binding_missing',
        locator: pageCollectionLocator('page_actions', actionIndex, 'action_binding'),
      });
      continue;
    }
    const subjectResolution = resolveSourceEvidenceId({
      catalog: sourceEvidenceCatalog,
      sourceEvidenceId: subject.sourceEvidenceId,
      pageNumber,
    });
    if (!subjectResolution.ok) {
      if (binding.resolutionOk) {
        sourceEvidenceIssues.push({
          pageNumber,
          coverageIndex: binding.coverageIndex,
          beatId: binding.beatId,
          failureCode: subjectResolution.code,
          coverageRecord: {
            beatId: binding.beatId,
            sourceEvidenceId: subject.sourceEvidenceId,
            disposition: structuredClone(binding.disposition),
          },
          actionRequirement: {
            beatId: binding.beatId,
            subject: structuredClone(action.subject),
            predicate: action.predicate,
            object: structuredClone(action.object),
            spatialEffect: structuredClone(action.spatialEffect),
            spatialConstraint: structuredClone(action.spatialConstraint),
            polarity: action.polarity,
            laterality: action.laterality,
          },
        });
      }
      continue;
    }
    if (
      !binding.resolutionOk ||
      binding.sourceEvidenceId !==
        subjectResolution.entry.sourceEvidenceId
    ) {
      issues.push(
        `page ${pageNumber} actionRequirement "${checkId}" source_phenomenon subject must use the exact Source Evidence ID bound by its coverage record`,
      );
      diagnosticIssues.push({
        family: 'action_semantic',
        code: 'source_phenomenon_binding_mismatch',
        locator: pageCollectionLocator('page_actions', actionIndex, 'source_evidence'),
      });
      continue;
    }
    action.subject = {
      kind: 'source_phenomenon',
      sourceEvidenceId: subjectResolution.entry.sourceEvidenceId,
      sourcePhrase: subjectResolution.entry.excerpt,
    };
  }
  if (groundedActions.length > 0) {
    for (const action of groundedActions) delete action.beatId;
    out.actionRequirements = groundedActions;
  } else {
    delete out.actionRequirements;
  }
  delete out.actionSemanticCoverage;
  delete out.unsupportedActionSemantics;
  return {
    page: out,
    coverage,
    capabilityGaps,
    issues,
    diagnosticIssues,
    sourceEvidenceIssues,
  };
}

/** Recompute one page's castIds + characterPresence + laterality castStates from the deterministic facts. */
function overlayPage(
  pc: Record<string, unknown>,
  facts: DeterministicFacts,
  childId: string,
  companionId: string | null,
): Record<string, unknown> {
  const page = typeof pc.pageNumber === 'number' ? pc.pageNumber : -1;
  const companionPresent = companionId != null && facts.companionPresentPages.includes(page);

  // castIds: child (always — the protagonist), companion (from companionPresence), each human by pagesPresent.
  const castIds: string[] = [childId];
  if (companionPresent && companionId) castIds.push(companionId);
  for (const h of facts.humans) if (h.pagesPresent.includes(page)) castIds.push(h.id);
  const castIdSet = new Set(castIds);

  // castStates: keep ONLY the draft's descriptive bodyState, and ONLY for a cast member PRESENT on this page
  // (castId ∈ the recomputed castIds). This is the presence overlay: a draft cannot smuggle a bodyState for an
  // ABSENT character (facts overlaid LAST). ALL laterality (injectionArm/bandageArm/freeHand) is DISCARDED and
  // NEVER re-injected — attributing a side to the child's injection/bandage arm is a human authoring choice the
  // tool defers. Drop no-op / absent entries; omit castStates entirely if empty (Slice B fail-closed rule).
  const rebuilt: Array<Record<string, unknown>> = [];
  for (const raw of asArr(pc.castStates)) {
    const cs = asObj(raw);
    const entry: Record<string, unknown> = {};
    if (typeof cs.castId === 'string') entry.castId = cs.castId;
    if (typeof cs.bodyState === 'string') entry.bodyState = cs.bodyState; // descriptive — kept
    if (typeof entry.castId === 'string' && castIdSet.has(entry.castId) && 'bodyState' in entry) {
      rebuilt.push(entry);
    }
  }

  const out: Record<string, unknown> = {
    ...pc,
    castIds,
    characterPresence: { child: true, companion: companionPresent },
  };
  const actions = canonicalizePageActionCastGroups(
    pc.actionRequirements,
  );
  if (actions.length > 0) out.actionRequirements = actions;
  else delete out.actionRequirements;
  const propConstraints = asArr(pc.propConstraints).map((raw) => {
    const constraint = { ...asObj(raw) };
    if (constraint.stateId === null) delete constraint.stateId;
    if (constraint.anchorId === null) delete constraint.anchorId;
    return constraint;
  });
  if (propConstraints.length > 0) out.propConstraints = propConstraints;
  else delete out.propConstraints;
  if (rebuilt.length > 0) out.castStates = rebuilt;
  else delete out.castStates; // omit rather than emit [] (Slice B fail-closed rule)
  return out;
}

// ── Topology canonicalization (S2b) ───────────────────────────────────────────
// The compiler OWNS location/zone IDs + all page/transition references. The LLM describes ONE semantic
// location/zone graph (zones[] each with a parent locationId); the compiler then rewrites every page's
// zoneId + locationId + each transition's from/to against THAT graph. A reference resolves to EXACTLY one
// canonical zone (exact id, else a single normalized match) or the compile FAILS CLOSED (→ Stage-3 repair) —
// it NEVER guesses a page's location. Deriving each page's locationId from its resolved zone makes zone-
// membership hold by construction (kills the "per-page zoneId ∉ its location's zones" fox failure). The
// transition KIND/cue stays LLM-authored (narrative); a genuine continuity violation is left for the
// fail-closed validator to reject → repair (canonicalization fixes IDENTIFIERS, never invents intent).

interface CanonicalZone {
  id: string;
  locationId: string;
}

/** Casefold + collapse non-alphanumeric runs, so separator/case drift ("Clinic.ExamRoom" ~ "clinic_exam_room")
 *  still resolves — WITHOUT guessing across genuinely-distinct ids (two ids sharing a normalized form resolve to
 *  >1 candidate → ambiguous → repair, never a coin-flip). */
function normalizeTopoId(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

interface ZoneGraph {
  exact: Map<string, CanonicalZone>;
  byNorm: Map<string, CanonicalZone[]>;
}

/** Build the canonical zone graph from the drafted locations[] + zones[]. The graph is the SINGLE source of
 *  truth for where a page sits; a malformed graph (zone with no/unknown parent location, duplicate zone id)
 *  FAILS CLOSED here (→ repair) so downstream derivation can never produce an invalid location. */
function buildZoneGraph(draft: Record<string, unknown>): ZoneGraph {
  const locationIds = new Set(
    asArr(draft.locations)
      .map((l) => asObj(l).id)
      .filter(isStr),
  );
  const exact = new Map<string, CanonicalZone>();
  const byNorm = new Map<string, CanonicalZone[]>();
  for (const [zoneIndex, raw] of asArr(draft.zones).entries()) {
    const z = asObj(raw);
    if (!isStr(z.id) || !isStr(z.locationId)) {
      throw new InvalidTemplateContractError(
        ['a zone is missing id/locationId — the semantic zone graph is malformed (repair).'],
        [{
          family: 'draft_contract',
          code: 'topology_malformed',
          locator: {
            kind: 'collection_item',
            collectionRole: 'zones',
            fieldRole: 'topology',
            itemIndex: zoneIndex,
          },
        }],
      );
    }
    if (!locationIds.has(z.locationId)) {
      throw new InvalidTemplateContractError(
        [`zone "${z.id}" references unknown locationId "${z.locationId}" — the semantic zone graph is malformed (repair).`],
        [{
          family: 'draft_contract',
          code: 'unresolved_reference',
          locator: {
            kind: 'collection_item',
            collectionRole: 'zones',
            fieldRole: 'reference',
            itemIndex: zoneIndex,
          },
        }],
      );
    }
    if (exact.has(z.id)) {
      throw new DraftAuthorityReferenceDomainError([
        {
          code: 'page_zone_id_duplicate',
          locator: {
            kind: 'page_zone',
            referenceClass: 'page_zone',
            fieldRole: 'zones.id',
            zoneIndex,
          },
        },
      ]);
    }
    const cz: CanonicalZone = { id: z.id, locationId: z.locationId };
    exact.set(cz.id, cz);
    const norm = normalizeTopoId(cz.id);
    const bucket = byNorm.get(norm);
    if (bucket) bucket.push(cz);
    else byNorm.set(norm, [cz]);
  }
  if (exact.size === 0) {
    throw new InvalidTemplateContractError(
      ['the zone graph is empty — the LLM must describe at least one zone (repair).'],
      [{
        family: 'draft_contract',
        code: 'topology_empty',
        locator: {
          kind: 'collection',
          collectionRole: 'zones',
          fieldRole: 'topology',
        },
      }],
    );
  }
  return { exact, byNorm };
}

/** Resolve a page/transition zone REFERENCE to exactly one canonical zone, or throw (→ repair). Exact id wins;
 *  otherwise a single normalized match; 0 or >1 candidates is unresolved/ambiguous — never guessed. */
function resolveZoneRef(
  ref: string,
  graph: ZoneGraph,
  label: string,
  locator: DraftValidationLocator,
): CanonicalZone {
  const exact = graph.exact.get(ref);
  if (exact) return exact;
  const candidates = graph.byNorm.get(normalizeTopoId(ref)) ?? [];
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) {
    throw new InvalidTemplateContractError(
      [`${label} references zone "${ref}" which is not a declared zone — canonicalize the id or repair (no guess).`],
      [{ family: 'draft_contract', code: 'unresolved_reference', locator }],
    );
  }
  throw new InvalidTemplateContractError(
    [
      `${label} reference "${ref}" is ambiguous — it matches ${candidates.length} declared zones (${candidates.map((c) => c.id).join(', ')}); repair (no guess).`,
    ],
    [{ family: 'draft_contract', code: 'ambiguous_reference', locator }],
  );
}

/**
 * Canonicalize the draft's page topology against the zone graph. For each page: resolve zoneId → canonical zone,
 * DERIVE locationId from that zone (membership holds by construction), and rewrite any present transition
 * from/to reference. Absent transition refs are left for the validator (its message is precise). Returns the
 * rewritten page objects + review notes for every id the compiler had to canonicalize/override.
 */
function canonicalizeTopology(
  draft: Record<string, unknown>,
  authoredCoverAuthority?: AuthoredCoverAuthority,
): {
  pages: Record<string, unknown>[];
  cover: Record<string, unknown>;
  notes: string[];
} {
  const graph = buildZoneGraph(draft);
  const notes: string[] = [];
  const pages = asArr(draft.pageContracts).map((raw) => {
    const pc: Record<string, unknown> = { ...asObj(raw) };
    const label = typeof pc.pageNumber === 'number' ? `page ${pc.pageNumber}` : 'a page';
    const pageLocator: DraftValidationLocator =
      Number.isSafeInteger(pc.pageNumber) && Number(pc.pageNumber) > 0
        ? {
            kind: 'page',
            fieldRole: 'topology',
            pageNumber: Number(pc.pageNumber),
          }
        : { kind: 'root', fieldRole: 'topology' };
    if (!isStr(pc.zoneId) || !pc.zoneId.trim()) {
      throw new InvalidTemplateContractError(
        [`${label} has no zoneId — it cannot be placed in the zone graph (repair).`],
        [{ family: 'draft_contract', code: 'unresolved_reference', locator: pageLocator }],
      );
    }
    const zone = resolveZoneRef(pc.zoneId, graph, label, pageLocator);
    if (pc.zoneId !== zone.id) notes.push(`${label} zoneId "${pc.zoneId}" canonicalized to "${zone.id}"`);
    if (isStr(pc.locationId) && pc.locationId !== zone.locationId) {
      notes.push(`${label} locationId "${pc.locationId}" overridden to "${zone.locationId}" (derived from zone "${zone.id}")`);
    }
    pc.zoneId = zone.id;
    pc.locationId = zone.locationId; // location is DERIVED from the zone graph — never guessed.

    const t = asObj(pc.transition);
    if (Object.keys(t).length > 0) {
      const t2: Record<string, unknown> = { ...t };
      const transitionLocator: DraftValidationLocator = {
        ...pageLocator,
        fieldRole: 'transition',
      };
      if (isStr(t.fromZoneId)) t2.fromZoneId = resolveZoneRef(t.fromZoneId, graph, `${label}.transition.fromZoneId`, transitionLocator).id;
      if (isStr(t.toZoneId)) t2.toZoneId = resolveZoneRef(t.toZoneId, graph, `${label}.transition.toZoneId`, transitionLocator).id;
      pc.transition = t2;
    }
    return pc;
  });
  let cover: Record<string, unknown> = { ...asObj(draft.coverContract) };
  if (authoredCoverAuthority) {
    try {
      const applied = applyAuthoredCoverAuthority({
        cover,
        zones: [...graph.exact.values()],
        authority: authoredCoverAuthority,
      });
      cover = applied.cover;
      notes.push(...applied.notes);
      if (cover.timeOfDay === null) delete cover.timeOfDay;
      return { pages, cover, notes };
    } catch (error) {
      if (error instanceof AuthoredCoverAuthorityError) {
        throw new InvalidTemplateContractError(
          error.issues.map((candidate) => `${candidate.code}: ${candidate.message}`),
          error.issues.map(() => ({
            family: 'draft_contract' as const,
            code: 'cover_source_fidelity_invalid' as const,
            locator: { kind: 'cover' as const, fieldRole: 'authority' as const },
          })),
        );
      }
      throw error;
    }
  }
  let authoredCoverZoneId = isStr(cover.zoneId) && cover.zoneId.trim() ? cover.zoneId : null;
  if (!authoredCoverZoneId) {
    // Offline candidate-upgrade compatibility: old reviewed drafts predate explicit cover zones. Propose the first
    // authored page's zone only when it is inside the already-authored cover location; otherwise a sole zone in that
    // location is unambiguous. This is compiler-time authoring (still subject to human review), never runtime inference.
    const coverLocationId = isStr(cover.locationId) ? cover.locationId : null;
    const firstPageInCoverLocation = [...pages]
      .filter((page) => page.locationId === coverLocationId && isStr(page.zoneId))
      .sort((a, b) => Number(a.pageNumber ?? 0) - Number(b.pageNumber ?? 0))[0];
    const locationZones = [...graph.exact.values()].filter((zone) => zone.locationId === coverLocationId);
    authoredCoverZoneId = isStr(firstPageInCoverLocation?.zoneId)
      ? firstPageInCoverLocation.zoneId
      : locationZones.length === 1
        ? locationZones[0].id
        : null;
    if (!authoredCoverZoneId) {
      throw new InvalidTemplateContractError([
        'coverContract has no zoneId and no unambiguous compiler-time proposal exists (repair).',
      ], [{
        family: 'draft_contract',
        code: 'unresolved_reference',
        locator: { kind: 'cover', fieldRole: 'topology' },
      }]);
    }
    notes.push(`coverContract zoneId proposed as "${authoredCoverZoneId}" from its authored location/page graph`);
  }
  const coverZone = resolveZoneRef(
    authoredCoverZoneId,
    graph,
    'coverContract',
    { kind: 'cover', fieldRole: 'topology' },
  );
  if (isStr(cover.zoneId) && cover.zoneId !== coverZone.id) {
    notes.push(`coverContract zoneId "${cover.zoneId}" canonicalized to "${coverZone.id}"`);
  }
  if (isStr(cover.locationId) && cover.locationId !== coverZone.locationId) {
    notes.push(
      `coverContract locationId "${cover.locationId}" overridden to "${coverZone.locationId}" ` +
        `(derived from zone "${coverZone.id}")`,
    );
  }
  cover.zoneId = coverZone.id;
  cover.locationId = coverZone.locationId;
  if (cover.timeOfDay === null) delete cover.timeOfDay;
  return { pages, cover, notes };
}

/** Strict structured output uses null for optional fields; contracts use omission so validation stays exact. */
function normalizeDraftLocations(raw: unknown): BookVisualContractTemplate['locations'] {
  return asArr(raw).map((value) => {
    const location = { ...asObj(value) };
    if (location.timeOfDay === null) delete location.timeOfDay;
    if (location.topology === null) delete location.topology;
    if (location.setIdentityId === null) delete location.setIdentityId;
    if (location.setReference === null) {
      delete location.setReference;
    } else if (location.setReference !== undefined) {
      const setReference = { ...asObj(location.setReference) };
      for (const field of ['url', 'storageKey', 'prompt']) {
        if (setReference[field] === null) delete setReference[field];
      }
      location.setReference = setReference;
    }
    return location;
  }) as unknown as BookVisualContractTemplate['locations'];
}

function normalizeDraftProps(raw: unknown): BookVisualContractTemplate['recurringProps'] {
  return asArr(raw).map((value) => {
    const prop = { ...asObj(value) };
    for (const field of ['material', 'scale', 'persistence', 'firstRevealPage']) {
      if (prop[field] === null) delete prop[field];
    }
    return prop;
  }) as unknown as BookVisualContractTemplate['recurringProps'];
}

type SpatialRelationDiagnosticContext =
  | {
      kind: 'set_area_relation';
      authorityIndex: number;
      areaIndex: number;
    }
  | {
      kind: 'page_zone_relation';
      zoneIndex: number;
    };

function normalizeSpatialRelations(
  raw: unknown,
  context: SpatialRelationDiagnosticContext,
  authorityIssues: DraftAuthorityReferenceIssue[],
): SpatialRelation[] {
  return asArr(raw).map((rawRelation, index) => {
    const relation = { ...asObj(rawRelation) };
    const locator =
      context.kind === 'set_area_relation'
        ? {
            kind: 'set_area_relation' as const,
            referenceClass: 'spatial_relation' as const,
            fieldRole: 'spatialRelations.objectId' as const,
            authorityIndex: context.authorityIndex,
            areaIndex: context.areaIndex,
            relationIndex: index,
          }
        : {
            kind: 'page_zone_relation' as const,
            referenceClass: 'spatial_relation' as const,
            fieldRole: 'spatialRelations.objectId' as const,
            zoneIndex: context.zoneIndex,
            relationIndex: index,
          };
    if (relation.relation === 'centered_in') {
      if (relation.objectId === null) delete relation.objectId;
      if (Object.prototype.hasOwnProperty.call(relation, 'objectId')) {
        authorityIssues.push(
          {
            code: 'unary_relation_object_forbidden',
            locator,
          },
        );
      }
    } else if (
      typeof relation.objectId !== 'string' ||
      relation.objectId.length === 0
    ) {
      authorityIssues.push(
        {
          code: 'binary_relation_object_required',
          locator,
        },
      );
    }
    return relation as unknown as SpatialRelation;
  });
}

function normalizeDraftZone(rawZone: unknown): Record<string, unknown> {
  const zone = { ...asObj(rawZone) };
  const nodes = asArr(zone.spatialNodes).map((rawNode) => {
    const node = { ...asObj(rawNode) };
    if (node.bindsTo === null) delete node.bindsTo;
    return node;
  });
  if (nodes.length > 0) zone.spatialNodes = nodes;
  else delete zone.spatialNodes;
  return zone;
}

/**
 * Close the set-area/page-zone and stable-prop domains before semantic
 * validation. Projection uses exact IDs only; ambiguity is never repairable.
 */
function normalizeDraftSpatialAuthorities(args: {
  draft: Record<string, unknown>;
  pages: readonly Record<string, unknown>[];
}): {
  zones: BookVisualContractTemplate['zones'];
  setBoardAuthorities: BookVisualContractTemplate['setBoardAuthorities'];
} {
  const authorityIssues: DraftAuthorityReferenceIssue[] = [];
  const zones = asArr(args.draft.zones).map(normalizeDraftZone);
  const zoneById = new Map<
    string,
    { zone: Record<string, unknown>; zoneIndex: number }
  >();
  for (const [zoneIndex, zone] of zones.entries()) {
    if (typeof zone.id === 'string') {
      const existing = zoneById.get(zone.id);
      if (existing) {
        authorityIssues.push(
          {
            code: 'page_zone_id_duplicate',
            locator: {
              kind: 'page_zone',
              referenceClass: 'page_zone',
              fieldRole: 'zones.id',
              zoneIndex,
            },
          },
        );
      } else {
        zoneById.set(zone.id, { zone, zoneIndex });
      }
    }
  }

  const propCandidatesById = new Map<
    string,
    Record<string, unknown>[]
  >();
  for (const prop of asArr(args.draft.recurringProps).map(asObj)) {
    if (typeof prop.id !== 'string') continue;
    const matches = propCandidatesById.get(prop.id) ?? [];
    matches.push(prop);
    propCandidatesById.set(prop.id, matches);
  }

  const zoneOwner = new Map<
    string,
    {
      authorityIndex: number;
      areaIndex: number;
      projectionIndex: number;
    }
  >();
  const stablePropPlacementIds = new Set<string>();
  const setIds = new Set<string>();
  const authorities = asArr(args.draft.setBoardAuthorities).map(
    (rawAuthority, authorityIndex) => {
      const authority = { ...asObj(rawAuthority) };
      if (
        Object.prototype.hasOwnProperty.call(
          authority,
          'fixedObjects',
        )
      ) {
        authorityIssues.push(
          {
            code: 'set_fixed_objects_forbidden',
            locator: {
              kind: 'set_authority',
              referenceClass: 'set_identity',
              fieldRole: 'setBoardAuthorities.fixedObjects',
              authorityIndex,
            },
          },
        );
      }
      const setIdentityId =
        typeof authority.setIdentityId === 'string'
          ? authority.setIdentityId
          : '';
      if (setIds.has(setIdentityId)) {
        authorityIssues.push(
          {
            code: 'set_identity_id_duplicate',
            locator: {
              kind: 'set_authority',
              referenceClass: 'set_identity',
              fieldRole: 'setBoardAuthorities.setIdentityId',
              authorityIndex,
            },
          },
        );
      }
      setIds.add(setIdentityId);

      const stablePropIds = new Set<string>();
      const areas = asArr(authority.areas).map(
        (rawArea, areaIndex) => {
          const area = { ...asObj(rawArea) };
          const nodes = asArr(area.spatialNodes).map(
            (rawNode, nodeIndex) => {
              const node = { ...asObj(rawNode) };
              const hasLegacyPropId =
                Object.prototype.hasOwnProperty.call(node, 'propId');
              const stablePropId = node.stablePropId;
              delete node.stablePropId;
              delete node.propId;
              if (hasLegacyPropId) {
                authorityIssues.push(
                  {
                    code: 'recurring_prop_reference_type_invalid',
                    locator: {
                      kind: 'set_area_node',
                      referenceClass: 'recurring_prop',
                      fieldRole: 'spatialNodes.stablePropId',
                      authorityIndex,
                      areaIndex,
                      nodeIndex,
                    },
                  },
                );
              }
              if (stablePropId !== null && stablePropId !== undefined) {
                if (typeof stablePropId !== 'string') {
                  authorityIssues.push(
                    {
                      code: 'recurring_prop_reference_type_invalid',
                      locator: {
                        kind: 'set_area_node',
                        referenceClass: 'recurring_prop',
                        fieldRole: 'spatialNodes.stablePropId',
                        authorityIndex,
                        areaIndex,
                        nodeIndex,
                      },
                    },
                  );
                } else {
                  const candidates =
                    propCandidatesById.get(stablePropId) ?? [];
                  if (
                    candidates.length !== 1 ||
                    stablePropPlacementIds.has(stablePropId)
                  ) {
                    authorityIssues.push(
                      {
                        code: 'recurring_prop_reference_cardinality_invalid',
                        locator: {
                          kind: 'set_area_node',
                          referenceClass: 'recurring_prop',
                          fieldRole: 'spatialNodes.stablePropId',
                          authorityIndex,
                          areaIndex,
                          nodeIndex,
                        },
                      },
                    );
                  } else {
                    stablePropPlacementIds.add(stablePropId);
                    const prop = candidates[0]!;
                    if (prop.firstRevealPage !== null && prop.firstRevealPage !== undefined) {
                      authorityIssues.push(
                        {
                          code: 'recurring_prop_lifecycle_gated',
                          locator: {
                            kind: 'set_area_node',
                            referenceClass: 'recurring_prop',
                            fieldRole: 'spatialNodes.stablePropId',
                            authorityIndex,
                            areaIndex,
                            nodeIndex,
                          },
                        },
                      );
                    }
                    const consumerLocationIds = new Set(
                      asArr(authority.locations)
                        .map((value) => asObj(value).locationId)
                        .filter(isStr),
                    );
                    const forbidden = args.pages.some(
                      (page) =>
                        typeof page.locationId === 'string' &&
                        consumerLocationIds.has(page.locationId) &&
                        asArr(page.propConstraints).some(
                          (rawConstraint) => {
                            const constraint = asObj(rawConstraint);
                            return (
                              constraint.propId === stablePropId &&
                              constraint.visibility === 'forbidden'
                            );
                          },
                        ),
                    );
                    if (forbidden) {
                      authorityIssues.push(
                        {
                          code: 'recurring_prop_consumer_forbidden',
                          locator: {
                            kind: 'set_area_node',
                            referenceClass: 'recurring_prop',
                            fieldRole: 'spatialNodes.stablePropId',
                            authorityIndex,
                            areaIndex,
                            nodeIndex,
                          },
                        },
                      );
                    }
                    stablePropIds.add(stablePropId);
                  }
                  node.propId = stablePropId;
                }
              }
              return node;
            },
          );
          area.spatialNodes = nodes;
          const relations = normalizeSpatialRelations(
            area.spatialRelations,
            {
              kind: 'set_area_relation',
              authorityIndex,
              areaIndex,
            },
            authorityIssues,
          );
          if (relations.length > 0) area.spatialRelations = relations;
          else delete area.spatialRelations;

          const projection = asObj(area.zoneProjection);
          const cardinality = projection.cardinality;
          const zoneSelections = asArr(projection.zoneIds)
            .map((zoneId, projectionIndex) => ({
              zoneId,
              projectionIndex,
            }))
            .filter(
              (selection): selection is {
                zoneId: string;
                projectionIndex: number;
              } => isStr(selection.zoneId),
            );
          const zoneIds = zoneSelections.map(
            (selection) => selection.zoneId,
          );
          if (
            (cardinality === 'one_to_one' && zoneIds.length !== 1) ||
            (cardinality === 'one_to_many' && zoneIds.length < 2) ||
            (cardinality !== 'one_to_one' &&
              cardinality !== 'one_to_many')
          ) {
            authorityIssues.push(
              {
                code: 'zone_projection_cardinality_invalid',
                locator: {
                  kind: 'set_area_projection',
                  referenceClass: 'zone_projection',
                  fieldRole: 'zoneProjection.cardinality',
                  authorityIndex,
                  areaIndex,
                },
              },
            );
          }
          const seenZoneIds = new Set<string>();
          for (const selection of zoneSelections) {
            if (seenZoneIds.has(selection.zoneId)) {
              authorityIssues.push({
                code: 'zone_projection_duplicate_zone',
                locator: {
                  kind: 'set_area_projection_zone',
                  referenceClass: 'zone_projection',
                  fieldRole: 'zoneProjection.zoneIds',
                  authorityIndex,
                  areaIndex,
                  projectionIndex: selection.projectionIndex,
                },
              });
            }
            seenZoneIds.add(selection.zoneId);
          }
          area.zoneProjection = { cardinality, zoneIds };

          for (const selection of zoneSelections) {
            const zoneRecord = zoneById.get(selection.zoneId);
            const projectionLocator = {
              kind: 'set_area_projection_zone' as const,
              referenceClass: 'zone_projection' as const,
              fieldRole: 'zoneProjection.zoneIds' as const,
              authorityIndex,
              areaIndex,
              projectionIndex: selection.projectionIndex,
            };
            if (!zoneRecord) {
              authorityIssues.push(
                {
                  code: 'zone_projection_unknown_zone',
                  locator: projectionLocator,
                },
              );
              continue;
            }
            const zone = zoneRecord.zone;
            if (zone.locationId !== area.locationId) {
              authorityIssues.push(
                {
                  code: 'zone_projection_location_mismatch',
                  locator: projectionLocator,
                },
              );
            }
            const priorOwner = zoneOwner.get(selection.zoneId);
            if (priorOwner) {
              authorityIssues.push(
                {
                  code: 'zone_projection_ambiguous_owner',
                  locator: projectionLocator,
                },
              );
              continue;
            }
            zoneOwner.set(selection.zoneId, {
              authorityIndex,
              areaIndex,
              projectionIndex: selection.projectionIndex,
            });
            zone.spatialNodes = nodes.map((node) => ({
              id: node.id,
              kind: node.kind,
              description: node.description,
              ...(typeof node.propId === 'string'
                ? {
                    bindsTo: {
                      kind: 'prop' as const,
                      id: node.propId,
                    },
                  }
                : {}),
            }));
            if (relations.length > 0) {
              zone.spatialRelations = structuredClone(relations);
            } else {
              delete zone.spatialRelations;
            }
            zone.stableGeometry = projectZoneStableGeometry(
              zone as unknown as VisualZone,
            );
          }
          return area;
        },
      );
      authority.areas = areas;

      authority.fixedObjects = [...stablePropIds]
        .map((propId) => {
          const prop = propCandidatesById.get(propId)![0]!;
          return {
            propId,
            name: prop.name,
            quantity: 1,
          };
        })
        .sort((left, right) =>
          left.propId < right.propId
            ? -1
            : left.propId > right.propId
              ? 1
              : 0,
        );
      return authority;
    },
  );

  const boardRequiredLocationIds = new Set(
    asArr(args.draft.locations)
      .map(asObj)
      .filter((location) => {
        const status = asObj(location.setReference).status;
        return status === 'pending' || status === 'ready';
      })
      .map((location) => location.id)
      .filter(isStr),
  );
  for (const [zoneIndex, zone] of zones.entries()) {
    if (
      typeof zone.id === 'string' &&
      typeof zone.locationId === 'string' &&
      boardRequiredLocationIds.has(zone.locationId) &&
      !zoneOwner.has(zone.id)
    ) {
      authorityIssues.push(
        {
          code: 'board_required_zone_unprojected',
          locator: {
            kind: 'page_zone',
            referenceClass: 'zone_projection',
            fieldRole: 'zones.stableAreaProjection',
            zoneIndex,
          },
        },
      );
    }

    if (!zoneOwner.has(String(zone.id))) {
      const relations = normalizeSpatialRelations(
        zone.spatialRelations,
        { kind: 'page_zone_relation', zoneIndex },
        authorityIssues,
      );
      if (relations.length > 0) zone.spatialRelations = relations;
      else delete zone.spatialRelations;
    }
    if (Array.isArray(zone.spatialNodes) && zone.spatialNodes.length > 0) {
      zone.stableGeometry = projectZoneStableGeometry(
        zone as unknown as VisualZone,
      );
    }
  }

  if (authorityIssues.length > 0) {
    throw new DraftAuthorityReferenceDomainError(authorityIssues);
  }
  return {
    zones: zones as unknown as BookVisualContractTemplate['zones'],
    setBoardAuthorities:
      authorities.length > 0
        ? (authorities as unknown as SetBoardStableAuthority[])
        : undefined,
  };
}

function assertPageSpatialReferenceDomains(args: {
  pages: readonly Record<string, unknown>[];
  zones: BookVisualContractTemplate['zones'];
}): void {
  const zoneNodeIds = new Map(
    args.zones.map((zone) => [
      zone.id,
      new Set((zone.spatialNodes ?? []).map((node) => node.id)),
    ]),
  );
  const issues: DraftAuthorityReferenceIssue[] = [];
  const check = (
    pageNumber: number,
    zoneId: string,
    value: unknown,
    locator:
      | {
          kind: 'page_spatial_action';
          actionIndex: number;
          fieldRole: Extract<
            DraftAuthorityReferenceFieldRole,
            | 'subject'
            | 'object'
            | 'spatialEffect.target'
            | 'spatialConstraint.target'
          >;
        }
      | {
          kind: 'page_spatial_safety_constraint';
          safetyConstraintIndex: number;
          fieldRole: 'safetyConstraints.target';
        },
  ): void => {
    const ref = asObj(value);
    if (ref.kind !== 'spatial' || typeof ref.id !== 'string') return;
    if (!(zoneNodeIds.get(zoneId) ?? new Set()).has(ref.id)) {
      issues.push({
        code: 'page_spatial_reference_outside_zone',
        locator: {
          ...locator,
          referenceClass: 'page_spatial_selection',
          pageNumber,
        },
      });
    }
  };
  for (const page of args.pages) {
    const pageNumber = Number(page.pageNumber);
    const zoneId = typeof page.zoneId === 'string' ? page.zoneId : '';
    for (const [index, rawAction] of asArr(
      page.actionRequirements,
    ).entries()) {
      const action = asObj(rawAction);
      const subject = asObj(action.subject);
      if (subject.kind === 'entity') {
        check(
          pageNumber,
          zoneId,
          subject.entity,
          {
            kind: 'page_spatial_action',
            actionIndex: index,
            fieldRole: 'subject',
          },
        );
      }
      check(
        pageNumber,
        zoneId,
        action.object,
        {
          kind: 'page_spatial_action',
          actionIndex: index,
          fieldRole: 'object',
        },
      );
      const effect = asObj(action.spatialEffect);
      if (effect.kind === 'relation') {
        check(
          pageNumber,
          zoneId,
          effect.target,
          {
            kind: 'page_spatial_action',
            actionIndex: index,
            fieldRole: 'spatialEffect.target',
          },
        );
      }
      const constraint = asObj(action.spatialConstraint);
      if (constraint.relation === 'beside') {
        check(
          pageNumber,
          zoneId,
          constraint.target,
          {
            kind: 'page_spatial_action',
            actionIndex: index,
            fieldRole: 'spatialConstraint.target',
          },
        );
      }
    }
    for (const [index, rawConstraint] of asArr(
      page.safetyConstraints,
    ).entries()) {
      check(
        pageNumber,
        zoneId,
        asObj(rawConstraint).target,
        {
          kind: 'page_spatial_safety_constraint',
          safetyConstraintIndex: index,
          fieldRole: 'safetyConstraints.target',
        },
      );
    }
  }
  if (issues.length > 0) {
    throw new DraftAuthorityReferenceDomainError(issues);
  }
}

function sourceEvidenceValidationMessages(
  records: readonly SourceEvidenceIdRepairAffectedRecord[],
): string[] {
  return records.map(
    (record) =>
      `source_evidence_id_invalid:${record.failureCode}: page ${record.pageNumber}.actionSemanticCoverage[${record.coverageIndex}].sourceEvidenceId must resolve to one exact current-catalog excerpt on page ${record.pageNumber}`,
  );
}

/**
 * Assemble ONE template CANDIDATE from a single descriptive draft: authoritative cast + compiler-owned
 * appearance/topology/worldType, the fact overlay LAST, then the structural cast invariant + the full fail-closed
 * validator. PURE (no LLM). Throws InvalidTemplateContractError on ANY problem — the caller's bounded repair loop
 * catches that and re-drafts. Returns the valid template + review notes.
 */
function assembleTemplateFromDraft(
  draft: Record<string, unknown>,
  facts: DeterministicFacts,
  input: TemplateCompileInput,
  authoringModel: string,
): {
  template: BookVisualContractTemplate;
  notes: string[];
  actionSemanticCoverage: ActionSemanticCoverageRecord[];
} {
  const notes: string[] = [];
  const actionSemanticCoverage: ActionSemanticCoverageRecord[] =
    [];
  const sourceEvidenceIssues: SourceEvidenceIdRepairAffectedRecord[] =
    [];

  // Cast IDENTITY + PRESENCE are AUTHORITATIVE from the input/facts — NEVER the draft. The child id is a fixed
  // constant; the companion id comes from input.companion (the order); humans come from the extractor. The draft
  // contributes ONLY descriptive fields (wardrobe / appearance prose). This is the class fix: draft.cast can
  // neither inject nor suppress a cast member's identity or presence.
  const draftCast = asObj(draft.cast);
  const draftChild = asObj(draftCast.child);
  const draftCompanion = asObj(draftCast.companion);
  const childId = CHILD_ID;
  const companionId = authoritativeCompanionCastId(input);

  // Surface (don't silently swallow) a draft that tried to mis-id or inject a companion — identity is input-authoritative.
  const draftCompanionId = typeof draftCompanion.id === 'string' ? (draftCompanion.id as string) : undefined;
  if (input.companion && draftCompanionId && draftCompanionId !== companionId) {
    notes.push(`draft cast.companion.id "${draftCompanionId}" != authoritative companion id "${companionId}" (from input.companion) — draft identity ignored`);
  }
  if (!input.companion && draftCompanionId) {
    notes.push(`draft cast.companion "${draftCompanionId}" dropped — the order has no companion (identity is input-authoritative)`);
  }

  // Build cast from authoritative id/role (+ authoritative companion name), keeping ONLY the draft's descriptive
  // subfields (wardrobe). Spread-then-override so a draft id/role/name can never win.
  const authoritativeCast: Record<string, unknown> = {
    child: { ...draftChild, id: childId, role: 'child' },
  };
  if (input.companion) {
    authoritativeCast.companion = {
      ...draftCompanion,
      id: companionId,
      role: 'companion',
      ...(input.companion.name ? { name: input.companion.name } : {}),
    };
  }

  // humanCast is AUTHORITATIVE from the extractor: every detected human, merged with its drafted appearance.
  const draftHumans = asArr(draft.humanCast).map(asObj);
  const humanCast: TemplateHumanCastMember[] = facts.humans.map((h) => {
    const match = draftHumans.find((d) => d.id === h.id || d.role === h.role) ?? {};
    return mergeHuman(h, match);
  });
  // Flag any drafted human the extractor did NOT detect (dropped — the LLM cannot add cast the text doesn't support).
  for (const d of draftHumans) {
    const id = typeof d.id === 'string' ? d.id : '';
    if (id && !facts.humans.some((h) => h.id === id)) {
      notes.push(`draft human "${id}" not detected in the text — dropped (extractor is authoritative for cast)`);
    }
  }

  // Topology: canonicalize IDs + rewrite page/transition refs against the ONE zone graph (compiler-owned),
  // then overlay the fact-derived cast/presence LAST. Ambiguity/unresolved refs throw → repair.
  const { pages: canonicalPages, cover: canonicalCover, notes: topoNotes } = canonicalizeTopology(
    draft,
    input.authoredCoverAuthority,
  );
  notes.push(...topoNotes);
  const spatialAuthority = normalizeDraftSpatialAuthorities({
    draft,
    pages: canonicalPages,
  });
  const capabilityGaps: ActionSemanticCapabilityGap[] = [];
  const coverageIssues: string[] = [];
  const coverageDiagnosticIssues: DraftValidationIssue[] = [];
  const pageContracts = canonicalPages.map((pc) => {
    const grounded = sourceGroundPageActionSemantics(
      pc,
      input.sourceEvidenceCatalog,
    );
    actionSemanticCoverage.push(...grounded.coverage);
    sourceEvidenceIssues.push(...grounded.sourceEvidenceIssues);
    capabilityGaps.push(...grounded.capabilityGaps);
    coverageIssues.push(...grounded.issues);
    coverageDiagnosticIssues.push(...grounded.diagnosticIssues);
    return overlayPage(
      grounded.page,
      facts,
      childId,
      companionId,
    );
  });
  assertPageSpatialReferenceDomains({
    pages: pageContracts,
    zones: spatialAuthority.zones,
  });
  const seenBeatIds = new Set<string>();
  for (const [beatIndex, beat] of [
    ...actionSemanticCoverage,
    ...capabilityGaps,
  ].entries()) {
    if (seenBeatIds.has(beat.beatId)) {
      coverageIssues.push(
        `Action Semantic Coverage beatId "${beat.beatId}" is duplicated`,
      );
      coverageDiagnosticIssues.push({
        family: 'action_semantic',
        code: 'beat_identity_duplicate',
        locator: draftValidationLocatorForUntrustedPage({
          positiveKind: 'page',
          fieldRole: 'identity',
          pageNumber: beat.pageNumber,
          fallbackCollectionRole: 'page_action_semantic_coverage',
          itemIndex: beatIndex,
        }),
      });
    }
    seenBeatIds.add(beat.beatId);
  }
  if (coverageIssues.length > 0) {
    throw new InvalidTemplateContractError(
      [
        ...sourceEvidenceValidationMessages(sourceEvidenceIssues),
        ...coverageIssues,
      ],
      [
        ...sourceEvidenceIdDiagnosticIssues(sourceEvidenceIssues),
        ...coverageDiagnosticIssues,
      ],
    );
  }
  if (capabilityGaps.length > 0) {
    throw new ActionSemanticCapabilityGapError(capabilityGaps);
  }
  if (!Array.isArray(canonicalCover.castIds) || canonicalCover.castIds.length === 0) {
    const firstPage = [...pageContracts].sort(
      (a, b) => Number(a.pageNumber ?? 0) - Number(b.pageNumber ?? 0),
    )[0];
    const proposedCastIds = asArr(firstPage?.castIds).filter(isStr);
    canonicalCover.castIds = proposedCastIds.length > 0 ? proposedCastIds : [childId];
    notes.push('coverContract castIds proposed from the fact-authoritative first page for human review');
  }

  // worldType is LLM+human (semantic) — NO silent 'unspecified' default; a missing value fails (fail-closed →
  // repair). coverContract.worldType is COMPILER-owned: copied from the finalized top-level worldType.
  const worldType =
    (typeof draft.worldType === 'string' && draft.worldType.trim() ? draft.worldType.trim() : input.worldType?.trim()) ?? '';
  if (!worldType) {
    throw new InvalidTemplateContractError(
      ['worldType is missing — the semantic world type must be set (no silent default); author or repair it.'],
      [{
        family: 'draft_contract',
        code: 'world_type_missing',
        locator: { kind: 'root', fieldRole: 'world_type' },
      }],
    );
  }

  const setBoardAuthorities = spatialAuthority.setBoardAuthorities;
  const template: BookVisualContractTemplate = {
    contractKind: 'template',
    schemaVersion: VISUAL_CONTRACT_SCHEMA_VERSION,
    version: 1,
    storyKey: input.storyKey,
    worldType,
    locations: normalizeDraftLocations(draft.locations),
    zones: spatialAuthority.zones,
    ...(setBoardAuthorities ? { setBoardAuthorities } : {}),
    cast: authoritativeCast as unknown as BookVisualContractTemplate['cast'],
    humanCast,
    recurringProps: normalizeDraftProps(draft.recurringProps),
    forbiddenGlobalElements: asArr(draft.forbiddenGlobalElements).filter((x): x is string => typeof x === 'string'),
    coverContract: { ...canonicalCover, worldType } as unknown as BookVisualContractTemplate['coverContract'],
    pageContracts: pageContracts as unknown as BookVisualContractTemplate['pageContracts'],
    provenance: { source: 'llm', model: authoringModel, compiledFromPages: input.pageCount },
  };

  // Prop lifecycle is compiler-owned authority, just like cover worldType. An authored page-0 source can replace
  // stale draft prohibitions, so append the exact structured lifecycle projection after topology/source overlay.
  // This keeps cover containment complete without asking prose to duplicate structured data.
  template.coverContract.mustNotShow = [
    ...new Set([
      ...template.coverContract.mustNotShow,
      ...projectCoverMustNotShow(template as unknown as BookVisualContract),
    ]),
  ];

  // coverContract.worldType is a COMPILER-owned copy of the top-level worldType — enforce the equality invariant.
  if ((template.coverContract as { worldType?: unknown }).worldType !== template.worldType) {
    throw new InvalidTemplateContractError([
      `coverContract.worldType "${String((template.coverContract as { worldType?: unknown }).worldType)}" != top-level worldType "${template.worldType}"`,
    ], [{
      family: 'draft_contract',
      code: 'cover_projection_invalid',
      locator: { kind: 'cover', fieldRole: 'world_type' },
    }]);
  }

  if (input.authoredCoverAuthority) {
    const sourceIssues = coverSourceFidelityIssues(template, input.authoredCoverAuthority);
    if (sourceIssues.length > 0) {
      throw new InvalidTemplateContractError(
        sourceIssues.map((candidate) => `${candidate.code}: ${candidate.message}`),
        sourceIssues.map(() => ({
          family: 'draft_contract' as const,
          code: 'cover_source_fidelity_invalid' as const,
          locator: { kind: 'cover' as const, fieldRole: 'authority' as const },
        })),
      );
    }
  }

  // STRUCTURAL INVARIANT (fail-closed): every cast identity + presence must match the input/facts EXACTLY, so a
  // future refactor that lets draft.cast leak into identity/presence throws here instead of shipping.
  assertCastIsFactAuthoritative(template, facts, input);

  // (Stage 4) FAIL-CLOSED source-evidence check: a hazard that CITES a story quote must actually be quoting that
  // page. Only the compiler holds the source pages, so this cannot live in the validators. An unchecked citation is
  // the same hallucination surface assertSourceHasRealProse closes — an invented-but-consistent claim passes every
  // structural check. Errors are thrown as InvalidTemplateContractError so the bounded repair loop consumes them
  // exactly like validator errors.
  const evidenceValidation = sourceEvidenceValidation(
    template as unknown as BookVisualContract,
    input.pages,
  );
  if (evidenceValidation.errors.length > 0) {
    throw new InvalidTemplateContractError(
      evidenceValidation.errors,
      evidenceValidation.diagnosticIssues,
    );
  }

  // FAIL-CLOSED — never return an invalid candidate.
  assertValidBookVisualContractTemplate(template);
  const semanticCoverageValidation = actionSemanticCoverageValidation({
    template: template as unknown as BookVisualContract,
    coverage: actionSemanticCoverage,
  });
  if (semanticCoverageValidation.errors.length > 0) {
    throw new InvalidTemplateContractError(
      [
        ...sourceEvidenceValidationMessages(sourceEvidenceIssues),
        ...semanticCoverageValidation.errors,
      ],
      [
        ...sourceEvidenceIdDiagnosticIssues(sourceEvidenceIssues),
        ...semanticCoverageValidation.diagnosticIssues,
      ],
    );
  }
  if (sourceEvidenceIssues.length > 0) {
    throw new SourceEvidenceIdValidationError(
      sourceEvidenceIssues,
      sourceEvidenceValidationMessages(sourceEvidenceIssues),
    );
  }
  return { template, notes, actionSemanticCoverage };
}

/**
 * Compile a template CANDIDATE from a story source. Deterministic facts are extracted first and overlaid last; the
 * LLM (injected) drafts descriptive fields only.
 *
 * Stage 3 — BOUNDED REPAIR LOOP: at most MAX_REPAIR_ATTEMPTS semantic repairs AFTER the initial authoring call.
 * Each attempt (re)assembles from the current draft → reapplies compiler policy → overlays facts LAST →
 * assertCastIsFactAuthoritative → the full validator; on any failure it hands the LLM the invalid DESCRIPTIVE
 * draft + the EXACT errors + the authoritative facts and asks for a corrected draft (compiler-owned + fact fields
 * are re-derived, so LLM edits to them are ignored). Fail-closed: returns NOTHING unless an attempt fully passes;
 * on exhaustion it throws TemplateRepairExhaustedError carrying the whole attempt trail (write nothing).
 */
export async function compileBookVisualContractTemplate(
  input: TemplateCompileInput,
  deps: { callLLM: ContractLlmCaller },
): Promise<TemplateCompileResult> {
  // FAIL-CLOSED belt-and-suspenders: NEVER author a contract from empty/thin source. Even if a bad source somehow
  // reaches the compiler (the extractor guard is the first line), refuse before the LLM call so it cannot hallucinate
  // a fully-valid contract out of nothing.
  assertSourceHasRealProse(input.storyKey, input.pages, 'compile-vc-template');
  assertValidSourceEvidenceCatalog({
    catalog: input.sourceEvidenceCatalog,
    storyKey: input.storyKey,
    sourceIdentity: input.sourceIdentity,
    pages: input.pages,
  });
  assertOpenAIResponsesStructuredOutputSchemaCompatible(
    TEMPLATE_DRAFT_JSON_SCHEMA,
  );
  assertOpenAIResponsesStructuredOutputSchemaCompatible(
    SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA,
  );
  assertOpenAIResponsesStructuredOutputSchemaCompatible(
    PAGE_CONTRACT_REPAIR_JSON_SCHEMA,
  );

  const facts = extractDeterministicFacts(input);

  // Dedicated authoring call: real reasoning model + strict structured output + a budget scaled to the page count,
  // with NO silent model fallback. The SAME options are reused for every repair call.
  const authoringModel = resolveAuthoringModel();
  const maxOutputTokens = authoringMaxOutputTokens(input.pageCount);
  const llmOpts = {
    maxOutputTokens,
    model: authoringModel,
    reasoningEffort: AUTHORING_REASONING_EFFORT,
    jsonSchema: { name: TEMPLATE_DRAFT_SCHEMA_NAME, schema: TEMPLATE_DRAFT_JSON_SCHEMA },
    noFallback: VISUAL_CONTRACT_AUTHORING_NO_FALLBACK,
    provider: VISUAL_CONTRACT_AUTHORING_PROVIDER,
    endpoint: VISUAL_CONTRACT_AUTHORING_ENDPOINT,
    serviceTier: VISUAL_CONTRACT_AUTHORING_SERVICE_TIER,
    toolsDisabled: VISUAL_CONTRACT_AUTHORING_TOOLS_DISABLED,
    transportRetries:
      VISUAL_CONTRACT_AUTHORING_TRANSPORT_RETRIES,
    timeoutMs: VISUAL_CONTRACT_AUTHORING_TIMEOUT_MS,
    maxInputTokens:
      VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
  } satisfies ContractLlmCallOptions;
  const compactRepairLlmOpts = {
    ...llmOpts,
    jsonSchema: {
      name: SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_NAME,
      schema: SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA,
    },
  } satisfies ContractLlmCallOptions;
  const pageContractRepairLlmOpts = {
    ...llmOpts,
    jsonSchema: {
      name: PAGE_CONTRACT_REPAIR_SCHEMA_NAME,
      schema: PAGE_CONTRACT_REPAIR_JSON_SCHEMA,
    },
  } satisfies ContractLlmCallOptions;

  let draft = asObj(
    parseContractJson(
      await deps.callLLM(
        buildTemplateCompileSystemPrompt(),
        buildTemplateCompileUserPrompt(input, facts),
        llmOpts,
        {
          kind: 'initial',
          systemPromptVersion: TEMPLATE_PROMPT_VERSION,
          userPromptVersion: TEMPLATE_USER_PROMPT_VERSION,
        },
      ),
    ),
  );

  const repairAttempts: TemplateRepairAttempt[] = [];
  for (let attempt = 1; ; attempt++) {
    let assembled:
      | ReturnType<typeof assembleTemplateFromDraft>
      | null = null;
    let attemptErrors: string[] = [];
    let attemptDiagnosticIssues: readonly DraftValidationIssue[] = [];
    let sourceEvidenceAffectedRecords:
      | SourceEvidenceIdRepairAffectedRecord[]
      | null = null;
    let pageContractAffectedPages:
      | PageContractRepairAffectedPage[]
      | null = null;
    try {
      assembled = assembleTemplateFromDraft(draft, facts, input, authoringModel);
    } catch (err) {
      if (err instanceof InvalidTemplateContractError) {
        attemptErrors = err.errors;
        attemptDiagnosticIssues = err.diagnosticIssues;
        if (err instanceof SourceEvidenceIdValidationError) {
          sourceEvidenceAffectedRecords = err.affectedRecords;
        }
      } else if (
        err instanceof DraftAuthorityReferenceDomainError &&
        pageSpatialReferenceIssuesAreRepairable(err.issues)
      ) {
        attemptErrors = err.issues.map(
          pageSpatialReferenceRepairInstruction,
        );
        attemptDiagnosticIssues = err.issues.map(
          pageSpatialReferenceRepairDiagnostic,
        );
      } else if (err instanceof ActionSemanticCapabilityGapError) {
        throw repairAttempts.length === 0
          ? err
          : new ActionSemanticCapabilityGapError(
              err.gaps,
              repairAttempts.map(
                (repair) => repair.diagnosticIssues,
              ),
            );
      } else {
        throw err; // all other deterministic-authority and local failures remain terminal
      }
    }

    if (!assembled && !sourceEvidenceAffectedRecords) {
      pageContractAffectedPages = pageContractRepairAffectedPages({
        draft,
        diagnosticIssues: attemptDiagnosticIssues,
      });
    }

    if (assembled) {
      const lastRepairMode =
        repairAttempts[repairAttempts.length - 1]?.nextRepairMode;
      const provenance: TemplateAuthoringProvenance = {
        authoringModel,
        reasoningEffort: AUTHORING_REASONING_EFFORT,
        maxOutputTokens,
        schemaVersion: TEMPLATE_DRAFT_SCHEMA_VERSION,
        promptVersion: TEMPLATE_PROMPT_VERSION,
        policyVersion: APPEARANCE_POLICY_VERSION,
        attempt,
        ...(attempt > 1
          ? {
              repairPromptVersion:
                lastRepairMode === 'source_evidence_id_patch'
                  ? SOURCE_EVIDENCE_ID_REPAIR_PROMPT_VERSION
                  : lastRepairMode === 'page_contract_patch'
                    ? PAGE_CONTRACT_REPAIR_PROMPT_VERSION
                  : REPAIR_PROMPT_VERSION,
            }
          : {}),
      };
      return {
        template: assembled.template,
        facts,
        actionSemanticCoverage:
          assembled.actionSemanticCoverage,
        notes: assembled.notes,
        provenance,
        repairAttempts: repairAttempts.map((repair) => ({
          attempt: repair.attempt,
          diagnosticIssues: repair.diagnosticIssues,
          ...(repair.nextRepairMode
            ? { nextRepairMode: repair.nextRepairMode }
            : {}),
        })),
        draftValidationDiagnostics: buildDraftValidationDiagnosticTrail([
          ...repairAttempts.map((repair) => repair.diagnosticIssues),
          [],
        ]),
      };
    }

    // This attempt's draft was invalid — record it (raw draft + exact errors) for reviewability.
    repairAttempts.push({
      attempt,
      errors: attemptErrors,
      diagnosticIssues: attemptDiagnosticIssues,
      draft,
    });

    if (attempt > MAX_REPAIR_ATTEMPTS) {
      // Initial + MAX_REPAIR_ATTEMPTS repairs all failed — fail closed, write nothing, carry the trail.
      throw new TemplateRepairExhaustedError(repairAttempts);
    }

    const repairMode = sourceEvidenceAffectedRecords
      ? 'source_evidence_id_patch'
      : pageContractAffectedPages
        ? 'page_contract_patch'
        : 'full_draft';
    repairAttempts[repairAttempts.length - 1]!.nextRepairMode =
      repairMode;

    // Request a bounded SEMANTIC repair: fix ONLY the descriptive draft against the exact errors (same model, no
    // fallback). Compiler-owned + fact fields are re-derived on the next assemble, so LLM edits to them are ignored.
    // If a completed repair response cannot become a usable draft, stop with
    // a distinct terminal while retaining the prior validation trail only in
    // memory. Provider/policy/budget failures remain classified by the caller.
    try {
      if (sourceEvidenceAffectedRecords) {
        const rawPatch = await deps.callLLM(
          buildSourceEvidenceIdRepairSystemPrompt(),
          buildSourceEvidenceIdRepairUserPrompt({
            catalog: input.sourceEvidenceCatalog,
            affectedRecords: sourceEvidenceAffectedRecords,
          }),
          compactRepairLlmOpts,
          {
            kind: 'repair',
            repairMode: 'source_evidence_id_patch',
            systemPromptVersion:
              SOURCE_EVIDENCE_ID_REPAIR_PROMPT_VERSION,
            userPromptVersion:
              SOURCE_EVIDENCE_ID_REPAIR_USER_PROMPT_VERSION,
          },
        );
        draft = applySourceEvidenceIdPatches({
          draft,
          catalog: input.sourceEvidenceCatalog,
          affectedRecords: sourceEvidenceAffectedRecords,
          patches: parseSourceEvidenceIdPatches(rawPatch),
        });
      } else if (pageContractAffectedPages) {
        const rawPatch = await deps.callLLM(
          buildPageContractRepairSystemPrompt(),
          buildPageContractRepairUserPrompt({
            draft,
            affectedPages: pageContractAffectedPages,
            errors: attemptErrors,
          }),
          pageContractRepairLlmOpts,
          {
            kind: 'repair',
            repairMode: 'page_contract_patch',
            systemPromptVersion:
              PAGE_CONTRACT_REPAIR_PROMPT_VERSION,
            userPromptVersion:
              PAGE_CONTRACT_REPAIR_USER_PROMPT_VERSION,
          },
        );
        draft = applyPageContractRepairs({
          draft,
          affectedPages: pageContractAffectedPages,
          pageContracts: parsePageContractRepairs(rawPatch),
        });
      } else {
        draft = asObj(
          parseContractJson(
            await deps.callLLM(
              buildTemplateRepairSystemPrompt(),
              buildTemplateRepairUserPrompt(
                draft,
                attemptErrors,
                facts,
                input,
              ),
              llmOpts,
              {
                kind: 'repair',
                repairMode: 'full_draft',
                systemPromptVersion: REPAIR_PROMPT_VERSION,
                userPromptVersion: REPAIR_USER_PROMPT_VERSION,
              },
            ),
          ),
        );
      }
    } catch {
      throw new TemplateRepairOutputInvalidError(
        repairAttempts,
        attempt + 1,
        repairMode,
      );
    }
  }
}

/**
 * Assert that NO cast identity or presence came from the LLM draft: the child id is the fixed constant, the
 * companion id ⟺ input.companion, the humanCast set == the extractor's, and every page's castIds +
 * characterPresence.companion equal EXACTLY the fact-derived present set (no injected or suppressed member).
 * Exported so the guarantee is directly testable. Throws InvalidTemplateContractError on any divergence.
 */
export function assertCastIsFactAuthoritative(
  template: BookVisualContractTemplate,
  facts: DeterministicFacts,
  input: { companion?: { id: string; name?: string } | null },
): void {
  const errs: string[] = [];
  const diagnosticIssues: DraftValidationIssue[] = [];
  const cast = asObj(template.cast);
  const childId = typeof asObj(cast.child).id === 'string' ? (asObj(cast.child).id as string) : '';
  if (childId !== CHILD_ID) {
    errs.push(`cast.child.id "${childId}" != authoritative "${CHILD_ID}"`);
    diagnosticIssues.push({
      family: 'draft_contract',
      code: 'cast_authority_mismatch',
      locator: { kind: 'root', fieldRole: 'cast_presence' },
    });
  }

  const companionId = authoritativeCompanionCastId(input);
  const companion = cast.companion;
  if (companionId) {
    const cid = typeof asObj(companion).id === 'string' ? (asObj(companion).id as string) : undefined;
    if (!companion || cid !== companionId) {
      errs.push(`cast.companion.id "${cid ?? '(none)'}" != authoritative "${companionId}"`);
      diagnosticIssues.push({
        family: 'draft_contract',
        code: 'cast_authority_mismatch',
        locator: { kind: 'root', fieldRole: 'cast_presence' },
      });
    }
  } else if (companion) {
    errs.push('cast.companion present but the order has no companion');
    diagnosticIssues.push({
      family: 'draft_contract',
      code: 'cast_authority_mismatch',
      locator: { kind: 'root', fieldRole: 'cast_presence' },
    });
  }

  const factHumanIds = new Set(facts.humans.map((h) => h.id));
  const tmplHumanIds = new Set(template.humanCast.map((h) => h.id));
  if (factHumanIds.size !== tmplHumanIds.size || [...factHumanIds].some((id) => !tmplHumanIds.has(id))) {
    errs.push(`humanCast ids [${[...tmplHumanIds].join(', ')}] != facts [${[...factHumanIds].join(', ')}]`);
    diagnosticIssues.push({
      family: 'draft_contract',
      code: 'fact_authority_mismatch',
      locator: {
        kind: 'collection',
        collectionRole: 'human_cast',
        fieldRole: 'cast_presence',
      },
    });
  }

  for (const [pageIndex, pc] of template.pageContracts.entries()) {
    const expected = new Set<string>([CHILD_ID]);
    if (companionId && facts.companionPresentPages.includes(pc.pageNumber)) expected.add(companionId);
    for (const h of facts.humans) if (h.pagesPresent.includes(pc.pageNumber)) expected.add(h.id);
    const actual = new Set(pc.castIds ?? []);
    const missing = [...expected].filter((id) => !actual.has(id));
    const extra = [...actual].filter((id) => !expected.has(id));
    if (missing.length || extra.length) {
      errs.push(`p${pc.pageNumber} castIds not fact-authoritative — missing [${missing.join(', ')}], extra [${extra.join(', ')}]`);
      diagnosticIssues.push({
        family: 'draft_contract',
        code: 'fact_authority_mismatch',
        locator: draftValidationLocatorForUntrustedPage({
          positiveKind: 'page',
          fieldRole: 'cast_presence',
          pageNumber: pc.pageNumber,
          fallbackCollectionRole: 'page_contracts',
          itemIndex: pageIndex,
        }),
      });
    }
    const shouldCompanion = !!companionId && facts.companionPresentPages.includes(pc.pageNumber);
    if (asObj(pc.characterPresence).companion !== shouldCompanion) {
      errs.push(`p${pc.pageNumber} characterPresence.companion ${String(asObj(pc.characterPresence).companion)} != facts ${shouldCompanion}`);
      diagnosticIssues.push({
        family: 'draft_contract',
        code: 'fact_authority_mismatch',
        locator: draftValidationLocatorForUntrustedPage({
          positiveKind: 'page',
          fieldRole: 'cast_presence',
          pageNumber: pc.pageNumber,
          fallbackCollectionRole: 'page_contracts',
          itemIndex: pageIndex,
        }),
      });
    }
  }

  if (errs.length) {
    throw new InvalidTemplateContractError(
      [`cast/presence not fact-authoritative (draft leak): ${errs.join('; ')}`],
      diagnosticIssues,
    );
  }
}
