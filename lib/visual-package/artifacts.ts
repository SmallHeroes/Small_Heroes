import fs from 'fs';
import path from 'path';

import {
  VISUAL_CONTRACT_SCHEMA_VERSION,
  type BookVisualContractTemplate,
} from '@/lib/visual-contract-compiler/contractTemplateTypes';
import { validateBookVisualContractTemplate } from '@/lib/visual-contract-compiler/validateTemplateContract';
import type { BookVisualContract } from '@/lib/visual-contract-compiler/types';
import {
  SET_IDENTITY_BOARD_VERSION,
  SET_IDENTITY_REGISTRY_VERSION,
  type SetIdentityBoardRegistryEntry,
} from '@/lib/set-identity-board/types';
import {
  computeSetDefinitionHash,
  listRequiredSetIdentityIds,
} from '@/lib/set-identity-board/setDefinition';
import {
  validateSetIdentityBoardRegistryEntry,
  type ExpectedRegistryIdentity,
} from '@/lib/set-identity-board/registry';
import { setIdentityBoardRegistryPath } from '@/lib/set-identity-board/registryPath';

import {
  buildStorySourceIdentity,
  canonicalJsonDigest,
  isoTimestampIsValid,
  nonEmpty,
  parseJsonFile,
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import {
  VISUAL_PACKAGE_MANIFEST_VERSION,
  type StorySourceIdentity,
  type VisualPackageBoardArtifactIdentity,
  type VisualPackageCoverageIdentity,
  type VisualPackageIssue,
  type VisualPackageManifest,
  type VisualPackageTemplateIdentity,
} from './types';

const WORLD_MODES = new Set(['grounded', 'grounded_with_visual_metaphor', 'fantastical']);

function issue(
  code: VisualPackageIssue['code'],
  message: string,
  extra: Omit<VisualPackageIssue, 'code' | 'message'> = {},
): VisualPackageIssue {
  return { code, message, ...extra };
}

export function buildCoverageIdentity(template: BookVisualContractTemplate): VisualPackageCoverageIdentity {
  const pageNumbers = template.pageContracts.map((page) => page.pageNumber);
  return {
    coverDigest: canonicalJsonDigest(template.coverContract),
    pageContractsDigest: canonicalJsonDigest(template.pageContracts),
    pageCount: pageNumbers.length,
    pageNumbers,
  };
}

export function coverageIssues(
  template: Partial<BookVisualContractTemplate>,
  source: StorySourceIdentity,
): VisualPackageIssue[] {
  const issues: VisualPackageIssue[] = [];
  if (!template.coverContract || typeof template.coverContract !== 'object') {
    issues.push(issue('cover_contract_missing', 'template has no coverContract', { field: 'template.coverContract' }));
  }

  const pageContracts = Array.isArray(template.pageContracts) ? template.pageContracts : [];
  const pageNumbers = pageContracts.map((page) => page?.pageNumber).filter((value): value is number => typeof value === 'number');
  const seen = new Set<number>();
  const duplicates = new Set<number>();
  for (const pageNumber of pageNumbers) {
    if (seen.has(pageNumber)) duplicates.add(pageNumber);
    seen.add(pageNumber);
  }
  if (duplicates.size > 0) {
    issues.push(issue('page_coverage_duplicate', `duplicate page contracts: ${[...duplicates].join(', ')}`, {
      field: 'template.pageContracts',
      actual: pageNumbers,
    }));
  }

  const expectedSet = new Set(source.pageNumbers);
  const outOfRange = pageNumbers.filter((pageNumber) => !expectedSet.has(pageNumber));
  if (outOfRange.length > 0) {
    issues.push(issue('page_coverage_out_of_range', `page contracts outside the story source: ${outOfRange.join(', ')}`, {
      field: 'template.pageContracts',
      expected: source.pageNumbers,
      actual: pageNumbers,
    }));
  }

  const missing = source.pageNumbers.filter((pageNumber) => !seen.has(pageNumber));
  if (missing.length > 0 || pageContracts.length !== source.pageCount) {
    issues.push(issue('page_coverage_incomplete', `page coverage is incomplete; missing pages: ${missing.join(', ') || '(count mismatch)'}`, {
      field: 'template.pageContracts',
      expected: source.pageNumbers,
      actual: pageNumbers,
    }));
  }
  return issues;
}

export function loadTemplateForPackage(args: {
  repoRoot: string;
  templatePath: string;
  storyKey: string;
  source: StorySourceIdentity;
  expectedDigest?: string;
}): {
  template: BookVisualContractTemplate | null;
  identity: VisualPackageTemplateIdentity | null;
  issues: VisualPackageIssue[];
} {
  const issues: VisualPackageIssue[] = [];
  let absolute: string;
  try {
    absolute = path.isAbsolute(args.templatePath)
      ? path.resolve(args.templatePath)
      : resolveRepoPath(args.repoRoot, args.templatePath);
  } catch (error) {
    return {
      template: null,
      identity: null,
      issues: [issue('template_missing', error instanceof Error ? error.message : String(error))],
    };
  }
  if (!fs.existsSync(absolute)) {
    return {
      template: null,
      identity: null,
      issues: [issue('template_missing', `template artifact is missing: ${repoRelativePath(args.repoRoot, absolute)}`)],
    };
  }

  let raw: unknown;
  try {
    raw = parseJsonFile(absolute);
  } catch (error) {
    return {
      template: null,
      identity: null,
      issues: [issue('template_parse_error', `template JSON is invalid: ${error instanceof Error ? error.message : String(error)}`)],
    };
  }
  const digest = canonicalJsonDigest(raw);
  if (args.expectedDigest && digest !== args.expectedDigest) {
    issues.push(issue('template_digest_mismatch', 'template digest does not match the approved manifest', {
      field: 'template.digest',
      expected: args.expectedDigest,
      actual: digest,
    }));
  }
  const schemaVersion = (raw as { schemaVersion?: unknown })?.schemaVersion;
  if (schemaVersion !== VISUAL_CONTRACT_SCHEMA_VERSION) {
    issues.push(issue('template_schema_unsupported', `unsupported template schema ${JSON.stringify(schemaVersion)}`, {
      field: 'template.schemaVersion',
      expected: VISUAL_CONTRACT_SCHEMA_VERSION,
      actual: schemaVersion,
    }));
  }
  const validation = validateBookVisualContractTemplate(raw);
  if (!validation.ok) {
    issues.push(issue('template_invalid', validation.errors.join('; '), { field: 'template' }));
  }
  // Coverage rejection codes are promotion API contract, not an implementation detail of the shared validator.
  // Evaluate them directly from the parsed candidate even when the full template validator also rejects it.
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    issues.push(...coverageIssues(raw as Partial<BookVisualContractTemplate>, args.source));
  }

  const declaredStoryKey = (raw as { storyKey?: unknown })?.storyKey;
  if (declaredStoryKey !== args.storyKey) {
    issues.push(issue('story_key_mismatch', 'template storyKey does not match the package storyKey', {
      field: 'template.storyKey',
      expected: args.storyKey,
      actual: declaredStoryKey,
    }));
  }
  const template = validation.ok ? validation.template : null;

  return {
    template,
    identity: {
      artifactPath: repoRelativePath(args.repoRoot, absolute),
      digestAlgorithm: 'canonical-json-sha256',
      digest,
      schemaVersion: typeof schemaVersion === 'string' ? schemaVersion : '',
    },
    issues,
  };
}

