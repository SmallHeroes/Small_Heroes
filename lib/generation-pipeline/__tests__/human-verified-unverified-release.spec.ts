import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Prisma } from '@prisma/client';

import {
  deliveredUrlHash,
  humanVerifiedUnverifiedPreparedOutcome,
  humanVerificationSnapshotDigest,
  humanVerifiedUnverifiedRequestHash,
  isHumanVerifiedUnverifiedReleaseEnvironmentEnabled,
  parseHumanVerifiedUnverifiedPreparedOutcome,
  parsePassingResemblanceProof,
  projectHumanVerificationOntoQuality,
  requiredResemblanceArtifactsFromRows,
  resemblanceProofDigest,
  validateHumanVerifiedUnverifiedRequest,
  HUMAN_VERIFIED_UNVERIFIED_PREPARED_VERSION,
  type HumanVerifiedUnverifiedReleaseRequest,
} from '@/lib/generation-pipeline/human-verified-unverified-release';
import {
  QUALITY_EVALUATOR_CONTRACT_VERSION,
  type QualityEvidenceRow,
} from '@/lib/generation-pipeline/quality-evidence';
import {
  PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
  PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
} from '@/lib/generation-pipeline/page-child-resemblance-vision';
import {
  humanVerifiedUnverifiedResemblanceProofDigest,
  type HumanVerifiedUnverifiedResemblanceProof,
} from '@/lib/generation-pipeline/human-verified-unverified-contract';
import { hasStrictHumanVerificationPaymentAuthority } from '@/lib/generation-pipeline/human-verified-unverified-authority';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);
const SHA_D = 'd'.repeat(64);
const SHA_E = 'e'.repeat(64);
const SHA_F = 'f'.repeat(64);

describe('strict human-verification payment authority', () => {
  const order = {
    stripePaid: true,
    paymentProvider: 'stripe',
    paymentId: 'pi_1',
    totalPrice: 79,
  };
  const payment = {
    id: 'payment-record-1',
    provider: 'stripe',
    amount: 79,
    currency: 'ILS',
    paid: true,
    paidAt: new Date('2026-09-01T10:00:00.000Z'),
  };

  it('accepts only a timestamped paid record bound to the Order provider', () => {
    expect(
      hasStrictHumanVerificationPaymentAuthority({ order, payment }),
    ).toBe(true);
  });

  it.each([
    ['missing Order provider', { order: { ...order, paymentProvider: ' ' }, payment }],
    ['missing Order payment id', { order: { ...order, paymentId: '' }, payment }],
    ['provider mismatch', { order, payment: { ...payment, provider: 'payme' } }],
    ['missing paidAt', { order, payment: { ...payment, paidAt: null } }],
    ['missing Stripe paid flag', { order: { ...order, stripePaid: false }, payment }],
  ])('rejects %s', (_label, authority) => {
    expect(hasStrictHumanVerificationPaymentAuthority(authority)).toBe(false);
  });
});

