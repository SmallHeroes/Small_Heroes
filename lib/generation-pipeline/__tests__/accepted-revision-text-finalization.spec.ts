import path from 'path';

import type { Order } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generationJobUpdate: vi.fn(async () => ({})),
  loadStoryFromBank: vi.fn(),
  orderUpdate: vi.fn(async () => ({})),
  selectCompanionStory: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    generatedBook: { findUnique: vi.fn() },
    generationJob: { update: mocks.generationJobUpdate },
    order: { update: mocks.orderUpdate },
  },
}));

vi.mock('@/backend/providers/story-bank-loader', async () => {
  const actual = await vi.importActual<
    typeof import('@/backend/providers/story-bank-loader')
  >('@/backend/providers/story-bank-loader');
  return { ...actual, loadStoryFromBank: mocks.loadStoryFromBank };
});

vi.mock('@/backend/providers/story-bank-index', async () => {
  const actual = await vi.importActual<
    typeof import('@/backend/providers/story-bank-index')
  >('@/backend/providers/story-bank-index');
  return { ...actual, selectCompanionStory: mocks.selectCompanionStory };
});

import { buildFrozenStoryProductTruth } from '../frozen-product-truth';
import { finalizeAndPersistStoryText } from '../text-finalization';
import { evaluateWizardVisualPackageSelection } from '@/lib/visual-package/wizardVisualPackageSelection';
import { STYLE_IDS } from '@/lib/styles';

const SOURCE_REF =
  'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb/integrated.md';
const SOURCE_PATH = path.join(process.cwd(), ...SOURCE_REF.split('/'));

function order(overrides: Partial<Order> = {}): Order {
  const frozen = buildFrozenStoryProductTruth({
    storyFilePath: SOURCE_PATH,
    expectedPageCount: 8,
    storyDirection: 'bedtime',
  });
  const selection = evaluateWizardVisualPackageSelection({
    repoRoot: process.cwd(),
    storyKey: 'chameleon_koko_bedtime',
    styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  });
  if (!selection.frozenAuthority) {
    throw new Error('published Chameleon authority fixture is missing');
  }
  return {
    id: 'accepted-revision-order',
    characterAnchors: {
      _wizard: {
        challengeCategory: 'TRANSITION',
        companionCharacterId: 'chameleon_koko',
      },
    },
    childGender: 'boy',
    childName: 'בר',
    expectedPageCount: frozen.expectedPageCount,
    frozenProductVersion: frozen.frozenProductVersion,
    selectionFilename: frozen.selectionFilename,
    storyDirection: 'bedtime',
    storyLength: 'short',
    storySourceHash: frozen.storySourceHash,
    topic: 'TRANSITION',
    illustrationStyle: 'SOFT_HAND_DRAWN_STORYBOOK',
    visualPackageAuthority: selection.frozenAuthority,
    ...overrides,
  } as Order;
}

describe('accepted-revision text finalization boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects frozen source byte drift before personalization or legacy fallback', async () => {
    const changedDigest = '0'.repeat(64);
    const base = order();
    await expect(
      finalizeAndPersistStoryText(
        order({
          storySourceHash: changedDigest,
          visualPackageAuthority: {
            ...(base.visualPackageAuthority as object),
            sourceRawDigest: changedDigest,
          },
        }),
        {},
      ),
    ).rejects.toThrow(
      'Frozen Order Story Source authority does not match repository bytes',
    );
    expect(mocks.loadStoryFromBank).not.toHaveBeenCalled();
    expect(mocks.selectCompanionStory).not.toHaveBeenCalled();
    expect(mocks.orderUpdate).toHaveBeenLastCalledWith({
      where: { id: 'accepted-revision-order' },
      data: {
        textStatus: 'failed',
        lastError:
          'Frozen Order Story Source authority does not match repository bytes',
      },
    });
    expect(mocks.generationJobUpdate).toHaveBeenLastCalledWith({
      where: { orderId: 'accepted-revision-order' },
      data: {
        status: 'failed',
        currentStage: 'failed',
        retryable: true,
        lastError:
          'Frozen Order Story Source authority does not match repository bytes',
      },
    });
  });

  it('rejects malformed accepted-revision refs instead of selecting the old QA bank', async () => {
    await expect(
      finalizeAndPersistStoryText(
        order({
          selectionFilename:
            'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/not-a-digest/integrated.md',
        }),
        {},
      ),
    ).rejects.toThrow('Product-accepted Story Source reference is invalid');
    expect(mocks.loadStoryFromBank).not.toHaveBeenCalled();
    expect(mocks.selectCompanionStory).not.toHaveBeenCalled();
  });

  it('does not admit an accepted revision from cache without frozen Order authority', async () => {
    await expect(
      finalizeAndPersistStoryText(
        order({
          expectedPageCount: null,
          frozenProductVersion: null,
          selectionFilename: null,
          storySourceHash: null,
        }),
        { storyFilePath: SOURCE_REF },
      ),
    ).rejects.toThrow(
      'Accepted-revision cache source lacks exact frozen Order authority',
    );
    expect(mocks.loadStoryFromBank).not.toHaveBeenCalled();
    expect(mocks.selectCompanionStory).not.toHaveBeenCalled();
  });

  it('does not reconstruct a legacy bank path from an accepted-authority cache marker', async () => {
    await expect(
      finalizeAndPersistStoryText(
        order({
          expectedPageCount: null,
          frozenProductVersion: null,
          selectionFilename: null,
          storySourceHash: null,
        }),
        {
          storyDir: 'qa-autonomous-20260815-v1',
          storyKey: 'chameleon_koko_bedtime',
          storySourceAuthorityKind: 'product_accepted_revision',
          selectionFilename: 'chameleon_koko_bedtime.md',
        },
      ),
    ).rejects.toThrow(
      'Accepted-revision cache source lacks exact frozen Order authority',
    );
    expect(mocks.loadStoryFromBank).not.toHaveBeenCalled();
    expect(mocks.selectCompanionStory).not.toHaveBeenCalled();
  });

  it('rejects a product-accepted Story Source that belongs to another Wizard slot', async () => {
    await expect(
      finalizeAndPersistStoryText(order({ storyDirection: 'adventure' }), {}),
    ).rejects.toThrow(
      'Product-accepted Story Source identity does not match the Wizard product',
    );
    expect(mocks.loadStoryFromBank).not.toHaveBeenCalled();
    expect(mocks.selectCompanionStory).not.toHaveBeenCalled();
  });

  it('uses the exact frozen accepted source on resume without legacy fallback', async () => {
    const stop = new Error('stop_after_exact_source_observation');
    mocks.loadStoryFromBank.mockRejectedValueOnce(stop);

    await expect(
      finalizeAndPersistStoryText(order(), {
        storyFilePath:
          'story-bank/qa-autonomous-20260815-v1/chameleon_koko_bedtime.md',
        storyDir: 'qa-autonomous-20260815-v1',
        selectionFilename: 'chameleon_koko_bedtime.md',
      }),
    ).rejects.toBe(stop);

    expect(mocks.loadStoryFromBank).toHaveBeenCalledTimes(1);
    expect(mocks.loadStoryFromBank.mock.calls[0]?.[0]).toBe(SOURCE_PATH);
    expect(mocks.selectCompanionStory).not.toHaveBeenCalled();
    expect(mocks.orderUpdate).toHaveBeenCalledWith({
      where: { id: 'accepted-revision-order' },
      data: { textStatus: 'running' },
    });
  });
});