function boardExpectedIdentity(
  template: BookVisualContractTemplate,
  setIdentityId: string,
  styleId: string,
): ExpectedRegistryIdentity {
  // Set-board projection deliberately reads no human appearance fields; a validated Template carries every set
  // field it needs. Keep the one contract schema and adapt only at this existing pure projection seam.
  const setProjectionContract = template as unknown as BookVisualContract;
  return {
    registryVersion: SET_IDENTITY_REGISTRY_VERSION,
    boardVersion: SET_IDENTITY_BOARD_VERSION,
    storyKey: template.storyKey ?? '',
    setIdentityId,
    styleId,
    setDefinitionHash: computeSetDefinitionHash(setProjectionContract, setIdentityId, styleId),
  };
}

export function resolveRequiredBoardArtifacts(args: {
  repoRoot: string;
  boardRegistryRoot: string;
  template: BookVisualContractTemplate;
  styleId: string;
}): { boards: VisualPackageBoardArtifactIdentity[]; issues: VisualPackageIssue[] } {
  const boards: VisualPackageBoardArtifactIdentity[] = [];
  const issues: VisualPackageIssue[] = [];
  const setProjectionContract = args.template as unknown as BookVisualContract;
  for (const setIdentityId of listRequiredSetIdentityIds(setProjectionContract)) {
    const expected = boardExpectedIdentity(args.template, setIdentityId, args.styleId);
    const artifactPath = setIdentityBoardRegistryPath(expected, args.boardRegistryRoot);
    if (!fs.existsSync(artifactPath)) {
      issues.push(issue('board_unresolved', `required board registry artifact is missing for ${setIdentityId}`, {
        field: `requiredBoards.${setIdentityId}`,
        expected,
      }));
      continue;
    }
    let raw: unknown;
    try {
      raw = parseJsonFile(artifactPath);
    } catch (error) {
      issues.push(issue('board_unresolved', `required board registry artifact is invalid JSON: ${error instanceof Error ? error.message : String(error)}`, {
        field: `requiredBoards.${setIdentityId}`,
      }));
      continue;
    }
    const validation = validateSetIdentityBoardRegistryEntry(raw, expected);
    if (!validation.ok) {
      issues.push(issue('board_unresolved', validation.errors.join('; '), {
        field: `requiredBoards.${setIdentityId}`,
      }));
      continue;
    }
    const entry = raw as SetIdentityBoardRegistryEntry;
    boards.push({
      artifactPath: repoRelativePath(args.repoRoot, artifactPath),
      artifactDigest: canonicalJsonDigest(raw),
      registryVersion: entry.registryVersion,
      boardVersion: entry.boardVersion,
      storyKey: entry.storyKey,
      setIdentityId: entry.setIdentityId,
      styleId: entry.styleId,
      setDefinitionHash: entry.setDefinitionHash,
      storageKey: entry.storageKey,
      assetSha256: entry.assetSha256,
      approvedBy: entry.approvedBy!,
      approvedAt: entry.approvedAt!,
    });
  }
  return { boards, issues };
}