describe('isHumanVerifiedUnverifiedReleaseEnvironmentEnabled — exact Preview boundary', () => {
  const envKeys = [
    'VERCEL_ENV',
    'ALLOW_STAGING_QA',
    'HUMAN_VERIFIED_UNVERIFIED_RELEASE_ENABLED',
    'QA_SOFT_DELIVER',
  ] as const;
  let saved: Record<(typeof envKeys)[number], string | undefined>;

  function enablePreviewBoundary(): void {
    process.env.VERCEL_ENV = 'preview';
    process.env.ALLOW_STAGING_QA = 'true';
    process.env.HUMAN_VERIFIED_UNVERIFIED_RELEASE_ENABLED = 'true';
    delete process.env.QA_SOFT_DELIVER;
  }

  beforeEach(() => {
    saved = Object.fromEntries(
      envKeys.map((key) => [key, process.env[key]]),
    ) as Record<(typeof envKeys)[number], string | undefined>;
    enablePreviewBoundary();
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('enables only the exact preview + two exact true flags with soft-deliver off', () => {
    expect(isHumanVerifiedUnverifiedReleaseEnvironmentEnabled()).toBe(true);
  });

  it.each(['production', 'development', 'Preview', 'preview ', ''])(
    'rejects VERCEL_ENV=%j',
    (value) => {
      process.env.VERCEL_ENV = value;
      expect(isHumanVerifiedUnverifiedReleaseEnvironmentEnabled()).toBe(false);
    },
  );

  it.each([
    'ALLOW_STAGING_QA',
    'HUMAN_VERIFIED_UNVERIFIED_RELEASE_ENABLED',
  ] as const)('rejects a missing %s', (key) => {
    delete process.env[key];
    expect(isHumanVerifiedUnverifiedReleaseEnvironmentEnabled()).toBe(false);
  });

  it.each([
    ['ALLOW_STAGING_QA', 'TRUE'],
    ['ALLOW_STAGING_QA', '1'],
    ['ALLOW_STAGING_QA', ' true '],
    ['HUMAN_VERIFIED_UNVERIFIED_RELEASE_ENABLED', 'TRUE'],
    ['HUMAN_VERIFIED_UNVERIFIED_RELEASE_ENABLED', '1'],
    ['HUMAN_VERIFIED_UNVERIFIED_RELEASE_ENABLED', ' true '],
  ] as const)('rejects non-exact %s=%j', (key, value) => {
    process.env[key] = value;
    expect(isHumanVerifiedUnverifiedReleaseEnvironmentEnabled()).toBe(false);
  });

  it('rejects exact QA_SOFT_DELIVER=true but not other spellings or explicit false', () => {
    process.env.QA_SOFT_DELIVER = 'true';
    expect(isHumanVerifiedUnverifiedReleaseEnvironmentEnabled()).toBe(false);
    process.env.QA_SOFT_DELIVER = 'TRUE';
    expect(isHumanVerifiedUnverifiedReleaseEnvironmentEnabled()).toBe(true);
    process.env.QA_SOFT_DELIVER = 'false';
    expect(isHumanVerifiedUnverifiedReleaseEnvironmentEnabled()).toBe(true);
  });
});

function releaseRequest(
  overrides: Partial<HumanVerifiedUnverifiedReleaseRequest> = {},
): HumanVerifiedUnverifiedReleaseRequest {
  const requiredResemblanceArtifacts =
    overrides.requiredResemblanceArtifacts ?? ['page:2', 'page:6'];
  const resemblanceProofs = requiredResemblanceArtifacts.map(
    (artifactKey, index): HumanVerifiedUnverifiedResemblanceProof => ({
      artifactKey,
      assetId: `asset-${artifactKey.replace('page:', '')}`,
      deliveredUrlHash: index === 0 ? SHA_B : SHA_C,
      deliveredBytesSha256: SHA_B,
      referenceBytesSha256: SHA_A,
      referenceImageUrlHash: SHA_D,
      evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
      resemblanceScore: PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
      threshold: PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
      subjectVisible: true,
      sameChild: true,
      source: 'raw_same_bytes',
    }),
  );
  return {
    inspectionDigest: SHA_F,
    refundAuthorityDigest: SHA_E,
    artifactKey: 'page:6',
    expectedMarker: 'safety_hold:unverified:page:6',
    expectedCaseId: 'case-6',
    expectedCaseRevision: 3,
    expectedCaseFingerprint: SHA_A,
    expectedAssetId: 'asset-6',
    expectedAssetSha256: SHA_B,
    expectedDeliveredUrlHash: SHA_C,
    expectedAnchorEntryDigest: SHA_D,
    expectedAnchorUrlHash: SHA_E,
    expectedAnchorBytesSha256: SHA_F,
    expectedContractHash: SHA_D,
    expectedEvaluatorVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
    snapshotDigest: SHA_E,
    paymentSnapshotDigest: SHA_F,
    resemblanceProofDigest: humanVerifiedUnverifiedResemblanceProofDigest(
      resemblanceProofs,
    ),
    resemblanceProofs,
    requiredResemblanceArtifacts,
    reviewReason: 'Reviewed the exact delivered bytes and found no hazard.',
    actor: 'operator@example.com',
    idempotencyKey: 'human-review-page-6-v1',
    ...overrides,
  };
}

function passingGate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    required: true,
    status: 'passed',
    evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
    resemblanceScore: PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
    threshold: PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
    subjectVisible: true,
    sameChild: true,
    deliveredBytesSha256: SHA_B,
    referenceBytesSha256: SHA_A,
    referenceImageUrl: 'https://assets.example/lavi-reference.png',
    source: 'raw_same_bytes',
    ...overrides,
  };
}

