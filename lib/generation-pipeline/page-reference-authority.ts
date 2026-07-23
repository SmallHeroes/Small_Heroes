import type { BookVisualContract } from '@/lib/visual-contract-compiler';
import {
  forbiddenPropIdsForPage,
  requiredPropIdsForPage,
} from '@/lib/visual-contract-compiler/propLifecycle';
import {
  selectBoardRefForLocation,
  type ReferenceAsset,
} from '@/lib/set-identity-board/referenceTransport';
import type { SetIdentityBoardBindingContext } from '@/lib/set-identity-board/types';
import { canonicalJsonDigest, resolveRepoPath } from '@/lib/visual-package/integrity';
import { sha256File } from '@/lib/visual-package/propArtifacts';
import type { VisualPackagePropArtifactIdentity } from '@/lib/visual-package/types';

export type PageReferenceCompatibilityErrorCode =
  | 'reference_content_undeclared'
  | 'reference_content_forbidden'
  | 'prop_reference_not_required'
  | 'prop_reference_artifact_mismatch';

export class PageReferenceCompatibilityError extends Error {
  readonly isPageReferenceCompatibilityError = true as const;

  constructor(
    readonly code: PageReferenceCompatibilityErrorCode,
    message: string,
    readonly pageNumber: number,
  ) {
    super(`[page_reference_authority:${code}] ${message}`);
    this.name = 'PageReferenceCompatibilityError';
  }
}

function pageLocationId(contract: BookVisualContract, pageNumber: number): string | undefined {
  return pageNumber === 0
    ? contract.coverContract.locationId
    : contract.pageContracts.find((page) => page.pageNumber === pageNumber)?.locationId;
}

function propReference(
  repoRoot: string,
  artifact: VisualPackagePropArtifactIdentity,
  pageNumber: number,
): ReferenceAsset {
  let artifactPath: string;
  let actualSha256: string;
  try {
    artifactPath = resolveRepoPath(repoRoot, artifact.artifactPath);
    actualSha256 = sha256File(artifactPath);
  } catch (error) {
    throw new PageReferenceCompatibilityError(
      'prop_reference_artifact_mismatch',
      `approved prop reference is unreadable for ${artifact.propId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      pageNumber,
    );
  }
  if (actualSha256 !== artifact.assetSha256) {
    throw new PageReferenceCompatibilityError(
      'prop_reference_artifact_mismatch',
      `approved prop reference bytes changed for ${artifact.propId}`,
      pageNumber,
    );
  }
  return {
    kind: 'prop',
    url: artifactPath,
    identityId: artifact.propId,
    assetSha256: artifact.assetSha256,
    declaredPropIds: [artifact.propId],
    artifactIdentityDigest: canonicalJsonDigest(artifact),
  };
}

/**
 * Compare the page/cover's structured prop contract with every reference's declared visible prop content.
 * This is intentionally independent of prompt prose and provider behavior.
 */
export function assertPageReferenceCompatibility(args: {
  contract: BookVisualContract;
  pageNumber: number;
  references: readonly ReferenceAsset[];
}): void {
  const forbidden = new Set(forbiddenPropIdsForPage(args.contract, args.pageNumber));
  const required = new Set(requiredPropIdsForPage(args.contract, args.pageNumber));

  for (const reference of args.references) {
    if ((reference.kind === 'set' || reference.kind === 'prop') && !reference.declaredPropIds) {
      throw new PageReferenceCompatibilityError(
        'reference_content_undeclared',
        `${reference.kind} reference ${reference.identityId ?? reference.url} has no declared prop content`,
        args.pageNumber,
      );
    }
    for (const propId of reference.declaredPropIds ?? []) {
      if (forbidden.has(propId)) {
        throw new PageReferenceCompatibilityError(
          'reference_content_forbidden',
          `${reference.kind} reference declares forbidden prop ${propId}`,
          args.pageNumber,
        );
      }
    }
    if (reference.kind === 'prop') {
      const propIds = reference.declaredPropIds ?? [];
      if (
        !reference.identityId ||
        propIds.length !== 1 ||
        propIds[0] !== reference.identityId ||
        !required.has(reference.identityId)
      ) {
        throw new PageReferenceCompatibilityError(
          'prop_reference_not_required',
          `prop reference ${reference.identityId ?? reference.url} is not explicitly required on this page`,
          args.pageNumber,
        );
      }
      if (!reference.assetSha256 || !reference.artifactIdentityDigest) {
        throw new PageReferenceCompatibilityError(
          'prop_reference_artifact_mismatch',
          `prop reference ${reference.identityId} lacks exact artifact identity`,
          args.pageNumber,
        );
      }
    }
    if (reference.kind === 'set' && !reference.contentPolicyDigest) {
      throw new PageReferenceCompatibilityError(
        'reference_content_undeclared',
        `set reference ${reference.identityId ?? reference.url} lacks a content-policy identity`,
        args.pageNumber,
      );
    }
  }
}

/**
 * Resolve the base set board plus only the prop references explicitly required by this exact page.
 * Catalogued prop assets are never attached to merely-permitted or forbidden pages.
 */
export function resolvePageReferenceAssets(args: {
  repoRoot: string;
  contract: BookVisualContract;
  pageNumber: number;
  boardBindings?: SetIdentityBoardBindingContext;
  propArtifacts: readonly VisualPackagePropArtifactIdentity[];
}): ReferenceAsset[] {
  const references: ReferenceAsset[] = [];
  const locationId = pageLocationId(args.contract, args.pageNumber);
  if (locationId && args.boardBindings) {
    const board = selectBoardRefForLocation({
      contract: args.contract,
      bindings: args.boardBindings.bindings,
      locationId,
    });
    if (board) references.push(board);
  }

  const required = new Set(requiredPropIdsForPage(args.contract, args.pageNumber));
  for (const artifact of args.propArtifacts) {
    if (required.has(artifact.propId)) {
      references.push(propReference(args.repoRoot, artifact, args.pageNumber));
    }
  }

  assertPageReferenceCompatibility({
    contract: args.contract,
    pageNumber: args.pageNumber,
    references,
  });
  return references;
}
