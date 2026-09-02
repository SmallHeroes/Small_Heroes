import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROUTE = path.join(
  process.cwd(),
  'app/api/admin/review/cases/[orderId]/actions/verify-unverified/route.ts',
);

describe('verify-unverified route — source invariants', () => {
  const source = readFileSync(ROUTE, 'utf8');

  it('is Node-only, uses the dedicated service/mode, and never calls the legacy hazard release mode', () => {
    expect(source).toContain(`export const runtime = 'nodejs'`);
    expect(source).toContain('export const maxDuration = 300');
    expect(source).toContain('prepareHumanVerifiedUnverifiedRelease');
    expect(source).toContain('humanVerifiedUnverifiedRelease: preparedRequest');
    expect(source).not.toMatch(/\brelease:\s*prepared\.request/);
    expect(source).not.toContain('SafetyReleaseRequest');
    expect(source).toContain('abortPreparedHumanVerifiedUnverifiedRelease');
  });

  it('authenticates before params/body/service and has no logging surface for sensitive details', () => {
    const auth = source.indexOf('assertAdminSecret(req)');
    const params = source.indexOf('await context.params');
    const body = source.indexOf('await req.json()');
    const service = source.indexOf('await prepareHumanVerifiedUnverifiedRelease');
    expect(auth).toBeGreaterThan(-1);
    expect(auth).toBeLessThan(params);
    expect(params).toBeLessThan(body);
    expect(body).toBeLessThan(service);
    expect(source).not.toMatch(/createLogger|\blog\.|console\./);
  });

  it('fixes the actor server-side and encodes the closed digest-bound five-key body grammar', () => {
    expect(source).toContain(`const ACTOR = 'admin:exact_byte_human_verification'`);
    expect(source).toContain(`const BODY_KEYS = ['artifactKey', 'assetSha256', 'expectedMarker', 'inspectionDigest', 'reviewReason'] as const`);
    expect(source).not.toMatch(/decoded\.actor|body\.actor/);
    expect(source).not.toMatch(/decoded\.secret|body\.secret/);
  });

  it('contains every hard Preview gate and no response projection of URLs, payment IDs, or secrets', () => {
    for (const predicate of [
      `process.env.VERCEL_ENV === 'preview'`,
      `process.env.ALLOW_STAGING_QA === 'true'`,
      `process.env.HUMAN_VERIFIED_UNVERIFIED_RELEASE_ENABLED === 'true'`,
      'isReadinessManifestEnabled()',
      `process.env.QA_SOFT_DELIVER !== 'true'`,
    ]) {
      expect(source).toContain(predicate);
    }
    expect(source).not.toMatch(/accessKey|paymentId|stripePaymentId|deliveredUrl|presentationUrl/);
  });
});
