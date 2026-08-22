import 'server-only';

import path from 'path';

import {
  createPreflightBoardResolverDeps,
  proveStagingCredential,
  type StagingCredentialProofResult,
} from '@/lib/generation-chunked/supabase-staging-read-authority';
import type { SupabaseServiceRoleAuthorityStatus } from '@/lib/generation-chunked/supabase-service-role-authority';
import { STYLE_IDS } from '@/lib/styles';

import {
  runWizardRuntimeAuthorityPreflight,
  WizardRuntimeAuthorityPreflightError,
  wizardRuntimeAuthorityPreflightRequestIsValid,
  type WizardRuntimeAuthorityPreflightResult,
} from './wizard-runtime-authority-preflight';
import {
  buildWizardPreviewEnvironmentPreflight,
  WIZARD_PREVIEW_ENVIRONMENT_REASON_VALUES,
  WIZARD_PREVIEW_STAGING_SUPABASE_REF,
  type WizardPreviewEnvironmentPreflight,
  type WizardPreviewEnvironmentReason,
} from './wizard-preview-environment-preflight';

export const WIZARD_PREORDER_ATTESTATION_VERSION =
  'wizard-preorder-attestation/v1' as const;

export const WIZARD_PREORDER_ATTESTATION_REASON_VALUES = [
  ...WIZARD_PREVIEW_ENVIRONMENT_REASON_VALUES,
  'request_invalid',
  'supabase_service_role_proof_failed',
  'runtime_authority_failed',
] as const;

export type WizardPreorderAttestationReason =
  (typeof WIZARD_PREORDER_ATTESTATION_REASON_VALUES)[number];

type CredentialProofDisposition =
  | 'not_attempted'
  | 'not_required'
  | StagingCredentialProofResult['status'];

type RuntimeAuthorityDisposition =
  | { status: 'not_evaluated' }
  | WizardRuntimeAuthorityPreflightResult
  | {
      version: 'wizard-runtime-authority-preflight/v1';
      status: 'failed';
      code: WizardRuntimeAuthorityPreflightError['code'];
    };

export interface WizardPreorderAttestation {
  version: typeof WIZARD_PREORDER_ATTESTATION_VERSION;
  status: 'passed' | 'failed';
  reasons: WizardPreorderAttestationReason[];
  deployment: {
    gitCommitSha: string | null;
    deploymentId: string | null;
  };
  environment: WizardPreviewEnvironmentPreflight;
  credential: {
    mode: SupabaseServiceRoleAuthorityStatus;
    proof: CredentialProofDisposition;
  };
  runtimeAuthority: RuntimeAuthorityDisposition;
  effects: {
    databaseReads: 0;
    databaseWrites: 0;
    storageReads: number;
    providerCalls: 0;
    imageWrites: 0;
    audioWrites: 0;
    retries: 0;
    fallback: false;
  };
}

export interface WizardPreorderAttestationDeps {
  proveCredential?: () => Promise<StagingCredentialProofResult>;
  runRuntimeAuthority?: () => Promise<WizardRuntimeAuthorityPreflightResult>;
}

function safeDeploymentIdentity(source: NodeJS.ProcessEnv): {
  gitCommitSha: string | null;
  deploymentId: string | null;
} {
  const gitCommitSha = source.VERCEL_GIT_COMMIT_SHA?.trim() ?? '';
  const deploymentId = source.VERCEL_DEPLOYMENT_ID?.trim() ?? '';
  return {
    gitCommitSha: /^[a-f0-9]{40}$/u.test(gitCommitSha)
      ? gitCommitSha
      : null,
    deploymentId: /^dpl_[A-Za-z0-9]+$/u.test(deploymentId)
      ? deploymentId
      : null,
  };
}

function hardEnvironmentReasons(
  reasons: readonly WizardPreviewEnvironmentReason[],
): WizardPreviewEnvironmentReason[] {
  return reasons.filter(
    (reason) => reason !== 'supabase_service_role_proof_required',
  );
}

