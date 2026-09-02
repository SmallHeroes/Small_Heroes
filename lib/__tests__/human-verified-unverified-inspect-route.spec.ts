import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

const H = vi.hoisted(() => {
  class AdmissibilityError extends Error {
    constructor(readonly rule: string, detail?: string) {
      super(`refused: ${rule}${detail ? ` ${detail}` : ''}`);
      this.name = 'HumanVerifiedUnverifiedAdmissibilityError';
    }
  }
  return {
    prisma: { name: 'mock-prisma' },
    inspect: vi.fn(),
    readinessEnabled: vi.fn(),
    AdmissibilityError,
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: H.prisma }));
vi.mock('@/lib/generation-pipeline/human-verified-unverified-preparation', () => ({
  inspectHumanVerifiedUnverifiedRelease: H.inspect,
}));
vi.mock('@/lib/generation-pipeline/human-verified-unverified-release', () => ({
  HumanVerifiedUnverifiedAdmissibilityError: H.AdmissibilityError,
}));
vi.mock('@/lib/generation-pipeline/readiness-manifest', () => ({
  isReadinessManifestEnabled: H.readinessEnabled,
}));

import {
  maxDuration,
  POST,
  runtime,
} from '@/app/api/admin/review/cases/[orderId]/actions/inspect-unverified/route';

const SHA = 'a'.repeat(64);
const BODY = {
  artifactKey: 'page:6',
  expectedMarker: 'safety_hold:unverified:page:6',
  assetSha256: SHA,
};

function request(args: { secret?: string; body?: unknown; rawBody?: string } = {}): NextRequest {
  return new NextRequest(
    'https://preview.example.test/api/admin/review/cases/order-1/actions/inspect-unverified',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${args.secret ?? 'admin-secret'}`,
        'content-type': 'application/json',
      },
      body: args.rawBody ?? JSON.stringify(
        Object.prototype.hasOwnProperty.call(args, 'body') ? args.body : BODY,
      ),
    },
  );
}

const context = { params: Promise.resolve({ orderId: 'order-1' }) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('GENERATION_SECRET', 'admin-secret');
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('ALLOW_STAGING_QA', 'true');
  vi.stubEnv('HUMAN_VERIFIED_UNVERIFIED_RELEASE_ENABLED', 'true');
  vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
  vi.stubEnv('QA_SOFT_DELIVER', 'false');
  H.readinessEnabled.mockReturnValue(true);
  H.inspect.mockResolvedValue({
    inspectionDigest: SHA,
    requiredArtifacts: ['page:2', 'page:6', 'page:10'],
    needsProofArtifacts: ['page:6', 'page:10'],
  });
});

afterEach(() => vi.unstubAllEnvs());

describe('POST inspect-unverified — redacted provider-free boundary', () => {
  it('is Node-only and bounded to the 300 second route maximum', () => {
    expect(runtime).toBe('nodejs');
    expect(maxDuration).toBe(300);
  });

  it('authenticates before params, body, or inspection service work', async () => {
    const req = request({ secret: 'wrong', rawBody: '{broken' });
    const bodyRead = vi.spyOn(req, 'json');
    let paramsRead = 0;
    const response = await POST(req, {
      get params() {
        paramsRead += 1;
        return context.params;
      },
    });
    expect(response.status).toBe(401);
    expect(paramsRead).toBe(0);
    expect(bodyRead).not.toHaveBeenCalled();
    expect(H.inspect).not.toHaveBeenCalled();
  });

  it('rejects every non-exact or non-canonical body before service work', async () => {
    for (const body of [
      null,
      [],
      { ...BODY, reviewReason: 'not part of Inspect' },
      { ...BODY, url: 'https://attacker.invalid/image.png' },
      { artifactKey: BODY.artifactKey, expectedMarker: BODY.expectedMarker },
      { ...BODY, artifactKey: 'page:7' },
      { ...BODY, expectedMarker: 'safety_hold:hazard:page:6:unsafe_pose' },
      { ...BODY, assetSha256: 'A'.repeat(64) },
    ]) {
      expect((await POST(request({ body }), context)).status).toBe(400);
    }
    expect(H.inspect).not.toHaveBeenCalled();
  });

  it('returns only the digest and canonical required/needs-proof artifact sets', async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(H.inspect).toHaveBeenCalledWith(H.prisma, {
      orderId: 'order-1',
      artifactKey: 'page:6',
      expectedMarker: 'safety_hold:unverified:page:6',
      expectedAssetSha256: SHA,
    });
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      inspectionDigest: SHA,
      requiredArtifacts: ['page:2', 'page:6', 'page:10'],
      needsProofArtifacts: ['page:6', 'page:10'],
    });
    expect(text).not.toMatch(/https?:|payment|customer|stripe|assetId|bytes/i);
  });

  it('maps detailed refusal to a privacy-safe rule only', async () => {
    H.inspect.mockRejectedValueOnce(new H.AdmissibilityError(
      'asset_changed',
      'https://private.example child@example.test pi_secret',
    ));
    const response = await POST(request(), context);
    const text = await response.text();
    expect(response.status).toBe(409);
    expect(JSON.parse(text)).toEqual({
      inspected: false,
      error: 'Inspection was refused',
      rule: 'asset_changed',
    });
    expect(text).not.toMatch(/private\.example|child@example|pi_secret/i);
  });
});

describe('inspect-unverified route — source invariants', () => {
  const source = readFileSync(path.join(
    process.cwd(),
    'app/api/admin/review/cases/[orderId]/actions/inspect-unverified/route.ts',
  ), 'utf8');

  it('is an exact three-key, auth-first Preview route with no provider or mutation surface', () => {
    expect(source).toContain(`const BODY_KEYS = ['artifactKey', 'assetSha256', 'expectedMarker'] as const`);
    expect(source.indexOf('assertAdminSecret(req)')).toBeLessThan(source.indexOf('await context.params'));
    expect(source.indexOf('await context.params')).toBeLessThan(source.indexOf('await req.json()'));
    expect(source).toContain('inspectHumanVerifiedUnverifiedRelease');
    expect(source).not.toMatch(/evaluatePageChildResemblanceVision|commitBaseBookReadiness|\.create\(|\.update\(|\.updateMany\(/u);
    expect(source).not.toMatch(/console\.|createLogger|accessKey|paymentId|stripePaymentId|presentationUrl|deliveredUrl/u);
  });
});
