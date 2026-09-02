import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const H = vi.hoisted(() => {
  class AdmissibilityError extends Error {
    readonly code = 'human_verified_unverified_admissibility';
    constructor(readonly rule: string, detail?: string) {
      super(`refused: ${rule}${detail ? ` ${detail}` : ''}`);
      this.name = 'HumanVerifiedUnverifiedAdmissibilityError';
    }
  }
  class PreconditionError extends Error {
    readonly expectedHoldReason = 'safety_hold:unverified:page:6';
    readonly actual = null;
    constructor() {
      super('readiness_release_precondition_failed');
      this.name = 'ReleasePreconditionError';
    }
  }
  return {
    prisma: { name: 'mock-prisma' },
    prepare: vi.fn(),
    abort: vi.fn(),
    commit: vi.fn(),
    readinessEnabled: vi.fn(),
    AdmissibilityError,
    PreconditionError,
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: H.prisma }));
vi.mock('@/lib/generation-pipeline/human-verified-unverified-preparation', () => ({
  prepareHumanVerifiedUnverifiedRelease: H.prepare,
  abortPreparedHumanVerifiedUnverifiedRelease: H.abort,
}));
vi.mock('@/lib/generation-pipeline/human-verified-unverified-release', () => ({
  HumanVerifiedUnverifiedAdmissibilityError: H.AdmissibilityError,
}));
vi.mock('@/lib/generation-pipeline/readiness-manifest', () => ({
  commitBaseBookReadiness: H.commit,
  isReadinessManifestEnabled: H.readinessEnabled,
  ReleasePreconditionError: H.PreconditionError,
}));

import {
  maxDuration,
  POST,
  runtime,
} from '@/app/api/admin/review/cases/[orderId]/actions/verify-unverified/route';

const SHA = 'a'.repeat(64);
const BODY = {
  artifactKey: 'page:6',
  expectedMarker: 'safety_hold:unverified:page:6',
  assetSha256: SHA,
  reviewReason: 'I inspected these exact bytes and found no physical hazard.',
  inspectionDigest: SHA,
};

function request(args: {
  secret?: string;
  idempotencyKey?: string | null;
  body?: unknown;
  rawBody?: string;
} = {}): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  headers.set('authorization', `Bearer ${args.secret ?? 'admin-secret'}`);
  if (args.idempotencyKey !== null) {
    headers.set('Idempotency-Key', args.idempotencyKey ?? 'verify-page-6-once');
  }
  const body = Object.prototype.hasOwnProperty.call(args, 'body') ? args.body : BODY;
  return new NextRequest(
    'https://preview.example.test/api/admin/review/cases/order-1/actions/verify-unverified',
    {
      method: 'POST',
      headers,
      body: args.rawBody ?? JSON.stringify(body),
    },
  );
}

