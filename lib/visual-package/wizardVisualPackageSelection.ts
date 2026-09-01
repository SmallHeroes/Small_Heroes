import { createHash } from 'crypto';
import fs from 'fs';

import {
  buildStorySourceIdentity,
  canonicalJsonDigest,
  resolveRepoPath,
} from './integrity';
import {
  evaluateVisualPackageV4Qualification,
  type FrozenVisualPackageAuthority,
  type VisualPackageV4,
} from './visualPackageV4';
import {
  acceptedProductLineageDisposition,
  loadAcceptedStorySourceAuthoringAuthority,
} from './acceptedStorySourceAuthoringAuthority';

export interface WizardVisualPackageSelection {
  renderQualified: boolean;
  visualPackageRequired: boolean;
  storyKey: string;
  styleId: string;
  packagePath: string | null;
  packageValue: VisualPackageV4 | null;
  frozenAuthority: FrozenVisualPackageAuthority | null;
  sourcePath: string | null;
  sourceRawDigest: string | null;
  pageCount: number | null;
  reasons: string[];
}

function rejected(args: {
  storyKey: string;
  styleId: string;
  packagePath: string | null;
  reasons: readonly string[];
  visualPackageRequired: boolean;
}): WizardVisualPackageSelection {
  return {
    renderQualified: false,
    visualPackageRequired: args.visualPackageRequired,
    storyKey: args.storyKey,
    styleId: args.styleId,
    packagePath: args.packagePath,
    packageValue: null,
    frozenAuthority: null,
    sourcePath: null,
    sourceRawDigest: null,
    pageCount: null,
    reasons: [...new Set(args.reasons)].sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

/**
 * Fresh Wizard selection boundary. A slot is selectable only when the current
 * Visual Package v4 revision is render-qualified and its repository Story
 * Source is still byte-for-byte the source frozen into that package.
 *
 * Render-time code never calls this mutable-locator boundary: the order freezes
 * the returned immutable package authority and subsequent work uses only that
 * content address.
 */
export function evaluateWizardVisualPackageSelection(args: {
  repoRoot: string;
  storyKey: string;
  styleId: string;
  approvedPackagesDir?: string;
}): WizardVisualPackageSelection {
  const productLineage = acceptedProductLineageDisposition({
    repoRoot: args.repoRoot,
    storyKey: args.storyKey,
  });
  const visualPackageRequired = productLineage.kind !== 'absent';
  const productLineageReasons = productLineage.kind === 'invalid'
    ? productLineage.reasons.map(
        (reason) => `product-accepted Story Source lineage is invalid: ${reason}`,
      )
    : [];
  const qualification = evaluateVisualPackageV4Qualification({
    repoRoot: args.repoRoot,
    storyKey: args.storyKey,
    styleId: args.styleId,
    ...(args.approvedPackagesDir
      ? { approvedPackagesDir: args.approvedPackagesDir }
      : {}),
  });
  if (
    !qualification.renderQualified ||
    !qualification.packageValue ||
    !qualification.frozenAuthority
  ) {
    return rejected({
      storyKey: args.storyKey,
      styleId: args.styleId,
      packagePath: qualification.packagePath,
      reasons: [...qualification.reasons, ...productLineageReasons],
      visualPackageRequired,
    });
  }

  const packageValue = qualification.packageValue;
  const expectedSource = packageValue.sourceSnapshot;
  const reasons: string[] = [];
  reasons.push(...productLineageReasons);
  let sourceAbsolutePath: string | null = null;
  try {
    sourceAbsolutePath = resolveRepoPath(
      args.repoRoot,
      expectedSource.identity.path,
    );
  } catch (error) {
    reasons.push(
      error instanceof Error ? error.message : String(error),
    );
  }
  if (!sourceAbsolutePath || !fs.existsSync(sourceAbsolutePath)) {
    reasons.push('package-bound Story Source is missing');
  } else {
    try {
      const raw = fs.readFileSync(sourceAbsolutePath, 'utf8');
      const rawDigest = createHash('sha256')
        .update(raw, 'utf8')
        .digest('hex');
      if (
        raw !== expectedSource.content ||
        rawDigest !== expectedSource.rawDigest
      ) {
        reasons.push(
          'package-bound Story Source raw bytes do not match the current revision',
        );
      }
      const currentIdentity = buildStorySourceIdentity({
        repoRoot: args.repoRoot,
        storyPath: sourceAbsolutePath,
      });
      if (
        canonicalJsonDigest(currentIdentity) !==
        canonicalJsonDigest(expectedSource.identity)
      ) {
        reasons.push(
          'package-bound Story Source identity does not match the current revision',
        );
      }
    } catch (error) {
      reasons.push(
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  if (visualPackageRequired) {
    try {
      const acceptedAuthority = loadAcceptedStorySourceAuthoringAuthority({
        repoRoot: args.repoRoot,
        storyKey: args.storyKey,
        storyPath: expectedSource.identity.path,
      });
      if (!acceptedAuthority) {
        reasons.push(
          'product-accepted Story Source lineage requires a package bound to a final accepted revision',
        );
      }
    } catch {
      reasons.push(
        'package-bound Story Source does not satisfy product-accepted revision authority',
      );
    }
  }
  if (reasons.length > 0) {
    return rejected({
      storyKey: args.storyKey,
      styleId: args.styleId,
      packagePath: qualification.packagePath,
      reasons,
      visualPackageRequired,
    });
  }

  return {
    renderQualified: true,
    visualPackageRequired,
    storyKey: args.storyKey,
    styleId: args.styleId,
    packagePath: qualification.packagePath,
    packageValue,
    frozenAuthority: qualification.frozenAuthority,
    sourcePath: expectedSource.identity.path,
    sourceRawDigest: expectedSource.rawDigest,
    pageCount: expectedSource.identity.pageCount,
    reasons: [],
  };
}
