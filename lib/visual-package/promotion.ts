import fs from 'fs';
import path from 'path';

import {
  buildStorySourceIdentity,
  canonicalJsonDigest,
  normalizedTextDigest,
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import { parseCandidateEvidenceHeader, type CandidateEvidenceBinding } from './candidateEvidence';
import {
  approvalIssues,
  basicManifestIssues,
  buildCoverageIdentity,
  compareBoardArtifacts,
  currentSourceIssues,
  loadCurrentSourceFromManifest,
  loadTemplateForPackage,
  resolveRequiredBoardArtifacts,
} from './artifacts';
import {
  CANDIDATE_EVIDENCE_VERSION,
  SOURCE_PROMPT_RECONCILIATION_SUFFIX,
  VISUAL_PACKAGE_MANIFEST_VERSION,
  VISUAL_PACKAGE_MANIFEST_SUFFIX,
  VISUAL_PACKAGE_PROMOTION_VERSION,
  VisualPackageValidationError,
  type VisualPackageIssue,
  type VisualPackageManifest,
  type StorySourceIdentity,
} from './types';
import {
  loadStoryAuthoredCoverAuthority,
  storyCoverSourceFidelityIssues,
} from './coverSourceFidelity';
import { comparePropArtifacts, resolveRequiredPropArtifacts } from './propArtifacts';
import { loadSourcePromptReconciliation } from './sourcePromptReconciliation';

const TEMPLATE_SUFFIX = '.visual-contract-template.json';
const REVIEW_SUFFIX = '.visual-contract-review.md';
const PROVENANCE_SUFFIX = '.visual-contract-provenance.json';
export { VISUAL_PACKAGE_MANIFEST_SUFFIX } from './types';

interface CandidateProvenance {
  candidateEvidence?: CandidateEvidenceBinding;
}

function issue(
  code: VisualPackageIssue['code'],
  message: string,
  extra: Omit<VisualPackageIssue, 'code' | 'message'> = {},
): VisualPackageIssue {
  return { code, message, ...extra };
}

function candidatePaths(candidateDir: string, storyKey: string) {
  return {
    template: path.join(candidateDir, `${storyKey}${TEMPLATE_SUFFIX}`),
    review: path.join(candidateDir, `${storyKey}${REVIEW_SUFFIX}`),
    provenance: path.join(candidateDir, `${storyKey}${PROVENANCE_SUFFIX}`),
    reconciliation: path.join(candidateDir, `${storyKey}${SOURCE_PROMPT_RECONCILIATION_SUFFIX}`),
    manifest: path.join(candidateDir, `${storyKey}${VISUAL_PACKAGE_MANIFEST_SUFFIX}`),
  };
}

function readCandidateEvidence(args: {
  paths: ReturnType<typeof candidatePaths>;
  storyKey: string;
  storySource: StorySourceIdentity;
  templateDigest: string;
}): {
  reviewDigest: string;
  provenanceDigest: string;
  sourceInputDigest: string;
  issues: VisualPackageIssue[];
} {
  const issues: VisualPackageIssue[] = [];
  if (!fs.existsSync(args.paths.review)) {
    issues.push(issue('candidate_review_disagreement', `candidate review is missing: ${args.paths.review}`));
  }
  if (!fs.existsSync(args.paths.provenance)) {
    issues.push(issue('candidate_provenance_disagreement', `candidate provenance is missing: ${args.paths.provenance}`));
  }
  if (issues.length > 0) {
    return { reviewDigest: '', provenanceDigest: '', sourceInputDigest: '', issues };
  }

  const reviewText = fs.readFileSync(args.paths.review, 'utf8');
  const reviewBinding = parseCandidateEvidenceHeader(reviewText);
  if (
    !reviewBinding ||
    reviewBinding.storyKey !== args.storyKey ||
    canonicalJsonDigest(reviewBinding.storySource) !== canonicalJsonDigest(args.storySource) ||
    reviewBinding.templateDigest !== args.templateDigest
  ) {
    issues.push(issue('candidate_review_disagreement', 'review evidence header disagrees with story/template identity', {
      expected: {
        storyKey: args.storyKey,
        storySource: args.storySource,
        templateDigest: args.templateDigest,
      },
      actual: reviewBinding,
    }));
  }

  let provenance: CandidateProvenance | null = null;
  const provenanceText = fs.readFileSync(args.paths.provenance, 'utf8');
  try {
    provenance = JSON.parse(provenanceText) as CandidateProvenance;
  } catch {
    issues.push(issue('candidate_provenance_disagreement', 'candidate provenance is invalid JSON'));
  }
  const provenanceBinding = provenance?.candidateEvidence;
  if (
    !provenanceBinding ||
    provenanceBinding.version !== CANDIDATE_EVIDENCE_VERSION ||
    provenanceBinding.storyKey !== args.storyKey ||
    canonicalJsonDigest(provenanceBinding.storySource) !== canonicalJsonDigest(args.storySource) ||
    provenanceBinding.templateDigest !== args.templateDigest
  ) {
    issues.push(issue('candidate_provenance_disagreement', 'provenance binding disagrees with story/template identity', {
      actual: provenanceBinding,
    }));
  }
  if (
    reviewBinding &&
    provenanceBinding &&
    canonicalJsonDigest(reviewBinding) !== canonicalJsonDigest(provenanceBinding)
  ) {
    issues.push(issue('candidate_provenance_disagreement', 'review and provenance bind different candidate evidence'));
  }

  return {
    reviewDigest: normalizedTextDigest(reviewText),
    provenanceDigest: provenance ? canonicalJsonDigest(provenance) : '',
    sourceInputDigest: provenanceBinding?.sourceInputDigest ?? '',
    issues,
  };
}

export interface PrepareVisualPackageCandidateArgs {
  repoRoot: string;
  storyKey: string;
  storyPath: string;
  candidateDir: string;
  styleId: string;
  boardRegistryRoot?: string;
}

/** Build the one review/approval manifest from compiler outputs. Pure with respect to the repository: no writes. */
export function prepareVisualPackageCandidate(
  args: PrepareVisualPackageCandidateArgs,
): { manifest: VisualPackageManifest; manifestPath: string } {
  const paths = candidatePaths(path.resolve(args.candidateDir), args.storyKey);
  const sourcePath = path.isAbsolute(args.storyPath)
    ? args.storyPath
    : path.resolve(args.repoRoot, args.storyPath);
  let source;
  try {
    source = buildStorySourceIdentity({ repoRoot: args.repoRoot, storyPath: sourcePath });
  } catch (error) {
    throw new VisualPackageValidationError([
      issue('story_source_missing', error instanceof Error ? error.message : String(error)),
    ]);
  }

  const loaded = loadTemplateForPackage({
    repoRoot: args.repoRoot,
    templatePath: paths.template,
    storyKey: args.storyKey,
    source,
  });
  const issues = [...loaded.issues];
  if (!loaded.template || !loaded.identity) throw new VisualPackageValidationError(issues);
  issues.push(...storyCoverSourceFidelityIssues({ storyPath: sourcePath, template: loaded.template }));
  const coverAuthority = loadStoryAuthoredCoverAuthority({
    storyPath: sourcePath,
    template: loaded.template,
  });
  issues.push(...coverAuthority.issues);
  const reconciliationPath = repoRelativePath(args.repoRoot, paths.reconciliation);
  const reconciliation = loadSourcePromptReconciliation({
    repoRoot: args.repoRoot,
    artifactPath: reconciliationPath,
    storyKey: args.storyKey,
    sourceIdentity: source,
    storyPath: source.path,
    template: loaded.template,
    templateDigest: loaded.identity.digest,
    authoredCoverAuthority: coverAuthority.authority ?? undefined,
    // The legacy manifest lifecycle has no Visual Contract candidate authority.
    // Current non-empty coverage therefore fails closed on this path.
    actionSemanticCoverage: [],
  });
  issues.push(...reconciliation.issues);

  const evidence = readCandidateEvidence({
    paths,
    storyKey: args.storyKey,
    storySource: source,
    templateDigest: loaded.identity.digest,
  });
  issues.push(...evidence.issues);
  const boardResolution = resolveRequiredBoardArtifacts({
    repoRoot: args.repoRoot,
    boardRegistryRoot: args.boardRegistryRoot ?? path.join(args.repoRoot, 'set-identity-boards'),
    template: loaded.template,
    styleId: args.styleId,
  });
  issues.push(...boardResolution.issues);
  const propResolution = resolveRequiredPropArtifacts({
    repoRoot: args.repoRoot,
    storyKey: args.storyKey,
    storySourcePath: source.path,
    styleId: args.styleId,
    template: loaded.template,
  });
  issues.push(...propResolution.issues);
  if (issues.length > 0 || !reconciliation.identity) {
    throw new VisualPackageValidationError(issues);
  }

  return {
    manifest: {
      manifestVersion: VISUAL_PACKAGE_MANIFEST_VERSION,
      state: 'candidate',
      storyKey: args.storyKey,
      styleId: args.styleId,
      source,
      template: loaded.identity,
      reconciliation: reconciliation.identity,
      coverage: buildCoverageIdentity(loaded.template),
      candidateEvidence: {
        version: CANDIDATE_EVIDENCE_VERSION,
        sourceInputDigest: evidence.sourceInputDigest,
        reviewDigest: evidence.reviewDigest,
        provenanceDigest: evidence.provenanceDigest,
      },
      review: {
        authoredBy: null,
        reviewedBy: null,
        reviewedAt: null,
        worldMode: null,
      },
      approval: null,
      requiredBoards: boardResolution.boards,
      requiredPropReferences: propResolution.artifacts,
      promotion: null,
    },
    manifestPath: paths.manifest,
  };
}

export interface PromoteVisualPackageArgs {
  repoRoot: string;
  approvalManifestPath: string;
  approvedPackagesDir?: string;
  boardRegistryRoot?: string;
  write?: boolean;
  now?: () => Date;
}

export interface VisualPackagePromotionResult {
  approvedManifest: VisualPackageManifest;
  templateDestination: string;
  reconciliationDestination: string;
  manifestDestination: string;
  wrote: boolean;
}

/**
 * Re-verify the exact human-approved candidate and optionally promote it. `write` defaults false, so validation is a
 * dry-run unless the caller explicitly opts into promotion.
 */
export function promoteVisualPackage(args: PromoteVisualPackageArgs): VisualPackagePromotionResult {
  const manifestPath = path.resolve(args.approvalManifestPath);
  if (!fs.existsSync(manifestPath)) {
    throw new VisualPackageValidationError([issue('approval_missing', `approval manifest is missing: ${manifestPath}`)]);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
  } catch (error) {
    throw new VisualPackageValidationError([issue('manifest_invalid', `approval manifest is invalid JSON: ${error instanceof Error ? error.message : String(error)}`)]);
  }
  const shapeIssues = basicManifestIssues(raw);
  if (shapeIssues.length > 0) throw new VisualPackageValidationError(shapeIssues);
  const manifest = raw as VisualPackageManifest;
  const issues = approvalIssues(manifest);
  if (manifest.state !== 'candidate') {
    issues.push(issue('manifest_invalid', `promotion requires state="candidate" (got ${JSON.stringify(manifest.state)})`));
  }
  if (manifest.promotion !== null) {
    issues.push(issue('manifest_invalid', 'candidate manifest already has a promotion record'));
  }

  const currentSource = loadCurrentSourceFromManifest(args.repoRoot, manifest);
  issues.push(...currentSource.issues);
  if (currentSource.source) issues.push(...currentSourceIssues(manifest, currentSource.source));

  const loaded = currentSource.source
    ? loadTemplateForPackage({
        repoRoot: args.repoRoot,
        templatePath: manifest.template.artifactPath,
        storyKey: manifest.storyKey,
        source: currentSource.source,
        expectedDigest: manifest.template.digest,
      })
    : { template: null, identity: null, issues: [] as VisualPackageIssue[] };
  issues.push(...loaded.issues);
  if (
    loaded.identity &&
    manifest.template.schemaVersion !== loaded.identity.schemaVersion
  ) {
    issues.push(issue('template_schema_unsupported', 'manifest template schema binding disagrees with the artifact', {
      expected: loaded.identity.schemaVersion,
      actual: manifest.template.schemaVersion,
    }));
  }

  const paths = candidatePaths(path.dirname(manifestPath), manifest.storyKey);
  const evidence = readCandidateEvidence({
    paths,
    storyKey: manifest.storyKey,
    storySource: manifest.source,
    templateDigest: manifest.template.digest,
  });
  issues.push(...evidence.issues);
  if (
    manifest.candidateEvidence.sourceInputDigest !== evidence.sourceInputDigest ||
    manifest.candidateEvidence.reviewDigest !== evidence.reviewDigest ||
    manifest.candidateEvidence.provenanceDigest !== evidence.provenanceDigest
  ) {
    issues.push(issue('candidate_evidence_digest_mismatch', 'candidate evidence changed after approval', {
      expected: manifest.candidateEvidence,
      actual: evidence,
    }));
  }

  if (loaded.template) {
    const storyPath = resolveRepoPath(args.repoRoot, manifest.source.path);
    issues.push(...storyCoverSourceFidelityIssues({
      storyPath,
      template: loaded.template,
    }));
    const coverAuthority = loadStoryAuthoredCoverAuthority({
      storyPath,
      template: loaded.template,
    });
    issues.push(...coverAuthority.issues);
    const reconciliation = loadSourcePromptReconciliation({
      repoRoot: args.repoRoot,
      artifactPath: manifest.reconciliation.artifactPath,
      storyKey: manifest.storyKey,
      sourceIdentity: manifest.source,
      storyPath: manifest.source.path,
      template: loaded.template,
      templateDigest: manifest.template.digest,
      authoredCoverAuthority: coverAuthority.authority ?? undefined,
      // The legacy manifest lifecycle cannot self-declare current candidate coverage.
      actionSemanticCoverage: [],
    });
    issues.push(...reconciliation.issues);
    if (
      reconciliation.identity &&
      canonicalJsonDigest(reconciliation.identity) !== canonicalJsonDigest(manifest.reconciliation)
    ) {
      issues.push(issue(
        'reconciliation_identity_mismatch',
        'reconciliation artifact identity changed after approval',
        { expected: manifest.reconciliation, actual: reconciliation.identity },
      ));
    }
    const coverage = buildCoverageIdentity(loaded.template);
    if (canonicalJsonDigest(coverage) !== canonicalJsonDigest(manifest.coverage)) {
      issues.push(issue('coverage_identity_mismatch', 'cover/page coverage identity changed after approval', {
        expected: manifest.coverage,
        actual: coverage,
      }));
    }
    const boards = resolveRequiredBoardArtifacts({
      repoRoot: args.repoRoot,
      boardRegistryRoot: args.boardRegistryRoot ?? path.join(args.repoRoot, 'set-identity-boards'),
      template: loaded.template,
      styleId: manifest.styleId,
      frozenRequiredBoards: Array.isArray(manifest.requiredBoards)
        ? manifest.requiredBoards
        : [],
    });
    issues.push(...boards.issues);
    if (!boards.issues.some((issue) =>
      issue.code === 'board_authority_invalid')) {
      issues.push(...compareBoardArtifacts(
        Array.isArray(manifest.requiredBoards) ? manifest.requiredBoards : [],
        boards.boards,
      ));
    }
    const propArtifacts = resolveRequiredPropArtifacts({
      repoRoot: args.repoRoot,
      storyKey: manifest.storyKey,
      storySourcePath: manifest.source.path,
      styleId: manifest.styleId,
      template: loaded.template,
    });
    issues.push(...propArtifacts.issues);
    issues.push(...comparePropArtifacts(
      Array.isArray(manifest.requiredPropReferences) ? manifest.requiredPropReferences : [],
      propArtifacts.artifacts,
    ));
  }

  if (issues.length > 0) throw new VisualPackageValidationError(issues);

  const sourceDir = path.posix.dirname(manifest.source.path);
  const templateDestinationRel = path.posix.join(sourceDir, `${manifest.storyKey}${TEMPLATE_SUFFIX}`);
  const reconciliationDestinationRel = path.posix.join(
    sourceDir,
    `${manifest.storyKey}${SOURCE_PROMPT_RECONCILIATION_SUFFIX}`,
  );
  const approvedPackagesDir = args.approvedPackagesDir ?? path.join(args.repoRoot, 'visual-packages', 'approved');
  const manifestDestination = path.join(approvedPackagesDir, `${manifest.storyKey}${VISUAL_PACKAGE_MANIFEST_SUFFIX}`);
  const manifestDestinationRel = repoRelativePath(args.repoRoot, manifestDestination);
  const promotedAt = (args.now ?? (() => new Date()))().toISOString();
  const approvedManifest: VisualPackageManifest = {
    ...manifest,
    state: 'approved',
    template: { ...manifest.template, artifactPath: templateDestinationRel },
    reconciliation: {
      ...manifest.reconciliation,
      artifactPath: reconciliationDestinationRel,
    },
    promotion: {
      toolVersion: VISUAL_PACKAGE_PROMOTION_VERSION,
      promotedAt,
      templateDestination: templateDestinationRel,
      reconciliationDestination: reconciliationDestinationRel,
      manifestDestination: manifestDestinationRel,
    },
  };

  if (args.write === true) {
    const templateDestination = resolveRepoPath(args.repoRoot, templateDestinationRel);
    const reconciliationDestination = resolveRepoPath(args.repoRoot, reconciliationDestinationRel);
    fs.mkdirSync(path.dirname(templateDestination), { recursive: true });
    fs.mkdirSync(path.dirname(manifestDestination), { recursive: true });
    fs.copyFileSync(resolveRepoPath(args.repoRoot, manifest.template.artifactPath), templateDestination);
    fs.copyFileSync(
      resolveRepoPath(args.repoRoot, manifest.reconciliation.artifactPath),
      reconciliationDestination,
    );
    fs.writeFileSync(manifestDestination, `${JSON.stringify(approvedManifest, null, 2)}\n`, 'utf8');
  }

  return {
    approvedManifest,
    templateDestination: templateDestinationRel,
    reconciliationDestination: reconciliationDestinationRel,
    manifestDestination: manifestDestinationRel,
    wrote: args.write === true,
  };
}

export function writePreparedCandidateManifest(
  result: ReturnType<typeof prepareVisualPackageCandidate>,
): void {
  fs.mkdirSync(path.dirname(result.manifestPath), { recursive: true });
  fs.writeFileSync(result.manifestPath, `${JSON.stringify(result.manifest, null, 2)}\n`, 'utf8');
}