function result(args: {
  source: NodeJS.ProcessEnv;
  environment: WizardPreviewEnvironmentPreflight;
  status: 'passed' | 'failed';
  reasons: WizardPreorderAttestationReason[];
  proof: CredentialProofDisposition;
  proofStorageReads: number;
  runtimeAuthority: RuntimeAuthorityDisposition;
}): WizardPreorderAttestation {
  const runtimeStorageReads =
    args.runtimeAuthority.status === 'passed'
      ? args.runtimeAuthority.effects.storageReads
      : 0;
  return {
    version: WIZARD_PREORDER_ATTESTATION_VERSION,
    status: args.status,
    reasons: args.reasons,
    deployment: safeDeploymentIdentity(args.source),
    environment: args.environment,
    credential: {
      mode: args.environment.resources.serviceRoleAuthority,
      proof: args.proof,
    },
    runtimeAuthority: args.runtimeAuthority,
    effects: {
      databaseReads: 0,
      databaseWrites: 0,
      storageReads: args.proofStorageReads + runtimeStorageReads,
      providerCalls: 0,
      imageWrites: 0,
      audioWrites: 0,
      retries: 0,
      fallback: false,
    },
  };
}

/**
 * The one canonical pre-Order decision for Preview. A PASS joins resource
 * isolation, credential validity at the pinned staging target and the exact
 * package/contract/Board authority in one invocation. No manual joining of
 * independent responses is accepted.
 */
export async function runWizardPreorderAttestation(
  args: {
    repoRoot: string;
    storyKey: string;
    styleId: string;
  },
  source: NodeJS.ProcessEnv = process.env,
  deps: WizardPreorderAttestationDeps = {},
): Promise<WizardPreorderAttestation> {
  const environment = buildWizardPreviewEnvironmentPreflight(source);
  const requestValid = wizardRuntimeAuthorityPreflightRequestIsValid(args);
  if (!requestValid) {
    return result({
      source,
      environment,
      status: 'failed',
      reasons: ['request_invalid'],
      proof: 'not_attempted',
      proofStorageReads: 0,
      runtimeAuthority: { status: 'not_evaluated' },
    });
  }

  const environmentFailures = hardEnvironmentReasons(environment.reasons);
  if (environmentFailures.length > 0) {
    return result({
      source,
      environment,
      status: 'failed',
      reasons: environment.reasons,
      proof: 'not_attempted',
      proofStorageReads: 0,
      runtimeAuthority: { status: 'not_evaluated' },
    });
  }

  let proof: CredentialProofDisposition = 'not_required';
  let proofStorageReads = 0;
  if (environment.resources.serviceRoleAuthority === 'opaque') {
    const proofResult = await (
      deps.proveCredential ??
      (() =>
        proveStagingCredential(
          WIZARD_PREVIEW_STAGING_SUPABASE_REF,
          source,
        ))
    )();
    proof = proofResult.status;
    proofStorageReads = proofResult.storageReads;
    if (proofResult.status !== 'proved') {
      return result({
        source,
        environment,
        status: 'failed',
        reasons: ['supabase_service_role_proof_failed'],
        proof,
        proofStorageReads,
        runtimeAuthority: { status: 'not_evaluated' },
      });
    }
  }

  try {
    const runtimeAuthority = await (
      deps.runRuntimeAuthority ??
      (() =>
        runWizardRuntimeAuthorityPreflight(args, {
          boardResolverDeps: createPreflightBoardResolverDeps({
            expectedProjectRef: WIZARD_PREVIEW_STAGING_SUPABASE_REF,
            rootDir: path.join(args.repoRoot, 'set-identity-boards'),
            source,
          }),
        }))
    )();
    return result({
      source,
      environment,
      status: 'passed',
      reasons: [],
      proof,
      proofStorageReads,
      runtimeAuthority,
    });
  } catch (error) {
    const code =
      error instanceof WizardRuntimeAuthorityPreflightError
        ? error.code
        : 'reference_preflight_failed';
    return result({
      source,
      environment,
      status: 'failed',
      reasons: ['runtime_authority_failed'],
      proof,
      proofStorageReads,
      runtimeAuthority: {
        version: 'wizard-runtime-authority-preflight/v1',
        status: 'failed',
        code,
      },
    });
  }
}

export const WIZARD_PREORDER_DEFAULT_STYLE_ID =
  STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK;
