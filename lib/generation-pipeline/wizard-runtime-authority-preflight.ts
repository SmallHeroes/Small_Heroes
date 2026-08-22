import path from 'path';

import { STYLE_IDS } from '@/lib/styles';
import { computeVisualContractHash } from '@/lib/visual-contract-compiler/contractHash';
import { isVisualContractEnforcementEnabled } from '@/lib/visual-contract-compiler/contractRenderGuards';
import type { ResolvedFamilyAppearanceProfile } from '@/lib/visual-contract-compiler/contractTemplateTypes';
import { materialize } from '@/lib/visual-contract-compiler/materializeContract';
import { assertValidResolvedBookVisualContract } from '@/lib/visual-contract-compiler/validateResolvedContract';
import {
  assertBoardsBoundForRender,
  resolveBoardBindings,
  type BoardResolverDeps,
} from '@/lib/set-identity-board/resolveBoards';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';
import { bindApprovedPvbRuntimeAuthority } from '@/lib/visual-package/runtimeAuthority';
import { evaluateWizardVisualPackageSelection } from '@/lib/visual-package/wizardVisualPackageSelection';

import {
  requireStyle01RenderQualification,
  runAfterPageReferencePreflight,
} from './render-qualification-preflight';
import type { PipelineCache } from './types';

export const WIZARD_RUNTIME_AUTHORITY_PREFLIGHT_VERSION =
  'wizard-runtime-authority-preflight/v1' as const;

const PREFLIGHT_FAMILY: ResolvedFamilyAppearanceProfile = {
  skinTone: 'warm brown',
  hairColour: 'dark brown',
  hairTexture: 'wavy',
};

export type WizardRuntimeAuthorityPreflightFailureCode =
  | 'enforcement_disabled'
  | 'request_invalid'
  | 'visual_package_not_qualified'
  | 'contract_materialization_failed'
  | 'board_binding_failed'
  | 'reference_preflight_failed';

export class WizardRuntimeAuthorityPreflightError extends Error {
  constructor(
    readonly code: WizardRuntimeAuthorityPreflightFailureCode,
    readonly reasons: readonly string[] = [],
  ) {
    super(`Wizard runtime-authority preflight failed: ${code}`);
    this.name = 'WizardRuntimeAuthorityPreflightError';
  }
}

export interface WizardRuntimeAuthorityPreflightResult {
  version: typeof WIZARD_RUNTIME_AUTHORITY_PREFLIGHT_VERSION;
  status: 'passed';
  storyKey: string;
  styleId: typeof STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK;
  packageRevisionDigest: string;
  packageAuthorityDigest: string;
  sourceRawDigest: string;
  contractHash: string;
  blueprintDigest: string;
  checkedPageNumbers: number[];
  boardBindings: Array<{
    setIdentityId: string;
    setDefinitionHash: string;
    contentPolicyDigest: string;
    assetSha256: string;
  }>;
  effects: {
    databaseReads: 0;
    databaseWrites: 0;
    providerCalls: 0;
    imageWrites: 0;
    audioWrites: 0;
    retries: 0;
    fallback: false;
    storageReads: number;
  };
}

export interface WizardRuntimeAuthorityPreflightDeps {
  boardResolverDeps: BoardResolverDeps;
}

function validStoryKey(value: string): boolean {
  return /^[a-z0-9][a-z0-9_]{1,127}$/.test(value);
}

export function wizardRuntimeAuthorityPreflightRequestIsValid(args: {
  repoRoot: string;
  storyKey: string;
  styleId: string;
}): boolean {
  return (
    path.isAbsolute(args.repoRoot) &&
    validStoryKey(args.storyKey) &&
    args.styleId === STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK
  );
}

function fail(
  code: WizardRuntimeAuthorityPreflightFailureCode,
  error?: unknown,
): never {
  const reasons =
    error instanceof WizardRuntimeAuthorityPreflightError
      ? [...error.reasons]
      : error instanceof Error
        ? [error.message]
        : error == null
          ? []
          : [String(error)];
  throw new WizardRuntimeAuthorityPreflightError(code, reasons);
}

/**
 * Read-only provider-adjacent proof for the deployed Wizard authority chain.
 *
 * It intentionally creates no Order and accepts no child data. The fixed,
 * synthetic family projection exists only to materialize the approved template
 * into a complete resolved contract. The same immutable package, contract,
 * Board-byte and page-reference gates used by the paid Style 01 path run before
 * this function returns. No provider callback exists in this module.
 */
