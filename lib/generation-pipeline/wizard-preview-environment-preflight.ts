import 'server-only';

import { findProdResourceLeak } from '@/lib/generation-chunked/env-separation-guard';
import {
  resolveStage0AnchorMaxAttempts,
  STAGE0_ANCHOR_DEFAULT_MAX_ATTEMPTS,
} from './stage0-attempt-policy';

export const WIZARD_PREVIEW_ENVIRONMENT_PREFLIGHT_VERSION =
  'wizard-preview-environment-preflight/v1' as const;
export const WIZARD_PREVIEW_STAGING_SUPABASE_REF =
  'qvksgpzzosotubcbizay' as const;
export const WIZARD_PREVIEW_PAGE_QA_MAX_REGENS = 2 as const;

export const WIZARD_PREVIEW_ENVIRONMENT_REASON_VALUES = [
  'not_preview',
  'staging_qa_disabled',
  'production_resource_configured',
  'supabase_authority_invalid',
  'database_authority_invalid',
  'direct_database_authority_invalid',
  'fake_payment_disabled',
  'visual_contract_enforcement_disabled',
  'child_anchor_attempt_policy_invalid',
  'image_quality_not_low',
  'page_visual_qa_policy_invalid',
] as const;

export type WizardPreviewEnvironmentReason =
  (typeof WIZARD_PREVIEW_ENVIRONMENT_REASON_VALUES)[number];

type SafeResourceAuthority = {
  expectedStagingSupabaseRef: typeof WIZARD_PREVIEW_STAGING_SUPABASE_REF;
  supabaseHost: string | null;
  supabaseProjectRef: string | null;
  databaseHost: string | null;
  directDatabaseHost: string | null;
  productionResourceLeak: boolean;
};

export type WizardPreviewEnvironmentPreflight = {
  version: typeof WIZARD_PREVIEW_ENVIRONMENT_PREFLIGHT_VERSION;
  status: 'passed' | 'failed';
  reasons: WizardPreviewEnvironmentReason[];
  environment: {
    vercelEnvironment: string | null;
    stagingQaEnabled: boolean;
  };
  resources: SafeResourceAuthority;
  policy: {
    paymentProvider: string | null;
    fakePaymentEnabled: boolean;
    visualContractEnforcement: boolean;
    childAnchorMaxAttempts: number;
    imageQuality: string | null;
    pageVisualQaMaxRegens: number;
  };
  effects: {
    databaseReads: 0;
    databaseWrites: 0;
    storageReads: 0;
    providerCalls: 0;
    imageCalls: 0;
    audioCalls: 0;
  };
};

function safeHostname(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function supabaseProjectRef(host: string | null): string | null {
  if (!host) return null;
  const match = /^([a-z0-9]+)\.supabase\.co$/u.exec(host);
  return match?.[1] ?? null;
}

function connectionTargetsExpectedStaging(
  value: string | undefined,
  host: string | null,
): boolean {
  if (!value || !host) return false;
  try {
    const parsed = new URL(value);
    const username = decodeURIComponent(parsed.username).toLowerCase();
    const directHost = `db.${WIZARD_PREVIEW_STAGING_SUPABASE_REF}.supabase.co`;
    const poolerAuthority =
      host.endsWith('.pooler.supabase.com') &&
      username === `postgres.${WIZARD_PREVIEW_STAGING_SUPABASE_REF}`;
    return host === directHost || poolerAuthority;
  } catch {
    return false;
  }
}

function resolvePageVisualQaMaxRegens(rawValue: string | undefined): number {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  const requested = parsed || WIZARD_PREVIEW_PAGE_QA_MAX_REGENS;
  return Math.min(2, Math.max(0, requested));
}

export function buildWizardPreviewEnvironmentPreflight(
  source: NodeJS.ProcessEnv = process.env,
): WizardPreviewEnvironmentPreflight {
  const supabaseHost = safeHostname(source.SUPABASE_URL);
  const databaseHost = safeHostname(source.DATABASE_URL);
  const directDatabaseHost = safeHostname(source.DIRECT_URL);
  const projectRef = supabaseProjectRef(supabaseHost);
  const productionResourceLeak = findProdResourceLeak(source) !== null;
  const childAnchorMaxAttempts = resolveStage0AnchorMaxAttempts(
    source.CHILD_ANCHOR_MAX_ATTEMPTS,
  );
  const pageVisualQaMaxRegens = resolvePageVisualQaMaxRegens(
    source.PAGE_VISUAL_QA_MAX_REGENS,
  );
  const fakePaymentEnabled =
    source.PAYMENT_PROVIDER === 'fake' &&
    source.ENABLE_FAKE_PAYMENT === 'true' &&
    source.ALLOW_FAKE_PAYMENTS === 'true';

  const reasons: WizardPreviewEnvironmentReason[] = [];
  if (source.VERCEL_ENV !== 'preview') reasons.push('not_preview');
  if (source.ALLOW_STAGING_QA !== 'true') reasons.push('staging_qa_disabled');
  if (productionResourceLeak) reasons.push('production_resource_configured');
  if (projectRef !== WIZARD_PREVIEW_STAGING_SUPABASE_REF) {
    reasons.push('supabase_authority_invalid');
  }
  if (!connectionTargetsExpectedStaging(source.DATABASE_URL, databaseHost)) {
    reasons.push('database_authority_invalid');
  }
  if (!connectionTargetsExpectedStaging(source.DIRECT_URL, directDatabaseHost)) {
    reasons.push('direct_database_authority_invalid');
  }
  if (!fakePaymentEnabled) reasons.push('fake_payment_disabled');
  if (source.VISUAL_CONTRACT_ENFORCEMENT !== 'true') {
    reasons.push('visual_contract_enforcement_disabled');
  }
  if (childAnchorMaxAttempts !== STAGE0_ANCHOR_DEFAULT_MAX_ATTEMPTS) {
    reasons.push('child_anchor_attempt_policy_invalid');
  }
  if (source.GPT_IMAGE_QUALITY !== 'low') reasons.push('image_quality_not_low');
  if (pageVisualQaMaxRegens !== WIZARD_PREVIEW_PAGE_QA_MAX_REGENS) {
    reasons.push('page_visual_qa_policy_invalid');
  }

  return {
    version: WIZARD_PREVIEW_ENVIRONMENT_PREFLIGHT_VERSION,
    status: reasons.length === 0 ? 'passed' : 'failed',
    reasons,
    environment: {
      vercelEnvironment: source.VERCEL_ENV ?? null,
      stagingQaEnabled: source.ALLOW_STAGING_QA === 'true',
    },
    resources: {
      expectedStagingSupabaseRef: WIZARD_PREVIEW_STAGING_SUPABASE_REF,
      supabaseHost,
      supabaseProjectRef: projectRef,
      databaseHost,
      directDatabaseHost,
      productionResourceLeak,
    },
    policy: {
      paymentProvider: source.PAYMENT_PROVIDER ?? null,
      fakePaymentEnabled,
      visualContractEnforcement:
        source.VISUAL_CONTRACT_ENFORCEMENT === 'true',
      childAnchorMaxAttempts,
      imageQuality: source.GPT_IMAGE_QUALITY ?? null,
      pageVisualQaMaxRegens,
    },
    effects: {
      databaseReads: 0,
      databaseWrites: 0,
      storageReads: 0,
      providerCalls: 0,
      imageCalls: 0,
      audioCalls: 0,
    },
  };
}