function qualityRow(args: {
  artifactKey: string;
  assetSha256?: string;
  gate?: Record<string, unknown>;
  expectsChild?: boolean;
  evidence?: Record<string, unknown>;
}): QualityEvidenceRow {
  return {
    id: `evidence-${args.artifactKey}`,
    artifactKey: args.artifactKey,
    assetSha256: args.assetSha256 ?? SHA_B,
    verdict: 'evidence_unknown',
    evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
    reason: 'safety:unverified+vision_malformed',
    regenCount: 2,
    contractHash: SHA_D,
    safetyOverride: false,
    safetyOverrideSha256: null,
    evidence: (args.evidence ?? {
      qaContext: { expectsChild: args.expectsChild ?? true },
      pageResemblanceGate: args.gate ?? passingGate(),
    }) as Prisma.JsonValue,
    evaluatedAt: new Date('2026-09-02T00:00:00.000Z'),
    reviewStatus: null,
    reviewedAssetSha256: null,
    reviewedContractHash: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewReason: null,
  };
}

describe('validateHumanVerifiedUnverifiedRequest', () => {
  it('accepts exactly one canonical page-only unverified hold and binds the same artifact page', () => {
    expect(validateHumanVerifiedUnverifiedRequest(releaseRequest())).toEqual({
      pageNumber: 6,
    });
  });

  it('rejects cover, aggregate, hazard, released, malformed, and artifact-mismatched markers', () => {
    const invalid: HumanVerifiedUnverifiedReleaseRequest[] = [
      releaseRequest({ expectedMarker: 'safety_hold:unverified:cover' }),
      releaseRequest({ expectedMarker: 'safety_hold:unverified:page:6,page:7' }),
      releaseRequest({ expectedMarker: 'safety_hold:hazard:page:6:height' }),
      releaseRequest({ expectedMarker: 'qa_human_verified:safety:unverified:page:6' }),
      releaseRequest({ expectedMarker: 'safety_hold:unverified:page:06' }),
      releaseRequest({ artifactKey: 'page:7' }),
    ];
    for (const request of invalid) {
      expect(() => validateHumanVerifiedUnverifiedRequest(request)).toThrow(
        /invalid_request/,
      );
    }
  });

  it('requires every digest/SHA field to be lowercase 64-hex', () => {
    const shaFields: Array<
      keyof Pick<
        HumanVerifiedUnverifiedReleaseRequest,
        | 'expectedCaseFingerprint'
        | 'expectedAssetSha256'
        | 'expectedDeliveredUrlHash'
        | 'expectedAnchorEntryDigest'
        | 'expectedAnchorUrlHash'
        | 'expectedAnchorBytesSha256'
        | 'expectedContractHash'
        | 'snapshotDigest'
        | 'paymentSnapshotDigest'
        | 'resemblanceProofDigest'
      >
    > = [
      'expectedCaseFingerprint',
      'expectedAssetSha256',
      'expectedDeliveredUrlHash',
      'expectedAnchorEntryDigest',
      'expectedAnchorUrlHash',
      'expectedAnchorBytesSha256',
      'expectedContractHash',
      'snapshotDigest',
      'paymentSnapshotDigest',
      'resemblanceProofDigest',
    ];
    for (const field of shaFields) {
      expect(() =>
        validateHumanVerifiedUnverifiedRequest(
          releaseRequest({ [field]: 'A'.repeat(64) }),
        ),
      ).toThrow(/invalid_request/);
    }
  });

  it('requires a unique, sorted page-key set that includes the target', () => {
    const invalidSets = [
      ['page:6', 'page:2'],
      ['page:2', 'page:2', 'page:6'],
      ['page:2', 'page:7'],
      ['cover', 'page:6'],
      ['page:06', 'page:6'],
    ];
    for (const requiredResemblanceArtifacts of invalidSets) {
      expect(() =>
        validateHumanVerifiedUnverifiedRequest(
          releaseRequest({ requiredResemblanceArtifacts }),
        ),
      ).toThrow(/invalid_request/);
    }
  });

  it('requires the current evaluator contract version', () => {
    expect(() =>
      validateHumanVerifiedUnverifiedRequest(
        releaseRequest({ expectedEvaluatorVersion: 'qa-v2' }),
      ),
    ).toThrow(/invalid_request/);
  });
});

