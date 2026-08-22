import { STYLE_IDS, normalizeStyleId } from '@/lib/styles';
import { computeVisualContractHash } from '@/lib/visual-contract-compiler/contractHash';
import { isVisualContractEnforcementEnabled } from '@/lib/visual-contract-compiler/contractRenderGuards';
import { readFrozenVisualContract } from '@/lib/visual-contract-compiler/readFrozenVisualContract';
import type {
  ApprovedPvbRuntimeAuthorityBinding,
  BookVisualContractTemplate,
  ResolvedBookVisualContract,
} from '@/lib/visual-contract-compiler/contractTemplateTypes';
import type { SetIdentityBoardBindingContext } from '@/lib/set-identity-board/types';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';
import {
  evaluateVisualPackageV4Qualification,
  type FrozenVisualPackageAuthority,
  type VisualPackageV4,
} from '@/lib/visual-package/visualPackageV4';
import {
  buildApprovedPvbRuntimeAuthorityBinding,
  runtimeWorldProjectionDigest,
} from '@/lib/visual-package/runtimeAuthority';
import type { VisualPackageIssue } from '@/lib/visual-package/types';

import {
  buildRuntimeBlueprintBookProjection,
  type RuntimeBlueprintBookProjection,
} from './runtime-blueprint-projection';
import { resolvePageReferenceAssets } from './page-reference-authority';
import { runtimeStoryKey } from './story-path';
import type { PipelineCache } from './types';

export interface Style01PvbQualification {
  storyKey: string;
  styleId: string;
  approvedPackagePath: string;
  renderQualified: boolean;
  reasons: VisualPackageIssue[];
  packageValue: VisualPackageV4 | null;
  template: BookVisualContractTemplate | null;
  frozenAuthority: FrozenVisualPackageAuthority | null;
}

export class RenderQualificationPreflightError extends Error {
  readonly isRenderQualificationPreflightError = true as const;

