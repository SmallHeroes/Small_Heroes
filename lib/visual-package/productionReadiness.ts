import fs from 'fs';

import { listRequiredSetIdentityIds } from '@/lib/set-identity-board/setDefinition';
import type { BookVisualContract } from '@/lib/visual-contract-compiler/types';

import {
  loadTemplateForPackage,
  resolveRequiredBoardArtifacts,
} from './artifacts';
import {
  loadStoryAuthoredCoverAuthority,
  storyCoverSourceFidelityIssues,
} from './coverSourceFidelity';
import {
  buildStorySourceIdentity,
  canonicalJsonDigest,
  resolveRepoPath,
} from './integrity';
import { loadSourcePromptReconciliation } from './sourcePromptReconciliation';
import {
  loadProductionStyleAuthority,
  type LoadedProductionStyleAuthority,
} from './styleAuthority';
import type {
  StorySourceIdentity,
  VisualPackageBoardArtifactIdentity,
  VisualPackageTemplateIdentity,
} from './types';
import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';

export const PRODUCTION_READINESS_AUDIT_VERSION =
  'production-story-readiness-audit/v2' as const;

export type ProductionLifecycleStage =
  | 'source_authority'
  | 'reconciliation_review'
  | 'blueprint_authoring'
  | 'blueprint_approval'
  | 'board_compatibility'
  | 'package_assembly';

const STAGE_ORDER: Record<ProductionLifecycleStage, number> = {
  source_authority: 0,
  reconciliation_review: 1,
  blueprint_authoring: 2,
  blueprint_approval: 3,
  board_compatibility: 4,
  package_assembly: 5,
};

export type ProductionReadinessReasonCode =
  | 'path_invalid'
  | 'source_missing'
  | 'source_invalid'
  | 'source_snapshot_incomplete'
  | 'template_missing'
  | 'template_invalid'
  | 'template_identity_stale'
  | 'cover_authority_incomplete'
  | 'page_authority_incomplete'
  | 'set_authority_invalid'
  | 'style_authority_missing'
  | 'style_authority_invalid'
  | 'reconciliation_missing'
  | 'reconciliation_unresolved'
  | 'reconciliation_unapproved'
  | 'reconciliation_stale'
  | 'blueprint_artifact_missing'
  | 'board_missing'
  | 'board_unapproved'
  | 'board_stale'
  | 'lifecycle_prerequisite_missing';

export interface ProductionReadinessReason {
  code: ProductionReadinessReasonCode;
  stage: ProductionLifecycleStage;
  message: string;
  field?: string;
  expected?: unknown;
  actual?: unknown;
}

export interface ProductionBlueprintArtifactPaths {
  blueprintPath?: string;
  authoringProvenancePath?: string;
  validationEvidencePath?: string;
  reviewPacketPath?: string;
  planningApprovalPath?: string;
}