describe('parseHumanVerifiedUnverifiedPreparedOutcome — exact provider-spend claim', () => {
  it('parses a valid prepared outcome without changing the request', () => {
    const request = releaseRequest();
    const prepared = humanVerifiedUnverifiedPreparedOutcome(request);

    expect(prepared).toEqual({
      version: HUMAN_VERIFIED_UNVERIFIED_PREPARED_VERSION,
      request,
    });
    expect(parseHumanVerifiedUnverifiedPreparedOutcome(prepared)).toEqual(
      request,
    );
  });

  it('rejects extra, missing, wrong, and wrong-version top-level keys', () => {
    const request = releaseRequest();
    const invalid: unknown[] = [
      {
        ...humanVerifiedUnverifiedPreparedOutcome(request),
        extra: true,
      },
      { version: HUMAN_VERIFIED_UNVERIFIED_PREPARED_VERSION },
      { request },
      {
        version: HUMAN_VERIFIED_UNVERIFIED_PREPARED_VERSION,
        payload: request,
      },
      {
        versoin: HUMAN_VERIFIED_UNVERIFIED_PREPARED_VERSION,
        request,
      },
      {
        version: 'human_verified_unverified_prepared/v0',
        request,
      },
      {
        version: 1,
        request,
      },
    ];

    for (const value of invalid) {
      expect(parseHumanVerifiedUnverifiedPreparedOutcome(value)).toBeNull();
    }
  });

  it('rejects an extra, missing, or misspelled request key', () => {
    const request = releaseRequest();
    const { actor, ...withoutActor } = request;
    const invalid: unknown[] = [
      humanVerifiedUnverifiedPreparedOutcome({
        ...request,
        unexpected: true,
      } as HumanVerifiedUnverifiedReleaseRequest),
      {
        version: HUMAN_VERIFIED_UNVERIFIED_PREPARED_VERSION,
        request: withoutActor,
      },
      {
        version: HUMAN_VERIFIED_UNVERIFIED_PREPARED_VERSION,
        request: { ...withoutActor, reviewer: actor },
      },
    ];

    for (const value of invalid) {
      expect(parseHumanVerifiedUnverifiedPreparedOutcome(value)).toBeNull();
    }
  });

  const wrongTypes: Array<
    [keyof HumanVerifiedUnverifiedReleaseRequest, unknown]
  > = [
    ['artifactKey', 6],
    ['expectedMarker', 6],
    ['expectedCaseId', 6],
    ['expectedCaseRevision', '3'],
    ['expectedCaseFingerprint', 6],
    ['expectedAssetId', 6],
    ['expectedAssetSha256', 6],
    ['expectedDeliveredUrlHash', 6],
    ['expectedAnchorEntryDigest', 6],
    ['expectedAnchorUrlHash', 6],
    ['expectedAnchorBytesSha256', 6],
    ['expectedContractHash', 6],
    ['expectedEvaluatorVersion', 6],
    ['snapshotDigest', 6],
    ['refundAuthorityDigest', 6],
    ['paymentSnapshotDigest', 6],
    ['resemblanceProofDigest', 6],
    ['resemblanceProofs', 6],
    ['requiredResemblanceArtifacts', 6],
    ['reviewReason', 6],
    ['actor', 6],
    ['idempotencyKey', 6],
  ];

  it.each(wrongTypes)('rejects a wrong type for %s', (field, value) => {
    const request = { ...releaseRequest(), [field]: value };
    expect(
      parseHumanVerifiedUnverifiedPreparedOutcome({
        version: HUMAN_VERIFIED_UNVERIFIED_PREPARED_VERSION,
        request,
      }),
    ).toBeNull();
  });

  it('preserves the exposed request-hash binding and drifts when a prepared request is changed', () => {
    const request = releaseRequest();
    const parsed = parseHumanVerifiedUnverifiedPreparedOutcome(
      humanVerifiedUnverifiedPreparedOutcome(request),
    );
    const changed = parseHumanVerifiedUnverifiedPreparedOutcome(
      humanVerifiedUnverifiedPreparedOutcome({
        ...request,
        expectedAssetSha256: SHA_C,
      }),
    );

    expect(parsed).not.toBeNull();
    expect(changed).not.toBeNull();
    expect(humanVerifiedUnverifiedRequestHash('order-1', parsed!)).toBe(
      humanVerifiedUnverifiedRequestHash('order-1', request),
    );
    expect(humanVerifiedUnverifiedRequestHash('order-1', changed!)).not.toBe(
      humanVerifiedUnverifiedRequestHash('order-1', request),
    );
  });
});

