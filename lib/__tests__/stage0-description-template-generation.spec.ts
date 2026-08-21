import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  generateGPTImage: vi.fn(),
  uploadOrderSubpathAsset: vi.fn(),
  evaluateImageFaceSignal: vi.fn(),
  describeChildFromPhoto: vi.fn(),
  evaluateAnchorStyleFromVision: vi.fn(),
}));

vi.mock('@/lib/generate-image', async (importOriginal) => {
  const original = await importOriginal<typeof import('../generate-image')>();
  return { ...original, generateGPTImage: mocks.generateGPTImage };
});

vi.mock('@/lib/image-storage', () => ({
  uploadOrderSubpathAsset: mocks.uploadOrderSubpathAsset,
}));

vi.mock('@/lib/resemblance-core', async (importOriginal) => {
  const original = await importOriginal<typeof import('../resemblance-core')>();
  return { ...original, evaluateImageFaceSignal: mocks.evaluateImageFaceSignal };
});

vi.mock('@/backend/providers/story-bank-loader', () => ({
  describeChildFromPhoto: mocks.describeChildFromPhoto,
}));

vi.mock('@/lib/anchor-style-qa', () => ({
  evaluateAnchorStyleFromVision: mocks.evaluateAnchorStyleFromVision,
}));

import { generateStage0DescriptionTemplateAnchor } from '../generation-pipeline/stage0-method-b';

describe('Stage 0 description-template generation boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateGPTImage.mockResolvedValue({
      buffer: Buffer.from('generated-image'),
      model: 'gpt-image-2',
    });
    mocks.uploadOrderSubpathAsset.mockResolvedValue('https://example.test/generated-anchor.png');
    mocks.evaluateImageFaceSignal.mockResolvedValue({
      faceCount: 1,
      faceAreaRatio: 0.2,
      faceDetectConfidence: 0.92,
    });
    mocks.describeChildFromPhoto.mockResolvedValue('A five-year-old boy with short curly black hair.');
    mocks.evaluateAnchorStyleFromVision.mockResolvedValue({
      ok: true,
      style01Match: true,
      looksPhotoreal: false,
      looksPortrait: false,
      notes: 'Watercolor storybook child.',
    });
  });

  it('uses template authority, LOW image policy, and semantic/style QA without resemblance scoring', async () => {
    const result = await generateStage0DescriptionTemplateAnchor({
      order: {
        id: 'ord-no-photo',
        illustrationStyle: 'soft_hand_drawn_storybook',
        childGender: 'boy',
        childAge: 5,
      } as unknown as Order,
      lockedChildDescription: 'Short curly black hair, warm brown skin, dark eyes.',
      wardrobeLock: 'BOOK WARDROBE LOCK: teal pajamas.',
      childStructuredHair: 'short curly black hair',
      attemptSuffix: 'a1',
    });

    expect(mocks.generateGPTImage).toHaveBeenCalledTimes(1);
    const request = mocks.generateGPTImage.mock.calls[0][0];
    expect(request.referenceMode).toBe('anchor_template');
    expect(request.requireReferenceEdit).toBe(true);
    expect(request.quality).toBe('low');
    expect(request.referenceImages[0].replace(/\\/g, '/')).toMatch(/01-child-template\/boy\.png$/);
    expect(request.finalPrompt).toContain('CHILD VISUAL LOCK');
    expect(request.finalPrompt).not.toMatch(/PHOTO IDENTITY|raw child photo|resemblance|likeness/i);
    expect(mocks.uploadOrderSubpathAsset).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'ord-no-photo',
      subpath: 'character-anchors/child-canonical-description-a1.png',
    }));
    expect(mocks.evaluateImageFaceSignal).toHaveBeenCalledWith(result.anchorUrl);
    expect(mocks.evaluateAnchorStyleFromVision).toHaveBeenCalledWith(result.anchorUrl);
    expect(result.semantic.ok).toBe(true);
    expect(result.styleQa.ok).toBe(true);
    expect(result).not.toHaveProperty('resemblanceScore');
    expect(result).not.toHaveProperty('embeddingVerdict');
  });
});