export interface ProductionReadinessAudit {
  version: typeof PRODUCTION_READINESS_AUDIT_VERSION;
  storyKey: string;
  styleId: string;
  throughStage: ProductionLifecycleStage;
  ready: boolean;
  stageReadiness: Record<ProductionLifecycleStage, boolean>;
  source: StorySourceIdentity | null;
  templateIdentity: VisualPackageTemplateIdentity | null;
  styleAuthority: LoadedProductionStyleAuthority['identity'] | null;
  reconciliationDigest: string | null;
  requiredSetIdentityIds: string[];
  resolvedBoards: VisualPackageBoardArtifactIdentity[];
  reasons: ProductionReadinessReason[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

function reason(
  code: ProductionReadinessReasonCode,
  stage: ProductionLifecycleStage,
  message: string,
  extra: Omit<
    ProductionReadinessReason,
    'code' | 'stage' | 'message'
  > = {},
): ProductionReadinessReason {
  return { code, stage, message, ...extra };
}

function classifyReconciliationReason(
  code: string,
): ProductionReadinessReasonCode {
  if (code === 'reconciliation_missing') return 'reconciliation_missing';
  if (code.includes('source') || code.includes('template')) {
    return 'reconciliation_stale';
  }
  return 'reconciliation_unresolved';
}

function explicitAuthorityReasons(args: {
  source: StorySourceIdentity;
  template: BookVisualContractTemplate;
}): ProductionReadinessReason[] {
  const reasons: ProductionReadinessReason[] = [];
  const cover = args.template.coverContract;
  if (
    !cover?.locationId?.trim() ||
    !cover.zoneId?.trim() ||
    !Array.isArray(cover.castIds) ||
    cover.castIds.length < 1 ||
    !Array.isArray(cover.mustShow) ||
    !Array.isArray(cover.mustNotShow)
  ) {
    reasons.push(
      reason(
        'cover_authority_incomplete',
        'source_authority',
        'cover authority requires explicit location, zone, cast, mustShow, and mustNotShow',
        { field: 'template.coverContract' },
      ),
    );
  }
  const byPage = new Map(
    args.template.pageContracts.map((page) => [page.pageNumber, page]),
  );
  for (const pageNumber of args.source.pageNumbers) {
    const page = byPage.get(pageNumber);
    if (
      !page ||
      !page.locationId?.trim() ||
      !page.zoneId?.trim() ||
      !Array.isArray(page.castIds) ||
      page.castIds.length < 1 ||
      !Array.isArray(page.mustShow) ||
      !Array.isArray(page.mustNotShow) ||
      !Array.isArray(page.actionRequirements) ||
      (
        page.propConstraints !== undefined &&
        !Array.isArray(page.propConstraints)
      )
    ) {
      reasons.push(
        reason(
          'page_authority_incomplete',
          'source_authority',
          `page ${pageNumber} lacks complete location/zone/cast/action/prop authority`,
          { field: `template.pageContracts[pageNumber=${pageNumber}]` },
        ),
      );
    }
  }
  return reasons;
}

function requiredBlueprintArtifactReasons(
  repoRoot: string,
  paths: ProductionBlueprintArtifactPaths | undefined,
): ProductionReadinessReason[] {
  const required: Array<keyof ProductionBlueprintArtifactPaths> = [
    'blueprintPath',
    'authoringProvenancePath',
    'validationEvidencePath',
    'reviewPacketPath',
    'planningApprovalPath',
  ];
  const reasons: ProductionReadinessReason[] = [];
  for (const field of required) {
    const candidate = paths?.[field];
    if (!candidate) {
      reasons.push(
        reason(
          'blueprint_artifact_missing',
          'blueprint_approval',
          `${field} is required for the approved Blueprint lifecycle`,
          { field },
        ),
      );
      continue;
    }
    try {
      const absolute = resolveRepoPath(repoRoot, candidate);
      if (!fs.existsSync(absolute)) {
        reasons.push(
          reason(
            'blueprint_artifact_missing',
            'blueprint_approval',
            `${field} artifact is missing`,
            { field, actual: candidate },
          ),
        );
      }
    } catch (error) {
      reasons.push(
        reason(
          'path_invalid',
          'blueprint_approval',
          error instanceof Error ? error.message : String(error),
          { field, actual: candidate },
        ),
      );
    }
  }
  return reasons;
}

export function auditProductionStoryReadiness(args: {
  repoRoot: string;
  storyKey: string;
  storyPath: string;
  templatePath: string;
  styleId: string;
  styleAuthorityPath: string;
  reconciliationPath?: string;
  boardRegistryRoot?: string;
  blueprintArtifacts?: ProductionBlueprintArtifactPaths;
  throughStage?: ProductionLifecycleStage;
}): ProductionReadinessAudit {
  const throughStage = args.throughStage ?? 'package_assembly';
  const reasons: ProductionReadinessReason[] = [];
  let source: StorySourceIdentity | null = null;
  let template: BookVisualContractTemplate | null = null;
  let templateIdentity: VisualPackageTemplateIdentity | null = null;
  let styleAuthority: LoadedProductionStyleAuthority | null = null;
  let reconciliationDigest: string | null = null;
  let requiredSetIdentityIds: string[] = [];
  let resolvedBoards: VisualPackageBoardArtifactIdentity[] = [];
  let storyAbsolute: string | null = null;

  try {
    storyAbsolute = resolveRepoPath(args.repoRoot, args.storyPath);
    if (!fs.existsSync(storyAbsolute)) {
      reasons.push(
        reason(
          'source_missing',
          'source_authority',
          `Story Source is missing: ${args.storyPath}`,
        ),
      );
    } else {
      source = buildStorySourceIdentity({
        repoRoot: args.repoRoot,
        storyPath: args.storyPath,
      });
      if (
        source.pageCount < 1 ||
        source.pageNumbers.length !== source.pageCount ||
        new Set(source.pageNumbers).size !== source.pageNumbers.length
      ) {
        reasons.push(
          reason(
            'source_snapshot_incomplete',
            'source_authority',
            'Story Source snapshot has empty, duplicate, or inconsistent page identity',
            { actual: source },
          ),
        );
      }
    }
  } catch (error) {
    reasons.push(
      reason(
        'source_invalid',
        'source_authority',
        error instanceof Error ? error.message : String(error),
        { field: 'storyPath' },
      ),
    );
  }

  if (source) {
    try {
      resolveRepoPath(args.repoRoot, args.templatePath);
      const loaded = loadTemplateForPackage({
        repoRoot: args.repoRoot,
        templatePath: args.templatePath,
        storyKey: args.storyKey,
        source,
      });
      template = loaded.template;
      templateIdentity = loaded.identity;
      reasons.push(
        ...loaded.issues.map((issue) =>
          reason(
            issue.code.includes('digest') || issue.code.includes('schema')
              ? 'template_identity_stale'
              : issue.code === 'template_missing'
                ? 'template_missing'
                : 'template_invalid',
            'source_authority',
            `${issue.code}: ${issue.message}`,
            {
              field: issue.field,
              expected: issue.expected,
              actual: issue.actual,
            },
          ),
        ),
      );
      if (template) {
        reasons.push(...explicitAuthorityReasons({ source, template }));
        if (storyAbsolute) {
          reasons.push(
            ...storyCoverSourceFidelityIssues({
              storyPath: storyAbsolute,
              template,
            }).map((issue) =>
              reason(
                'cover_authority_incomplete',
                'source_authority',
                `${issue.code}: ${issue.message}`,
                {
                  field: issue.field,
                  expected: issue.expected,
                  actual: issue.actual,
                },
              ),
            ),
          );
        }
      }
    } catch (error) {
      reasons.push(
        reason(
          'path_invalid',
          'source_authority',
          error instanceof Error ? error.message : String(error),
          { field: 'templatePath' },
        ),
      );
    }
  }

  try {
    styleAuthority = loadProductionStyleAuthority({
      repoRoot: args.repoRoot,
      artifactPath: args.styleAuthorityPath,
      expectedStyleId: args.styleId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reasons.push(
      reason(
        /missing/i.test(message)
          ? 'style_authority_missing'
          : 'style_authority_invalid',
        'source_authority',
        message,
        { field: 'styleAuthorityPath' },
      ),
    );
  }

  if (
    STAGE_ORDER[throughStage] >= STAGE_ORDER.reconciliation_review &&
    source &&
    template &&
    templateIdentity &&
    storyAbsolute
  ) {
    if (!args.reconciliationPath) {
      reasons.push(
        reason(
          'reconciliation_missing',
          'reconciliation_review',
          'approved semantic reconciliation artifact is required',
          { field: 'reconciliationPath' },
        ),
      );
    } else {
      const coverAuthority = loadStoryAuthoredCoverAuthority({
        storyPath: storyAbsolute,
        template,
      });
      try {
        resolveRepoPath(args.repoRoot, args.reconciliationPath);
        const loaded = loadSourcePromptReconciliation({
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
        reconciliationDigest = loaded.identity?.digest ?? null;
        reasons.push(
          ...loaded.issues.map((issue) =>
            reason(
              issue.message.includes('human review')
                ? 'reconciliation_unapproved'
                : classifyReconciliationReason(issue.code),
              'reconciliation_review',
              `${issue.code}: ${issue.message}`,
              {
                field: issue.field,
                expected: issue.expected,
                actual: issue.actual,
              },
            ),
          ),
        );
      } catch (error) {
        reasons.push(
          reason(
            'path_invalid',
            'reconciliation_review',
            error instanceof Error ? error.message : String(error),
            { field: 'reconciliationPath' },
          ),
        );
      }
    }
  }

  if (
    STAGE_ORDER[throughStage] >= STAGE_ORDER.blueprint_approval
  ) {
    reasons.push(
      ...requiredBlueprintArtifactReasons(
        args.repoRoot,
        args.blueprintArtifacts,
      ),
    );
  }

  if (
    STAGE_ORDER[throughStage] >= STAGE_ORDER.board_compatibility &&
    template
  ) {
    try {
      requiredSetIdentityIds = listRequiredSetIdentityIds(
        template as unknown as BookVisualContract,
      );
      const boardResult = resolveRequiredBoardArtifacts({
        repoRoot: args.repoRoot,
        boardRegistryRoot:
          args.boardRegistryRoot ??
          resolveRepoPath(args.repoRoot, 'set-identity-boards'),
        template,
        styleId: args.styleId,
      });
      resolvedBoards = boardResult.boards;
      reasons.push(
        ...boardResult.issues.map((issue) =>
          reason(
            /approve/i.test(issue.message)
              ? 'board_unapproved'
              : /version|mismatch|changed|digest/i.test(issue.message)
                ? 'board_stale'
                : 'board_missing',
            'board_compatibility',
            `${issue.code}: ${issue.message}`,
            {
              field: issue.field,
              expected: issue.expected,
              actual: issue.actual,
            },
          ),
        ),
      );
    } catch (error) {
      reasons.push(
        reason(
          'set_authority_invalid',
          'board_compatibility',
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }

  const stableReasons = reasons
    .sort((left, right) => {
      const stage = STAGE_ORDER[left.stage] - STAGE_ORDER[right.stage];
      if (stage !== 0) return stage;
      const code = left.code.localeCompare(right.code);
      return code !== 0 ? code : left.message.localeCompare(right.message);
    })
    .filter(
      (candidate, index, all) =>
        index === 0 ||
        canonicalJsonDigest(candidate) !== canonicalJsonDigest(all[index - 1]),
    );
  const stageReadiness = Object.fromEntries(
    (Object.keys(STAGE_ORDER) as ProductionLifecycleStage[]).map((stage) => [
      stage,
      !stableReasons.some(
        (candidate) => STAGE_ORDER[candidate.stage] <= STAGE_ORDER[stage],
      ),
    ]),
  ) as Record<ProductionLifecycleStage, boolean>;
  const withoutDigest = {
    version: PRODUCTION_READINESS_AUDIT_VERSION,
    storyKey: args.storyKey,
    styleId: args.styleId,
    throughStage,
    ready: stageReadiness[throughStage],
    stageReadiness,
    source,
    templateIdentity,
    styleAuthority: styleAuthority?.identity ?? null,
    reconciliationDigest,
    requiredSetIdentityIds,
    resolvedBoards,
    reasons: stableReasons,
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(withoutDigest),
  };
}
