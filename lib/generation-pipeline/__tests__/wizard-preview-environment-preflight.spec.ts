import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { findProdResourceLeak } from '@/lib/generation-chunked/env-separation-guard';
import { classifySupabaseServiceRoleAuthority } from '@/lib/generation-chunked/supabase-service-role-authority';
import {
  buildWizardPreviewEnvironmentPreflight,
  WIZARD_PREVIEW_ENVIRONMENT_REASON_VALUES,
} from '../wizard-preview-environment-preflight';
import {
  resolveStage0AnchorMaxAttempts,
  STAGE0_ANCHOR_DEFAULT_MAX_ATTEMPTS,
} from '../stage0-attempt-policy';
import {
  QUALITY_REGEN_BUDGET,
  resolvePageVisualQaMaxRegens,
} from '../quality-regen-policy';

const REPO_ROOT = process.cwd();
const STAGING_REF = 'qvksgpzzosotubcbizay';
const PRODUCTION_REF = 'yevwpjxqusyyaxalbvyn';

function legacySupabaseJwt(
  projectRef: string,
  role: 'service_role' | 'anon' = 'service_role',
): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    iss: 'supabase',
    ref: projectRef,
    role,
  })}.test-signature`;
}

function passingEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    VERCEL_ENV: 'preview',
    ALLOW_STAGING_QA: 'true',
    NEXT_PUBLIC_APP_URL: 'https://preview.example.vercel.app',
    SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
    DATABASE_URL:
      `postgresql://postgres.${STAGING_REF}:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
    DIRECT_URL:
      `postgresql://postgres:secret@db.${STAGING_REF}.supabase.co:5432/postgres`,
    PAYMENT_PROVIDER: 'fake',
    ENABLE_FAKE_PAYMENT: 'true',
    ALLOW_FAKE_PAYMENTS: 'true',
    VISUAL_CONTRACT_ENFORCEMENT: 'true',
    CHILD_ANCHOR_MAX_ATTEMPTS: '4',
    GPT_IMAGE_QUALITY: 'low',
    PAGE_VISUAL_QA_MAX_REGENS: '2',
    SITE_PASSWORD: 'must-not-leak',
    SUPABASE_SERVICE_ROLE_KEY: legacySupabaseJwt(STAGING_REF),
  };
}

