import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  VISUAL_PACKAGE_V4_FREEZE_VERSION,
  VISUAL_PACKAGE_V4_LAYOUT_POLICY_VERSION,
  VISUAL_PACKAGE_V4_VERSION,
  type FrozenVisualPackageAuthority,
} from '@/lib/visual-package/visualPackageV4';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';
import { ReleaseV1ContinuityError } from '@/lib/generation-pipeline/release-v1-continuity';

const H = vi.hoisted(() => ({
  customerUpsert: vi.fn(),
  storeImage: vi.fn(),
  deleteDraftUpload: vi.fn(),
  wizardSessionFindUnique: vi.fn(),
  wizardSessionCreate: vi.fn(),
  wizardSessionUpdate: vi.fn(),
  wizardSessionUpdateMany: vi.fn(),
  wizardSessionUpsert: vi.fn(),
  orderFindUnique: vi.fn(),
  orderCreate: vi.fn(),
  transaction: vi.fn(),
  resolveProduct: vi.fn(),
  buildFrozenProduct: vi.fn(),
  assertOperational: vi.fn(),
  requireExpectedBinding: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: { upsert: H.customerUpsert },
    wizardSession: {
      findUnique: H.wizardSessionFindUnique,
      create: H.wizardSessionCreate,
      update: H.wizardSessionUpdate,
      updateMany: H.wizardSessionUpdateMany,
      upsert: H.wizardSessionUpsert,
    },
    order: {
      findUnique: H.orderFindUnique,
      create: H.orderCreate,
    },
    $transaction: H.transaction,
  },
}));

vi.mock('@/lib/request-security', () => ({
  enforceSameOrigin: vi.fn(() => null),
  enforceRateLimit: vi.fn(() => null),
}));

vi.mock('@/lib/auth-session', () => ({
  resolveUserFromRequest: vi.fn(async () => null),
}));

vi.mock('@/lib/image-storage', () => ({
  storeImageFromDataUrl: H.storeImage.mockImplementation(() => {
    throw new Error('route authority tests must not persist an image');
  }),
}));

vi.mock('@/lib/child-photo-deletion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/child-photo-deletion')>();
  return {
    ...actual,
    deleteDraftChildPhotoUpload: H.deleteDraftUpload,
  };
});

vi.mock('@/backend/config/mvp-story-matrix', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/backend/config/mvp-story-matrix')
  >();
  return {
    ...actual,
    enforceMvpOrderSlot: vi.fn(() => ({
      category: 'TRANSITION',
      direction: 'bedtime',
      companionId: 'chameleon_koko',
    })),
  };
});

vi.mock('@/backend/providers/story-product-resolver', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/backend/providers/story-product-resolver')
  >();
  return { ...actual, resolveStoryProductTruth: H.resolveProduct };
});

vi.mock('@/lib/generation-pipeline/frozen-product-truth', () => ({
  buildFrozenStoryProductTruth: H.buildFrozenProduct,
}));

vi.mock('@/lib/generation-pipeline/release-v1-continuity', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/generation-pipeline/release-v1-continuity')
  >();
  return {
    ...actual,
    assertReleaseV1OperationalAdmission: H.assertOperational,
    requireExpectedWizardProductBinding: H.requireExpectedBinding,
  };
});

import { POST } from '@/app/api/orders/route';
import { handleOrderPost } from '@/app/api/orders/handler';

const PACKAGE_REVISION = 'a'.repeat(64);
const PACKAGE_SOURCE_DIGEST = 'b'.repeat(64);
const PACKAGE_SOURCE =
  'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/' +
  `revisions/${PACKAGE_REVISION}/integrated.md`;

function authority(seed = 'c'): FrozenVisualPackageAuthority {
  const digest = (offset: number) =>
    ((parseInt(seed, 16) + offset) % 16).toString(16).repeat(64);
  return {
    version: VISUAL_PACKAGE_V4_FREEZE_VERSION,
    manifestVersion: VISUAL_PACKAGE_V4_VERSION,
    storyKey: 'chameleon_koko_bedtime',
    styleId: 'soft_hand_drawn_storybook',
    packagePath:
      'visual-packages/approved/chameleon_koko_bedtime/' +
      `soft_hand_drawn_storybook/revisions/${digest(0)}.visual-package.json`,
    packageRevisionDigest: digest(0),
    sourcePath: PACKAGE_SOURCE,
    sourceDigest: digest(1),
    sourceRawDigest: PACKAGE_SOURCE_DIGEST,
    blueprintDigest: digest(2),
    authoringAuthorityDigest: digest(3),
    planningApprovalDigest: digest(4),
    styleAuthorityDigest: digest(5),
    visualContractTemplateDigest: digest(6),
    reconciliationDigest: digest(7),
    layoutPolicyVersion: VISUAL_PACKAGE_V4_LAYOUT_POLICY_VERSION,
  };
}

