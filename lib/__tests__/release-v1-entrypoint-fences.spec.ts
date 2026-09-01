import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReleaseV1ContinuityError } from '@/lib/generation-pipeline/release-v1-continuity';

const H = vi.hoisted(() => ({
  orderFindUnique: vi.fn(),
  orderUpdate: vi.fn(),
  orderUpdateMany: vi.fn(),
  generationJobFindUnique: vi.fn(),
  generationJobUpdate: vi.fn(),
  transaction: vi.fn(),
  reserveCoupon: vi.fn(),
  createPaymeCheckout: vi.fn(),
  triggerGeneration: vi.fn(),
  startChunkedGeneration: vi.fn(),
  runGenerationWorkerInvocation: vi.fn(),
  paymentRecordUpsert: vi.fn(),
  requirePackage: vi.fn(),
  requireExpected: vi.fn(),
  assertOperational: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: H.orderFindUnique,
      update: H.orderUpdate,
      updateMany: H.orderUpdateMany,
    },
    generationJob: {
      findUnique: H.generationJobFindUnique,
      update: H.generationJobUpdate,
    },
    paymentRecord: { upsert: H.paymentRecordUpsert },
    $transaction: H.transaction,
  },
}));
vi.mock('@/lib/env', () => ({
  env: {
    PAYMENT_PROVIDER: 'fake',
    SITE_PASSWORD: undefined,
    NEXT_PUBLIC_BUY_MODE: 'live',
  },
  canUseFakePayments: vi.fn(() => true),
  isFakePaymentEnabled: vi.fn(() => true),
  isWaitlistMode: vi.fn(() => false),
}));
vi.mock('@/lib/request-security', () => ({
  enforceSameOrigin: vi.fn(() => null),
  enforceRateLimit: vi.fn(() => null),
}));
vi.mock('@/lib/resemblance-core', () => ({
  evaluatePhotoGate: vi.fn(async () => ({ warnings: [] })),
}));
vi.mock('@/lib/coupon/coupon-service', () => ({
  reserveCoupon: H.reserveCoupon,
  releaseCouponForOrder: vi.fn(),
  confirmCouponForOrder: vi.fn(),
  couponConfirmFenceReason: vi.fn(),
  releaseCouponForFailedPayment: vi.fn(),
}));
vi.mock('@/lib/payme', () => ({ createPaymeCheckout: H.createPaymeCheckout }));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock('@/app/api/generate/trigger', () => ({
  triggerGeneration: H.triggerGeneration,
}));
vi.mock('@/lib/human-qa/sync-hold-case', () => ({
  syncHumanQaHoldCasePostCommit: vi.fn(),
}));
vi.mock('@/lib/generation-pipeline/order-authority', () => ({
  writeOrderHoldFenced: vi.fn(),
}));
vi.mock('@/lib/dev-only-guard', () => ({ isDevEnvironment: vi.fn(() => true) }));
vi.mock('@/lib/generation-chunked/start', () => ({
  startChunkedGeneration: H.startChunkedGeneration,
}));
vi.mock('@/lib/generation-chunked/process-worker', () => ({
  runGenerationWorkerInvocation: H.runGenerationWorkerInvocation,
}));
vi.mock('@/lib/generation-pipeline/release-v1-continuity', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/generation-pipeline/release-v1-continuity')
  >();
  return {
    ...actual,
    assertReleaseV1OperationalAdmission: H.assertOperational,
    requireReleaseV1OrderPackage: H.requirePackage,
    requireExpectedWizardProductBinding: H.requireExpected,
    releaseV1AuthorityCasWhere: vi.fn(() => ({ visualPackageAuthority: { equals: {} } })),
  };
});

const packageBacked = {
  id: 'package-order',
  visualPackageAuthority: { version: 'frozen-visual-package-authority/v1' },
};
const acceptedWithoutAuthority = {
  id: 'accepted-without-authority',
  selectionFilename:
    `story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/${'a'.repeat(64)}/integrated.md`,
  visualPackageAuthority: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  H.orderFindUnique.mockResolvedValue(packageBacked);
  H.assertOperational.mockReturnValue({});
  H.requirePackage.mockReturnValue({ binding: { version: 'wizard-product-binding/v1' } });
  H.requireExpected.mockReturnValue({ version: 'wizard-product-binding/v1' });
});