export async function runWizardRuntimeAuthorityPreflight(
  args: {
    repoRoot: string;
    storyKey: string;
    styleId: string;
  },
  deps: WizardRuntimeAuthorityPreflightDeps,
): Promise<WizardRuntimeAuthorityPreflightResult> {
  if (!isVisualContractEnforcementEnabled()) {
    fail('enforcement_disabled');
  }
  if (!wizardRuntimeAuthorityPreflightRequestIsValid(args)) {
    fail('request_invalid');
  }

  const selection = evaluateWizardVisualPackageSelection({
    repoRoot: args.repoRoot,
    storyKey: args.storyKey,
    styleId: args.styleId,
  });
  if (
    !selection.renderQualified ||
    !selection.packageValue ||
    !selection.frozenAuthority ||
    !selection.sourceRawDigest ||
    !selection.pageCount
  ) {
    throw new WizardRuntimeAuthorityPreflightError(
      'visual_package_not_qualified',
      selection.reasons,
    );
  }

  const packageValue = selection.packageValue;
  const frozenAuthority = selection.frozenAuthority;
  let contract;
  try {
    contract = bindApprovedPvbRuntimeAuthority(
      materialize(
        structuredClone(packageValue.visualContractTemplate.content),
        PREFLIGHT_FAMILY,
      ),
      packageValue,
      frozenAuthority,
    );
    assertValidResolvedBookVisualContract(contract);
  } catch (error) {
    fail('contract_materialization_failed', error);
  }

  const contractHash = computeVisualContractHash(contract);
  let setIdentityBoards;
  const boardResolverDeps = deps.boardResolverDeps;
  try {
    setIdentityBoards = await resolveBoardBindings(
      {
        contract,
        styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
        frozenContractHash: contractHash,
      },
      boardResolverDeps,
    );
    await assertBoardsBoundForRender(
      {
        contract,
        cache: { setIdentityBoards },
        styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
        activeFrozenContractHash: contractHash,
      },
      boardResolverDeps,
    );
  } catch (error) {
    fail('board_binding_failed', error);
  }

  const checkedPageNumbers = Array.from(
    { length: selection.pageCount + 1 },
    (_, index) => index,
  );
  try {
    const authority = requireStyle01RenderQualification({
      illustrationStyle: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      frozenContractHash: contractHash,
      storySourceHash: selection.sourceRawDigest,
      cache: {
        selectionFilename: `${args.storyKey}.md`,
        visualPackageAuthority: frozenAuthority,
        visualContract: contract as unknown as PipelineCache['visualContract'],
        setIdentityBoards,
      },
      repoRoot: args.repoRoot,
      pageNumbers: checkedPageNumbers,
    });
    if (!authority) fail('reference_preflight_failed');
    await runAfterPageReferencePreflight(
      authority,
      checkedPageNumbers,
      async () => undefined,
    );
  } catch (error) {
    fail('reference_preflight_failed', error);
  }

  const boardBindings = Object.values(setIdentityBoards.bindings)
    .map((binding) => ({
      setIdentityId: binding.setIdentityId,
      setDefinitionHash: binding.setDefinitionHash,
      contentPolicyDigest: binding.contentPolicyDigest,
      assetSha256: binding.assetSha256,
    }))
    .sort((left, right) =>
      left.setIdentityId.localeCompare(right.setIdentityId),
    );

  return {
    version: WIZARD_RUNTIME_AUTHORITY_PREFLIGHT_VERSION,
    status: 'passed',
    storyKey: args.storyKey,
    styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    packageRevisionDigest: packageValue.revisionDigest,
    packageAuthorityDigest: canonicalJsonDigest(frozenAuthority),
    sourceRawDigest: selection.sourceRawDigest,
    contractHash,
    blueprintDigest: packageValue.blueprint.digest,
    checkedPageNumbers,
    boardBindings,
    effects: {
      databaseReads: 0,
      databaseWrites: 0,
      providerCalls: 0,
      imageWrites: 0,
      audioWrites: 0,
      retries: 0,
      fallback: false,
      storageReads: boardBindings.length * 2,
    },
  };
}