function context(orderId = 'order-1') {
  return { params: Promise.resolve({ orderId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('GENERATION_SECRET', 'admin-secret');
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('ALLOW_STAGING_QA', 'true');
  vi.stubEnv('HUMAN_VERIFIED_UNVERIFIED_RELEASE_ENABLED', 'true');
  vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
  vi.stubEnv('QA_SOFT_DELIVER', 'false');
  H.readinessEnabled.mockReturnValue(true);
  H.prepare.mockResolvedValue({ request: { prepared: 'request' } });
  H.abort.mockResolvedValue(true);
  H.commit.mockResolvedValue({ manifestStatus: 'passed', orderStatus: 'ready', enqueued: true, revision: 3 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST verify-unverified — boundary contract', () => {
  it('declares the Node runtime', () => {
    expect(runtime).toBe('nodejs');
    expect(maxDuration).toBe(300);
  });

  it('authenticates before params, body, service or DB-facing readiness work', async () => {
    const req = request({ secret: 'wrong-secret', rawBody: '{not-json' });
    const bodyRead = vi.spyOn(req, 'json');
    let paramsRead = 0;
    const guardedContext = {
      get params() {
        paramsRead += 1;
        return Promise.resolve({ orderId: 'order-1' });
      },
    };

    const response = await POST(req, guardedContext);
    expect(response.status).toBe(401);
    expect(paramsRead).toBe(0);
    expect(bodyRead).not.toHaveBeenCalled();
    expect(H.prepare).not.toHaveBeenCalled();
    expect(H.commit).not.toHaveBeenCalled();
  });

  it('fails closed before params/body/service unless every Preview switch is exact and soft-deliver is off', async () => {
    const disabled: Array<() => void> = [
      () => vi.stubEnv('VERCEL_ENV', 'production'),
      () => vi.stubEnv('ALLOW_STAGING_QA', 'false'),
      () => vi.stubEnv('HUMAN_VERIFIED_UNVERIFIED_RELEASE_ENABLED', 'false'),
      () => H.readinessEnabled.mockReturnValue(false),
      () => vi.stubEnv('QA_SOFT_DELIVER', 'true'),
    ];
    for (const disable of disabled) {
      vi.stubEnv('VERCEL_ENV', 'preview');
      vi.stubEnv('ALLOW_STAGING_QA', 'true');
      vi.stubEnv('HUMAN_VERIFIED_UNVERIFIED_RELEASE_ENABLED', 'true');
      vi.stubEnv('QA_SOFT_DELIVER', 'false');
      H.readinessEnabled.mockReturnValue(true);
      disable();

      const req = request();
      const bodyRead = vi.spyOn(req, 'json');
      let paramsRead = 0;
      const guardedContext = {
        get params() {
          paramsRead += 1;
          return Promise.resolve({ orderId: 'order-1' });
        },
      };
      const response = await POST(req, guardedContext);
      expect(response.status).toBe(404);
      expect(paramsRead).toBe(0);
      expect(bodyRead).not.toHaveBeenCalled();
      expect(H.prepare).not.toHaveBeenCalled();
      expect(H.commit).not.toHaveBeenCalled();
    }
  });

  it('requires a non-empty Idempotency-Key before reading the body', async () => {
    const req = request({ idempotencyKey: null });
    const bodyRead = vi.spyOn(req, 'json');
    const response = await POST(req, context());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Idempotency-Key header required' });
    expect(bodyRead).not.toHaveBeenCalled();
    expect(H.prepare).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON and every non-exact body shape before service work', async () => {
    expect((await POST(request({ rawBody: '{broken' }), context())).status).toBe(400);

    const invalidBodies: unknown[] = [
      null,
      [],
      { ...BODY, actor: 'attacker:chosen' },
      { ...BODY, secret: 'body-secret' },
      { artifactKey: BODY.artifactKey, expectedMarker: BODY.expectedMarker, assetSha256: BODY.assetSha256 },
      { ...BODY, artifactKey: 6 },
      { ...BODY, artifactKey: 'cover' },
      { ...BODY, artifactKey: 'page:0', expectedMarker: 'safety_hold:unverified:page:0' },
      { ...BODY, artifactKey: 'page:06', expectedMarker: 'safety_hold:unverified:page:6' },
      { ...BODY, expectedMarker: 'safety_hold:hazard:page:6:unsafe_pose' },
      { ...BODY, expectedMarker: 'safety_hold:unverified:page:6,page:7' },
      { ...BODY, expectedMarker: 'safety_hold:unverified:cover' },
      { ...BODY, expectedMarker: 'safety_hold:unverified:page:7' },
      { ...BODY, assetSha256: 'A'.repeat(64) },
      { ...BODY, assetSha256: 'a'.repeat(63) },
      { ...BODY, inspectionDigest: 'A'.repeat(64) },
      { ...BODY, inspectionDigest: 'a'.repeat(63) },
      { ...BODY, reviewReason: '   ' },
    ];
    for (const body of invalidBodies) {
      const response = await POST(request({ body }), context());
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    expect(H.prepare).not.toHaveBeenCalled();
    expect(H.commit).not.toHaveBeenCalled();
  });

  it('derives the actor server-side, prepares first, then commits only the prepared request', async () => {
    const response = await POST(request({ body: {
      ...BODY,
      reviewReason: `  ${BODY.reviewReason}  `,
    } }), context());
    expect(response.status).toBe(200);
    expect(H.prepare).toHaveBeenCalledWith(H.prisma, {
      orderId: 'order-1',
      inspectionDigest: SHA,
      artifactKey: 'page:6',
      expectedMarker: 'safety_hold:unverified:page:6',
      expectedAssetSha256: SHA,
      reviewReason: BODY.reviewReason,
      actor: 'admin:exact_byte_human_verification',
      idempotencyKey: 'verify-page-6-once',
    });
    expect(H.commit).toHaveBeenCalledWith(H.prisma, {
      orderId: 'order-1',
      humanVerifiedUnverifiedRelease: { prepared: 'request' },
    });
    expect(H.prepare.mock.invocationCallOrder[0]).toBeLessThan(H.commit.mock.invocationCallOrder[0]);
    expect(await response.json()).toEqual({
      verified: true,
      shipped: true,
      manifestStatus: 'passed',
      orderStatus: 'ready',
    });
  });

  it('returns the identical privacy-safe success for a strict same-key replay without calling commit again', async () => {
    H.prepare.mockResolvedValueOnce({
      alreadyCommitted: {
        manifestStatus: 'passed',
        orderStatus: 'ready',
        enqueued: true,
        revision: 3,
        reason: 'private/internal/reason-is-not-returned',
      },
    });
    const response = await POST(request(), context());
    expect(response.status).toBe(200);
    expect(H.commit).not.toHaveBeenCalled();
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      verified: true,
      shipped: true,
      manifestStatus: 'passed',
      orderStatus: 'ready',
    });
    expect(text).not.toContain('private/internal');
  });

  it('reports success only for passed + ready + enqueued', async () => {
    for (const result of [
      { manifestStatus: 'failed', orderStatus: 'ready', enqueued: true },
      { manifestStatus: 'passed', orderStatus: 'needs_human_qa', enqueued: true },
      { manifestStatus: 'passed', orderStatus: 'ready', enqueued: false },
    ]) {
      H.commit.mockResolvedValueOnce(result);
      const response = await POST(request(), context());
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        verified: false,
        error: 'Verification did not produce a ready delivery',
        rule: 'not_ready',
      });
    }
  });

  it('maps typed admissibility and readiness precondition failures to privacy-safe 409 responses', async () => {
    H.prepare.mockRejectedValueOnce(new H.AdmissibilityError(
      'payment_snapshot_changed',
      'https://private.example/asset paymentId=pay_secret customer@example.test',
    ));
    const refused = await POST(request(), context());
    expect(refused.status).toBe(409);
    const refusedText = await refused.text();
    expect(JSON.parse(refusedText)).toEqual({
      verified: false,
      error: 'Human verification was refused',
      rule: 'payment_snapshot_changed',
    });
    expect(refusedText).not.toMatch(/private\.example|pay_secret|customer@example/i);
    expect(H.commit).not.toHaveBeenCalled();

    H.prepare.mockResolvedValueOnce({ request: { prepared: 'request' } });
    H.commit.mockRejectedValueOnce(new H.PreconditionError());
    const drifted = await POST(request(), context());
    expect(drifted.status).toBe(409);
    expect(await drifted.json()).toEqual({
      verified: false,
      error: 'Order authority changed before delivery',
      rule: 'competing_hold',
    });
    expect(H.abort).toHaveBeenCalledWith(H.prisma, {
      orderId: 'order-1',
      request: { prepared: 'request' },
      rule: 'competing_hold',
    });
  });
});