const PACKAGE_AUTHORITY = authority('1');

function packageProduct(selectedAuthority = PACKAGE_AUTHORITY) {
  return {
    storyDirection: 'bedtime' as const,
    storyLength: 'short' as const,
    pages: 8,
    displayPages: 16,
    priceILS: 79,
    source: 'visual_package_v4' as const,
    storyFile: 'C:/offline-fixture/chameleon_koko_bedtime/integrated.md',
    visualPackageAuthority: selectedAuthority,
  };
}

function requestBody() {
  return {
    sessionId: 'wizard-session-authority-test',
    wizardData: {
      child: {
        name: 'Bar',
        age: '5',
        gender: 'boy',
        traits: [],
        imageUrl: null,
      },
      topic: 'transition',
      challenge: { selected: [], freeText: '' },
      desiredOutcome: { selected: [], freeText: '' },
      helpers: { selected: [], freeText: '' },
      avoid: { selected: [], freeText: '' },
      companionCharacterId: 'chameleon_koko',
      challengeCategory: 'TRANSITION',
      product: {
        direction: 'bedtime',
        length: 'short',
        illustrationStyle: 'soft_hand_drawn_storybook',
        audioEnabled: false,
        pdfEnabled: false,
        bundleEnabled: false,
        videoEnabled: false,
        sleepMode: false,
      },
      contact: { email: 'bar-parent@example.com', name: 'Bar Parent' },
    },
  };
}

function binding() {
  return {
    version: 'wizard-product-binding/v1' as const,
    storyKey: PACKAGE_AUTHORITY.storyKey,
    styleId: PACKAGE_AUTHORITY.styleId,
    sourcePath: PACKAGE_AUTHORITY.sourcePath,
    sourceRawDigest: PACKAGE_AUTHORITY.sourceRawDigest,
    packagePath: PACKAGE_AUTHORITY.packagePath,
    packageRevisionDigest: PACKAGE_AUTHORITY.packageRevisionDigest,
    packageAuthorityDigest: 'd'.repeat(64),
  };
}

function releaseClaim(options: {
  claimedAt?: string;
  phase?: 'claimed' | 'processing';
  embeddedBinding?: ReturnType<typeof binding> | null;
} = {}) {
  const embeddedBinding = options.embeddedBinding === undefined
    ? binding()
    : options.embeddedBinding;
  return {
    version: 'release-v1-order-claim/v1',
    ...(embeddedBinding ? { binding: embeddedBinding } : {}),
    bindingDigest: canonicalJsonDigest(binding()),
    token: '00000000-0000-4000-8000-000000000001',
    claimedAt: options.claimedAt ?? new Date().toISOString(),
    phase: options.phase ?? 'processing',
  };
}

function uniqueSessionConflict() {
  return new Prisma.PrismaClientKnownRequestError('unique session conflict', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function releaseRequest(): NextRequest {
  return new NextRequest('https://qa.smallheroes.co.il/api/release/v1/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...requestBody(), wizardProductBinding: binding() }),
  });
}

function releaseRequestWithImage(): NextRequest {
  const body = requestBody();
  return new NextRequest('https://qa.smallheroes.co.il/api/release/v1/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...body,
      wizardData: {
        ...body.wizardData,
        child: {
          ...body.wizardData.child,
          imageUrl: 'data:image/png;base64,AAAA',
        },
      },
      wizardProductBinding: binding(),
    }),
  });
}

function request(): NextRequest {
  return new NextRequest('https://qa.smallheroes.co.il/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(requestBody()),
  });
}

