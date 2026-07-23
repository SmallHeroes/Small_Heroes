import path from 'path';

import { STYLE_IDS, normalizeStyleId } from '@/lib/styles';
import { computeVisualContractHash } from '@/lib/visual-contract-compiler/contractHash';
import { isVisualContractEnforcementEnabled } from '@/lib/visual-contract-compiler/contractRenderGuards';
import { readFrozenVisualContract } from '@/lib/visual-contract-compiler/readFrozenVisualContract';
import type {
  ApprovedRuntimeAuthorityBinding,
  ResolvedBookVisualContract,
} from '@/lib/visual-contract-compiler/contractTemplateTypes';
import type { SetIdentityBoardBindingContext } from '@/lib/set-identity-board/types';
import {
  evaluateRenderQualification,
  type RenderQualificationResult,
} from '@/lib/visual-package/qualification';
import {
  buildApprovedRuntimeAuthorityBinding,
  runtimeWorldProjectionDigest,
} from '@/lib/visual-package/runtimeAuthority';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';
import type { VisualPackageIssue } from '@/lib/visual-package/types';

import { resolvePageReferenceAssets } from './page-reference-authority';
import { resolveCachedStoryFilePath } from './story-path';
import type { PipelineCache } from './types';

export class RenderQualificationPreflightError extends Error {
  readonly isRenderQualificationPreflightError = true as const;

  constructor(readonly qualification: RenderQualificationResult) {
    super(
      `[render_qualification] ${qualification.storyKey} blocked before image provider: ` +
        qualification.reasons.map((reason) => reason.code).join(', '),
    );
    this.name = 'RenderQualificationPreflightError';
  }
}

export interface RenderQualificationPreflightArgs {
  illustrationStyle?: string | null;
  /** Persisted Order.visualContractHash. Required and exact on the enforced shipped path. */
  frozenContractHash?: string | null;
  cache: Pick<
    PipelineCache,
    | 'devStoryBankFile'
    | 'storyFilePath'
    | 'storyDir'
    | 'selectionFilename'
    | 'visualContract'
    | 'setIdentityBoards'
  >;
  repoRoot?: string;
  approvedPackagesDir?: string;
  boardRegistryRoot?: string;
  /** Exact cover/page set that the callback will render. Page 0 denotes the cover. */
  pageNumbers?: number[];
}

export interface Style01RuntimeAuthority {
  version: 'style01-runtime-authority/v3';
  repoRoot: string;
  qualification: RenderQualificationResult;
  contract: ResolvedBookVisualContract;
  contractHash: string;
  packageBinding: ApprovedRuntimeAuthorityBinding;
  boardBindings?: SetIdentityBoardBindingContext;
}

/** Resolve and validate the exact reviewer-approved local package without consulting runtime contract state. */
export function evaluateStyle01VisualPackage(
  args: RenderQualificationPreflightArgs,
): RenderQualificationResult | null {
  if (!isVisualContractEnforcementEnabled()) return null;
  if (normalizeStyleId(args.illustrationStyle) !== STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK) return null;

  const repoRoot = args.repoRoot ?? process.cwd();
  const storyPath = resolveCachedStoryFilePath(args.cache);
  const storyKey = (args.cache.selectionFilename
    ? path.basename(args.cache.selectionFilename, '.md')
    : storyPath
      ? path.basename(storyPath, '.md')
      : 'unknown_story');
  return evaluateRenderQualification({
    repoRoot,
    storyKey,
    storyPath: storyPath ?? path.join(repoRoot, 'story-bank', '__missing_story__.md'),
    styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    approvedPackagesDir: args.approvedPackagesDir,
    boardRegistryRoot: args.boardRegistryRoot,
  });
}

function issue(
  code: VisualPackageIssue['code'],
  message: string,
  extra: Omit<VisualPackageIssue, 'code' | 'message'> = {},
): VisualPackageIssue {
  return { code, message, ...extra };
}

function rejectedQualification(
  qualification: RenderQualificationResult,
  reasons: VisualPackageIssue[],
): RenderQualificationResult {
  return { ...qualification, renderQualified: false, reasons: [...qualification.reasons, ...reasons] };
}

