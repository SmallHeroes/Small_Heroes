import fs from 'fs';

import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';
import {
  parseStorySourceContent,
  type ParsedStorySourceContent,
} from '@/lib/visual-contract-compiler/storySourceContent';
import type { AuthoredCoverAuthority } from '@/lib/visual-contract-compiler/coverSourceAuthority';
import {
  ACTION_SEMANTIC_COVERAGE_VERSION,
  PRESENTATION_REQUIREMENT_CLASS_VALUES,
  presentationRequirementPointerIsPermittedForPage,
  resolveJsonPointer as resolveCoverageJsonPointer,
  type ActionSemanticCoverageRecord,
  type PresentationRequirementClass,
} from '@/lib/visual-contract-compiler/actionSemanticCoverage';

import { canonicalJsonDigest, isoTimestampIsValid, nonEmpty, resolveRepoPath } from './integrity';
import {
  LEGACY_SOURCE_PROMPT_RECONCILIATION_VERSION,
  SOURCE_PROMPT_PROJECTION_VERSION,
  SOURCE_PROMPT_RECONCILIATION_VERSION,
  type StorySourceIdentity,
  type VisualPackageIssue,
  type VisualPackageReconciliationIdentity,
} from './types';

export type ReconciliationFrameKind = 'cover' | 'page';
export type ReconciliationSourceKind =
  | 'story_prose'
  | 'historical_image_direction'
  | 'authored_cover_authority';
export type ReconciliationDisposition =
  | 'preserved'
  | 'intentionally_superseded'
  | 'unresolved';
export type ReconciliationAspect =
  | 'narrative_meaning'
  | 'action'
  | 'interaction'
  | 'expression'
  | 'camera'
  | 'composition'
  | 'staging';

export interface ReconciliationReviewState {
  status: 'pending' | 'approved';
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface ReconciliationContractEvidence {
  /** RFC-6901 JSON pointer into the exact template bound by templateDigest. */
  path: string;
  /** Exact value at `path`; validation rejects a stale or hand-waved citation. */
  value: unknown;
}

export interface ReconciledVisualBeat {
  id: string;
  description: string;
  aspects: ReconciliationAspect[];
  disposition: ReconciliationDisposition;
  contractEvidence: ReconciliationContractEvidence[];
  justification: string | null;
  supersessionReview: ReconciliationReviewState | null;
}

export interface ReconciliationSourceRequirement {
  sourceKind: ReconciliationSourceKind;
  /** Exact source text/value being reviewed, not a paraphrase. */
  sourceText: string;
  visualBeats: ReconciledVisualBeat[];
}

export interface SourcePromptReconciliationFrame {
  frameKind: ReconciliationFrameKind;
  pageNumber: number;
  contractProjectionDigest: string;
  sourceRequirements: ReconciliationSourceRequirement[];
}

export const PRESENTATION_REQUIREMENT_RECONCILIATION_VERSION =
  'presentation-requirement-reconciliation/v1' as const;
export const ACTION_SEMANTIC_COVERAGE_RECONCILIATION_AUTHORITY_VERSION =
  'action-semantic-coverage-reconciliation-authority/v1' as const;
export const PRESENTATION_REQUIREMENT_DISPOSITION_VERSION =
  'presentation-requirement-disposition/v1' as const;

export interface ReconciliationPresentationRequirement {
  pageNumber: number;
  beatId: string;
  sourceEvidenceId: string;
  presentationClass: PresentationRequirementClass;
  contractPointer: string;
  contractValue: string;
}

export interface PresentationRequirementReconciliationBinding {
  version: typeof PRESENTATION_REQUIREMENT_RECONCILIATION_VERSION;
  actionSemanticCoverageVersion: typeof ACTION_SEMANTIC_COVERAGE_VERSION;
  actionSemanticCoverageDigest: string;
  requirements: ReconciliationPresentationRequirement[];
}

export interface ActionSemanticCoverageReconciliationAuthority {
  version: typeof ACTION_SEMANTIC_COVERAGE_RECONCILIATION_AUTHORITY_VERSION;
  actionSemanticCoverageVersion: typeof ACTION_SEMANTIC_COVERAGE_VERSION;
  actionSemanticCoverageDigest: string;
  records: ActionSemanticCoverageRecord[];
}

export interface ReviewerPresentationRequirementDisposition {
  pageNumber: number;
  beatId: string;
  sourceEvidenceId: string;
  kind: 'rebound' | 'superseded';
  reboundPointer: string | null;
  reboundValue: string | null;
  justification: string | null;
  review: ReconciliationReviewState;
}

export interface PresentationRequirementDispositionBinding {
  version: typeof PRESENTATION_REQUIREMENT_DISPOSITION_VERSION;
  entries: ReviewerPresentationRequirementDisposition[];
}

/**
 * Offline authoring/promotion evidence. This artifact never becomes prompt text: it proves that the frozen
 * contract's provider projection preserves (or explicitly supersedes) every human-reviewed source beat.
 */
export interface SourcePromptReconciliation {
  version: typeof SOURCE_PROMPT_RECONCILIATION_VERSION;
  projectionVersion: typeof SOURCE_PROMPT_PROJECTION_VERSION;
  storyKey: string;
  sourceIdentity: StorySourceIdentity;
  /** Exact D1 source snapshot binding (raw source + pages + image directions + cover authority). */
  sourceAuthoritySnapshotDigest?: string;
  templateDigest: string;
  templateSchemaVersion: string;
  frames: SourcePromptReconciliationFrame[];
  /** Exact candidate coverage authority from which presentation obligations are derived. */
  actionSemanticCoverageAuthority: ActionSemanticCoverageReconciliationAuthority;
  /** Candidate-bound visible non-action beats that require explicit preserved review evidence. */
  presentationRequirements: PresentationRequirementReconciliationBinding;
  /** Human-authored corrections or explicit omissions; never compiler-authored approval. */
  presentationRequirementDispositions: PresentationRequirementDispositionBinding;
  review: ReconciliationReviewState;
}

export interface LegacySourcePromptReconciliationV2
  extends Omit<
    SourcePromptReconciliation,
    'version' | 'presentationRequirementDispositions'
  > {
  version: typeof LEGACY_SOURCE_PROMPT_RECONCILIATION_VERSION;
}

export interface SourcePromptReconciliationInput {
  storyKey: string;
  sourceIdentity: StorySourceIdentity;
  sourceAuthoritySnapshotDigest?: string;
  pages: Array<{ pageNumber: number; text: string }>;
  pageImageDirections?: Array<{ pageNumber: number; imageDirection: string }>;
  authoredCoverAuthority?: AuthoredCoverAuthority;
  actionSemanticCoverage: readonly ActionSemanticCoverageRecord[];
}

function packageIssue(
  code: VisualPackageIssue['code'],
  message: string,
  extra: Omit<VisualPackageIssue, 'code' | 'message'> = {},
): VisualPackageIssue {
  return { code, message, ...extra };
}

function reviewStateIsApproved(value: unknown): value is ReconciliationReviewState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Partial<ReconciliationReviewState>;
  return (
    state.status === 'approved' &&
    nonEmpty(state.reviewedBy) &&
    isoTimestampIsValid(state.reviewedAt)
  );
}

function exactObjectKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function reviewStateIsPending(value: unknown): value is ReconciliationReviewState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  return (
    exactObjectKeys(state, ['status', 'reviewedBy', 'reviewedAt']) &&
    state.status === 'pending' &&
    state.reviewedBy === null &&
    state.reviewedAt === null
  );
}

function reviewStateIsGuyApproved(value: unknown): value is ReconciliationReviewState {
  return reviewStateIsApproved(value) && value.reviewedBy === 'Guy';
}

function reviewStateIsDispositionCompatible(value: unknown): value is ReconciliationReviewState {
  return reviewStateIsPending(value) || reviewStateIsGuyApproved(value);
}

function contractProjection(
  template: BookVisualContractTemplate,
  frameKind: ReconciliationFrameKind,
  pageNumber: number,
): unknown {
  if (frameKind === 'cover') return template.coverContract;
  return template.pageContracts.find((candidate) => candidate.pageNumber === pageNumber) ?? null;
}

export function buildSourcePromptProjectionDigest(
  template: BookVisualContractTemplate,
  frameKind: ReconciliationFrameKind,
  pageNumber: number,
): string {
  return canonicalJsonDigest({
    projectionVersion: SOURCE_PROMPT_PROJECTION_VERSION,
    frameKind,
    pageNumber,
    contract: contractProjection(template, frameKind, pageNumber),
  });
}

function sourceRequirement(
  sourceKind: ReconciliationSourceKind,
  sourceText: string,
): ReconciliationSourceRequirement {
  return { sourceKind, sourceText, visualBeats: [] };
}

function presentationRequirementBinding(
  coverage: readonly ActionSemanticCoverageRecord[],
): PresentationRequirementReconciliationBinding {
  const requirements = coverage
    .filter(
      (record) =>
        record.disposition.kind === 'presentation_requirement',
    )
    .map((record): ReconciliationPresentationRequirement => {
      const disposition = record.disposition;
      if (disposition.kind !== 'presentation_requirement') {
        throw new Error('presentation requirement projection drift');
      }
      return {
        pageNumber: record.pageNumber,
        beatId: record.beatId,
        sourceEvidenceId: record.sourceEvidenceId,
        presentationClass: disposition.presentationClass,
        contractPointer: disposition.contractPointer,
        contractValue: disposition.contractValue,
      };
    });
  return {
    version: PRESENTATION_REQUIREMENT_RECONCILIATION_VERSION,
    actionSemanticCoverageVersion: ACTION_SEMANTIC_COVERAGE_VERSION,
    actionSemanticCoverageDigest: canonicalJsonDigest(coverage),
    requirements,
  };
}

function actionSemanticCoverageAuthority(
  coverage: readonly ActionSemanticCoverageRecord[],
): ActionSemanticCoverageReconciliationAuthority {
  const records = structuredClone([...coverage]);
  return {
    version:
      ACTION_SEMANTIC_COVERAGE_RECONCILIATION_AUTHORITY_VERSION,
    actionSemanticCoverageVersion:
      ACTION_SEMANTIC_COVERAGE_VERSION,
    actionSemanticCoverageDigest: canonicalJsonDigest(records),
    records,
  };
}

/**
 * Produce an intentionally incomplete review draft. A model/compiler cannot approve its own semantic coverage:
 * a reviewer must enumerate the visual beats, cite exact contract fields, and approve the finished artifact.
 */