describe('unversioned mutation routes cannot accept package-backed release Orders', () => {
  it('checkout rejects before lease, coupon reservation or provider call', async () => {
    const { POST } = await import('@/app/api/checkout/route');
    const response = await POST(new NextRequest('https://qa.example/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: 'package-order' }),
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'release_v1_checkout_route_required' });
    expect(H.orderUpdateMany).not.toHaveBeenCalled();
    expect(H.reserveCoupon).not.toHaveBeenCalled();
    expect(H.createPaymeCheckout).not.toHaveBeenCalled();
  });

  it('checkout cannot degrade an accepted Story Source with missing authority into legacy', async () => {
    H.orderFindUnique.mockResolvedValue(acceptedWithoutAuthority);
    const { POST } = await import('@/app/api/checkout/route');
    const response = await POST(new NextRequest('https://qa.example/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: acceptedWithoutAuthority.id }),
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'release_v1_checkout_route_required' });
    expect(H.orderUpdateMany).not.toHaveBeenCalled();
    expect(H.reserveCoupon).not.toHaveBeenCalled();
    expect(H.createPaymeCheckout).not.toHaveBeenCalled();
  });

  it('fake-payment confirm rejects before transaction, payment write or generation trigger', async () => {
    H.orderFindUnique.mockResolvedValue({
      ...packageBacked,
      status: 'pending_payment',
      paymentProvider: 'fake',
      paymentId: 'fake-package-order',
      totalPrice: 7900,
    });
    const { POST } = await import('@/app/api/dev/fake-payment/confirm/route');
    const response = await POST(new NextRequest('https://qa.example/api/dev/fake-payment/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orderId: 'package-order',
        paymentId: 'fake-package-order',
        result: 'success',
      }),
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'release_v1_fake_payment_route_required' });
    expect(H.transaction).not.toHaveBeenCalled();
    expect(H.triggerGeneration).not.toHaveBeenCalled();
  });

  it('fake-payment confirm cannot degrade an accepted Story Source with missing authority into legacy', async () => {
    H.orderFindUnique.mockResolvedValue({
      ...acceptedWithoutAuthority,
      status: 'pending_payment',
      paymentProvider: 'fake',
      paymentId: 'fake-accepted-order',
      totalPrice: 7900,
    });
    const { POST } = await import('@/app/api/dev/fake-payment/confirm/route');
    const response = await POST(new NextRequest('https://qa.example/api/dev/fake-payment/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orderId: acceptedWithoutAuthority.id,
        paymentId: 'fake-accepted-order',
        result: 'success',
      }),
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'release_v1_fake_payment_route_required' });
    expect(H.transaction).not.toHaveBeenCalled();
    expect(H.triggerGeneration).not.toHaveBeenCalled();
  });

  it('dev resume rejects before resetting the job lease or progress', async () => {
    H.generationJobFindUnique.mockResolvedValue({
      orderId: 'package-order',
      currentStage: 'page_images',
      order: { visualPackageAuthority: packageBacked.visualPackageAuthority },
    });
    const { POST } = await import('@/app/api/dev/generation/resume/route');
    const response = await POST(new NextRequest('https://qa.example/api/dev/generation/resume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: 'package-order' }),
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'release_v1_resume_route_required' });
    expect(H.generationJobUpdate).not.toHaveBeenCalled();
    expect(H.startChunkedGeneration).not.toHaveBeenCalled();
    expect(H.runGenerationWorkerInvocation).not.toHaveBeenCalled();
  });

  it('dev resume cannot reset an accepted Story Source with missing authority as legacy', async () => {
    H.generationJobFindUnique.mockResolvedValue({
      orderId: acceptedWithoutAuthority.id,
      currentStage: 'page_images',
      order: acceptedWithoutAuthority,
    });
    const { POST } = await import('@/app/api/dev/generation/resume/route');
    const response = await POST(new NextRequest('https://qa.example/api/dev/generation/resume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: acceptedWithoutAuthority.id }),
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'release_v1_resume_route_required' });
    expect(H.generationJobUpdate).not.toHaveBeenCalled();
    expect(H.startChunkedGeneration).not.toHaveBeenCalled();
  });

  it('versioned paid CAS=0 with authority drift returns 409 and writes no payment', async () => {
    const initial = {
      ...packageBacked,
      status: 'pending_payment',
      paymentProvider: 'fake',
      paymentId: 'fake-package-order',
      totalPrice: 7900,
    };
    H.orderFindUnique.mockResolvedValue(initial);
    const txFind = vi.fn()
      .mockResolvedValueOnce({ ...initial, generationJob: null })
      .mockResolvedValueOnce({ ...initial, storySourceHash: 'changed' });
    const txUpdateMany = vi.fn(async () => ({ count: 0 }));
    H.transaction.mockImplementation(async (work) => work({
      order: { findUnique: txFind, updateMany: txUpdateMany },
      paymentRecord: { upsert: H.paymentRecordUpsert },
    }));
    H.requireExpected
      .mockReturnValueOnce({ version: 'wizard-product-binding/v1' })
      .mockImplementationOnce(() => {
        throw new ReleaseV1ContinuityError(['authority drift']);
      });

    const { POST } = await import('@/app/api/release/v1/fake-payment/confirm/route');
    const response = await POST(new NextRequest(
      'https://qa.example/api/release/v1/fake-payment/confirm',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: 'package-order',
          paymentId: 'fake-package-order',
          result: 'success',
        }),
      },
    ));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'release_v1_authority_mismatch',
      reasons: ['authority drift'],
    });
    expect(H.paymentRecordUpsert).not.toHaveBeenCalled();
    expect(H.triggerGeneration).not.toHaveBeenCalled();
  });

  it('revalidates a terminal duplicate success snapshot before returning its redirect', async () => {
    const initial = {
      ...packageBacked,
      status: 'pending_payment',
      paymentProvider: 'fake',
      paymentId: 'fake-package-order',
      totalPrice: 7900,
    };
    H.orderFindUnique.mockResolvedValue(initial);
    H.transaction.mockImplementation(async (work) => work({
      order: {
        findUnique: vi.fn(async () => ({
          ...initial,
          status: 'ready',
          generationJob: { id: 'job-ready' },
        })),
        updateMany: H.orderUpdateMany,
      },
      paymentRecord: { upsert: H.paymentRecordUpsert },
    }));
    H.requireExpected.mockImplementationOnce(() => {
      throw new ReleaseV1ContinuityError(['terminal authority drift']);
    });

    const { POST } = await import('@/app/api/release/v1/fake-payment/confirm/route');
    const response = await POST(new NextRequest(
      'https://qa.example/api/release/v1/fake-payment/confirm',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: 'package-order',
          paymentId: 'fake-package-order',
          result: 'success',
        }),
      },
    ));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'release_v1_authority_mismatch',
      reasons: ['terminal authority drift'],
    });
    expect(H.orderUpdateMany).not.toHaveBeenCalled();
    expect(H.paymentRecordUpsert).not.toHaveBeenCalled();
    expect(H.triggerGeneration).not.toHaveBeenCalled();
  });

  it('rejects a success callback whose payment attempt was superseded inside the transaction', async () => {
    const initial = {
      ...packageBacked,
      status: 'pending_payment',
      paymentProvider: 'fake',
      paymentId: 'fake-attempt-a',
      totalPrice: 7900,
    };
    H.orderFindUnique.mockResolvedValue(initial);
    H.transaction.mockImplementation(async (work) => work({
      order: {
        findUnique: vi.fn(async () => ({
          ...initial,
          paymentId: 'fake-attempt-b',
          generationJob: null,
        })),
        updateMany: H.orderUpdateMany,
      },
      paymentRecord: { upsert: H.paymentRecordUpsert },
    }));

    const { POST } = await import('@/app/api/release/v1/fake-payment/confirm/route');
    const response = await POST(new NextRequest(
      'https://qa.example/api/release/v1/fake-payment/confirm',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: 'package-order',
          paymentId: 'fake-attempt-a',
          result: 'success',
        }),
      },
    ));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'release_v1_authority_mismatch',
      reasons: ['fake-payment attempt was superseded before paid transition'],
    });
    expect(H.orderUpdateMany).not.toHaveBeenCalled();
    expect(H.paymentRecordUpsert).not.toHaveBeenCalled();
    expect(H.triggerGeneration).not.toHaveBeenCalled();
  });

  it('rejects a failure callback whose payment attempt was superseded inside the transaction', async () => {
    const initial = {
      ...packageBacked,
      status: 'pending_payment',
      paymentProvider: 'fake',
      paymentId: 'fake-attempt-a',
      totalPrice: 7900,
    };
    H.orderFindUnique.mockResolvedValue(initial);
    H.transaction.mockImplementation(async (work) => work({
      order: {
        findUnique: vi.fn(async () => ({
          ...initial,
          paymentId: 'fake-attempt-b',
        })),
        updateMany: H.orderUpdateMany,
      },
      paymentRecord: { upsert: H.paymentRecordUpsert },
    }));

    const { POST } = await import('@/app/api/release/v1/fake-payment/confirm/route');
    const response = await POST(new NextRequest(
      'https://qa.example/api/release/v1/fake-payment/confirm',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: 'package-order',
          paymentId: 'fake-attempt-a',
          result: 'failed',
        }),
      },
    ));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'release_v1_authority_mismatch',
      reasons: ['fake-payment attempt was superseded before failure transition'],
    });
    expect(H.orderUpdateMany).not.toHaveBeenCalled();
    expect(H.paymentRecordUpsert).not.toHaveBeenCalled();
    expect(H.triggerGeneration).not.toHaveBeenCalled();
  });

  it('versioned checkout releases its exact attempt lease when a coupon is rejected', async () => {
    H.orderFindUnique.mockResolvedValue({
      ...packageBacked,
      status: 'draft',
      storyLength: 'medium',
      storyDirection: 'bedtime',
      audioEnabled: false,
      pdfEnabled: false,
      bundleEnabled: false,
      videoEnabled: false,
      couponCode: null,
      childImageUrl: null,
      childName: 'Bar',
      customerEmail: 'parent@example.com',
      customerName: 'Parent',
    });
    H.orderUpdateMany.mockResolvedValue({ count: 1 });
    H.reserveCoupon.mockResolvedValue({ ok: false, reason: 'maxed_out' });
    const { handleCheckoutPost } = await import('@/app/api/checkout/handler');
    const response = await handleCheckoutPost(
      new NextRequest('https://qa.example/api/release/v1/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: 'package-order',
          couponCode: 'FIRST100',
          wizardProductBinding: { version: 'wizard-product-binding/v1' },
        }),
      }),
      { routeProtocol: 'release/v1' },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'coupon_rejected',
      reason: 'maxed_out',
    });
    expect(H.orderUpdateMany).toHaveBeenCalledTimes(2);
    const lease = H.orderUpdateMany.mock.calls[0]![0];
    expect(H.orderUpdateMany.mock.calls[1]![0]).toEqual({
      where: {
        id: 'package-order',
        checkoutAttemptToken: lease.data.checkoutAttemptToken,
      },
      data: { checkoutAttemptToken: null, checkoutAttemptAt: null },
    });
    expect(H.createPaymeCheckout).not.toHaveBeenCalled();
  });

  it('versioned fake-checkout publication failure is caught and releases its exact claim', async () => {
    H.orderFindUnique.mockResolvedValue({
      ...packageBacked,
      status: 'draft',
      storyLength: 'medium',
      storyDirection: 'bedtime',
      audioEnabled: false,
      pdfEnabled: false,
      bundleEnabled: false,
      videoEnabled: false,
      couponCode: null,
      childImageUrl: null,
      childName: 'Bar',
      customerEmail: 'parent@example.com',
      customerName: 'Parent',
    });
    H.orderUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(new Error('fake checkout publication failed'))
      .mockResolvedValueOnce({ count: 1 });

    const { handleCheckoutPost } = await import('@/app/api/checkout/handler');
    const response = await handleCheckoutPost(
      new NextRequest('https://qa.example/api/release/v1/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: 'package-order',
          wizardProductBinding: { version: 'wizard-product-binding/v1' },
        }),
      }),
      { routeProtocol: 'release/v1' },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to create checkout session' });
    expect(H.orderUpdateMany).toHaveBeenCalledTimes(3);
    const lease = H.orderUpdateMany.mock.calls[0]![0];
    expect(H.orderUpdateMany.mock.calls[2]![0]).toEqual({
      where: {
        id: 'package-order',
        checkoutAttemptToken: lease.data.checkoutAttemptToken,
      },
      data: { checkoutAttemptToken: null, checkoutAttemptAt: null },
    });
  });
});
