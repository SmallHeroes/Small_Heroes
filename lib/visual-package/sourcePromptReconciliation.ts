import fs from 'fs';

import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';
import {
  parseStorySourceContent,
  type ParsedStorySourceContent,
} from '@/lib/visual-contract-compiler/storySourceContent';
import type { AuthoredCoverAuthority } from '@/lib/visual-contract-compiler/coverSourceAuthority';

import { canonicalJsonDigest, isoTimestampIsValid, nonEmpty, resolveRepoPath } from './integrity';
import {
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

/**
 * Offline authoring/promotion evidence. This artifact never becomes prompt text: it proves that the frozen
 * contract's provider projection preserves (or explicitly supersedes) every human-reviewed source beat.
 */
export interface SourcePromptReconciliation {
  version: typeof SOURCE_PROMPT_RECONCILIATION_VERSION;
  projectionVersion: typeof SOURCE_PROMPT_PROJECTION_VERSION;
  storyKey: string;
  sourceIdentity: StorySourceIdentity;
  templateDigest: string;
  templateSchemaVersion: string;
  frames: SourcePromptReconciliationFrame[];
  review: ReconciliationReviewState;
}

export interface SourcePromptReconciliationInput {
  storyKey: string;
  sourceIdentity: StorySourceIdentity;
  pages: Array<{ pageNumber: number; text: string }>;
  pageImageDirections?: Array<{ pageNumber: number; imageDirection: string }>;
  authoredCoverAuthority?: AuthoredCoverAuthority;
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

/**
 * Produce an intentionally incomplete review draft. A model/compiler cannot approve its own semantic coverage:
 * a reviewer must enumerate the visual beats, cite exact contract fields, and approve the finished artifact.
 */
export function buildSourcePromptReconciliationDraft(
  input: SourcePromptReconciliationInput,
  template: BookVisualContractTemplate,
): SourcePromptReconciliation {
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
    review: { status: 'pending', reviewedBy: null, reviewedAt: null },
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

export function sourcePromptReconciliationIssues(args: {
  raw: unknown;
  storyKey: string;
  sourceIdentity: StorySourceIdentity;
  rawStorySource: string;
  template: BookVisualContractTemplate;
  templateDigest: string;
  authoredCoverAuthority?: AuthoredCoverAuthority;
  requireComplete?: boolean;
}): VisualPackageIssue[] {
  const issues: VisualPackageIssue[] = [];
  if (!args.raw || typeof args.raw !== 'object' || Array.isArray(args.raw)) {
    return [packageIssue('reconciliation_invalid', 'reconciliation artifact is not an object')];
  }
  const reconciliation = args.raw as Partial<SourcePromptReconciliation>;
  if (
    reconciliation.version !== SOURCE_PROMPT_RECONCILIATION_VERSION ||
    reconciliation.projectionVersion !== SOURCE_PROMPT_PROJECTION_VERSION
  ) {
    issues.push(packageIssue(
      'reconciliation_invalid',
      'reconciliation version or provider-projection version is unsupported',
      {
        expected: {
          version: SOURCE_PROMPT_RECONCILIATION_VERSION,
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

export function loadSourcePromptReconciliation(args: {
  repoRoot: string;
  artifactPath: string;
  storyKey: string;
  sourceIdentity: StorySourceIdentity;
  storyPath: string;
  template: BookVisualContractTemplate;
  templateDigest: string;
  authoredCoverAuthority?: AuthoredCoverAuthority;
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
    rawStorySource,
    template: args.template,
    templateDigest: args.templateDigest,
    authoredCoverAuthority: args.authoredCoverAuthority,
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