export function buildSourcePromptReconciliationDraft(
  input: SourcePromptReconciliationInput,
  template: BookVisualContractTemplate,
): SourcePromptReconciliation {
  const actionSemanticCoverage = input.actionSemanticCoverage;
  const directions = new Map(
    (input.pageImageDirections ?? []).map((candidate) => [
      candidate.pageNumber,
      candidate.imageDirection.trim(),
    ]),
  );
  const orderedPages = [...input.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const fullStoryText = orderedPages
    .map((page) => `--- Page ${page.pageNumber} ---\n${page.text.trim()}`)
    .join('\n\n');
  const coverSources = [sourceRequirement('story_prose', fullStoryText)];
  if (input.authoredCoverAuthority) {
    coverSources.push(
      sourceRequirement(
        'authored_cover_authority',
        JSON.stringify(input.authoredCoverAuthority),
      ),
    );
  }
  return {
    version: SOURCE_PROMPT_RECONCILIATION_VERSION,
    projectionVersion: SOURCE_PROMPT_PROJECTION_VERSION,
    storyKey: input.storyKey,
    sourceIdentity: input.sourceIdentity,
    ...(input.sourceAuthoritySnapshotDigest
      ? {
          sourceAuthoritySnapshotDigest:
            input.sourceAuthoritySnapshotDigest,
        }
      : {}),
    templateDigest: canonicalJsonDigest(template),
    templateSchemaVersion: template.schemaVersion,
    frames: [
      {
        frameKind: 'cover',
        pageNumber: 0,
        contractProjectionDigest: buildSourcePromptProjectionDigest(template, 'cover', 0),
        sourceRequirements: coverSources,
      },
      ...orderedPages.map((page): SourcePromptReconciliationFrame => {
        const requirements = [sourceRequirement('story_prose', page.text.trim())];
        const direction = directions.get(page.pageNumber);
        if (direction) {
          requirements.push(sourceRequirement('historical_image_direction', direction));
        }
        return {
          frameKind: 'page',
          pageNumber: page.pageNumber,
          contractProjectionDigest: buildSourcePromptProjectionDigest(
            template,
            'page',
            page.pageNumber,
          ),
          sourceRequirements: requirements,
        };
      }),
    ],
    actionSemanticCoverageAuthority:
      actionSemanticCoverageAuthority(actionSemanticCoverage),
    presentationRequirements:
      presentationRequirementBinding(actionSemanticCoverage),
    presentationRequirementDispositions: {
      version: PRESENTATION_REQUIREMENT_DISPOSITION_VERSION,
      entries: [],
    },
    review: { status: 'pending', reviewedBy: null, reviewedAt: null },
  };
}

/** Frozen projection used only to reconstruct immutable reconciliation-v2 evidence. */
export function projectLegacySourcePromptReconciliationV2(
  reconciliation: SourcePromptReconciliation,
): LegacySourcePromptReconciliationV2 {
  const {
    presentationRequirementDispositions: _presentationRequirementDispositions,
    version: _version,
    ...legacy
  } = structuredClone(reconciliation);
  return {
    ...legacy,
    version: LEGACY_SOURCE_PROMPT_RECONCILIATION_VERSION,
  };
}

function decodePointerToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

export function resolveJsonPointer(root: unknown, pointer: string): { found: boolean; value?: unknown } {
  if (pointer === '') return { found: true, value: root };
  if (!pointer.startsWith('/')) return { found: false };
  let current = root;
  for (const rawToken of pointer.slice(1).split('/')) {
    const token = decodePointerToken(rawToken);
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/.test(token)) return { found: false };
      const index = Number(token);
      if (index >= current.length) return { found: false };
      current = current[index];
      continue;
    }
    if (!current || typeof current !== 'object' || !(token in current)) return { found: false };
    current = (current as Record<string, unknown>)[token];
  }
  return { found: true, value: current };
}

export function reviewerPresentationRebindPointerIsPermittedForPage(args: {
  template: BookVisualContractTemplate;
  pageNumber: number;
  pointer: string;
}): boolean {
  const pageIndex = args.template.pageContracts.findIndex(
    (candidate) => candidate.pageNumber === args.pageNumber,
  );
  if (pageIndex < 0) return false;
  const pagePrefix = `/pageContracts/${pageIndex}/`;
  if (!args.pointer.startsWith(pagePrefix)) return false;
  const suffix = args.pointer.slice(pagePrefix.length);
  if (!/^mustShow\/(?:0|[1-9]\d*)$/.test(suffix) &&
      !/^propState\/(?:0|[1-9]\d*)\/state$/.test(suffix)) {
    return false;
  }
  const resolved = resolveJsonPointer(args.template, args.pointer);
  return resolved.found && typeof resolved.value === 'string';
}

const DIRECTION_ALLOWED_ASPECTS = new Set<ReconciliationAspect>([
  'action',
  'interaction',
  'expression',
  'camera',
  'composition',
  'staging',
]);
const ALL_RECONCILIATION_ASPECTS = new Set<ReconciliationAspect>([
  'narrative_meaning',
  ...DIRECTION_ALLOWED_ASPECTS,
]);

function evidencePathBelongsToFrame(
  pointer: string,
  frame: SourcePromptReconciliationFrame,
  template: BookVisualContractTemplate,
): boolean {
  const globalAuthorityPrefixes = [
    '/worldType',
    '/locations',
    '/zones',
    '/cast',
    '/humanCast',
    '/recurringProps',
    '/forbiddenGlobalElements',
  ];
  if (globalAuthorityPrefixes.some(
    (prefix) => pointer === prefix || pointer.startsWith(`${prefix}/`),
  )) {
    return true;
  }
  if (frame.frameKind === 'cover') return pointer === '/coverContract' || pointer.startsWith('/coverContract/');
  const pageIndex = template.pageContracts.findIndex(
    (candidate) => candidate.pageNumber === frame.pageNumber,
  );
  return pageIndex >= 0 && (
    pointer === `/pageContracts/${pageIndex}` ||
    pointer.startsWith(`/pageContracts/${pageIndex}/`)
  );
}

