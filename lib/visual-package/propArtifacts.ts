import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';

import {
  canonicalJsonDigest,
  isoTimestampIsValid,
  nonEmpty,
  parseJsonFile,
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import {
  PROP_REFERENCE_CATALOG_VERSION,
  type PropReferenceCatalog,
  type VisualPackageIssue,
  type VisualPackagePropArtifactIdentity,
} from './types';

function issue(
  code: VisualPackageIssue['code'],
  message: string,
  extra: Omit<VisualPackageIssue, 'code' | 'message'> = {},
): VisualPackageIssue {
  return { code, message, ...extra };
}

export function propReferenceCatalogPath(args: {
  repoRoot: string;
  storyKey: string;
  storySourcePath: string;
}): string {
  const source = resolveRepoPath(args.repoRoot, args.storySourcePath);
  return path.join(path.dirname(source), `${args.storyKey}.prop-references.json`);
}

export function sha256File(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function resolveRequiredPropArtifacts(args: {
  repoRoot: string;
  storyKey: string;
  storySourcePath: string;
  styleId: string;
  template: BookVisualContractTemplate;
}): { artifacts: VisualPackagePropArtifactIdentity[]; issues: VisualPackageIssue[] } {
  const artifacts: VisualPackagePropArtifactIdentity[] = [];
  const issues: VisualPackageIssue[] = [];
  const catalogPath = propReferenceCatalogPath(args);
  if (!fs.existsSync(catalogPath)) return { artifacts, issues };

  let raw: unknown;
  try {
    raw = parseJsonFile(catalogPath);
  } catch (error) {
    return {
      artifacts,
      issues: [issue(
        'prop_reference_catalog_invalid',
        `prop reference catalog JSON is invalid: ${error instanceof Error ? error.message : String(error)}`,
      )],
    };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      artifacts,
      issues: [issue('prop_reference_catalog_invalid', 'prop reference catalog is not an object')],
    };
  }

  const catalog = raw as Partial<PropReferenceCatalog>;
  if (
    catalog.version !== PROP_REFERENCE_CATALOG_VERSION ||
    catalog.storyKey !== args.storyKey ||
    catalog.styleId !== args.styleId ||
    !Array.isArray(catalog.artifacts)
  ) {
    return {
      artifacts,
      issues: [issue('prop_reference_catalog_invalid', 'prop reference catalog identity or shape is unsupported', {
        expected: {
          version: PROP_REFERENCE_CATALOG_VERSION,
          storyKey: args.storyKey,
          styleId: args.styleId,
        },
        actual: raw,
      })],
    };
  }

  const propIds = new Set(args.template.recurringProps.map((prop) => prop.id));
  const seen = new Set<string>();
  const catalogDigest = canonicalJsonDigest(raw);
  const catalogRelative = repoRelativePath(args.repoRoot, catalogPath);
  for (const [index, entry] of catalog.artifacts.entries()) {
    const field = `propReferenceCatalog.artifacts[${index}]`;
    if (
      !entry ||
      !nonEmpty(entry.propId) ||
      !nonEmpty(entry.artifactPath) ||
      !nonEmpty(entry.assetSha256) ||
      !nonEmpty(entry.approvedBy) ||
      !isoTimestampIsValid(entry.approvedAt)
    ) {
      issues.push(issue('prop_reference_catalog_invalid', `${field} has incomplete identity/approval metadata`, {
        field,
      }));
      continue;
    }
    if (!propIds.has(entry.propId)) {
      issues.push(issue('prop_reference_identity_mismatch', `${field} references undeclared prop ${entry.propId}`, {
        field: `${field}.propId`,
        actual: entry.propId,
      }));
      continue;
    }
    if (!args.template.pageContracts.some((page) =>
      page.propConstraints?.some(
        (constraint) => constraint.propId === entry.propId && constraint.visibility === 'required',
      )
    )) {
      issues.push(issue(
        'prop_reference_identity_mismatch',
        `${field} has no page that explicitly requires prop ${entry.propId}`,
        { field: `${field}.propId`, actual: entry.propId },
      ));
      continue;
    }
    if (seen.has(entry.propId)) {
      issues.push(issue('prop_reference_catalog_invalid', `duplicate prop reference for ${entry.propId}`, { field }));
      continue;
    }
    seen.add(entry.propId);

    let artifactPath: string;
    try {
      artifactPath = resolveRepoPath(args.repoRoot, entry.artifactPath);
    } catch (error) {
      issues.push(issue('prop_reference_missing', error instanceof Error ? error.message : String(error), { field }));
      continue;
    }
    if (!fs.existsSync(artifactPath)) {
      issues.push(issue('prop_reference_missing', `prop reference asset is missing: ${entry.artifactPath}`, {
        field: `${field}.artifactPath`,
      }));
      continue;
    }
    const actualSha256 = sha256File(artifactPath);
    if (actualSha256 !== entry.assetSha256.toLowerCase()) {
      issues.push(issue('prop_reference_artifact_mismatch', `prop reference bytes changed for ${entry.propId}`, {
        field: `${field}.assetSha256`,
        expected: entry.assetSha256.toLowerCase(),
        actual: actualSha256,
      }));
      continue;
    }
    artifacts.push({
      propId: entry.propId,
      artifactPath: repoRelativePath(args.repoRoot, artifactPath),
      assetSha256: actualSha256,
      approvedBy: entry.approvedBy,
      approvedAt: entry.approvedAt,
      catalogPath: catalogRelative,
      catalogDigest,
    });
  }
  return { artifacts, issues };
}

export function comparePropArtifacts(
  expected: VisualPackagePropArtifactIdentity[],
  actual: VisualPackagePropArtifactIdentity[],
): VisualPackageIssue[] {
  const issues: VisualPackageIssue[] = [];
  const actualByProp = new Map(actual.map((artifact) => [artifact.propId, artifact]));
  for (const approved of expected) {
    const resolved = actualByProp.get(approved.propId);
    if (!resolved) {
      issues.push(issue('prop_reference_missing', `approved package requires unresolved prop reference ${approved.propId}`));
      continue;
    }
    if (canonicalJsonDigest(approved) !== canonicalJsonDigest(resolved)) {
      issues.push(issue('prop_reference_artifact_mismatch', `approved prop reference changed for ${approved.propId}`, {
        expected: approved,
        actual: resolved,
      }));
    }
  }
  for (const resolved of actual) {
    if (!expected.some((approved) => approved.propId === resolved.propId)) {
      issues.push(issue('prop_reference_identity_mismatch', `package omits newly declared prop reference ${resolved.propId}`, {
        actual: resolved,
      }));
    }
  }
  return issues;
}
