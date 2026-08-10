import fs from 'fs';
import path from 'path';

import {
  approvalIssues,
  basicManifestIssues,
  buildCoverageIdentity,
  compareBoardArtifacts,
  currentSourceIssues,
  loadTemplateForPackage,
  resolveRequiredBoardArtifacts,
} from './artifacts';
import {
  buildStorySourceIdentity,
  canonicalJsonDigest,
  repoRelativePath,
} from './integrity';
import type {
  VisualPackageIssue,
  VisualPackageManifest,
} from './types';
import { VISUAL_PACKAGE_MANIFEST_SUFFIX } from './types';
import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';
import { runtimeWorldAuthorityIssues } from './runtimeAuthority';
import {
  loadStoryAuthoredCoverAuthority,
  storyCoverSourceFidelityIssues,
} from './coverSourceFidelity';
import { comparePropArtifacts, resolveRequiredPropArtifacts } from './propArtifacts';
import { loadSourcePromptReconciliation } from './sourcePromptReconciliation';

export interface RenderQualificationResult {
  storyKey: string;
  storySourcePath: string;
  approvedPackagePath: string;
  renderQualified: boolean;
  reasons: VisualPackageIssue[];
  manifest: VisualPackageManifest | null;
  template: BookVisualContractTemplate | null;
}

function issue(
  code: VisualPackageIssue['code'],
  message: string,
  extra: Omit<VisualPackageIssue, 'code' | 'message'> = {},
): VisualPackageIssue {
  return { code, message, ...extra };
}

export function approvedVisualPackagePath(
  repoRoot: string,
  storyKey: string,
  approvedPackagesDir?: string,
): string {
  return path.join(
    approvedPackagesDir ?? path.join(repoRoot, 'visual-packages', 'approved'),
    `${storyKey}${VISUAL_PACKAGE_MANIFEST_SUFFIX}`,
  );
}