function directionEvidencePathIsAllowed(
  pointer: string,
  frame: SourcePromptReconciliationFrame,
  template: BookVisualContractTemplate,
): boolean {
  if (frame.frameKind !== 'page') return false;
  const pageIndex = template.pageContracts.findIndex(
    (candidate) => candidate.pageNumber === frame.pageNumber,
  );
  const pagePrefix = `/pageContracts/${pageIndex}/`;
  if (pageIndex < 0 || !pointer.startsWith(pagePrefix)) return false;
  const suffix = pointer.slice(pagePrefix.length);
  return (
    /^camera(?:\/|$)/.test(suffix) ||
    /^shot(?:\/|$)/.test(suffix) ||
    /^mustShow\/\d+$/.test(suffix) ||
    /^castStates\/\d+\/bodyState$/.test(suffix) ||
    /^actionRequirements\/\d+\/(?:predicate|polarity)$/.test(suffix)
  );
}

function expectedSourcesForFrame(args: {
  content: ParsedStorySourceContent;
  authoredCoverAuthority?: AuthoredCoverAuthority;
  frameKind: ReconciliationFrameKind;
  pageNumber: number;
}): Array<{ sourceKind: ReconciliationSourceKind; sourceText: string }> {
  if (args.frameKind === 'cover') {
    return [
      { sourceKind: 'story_prose', sourceText: args.content.fullStoryText },
      ...(args.authoredCoverAuthority
        ? [{
            sourceKind: 'authored_cover_authority' as const,
            sourceText: JSON.stringify(args.authoredCoverAuthority),
          }]
        : []),
    ];
  }
  const page = args.content.pages.find((candidate) => candidate.pageNumber === args.pageNumber);
  const direction = args.content.pageImageDirections.find(
    (candidate) => candidate.pageNumber === args.pageNumber,
  );
  return [
    ...(page ? [{ sourceKind: 'story_prose' as const, sourceText: page.text }] : []),
    ...(direction
      ? [{
          sourceKind: 'historical_image_direction' as const,
          sourceText: direction.imageDirection,
        }]
      : []),
  ];
}

export interface SourcePromptReconciliationIssueArgs {
  raw: unknown;
  storyKey: string;
  sourceIdentity: StorySourceIdentity;
  sourceAuthoritySnapshotDigest?: string;
  rawStorySource: string;
  template: BookVisualContractTemplate;
  templateDigest: string;
  authoredCoverAuthority?: AuthoredCoverAuthority;
  actionSemanticCoverage: readonly ActionSemanticCoverageRecord[];
  requireComplete?: boolean;
}

function presentationRequirementIdentity(value: {
  pageNumber: number;
  beatId: string;
  sourceEvidenceId: string;
}): string {
  return `${value.pageNumber}:${value.beatId}:${value.sourceEvidenceId}`;
}

function validatedPresentationRequirementDispositions(args: {
  raw: unknown;
  review: unknown;
  requirements: readonly ReconciliationPresentationRequirement[];
  frames: readonly SourcePromptReconciliationFrame[];
  template: BookVisualContractTemplate;
  requireComplete: boolean;
  issues: VisualPackageIssue[];
}): Map<string, ReviewerPresentationRequirementDisposition> {
  const accepted = new Map<string, ReviewerPresentationRequirementDisposition>();
  if (!args.raw || typeof args.raw !== 'object' || Array.isArray(args.raw)) {
    args.issues.push(packageIssue(
      'reconciliation_invalid',
      'presentation-requirement dispositions are missing or malformed',
      { field: 'presentationRequirementDispositions' },
    ));
    return accepted;
  }
  const binding = args.raw as Record<string, unknown>;
  if (
    !exactObjectKeys(binding, ['version', 'entries']) ||
    binding.version !== PRESENTATION_REQUIREMENT_DISPOSITION_VERSION ||
    !Array.isArray(binding.entries)
  ) {
    args.issues.push(packageIssue(
      'reconciliation_invalid',
      'presentation-requirement dispositions have an unsupported shape or version',
      { field: 'presentationRequirementDispositions' },
    ));
    return accepted;
  }
  const requirements = new Map(
    args.requirements.map((requirement) => [
      presentationRequirementIdentity(requirement),
      requirement,
    ]),
  );
  for (const [index, rawEntry] of binding.entries.entries()) {
    const field = `presentationRequirementDispositions.entries[${index}]`;
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
      args.issues.push(packageIssue('reconciliation_invalid', `${field} is malformed`, { field }));
      continue;
    }
    const entry = rawEntry as Record<string, unknown>;
    if (!exactObjectKeys(entry, [
      'pageNumber',
      'beatId',
      'sourceEvidenceId',
      'kind',
      'reboundPointer',
      'reboundValue',
      'justification',
      'review',
    ])) {
      args.issues.push(packageIssue('reconciliation_invalid', `${field} has unexpected or missing fields`, {
        field,
      }));
      continue;
    }
    const typed = entry as unknown as ReviewerPresentationRequirementDisposition;
    const identity = presentationRequirementIdentity(typed);
    const requirement = requirements.get(identity);
    if (
      !Number.isSafeInteger(typed.pageNumber) ||
      typed.pageNumber <= 0 ||
      !nonEmpty(typed.beatId) ||
      !nonEmpty(typed.sourceEvidenceId) ||
      !requirement ||
      accepted.has(identity)
    ) {
      args.issues.push(packageIssue(
        'reconciliation_invalid',
        `${field} is orphaned, duplicated, or does not match one exact presentation requirement`,
        { field },
      ));
      continue;
    }
    if (
      !reviewStateIsDispositionCompatible(typed.review) ||
      canonicalJsonDigest(typed.review) !== canonicalJsonDigest(args.review)
    ) {
      args.issues.push(packageIssue(
        'reconciliation_invalid',
        `${field} review must exactly match the pending or Guy-approved reconciliation review`,
        { field: `${field}.review` },
      ));
      continue;
    }
    if (typed.kind === 'rebound') {
      const resolved = typeof typed.reboundPointer === 'string'
        ? resolveJsonPointer(args.template, typed.reboundPointer)
        : { found: false as const };
      if (
        !nonEmpty(typed.reboundPointer) ||
        !nonEmpty(typed.reboundValue) ||
        typed.justification !== null ||
        typed.reboundPointer === requirement.contractPointer ||
        !reviewerPresentationRebindPointerIsPermittedForPage({
          template: args.template,
          pageNumber: typed.pageNumber,
          pointer: typed.reboundPointer,
        }) ||
        !resolved.found ||
        typeof resolved.value !== 'string' ||
        canonicalJsonDigest(resolved.value) !== canonicalJsonDigest(typed.reboundValue)
      ) {
        args.issues.push(packageIssue(
          'reconciliation_invalid',
          `${field} rebound must cite different exact same-page mustShow or propState.state evidence`,
          { field },
        ));
        continue;
      }
      const frame = args.frames.find(
        (candidate) =>
          candidate.frameKind === 'page' &&
          candidate.pageNumber === typed.pageNumber,
      );
      const storyRequirement = frame?.sourceRequirements.find(
        (candidate) => candidate.sourceKind === 'story_prose',
      );
      const reboundIsCited = storyRequirement?.visualBeats.some(
        (beat) =>
          beat.disposition === 'preserved' &&
          beat.contractEvidence.some(
            (citation) =>
              citation.path === typed.reboundPointer &&
              canonicalJsonDigest(citation.value) === canonicalJsonDigest(typed.reboundValue),
          ),
      ) === true;
      if (!reboundIsCited) {
        if (args.requireComplete) {
          args.issues.push(packageIssue(
            'reconciliation_incomplete',
            `${field} rebound is not cited by a preserved story-prose beat`,
            { field },
          ));
        }
        continue;
      }
    } else if (typed.kind === 'superseded') {
      if (
        typed.reboundPointer !== null ||
        typed.reboundValue !== null ||
        !nonEmpty(typed.justification)
      ) {
        args.issues.push(packageIssue(
          'reconciliation_invalid',
          `${field} supersession must contain only a non-empty justification`,
          { field },
        ));
        continue;
      }
    } else {
      args.issues.push(packageIssue(
        'reconciliation_invalid',
        `${field} has an unsupported disposition kind`,
        { field: `${field}.kind` },
      ));
      continue;
    }
    accepted.set(identity, typed);
  }
  return accepted;
}

