import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextConfig = require('../../next.config.js') as {
  outputFileTracingIncludes?: Record<string, string[]>;
  outputFileTracingExcludes?: Record<string, string[]>;
};

const H = vi.hoisted(() => ({
  execute: vi.fn(),
  assertEnvSeparation: vi.fn(),
}));

vi.mock('@/lib/generation-pipeline/release-v1-recovery', () => {
  class ReleaseV1RecoveryError extends Error {
    readonly code = 'release_v1_recovery_rejected';
    constructor(readonly reasons: readonly string[]) {
      super(reasons.join('; '));
    }
  }
  class ReleaseV1RecoveryInputError extends Error {
    readonly code = 'release_v1_recovery_invalid_request';
  }
  return {
    ReleaseV1RecoveryError,
    ReleaseV1RecoveryInputError,
    executeReleaseV1Recovery: H.execute,
  };
});
vi.mock('@/lib/generation-chunked/env-separation-guard', () => ({
  assertEnvSeparation: H.assertEnvSeparation,
}));

function request(secret = 'recovery-secret', body: unknown = { mode: 'inspect' }) {
  return new NextRequest(
    'https://fixed-preview.vercel.app/api/release/v1/generate/resume',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('ALLOW_STAGING_QA', 'true');
  vi.stubEnv('GENERATION_SECRET', 'recovery-secret');
  H.execute.mockResolvedValue({
    status: 'inspect_ready',
    orderId: 'release-order',
    snapshotDigest: 'a'.repeat(64),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/release/v1/generate/resume boundary', () => {
  it('traces immutable authorities while keeping the recovery function lean', () => {
    const route = '/api/release/v1/generate/resume';
    expect(nextConfig.outputFileTracingIncludes?.[route]).toEqual([
      './story-pipeline/04_approved_story_sources/accepted/**/*',
      './visual-packages/approved/**/*',
    ]);
    expect(nextConfig.outputFileTracingExcludes?.[route]).toEqual(
      expect.arrayContaining([
        './public/**/*',
        './style-references/**/*',
        './story-bank/**/*',
        './outputs/**/*',
      ]),
    );
  });

  it('is hidden outside an explicitly enabled Preview before auth/body/service work', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const { POST } = await import('@/app/api/release/v1/generate/resume/route');
    const response = await POST(request('wrong-secret'));
    expect(response.status).toBe(404);
    expect(H.assertEnvSeparation).not.toHaveBeenCalled();
    expect(H.execute).not.toHaveBeenCalled();

    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('ALLOW_STAGING_QA', 'false');
    const disabled = await POST(request());
    expect(disabled.status).toBe(404);
    expect(H.execute).not.toHaveBeenCalled();
  });

  it('returns 503 without a server secret and 401 for a wrong Bearer', async () => {
    const { POST } = await import('@/app/api/release/v1/generate/resume/route');
    vi.stubEnv('GENERATION_SECRET', '');
    const missing = await POST(request());
    expect(missing.status).toBe(503);

    vi.stubEnv('GENERATION_SECRET', 'recovery-secret');
    const unauthorized = await POST(request('wrong'));
    expect(unauthorized.status).toBe(401);
    expect(H.assertEnvSeparation).not.toHaveBeenCalled();
    expect(H.execute).not.toHaveBeenCalled();
  });

  it('passes an authenticated body through the environment fence to the service', async () => {
    const body = { mode: 'inspect', orderId: 'release-order' };
    const { POST } = await import('@/app/api/release/v1/generate/resume/route');
    const response = await POST(request('recovery-secret', body));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      status: 'inspect_ready',
      orderId: 'release-order',
    });
    expect(H.assertEnvSeparation).toHaveBeenCalledTimes(1);
    expect(H.execute).toHaveBeenCalledWith(body);
  });
});