describe('required resemblance set and strict passing-proof parser', () => {
  it('derives the complete unique page-only set in deterministic sorted order', () => {
    const rows = [
      qualityRow({ artifactKey: 'page:6', expectsChild: true }),
      qualityRow({
        artifactKey: 'page:2',
        expectsChild: false,
        gate: passingGate({ required: true }),
      }),
      qualityRow({
        artifactKey: 'page:9',
        expectsChild: false,
        gate: passingGate({ required: false }),
      }),
      qualityRow({ artifactKey: 'cover', expectsChild: true }),
      qualityRow({ artifactKey: 'page:2', expectsChild: true }),
    ];
    expect(requiredResemblanceArtifactsFromRows(rows)).toEqual([
      'page:2',
      'page:6',
    ]);
  });

  it('uses numeric page order for two-digit page numbers across validation and proof sets', () => {
    const request = releaseRequest({
      artifactKey: 'page:2',
      expectedMarker: 'safety_hold:unverified:page:2',
      requiredResemblanceArtifacts: ['page:2', 'page:10'],
    });
    expect(() => validateHumanVerifiedUnverifiedRequest(request)).not.toThrow();
    expect(requiredResemblanceArtifactsFromRows([
      qualityRow({ artifactKey: 'page:10', expectsChild: true }),
      qualityRow({ artifactKey: 'page:2', expectsChild: true }),
    ])).toEqual(['page:2', 'page:10']);
  });

  it('accepts an exact 0.70 score at the 0.70 threshold', () => {
    const proof = parsePassingResemblanceProof(
      qualityRow({ artifactKey: 'page:6', gate: passingGate() }),
    );
    expect(proof).toMatchObject({
      artifactKey: 'page:6',
      resemblanceScore: 0.7,
      threshold: 0.7,
      subjectVisible: true,
      sameChild: true,
    });
  });

  it('rejects a 0.699999 score at the 0.70 threshold', () => {
    expect(
      parsePassingResemblanceProof(
        qualityRow({
          artifactKey: 'page:6',
          gate: passingGate({ resemblanceScore: 0.699999 }),
        }),
      ),
    ).toBeNull();
  });

  const inadmissible: Array<[string, Record<string, unknown>]> = [
    ['wrong evaluator', { evaluatorVersion: 'page-child-resemblance-vision/v0' }],
    ['wrong status', { status: 'evidence_unknown' }],
    ['different child', { sameChild: false }],
    ['subject hidden', { subjectVisible: false }],
    ['different delivered bytes', { deliveredBytesSha256: SHA_C }],
    ['malformed reference bytes hash', { referenceBytesSha256: 'not-a-sha' }],
    ['score above one', { resemblanceScore: 2 }],
    ['threshold above one', { threshold: 2, resemblanceScore: 2 }],
    ['lowered threshold', { threshold: 0.699999, resemblanceScore: 1 }],
    ['unbound source', { source: 'presentation_url' }],
  ];

  for (const [label, gateOverride] of inadmissible) {
    it(`rejects ${label}`, () => {
      expect(
        parsePassingResemblanceProof(
          qualityRow({
            artifactKey: 'page:6',
            gate: passingGate(gateOverride),
          }),
        ),
      ).toBeNull();
    });
  }
});