/** Read-only, local-filesystem-only qualification. It never compiles, renders, calls an LLM, or reaches storage. */
export function evaluateRenderQualification(args: {
  repoRoot: string;
  storyKey: string;
  storyPath: string;
  styleId: string;
  approvedPackagesDir?: string;
  boardRegistryRoot?: string;
}): RenderQualificationResult {
  const reasons: VisualPackageIssue[] = [];
  let sourcePath: string;
  try {
    sourcePath = path.isAbsolute(args.storyPath)
      ? path.resolve(args.storyPath)
      : path.resolve(args.repoRoot, args.storyPath);
    repoRelativePath(args.repoRoot, sourcePath);
  } catch (error) {
    sourcePath = path.resolve(args.repoRoot, args.storyPath);
    reasons.push(issue('story_source_missing', error instanceof Error ? error.message : String(error)));
  }
  const sourceRel = (() => {
    try {
      return repoRelativePath(args.repoRoot, sourcePath);
    } catch {
      return String(args.storyPath);
    }
  })();
  if (!fs.existsSync(sourcePath)) {
    reasons.push(issue('story_source_missing', `story source is missing: ${sourceRel}`));
  }

  const packagePath = approvedVisualPackagePath(args.repoRoot, args.storyKey, args.approvedPackagesDir);
  const packageRel = (() => {
    try {
      return repoRelativePath(args.repoRoot, packagePath);
    } catch {
      return packagePath;
    }
  })();
  if (!fs.existsSync(packagePath)) {
    reasons.push(issue('approved_package_missing', `approved visual package is missing: ${packageRel}`));
    const legacyPath = path.join(path.dirname(sourcePath), `${args.storyKey}.visual-contract.json`);
    if (fs.existsSync(legacyPath)) {
      reasons.push(issue('legacy_contract_not_qualified', 'a legacy visual contract exists but cannot confer render qualification'));
    }
    return {
      storyKey: args.storyKey,
      storySourcePath: sourceRel,
      approvedPackagePath: packageRel,
      renderQualified: false,
      reasons,
      manifest: null,
      template: null,
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as unknown;
  } catch (error) {
    reasons.push(issue('manifest_invalid', `approved package JSON is invalid: ${error instanceof Error ? error.message : String(error)}`));
    return {
      storyKey: args.storyKey,
      storySourcePath: sourceRel,
      approvedPackagePath: packageRel,
      renderQualified: false,
      reasons,
      manifest: null,
      template: null,
    };
  }
  reasons.push(...basicManifestIssues(raw));
  if (reasons.some((reason) => reason.code === 'manifest_invalid')) {
    return {
      storyKey: args.storyKey,
      storySourcePath: sourceRel,
      approvedPackagePath: packageRel,
      renderQualified: false,
      reasons,
      manifest: null,
      template: null,
    };
  }
  const manifest = raw as VisualPackageManifest;
  if (manifest.state !== 'approved' || !manifest.promotion) {
    reasons.push(issue('approved_package_not_approved', 'package is not in approved state with a promotion record'));
  }
  if (manifest.storyKey !== args.storyKey) {
    reasons.push(issue('story_key_mismatch', 'approved package storyKey does not match the selected story', {
      expected: args.storyKey,
      actual: manifest.storyKey,
    }));
  }
  if (manifest.styleId !== args.styleId) {
    reasons.push(issue('style_mismatch', 'approved package style does not match the render style', {
      expected: args.styleId,
      actual: manifest.styleId,
    }));
  }
  reasons.push(...approvalIssues(manifest));

  let currentSource = null;
  if (fs.existsSync(sourcePath)) {
    try {
      currentSource = buildStorySourceIdentity({ repoRoot: args.repoRoot, storyPath: sourcePath });
      reasons.push(...currentSourceIssues(manifest, currentSource));
    } catch (error) {
      reasons.push(issue('story_source_missing', error instanceof Error ? error.message : String(error)));
    }
  }

  let qualifiedTemplate: BookVisualContractTemplate | null = null;
  if (currentSource) {
    const loaded = loadTemplateForPackage({
      repoRoot: args.repoRoot,
      templatePath: manifest.template.artifactPath,
      storyKey: args.storyKey,
      source: currentSource,
      expectedDigest: manifest.template.digest,
    });
    reasons.push(...loaded.issues);
    if (
      loaded.identity &&
      manifest.template.schemaVersion !== loaded.identity.schemaVersion
    ) {
      reasons.push(issue('template_schema_unsupported', 'approved package schema binding disagrees with the artifact', {
        expected: loaded.identity.schemaVersion,
        actual: manifest.template.schemaVersion,
      }));
    }
    if (loaded.template) {
      qualifiedTemplate = loaded.template;
      reasons.push(...runtimeWorldAuthorityIssues(loaded.template, manifest.review.worldMode));
      reasons.push(...storyCoverSourceFidelityIssues({ storyPath: sourcePath, template: loaded.template }));
      const coverAuthority = loadStoryAuthoredCoverAuthority({
        storyPath: sourcePath,
        template: loaded.template,
      });
      reasons.push(...coverAuthority.issues);
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
      reasons.push(...reconciliation.issues);
      if (
        reconciliation.identity &&
        canonicalJsonDigest(reconciliation.identity) !== canonicalJsonDigest(manifest.reconciliation)
      ) {
        reasons.push(issue(
          'reconciliation_identity_mismatch',
          'approved reconciliation identity disagrees with the artifact',
          { expected: manifest.reconciliation, actual: reconciliation.identity },
        ));
      }
      const coverage = buildCoverageIdentity(loaded.template);
      if (canonicalJsonDigest(coverage) !== canonicalJsonDigest(manifest.coverage)) {
        reasons.push(issue('coverage_identity_mismatch', 'approved cover/page coverage identity is stale', {
          expected: manifest.coverage,
          actual: coverage,
        }));
      }
      const boards = resolveRequiredBoardArtifacts({
        repoRoot: args.repoRoot,
        boardRegistryRoot: args.boardRegistryRoot ?? path.join(args.repoRoot, 'set-identity-boards'),
        template: loaded.template,
        styleId: args.styleId,
      });
      reasons.push(...boards.issues);
      reasons.push(...compareBoardArtifacts(
        Array.isArray(manifest.requiredBoards) ? manifest.requiredBoards : [],
        boards.boards,
      ));
      const propArtifacts = resolveRequiredPropArtifacts({
        repoRoot: args.repoRoot,
        storyKey: args.storyKey,
        storySourcePath: manifest.source.path,
        styleId: args.styleId,
        template: loaded.template,
      });
      reasons.push(...propArtifacts.issues);
      reasons.push(...comparePropArtifacts(
        Array.isArray(manifest.requiredPropReferences) ? manifest.requiredPropReferences : [],
        propArtifacts.artifacts,
      ));
    }
  }

  return {
    storyKey: args.storyKey,
    storySourcePath: sourceRel,
    approvedPackagePath: packageRel,
    renderQualified: reasons.length === 0,
    reasons,
    manifest,
    template: qualifiedTemplate,
  };
}
