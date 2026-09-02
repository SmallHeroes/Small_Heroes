import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  allNominalMvpStorySlots,
  storyBankSourceDirForSlotStatus,
  type MvpCategory,
  type StoryDirection,
} from '@/backend/config/mvp-story-matrix';
import {
  isV3ApprovedBankEnabled,
} from '@/backend/providers/story-bank-index';
import {
  DIRECTION_PAGE_MAP,
  displayPagesForBeats,
} from '@/backend/config/wizard';
import { canonicalHash } from '@/lib/canonical-json';
import { getCompanionById } from '@/lib/companions';
import {
  resolveGenderAlternationChips,
  resolveSlashedGenderForms,
  resolveStoryBankPlaceholders,
  runStoryPersonalizationGate,
  type WizardPersonalizationContext,
} from '@/lib/story-bank-personalization';
import {
  applyTtsAmbiguityNiqqudToText,
  checkTtsNiqqudCoverage,
} from '@/lib/story-gen-v2/tts-ambiguity-niqqud';
import { STYLE_IDS } from '@/lib/styles';
import { parseStorySourceContent } from '@/lib/visual-contract-compiler/storySourceContent';
import {
  VISUAL_CONTRACT_AUTHORING_MAX_PAGES_CURRENT_POLICY,
  VISUAL_CONTRACT_AUTHORING_POLICY_VERSION,
} from '@/lib/visual-contract-compiler/authoringPolicy';
import {
  isWizardQaCatalogEnabled,
  loadWizardQaCatalog,
  type WizardQaStoryboardCandidate,
} from '@/lib/wizard-render-readiness';

import {
  ACCEPTED_STORY_SOURCE_ROOT,
  acceptedProductLineageDisposition,
  loadAcceptedStorySourceAuthoringAuthority,
  type AcceptedStorySourceAuthoringAuthority,
  type AcceptedProductLineageDisposition,
} from './acceptedStorySourceAuthoringAuthority';
import { auditMvpRenderQualification } from './audit';
import {
  buildStorySourceIdentity,
  repoRelativePath,
} from './integrity';
import type { StorySourceIdentity } from './types';
import { evaluateVisualPackageV4Qualification } from './visualPackageV4';
import { evaluateWizardVisualPackageSelection } from './wizardVisualPackageSelection';

export const WIZARD_ALL_STORY_RENDER_READINESS_VERSION =
  'wizard-all-story-render-readiness/v1' as const;

const TEST_CHILD_NAME = 'רוני';
const PRODUCT_PROMISE_PATH = 'PROJECT.md';
const WIZARD_HTML_PATH = 'public/HTML/wizard.html';

export type StorySourceLineageRole =
  | 'v3_product_fallback'
  | 'qa_low_only'
  | 'accepted_product_source'
  | 'approved_visual_package_source';

export interface StorySourceReadinessEvidence {
  role: StorySourceLineageRole;
  available: boolean;
  path: string | null;
  identity: StorySourceIdentity | null;
  rawSha256: string | null;
  title: string | null;
  declaredGender: string | null;
  pageCount: number | null;
  imageDirectionCount: number | null;
  importSidecarPath: string | null;
  importSidecarDigest: string | null;
  importSidecarValid: boolean | null;
  acceptedAuthoringAuthorityDigest: string | null;
  issues: string[];
}

export interface AcceptedProductSourceRevisionEvidence {
  source: StorySourceReadinessEvidence;
  authoringAuthority: AcceptedStorySourceAuthoringAuthority;
  authoringAuthorityDigest: string;
}

export interface StoryGenderTextReadiness {
  gender: 'boy' | 'girl';
  personalizationReady: boolean;
  narrationInputReady: boolean;
  criticalTtsGateReady: boolean;
  pageCount: number;
  childNameOccurrences: number;
  personalizationFailures: string[];
  criticalTtsGaps: Array<{ pageNumber: number; lemma: string }>;
  softTtsGaps: Array<{ pageNumber: number; lemma: string }>;
}

export interface StorySourceTextReadiness {
  sourcePath: string;
  boy: StoryGenderTextReadiness;
  girl: StoryGenderTextReadiness;
  supportedGenderProjectionReady: boolean;
  supportedNarrationInputReady: boolean;
  supportedCriticalTtsGateReady: boolean;
  supportedNarrationAutomatedPreflightReady: boolean;
  softTtsReviewItemCount: number;
}

export type WizardAllStoryBlockerCode =
  | 'product_source_text_not_ready'
  | 'product_source_corpus_unconfirmed'
  | 'accepted_story_source_revision_missing'
  | 'accepted_story_source_revision_ambiguous'
  | 'accepted_story_source_lineage_invalid'
  | 'visual_contract_authoring_page_policy_blocked'
  | 'package_bound_visual_contract_template_unavailable'
  | 'package_bound_approved_blueprint_unavailable'
  | 'package_bound_board_prop_inventory_unavailable'
  | 'approved_visual_package_missing_or_invalid'
  | 'strict_render_qualification_failed';

export interface WizardAllStoryBlocker {
  code: WizardAllStoryBlockerCode;
  stage:
    | 'source_selection'
    | 'source_acceptance'
    | 'visual_contract_authoring'
    | 'blueprint'
    | 'boards_and_props'
    | 'visual_package'
    | 'render_qualification';
  message: string;
}

export interface WizardNextCanonicalAction {
  code:
    | 'restore_or_repair_product_source_text'
    | 'guy_select_product_source_corpus'
    | 'repair_accepted_source_authority'
    | 'prepare_and_accept_story_source_revision'
    | 'select_accepted_story_source_revision'
    | 'guy_decide_fantasy_authoring_policy'
    | 'author_visual_contract_for_exact_accepted_source'
    | 'author_and_approve_blueprint'
    | 'resolve_and_review_boards_and_props'
    | 'assemble_review_and_approve_visual_package'
    | 'repair_strict_render_qualification';
  stage: WizardAllStoryBlocker['stage'];
  summary: string;
  requiresGuyDecision: boolean;
  providerSpendAuthorized: false;
}

