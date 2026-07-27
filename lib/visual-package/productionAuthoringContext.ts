import { createHash } from 'crypto';
import fs from 'fs';

import type { AuthoredCoverAuthority } from '@/lib/visual-contract-compiler/coverSourceAuthority';

import { loadTemplateForPackage } from './artifacts';
import { loadStoryAuthoredCoverAuthority } from './coverSourceFidelity';
import {
  buildStorySourceIdentity,
  canonicalJsonDigest,
  resolveRepoPath,
} from './integrity';
import type { PreRenderBlueprintValidationContext } from './preRenderBlueprintTypes';
import {
  loadSourcePromptReconciliation,
  type SourcePromptReconciliation,
} from './sourcePromptReconciliation';
import {
  loadProductionStyleAuthority,
  type LoadedProductionStyleAuthority,
} from './styleAuthority';
import type {
  StorySourceIdentity,
  VisualPackageTemplateIdentity,
} from './types';
import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';

export const PRODUCTION_AUTHORING_CONTEXT_VERSION =
  'production-authoring-context/v1' as const;

export interface ProductionStorySourceSnapshot {
  identity: StorySourceIdentity;
  rawDigestAlgorithm: 'sha256-utf8';
  rawDigest: string;
  content: string;
}

export interface ProductionAuthoringContext {
  version: typeof PRODUCTION_AUTHORING_CONTEXT_VERSION;
  storyKey: string;
  styleId: string;
  sourceSnapshot: ProductionStorySourceSnapshot;
  template: {
    identity: VisualPackageTemplateIdentity;
    content: BookVisualContractTemplate;
  };
  reconciliation: {
    artifactPath: string;
    digestAlgorithm: 'canonical-json-sha256';
    digest: string;
    content: SourcePromptReconciliation;
  };
  styleAuthority: LoadedProductionStyleAuthority;
  authoredCoverAuthority: AuthoredCoverAuthority | null;
  validationContext: PreRenderBlueprintValidationContext;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export class InvalidProductionAuthoringContextError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid production authoring context:\n- ${issues.join('\n- ')}`);
    this.name = 'InvalidProductionAuthoringContextError';
  }
}

function rawDigest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function contextDigestPayload(
  context: Omit<ProductionAuthoringContext, 'validationContext' | 'digestAlgorithm' | 'digest'>,
): unknown {
  return {
    version: context.version,
    storyKey: context.storyKey,
    styleId: context.styleId,
    sourceSnapshot: {
      identity: context.sourceSnapshot.identity,
      rawDigestAlgorithm: context.sourceSnapshot.rawDigestAlgorithm,
      rawDigest: context.sourceSnapshot.rawDigest,
    },
    template: {
      identity: context.template.identity,
      contentDigest: canonicalJsonDigest(context.template.content),
    },
    reconciliation: {
      artifactPath: context.reconciliation.artifactPath,
      digestAlgorithm: context.reconciliation.digestAlgorithm,
      digest: context.reconciliation.digest,
    },
    styleAuthority: {
      identity: context.styleAuthority.identity,
      contentDigest: canonicalJsonDigest(context.styleAuthority.content),
    },
    authoredCoverAuthority: context.authoredCoverAuthority,
  };
}

export function computeProductionAuthoringContextDigest(
  context: Omit<
    ProductionAuthoringContext,
    'validationContext' | 'digestAlgorithm' | 'digest'
  >,
): string {
  return canonicalJsonDigest(contextDigestPayload(context));
}

export function buildProductionAuthoringContext(args: {
  repoRoot: string;
  storyKey: string;
  storyPath: string;
  templatePath: string;
  reconciliationPath: string;
  styleId: string;
  styleAuthorityPath: string;
  expectedStyleAuthorityDigest?: string;
}): ProductionAuthoringContext {
  const storyAbsolute = resolveRepoPath(args.repoRoot, args.storyPath);
  if (!fs.existsSync(storyAbsolute)) {
    throw new InvalidProductionAuthoringContextError([
      `Story Source is missing: ${args.storyPath}`,
    ]);
  }
  const rawStorySource = fs.readFileSync(storyAbsolute, 'utf8');
  let source: StorySourceIdentity;
  try {
    source = buildStorySourceIdentity({
      repoRoot: args.repoRoot,
      storyPath: args.storyPath,
    });
  } catch (error) {
    throw new InvalidProductionAuthoringContextError([
      `Story Source cannot be snapshotted: ${error instanceof Error ? error.message : String(error)}`,
    ]);
  }
  if (source.pageCount < 1 || source.pageNumbers.length !== source.pageCount) {
    throw new InvalidProductionAuthoringContextError([
      'Story Source snapshot has no complete page identity',
    ]);
  }

  // Reject absolute and escaping paths before the older package loader's compatibility path can accept them.
  resolveRepoPath(args.repoRoot, args.templatePath);
  const loadedTemplate = loadTemplateForPackage({
    repoRoot: args.repoRoot,
    templatePath: args.templatePath,
    storyKey: args.storyKey,
    source,
  });
  if (
    loadedTemplate.issues.length > 0 ||
    !loadedTemplate.template ||
    !loadedTemplate.identity
  ) {
    throw new InvalidProductionAuthoringContextError(
      loadedTemplate.issues.map(
        (issue) => `${issue.code}: ${issue.message}`,
      ),
    );
  }
  const template = loadedTemplate.template;
  const templateIdentity = loadedTemplate.identity;
  const coverAuthority = loadStoryAuthoredCoverAuthority({
    storyPath: storyAbsolute,
    template,
  });
  if (coverAuthority.issues.length > 0) {
    throw new InvalidProductionAuthoringContextError(
      coverAuthority.issues.map(
        (issue) => `${issue.code}: ${issue.message}`,
      ),
    );
  }

  resolveRepoPath(args.repoRoot, args.reconciliationPath);
  const loadedReconciliation = loadSourcePromptReconciliation({
    repoRoot: args.repoRoot,
    artifactPath: args.reconciliationPath,
    storyKey: args.storyKey,
    sourceIdentity: source,
    storyPath: args.storyPath,
    template,
    templateDigest: templateIdentity.digest,
    authoredCoverAuthority: coverAuthority.authority ?? undefined,
    requireComplete: true,
  });
  if (
    loadedReconciliation.issues.length > 0 ||
    !loadedReconciliation.reconciliation ||
    !loadedReconciliation.identity
  ) {
    throw new InvalidProductionAuthoringContextError(
      loadedReconciliation.issues.map(
        (issue) => `${issue.code}: ${issue.message}`,
      ),
    );
  }
  const styleAuthority = loadProductionStyleAuthority({
    repoRoot: args.repoRoot,
    artifactPath: args.styleAuthorityPath,
    expectedStyleId: args.styleId,
    expectedDigest: args.expectedStyleAuthorityDigest,
  });
  const sourceSnapshot: ProductionStorySourceSnapshot = {
    identity: source,
    rawDigestAlgorithm: 'sha256-utf8',
    rawDigest: rawDigest(rawStorySource),
    content: rawStorySource,
  };
  const reconciliation = {
    artifactPath: loadedReconciliation.identity.artifactPath,
    digestAlgorithm: 'canonical-json-sha256' as const,
    digest: loadedReconciliation.identity.digest,
    content: loadedReconciliation.reconciliation,
  };
  const validationContext: PreRenderBlueprintValidationContext = {
    source,
    rawStorySource,
    template,
    templateIdentity,
    reconciliation: loadedReconciliation.reconciliation,
    reconciliationArtifactPath: reconciliation.artifactPath,
    ...(coverAuthority.authority
      ? { authoredCoverAuthority: coverAuthority.authority }
      : {}),
    style: styleAuthority.identity,
    styleContent: styleAuthority.content,
  };
  const withoutDigest = {
    version: PRODUCTION_AUTHORING_CONTEXT_VERSION,
    storyKey: args.storyKey,
    styleId: args.styleId,
    sourceSnapshot,
    template: { identity: templateIdentity, content: template },
    reconciliation,
    styleAuthority,
    authoredCoverAuthority: coverAuthority.authority,
  } satisfies Omit<
    ProductionAuthoringContext,
    'validationContext' | 'digestAlgorithm' | 'digest'
  >;
  return {
    ...withoutDigest,
    validationContext,
    digestAlgorithm: 'canonical-json-sha256',
    digest: computeProductionAuthoringContextDigest(withoutDigest),
  };
}