export function compareBoardArtifacts(
  expected: VisualPackageBoardArtifactIdentity[],
  actual: VisualPackageBoardArtifactIdentity[],
): VisualPackageIssue[] {
  const issues: VisualPackageIssue[] = [];
  const actualById = new Map(actual.map((board) => [board.setIdentityId, board]));
  for (const approved of expected) {
    const resolved = actualById.get(approved.setIdentityId);
    if (!resolved) {
      issues.push(issue('board_unresolved', `approved package requires unresolved board ${approved.setIdentityId}`));
      continue;
    }
    if (
      approved.registryVersion !== resolved.registryVersion ||
      approved.boardVersion !== resolved.boardVersion ||
      approved.storyKey !== resolved.storyKey ||
      approved.styleId !== resolved.styleId ||
      approved.setDefinitionHash !== resolved.setDefinitionHash
    ) {
      issues.push(issue('board_identity_mismatch', `board identity changed for ${approved.setIdentityId}`, {
        expected: approved,
        actual: resolved,
      }));
      continue;
    }
    if (
      approved.artifactPath !== resolved.artifactPath ||
      approved.artifactDigest !== resolved.artifactDigest ||
      approved.assetSha256 !== resolved.assetSha256 ||
      approved.storageKey !== resolved.storageKey ||
      approved.approvedBy !== resolved.approvedBy ||
      approved.approvedAt !== resolved.approvedAt
    ) {
      issues.push(issue('board_artifact_mismatch', `approved board artifact changed for ${approved.setIdentityId}`, {
        expected: approved,
        actual: resolved,
      }));
    }
  }
  for (const resolved of actual) {
    if (!expected.some((approved) => approved.setIdentityId === resolved.setIdentityId)) {
      issues.push(issue('board_identity_mismatch', `package omits newly required board ${resolved.setIdentityId}`, {
        actual: resolved,
      }));
    }
  }
  return issues;
}

