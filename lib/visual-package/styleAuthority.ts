import fs from 'fs';

import type { PreRenderBlueprintStyleAuthority } from './preRenderBlueprintTypes';
import {
  canonicalJsonDigest,
  nonEmpty,
  parseJsonFile,
  repoRelativePath,
  resolveRepoPath,
} from './integrity';

export const PRODUCTION_STYLE_AUTHORITY_VERSION =
  'production-style-authority/v1' as const;
export const STYLE01_PRODUCTION_STYLE_ID =
  'soft_hand_drawn_storybook' as const;
export const STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH =
  'style-authorities/style01/soft_hand_drawn_storybook.style-authority.json' as const;

const STYLE_AUTHORITY_FIELDS = [
  'medium',
  'color',
  'lighting',
  'texture',
  'environment',
  'renderingConstraints',
] as const;

export interface ProductionStyleAuthority {
  version: typeof PRODUCTION_STYLE_AUTHORITY_VERSION;
  styleId: string;
  pipelineStyleBranch: 'style01';
  medium: string[];
  color: string[];
  lighting: string[];
  texture: string[];
  environment: string[];
  renderingConstraints: string[];
  authorityBoundaries: {
    owns: string[];
    doesNotOwn: string[];
  };
}

export interface LoadedProductionStyleAuthority {
  artifactPath: string;
  content: ProductionStyleAuthority;
  identity: PreRenderBlueprintStyleAuthority;
}

export class InvalidProductionStyleAuthorityError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid production style authority:\n- ${issues.join('\n- ')}`);
    this.name = 'InvalidProductionStyleAuthorityError';
  }
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => nonEmpty(entry))
  );
}

export function productionStyleAuthorityIssues(
  raw: unknown,
  expectedStyleId?: string,
): string[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return ['style authority must be an object'];
  }
  const value = raw as Partial<ProductionStyleAuthority>;
  const issues: string[] = [];
  if (value.version !== PRODUCTION_STYLE_AUTHORITY_VERSION) {
    issues.push(
      `version must be ${JSON.stringify(PRODUCTION_STYLE_AUTHORITY_VERSION)}`,
    );
  }
  if (!nonEmpty(value.styleId)) issues.push('styleId is required');
  if (expectedStyleId && value.styleId !== expectedStyleId) {
    issues.push(
      `styleId mismatch: expected ${JSON.stringify(expectedStyleId)}, got ${JSON.stringify(value.styleId)}`,
    );
  }
  if (value.pipelineStyleBranch !== 'style01') {
    issues.push('pipelineStyleBranch must be "style01"');
  }
  for (const field of STYLE_AUTHORITY_FIELDS) {
    if (!nonEmptyStringArray(value[field])) {
      issues.push(`${field} must be a non-empty string array`);
    }
  }
  if (
    !value.authorityBoundaries ||
    !nonEmptyStringArray(value.authorityBoundaries.owns) ||
    !nonEmptyStringArray(value.authorityBoundaries.doesNotOwn)
  ) {
    issues.push(
      'authorityBoundaries.owns and authorityBoundaries.doesNotOwn must be non-empty string arrays',
    );
  } else {
    const forbiddenOwners = new Set([
      'camera',
      'composition',
      'staging',
      'action',
      'pose',
      'blocking',
      'placement',
      'page layout',
    ]);
    const illegallyOwned = value.authorityBoundaries.owns.filter((entry) =>
      forbiddenOwners.has(entry.trim().toLowerCase()),
    );
    if (illegallyOwned.length > 0) {
      issues.push(
        `style authority illegally owns Blueprint dimensions: ${illegallyOwned.join(', ')}`,
      );
    }
    for (const required of forbiddenOwners) {
      if (
        !value.authorityBoundaries.doesNotOwn.some(
          (entry) => entry.trim().toLowerCase() === required,
        )
      ) {
        issues.push(
          `authorityBoundaries.doesNotOwn must explicitly include ${JSON.stringify(required)}`,
        );
      }
    }
  }
  return issues;
}

export function loadProductionStyleAuthority(args: {
  repoRoot: string;
  artifactPath: string;
  expectedStyleId: string;
  expectedDigest?: string;
}): LoadedProductionStyleAuthority {
  const absolute = resolveRepoPath(args.repoRoot, args.artifactPath);
  if (!fs.existsSync(absolute)) {
    throw new InvalidProductionStyleAuthorityError([
      `artifact is missing: ${args.artifactPath}`,
    ]);
  }
  let raw: unknown;
  try {
    raw = parseJsonFile(absolute);
  } catch (error) {
    throw new InvalidProductionStyleAuthorityError([
      `artifact is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    ]);
  }
  const issues = productionStyleAuthorityIssues(raw, args.expectedStyleId);
  const digest = canonicalJsonDigest(raw);
  if (args.expectedDigest && digest !== args.expectedDigest) {
    issues.push(
      `content digest mismatch: expected ${args.expectedDigest}, got ${digest}`,
    );
  }
  if (issues.length > 0) {
    throw new InvalidProductionStyleAuthorityError(issues);
  }
  const artifactPath = repoRelativePath(args.repoRoot, absolute);
  return {
    artifactPath,
    content: raw as ProductionStyleAuthority,
    identity: {
      styleId: args.expectedStyleId,
      artifactPath,
      digestAlgorithm: 'canonical-json-sha256',
      digest,
    },
  };
}
