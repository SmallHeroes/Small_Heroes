import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { createRequire } from 'module';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  proveStagingCredential,
  type StagingCredentialProofResult,
} from '@/lib/generation-chunked/supabase-staging-read-authority';
import { classifySupabaseServiceRoleAuthority } from '@/lib/generation-chunked/supabase-service-role-authority';
import { STYLE_IDS } from '@/lib/styles';

import {
  runWizardPreorderAttestation,
  type WizardPreorderAttestationDeps,
} from '../wizard-preorder-attestation';
import {
  WizardRuntimeAuthorityPreflightError,
  type WizardRuntimeAuthorityPreflightResult,
} from '../wizard-runtime-authority-preflight';

const REPO_ROOT = process.cwd();
const STAGING_REF = 'qvksgpzzosotubcbizay';
const PRODUCTION_REF = 'yevwpjxqusyyaxalbvyn';
const STORY_KEY = 'chameleon_koko_bedtime';
const require = createRequire(import.meta.url);
const nextConfig = require('../../../next.config.js') as {
  outputFileTracingIncludes?: Record<string, string[]>;
  outputFileTracingExcludes?: Record<string, string[]>;
};

function legacySupabaseJwt(
  projectRef: string,
  role: 'service_role' | 'anon' = 'service_role',
  issuer = 'supabase',
): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    iss: issuer,
    ref: projectRef,
    role,
  })}.test-signature`;
}

function passingEnv(key = 'sb_secret_current_backend_key'): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_SHA: 'c89867dbbbbe6ae18b680a40596cf8660cf9dd8c',
    VERCEL_DEPLOYMENT_ID: 'dpl_HUP7nMgULZcL1ddPo65N2HWbncab',
    ALLOW_STAGING_QA: 'true',
    NEXT_PUBLIC_APP_URL: 'https://preview.example.vercel.app',
    SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: key,
    SUPABASE_PRIVATE_STORAGE_BUCKET: 'child-photos-private',
    SUPABASE_STORAGE_BUCKET: 'book-images',
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
  };
}

function runtimePassed(): WizardRuntimeAuthorityPreflightResult {
  return {
    version: 'wizard-runtime-authority-preflight/v1',
    status: 'passed',
    storyKey: STORY_KEY,
    styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    packageRevisionDigest: '1'.repeat(64),
    packageAuthorityDigest: '2'.repeat(64),
    sourceRawDigest: '3'.repeat(64),
    contractHash: '4'.repeat(64),
    blueprintDigest: '5'.repeat(64),
    checkedPageNumbers: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    boardBindings: [],
    effects: {
      databaseReads: 0,
      databaseWrites: 0,
      providerCalls: 0,
      imageWrites: 0,
      audioWrites: 0,
      retries: 0,
      fallback: false,
      storageReads: 4,
    },
  };
}

function deps(
  proof: StagingCredentialProofResult = {
    status: 'proved',
    storageReads: 1,
  },
): WizardPreorderAttestationDeps & {
  proveCredential: ReturnType<typeof vi.fn>;
  runRuntimeAuthority: ReturnType<typeof vi.fn>;
} {
  return {
    proveCredential: vi.fn(async () => proof),
    runRuntimeAuthority: vi.fn(async () => runtimePassed()),
  };
}

async function run(
  source: NodeJS.ProcessEnv,
  injected: WizardPreorderAttestationDeps,
) {
  return runWizardPreorderAttestation(
    {
      repoRoot: REPO_ROOT,
      storyKey: STORY_KEY,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    },
    source,
    injected,
  );
}

describe('Wizard pre-Order attestation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock('@/lib/generation-pipeline/wizard-preorder-attestation');
    vi.resetModules();
  });

  it('joins opaque credential proof and exact runtime authority in one truthful PASS', async () => {
    const injected = deps();
    const result = await run(passingEnv(), injected);
    expect(result).toMatchObject({
      version: 'wizard-preorder-attestation/v1',
      status: 'passed',
      reasons: [],
      deployment: {
        gitCommitSha: 'c89867dbbbbe6ae18b680a40596cf8660cf9dd8c',
        deploymentId: 'dpl_HUP7nMgULZcL1ddPo65N2HWbncab',
      },
      environment: {
        version: 'wizard-preview-environment-preflight/v3',
        status: 'failed',
        reasons: ['supabase_service_role_proof_required'],
      },
      credential: { mode: 'opaque', proof: 'proved' },
      runtimeAuthority: { status: 'passed' },
      effects: {
        databaseReads: 0,
        databaseWrites: 0,
        storageReads: 5,
        providerCalls: 0,
        imageWrites: 0,
        audioWrites: 0,
        retries: 0,
        fallback: false,
      },
    });
    expect(injected.proveCredential).toHaveBeenCalledTimes(1);
    expect(injected.runRuntimeAuthority).toHaveBeenCalledTimes(1);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('sb_secret_');
    expect(serialized).not.toContain('must-not-leak');
    expect(serialized).not.toContain('postgresql://');
  });

  it('accepts exact legacy staging claims without the opaque-key proof', async () => {
    const injected = deps();
    const result = await run(
      passingEnv(legacySupabaseJwt(STAGING_REF)),
      injected,
    );
    expect(result.status).toBe('passed');
    expect(result.credential).toEqual({
      mode: 'legacy_claims_matched',
      proof: 'not_required',
    });
    expect(result.effects.storageReads).toBe(4);
    expect(injected.proveCredential).not.toHaveBeenCalled();
    expect(injected.runRuntimeAuthority).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Production service-role', legacySupabaseJwt(PRODUCTION_REF)],
    ['Production anon', legacySupabaseJwt(PRODUCTION_REF, 'anon')],
    ['staging anon', legacySupabaseJwt(STAGING_REF, 'anon')],
    ['wrong issuer', legacySupabaseJwt(STAGING_REF, 'service_role', 'other')],
    ['two-part JWT', 'header.payload'],
    ['non-JSON payload', 'header.not-json.signature'],
    ['JSON array', `header.${Buffer.from('[]').toString('base64url')}.signature`],
    ['JSON null', `header.${Buffer.from('null').toString('base64url')}.signature`],
    ['publishable key', 'sb_publishable_not_backend'],
    ['empty opaque prefix', 'sb_secret_'],
    ['missing', undefined],
    ['whitespace', '   '],
  ])('stops before every remote proof for %s', async (_label, key) => {
    const source = passingEnv();
    source.SUPABASE_SERVICE_ROLE_KEY = key;
    const injected = deps();
    const result = await run(source, injected);
    expect(result.status).toBe('failed');
    expect(result.credential.proof).toBe('not_attempted');
    expect(injected.proveCredential).not.toHaveBeenCalled();
    expect(injected.runRuntimeAuthority).not.toHaveBeenCalled();
  });

  it.each(['rejected', 'unreachable'] as const)(
    'fails closed when the opaque-key proof is %s',
    async (status) => {
      const injected = deps({ status, storageReads: 1 });
      const result = await run(passingEnv(), injected);
      expect(result).toMatchObject({
        status: 'failed',
        reasons: ['supabase_service_role_proof_failed'],
        credential: { mode: 'opaque', proof: status },
        runtimeAuthority: { status: 'not_evaluated' },
        effects: { storageReads: 1 },
      });
      expect(injected.runRuntimeAuthority).not.toHaveBeenCalled();
    },
  );

  it('fails closed on runtime authority drift after the credential proof', async () => {
    const injected = deps();
    injected.runRuntimeAuthority.mockRejectedValue(
      new WizardRuntimeAuthorityPreflightError('board_binding_failed'),
    );
    const result = await run(passingEnv(), injected);
    expect(result).toMatchObject({
      status: 'failed',
      reasons: ['runtime_authority_failed'],
      credential: { proof: 'proved' },
      runtimeAuthority: {
        status: 'failed',
        code: 'board_binding_failed',
      },
      effects: { storageReads: 1 },
    });
  });

  it('rejects malformed request authority before credential or runtime I/O', async () => {
    const injected = deps();
    const result = await runWizardPreorderAttestation(
      {
        repoRoot: REPO_ROOT,
        storyKey: '../escape',
        styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      },
      passingEnv(),
      injected,
    );
    expect(result).toMatchObject({
      status: 'failed',
      reasons: ['request_invalid'],
      credential: { proof: 'not_attempted' },
      runtimeAuthority: { status: 'not_evaluated' },
      effects: { storageReads: 0 },
    });
    expect(injected.proveCredential).not.toHaveBeenCalled();
    expect(injected.runRuntimeAuthority).not.toHaveBeenCalled();
  });

  it('uses one bounded private-bucket list and returns no bucket contents or raw error', async () => {
    const source = passingEnv();
    const listPrivateBucket = vi.fn(
      async (_args: {
        supabaseUrl: string;
        serviceRoleKey: string;
        bucket: string;
        signal: AbortSignal;
      }) => ({
        data: [{ name: 'must-never-leave-proof-module.jpg' }],
        error: null,
      }),
    );
    const proved = await proveStagingCredential(STAGING_REF, source, {
      listPrivateBucket,
      timeoutMs: 1_000,
    });
    expect(proved).toEqual({ status: 'proved', storageReads: 1 });
    expect(listPrivateBucket).toHaveBeenCalledTimes(1);
    expect(listPrivateBucket.mock.calls[0]?.[0]).toMatchObject({
      supabaseUrl: `https://${STAGING_REF}.supabase.co`,
      serviceRoleKey: 'sb_secret_current_backend_key',
      bucket: 'child-photos-private',
    });
    expect(JSON.stringify(proved)).not.toContain('must-never-leave');
    expect(JSON.stringify(proved)).not.toContain('sb_secret_');

    await expect(
      proveStagingCredential(STAGING_REF, source, {
        listPrivateBucket: async () => ({
          data: null,
          error: { status: 401, message: 'raw-hostile-secret-message' },
        }),
      }),
    ).resolves.toEqual({ status: 'rejected', storageReads: 1 });
    await expect(
      proveStagingCredential(STAGING_REF, source, {
        listPrivateBucket: async () => {
          throw new Error('raw-network-message');
        },
      }),
    ).resolves.toEqual({ status: 'unreachable', storageReads: 1 });
    await expect(
      proveStagingCredential(STAGING_REF, source, {
        timeoutMs: 1,
        listPrivateBucket: async ({ signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener(
              'abort',
              () => reject(new Error('raw-timeout-message')),
              { once: true },
            );
          }),
      }),
    ).resolves.toEqual({ status: 'unreachable', storageReads: 1 });

    const wrongTarget = passingEnv();
    wrongTarget.SUPABASE_URL = `https://${PRODUCTION_REF}.supabase.co`;
    await expect(
      proveStagingCredential(STAGING_REF, wrongTarget, {
        listPrivateBucket,
      }),
    ).resolves.toEqual({ status: 'rejected', storageReads: 0 });
  });

  it('classifies modern opaque keys deterministically and never as legacy claims', () => {
    expect(
      classifySupabaseServiceRoleAuthority(
        'sb_secret_current_backend_key',
        STAGING_REF,
      ),
    ).toBe('opaque');
    expect(
      classifySupabaseServiceRoleAuthority('sb_secret_', STAGING_REF),
    ).toBe('malformed');
  });

  it('returns 200 only for combined PASS, 409 for authority drift, 400 for invalid input and 404 outside dev authority', async () => {
    const passed = await run(passingEnv(), deps());
    const proofRejected = await run(
      passingEnv(),
      deps({ status: 'rejected', storageReads: 1 }),
    );
    const invalid = await runWizardPreorderAttestation(
      {
        repoRoot: REPO_ROOT,
        storyKey: '../escape',
        styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      },
      passingEnv(),
      deps(),
    );
    const runMock = vi
      .fn()
      .mockResolvedValueOnce(passed)
      .mockResolvedValueOnce(proofRejected)
      .mockResolvedValueOnce(invalid);
    vi.doMock('@/lib/generation-pipeline/wizard-preorder-attestation', () => ({
      runWizardPreorderAttestation: runMock,
      WIZARD_PREORDER_DEFAULT_STYLE_ID:
        STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    }));

    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('ALLOW_STAGING_QA', 'true');
    const { NextRequest } = await import('next/server');
    const { GET } = await import(
      '@/app/api/dev/wizard-preorder-attestation/route'
    );
    const request = new NextRequest(
      `https://preview.example/api/dev/wizard-preorder-attestation?storyKey=${STORY_KEY}`,
    );
    expect((await GET(request)).status).toBe(200);
    expect((await GET(request)).status).toBe(409);
    expect((await GET(request)).status).toBe(400);

    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('ALLOW_STAGING_QA', 'false');
    expect((await GET(request)).status).toBe(404);
    expect(runMock).toHaveBeenCalledTimes(3);
  });

  it('bundles the exact runtime authorities and excludes write-capable image storage from the route graph', () => {
    const route = '/api/dev/wizard-preorder-attestation';
    expect(nextConfig.outputFileTracingIncludes?.[route]).toEqual(
      nextConfig.outputFileTracingIncludes?.[
        '/api/dev/runtime-authority-preflight'
      ],
    );
    expect(nextConfig.outputFileTracingExcludes?.[route]).toEqual(
      nextConfig.outputFileTracingExcludes?.[
        '/api/dev/runtime-authority-preflight'
      ],
    );

    const sentinelPreamble = [
      "const Module = require('node:module');",
      'const originalLoad = Module._load;',
      'Module._load = function(request, parent, isMain) {',
      "  const id = String(request).replaceAll('\\\\', '/');",
      "  if (id.includes('openai') || id.includes('replicate') || id.includes('@prisma') || id.includes('/prisma') || id.includes('/generate-image') || id.includes('image-storage')) {",
      "    throw new Error('forbidden_capability_import:' + id);",
      '  }',
      '  return originalLoad.call(this, request, parent, isMain);',
      '};',
    ].join('\n');
    const output = execFileSync(
      process.execPath,
      [
        '--require',
        './scripts/shims/register-server-only.cjs',
        '--import',
        'tsx',
        '--eval',
        `${sentinelPreamble}\nimport('./app/api/dev/wizard-preorder-attestation/route.ts').then(() => process.stdout.write('isolated')).catch((error) => { console.error(error); process.exitCode = 1; });`,
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
        `${sentinelPreamble}\nimport('./lib/image-storage.ts').catch((error) => { console.error(error.message); process.exitCode = 1; });`,
      ],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    expect(control.status).toBe(1);
    expect(control.stderr).toContain('forbidden_capability_import:');

    const routeSource = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'app/api/dev/wizard-preorder-attestation/route.ts',
      ),
      'utf8',
    );
    expect(routeSource).toContain(
      'if (!isDevEnvironment()) return devOnlyJsonError()',
    );
  });
});