export function basicManifestIssues(raw: unknown): VisualPackageIssue[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return [issue('manifest_invalid', 'manifest is not an object')];
  }
  const manifest = raw as Partial<VisualPackageManifest>;
  const issues: VisualPackageIssue[] = [];
  if (manifest.manifestVersion !== VISUAL_PACKAGE_MANIFEST_VERSION) {
    issues.push(issue('manifest_invalid', `unsupported manifest version ${JSON.stringify(manifest.manifestVersion)}`));
  }
  if (manifest.state !== 'candidate' && manifest.state !== 'approved') {
    issues.push(issue('manifest_invalid', `state must be candidate|approved (got ${JSON.stringify(manifest.state)})`));
  }
  if (!nonEmpty(manifest.storyKey)) issues.push(issue('manifest_invalid', 'storyKey is missing'));
  if (!nonEmpty(manifest.styleId)) issues.push(issue('manifest_invalid', 'styleId is missing'));
  if (!manifest.source || !nonEmpty(manifest.source.path) || !nonEmpty(manifest.source.digest)) {
    issues.push(issue('manifest_invalid', 'source identity is incomplete'));
  } else if (
    manifest.source.version !== 'story-source/v1' ||
    manifest.source.digestAlgorithm !== 'sha256-normalized-utf8' ||
    !Number.isInteger(manifest.source.pageCount) ||
    !Array.isArray(manifest.source.pageNumbers) ||
    !manifest.source.pageNumbers.every(Number.isInteger)
  ) {
    issues.push(issue('manifest_invalid', 'source identity version/algorithm/pageNumbers are unsupported'));
  }
  if (
    !manifest.template ||
    !nonEmpty(manifest.template.artifactPath) ||
    !nonEmpty(manifest.template.digest) ||
    !nonEmpty(manifest.template.schemaVersion)
  ) {
    issues.push(issue('manifest_invalid', 'template identity is incomplete'));
  } else if (manifest.template.digestAlgorithm !== 'canonical-json-sha256') {
    issues.push(issue('manifest_invalid', 'template digest algorithm is unsupported'));
  }
  if (
    !manifest.coverage ||
    !nonEmpty(manifest.coverage.coverDigest) ||
    !nonEmpty(manifest.coverage.pageContractsDigest) ||
    !Number.isInteger(manifest.coverage.pageCount) ||
    !Array.isArray(manifest.coverage.pageNumbers) ||
    !manifest.coverage.pageNumbers.every(Number.isInteger)
  ) {
    issues.push(issue('manifest_invalid', 'coverage identity is incomplete'));
  }
  if (
    !manifest.candidateEvidence ||
    !nonEmpty(manifest.candidateEvidence.sourceInputDigest) ||
    !nonEmpty(manifest.candidateEvidence.reviewDigest) ||
    !nonEmpty(manifest.candidateEvidence.provenanceDigest)
  ) {
    issues.push(issue('manifest_invalid', 'candidate evidence identity is incomplete'));
  } else if (manifest.candidateEvidence.version !== 'visual-package-candidate/v1') {
    issues.push(issue('manifest_invalid', 'candidate evidence version is unsupported'));
  }
  if (!manifest.review || typeof manifest.review !== 'object') {
    issues.push(issue('manifest_invalid', 'review metadata is missing'));
  }
  if (!Array.isArray(manifest.requiredBoards)) {
    issues.push(issue('manifest_invalid', 'requiredBoards must be an array'));
  } else {
    const boardIds = new Set<string>();
    for (const [index, board] of manifest.requiredBoards.entries()) {
      if (
        !board ||
        !nonEmpty(board.artifactPath) ||
        !nonEmpty(board.artifactDigest) ||
        !nonEmpty(board.registryVersion) ||
        !nonEmpty(board.boardVersion) ||
        !nonEmpty(board.storyKey) ||
        !nonEmpty(board.setIdentityId) ||
        !nonEmpty(board.styleId) ||
        !nonEmpty(board.setDefinitionHash) ||
        !nonEmpty(board.storageKey) ||
        !nonEmpty(board.assetSha256) ||
        !nonEmpty(board.approvedBy) ||
        !isoTimestampIsValid(board.approvedAt)
      ) {
        issues.push(issue('manifest_invalid', `requiredBoards[${index}] has an incomplete artifact identity`));
      }
      if (board && nonEmpty(board.setIdentityId)) {
        if (boardIds.has(board.setIdentityId)) {
          issues.push(issue('manifest_invalid', `requiredBoards contains duplicate ${board.setIdentityId}`));
        }
        boardIds.add(board.setIdentityId);
      }
    }
  }
  if (manifest.state === 'approved') {
    if (
      !manifest.promotion ||
      manifest.promotion.toolVersion !== 'visual-package-promotion/v1' ||
      !isoTimestampIsValid(manifest.promotion.promotedAt) ||
      !nonEmpty(manifest.promotion.templateDestination) ||
      !nonEmpty(manifest.promotion.manifestDestination)
    ) {
      issues.push(issue('manifest_invalid', 'approved package promotion record is incomplete or unsupported'));
    }
  }
  return issues;
}