export interface WizardAllStoryReadinessRecord {
  category: MvpCategory;
  direction: StoryDirection;
  storyKey: string;
  companionId: string;
  configuredStatus: string;
  renderBeatCount: number;
  displayPageCount: number;
  priceILS: number;
  sources: {
    v3ProductFallback: StorySourceReadinessEvidence;
    qaLowOnly: StorySourceReadinessEvidence;
    acceptedProductSource: StorySourceReadinessEvidence;
    acceptedProductRevisions: AcceptedProductSourceRevisionEvidence[];
    approvedVisualPackageSource: StorySourceReadinessEvidence;
    currentProductSourceRole: Exclude<
      StorySourceLineageRole,
      'qa_low_only' | 'approved_visual_package_source'
    > | null;
    currentProductSourcePath: string | null;
    qaAndCurrentProductBytesDiffer: boolean | null;
    corpusDecisionRequired: boolean;
  };
  acceptedProductLineage: AcceptedProductLineageDisposition;
  productTextReadiness: StorySourceTextReadiness | null;
  qaTextReadiness: StorySourceTextReadiness | null;
  qaAuthority: {
    catalogValid: boolean;
    readyForLowStoryGeneration: boolean;
    candidatePath: string | null;
    candidateDigest: string | null;
    candidateVersion: string | null;
    companionManifestDigest: string | null;
    companionMinimumResemblance: number | null;
    resemblanceThreshold: number;
  };
  authoringPolicy: {
    version: typeof VISUAL_CONTRACT_AUTHORING_POLICY_VERSION;
    pageCount: number;
    maximumPages: number;
    admitted: boolean;
  };
  legacyAdjacentArtifacts: {
    visualContractTemplatePath: string | null;
    visualContractPath: string | null;
    productionEligible: false;
  };
  productionStages: {
    sourceCorpusConfirmed: boolean;
    acceptedSourceRevision: boolean;
    visualContractAuthoringAdmitted: boolean;
    publishedPackageBoundVisualContractTemplate: boolean;
    publishedPackageBoundApprovedBlueprint: boolean;
    publishedPackageBoundBoardsAndProps: boolean;
    approvedVisualPackage: boolean;
    renderQualified: boolean;
  };
  packageAuthority: {
    visualPackageRequired: boolean;
    path: string | null;
    revisionDigest: string | null;
    state: 'approved' | null;
    requiredBoardCount: number | null;
    requiredPropReferenceCount: number | null;
    qualificationReasons: string[];
  };
  environmentProductSellable: boolean;
  blockers: WizardAllStoryBlocker[];
  earliestBlocker: WizardAllStoryBlockerCode | null;
  nextCanonicalAction: WizardNextCanonicalAction | null;
}