describe('Wizard Preview environment authority preflight', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns only safe staging hosts and the exact bounded policy without any read or provider effect', () => {
    const result = buildWizardPreviewEnvironmentPreflight(passingEnv());
    expect(result).toEqual({
      version: 'wizard-preview-environment-preflight/v3',
      status: 'passed',
      reasons: [],
      environment: {
        vercelEnvironment: 'preview',
        stagingQaEnabled: true,
      },
      resources: {
        expectedStagingSupabaseRef: STAGING_REF,
        supabaseHost: `${STAGING_REF}.supabase.co`,
        supabaseProjectRef: STAGING_REF,
        databaseHost: 'aws-0-eu-central-1.pooler.supabase.com',
        directDatabaseHost: `db.${STAGING_REF}.supabase.co`,
        productionResourceLeak: false,
        serviceRoleAuthority: 'legacy_claims_matched',
      },
      policy: {
        paymentProvider: 'fake',
        fakePaymentEnabled: true,
        sitePasswordConfigured: true,
        visualContractEnforcement: true,
        childAnchorMaxAttempts: 4,
        imageQuality: 'low',
        pageVisualQaMaxRegens: 2,
      },
      effects: {
        databaseReads: 0,
        databaseWrites: 0,
        storageReads: 0,
        providerCalls: 0,
        imageCalls: 0,
        audioCalls: 0,
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('must-not-leak');
    expect(serialized).not.toContain('postgresql://');
  });

  it('fails closed and canonically orders every independent mismatch family', () => {
    const env = passingEnv();
    Object.assign(env, {
      VERCEL_ENV: 'production',
      ALLOW_STAGING_QA: 'false',
      NEXT_PUBLIC_APP_URL: 'https://smallheroes.co.il',
      SUPABASE_URL: 'https://yevwpjxqusyyaxalbvyn.supabase.co',
      DATABASE_URL:
        'postgresql://postgres.yevwpjxqusyyaxalbvyn:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
      DIRECT_URL:
        `postgresql://postgres:secret@db.${PRODUCTION_REF}.supabase.co:5432/postgres`,
      SUPABASE_SERVICE_ROLE_KEY: legacySupabaseJwt(PRODUCTION_REF),
      PAYMENT_PROVIDER: 'payme',
      ENABLE_FAKE_PAYMENT: 'false',
      ALLOW_FAKE_PAYMENTS: 'false',
      VISUAL_CONTRACT_ENFORCEMENT: 'false',
      CHILD_ANCHOR_MAX_ATTEMPTS: '1',
      GPT_IMAGE_QUALITY: 'high',
      PAGE_VISUAL_QA_MAX_REGENS: '1',
      SITE_PASSWORD: '',
    });
    env.SUPABASE_SERVICE_ROLE_KEY = 'malformed-key';
    const result = buildWizardPreviewEnvironmentPreflight(env);
    expect(result.status).toBe('failed');
    expect(result.reasons).toEqual(
      WIZARD_PREVIEW_ENVIRONMENT_REASON_VALUES.filter(
        (reason) => reason !== 'supabase_service_role_proof_required',
      ),
    );
    expect(result.resources.productionResourceLeak).toBe(true);
    expect(result.resources.serviceRoleAuthority).toBe('malformed');
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('binds the backend credential to the exact staging service-role authority without exposing it', () => {
    expect(
      classifySupabaseServiceRoleAuthority(
        legacySupabaseJwt(STAGING_REF),
        STAGING_REF,
      ),
    ).toBe('legacy_claims_matched');
    expect(
      classifySupabaseServiceRoleAuthority(
        legacySupabaseJwt(PRODUCTION_REF),
        STAGING_REF,
      ),
    ).toBe('mismatched');
    expect(
      classifySupabaseServiceRoleAuthority(
        legacySupabaseJwt(STAGING_REF, 'anon'),
        STAGING_REF,
      ),
    ).toBe('mismatched');
    expect(
      classifySupabaseServiceRoleAuthority('sb_secret_uninspectable', STAGING_REF),
    ).toBe('opaque');
    expect(
      classifySupabaseServiceRoleAuthority('not-a-jwt', STAGING_REF),
    ).toBe('malformed');
    expect(classifySupabaseServiceRoleAuthority(undefined, STAGING_REF)).toBe(
      'missing',
    );

    const prodKeyEnv = passingEnv();
    prodKeyEnv.SUPABASE_SERVICE_ROLE_KEY = legacySupabaseJwt(PRODUCTION_REF);
    const prodResult = buildWizardPreviewEnvironmentPreflight(prodKeyEnv);
    expect(prodResult.status).toBe('failed');
    expect(prodResult.reasons).toEqual([
      'production_resource_configured',
      'supabase_service_role_authority_invalid',
    ]);
    expect(prodResult.resources.serviceRoleAuthority).toBe('mismatched');
    expect(findProdResourceLeak(prodKeyEnv)).toBe(
      'SUPABASE_SERVICE_ROLE_KEY identifies the PRODUCTION Supabase project',
    );
    expect(JSON.stringify(prodResult)).not.toContain(
      prodKeyEnv.SUPABASE_SERVICE_ROLE_KEY,
    );
  });

  it('reports an opaque modern key as requiring runtime proof without treating it as malformed authority', () => {
    const env = passingEnv();
    env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_current_backend_key';
    const result = buildWizardPreviewEnvironmentPreflight(env);
    expect(result).toMatchObject({
      version: 'wizard-preview-environment-preflight/v3',
      status: 'failed',
      reasons: ['supabase_service_role_proof_required'],
      resources: { serviceRoleAuthority: 'opaque' },
    });
    expect(JSON.stringify(result)).not.toContain(
      env.SUPABASE_SERVICE_ROLE_KEY,
    );
  });

  it('requires the password needed by fake-payment confirmation and emits only closed policy values', () => {
    const missingPassword = passingEnv();
    missingPassword.SITE_PASSWORD = '   ';
    const missingResult = buildWizardPreviewEnvironmentPreflight(missingPassword);
    expect(missingResult.status).toBe('failed');
    expect(missingResult.reasons).toEqual(['site_password_missing']);
    expect(missingResult.policy.sitePasswordConfigured).toBe(false);

    const hostileValues = passingEnv();
    hostileValues.VERCEL_ENV = 'preview-with-secret-like-suffix';
    hostileValues.PAYMENT_PROVIDER = 'fake-with-secret-like-suffix';
    hostileValues.GPT_IMAGE_QUALITY = 'low-with-secret-like-suffix';
    const closed = buildWizardPreviewEnvironmentPreflight(hostileValues);
    expect(closed.environment.vercelEnvironment).toBe('other');
    expect(closed.policy.paymentProvider).toBe('other');
    expect(closed.policy.imageQuality).toBe('other');
    expect(JSON.stringify(closed)).not.toContain('secret-like-suffix');
  });

  it('does not accept an unrelated database host merely because a path or query mentions staging', () => {
    const env = passingEnv();
    env.DATABASE_URL =
      `postgresql://postgres:secret@evil.example:5432/${STAGING_REF}`;
    env.DIRECT_URL =
      `postgresql://postgres:secret@evil.example:5432/postgres?ref=${STAGING_REF}`;
    const result = buildWizardPreviewEnvironmentPreflight(env);
    expect(result.status).toBe('failed');
    expect(result.reasons).toEqual([
      'database_authority_invalid',
      'direct_database_authority_invalid',
    ]);
    expect(result.resources.databaseHost).toBe('evil.example');
    expect(result.resources.directDatabaseHost).toBe('evil.example');
  });

  it('shares one bounded Stage-0 attempt calculation with both render branches', () => {
    expect(resolveStage0AnchorMaxAttempts(undefined)).toBe(
      STAGE0_ANCHOR_DEFAULT_MAX_ATTEMPTS,
    );
    expect(resolveStage0AnchorMaxAttempts('not-a-number')).toBe(4);
    expect(resolveStage0AnchorMaxAttempts('0')).toBe(4);
    expect(resolveStage0AnchorMaxAttempts('1')).toBe(1);
    expect(resolveStage0AnchorMaxAttempts('4')).toBe(4);
    expect(resolveStage0AnchorMaxAttempts('99')).toBe(6);

    const source = fs.readFileSync(
      path.join(REPO_ROOT, 'lib/generation-pipeline/chunk-runner.ts'),
      'utf8',
    );
    expect(source.match(/resolveStage0AnchorMaxAttempts\(\)/gu)).toHaveLength(2);
    expect(source).not.toContain("CHILD_ANCHOR_MAX_ATTEMPTS ?? '4'");
  });

  it('shares one Page Visual QA regeneration calculation with the renderer and durable evidence budget', () => {
    expect(QUALITY_REGEN_BUDGET).toBe(2);
    expect(resolvePageVisualQaMaxRegens(undefined)).toBe(2);
    expect(resolvePageVisualQaMaxRegens('not-a-number')).toBe(2);
    expect(resolvePageVisualQaMaxRegens('0')).toBe(2);
    expect(resolvePageVisualQaMaxRegens('1')).toBe(1);
    expect(resolvePageVisualQaMaxRegens('2')).toBe(2);
    expect(resolvePageVisualQaMaxRegens('99')).toBe(2);
    expect(resolvePageVisualQaMaxRegens('-1')).toBe(0);

    const source = fs.readFileSync(
      path.join(REPO_ROOT, 'lib/generation-pipeline/page-visual-qa.ts'),
      'utf8',
    );
    expect(source).toContain('resolvePageVisualQaMaxRegens()');
    expect(source).not.toContain("PAGE_VISUAL_QA_MAX_REGENS ?? '2'");
  });

  it('returns 200 only for approved Preview authority, 409 for drift and 404 outside dev authority', async () => {
    for (const [key, value] of Object.entries(passingEnv())) {
      if (value !== undefined) vi.stubEnv(key, value);
    }
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const { GET } = await import(
      '@/app/api/dev/wizard-environment-preflight/route'
    );
    const passed = await GET();
    expect(passed.status).toBe(200);
    expect((await passed.json()).status).toBe('passed');

    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_current_backend_key');
    const conditional = await GET();
    expect(conditional.status).toBe(409);
    expect((await conditional.json()).reasons).toEqual([
      'supabase_service_role_proof_required',
    ]);

    vi.stubEnv(
      'SUPABASE_SERVICE_ROLE_KEY',
      legacySupabaseJwt(STAGING_REF),
    );
    vi.stubEnv('CHILD_ANCHOR_MAX_ATTEMPTS', '1');
    const failed = await GET();
    expect(failed.status).toBe(409);
    expect((await failed.json()).reasons).toContain(
      'child_anchor_attempt_policy_invalid',
    );

    vi.stubEnv('VERCEL_ENV', 'production');
    const closed = await GET();
    expect(closed.status).toBe(404);
  });

  it('is production-closed and transitively free of DB, provider and network capability', () => {
    const routePath = path.join(
      REPO_ROOT,
      'app/api/dev/wizard-environment-preflight/route.ts',
    );
    const routeSource = fs.readFileSync(routePath, 'utf8');
    expect(routeSource).toContain(
      'if (!isDevEnvironment()) return devOnlyJsonError()',
    );

    const sentinelPreamble = [
      "const Module = require('node:module');",
      'const originalLoad = Module._load;',
      'Module._load = function(request, parent, isMain) {',
      "  const id = String(request).replaceAll('\\\\', '/');",
      "  if (id.includes('openai') || id.includes('replicate') || id.includes('@prisma') || id.includes('/prisma') || id.includes('/generate-image')) {",
      "    throw new Error('forbidden_capability_import:' + id);",
      '  }',
      '  return originalLoad.call(this, request, parent, isMain);',
      '};',
      "global.fetch = () => { throw new Error('network_forbidden'); };",
    ].join('\n');
    const sentinel = [
      sentinelPreamble,
      "import('./app/api/dev/wizard-environment-preflight/route.ts')",
      "  .then(() => process.stdout.write('isolated'))",
      '  .catch((error) => { console.error(error); process.exitCode = 1; });',
    ].join('\n');
    const output = execFileSync(
      process.execPath,
      [
        '--require',
        './scripts/shims/register-server-only.cjs',
        '--import',
        'tsx',
        '--eval',
        sentinel,
      ],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    expect(output).toBe('isolated');

    const control = spawnSync(
      process.execPath,
      [
        '--require',
        './scripts/shims/register-server-only.cjs',
        '--import',
        'tsx',
        '--eval',
        `${sentinelPreamble}\nimport('./lib/generate-image.ts').catch((error) => { console.error(error.message); process.exitCode = 1; });`,
      ],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    expect(control.status).toBe(1);
    expect(control.stderr).toContain('forbidden_capability_import:');
  });
});