describe('digest stability and drift', () => {
  it('keeps the request hash stable across required-set order but drifts on byte identity', () => {
    const request = releaseRequest();
    const first = humanVerifiedUnverifiedRequestHash('order-1', request);
    const reordered = humanVerifiedUnverifiedRequestHash('order-1', {
      ...request,
      requiredResemblanceArtifacts: [...request.requiredResemblanceArtifacts].reverse(),
    });
    const changedAsset = humanVerifiedUnverifiedRequestHash('order-1', {
      ...request,
      expectedAssetSha256: SHA_C,
    });
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(reordered).toBe(first);
    expect(changedAsset).not.toBe(first);
  });

  it('keeps the complete resemblance digest stable across row/set order and drifts on proof evidence', () => {
    const page2 = qualityRow({
      artifactKey: 'page:2',
      assetSha256: SHA_A,
      gate: passingGate({
        resemblanceScore: 0.8,
        deliveredBytesSha256: SHA_A,
      }),
    });
    const page6 = qualityRow({
      artifactKey: 'page:6',
      assetSha256: SHA_B,
      gate: passingGate({ resemblanceScore: 0.7 }),
    });
    const bindings = new Map([
      ['page:2', { assetId: 'asset-2', deliveredUrl: 'https://assets.example/page-2.png' }],
      ['page:6', { assetId: 'asset-6', deliveredUrl: 'https://assets.example/page-6.png' }],
    ]);
    const first = resemblanceProofDigest(
      [page2, page6],
      ['page:2', 'page:6'],
      bindings,
    );
    const reordered = resemblanceProofDigest(
      [page6, page2],
      ['page:6', 'page:2'],
      bindings,
    );
    const drifted = resemblanceProofDigest(
      [
        page2,
        qualityRow({
          artifactKey: 'page:6',
          assetSha256: SHA_B,
          gate: passingGate({ resemblanceScore: 0.71 }),
        }),
      ],
      ['page:2', 'page:6'],
      bindings,
    );
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(reordered).toBe(first);
    expect(drifted).not.toBe(first);
    expect(resemblanceProofDigest([page6], ['page:2', 'page:6'], bindings)).toBeNull();
  });

  it('keeps the frozen human-verification snapshot stable and drifts on delivered bytes', () => {
    const order = {
      id: 'order-1',
      status: 'needs_human_qa',
      deliveryHoldReason: 'safety_hold:unverified:page:6',
      deliveryFenceVersion: 4,
      inputVersion: 9,
      manualReviewRequired: false,
      visualContractHash: SHA_D,
      visualPackageAuthority: { version: 'visual-authority/v1' },
      stripePaid: true,
      paymentProvider: 'stripe',
      paymentId: 'payment-1',
      stripePaymentId: 'pi_1',
      totalPrice: 79,
    };
    const reviewCase = {
      id: 'case-6',
      revision: 3,
      kind: 'safety',
      status: 'open',
      holdFingerprint: SHA_A,
      rawReason: 'safety_hold:unverified:page:6',
      inputVersion: 9,
      contractHash: SHA_D,
    };
    const target = {
      pageId: 'book-page-6',
      pageNumber: 6,
      assetId: 'asset-6',
      url: 'https://assets.example/page-6.png',
      presentationUrl: null,
      safetyVerified: false,
      safetyHazards: [] as string[],
      safetyContentSha256: SHA_B,
      safetyOverriddenHazards: [] as string[],
      safetyOverrideSha256: null,
    };
    const evidence = qualityRow({ artifactKey: 'page:6' });
    const first = humanVerificationSnapshotDigest({
      order,
      reviewCase,
      target,
      evidence,
    });
    const repeated = humanVerificationSnapshotDigest({
      order,
      reviewCase,
      target,
      evidence,
    });
    const changedUrl = humanVerificationSnapshotDigest({
      order,
      reviewCase,
      target: { ...target, url: 'https://assets.example/page-6-v2.png' },
      evidence,
    });
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(repeated).toBe(first);
    expect(changedUrl).not.toBe(first);
    expect(deliveredUrlHash(target.url)).not.toBe(
      deliveredUrlHash('https://assets.example/page-6-v2.png'),
    );
  });
});

describe('projectHumanVerificationOntoQuality', () => {
  it('sets humanReviewVerified on only the target row and does not mutate the input', () => {
    const target = qualityRow({ artifactKey: 'page:6' });
    const other = qualityRow({ artifactKey: 'page:2', assetSha256: SHA_A });
    const rows = [target, other];
    const before = rows.map((row) => ({ ...row }));

    const projected = projectHumanVerificationOntoQuality(
      rows,
      releaseRequest(),
      'order-1',
    );

    expect(projected).toEqual([
      {
        ...target,
        humanReviewVerified: true,
        humanReviewActionDigest: humanVerifiedUnverifiedRequestHash(
          'order-1',
          releaseRequest(),
        ),
      },
      other,
    ]);
    expect(rows).toEqual(before);
    expect(projected[0]).not.toBe(target);
    expect(projected[1]).toBe(other);
  });
});