export interface WizardAllStoryRenderReadinessReport {
  version: typeof WIZARD_ALL_STORY_RENDER_READINESS_VERSION;
  evaluatedAt: string;
  styleId: typeof STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK;
  environment: {
    v3ApprovedBankEnabled: boolean;
    wizardQaCatalogEnabled: boolean;
  };
  summary: {
    nominalSlotCount: number;
    environmentProductSellableCount: number;
    qaLowReadyCount: number;
    acceptedProductLineageCount: number;
    visualContractAuthoringAdmittedCount: number;
    renderQualifiedCount: number;
    sourceCorpusConflictCount: number;
    supportedGenderProjectionReadyCount: number;
    supportedNarrationInputReadyCount: number;
    supportedCriticalTtsGateReadyCount: number;
    supportedNarrationAutomatedPreflightReadyCount: number;
    softTtsReviewItemCount: number;
    storiesWithSoftTtsReviewItemsCount: number;
  };
  decisions: {
    productSourceCorpus: {
      required: boolean;
      currentFallback: 'v3_product_fallback';
      alternate: 'qa_low_only';
      conflictingSlotCount: number;
      decisionRequiredSlotCount: number;
    };
    fantasyAuthoringPolicy: {
      required: boolean;
      blockedStoryKeys: string[];
      currentMaximumPages: number;
    };
    genderContract: {
      wizardOptions: string[];
      technicallyCertified: readonly ['boy', 'girl'];
      otherUsesMasculineChipProjection: boolean;
      otherCertified: false;
    };
    ageContract: {
      productPromise: { minimum: number | null; maximum: number | null };
      wizardOptions: number[];
      aligned: boolean;
      storyTextUsesAgeInput: false;
    };
  };
  qaCatalogDigest: string | null;
  records: WizardAllStoryReadinessRecord[];
  effects: {
    filesWritten: 0;
    directoriesCreated: 0;
    filesDeleted: 0;
    databaseReads: 0;
    databaseWrites: 0;
    storageReads: 0;
    networkCalls: 0;
    providerCalls: 0;
    imagesGenerated: 0;
    audioGenerated: 0;
    ordersCreatedOrModified: 0;
  };
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function filesystemPathsEqual(left: string, right: string): boolean {
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function frontmatterScalar(raw: string, key: string): string | null {
  const frontmatter = raw.match(
    /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
  )?.[1];
  if (frontmatter === undefined) return null;
  const match = frontmatter.match(
    new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'),
  );
  const value = match?.[1]?.trim();
  if (!value) return null;
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function readJsonRecord(filePath: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function stableSourceInspectionIssue(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message === 'source_path_not_canonical' ||
    message === 'source_file_identity_invalid'
  ) {
    return message;
  }
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  if (
    ['ENOENT', 'EACCES', 'EPERM', 'EISDIR', 'ENOTDIR'].includes(code)
  ) {
    return 'source_missing_or_unreadable';
  }
  return 'source_identity_or_parse_invalid';
}

export function inspectWizardStorySourceEvidence(args: {
  repoRoot: string;
  role: StorySourceLineageRole;
  sourcePath: string | null;
  importSidecarPath?: string | null;
  acceptedAuthoringAuthorityDigest?: string | null;
  expectedSnapshot?: {
    identity: StorySourceIdentity;
    rawDigest: string;
    content: string;
  };
  expected?: {
    storyKey: string;
    companionId: string;
    direction: StoryDirection;
    category: MvpCategory;
  };
}): StorySourceReadinessEvidence {
  const issues: string[] = [];
  if (!args.sourcePath) {
    return {
      role: args.role,
      available: false,
      path: null,
      identity: null,
      rawSha256: null,
      title: null,
      declaredGender: null,
      pageCount: null,
      imageDirectionCount: null,
      importSidecarPath: args.importSidecarPath ?? null,
      importSidecarDigest: null,
      importSidecarValid:
        args.importSidecarPath == null ? null : false,
      acceptedAuthoringAuthorityDigest:
        args.acceptedAuthoringAuthorityDigest ?? null,
      issues: ['source_path_unavailable'],
    };
  }

  let raw: string;
  let identity: StorySourceIdentity;
  let parsed: ReturnType<typeof parseStorySourceContent>;
  try {
    const absolute = path.resolve(args.repoRoot, args.sourcePath);
    if (repoRelativePath(args.repoRoot, absolute) !== args.sourcePath) {
      throw new Error('source_path_not_canonical');
    }
    const stat = fs.lstatSync(absolute);
    if (
      stat.isSymbolicLink() ||
      !stat.isFile() ||
      stat.nlink !== 1 ||
      !filesystemPathsEqual(path.resolve(fs.realpathSync(absolute)), absolute)
    ) {
      throw new Error('source_file_identity_invalid');
    }
    raw = fs.readFileSync(absolute, 'utf8');
    identity = buildStorySourceIdentity({
      repoRoot: args.repoRoot,
      storyPath: args.sourcePath,
    });
    parsed = parseStorySourceContent(raw);
  } catch (error) {
    return {
      role: args.role,
      available: false,
      path: args.sourcePath,
      identity: null,
      rawSha256: null,
      title: null,
      declaredGender: null,
      pageCount: null,
      imageDirectionCount: null,
      importSidecarPath: args.importSidecarPath ?? null,
      importSidecarDigest: null,
      importSidecarValid:
        args.importSidecarPath == null ? null : false,
      acceptedAuthoringAuthorityDigest:
        args.acceptedAuthoringAuthorityDigest ?? null,
      issues: [stableSourceInspectionIssue(error)],
    };
  }

  const frontmatterDocument = parsed.frontmatterMarkdown;
  const declaredPages = Number(
    frontmatterScalar(frontmatterDocument, 'pages'),
  );
  const pageNumbers = parsed.pages.map((page) => page.pageNumber);
  const expectedPageNumbers = Array.from(
    { length: parsed.pages.length },
    (_, index) => index + 1,
  );
  if (
    !Number.isSafeInteger(declaredPages) ||
    declaredPages !== parsed.pages.length ||
    identity.pageCount !== parsed.pages.length
  ) {
    issues.push('source_page_count_mismatch');
  }
  if (!frontmatterScalar(frontmatterDocument, 'title')) {
    issues.push('source_title_missing');
  }
  if (JSON.stringify(pageNumbers) !== JSON.stringify(expectedPageNumbers)) {
    issues.push('source_page_numbers_not_contiguous');
  }
  if (
    parsed.pageImageDirections.length !== parsed.pages.length ||
    (raw.match(/^imageDirection:\s*\S.*$/gm) ?? []).length !==
      parsed.pages.length ||
    JSON.stringify(
      parsed.pageImageDirections.map((entry) => entry.pageNumber),
    ) !== JSON.stringify(expectedPageNumbers)
  ) {
    issues.push('source_image_direction_coverage_mismatch');
  }
  if (
    args.expectedSnapshot &&
    (raw !== args.expectedSnapshot.content ||
      sha256(raw) !== args.expectedSnapshot.rawDigest ||
      canonicalHash(identity) !== canonicalHash(args.expectedSnapshot.identity))
  ) {
    issues.push('package_source_snapshot_mismatch');
  }
  if (args.expected) {
    const expectedStoryKey =
      `${args.expected.companionId}_${args.expected.direction}`;
    if (expectedStoryKey !== args.expected.storyKey) {
      issues.push('expected_story_identity_invalid');
    }
    if (
      frontmatterScalar(frontmatterDocument, 'companionId') !==
        args.expected.companionId ||
      frontmatterScalar(frontmatterDocument, 'direction') !==
        args.expected.direction ||
      frontmatterScalar(frontmatterDocument, 'category') !==
        args.expected.category
    ) {
      issues.push('source_frontmatter_identity_mismatch');
    }
    if (
      parsed.pages.length !==
      DIRECTION_PAGE_MAP[args.expected.direction].pages
    ) {
      issues.push('source_direction_page_count_mismatch');
    }
    const normalizedSourcePath = args.sourcePath.split('\\').join('/');
    if (
      (args.role === 'v3_product_fallback' || args.role === 'qa_low_only') &&
      !normalizedSourcePath.endsWith(`/${args.expected.storyKey}.md`)
    ) {
      issues.push('source_story_key_path_mismatch');
    }
    if (
      (args.role === 'accepted_product_source' ||
        args.role === 'approved_visual_package_source') &&
      !normalizedSourcePath.includes(
        `/${args.expected.storyKey}/revisions/`,
      )
    ) {
      issues.push('accepted_source_story_key_path_mismatch');
    }
  }

  let importSidecarDigest: string | null = null;
  let importSidecarValid: boolean | null = null;
  if (args.importSidecarPath != null) {
    importSidecarValid = false;
    if (args.importSidecarPath) {
      const absoluteSidecar = path.resolve(
        args.repoRoot,
        args.importSidecarPath,
      );
      let sidecar: Record<string, unknown> | null = null;
      try {
        if (
          repoRelativePath(args.repoRoot, absoluteSidecar) !==
          args.importSidecarPath
        ) {
          throw new Error('sidecar_path_not_canonical');
        }
        const stat = fs.lstatSync(absoluteSidecar);
        if (
          stat.isSymbolicLink() ||
          !stat.isFile() ||
          stat.nlink !== 1 ||
          !filesystemPathsEqual(
            path.resolve(fs.realpathSync(absoluteSidecar)),
            absoluteSidecar,
          )
        ) {
          throw new Error('sidecar_file_identity_invalid');
        }
        sidecar = readJsonRecord(absoluteSidecar);
      } catch {
        sidecar = null;
      }
      if (sidecar) {
        importSidecarDigest = canonicalHash(sidecar);
        importSidecarValid = Boolean(
          args.expected &&
            sidecar.companionId === args.expected.companionId &&
            sidecar.direction === args.expected.direction &&
            sidecar.pageCount === parsed.pages.length &&
            typeof sidecar.approvedBy === 'string' &&
            sidecar.approvedBy.trim().length > 0 &&
            typeof sidecar.approvedAt === 'string' &&
            !Number.isNaN(Date.parse(sidecar.approvedAt)),
        );
      }
    }
    if (!importSidecarValid) issues.push('import_sidecar_invalid');
  }

  return {
    role: args.role,
    available: issues.length === 0,
    path: args.sourcePath,
    identity,
    rawSha256: sha256(raw),
    title: frontmatterScalar(frontmatterDocument, 'title'),
    declaredGender: frontmatterScalar(frontmatterDocument, 'gender'),
    pageCount: parsed.pages.length,
    imageDirectionCount: parsed.pageImageDirections.length,
    importSidecarPath: args.importSidecarPath ?? null,
    importSidecarDigest,
    importSidecarValid,
    acceptedAuthoringAuthorityDigest:
      args.acceptedAuthoringAuthorityDigest ?? null,
    issues,
  };
}

function unavailableSourceEvidence(
  role: StorySourceLineageRole,
  issue: string,
): StorySourceReadinessEvidence {
  return {
    role,
    available: false,
    path: null,
    identity: null,
    rawSha256: null,
    title: null,
    declaredGender: null,
    pageCount: null,
    imageDirectionCount: null,
    importSidecarPath: null,
    importSidecarDigest: null,
    importSidecarValid: null,
    acceptedAuthoringAuthorityDigest: null,
    issues: [issue],
  };
}

function acceptedProductSourceRevisionInventory(args: {
  repoRoot: string;
  storyKey: string;
  category: MvpCategory;
  companionId: string;
  direction: StoryDirection;
}): {
  revisions: AcceptedProductSourceRevisionEvidence[];
  issues: string[];
} {
  const revisionsRoot = path.resolve(
    args.repoRoot,
    ACCEPTED_STORY_SOURCE_ROOT,
    args.storyKey,
    'revisions',
  );
  if (!fs.existsSync(revisionsRoot)) {
    return { revisions: [], issues: [] };
  }

  const revisions: AcceptedProductSourceRevisionEvidence[] = [];
  const issues: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(revisionsRoot, { withFileTypes: true });
  } catch {
    return { revisions: [], issues: ['accepted_revision_inventory_unreadable'] };
  }

  for (const entry of [...entries].sort((left, right) =>
    left.name.localeCompare(right.name))) {
    if (!entry.isDirectory() || !/^[a-f0-9]{64}$/.test(entry.name)) continue;
    const sourcePath =
      `${ACCEPTED_STORY_SOURCE_ROOT}/${args.storyKey}/revisions/${entry.name}/integrated.md`;
    if (!fs.existsSync(path.resolve(args.repoRoot, sourcePath))) continue;
    try {
      const authoringAuthority =
        loadAcceptedStorySourceAuthoringAuthority({
          repoRoot: args.repoRoot,
          storyKey: args.storyKey,
          storyPath: sourcePath,
        });
      if (!authoringAuthority) continue;
      const authoringAuthorityDigest = canonicalHash(authoringAuthority);
      const source = inspectWizardStorySourceEvidence({
        repoRoot: args.repoRoot,
        role: 'accepted_product_source',
        sourcePath,
        acceptedAuthoringAuthorityDigest: authoringAuthorityDigest,
        expected: {
          storyKey: args.storyKey,
          category: args.category,
          companionId: args.companionId,
          direction: args.direction,
        },
      });
      if (!source.available) {
        issues.push(...source.issues.map((issue) => `${entry.name}:${issue}`));
        continue;
      }
      revisions.push({
        source,
        authoringAuthority,
        authoringAuthorityDigest,
      });
    } catch (error) {
      issues.push(
        `${entry.name}:${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return {
    revisions,
    issues: [...new Set(issues)].sort(),
  };
}

function analyzeGenderTextReadiness(args: {
  raw: string;
  companionName: string;
  gender: 'boy' | 'girl';
}): StoryGenderTextReadiness {
  const parsed = parseStorySourceContent(args.raw);
  const directions = new Map(
    parsed.pageImageDirections.map((entry) => [
      entry.pageNumber,
      entry.imageDirection,
    ]),
  );
  const context: WizardPersonalizationContext = {
    childName: TEST_CHILD_NAME,
    childGender: args.gender,
    companionName: args.companionName,
  };
  const pages = parsed.pages.map((page) => ({
    pageNumber: page.pageNumber,
    text: resolveStoryBankPlaceholders(page.text, context).trim(),
    imagePrompt: resolveStoryBankPlaceholders(
      directions.get(page.pageNumber) ?? '',
      context,
    ).trim(),
  }));
  const personalizationFailures = runStoryPersonalizationGate({
    wizard: context,
    pages,
  });
  const childNameOccurrences = pages.reduce(
    (total, page) => total + page.text.split(TEST_CHILD_NAME).length - 1,
    0,
  );
  if (childNameOccurrences < 1) {
    personalizationFailures.push('child name is absent after projection');
  }

  const criticalTtsGaps: Array<{ pageNumber: number; lemma: string }> = [];
  const softTtsGaps: Array<{ pageNumber: number; lemma: string }> = [];
  for (const page of pages) {
    const transformed = applyTtsAmbiguityNiqqudToText(page.text).text;
    for (const gap of checkTtsNiqqudCoverage(transformed)) {
      (gap.critical ? criticalTtsGaps : softTtsGaps).push({
        pageNumber: page.pageNumber,
        lemma: gap.lemma,
      });
    }
  }

  return {
    gender: args.gender,
    personalizationReady: personalizationFailures.length === 0,
    narrationInputReady:
      pages.length > 0 && pages.every((page) => page.text.length > 0),
    criticalTtsGateReady: criticalTtsGaps.length === 0,
    pageCount: pages.length,
    childNameOccurrences,
    personalizationFailures: [...new Set(personalizationFailures)].sort(),
    criticalTtsGaps,
    softTtsGaps,
  };
}

function analyzeSourceTextReadiness(args: {
  repoRoot: string;
  source: StorySourceReadinessEvidence;
  companionName: string;
}): StorySourceTextReadiness | null {
  if (
    !args.source.available ||
    !args.source.path ||
    !args.companionName.trim()
  ) {
    return null;
  }
  const raw = fs.readFileSync(
    path.resolve(args.repoRoot, args.source.path),
    'utf8',
  );
  const boy = analyzeGenderTextReadiness({
    raw,
    companionName: args.companionName,
    gender: 'boy',
  });
  const girl = analyzeGenderTextReadiness({
    raw,
    companionName: args.companionName,
    gender: 'girl',
  });
  return {
    sourcePath: args.source.path,
    boy,
    girl,
    supportedGenderProjectionReady:
      boy.personalizationReady && girl.personalizationReady,
    supportedNarrationInputReady:
      boy.narrationInputReady && girl.narrationInputReady,
    supportedCriticalTtsGateReady:
      boy.criticalTtsGateReady && girl.criticalTtsGateReady,
    supportedNarrationAutomatedPreflightReady:
      boy.personalizationReady &&
      girl.personalizationReady &&
      boy.narrationInputReady &&
      girl.narrationInputReady &&
      boy.criticalTtsGateReady &&
      girl.criticalTtsGateReady,
    softTtsReviewItemCount:
      boy.softTtsGaps.length + girl.softTtsGaps.length,
  };
}

function optionalRepoFile(
  repoRoot: string,
  relativePath: string,
): string | null {
  return fs.existsSync(path.resolve(repoRoot, relativePath))
    ? relativePath
    : null;
}

function wizardAgeAndGenderContract(repoRoot: string): {
  genderOptions: string[];
  wizardAgeOptions: number[];
  productPromise: { minimum: number | null; maximum: number | null };
} {
  const wizardHtml = fs.readFileSync(
    path.resolve(repoRoot, WIZARD_HTML_PATH),
    'utf8',
  );
  const ageBlock = wizardHtml.match(
    /<select[^>]+id="child-age"[^>]*>([\s\S]*?)<\/select>/i,
  )?.[1] ?? '';
  const wizardAgeOptions = [...ageBlock.matchAll(/<option[^>]*>(\d+)<\/option>/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isSafeInteger(value));
  const genderBlock = wizardHtml.match(
    /<select[^>]+id="child-gender"[^>]*>([\s\S]*?)<\/select>/i,
  )?.[1] ?? '';
  const genderOptions = [...genderBlock.matchAll(/<option[^>]+value="([^"]+)"/gi)]
    .map((match) => match[1])
    .filter((value) => value.length > 0);

  const productPromiseText = fs.readFileSync(
    path.resolve(repoRoot, PRODUCT_PROMISE_PATH),
    'utf8',
  );
  const productAgeMatch = productPromiseText.match(
    /ages\s+(\d+)\s*[–-]\s*(\d+)/i,
  );
  return {
    genderOptions,
    wizardAgeOptions,
    productPromise: {
      minimum: productAgeMatch ? Number(productAgeMatch[1]) : null,
      maximum: productAgeMatch ? Number(productAgeMatch[2]) : null,
    },
  };
}

function addBlocker(
  blockers: WizardAllStoryBlocker[],
  blocker: WizardAllStoryBlocker,
): void {
  if (!blockers.some((current) => current.code === blocker.code)) {
    blockers.push(blocker);
  }
}

export function configuredProductSourcePaths(args: {
  configuredStatus: 'approved' | 'approved_v3';
  storyKey: string;
}): { sourcePath: string; importSidecarPath: string | null } {
  const sourceDir = storyBankSourceDirForSlotStatus(args.configuredStatus);
  return {
    sourcePath: `story-bank/${sourceDir}/${args.storyKey}.md`,
    importSidecarPath:
      args.configuredStatus === 'approved_v3'
        ? `story-bank/${sourceDir}/${args.storyKey}.import.json`
        : null,
  };
}

export function classifyAcceptedSourceAuthorityBlocker(args: {
  lineage: AcceptedProductLineageDisposition;
  revisionCount: number;
  inventoryIssues: readonly string[];
  acceptedSourceAvailable: boolean;
}): WizardAllStoryBlocker | null {
  if (args.lineage.kind === 'invalid') {
    return {
      code: 'accepted_story_source_lineage_invalid',
      stage: 'source_acceptance',
      message:
        args.lineage.reasons.join(', ') ||
        'accepted product Story Source lineage is invalid',
    };
  }
  if (args.lineage.kind === 'present' && args.inventoryIssues.length > 0) {
    return {
      code: 'accepted_story_source_lineage_invalid',
      stage: 'source_acceptance',
      message: args.inventoryIssues.join(', '),
    };
  }
  if (
    args.lineage.kind === 'present' &&
    args.revisionCount > 1 &&
    !args.acceptedSourceAvailable
  ) {
    return {
      code: 'accepted_story_source_revision_ambiguous',
      stage: 'source_selection',
      message:
        'multiple strict accepted source revisions exist and no render-qualified package selects one exact revision',
    };
  }
  if (
    args.lineage.kind === 'absent' ||
    (args.lineage.kind === 'present' && args.revisionCount === 0)
  ) {
    return {
      code: 'accepted_story_source_revision_missing',
      stage: 'source_acceptance',
      message:
        args.lineage.kind === 'present'
          ? 'product acceptance exists, but no strict v3 accepted source/visual-direction authoring revision is available; migrate it through technical review and Guy acceptance'
          : 'no exact product-accepted source/visual-direction revision exists',
    };
  }
  return null;
}

export function isQaLowStoryGenerationReady(args: {
  qaSourceAvailable: boolean;
  catalogRecordReady: boolean;
  candidateProductionEligible: boolean | null;
}): boolean {
  return (
    args.qaSourceAvailable &&
    args.catalogRecordReady &&
    args.candidateProductionEligible === false
  );
}

function nextCanonicalActionFor(
  blocker: WizardAllStoryBlocker | undefined,
): WizardNextCanonicalAction | null {
  if (!blocker) return null;
  const common = {
    stage: blocker.stage,
    providerSpendAuthorized: false as const,
  };
  switch (blocker.code) {
    case 'product_source_text_not_ready':
      return {
        ...common,
        code: 'restore_or_repair_product_source_text',
        summary:
          'Restore or repair the exact product Story Source, then rerun boy/girl personalization and automated TTS preflight.',
        requiresGuyDecision: false,
      };
    case 'product_source_corpus_unconfirmed':
      return {
        ...common,
        code: 'guy_select_product_source_corpus',
        summary:
          'Guy chooses the V3 or QA story corpus as product authority for this slot.',
        requiresGuyDecision: true,
      };
    case 'accepted_story_source_lineage_invalid':
      return {
        ...common,
        code: 'repair_accepted_source_authority',
        summary:
          'Repair the strict accepted-source revision inventory before authoring downstream authority.',
        requiresGuyDecision: false,
      };
    case 'accepted_story_source_revision_missing':
      return {
        ...common,
        code: 'prepare_and_accept_story_source_revision',
        summary:
          'Prepare the exact Story Source plus visual-direction review bundle; Claude reviews and Guy accepts its immutable digest.',
        requiresGuyDecision: true,
      };
    case 'accepted_story_source_revision_ambiguous':
      return {
        ...common,
        code: 'select_accepted_story_source_revision',
        summary:
          'Select one exact strict accepted revision through the reviewed Visual Package authority; do not infer currentness from filesystem order.',
        requiresGuyDecision: true,
      };
    case 'visual_contract_authoring_page_policy_blocked':
      return {
        ...common,
        code: 'guy_decide_fantasy_authoring_policy',
        summary:
          'Guy decides whether the 16-beat story is partitioned or the current 12-page authoring policy is changed under a separate gate.',
        requiresGuyDecision: true,
      };
    case 'package_bound_visual_contract_template_unavailable':
      return {
        ...common,
        code: 'author_visual_contract_for_exact_accepted_source',
        summary:
          'Run the separately budgeted Visual Contract authoring lifecycle for the exact accepted source revision.',
        requiresGuyDecision: false,
      };
    case 'package_bound_approved_blueprint_unavailable':
      return {
        ...common,
        code: 'author_and_approve_blueprint',
        summary:
          'Author and review the Blueprint bound to the exact accepted source and Visual Contract.',
        requiresGuyDecision: true,
      };
    case 'package_bound_board_prop_inventory_unavailable':
      return {
        ...common,
        code: 'resolve_and_review_boards_and_props',
        summary:
          'Resolve and review the Blueprint-required Set Board and prop-reference inventory.',
        requiresGuyDecision: true,
      };
    case 'approved_visual_package_missing_or_invalid':
      return {
        ...common,
        code: 'assemble_review_and_approve_visual_package',
        summary:
          'Assemble, technically review, and obtain Guy approval for the immutable Visual Package before publishing its locator.',
        requiresGuyDecision: true,
      };
    case 'strict_render_qualification_failed':
      return {
        ...common,
        code: 'repair_strict_render_qualification',
        summary:
          'Repair the exact strict qualification reasons without weakening the production gate.',
        requiresGuyDecision: false,
      };
  }
}

export function auditWizardAllStoryRenderReadiness(args: {
  repoRoot: string;
  now?: () => Date;
}): WizardAllStoryRenderReadinessReport {
  const styleId = STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK;
  const qualificationAudit = auditMvpRenderQualification({
    repoRoot: args.repoRoot,
    styleId,
    now: args.now,
  });
  const qualificationByStory = new Map(
    qualificationAudit.records.map((record) => [record.storyKey, record]),
  );
  const qaCatalog = loadWizardQaCatalog({ repoRoot: args.repoRoot });
  const qaByStory = new Map(
    (qaCatalog?.records ?? []).map((record) => [record.storyKey, record]),
  );
  const records: WizardAllStoryReadinessRecord[] = [];

  for (const slot of allNominalMvpStorySlots()) {
      const {
        category,
        direction,
        companionId,
        storyKey,
        configuredStatus,
      } = slot;
      const companionName = getCompanionById(companionId)?.name ?? '';
      const configuredSourcePaths = configuredProductSourcePaths({
        configuredStatus,
        storyKey,
      });
      const v3Source = inspectWizardStorySourceEvidence({
        repoRoot: args.repoRoot,
        role: 'v3_product_fallback',
        sourcePath: configuredSourcePaths.sourcePath,
        importSidecarPath: configuredSourcePaths.importSidecarPath,
        expected: { storyKey, category, companionId, direction },
      });

      const qaRecord = qaByStory.get(storyKey) ?? null;
      const qaSource = inspectWizardStorySourceEvidence({
        repoRoot: args.repoRoot,
        role: 'qa_low_only',
        sourcePath: qaRecord?.storySourcePath ?? null,
        expected: { storyKey, category, companionId, direction },
      });
      const acceptedProductLineage = acceptedProductLineageDisposition({
        repoRoot: args.repoRoot,
        storyKey,
      });
      const acceptedInventory = acceptedProductSourceRevisionInventory({
        repoRoot: args.repoRoot,
        storyKey,
        category,
        companionId,
        direction,
      });
      const publishedPackageQualification =
        evaluateVisualPackageV4Qualification({
          repoRoot: args.repoRoot,
          storyKey,
          styleId,
        });
      const publishedPackage = publishedPackageQualification.packageValue;
      const publishedPackageSource = inspectWizardStorySourceEvidence({
        repoRoot: args.repoRoot,
        role: 'approved_visual_package_source',
        sourcePath: publishedPackage?.sourceSnapshot.identity.path ?? null,
        expectedSnapshot: publishedPackage?.sourceSnapshot,
        expected: { storyKey, category, companionId, direction },
      });
      const selection = evaluateWizardVisualPackageSelection({
        repoRoot: args.repoRoot,
        storyKey,
        styleId,
      });
      const packageSelectedAcceptedRevision = selection.renderQualified
        ? acceptedInventory.revisions.find(
            (revision) => revision.source.path === selection.sourcePath,
          )
        : undefined;
      const acceptedProductSource =
        acceptedProductLineage.kind === 'present' &&
        acceptedInventory.issues.length === 0 &&
        (packageSelectedAcceptedRevision ||
          acceptedInventory.revisions.length === 1)
          ? (
              packageSelectedAcceptedRevision ??
              acceptedInventory.revisions[0]!
            ).source
          : unavailableSourceEvidence(
              'accepted_product_source',
              acceptedProductLineage.kind === 'invalid'
                ? `accepted_product_lineage_invalid:${acceptedProductLineage.reasons.join(',')}`
                : acceptedInventory.issues.length > 0
                  ? `accepted_product_revision_inventory_invalid:${acceptedInventory.issues.join(',')}`
                  : acceptedInventory.revisions.length > 1
                    ? 'accepted_product_revision_ambiguous'
                    : 'strict_accepted_product_revision_unavailable',
            );
      const currentProductSource =
        acceptedProductLineage.kind === 'absent'
          ? v3Source
          : acceptedProductSource;
      const currentProductSourceRole = currentProductSource.available
        ? currentProductSource.role === 'accepted_product_source'
          ? 'accepted_product_source'
          : 'v3_product_fallback'
        : null;
      const qaAndCurrentProductBytesDiffer =
        qaSource.rawSha256 && currentProductSource.rawSha256
          ? qaSource.rawSha256 !== currentProductSource.rawSha256
          : null;
      const corpusDecisionRequired = Boolean(
        acceptedProductLineage.kind === 'absent' &&
          qaAndCurrentProductBytesDiffer,
      );
      const productTextReadiness = analyzeSourceTextReadiness({
        repoRoot: args.repoRoot,
        source: currentProductSource,
        companionName,
      });
      const qaTextReadiness = analyzeSourceTextReadiness({
        repoRoot: args.repoRoot,
        source: qaSource,
        companionName,
      });

      let qaCandidate: WizardQaStoryboardCandidate | null = null;
      if (qaRecord) {
        try {
          qaCandidate = JSON.parse(
            fs.readFileSync(
              path.resolve(args.repoRoot, qaRecord.candidatePath),
              'utf8',
            ),
          ) as WizardQaStoryboardCandidate;
        } catch {
          qaCandidate = null;
        }
      }

      const pageCount =
        currentProductSource.pageCount ?? DIRECTION_PAGE_MAP[direction].pages;
      const authoringAdmitted =
        pageCount <= VISUAL_CONTRACT_AUTHORING_MAX_PAGES_CURRENT_POLICY;
      const packageValue = publishedPackage;
      const qualificationRecord = qualificationByStory.get(storyKey);
      const blockers: WizardAllStoryBlocker[] = [];
      const acceptedSourceAuthorityBlocker =
        classifyAcceptedSourceAuthorityBlocker({
          lineage: acceptedProductLineage,
          revisionCount: acceptedInventory.revisions.length,
          inventoryIssues: acceptedInventory.issues,
          acceptedSourceAvailable: acceptedProductSource.available,
        });
      const acceptedAuthorityPreventsSourceSelection =
        acceptedProductLineage.kind !== 'absent' &&
        acceptedSourceAuthorityBlocker !== null &&
        !currentProductSource.available;

      if (acceptedAuthorityPreventsSourceSelection) {
        addBlocker(blockers, acceptedSourceAuthorityBlocker);
      }
      if (
        !acceptedAuthorityPreventsSourceSelection &&
        (!productTextReadiness ||
          !productTextReadiness.supportedNarrationAutomatedPreflightReady)
      ) {
        addBlocker(blockers, {
          code: 'product_source_text_not_ready',
          stage: 'source_selection',
          message:
            'the current product source does not pass both supported gender projections and narration input gates',
        });
      }
      if (corpusDecisionRequired) {
        addBlocker(blockers, {
          code: 'product_source_corpus_unconfirmed',
          stage: 'source_selection',
          message:
            'the V3 product fallback and QA-only source have different bytes; Guy must choose the product authority before package work',
        });
      }
      if (
        acceptedSourceAuthorityBlocker &&
        !acceptedAuthorityPreventsSourceSelection
      ) {
        addBlocker(blockers, acceptedSourceAuthorityBlocker);
      }
      if (!authoringAdmitted) {
        addBlocker(blockers, {
          code: 'visual_contract_authoring_page_policy_blocked',
          stage: 'visual_contract_authoring',
          message:
            `${pageCount} pages exceed the current ${VISUAL_CONTRACT_AUTHORING_MAX_PAGES_CURRENT_POLICY}-page authoring ceiling`,
        });
      }
      if (!packageValue) {
        addBlocker(blockers, {
          code: 'package_bound_visual_contract_template_unavailable',
          stage: 'visual_contract_authoring',
          message:
            'no Visual Contract template is available from a structurally valid published package; this does not claim that no unpublished authoring artifact exists',
        });
        addBlocker(blockers, {
          code: 'package_bound_approved_blueprint_unavailable',
          stage: 'blueprint',
          message:
            'no approved Blueprint is available from a structurally valid published package; this does not claim that no unpublished Blueprint exists',
        });
        addBlocker(blockers, {
          code: 'package_bound_board_prop_inventory_unavailable',
          stage: 'boards_and_props',
          message:
            'no reviewed Set Board and prop-reference inventory is available from a structurally valid published package',
        });
      }
      if (!selection.renderQualified) {
        addBlocker(blockers, {
          code: 'approved_visual_package_missing_or_invalid',
          stage: 'visual_package',
          message:
            selection.reasons.join('; ') ||
            'no current Visual Package satisfies the exact product Story Source authority',
        });
      }
      if (qualificationRecord?.renderQualified !== true) {
        addBlocker(blockers, {
          code: 'strict_render_qualification_failed',
          stage: 'render_qualification',
          message:
            qualificationRecord?.reasons
              .map((reason) => reason.code)
              .join(', ') || 'strict render qualification failed',
        });
      }

      records.push({
        category,
        direction,
        storyKey,
        companionId,
        configuredStatus,
        renderBeatCount: pageCount,
        displayPageCount: displayPagesForBeats(pageCount),
        priceILS: DIRECTION_PAGE_MAP[direction].priceILS,
        sources: {
          v3ProductFallback: v3Source,
          qaLowOnly: qaSource,
          acceptedProductSource,
          acceptedProductRevisions: acceptedInventory.revisions,
          approvedVisualPackageSource: publishedPackageSource,
          currentProductSourceRole,
          currentProductSourcePath: currentProductSource.path,
          qaAndCurrentProductBytesDiffer,
          corpusDecisionRequired,
        },
        acceptedProductLineage,
        productTextReadiness,
        qaTextReadiness,
        qaAuthority: {
          catalogValid: qaCatalog !== null,
          readyForLowStoryGeneration: isQaLowStoryGenerationReady({
            qaSourceAvailable: qaSource.available,
            catalogRecordReady:
              qaRecord?.qaLowStoryGenerationReady === true,
            candidateProductionEligible:
              qaCandidate?.productionEligible ?? null,
          }),
          candidatePath: qaRecord?.candidatePath ?? null,
          candidateDigest: qaRecord?.candidateDigest ?? null,
          candidateVersion: qaCandidate?.version ?? null,
          companionManifestDigest:
            qaCandidate?.companionAuthority.manifestDigest ?? null,
          companionMinimumResemblance:
            qaCandidate?.companionAuthority.minimumResemblance ?? null,
          resemblanceThreshold:
            qaCandidate?.companionAuthority.resemblanceThreshold ?? 0.7,
        },
        authoringPolicy: {
          version: VISUAL_CONTRACT_AUTHORING_POLICY_VERSION,
          pageCount,
          maximumPages:
            VISUAL_CONTRACT_AUTHORING_MAX_PAGES_CURRENT_POLICY,
          admitted: authoringAdmitted,
        },
        legacyAdjacentArtifacts: {
          visualContractTemplatePath: optionalRepoFile(
            args.repoRoot,
            configuredSourcePaths.sourcePath.replace(
              /\.md$/,
              '.visual-contract-template.json',
            ),
          ),
          visualContractPath: optionalRepoFile(
            args.repoRoot,
            configuredSourcePaths.sourcePath.replace(
              /\.md$/,
              '.visual-contract.json',
            ),
          ),
          productionEligible: false,
        },
        productionStages: {
          sourceCorpusConfirmed:
            currentProductSource.available && !corpusDecisionRequired,
          acceptedSourceRevision:
            acceptedProductLineage.kind === 'present' &&
            acceptedInventory.revisions.length > 0 &&
            acceptedInventory.issues.length === 0,
          visualContractAuthoringAdmitted: authoringAdmitted,
          publishedPackageBoundVisualContractTemplate:
            packageValue?.visualContractTemplate !== undefined,
          publishedPackageBoundApprovedBlueprint:
            packageValue?.blueprint !== undefined,
          publishedPackageBoundBoardsAndProps:
            packageValue?.requiredBoards !== undefined &&
            packageValue.requiredPropReferences !== undefined,
          approvedVisualPackage: packageValue !== null,
          renderQualified: qualificationRecord?.renderQualified === true,
        },
        packageAuthority: {
          visualPackageRequired: selection.visualPackageRequired,
          path:
            publishedPackageQualification.packagePath ?? selection.packagePath,
          revisionDigest: packageValue?.revisionDigest ?? null,
          state: packageValue?.state ?? null,
          requiredBoardCount: packageValue?.requiredBoards.length ?? null,
          requiredPropReferenceCount:
            packageValue?.requiredPropReferences.length ?? null,
          qualificationReasons: selection.reasons,
        },
        environmentProductSellable:
          qualificationRecord?.productSellable ?? false,
        blockers,
        earliestBlocker: blockers[0]?.code ?? null,
        nextCanonicalAction: nextCanonicalActionFor(blockers[0]),
      });
  }

  const contract = wizardAgeAndGenderContract(args.repoRoot);
  const blockedStoryKeys = records
    .filter((record) => !record.authoringPolicy.admitted)
    .map((record) => record.storyKey);
  const conflictingSlotCount = records.filter(
    (record) => record.sources.qaAndCurrentProductBytesDiffer,
  ).length;
  const sourceDecisionRequiredSlotCount = records.filter(
    (record) => record.sources.corpusDecisionRequired,
  ).length;
  const effects = {
    filesWritten: 0 as const,
    directoriesCreated: 0 as const,
    filesDeleted: 0 as const,
    databaseReads: 0 as const,
    databaseWrites: 0 as const,
    storageReads: 0 as const,
    networkCalls: 0 as const,
    providerCalls: 0 as const,
    imagesGenerated: 0 as const,
    audioGenerated: 0 as const,
    ordersCreatedOrModified: 0 as const,
  };
  const semantic = {
    version: WIZARD_ALL_STORY_RENDER_READINESS_VERSION,
    styleId,
    environment: {
      v3ApprovedBankEnabled:
        isV3ApprovedBankEnabled(),
      wizardQaCatalogEnabled:
        isWizardQaCatalogEnabled(),
    },
    summary: {
      nominalSlotCount: records.length,
      environmentProductSellableCount: records.filter(
        (record) => record.environmentProductSellable,
      ).length,
      qaLowReadyCount: records.filter(
        (record) => record.qaAuthority.readyForLowStoryGeneration,
      ).length,
      acceptedProductLineageCount: records.filter(
        (record) => record.productionStages.acceptedSourceRevision,
      ).length,
      visualContractAuthoringAdmittedCount: records.filter(
        (record) => record.authoringPolicy.admitted,
      ).length,
      renderQualifiedCount: records.filter(
        (record) => record.productionStages.renderQualified,
      ).length,
      sourceCorpusConflictCount: conflictingSlotCount,
      supportedGenderProjectionReadyCount: records.filter(
        (record) =>
          record.productTextReadiness?.supportedGenderProjectionReady,
      ).length,
      supportedNarrationInputReadyCount: records.filter(
        (record) => record.productTextReadiness?.supportedNarrationInputReady,
      ).length,
      supportedCriticalTtsGateReadyCount: records.filter(
        (record) =>
          record.productTextReadiness?.supportedCriticalTtsGateReady,
      ).length,
      supportedNarrationAutomatedPreflightReadyCount: records.filter(
        (record) =>
          record.productTextReadiness
            ?.supportedNarrationAutomatedPreflightReady,
      ).length,
      softTtsReviewItemCount: records.reduce(
        (total, record) =>
          total + (record.productTextReadiness?.softTtsReviewItemCount ?? 0),
        0,
      ),
      storiesWithSoftTtsReviewItemsCount: records.filter(
        (record) =>
          (record.productTextReadiness?.softTtsReviewItemCount ?? 0) > 0,
      ).length,
    },
    decisions: {
      productSourceCorpus: {
        required: sourceDecisionRequiredSlotCount > 0,
        currentFallback: 'v3_product_fallback' as const,
        alternate: 'qa_low_only' as const,
        conflictingSlotCount,
        decisionRequiredSlotCount: sourceDecisionRequiredSlotCount,
      },
      fantasyAuthoringPolicy: {
        required: blockedStoryKeys.length > 0,
        blockedStoryKeys,
        currentMaximumPages:
          VISUAL_CONTRACT_AUTHORING_MAX_PAGES_CURRENT_POLICY,
      },
      genderContract: {
        wizardOptions: contract.genderOptions,
        technicallyCertified: ['boy', 'girl'] as const,
        otherUsesMasculineChipProjection:
          resolveGenderAlternationChips('{זכר|נקבה}', 'other') === 'זכר' &&
          resolveSlashedGenderForms('ילד/ה', 'other') === 'ילד',
        otherCertified: false as const,
      },
      ageContract: {
        productPromise: contract.productPromise,
        wizardOptions: contract.wizardAgeOptions,
        aligned:
          contract.productPromise.minimum !== null &&
          contract.productPromise.maximum !== null &&
          Math.min(...contract.wizardAgeOptions) ===
            contract.productPromise.minimum &&
          Math.max(...contract.wizardAgeOptions) ===
            contract.productPromise.maximum,
        storyTextUsesAgeInput: false as const,
      },
    },
    qaCatalogDigest: qaCatalog?.digest ?? null,
    records,
    effects,
  };
  return {
    ...semantic,
    evaluatedAt: (args.now ?? (() => new Date()))().toISOString(),
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalHash(semantic),
  };
}