function sourcePromptReconciliationIssuesForVersion(
  args: SourcePromptReconciliationIssueArgs,
  options: {
    version:
      | typeof SOURCE_PROMPT_RECONCILIATION_VERSION
      | typeof LEGACY_SOURCE_PROMPT_RECONCILIATION_VERSION;
    presentationDispositions: boolean;
  },
): VisualPackageIssue[] {
  const issues: VisualPackageIssue[] = [];
  if (!args.raw || typeof args.raw !== 'object' || Array.isArray(args.raw)) {
    return [packageIssue('reconciliation_invalid', 'reconciliation artifact is not an object')];
  }
  const reconciliation = args.raw as Partial<SourcePromptReconciliation> & Record<string, unknown>;
  if (
    reconciliation.version !== options.version ||
    reconciliation.projectionVersion !== SOURCE_PROMPT_PROJECTION_VERSION
  ) {
    issues.push(packageIssue(
      'reconciliation_invalid',
      'reconciliation version or provider-projection version is unsupported',
      {
        expected: {
          version: options.version,
          projectionVersion: SOURCE_PROMPT_PROJECTION_VERSION,
        },
        actual: {
          version: reconciliation.version,
          projectionVersion: reconciliation.projectionVersion,
        },
      },
    ));
  }

  if (reconciliation.storyKey !== args.storyKey) {
    issues.push(packageIssue('reconciliation_identity_mismatch', 'reconciliation storyKey changed', {
      expected: args.storyKey,
      actual: reconciliation.storyKey,
    }));
  }
  if (
    !reconciliation.sourceIdentity ||
    typeof reconciliation.sourceIdentity !== 'object' ||
    Array.isArray(reconciliation.sourceIdentity)
  ) {
    issues.push(packageIssue(
      'reconciliation_invalid',
      'reconciliation source identity is missing or malformed',
      { actual: reconciliation.sourceIdentity },
    ));
  } else if (
    canonicalJsonDigest(reconciliation.sourceIdentity) !== canonicalJsonDigest(args.sourceIdentity)
  ) {
    issues.push(packageIssue('reconciliation_source_mismatch', 'reconciliation source identity is stale', {
      expected: args.sourceIdentity,
      actual: reconciliation.sourceIdentity,
    }));
  }
  if (
    args.sourceAuthoritySnapshotDigest !== undefined &&
    reconciliation.sourceAuthoritySnapshotDigest !==
      args.sourceAuthoritySnapshotDigest
  ) {
    issues.push(
      packageIssue(
        'reconciliation_source_mismatch',
        'reconciliation exact source-authority snapshot binding is stale',
        {
          expected: args.sourceAuthoritySnapshotDigest,
          actual:
            reconciliation.sourceAuthoritySnapshotDigest,
        },
      ),
    );
  }
  if (
    reconciliation.templateDigest !== args.templateDigest ||
    reconciliation.templateSchemaVersion !== args.template.schemaVersion
  ) {
    issues.push(packageIssue('reconciliation_template_mismatch', 'reconciliation template identity is stale', {
      expected: {
        templateDigest: args.templateDigest,
        templateSchemaVersion: args.template.schemaVersion,
      },
      actual: {
        templateDigest: reconciliation.templateDigest,
        templateSchemaVersion: reconciliation.templateSchemaVersion,
      },
    }));
  }

  let content: ParsedStorySourceContent;
  try {
    content = parseStorySourceContent(args.rawStorySource);
  } catch (error) {
    return [
      ...issues,
      packageIssue(
        'reconciliation_source_mismatch',
        `story source cannot be parsed for reconciliation: ${error instanceof Error ? error.message : String(error)}`,
      ),
    ];
  }
  const expectedFrames = [
    { frameKind: 'cover' as const, pageNumber: 0 },
    ...content.pages.map((page) => ({ frameKind: 'page' as const, pageNumber: page.pageNumber })),
  ];
  const frames = Array.isArray(reconciliation.frames) ? reconciliation.frames : [];
  const coverageAuthority =
    reconciliation.actionSemanticCoverageAuthority;
  let authoritativeCoverage:
    | readonly ActionSemanticCoverageRecord[]
    | null = null;
  if (
    !coverageAuthority ||
    typeof coverageAuthority !== 'object' ||
    Array.isArray(coverageAuthority) ||
    coverageAuthority.version !==
      ACTION_SEMANTIC_COVERAGE_RECONCILIATION_AUTHORITY_VERSION ||
    coverageAuthority.actionSemanticCoverageVersion !==
      ACTION_SEMANTIC_COVERAGE_VERSION ||
    !Array.isArray(coverageAuthority.records) ||
    coverageAuthority.actionSemanticCoverageDigest !==
      canonicalJsonDigest(coverageAuthority.records) ||
    canonicalJsonDigest(coverageAuthority.records) !==
      canonicalJsonDigest(args.actionSemanticCoverage)
  ) {
    issues.push(
      packageIssue(
        'reconciliation_invalid',
        'Action Semantic Coverage reconciliation authority is missing, malformed, stale, or candidate-mismatched',
        { field: 'actionSemanticCoverageAuthority' },
      ),
    );
  } else {
    authoritativeCoverage = coverageAuthority.records;
  }

  const presentationBinding =
    reconciliation.presentationRequirements;
  const expectedPresentationBinding = authoritativeCoverage
    ? presentationRequirementBinding(authoritativeCoverage)
    : null;
  const validatedDispositions = options.presentationDispositions
    ? validatedPresentationRequirementDispositions({
        raw: reconciliation.presentationRequirementDispositions,
        review: reconciliation.review,
        requirements: expectedPresentationBinding?.requirements ?? [],
        frames,
        template: args.template,
        requireComplete: args.requireComplete !== false,
        issues,
      })
    : new Map<string, ReviewerPresentationRequirementDisposition>();
  if (
    !options.presentationDispositions &&
    reconciliation.presentationRequirementDispositions !== undefined
  ) {
    issues.push(packageIssue(
      'reconciliation_invalid',
      'legacy reconciliation must not contain presentation-requirement dispositions',
      { field: 'presentationRequirementDispositions' },
    ));
  }
  if (
    !presentationBinding ||
    typeof presentationBinding !== 'object' ||
    Array.isArray(presentationBinding) ||
    expectedPresentationBinding === null ||
    canonicalJsonDigest(presentationBinding) !==
      canonicalJsonDigest(expectedPresentationBinding)
  ) {
    issues.push(
      packageIssue(
        'reconciliation_invalid',
        'presentation-requirement reconciliation binding is missing or differs from candidate coverage authority',
        { field: 'presentationRequirements' },
      ),
    );
  } else {
    const identities = new Set<string>();
    for (const [index, requirement] of
      presentationBinding.requirements.entries()) {
        const field = `presentationRequirements.requirements[${index}]`;
        const identity = `${requirement.pageNumber}:${requirement.beatId}`;
        const resolved = resolveCoverageJsonPointer(
          args.template,
          requirement.contractPointer,
        );
        if (
          !Number.isSafeInteger(requirement.pageNumber) ||
          requirement.pageNumber <= 0 ||
          !nonEmpty(requirement.beatId) ||
          identities.has(identity) ||
          !nonEmpty(requirement.sourceEvidenceId) ||
          !PRESENTATION_REQUIREMENT_CLASS_VALUES.includes(
            requirement.presentationClass,
          ) ||
          !presentationRequirementPointerIsPermittedForPage({
            template: args.template,
            pageNumber: requirement.pageNumber,
            pointer: requirement.contractPointer,
          }) ||
          !resolved.found ||
          typeof resolved.value !== 'string' ||
          resolved.value !== requirement.contractValue
        ) {
          issues.push(
            packageIssue(
              'reconciliation_invalid',
              `${field} is not an exact unique same-page presentation requirement`,
              { field },
            ),
          );
          continue;
        }
        identities.add(identity);
        const frame = frames.find(
          (candidate) =>
            candidate?.frameKind === 'page' &&
            candidate?.pageNumber === requirement.pageNumber,
        );
        const storyRequirement = frame?.sourceRequirements?.find(
          (candidate) => candidate.sourceKind === 'story_prose',
        );
        const preserved = storyRequirement?.visualBeats?.some(
          (beat) =>
            beat.disposition === 'preserved' &&
            beat.contractEvidence?.some(
              (citation) =>
                citation.path === requirement.contractPointer &&
                canonicalJsonDigest(citation.value) ===
                  canonicalJsonDigest(requirement.contractValue),
            ),
        );
        const reviewedDisposition = validatedDispositions.get(
          presentationRequirementIdentity(requirement),
        );
        if (preserved && reviewedDisposition !== undefined) {
          issues.push(packageIssue(
            'reconciliation_invalid',
            `${field} cannot retain original preserved evidence and a reviewer disposition simultaneously`,
            { field },
          ));
          continue;
        }
        if (
          args.requireComplete !== false &&
          !preserved &&
          reviewedDisposition === undefined
        ) {
          issues.push(
            packageIssue(
              'reconciliation_incomplete',
              `${field} lacks original preserved evidence, a reviewed exact rebind, or a reviewed explicit supersession`,
              { field },
            ),
          );
        }
    }
  }
  if (frames.length !== expectedFrames.length) {
    issues.push(packageIssue('reconciliation_incomplete', 'reconciliation does not cover every source frame', {
      expected: expectedFrames,
      actual: frames.map((frame) => ({
        frameKind: frame?.frameKind,
        pageNumber: frame?.pageNumber,
      })),
    }));
  }

  for (const expectedFrame of expectedFrames) {
    const matching = frames.filter(
      (frame) =>
        frame?.frameKind === expectedFrame.frameKind &&
        frame?.pageNumber === expectedFrame.pageNumber,
    );
    if (matching.length !== 1) {
      issues.push(packageIssue(
        'reconciliation_incomplete',
        `frame ${expectedFrame.frameKind}:${expectedFrame.pageNumber} must appear exactly once`,
      ));
      continue;
    }
    const frame = matching[0]!;
    const projectionDigest = buildSourcePromptProjectionDigest(
      args.template,
      expectedFrame.frameKind,
      expectedFrame.pageNumber,
    );
    if (frame.contractProjectionDigest !== projectionDigest) {
      issues.push(packageIssue(
        'reconciliation_template_mismatch',
        `contract projection changed for ${expectedFrame.frameKind}:${expectedFrame.pageNumber}`,
        {
          field: `frames[${expectedFrame.frameKind}:${expectedFrame.pageNumber}].contractProjectionDigest`,
          expected: projectionDigest,
          actual: frame.contractProjectionDigest,
        },
      ));
    }
    const expectedSources = expectedSourcesForFrame({
      content,
      authoredCoverAuthority: args.authoredCoverAuthority,
      ...expectedFrame,
    });
    const requirements = Array.isArray(frame.sourceRequirements) ? frame.sourceRequirements : [];
    if (
      canonicalJsonDigest(
        requirements.map((candidate) => ({
          sourceKind: candidate?.sourceKind,
          sourceText: candidate?.sourceText,
        })),
      ) !== canonicalJsonDigest(expectedSources)
    ) {
      issues.push(packageIssue(
        'reconciliation_source_mismatch',
        `source evidence changed for ${expectedFrame.frameKind}:${expectedFrame.pageNumber}`,
        { expected: expectedSources, actual: requirements },
      ));
    }

    for (const [sourceIndex, requirement] of requirements.entries()) {
      const field = `frames[${expectedFrame.frameKind}:${expectedFrame.pageNumber}].sourceRequirements[${sourceIndex}]`;
      const beats = Array.isArray(requirement?.visualBeats) ? requirement.visualBeats : [];
      if (args.requireComplete !== false && beats.length === 0) {
        issues.push(packageIssue(
          'reconciliation_incomplete',
          `${field} has no reviewed visual beats`,
          { field: `${field}.visualBeats` },
        ));
      }
      const beatIds = new Set<string>();
      for (const [beatIndex, beat] of beats.entries()) {
        const beatField = `${field}.visualBeats[${beatIndex}]`;
        if (
          !beat ||
          !nonEmpty(beat.id) ||
          beatIds.has(beat.id) ||
          !nonEmpty(beat.description) ||
          !Array.isArray(beat.aspects) ||
          beat.aspects.length === 0
        ) {
          issues.push(packageIssue('reconciliation_invalid', `${beatField} is incomplete or has a duplicate id`, {
            field: beatField,
          }));
          continue;
        }
        beatIds.add(beat.id);
        if (beat.aspects.some((aspect) => !ALL_RECONCILIATION_ASPECTS.has(aspect))) {
          issues.push(packageIssue(
            'reconciliation_invalid',
            `${beatField} contains an unsupported reconciliation aspect`,
            { field: `${beatField}.aspects`, actual: beat.aspects },
          ));
        }
        if (beat.disposition === 'unresolved') {
          issues.push(packageIssue('reconciliation_incomplete', `${beatField} is unresolved`, {
            field: `${beatField}.disposition`,
          }));
          continue;
        }
        if (requirement.sourceKind === 'historical_image_direction') {
          const invalidAspect = beat.aspects.find((aspect) => !DIRECTION_ALLOWED_ASPECTS.has(aspect));
          if (invalidAspect) {
            issues.push(packageIssue(
              'reconciliation_invalid',
              `${beatField} lets advisory imageDirection control forbidden aspect "${invalidAspect}"`,
              { field: `${beatField}.aspects` },
            ));
          }
        }
        if (beat.disposition === 'preserved') {
          const evidence = Array.isArray(beat.contractEvidence) ? beat.contractEvidence : [];
          if (evidence.length === 0) {
            issues.push(packageIssue(
              'reconciliation_incomplete',
              `${beatField} is preserved but cites no exact contract field`,
              { field: `${beatField}.contractEvidence` },
            ));
          }
          for (const [evidenceIndex, citation] of evidence.entries()) {
            const citationField = `${beatField}.contractEvidence[${evidenceIndex}]`;
            if (!citation || !nonEmpty(citation.path)) {
              issues.push(packageIssue('reconciliation_invalid', `${citationField} has no JSON pointer`, {
                field: citationField,
              }));
              continue;
            }
            const resolved = resolveJsonPointer(args.template, citation.path);
            if (!resolved.found || canonicalJsonDigest(resolved.value) !== canonicalJsonDigest(citation.value)) {
              issues.push(packageIssue(
                'reconciliation_template_mismatch',
                `${citationField} does not resolve to its declared contract value`,
                { field: citation.path, expected: citation.value, actual: resolved.value },
              ));
            }
            if (!evidencePathBelongsToFrame(citation.path, frame, args.template)) {
              issues.push(packageIssue(
                'reconciliation_invalid',
                `${citationField} cites authority from a different frame`,
                { field: citation.path },
              ));
            }
            if (
              requirement.sourceKind === 'historical_image_direction' &&
              !directionEvidencePathIsAllowed(citation.path, frame, args.template)
            ) {
              issues.push(packageIssue(
                'reconciliation_invalid',
                `${citationField} lets advisory imageDirection cite non-presentation authority`,
                { field: citation.path },
              ));
            }
          }
          if (beat.justification !== null || beat.supersessionReview !== null) {
            issues.push(packageIssue(
              'reconciliation_invalid',
              `${beatField} preserved beat must not carry supersession metadata`,
              { field: beatField },
            ));
          }
        } else if (beat.disposition === 'intentionally_superseded') {
          if (
            requirement.sourceKind === 'authored_cover_authority' ||
            !nonEmpty(beat.justification) ||
            !reviewStateIsApproved(beat.supersessionReview) ||
            (Array.isArray(beat.contractEvidence) && beat.contractEvidence.length > 0)
          ) {
            issues.push(packageIssue(
              'reconciliation_incomplete',
              `${beatField} supersession lacks valid justification/review or tries to supersede authored cover authority`,
              { field: beatField },
            ));
          }
        } else {
          issues.push(packageIssue('reconciliation_invalid', `${beatField} has an unsupported disposition`, {
            field: `${beatField}.disposition`,
          }));
        }
      }
    }
  }
  if (args.requireComplete !== false && !reviewStateIsApproved(reconciliation.review)) {
    issues.push(packageIssue(
      'reconciliation_incomplete',
      'reconciliation has not received complete human review',
      { field: 'review' },
    ));
  }
  return issues;
}