function requireFrozenAuthority(
  qualification: RenderQualificationResult,
  cache: RenderQualificationPreflightArgs['cache'],
  frozenContractHash: string | null | undefined,
  repoRoot: string,
): Style01RuntimeAuthority {
  const reasons: VisualPackageIssue[] = [];
  const manifest = qualification.manifest;
  const template = qualification.template;
  const frozen = readFrozenVisualContract(cache.visualContract);
  if (!manifest || !template) {
    throw new RenderQualificationPreflightError(
      rejectedQualification(qualification, [issue('frozen_authority_missing', 'qualified manifest/template is unavailable')]),
    );
  }
  if (!frozen || (frozen as { contractKind?: unknown }).contractKind !== 'resolved') {
    throw new RenderQualificationPreflightError(
      rejectedQualification(qualification, [
        issue('frozen_authority_missing', 'the exact approved package is not materialized as a resolved frozen contract'),
      ]),
    );
  }
  const contract = frozen as ResolvedBookVisualContract;
  const expectedBinding = buildApprovedRuntimeAuthorityBinding(manifest);
  if (canonicalJsonDigest(contract.approvedRuntimeAuthority) !== canonicalJsonDigest(expectedBinding)) {
    reasons.push(issue('frozen_authority_mismatch', 'frozen contract is not bound to the current approved package', {
      field: 'pipelineCache.visualContract.approvedRuntimeAuthority',
      expected: expectedBinding,
      actual: contract.approvedRuntimeAuthority ?? null,
    }));
  }
  if (runtimeWorldProjectionDigest(contract) !== runtimeWorldProjectionDigest(template)) {
    reasons.push(issue('frozen_authority_mismatch', 'frozen physical-world contract differs from the approved template', {
      field: 'pipelineCache.visualContract',
    }));
  }

  const contractHash = computeVisualContractHash(contract);
  if (!frozenContractHash?.trim()) {
    reasons.push(issue('frozen_authority_missing', 'Order.visualContractHash is missing for the frozen contract'));
  } else if (frozenContractHash !== contractHash) {
    reasons.push(issue('frozen_authority_mismatch', 'Order.visualContractHash differs from the frozen contract', {
      field: 'Order.visualContractHash',
      expected: contractHash,
      actual: frozenContractHash,
    }));
  }
  const requiredBoards = manifest.requiredBoards;
  const boardContext = cache.setIdentityBoards;
  if (requiredBoards.length > 0) {
    if (!boardContext || boardContext.mode !== 'required-v2') {
      reasons.push(issue('board_binding_missing', 'approved package requires Set Identity Board bindings but the order has none'));
    } else {
      if (boardContext.frozenContractHash !== contractHash) {
        reasons.push(issue('board_binding_mismatch', 'board bindings are pinned to a different frozen contract', {
          expected: contractHash,
          actual: boardContext.frozenContractHash,
        }));
      }
      const expectedIds = new Set(requiredBoards.map((board) => board.setIdentityId));
      const actualIds = Object.keys(boardContext.bindings);
      if (actualIds.length !== expectedIds.size || actualIds.some((setIdentityId) => !expectedIds.has(setIdentityId))) {
        reasons.push(issue('board_binding_mismatch', 'board binding identity set differs from the approved package', {
          expected: [...expectedIds].sort(),
          actual: actualIds.sort(),
        }));
      }
      for (const approved of requiredBoards) {
        const bound = boardContext.bindings[approved.setIdentityId];
        if (!bound) continue;
        if (
          bound.setIdentityId !== approved.setIdentityId ||
          bound.setDefinitionHash !== approved.setDefinitionHash ||
          bound.styleId !== approved.styleId ||
          bound.storageKey !== approved.storageKey ||
          bound.assetSha256 !== approved.assetSha256 ||
          bound.boardVersion !== approved.boardVersion ||
          bound.contentPolicyDigest !== approved.contentPolicyDigest ||
          canonicalJsonDigest(bound.declaredPropIds) !== canonicalJsonDigest(approved.declaredPropIds) ||
          bound.approvedAt !== approved.approvedAt ||
          !bound.resolvedUrl?.trim()
        ) {
          reasons.push(issue('board_binding_mismatch', `runtime board binding differs from approved artifact ${approved.setIdentityId}`, {
            expected: approved,
            actual: bound,
          }));
        }
      }
    }
  }

  if (reasons.length > 0) {
    throw new RenderQualificationPreflightError(rejectedQualification(qualification, reasons));
  }
  return {
    version: 'style01-runtime-authority/v3',
    repoRoot,
    qualification,
    contract,
    contractHash,
    packageBinding: expectedBinding,
    ...(boardContext ? { boardBindings: boardContext } : {}),
  };
}

/**
 * Shipped Style01 pre-image guard. It is coupled to the existing visual-contract enforcement boundary, which is
 * explicitly opt-in outside production and hard-false on Vercel production. Enforcement off therefore preserves
 * the documented legacy path; enforcement on requires a complete current approved package before invoking render.
 */
export function requireStyle01RenderQualification(
  args: RenderQualificationPreflightArgs,
): Style01RuntimeAuthority | null {
  const qualification = evaluateStyle01VisualPackage(args);
  if (!qualification) return null;
  if (!qualification.renderQualified) throw new RenderQualificationPreflightError(qualification);
  return requireFrozenAuthority(
    qualification,
    args.cache,
    args.frozenContractHash,
    args.repoRoot ?? process.cwd(),
  );
}

type PageReferencePreflightAuthority = Pick<
  Style01RuntimeAuthority,
  'repoRoot' | 'contract' | 'boardBindings' | 'qualification'
>;

/** Page/content fence shared by cover, batch/resume, and single-page callers before their callback is reachable. */
export async function runAfterPageReferencePreflight<
  T,
  TAuthority extends PageReferencePreflightAuthority | null,
>(
  authority: TAuthority,
  pageNumbers: readonly number[],
  render: (checkedAuthority: TAuthority) => Promise<T>,
): Promise<T> {
  if (authority) {
    for (const pageNumber of pageNumbers) {
      resolvePageReferenceAssets({
        repoRoot: authority.repoRoot,
        contract: authority.contract,
        pageNumber,
        boardBindings: authority.boardBindings,
        propArtifacts: authority.qualification.manifest?.requiredPropReferences ?? [],
      });
    }
  }
  return render(authority);
}

/** Actual shipped call wrapper: the render callback is unreachable until the synchronous preflight succeeds. */
export async function runWithStyle01RenderQualification<T>(
  args: RenderQualificationPreflightArgs,
  render: (authority: Style01RuntimeAuthority | null) => Promise<T>,
): Promise<T> {
  const authority = requireStyle01RenderQualification(args);
  return runAfterPageReferencePreflight(authority, args.pageNumbers ?? [], render);
}
