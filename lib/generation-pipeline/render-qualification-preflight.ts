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
import {
  runtimeStoryKey,
  storyRefClaimsAcceptedRevisionNamespace,
} from './story-path';
import type { PipelineCache } from './types';
import {
  OrderVisualPackageAuthorityError,
  orderRequiresVisualPackageAuthority,
  requireOrderVisualPackageAuthority,
  type OrderVisualPackageAuthorityInput,
} from './order-visual-package-authority';

export interface Style01PvbQualification {
  storyKey: string;
  styleId: string;
  approvedPackagePath: string;
  renderQualified: boolean;
  reasons: VisualPackageIssue[];
  packageValue: VisualPackageV4 | null;
  template: BookVisualContractTemplate | null;
  frozenAuthority: FrozenVisualPackageAuthority | null;
  orderVisualPackageAuthorityRequired: boolean;
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
  /** Durable Order authority. Required whenever cache/origin claims an accepted revision. */
  order?: OrderVisualPackageAuthorityInput;
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
  version: 'style01-runtime-authority/v7';
  repoRoot: string;
  qualification: Style01PvbQualification;
  packageValue: VisualPackageV4;
  frozenAuthority: FrozenVisualPackageAuthority;
  contract: ResolvedBookVisualContract;
  contractHash: string;
  packageBinding: ApprovedPvbRuntimeAuthorityBinding;
  bookProjection: RuntimeBlueprintBookProjection;
  boardBindings?: SetIdentityBoardBindingContext;
  orderVisualPackageAuthorityRequired: boolean;
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
  orderVisualPackageAuthorityRequired?: boolean;
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
    orderVisualPackageAuthorityRequired:
      args.orderVisualPackageAuthorityRequired ?? false,
  };
}

function cacheClaimsAcceptedRevision(
  cache: RenderQualificationPreflightArgs['cache'],
): boolean {
  if (cache.storySourceAuthorityKind === 'product_accepted_revision') return true;
  return [cache.storyFilePath, cache.devStoryBankFile].some((value) =>
    storyRefClaimsAcceptedRevisionNamespace(value),
  );
}

/**
 * Render-time qualification never consults a mutable current locator. Fresh selection belongs to the freeze stage;
 * every cover/page/resume/regeneration call must load only the exact immutable revision already frozen on the order.
 */
export function evaluateStyle01VisualPackage(
  args: RenderQualificationPreflightArgs,
): Style01PvbQualification | null {
  const styleId = normalizeStyleId(args.illustrationStyle);
  const storyKey = runtimeStoryKey(args.cache) ?? 'unknown_story';
  let orderFrozenAuthority: FrozenVisualPackageAuthority | null = null;
  let orderVisualPackageAuthorityRequired = false;
  try {
    if (args.order) {
      orderVisualPackageAuthorityRequired =
        orderRequiresVisualPackageAuthority(args.order);
      orderFrozenAuthority = requireOrderVisualPackageAuthority(args.order);
    } else if (cacheClaimsAcceptedRevision(args.cache)) {
      return rejected({
        storyKey,
        styleId,
        orderVisualPackageAuthorityRequired: true,
        reasons: [
          issue(
            'frozen_authority_missing',
            'accepted-revision cache has no durable Order Visual Package authority input',
          ),
        ],
      });
    }
  } catch (error) {
    return rejected({
      storyKey,
      styleId,
      orderVisualPackageAuthorityRequired: true,
      reasons: [
        issue(
          'frozen_authority_mismatch',
          error instanceof OrderVisualPackageAuthorityError
            ? error.message
            : error instanceof Error
              ? error.message
              : String(error),
        ),
      ],
    });
  }
  if (
    !orderVisualPackageAuthorityRequired &&
    !isVisualContractEnforcementEnabled()
  ) {
    return null;
  }
  if (styleId !== STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK) {
    if (!orderVisualPackageAuthorityRequired) return null;
    return rejected({
      storyKey,
      styleId,
      orderVisualPackageAuthorityRequired: true,
      reasons: [
        issue(
          'frozen_authority_mismatch',
          `package-backed Order style ${JSON.stringify(styleId)} has no runtime authority implementation`,
        ),
      ],
    });
  }
  const frozen = orderFrozenAuthority ?? args.cache.visualPackageAuthority;
  if (!frozen) {
    return rejected({
      storyKey,
      styleId,
      orderVisualPackageAuthorityRequired,
      reasons: [
        issue(
          'frozen_authority_missing',
          'pipelineCache.visualPackageAuthority is missing; visual-package/v3 and current-locator fallback are forbidden',
        ),
      ],
    });
  }
  if (
    orderFrozenAuthority &&
    (!args.cache.visualPackageAuthority ||
      canonicalJsonDigest(args.cache.visualPackageAuthority) !==
        canonicalJsonDigest(orderFrozenAuthority))
  ) {
    return rejected({
      storyKey,
      styleId,
      orderVisualPackageAuthorityRequired: true,
      reasons: [
        issue(
          'frozen_authority_mismatch',
          'pipeline cache Visual Package authority differs from frozen Order authority',
        ),
      ],
    });
  }
  const qualification = evaluateVisualPackageV4Qualification({
    repoRoot: args.repoRoot ?? process.cwd(),
    storyKey,
    styleId,
    frozenAuthority: frozen,
    expectedOrderSourceRawDigest:
      args.order?.storySourceHash ?? args.storySourceHash,
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
    orderVisualPackageAuthorityRequired,
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
    version: 'style01-runtime-authority/v7',
    repoRoot: args.repoRoot ?? process.cwd(),
    qualification,
    packageValue,
    frozenAuthority,
    contract,
    contractHash,
    packageBinding: binding,
    bookProjection,
    ...(boardContext ? { boardBindings: boardContext } : {}),
    orderVisualPackageAuthorityRequired:
      qualification.orderVisualPackageAuthorityRequired,
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