export function approvalIssues(manifest: VisualPackageManifest): VisualPackageIssue[] {
  const issues: VisualPackageIssue[] = [];
  if (!manifest.approval) {
    issues.push(issue('approval_missing', 'exact Guy approval record is missing'));
  } else {
    if (manifest.approval.approvedBy !== 'Guy') {
      issues.push(issue('approval_not_guy', 'visual-package approval must be by Guy', {
        field: 'approval.approvedBy',
        expected: 'Guy',
        actual: manifest.approval.approvedBy,
      }));
    }
    if (!isoTimestampIsValid(manifest.approval.approvedAt)) {
      issues.push(issue('approval_invalid', 'approval.approvedAt must be a valid ISO timestamp'));
    }
  }
  if (
    !nonEmpty(manifest.review?.authoredBy) ||
    !nonEmpty(manifest.review?.reviewedBy) ||
    !isoTimestampIsValid(manifest.review?.reviewedAt) ||
    !WORLD_MODES.has(manifest.review?.worldMode ?? '')
  ) {
    issues.push(issue('review_metadata_missing', 'review author, reviewer, reviewedAt, and structured worldMode are required'));
  }
  return issues;
}

export function currentSourceIssues(
  manifest: VisualPackageManifest,
  current: StorySourceIdentity,
): VisualPackageIssue[] {
  const issues: VisualPackageIssue[] = [];
  if (manifest.source.path !== current.path || manifest.source.digest !== current.digest) {
    issues.push(issue('story_source_mismatch', 'story source path or digest changed after approval', {
      field: 'source',
      expected: manifest.source,
      actual: current,
    }));
  }
  if (
    manifest.source.pageCount !== current.pageCount ||
    canonicalJsonDigest(manifest.source.pageNumbers) !== canonicalJsonDigest(current.pageNumbers)
  ) {
    issues.push(issue('story_source_mismatch', 'story source page identity changed after approval', {
      field: 'source.pageNumbers',
      expected: manifest.source.pageNumbers,
      actual: current.pageNumbers,
    }));
  }
  return issues;
}

export function loadCurrentSourceFromManifest(repoRoot: string, manifest: VisualPackageManifest): {
  source: StorySourceIdentity | null;
  issues: VisualPackageIssue[];
} {
  try {
    const sourcePath = resolveRepoPath(repoRoot, manifest.source.path);
    if (!fs.existsSync(sourcePath)) {
      return { source: null, issues: [issue('story_source_missing', `story source is missing: ${manifest.source.path}`)] };
    }
    return { source: buildStorySourceIdentity({ repoRoot, storyPath: sourcePath }), issues: [] };
  } catch (error) {
    return { source: null, issues: [issue('story_source_missing', error instanceof Error ? error.message : String(error))] };
  }
}