export function sourcePromptReconciliationIssues(
  args: SourcePromptReconciliationIssueArgs,
): VisualPackageIssue[] {
  return sourcePromptReconciliationIssuesForVersion(args, {
    version: SOURCE_PROMPT_RECONCILIATION_VERSION,
    presentationDispositions: true,
  });
}

/** Frozen read-only validator for reconciliation v2 artifacts referenced by legacy QA Wizard manifests. */
export function legacySourcePromptReconciliationV2Issues(
  args: SourcePromptReconciliationIssueArgs,
): VisualPackageIssue[] {
  return sourcePromptReconciliationIssuesForVersion(args, {
    version: LEGACY_SOURCE_PROMPT_RECONCILIATION_VERSION,
    presentationDispositions: false,
  });
}

export function loadSourcePromptReconciliation(args: {
  repoRoot: string;
  artifactPath: string;
  storyKey: string;
  sourceIdentity: StorySourceIdentity;
  sourceAuthoritySnapshotDigest?: string;
  storyPath: string;
  template: BookVisualContractTemplate;
  templateDigest: string;
  authoredCoverAuthority?: AuthoredCoverAuthority;
  actionSemanticCoverage: readonly ActionSemanticCoverageRecord[];
  requireComplete?: boolean;
}): {
  reconciliation: SourcePromptReconciliation | null;
  identity: VisualPackageReconciliationIdentity | null;
  issues: VisualPackageIssue[];
} {
  let absolute: string;
  try {
    absolute = resolveRepoPath(args.repoRoot, args.artifactPath);
  } catch (error) {
    return {
      reconciliation: null,
      identity: null,
      issues: [packageIssue('reconciliation_missing', error instanceof Error ? error.message : String(error))],
    };
  }
  if (!fs.existsSync(absolute)) {
    return {
      reconciliation: null,
      identity: null,
      issues: [packageIssue('reconciliation_missing', `reconciliation artifact is missing: ${args.artifactPath}`)],
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(absolute, 'utf8')) as unknown;
  } catch (error) {
    return {
      reconciliation: null,
      identity: null,
      issues: [packageIssue(
        'reconciliation_invalid',
        `reconciliation JSON is invalid: ${error instanceof Error ? error.message : String(error)}`,
      )],
    };
  }
  const rawStorySource = fs.readFileSync(resolveRepoPath(args.repoRoot, args.storyPath), 'utf8');
  const issues = sourcePromptReconciliationIssues({
    raw,
    storyKey: args.storyKey,
    sourceIdentity: args.sourceIdentity,
    sourceAuthoritySnapshotDigest:
      args.sourceAuthoritySnapshotDigest,
    rawStorySource,
    template: args.template,
    templateDigest: args.templateDigest,
    authoredCoverAuthority: args.authoredCoverAuthority,
    actionSemanticCoverage: args.actionSemanticCoverage,
    requireComplete: args.requireComplete,
  });
  const typed = raw as SourcePromptReconciliation;
  return {
    reconciliation: typed,
    identity: {
      artifactPath: args.artifactPath,
      digestAlgorithm: 'canonical-json-sha256',
      digest: canonicalJsonDigest(raw),
      version: typed.version,
      projectionVersion: typed.projectionVersion,
    },
    issues,
  };
}