  constructor(readonly qualification: Style01PvbQualification) {
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
  /** Exact raw Story Source snapshot digest frozen on Order. */
  storySourceHash?: string | null;
  cache: Pick<
    PipelineCache,
    | 'devStoryBankFile'
    | 'storyFilePath'
    | 'storyDir'
    | 'storyKey'
    | 'storySourceAuthorityKind'
    | 'selectionFilename'
    | 'visualContract'
    | 'visualPackageAuthority'
    | 'setIdentityBoards'
  >;
  repoRoot?: string;
  approvedPackagesDir?: string;
  boardRegistryRoot?: string;
  /** Exact cover/page set that the callback will render. Page 0 denotes the cover. */
  pageNumbers?: number[];
}

export interface Style01RuntimeAuthority {
  version: 'style01-runtime-authority/v6';
  repoRoot: string;
  qualification: Style01PvbQualification;
  packageValue: VisualPackageV4;
  frozenAuthority: FrozenVisualPackageAuthority;
  contract: ResolvedBookVisualContract;
  contractHash: string;
  packageBinding: ApprovedPvbRuntimeAuthorityBinding;
  bookProjection: RuntimeBlueprintBookProjection;
  boardBindings?: SetIdentityBoardBindingContext;
}

function issue(
  code: VisualPackageIssue['code'],
  message: string,
  extra: Omit<VisualPackageIssue, 'code' | 'message'> = {},
): VisualPackageIssue {
  return { code, message, ...extra };
}

function rejected(args: {
  storyKey: string;
  styleId: string;
  packagePath?: string | null;
  reasons: VisualPackageIssue[];
}): Style01PvbQualification {
  return {
    storyKey: args.storyKey,
    styleId: args.styleId,
    approvedPackagePath: args.packagePath ?? 'unknown',
    renderQualified: false,
    reasons: args.reasons,
    packageValue: null,
    template: null,
    frozenAuthority: null,
  };
}

/**
 * Render-time qualification never consults a mutable current locator. Fresh selection belongs to the freeze stage;
 * every cover/page/resume/regeneration call must load only the exact immutable revision already frozen on the order.
 */
export function evaluateStyle01VisualPackage(
  args: RenderQualificationPreflightArgs,
): Style01PvbQualification | null {
  if (!isVisualContractEnforcementEnabled()) return null;
  const styleId = normalizeStyleId(args.illustrationStyle);
  if (styleId !== STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK) return null;
  const storyKey = runtimeStoryKey(args.cache) ?? 'unknown_story';
  const frozen = args.cache.visualPackageAuthority;
  if (!frozen) {
    return rejected({
      storyKey,
      styleId,
      reasons: [
        issue(
          'frozen_authority_missing',
          'pipelineCache.visualPackageAuthority is missing; visual-package/v3 and current-locator fallback are forbidden',
        ),
      ],
    });
  }
  const qualification = evaluateVisualPackageV4Qualification({
    repoRoot: args.repoRoot ?? process.cwd(),
    storyKey,
    styleId,
    frozenAuthority: frozen,
    expectedOrderSourceRawDigest: args.storySourceHash,
  });
  const reasons = qualification.reasons.map((message) =>
    issue('frozen_authority_mismatch', message),
  );
  return {
    storyKey,
    styleId,
    approvedPackagePath: qualification.packagePath ?? frozen.packagePath,
    renderQualified: qualification.renderQualified && reasons.length === 0,
    reasons,
    packageValue: qualification.packageValue,
    template:
      qualification.packageValue?.visualContractTemplate.content ?? null,
    frozenAuthority: qualification.frozenAuthority,
  };
}

function rejectMore(
  qualification: Style01PvbQualification,
  reasons: VisualPackageIssue[],
): never {
  throw new RenderQualificationPreflightError({
    ...qualification,
    renderQualified: false,
    reasons: [...qualification.reasons, ...reasons],
  });
}

function requireFrozenAuthority(
  qualification: Style01PvbQualification,
  args: RenderQualificationPreflightArgs,
): Style01RuntimeAuthority {
  const packageValue = qualification.packageValue;
  const frozenAuthority = qualification.frozenAuthority;
  const frozen = readFrozenVisualContract(args.cache.visualContract);
  if (
    !packageValue ||
    !frozenAuthority ||
    !frozen ||
    (frozen as { contractKind?: unknown }).contractKind !== 'resolved'
  ) {
    rejectMore(qualification, [
      issue(
        'frozen_authority_missing',
        'exact v4 package and resolved frozen contract are both required',
      ),
    ]);
  }
  const contract = frozen as ResolvedBookVisualContract;
  const binding = buildApprovedPvbRuntimeAuthorityBinding({
    packageValue,
    frozen: frozenAuthority,
  });
  const reasons: VisualPackageIssue[] = [];
  if (
    canonicalJsonDigest(contract.approvedRuntimeAuthority) !==
    canonicalJsonDigest(binding)
  ) {
    reasons.push(
      issue(
        'frozen_authority_mismatch',
        'resolved contract is not bound to the exact immutable v4 package',
      ),
    );
  }
  if (
    runtimeWorldProjectionDigest(contract) !==
    runtimeWorldProjectionDigest(packageValue.blueprint.content.visualContract)
  ) {
    reasons.push(
      issue(
        'frozen_authority_mismatch',
        'resolved contract physical-world projection differs from the Blueprint',
      ),
    );
  }
  const contractHash = computeVisualContractHash(contract);
  if (!args.frozenContractHash?.trim()) {
    reasons.push(
      issue(
        'frozen_authority_missing',
        'Order.visualContractHash is missing',
      ),
    );
  } else if (args.frozenContractHash !== contractHash) {
    reasons.push(
      issue(
        'frozen_authority_mismatch',
        'Order.visualContractHash differs from the resolved contract',
      ),
    );
  }
  const boardContext = args.cache.setIdentityBoards;
  const requiredBoards = packageValue.requiredBoards;
  if (requiredBoards.length > 0) {
    if (
      !boardContext ||
      boardContext.mode !== 'required-v2' ||
      boardContext.frozenContractHash !== contractHash
    ) {
      reasons.push(
        issue(
          'board_binding_missing',
          'approved package Board bindings are missing or pinned to another contract',
        ),
      );
    } else {
      const expectedIds = new Set(
        requiredBoards.map((entry) => entry.setIdentityId),
      );
      const actualIds = Object.keys(boardContext.bindings);
      if (
        actualIds.length !== expectedIds.size ||
        actualIds.some((entry) => !expectedIds.has(entry))
      ) {
        reasons.push(
          issue(
            'board_binding_mismatch',
            'runtime Board identity set differs from the immutable package',
          ),
        );
      }
      for (const approved of requiredBoards) {
        const bound = boardContext.bindings[approved.setIdentityId];
        if (
          !bound ||
          bound.setDefinitionHash !== approved.setDefinitionHash ||
          bound.contentPolicyDigest !== approved.contentPolicyDigest ||
          bound.styleId !== approved.styleId ||
          bound.storageKey !== approved.storageKey ||
          bound.assetSha256 !== approved.assetSha256 ||
          bound.boardVersion !== approved.boardVersion ||
          canonicalJsonDigest(bound.declaredPropIds) !==
            canonicalJsonDigest(approved.declaredPropIds) ||
          bound.approvedAt !== approved.approvedAt ||
          !bound.resolvedUrl?.trim()
        ) {
          reasons.push(
            issue(
              'board_binding_mismatch',
              `runtime Board binding differs for ${approved.setIdentityId}`,
            ),
          );
        }
      }
    }
  }
  if (reasons.length > 0) rejectMore(qualification, reasons);
  const bookProjection = buildRuntimeBlueprintBookProjection({
    packageValue,
    frozenAuthority,
    contract,
  });
  return {
    version: 'style01-runtime-authority/v6',
    repoRoot: args.repoRoot ?? process.cwd(),
    qualification,
    packageValue,
    frozenAuthority,
    contract,
    contractHash,
    packageBinding: binding,
    bookProjection,
    ...(boardContext ? { boardBindings: boardContext } : {}),
  };
}

export function requireStyle01RenderQualification(
  args: RenderQualificationPreflightArgs,
): Style01RuntimeAuthority | null {
  const qualification = evaluateStyle01VisualPackage(args);
  if (!qualification) return null;
  if (!qualification.renderQualified) {
    throw new RenderQualificationPreflightError(qualification);
  }
  return requireFrozenAuthority(qualification, args);
}

type PageReferencePreflightAuthority = Pick<
  Style01RuntimeAuthority,
  'repoRoot' | 'contract' | 'boardBindings' | 'packageValue'
>;

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
        propArtifacts: authority.packageValue.requiredPropReferences,
      });
    }
  }
  return render(authority);
}

export async function runWithStyle01RenderQualification<T>(
  args: RenderQualificationPreflightArgs,
  render: (authority: Style01RuntimeAuthority | null) => Promise<T>,
): Promise<T> {
  const authority = requireStyle01RenderQualification(args);
  return runAfterPageReferencePreflight(
    authority,
    args.pageNumbers ?? [],
    render,
  );
}
