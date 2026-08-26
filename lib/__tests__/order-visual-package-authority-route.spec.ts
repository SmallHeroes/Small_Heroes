import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  VISUAL_PACKAGE_V4_FREEZE_VERSION,
  VISUAL_PACKAGE_V4_LAYOUT_POLICY_VERSION,
  VISUAL_PACKAGE_V4_VERSION,
  type FrozenVisualPackageAuthority,
} from '@/lib/visual-package/visualPackageV4';

const H = vi.hoisted(() => ({
  customerUpsert: vi.fn(),
  wizardSessionFindUnique: vi.fn(),
  wizardSessionUpsert: vi.fn(),
  orderFindUnique: vi.fn(),
  orderCreate: vi.fn(),
  resolveProduct: vi.fn(),
  buildFrozenProduct: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: { upsert: H.customerUpsert },
    wizardSession: {
      findUnique: H.wizardSessionFindUnique,
      upsert: H.wizardSessionUpsert,
    },
    order: {
      findUnique: H.orderFindUnique,
      create: H.orderCreate,
    },
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
  storeImageFromDataUrl: vi.fn(() => {
    throw new Error('route authority tests must not persist an image');
  }),
}));

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

import { POST } from '@/app/api/orders/route';

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
    H.customerUpsert.mockResolvedValue({ id: 'customer-1' });
    H.wizardSessionFindUnique.mockResolvedValue(null);
    H.wizardSessionUpsert.mockResolvedValue({ id: 'wizard-session-row-1' });
    H.orderFindUnique.mockResolvedValue(null);
    H.orderCreate.mockResolvedValue({ id: 'order-created-1' });
    H.resolveProduct.mockReturnValue(packageProduct());
    H.buildFrozenProduct.mockReturnValue({
      frozenProductVersion: 'frozen-story-product/v2',
      selectionFilename: PACKAGE_SOURCE,
      storySourceHash: PACKAGE_SOURCE_DIGEST,
      expectedPageCount: 8,
    });
  });

  it('persists the exact resolver-selected immutable authority with the accepted Story Source', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ orderId: 'order-created-1' });
    expect(H.orderCreate).toHaveBeenCalledTimes(1);
    const createData = H.orderCreate.mock.calls[0]![0].data;
    expect(createData.selectionFilename).toBe(PACKAGE_SOURCE);
    expect(createData.storySourceHash).toBe(PACKAGE_SOURCE_DIGEST);
    expect(createData.visualPackageAuthority).toEqual(PACKAGE_AUTHORITY);
    expect(createData.visualPackageAuthority).toBe(
      PACKAGE_AUTHORITY,
    );
    expect(H.resolveProduct).toHaveBeenCalledWith(
      expect.objectContaining({ illustrationStyle: 'pencil_watercolor' }),
    );
  });

  it('rejects a resolver package whose style does not match the persisted Order style', async () => {
    H.resolveProduct.mockReturnValue(
      packageProduct({
        ...PACKAGE_AUTHORITY,
        styleId: 'expressive_painterly_storybook',
      }),
    );

    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'order_visual_package_authority_invalid',
    });
    expect(H.customerUpsert).not.toHaveBeenCalled();
    expect(H.wizardSessionUpsert).not.toHaveBeenCalled();
    expect(H.orderCreate).not.toHaveBeenCalled();
  });

  it('replays the existing Order authority even after the resolver selects a newer current package', async () => {
    const historicalAuthority = PACKAGE_AUTHORITY;
    H.resolveProduct.mockReturnValue(packageProduct(authority('8')));
    H.orderFindUnique.mockResolvedValue({
      id: 'order-existing-1',
      totalPrice: 7900,
      selectionFilename: PACKAGE_SOURCE,
      storySourceHash: PACKAGE_SOURCE_DIGEST,
      illustrationStyle: 'soft_hand_drawn_storybook',
      visualPackageAuthority: historicalAuthority,
    });

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      orderId: 'order-existing-1',
      totalPrice: 79,
    });
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
      error: 'order_visual_package_authority_conflict',
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