describe('POST /api/orders — durable Visual Package authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    H.storeImage.mockReset();
    H.storeImage.mockImplementation(() => {
      throw new Error('route authority tests must not persist an image');
    });
    H.deleteDraftUpload.mockResolvedValue(undefined);
    H.customerUpsert.mockResolvedValue({ id: 'customer-1' });
    H.wizardSessionFindUnique.mockResolvedValue(null);
    H.wizardSessionCreate.mockResolvedValue({
      id: 'wizard-session-row-1',
      data: {},
    });
    H.wizardSessionUpdate.mockResolvedValue({ id: 'wizard-session-row-1' });
    H.wizardSessionUpdateMany.mockResolvedValue({ count: 1 });
    H.wizardSessionUpsert.mockResolvedValue({ id: 'wizard-session-row-1' });
    H.orderFindUnique.mockResolvedValue(null);
    H.orderCreate.mockResolvedValue({ id: 'order-created-1' });
    H.transaction.mockImplementation(async (callback) =>
      callback({
        customer: { upsert: H.customerUpsert },
        wizardSession: { updateMany: H.wizardSessionUpdateMany },
        order: {
          findUnique: H.orderFindUnique,
          create: H.orderCreate,
        },
      }),
    );
    H.resolveProduct.mockReturnValue(packageProduct());
    H.buildFrozenProduct.mockReturnValue({
      frozenProductVersion: 'frozen-story-product/v2',
      selectionFilename: PACKAGE_SOURCE,
      storySourceHash: PACKAGE_SOURCE_DIGEST,
      expectedPageCount: 8,
    });
    H.assertOperational.mockReturnValue({});
    H.requireExpectedBinding.mockImplementation(({ expected }) => expected);
  });

  it('persists the exact resolver-selected immutable authority through release/v1', async () => {
    const response = await handleOrderPost(releaseRequest(), {
      routeProtocol: 'release/v1',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      orderId: 'order-created-1',
      wizardProductBinding: binding(),
    });
    expect(H.orderCreate).toHaveBeenCalledTimes(1);
    const createData = H.orderCreate.mock.calls[0]![0].data;
    expect(createData.selectionFilename).toBe(PACKAGE_SOURCE);
    expect(createData.storySourceHash).toBe(PACKAGE_SOURCE_DIGEST);
    expect(createData.visualPackageAuthority).toEqual(PACKAGE_AUTHORITY);
    expect(createData.visualPackageAuthority).toBe(
      PACKAGE_AUTHORITY,
    );
    expect(H.wizardSessionCreate).toHaveBeenCalledTimes(1);
    expect(H.wizardSessionUpdateMany).toHaveBeenCalledTimes(2);
    expect(H.wizardSessionUpdate).not.toHaveBeenCalled();
    expect(H.wizardSessionUpsert).not.toHaveBeenCalled();
    expect(H.resolveProduct).toHaveBeenCalledWith(
      expect.objectContaining({ illustrationStyle: 'pencil_watercolor' }),
    );
  });

  it('does not let the unversioned Order route mint a package-backed Order', async () => {
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'release_v1_order_route_required',
    });
    expect(H.customerUpsert).not.toHaveBeenCalled();
    expect(H.wizardSessionUpsert).not.toHaveBeenCalled();
    expect(H.orderCreate).not.toHaveBeenCalled();
  });

  it('serializes a same-session package mismatch before image, customer, session, or Order mutation', async () => {
    H.wizardSessionFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'wizard-session-existing-claim',
        data: {
          version: 'release-v1-order-claim/v1',
          bindingDigest: 'f'.repeat(64),
          token: 'other-claim',
          claimedAt: new Date().toISOString(),
        },
        order: null,
      });
    H.wizardSessionCreate.mockRejectedValueOnce(
      uniqueSessionConflict(),
    );

    const response = await handleOrderPost(releaseRequest(), {
      routeProtocol: 'release/v1',
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: 'release_v1_authority_mismatch',
      reasons: ['wizard session is already claimed for another package binding'],
    });
    expect(H.storeImage).not.toHaveBeenCalled();
    expect(H.customerUpsert).not.toHaveBeenCalled();
    expect(H.wizardSessionUpdate).not.toHaveBeenCalled();
    expect(H.wizardSessionUpdateMany).not.toHaveBeenCalled();
    expect(H.wizardSessionUpsert).not.toHaveBeenCalled();
    expect(H.orderCreate).not.toHaveBeenCalled();
  });

  it('stops a superseded claimant at its exact claim CAS before child-photo storage', async () => {
    H.wizardSessionUpdateMany.mockResolvedValueOnce({ count: 0 });
    const body = requestBody();
    const bodyWithImage = {
      ...body,
      wizardData: {
        ...body.wizardData,
        child: {
          ...body.wizardData.child,
          imageUrl: 'data:image/png;base64,AAAA',
        },
      },
    };
    const req = new NextRequest('https://qa.smallheroes.co.il/api/release/v1/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...bodyWithImage, wizardProductBinding: binding() }),
    });

    const response = await handleOrderPost(req, { routeProtocol: 'release/v1' });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: 'release_v1_authority_mismatch',
      reasons: ['release/v1 Order creation claim was superseded before storage'],
    });
    expect(H.storeImage).not.toHaveBeenCalled();
    expect(H.customerUpsert).not.toHaveBeenCalled();
    expect(H.transaction).not.toHaveBeenCalled();
    expect(H.orderCreate).not.toHaveBeenCalled();
  });

  it('keeps an active exact-binding claim in progress without mutating downstream state', async () => {
    H.wizardSessionFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'wizard-session-active-claim',
        data: releaseClaim(),
        order: null,
      });
    H.wizardSessionCreate.mockRejectedValueOnce(uniqueSessionConflict());

    const response = await handleOrderPost(releaseRequest(), {
      routeProtocol: 'release/v1',
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'release_v1_order_creation_in_progress',
    });
    expect(H.wizardSessionUpdateMany).not.toHaveBeenCalled();
    expect(H.storeImage).not.toHaveBeenCalled();
    expect(H.customerUpsert).not.toHaveBeenCalled();
    expect(H.transaction).not.toHaveBeenCalled();
    expect(H.orderCreate).not.toHaveBeenCalled();
  });

  it('rejects a structurally incomplete claim even when it copies the expected binding digest', async () => {
    H.wizardSessionFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'wizard-session-malformed-claim',
        data: releaseClaim({ embeddedBinding: null }),
        order: null,
      });
    H.wizardSessionCreate.mockRejectedValueOnce(uniqueSessionConflict());

    const response = await handleOrderPost(releaseRequest(), {
      routeProtocol: 'release/v1',
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: 'release_v1_authority_mismatch',
      reasons: ['wizard session is already claimed for another package binding'],
    });
    expect(H.wizardSessionUpdateMany).not.toHaveBeenCalled();
    expect(H.transaction).not.toHaveBeenCalled();
  });

  it('leaves a failed atomic Order transaction recoverable through stale-claim takeover', async () => {
    const firstFailure = new Error('simulated Order create failure');
    H.orderCreate.mockRejectedValueOnce(firstFailure);
    const firstDraftUrl =
      'https://proj.supabase.co/storage/v1/object/public/book-images/' +
      'orders/draft-first/references/main-child-1.png';
    const recoveredDraftUrl =
      'https://proj.supabase.co/storage/v1/object/public/book-images/' +
      'orders/draft-recovered/references/main-child-2.png';
    H.storeImage
      .mockResolvedValueOnce(firstDraftUrl)
      .mockResolvedValueOnce(recoveredDraftUrl);

    const first = await handleOrderPost(releaseRequestWithImage(), {
      routeProtocol: 'release/v1',
    });
    expect(first.status).toBe(500);
    expect(H.deleteDraftUpload).toHaveBeenCalledTimes(1);
    expect(H.deleteDraftUpload).toHaveBeenCalledWith({
      publicUrl: firstDraftUrl,
      draftScopeId: expect.stringMatching(/^draft-/u),
    });
    const processingClaim = H.wizardSessionUpdateMany.mock.calls[0]![0].data.data;

    H.wizardSessionFindUnique
      .mockResolvedValueOnce({ order: null })
      .mockResolvedValueOnce({
        id: 'wizard-session-row-1',
        data: {
          ...processingClaim,
          claimedAt: '2026-01-01T00:00:00.000Z',
        },
        order: null,
      });
    H.wizardSessionCreate.mockRejectedValueOnce(uniqueSessionConflict());
    H.orderCreate.mockResolvedValueOnce({ id: 'order-recovered-1' });

    const retry = await handleOrderPost(releaseRequestWithImage(), {
      routeProtocol: 'release/v1',
    });

    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ orderId: 'order-recovered-1' });
    expect(H.transaction).toHaveBeenCalledTimes(2);
    expect(H.deleteDraftUpload).toHaveBeenCalledTimes(1);
  });

  it('turns a concurrent Order unique conflict into exact immutable replay', async () => {
    const existingOrder = {
      id: 'order-concurrent-winner',
      totalPrice: 7900,
      selectionFilename: PACKAGE_SOURCE,
      storySourceHash: PACKAGE_SOURCE_DIGEST,
      illustrationStyle: 'pencil_watercolor',
      visualPackageAuthority: PACKAGE_AUTHORITY,
    };
    H.orderCreate.mockRejectedValueOnce(uniqueSessionConflict());
    H.wizardSessionFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ order: existingOrder });

    const response = await handleOrderPost(releaseRequest(), {
      routeProtocol: 'release/v1',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      orderId: 'order-concurrent-winner',
      wizardProductBinding: binding(),
    });
  });

  it('rejects package A-to-B replay from the frozen session before mutable resolution or writes', async () => {
    H.wizardSessionFindUnique.mockResolvedValueOnce({
      order: {
        id: 'order-frozen-package-a',
        totalPrice: 7900,
        selectionFilename: PACKAGE_SOURCE,
        storySourceHash: PACKAGE_SOURCE_DIGEST,
        illustrationStyle: 'pencil_watercolor',
        visualPackageAuthority: PACKAGE_AUTHORITY,
      },
    });
    H.requireExpectedBinding.mockImplementationOnce(() => {
      throw new ReleaseV1ContinuityError([
        'wizard product binding differs from the exact frozen Order package',
      ]);
    });

    const response = await handleOrderPost(releaseRequest(), {
      routeProtocol: 'release/v1',
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: 'release_v1_authority_mismatch',
    });
    expect(H.resolveProduct).not.toHaveBeenCalled();
    expect(H.storeImage).not.toHaveBeenCalled();
    expect(H.customerUpsert).not.toHaveBeenCalled();
    expect(H.transaction).not.toHaveBeenCalled();
    expect(H.orderCreate).not.toHaveBeenCalled();
  });

  it('does not let a client-authored binding opt the unversioned route into release/v1', async () => {
    const spoofed = new NextRequest('https://qa.smallheroes.co.il/api/orders', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-smallheroes-release-protocol': 'release/v1',
      },
      body: JSON.stringify({ ...requestBody(), wizardProductBinding: binding() }),
    });
    const response = await POST(spoofed);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'release_v1_order_route_required' });
    expect(H.orderCreate).not.toHaveBeenCalled();
  });

  it('replays before consulting the mutable current locator or mutating customer/session state', async () => {
    H.wizardSessionFindUnique.mockResolvedValue({
      order: {
        id: 'order-fast-replay-1',
        totalPrice: 7900,
        selectionFilename: PACKAGE_SOURCE,
        storySourceHash: PACKAGE_SOURCE_DIGEST,
        illustrationStyle: 'pencil_watercolor',
        visualPackageAuthority: PACKAGE_AUTHORITY,
      },
    });
    H.resolveProduct.mockImplementation(() => {
      throw new Error('mutable current locator must be unreachable on replay');
    });

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      orderId: 'order-fast-replay-1',
      totalPrice: 79,
    });
    expect(H.resolveProduct).not.toHaveBeenCalled();
    expect(H.customerUpsert).not.toHaveBeenCalled();
    expect(H.wizardSessionUpsert).not.toHaveBeenCalled();
    expect(H.orderFindUnique).not.toHaveBeenCalled();
    expect(H.orderCreate).not.toHaveBeenCalled();
  });

  it('fails closed instead of reusing a package-backed Order whose authority is missing', async () => {
    H.orderFindUnique.mockResolvedValue({
      id: 'order-existing-invalid',
      totalPrice: 7900,
      selectionFilename: PACKAGE_SOURCE,
      storySourceHash: PACKAGE_SOURCE_DIGEST,
      illustrationStyle: 'soft_hand_drawn_storybook',
      visualPackageAuthority: null,
    });

    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'release_v1_order_route_required',
    });
    expect(H.orderCreate).not.toHaveBeenCalled();
  });

  it('preserves the legacy product shape without inventing package authority', async () => {
    H.resolveProduct.mockReturnValue({
      storyDirection: 'bedtime',
      storyLength: 'short',
      pages: 8,
      displayPages: 16,
      priceILS: 79,
      source: 'v3_approved_binding',
      storyFile: 'C:/offline-fixture/story-bank/v3-approved/legacy.md',
    });
    H.buildFrozenProduct.mockReturnValue({
      frozenProductVersion: 'frozen-story-product/v2',
      selectionFilename: 'story-bank/v3-approved/legacy.md',
      storySourceHash: 'f'.repeat(64),
      expectedPageCount: 8,
    });

    const response = await POST(request());
    expect(response.status).toBe(200);
    const createData = H.orderCreate.mock.calls[0]![0].data;
    expect(createData.selectionFilename).toBe(
      'story-bank/v3-approved/legacy.md',
    );
    expect(createData).not.toHaveProperty('visualPackageAuthority');
  });
});
