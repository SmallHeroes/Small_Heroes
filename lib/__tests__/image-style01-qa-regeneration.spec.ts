import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageInput } from '@/backend/providers/image';
import type { PageVisualQaResult } from '@/lib/generation-pipeline/page-visual-qa';

const { evaluateQaSpy, generateGptSpy, resemblanceSpy, storeBufferSpy } = vi.hoisted(() => ({
  evaluateQaSpy: vi.fn(),
  generateGptSpy: vi.fn(),
  resemblanceSpy: vi.fn(),
  storeBufferSpy: vi.fn(),
}));

vi.mock('@/lib/generation-pipeline/page-visual-qa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/generation-pipeline/page-visual-qa')>();
  return {
    ...actual,
    evaluatePageVisualQaWithReQa: evaluateQaSpy,
  };
});

vi.mock('@/lib/generate-image', () => ({
  generateGPTImage: generateGptSpy,
  generateReplicateImage: vi.fn(),
  resolveGPTImageEditMaxReferences: () => 16,
}));

vi.mock('@/lib/image-storage', () => ({
  storeImageFromBuffer: storeBufferSpy,
  storeImageFromProviderUrl: vi.fn(),
  isImagePersistenceError: () => false,
}));

vi.mock('@/lib/generation-pipeline/page-child-resemblance-vision', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/generation-pipeline/page-child-resemblance-vision')>();
  return {
    ...actual,
    evaluateStoredPageChildResemblanceVision: resemblanceSpy,
  };
});

import {
  generateAllPageImages,
  generateBookCover,
  generateImage,
} from '@/backend/providers/image';

const FLAGS: PageVisualQaResult['flags'] = {
  anatomyOk: true,
  identityOk: true,
  styleOk: true,
  singleChildOk: true,
  objectGeometryOk: true,
  emotionalStagingOk: true,
  timeOfDayOk: true,
  companionSilhouetteOk: true,
  childPresenceOk: true,
  safetyOk: true,
};

function qaResult(overrides: Partial<PageVisualQaResult>): PageVisualQaResult {
  return {
    passed: true,
    verdict: 'passed',
    reason: 'ok',
    details: 'ok',
    flags: { ...FLAGS },
    safetyHazards: [],
    safetyStatus: 'safe',
    ...overrides,
  };
}

const VERIFIED_PASS = qaResult({});
const VERIFIED_FAILURE = qaResult({
  passed: false,
  verdict: 'failed',
  reason: 'anatomy_failed',
  details: 'verified anatomy defect',
});

function pageVision(score: number) {
  const passed = score >= 0.7;
  return {
    result: {
      evaluatorVersion: 'page-child-resemblance-vision/v1',
      status: passed ? 'passed' : 'failed',
      resemblanceScore: score,
      threshold: 0.7,
      subjectVisible: true,
      sameChild: true,
      reasonCode: passed ? null : 'below_threshold',
      attempts: 1,
      model: 'vision-test',
      featureAssessments: {
        faceStructure: 'match', eyesBrows: 'match', noseMouth: 'match',
        hairIdentity: 'match', distinctiveFeatures: 'match',
      },
    },
    referenceBytesSha256: 'a'.repeat(64),
    candidateBytesSha256: 'b'.repeat(64),
  };
}

function baseInput(overrides: Partial<ImageInput> = {}): ImageInput {
  return {
    pagePrompt: 'A small child stands safely on the floor in a calm room.',
    illustrationStyle: 'soft_hand_drawn_storybook',
    orderId: 'order-r1a',
    pageNumber: 4,
    totalPages: 10,
    ...overrides,
  };
}

describe('shipped Style01 caller — QA evidence versus image-regeneration budget', () => {
  beforeEach(() => {
    vi.stubEnv('PHASE2_STYLE01_BOOK_PIPELINE', 'true');
    vi.stubEnv('PAGE_VISUAL_QA_ENABLED', 'true');
    vi.stubEnv('PAGE_VISUAL_QA_MAX_REGENS', '2');
    vi.stubEnv('STYLE_01_GPT_MODEL', 'gpt-image-1');
    vi.stubEnv('GPT_IMAGE_QUALITY', 'low');

    evaluateQaSpy.mockReset();
    generateGptSpy.mockReset();
    storeBufferSpy.mockReset();
    resemblanceSpy.mockReset();
    resemblanceSpy.mockResolvedValue(pageVision(0.8));
    generateGptSpy.mockResolvedValue({
      buffer: Buffer.from('mock-image-bytes'),
      model: 'gpt-image-1',
      finalPrompt: 'assembled prompt',
      durationMs: 1,
      usage: null,
    });
    storeBufferSpy.mockImplementation(async ({ pageNumber }: { pageNumber?: number }) =>
      `https://cdn.example/order-r1a/page-${pageNumber}-${storeBufferSpy.mock.calls.length}.png`
    );

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([
    ['persistent malformed', qaResult({ verdict: 'evidence_unknown', reason: 'vision_malformed', safetyStatus: 'unverified' })],
    ['transport / HTTP error', qaResult({ verdict: 'evidence_unknown', reason: 'vision_error', safetyStatus: 'unverified' })],
    ['timeout', qaResult({ verdict: 'evidence_unknown', reason: 'vision_timeout', safetyStatus: 'unverified' })],
    ['skipped / unavailable vision', qaResult({ verdict: 'evidence_unknown', reason: 'vision_skipped', safetyStatus: 'unverified' })],
    ['unknown strict follow-up evidence', qaResult({ verdict: 'evidence_unknown', reason: 'ok', safetyStatus: 'safe' })],
  ])('%s holds the uploaded candidate and consumes zero regeneration budget', async (_label, qa) => {
    const reserve = vi.fn(async () => true);
    const persistCandidate = vi.fn(async () => {});
    evaluateQaSpy.mockResolvedValue(qa);

    const result = await generateImage(baseInput({
      reserveQualityRegen: reserve,
      onCandidateUploaded: persistCandidate,
    }));

    expect(generateGptSpy).toHaveBeenCalledTimes(1);
    expect(storeBufferSpy).toHaveBeenCalledTimes(1);
    expect(persistCandidate).toHaveBeenCalledTimes(1);
    expect(evaluateQaSpy).toHaveBeenCalledTimes(1);
    expect(reserve).not.toHaveBeenCalled();
    expect(result.url).toContain('page-4-1.png');
    expect(result.style01Meta?.pageVisualQa?.verdict).toBe('evidence_unknown');
    expect(result.style01Meta?.needsHumanReview).toBe(true);
  });

  it('verified pass returns the persisted candidate without reserving or regenerating', async () => {
    const reserve = vi.fn(async () => true);
    evaluateQaSpy.mockResolvedValue(VERIFIED_PASS);

    const result = await generateImage(baseInput({
      reserveQualityRegen: reserve,
      onCandidateUploaded: vi.fn(async () => {}),
    }));

    expect(generateGptSpy).toHaveBeenCalledTimes(1);
    expect(reserve).not.toHaveBeenCalled();
    expect(result.style01Meta?.pageVisualQa?.verdict).toBe('passed');
    expect(result.style01Meta?.needsHumanReview).toBe(false);
  });

  it('enforces the required numeric page gate on the same candidate and passes at 0.70', async () => {
    const reserve = vi.fn(async () => true);
    evaluateQaSpy.mockResolvedValue(VERIFIED_PASS);
    resemblanceSpy.mockResolvedValueOnce(pageVision(0.7));

    const result = await generateImage(baseInput({
      reserveQualityRegen: reserve,
      onCandidateUploaded: vi.fn(async () => {}),
      pageResemblanceGate: {
        referenceImageUrl: 'https://cdn.example/order-r1a/approved-anchor.png',
        effectiveThreshold: 0.7,
        minAcceptableScore: 0.55,
      },
    }));

    expect(generateGptSpy).toHaveBeenCalledTimes(1);
    expect(resemblanceSpy).toHaveBeenCalledWith({
      referenceImageUrl: 'https://cdn.example/order-r1a/approved-anchor.png',
      candidateImageUrl: 'https://cdn.example/order-r1a/page-4-1.png',
      threshold: 0.7,
    });
    expect(reserve).not.toHaveBeenCalled();
    expect(result.style01Meta?.pageResemblanceGate).toMatchObject({
      status: 'passed',
      resemblanceScore: 0.7,
      threshold: 0.7,
    });
    expect(result.style01Meta?.pageVisualQa?.verdict).toBe('passed');
  });

  it('uses the shared durable budget for a verified below-threshold replacement', async () => {
    const reserve = vi.fn(async () => true);
    evaluateQaSpy.mockResolvedValue(VERIFIED_PASS);
    resemblanceSpy
      .mockResolvedValueOnce(pageVision(0.69))
      .mockResolvedValueOnce(pageVision(0.71));

    const result = await generateImage(baseInput({
      reserveQualityRegen: reserve,
      onCandidateUploaded: vi.fn(async () => {}),
      pageResemblanceGate: {
        referenceImageUrl: 'https://cdn.example/order-r1a/approved-anchor.png',
        effectiveThreshold: 0.7,
        minAcceptableScore: 0.55,
      },
    }));

    expect(generateGptSpy).toHaveBeenCalledTimes(2);
    expect(resemblanceSpy).toHaveBeenCalledTimes(2);
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(result.style01Meta?.pageVisualQa).toMatchObject({
      verdict: 'passed',
      regenAttempts: 1,
    });
    expect(result.style01Meta?.pageResemblanceGate?.status).toBe('passed');
  });

  it('holds after one candidate plus two numeric-gate replacements', async () => {
    const reserve = vi.fn(async () => true);
    evaluateQaSpy.mockResolvedValue(VERIFIED_PASS);
    resemblanceSpy.mockResolvedValue(pageVision(0.69));

    const result = await generateImage(baseInput({
      reserveQualityRegen: reserve,
      onCandidateUploaded: vi.fn(async () => {}),
      pageResemblanceGate: {
        referenceImageUrl: 'https://cdn.example/order-r1a/approved-anchor.png',
        effectiveThreshold: 0.7,
        minAcceptableScore: 0.55,
      },
    }));

    expect(generateGptSpy).toHaveBeenCalledTimes(3);
    expect(resemblanceSpy).toHaveBeenCalledTimes(3);
    expect(reserve).toHaveBeenCalledTimes(2);
    expect(result.style01Meta?.pageVisualQa).toMatchObject({
      passed: false,
      verdict: 'failed',
      reason: 'child_resemblance_below_threshold',
      regenAttempts: 2,
    });
    expect(result.style01Meta?.needsHumanReview).toBe(true);
  });

  it('holds scorer-unavailable evidence without buying replacement bytes', async () => {
    const reserve = vi.fn(async () => true);
    evaluateQaSpy.mockResolvedValue(VERIFIED_PASS);
    resemblanceSpy.mockRejectedValueOnce(new Error('scorer unavailable'));

    const result = await generateImage(baseInput({
      reserveQualityRegen: reserve,
      onCandidateUploaded: vi.fn(async () => {}),
      pageResemblanceGate: {
        referenceImageUrl: 'https://cdn.example/order-r1a/approved-anchor.png',
        effectiveThreshold: 0.7,
        minAcceptableScore: 0.55,
      },
    }));

    expect(generateGptSpy).toHaveBeenCalledTimes(1);
    expect(reserve).not.toHaveBeenCalled();
    expect(result.style01Meta?.pageVisualQa).toMatchObject({
      passed: false,
      verdict: 'evidence_unknown',
      reason: 'resemblance_evidence_unavailable',
    });
    expect(result.style01Meta?.needsHumanReview).toBe(true);
  });

  it('rejects a required numeric gate before provider spend when visual QA is disabled', async () => {
    vi.stubEnv('PAGE_VISUAL_QA_ENABLED', 'false');

    await expect(
      generateImage(baseInput({
        pageResemblanceGate: {
          referenceImageUrl: 'https://cdn.example/order-r1a/approved-anchor.png',
          effectiveThreshold: 0.7,
          minAcceptableScore: 0.55,
        },
      })),
    ).rejects.toThrow('PAGE_VISUAL_QA_ENABLED must be true');

    expect(generateGptSpy).not.toHaveBeenCalled();
    expect(resemblanceSpy).not.toHaveBeenCalled();
  });

  it('scores a batch page against the exact canonical gate reference, not a stale mutable anchor', async () => {
    evaluateQaSpy.mockResolvedValue(VERIFIED_PASS);
    const canonicalAnchor =
      'https://cdn.example/order-r1a/approved-canonical-anchor.png';
    const staleMutableAnchor =
      'https://cdn.example/order-r1a/stale-order-anchor.png';

    const outcome = await generateAllPageImages(
      [
        {
          pageNumber: 4,
          imagePrompt: 'A small child stands safely in a calm room.',
          expectedCharacterIds: ['child'],
        },
      ],
      {
        illustrationStyle: 'soft_hand_drawn_storybook',
        childName: 'Noa',
        childDescription: 'A small child with short dark hair.',
        referenceImages: [canonicalAnchor],
        initialCharacterAnchors: { child: staleMutableAnchor },
        requirePageResemblanceGate: true,
        pageResemblanceReferenceImage: canonicalAnchor,
        resemblanceThresholdConfig: {
          baseThreshold: 0.72,
          styleAdjustments: { soft_hand_drawn_storybook: -0.02 },
          minAcceptableScore: 0.55,
          softFailBand: 0.06,
          extremeMargin: 0.1,
        },
      },
    );

    expect(outcome.failedPages).toEqual([]);
    expect(resemblanceSpy).toHaveBeenCalledWith(
      expect.objectContaining({ referenceImageUrl: canonicalAnchor }),
    );
    expect(resemblanceSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ referenceImageUrl: staleMutableAnchor }),
    );
  });

  it('candidate persistence failure holds before QA and cannot reserve or render replacement bytes', async () => {
    const reserve = vi.fn(async () => true);
    evaluateQaSpy.mockResolvedValue(VERIFIED_FAILURE);

    const result = await generateImage(baseInput({
      reserveQualityRegen: reserve,
      onCandidateUploaded: vi.fn(async () => {
        throw new Error('candidate row unavailable');
      }),
    }));

    expect(generateGptSpy).toHaveBeenCalledTimes(1);
    expect(storeBufferSpy).toHaveBeenCalledTimes(1);
    expect(evaluateQaSpy).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(result.style01Meta?.needsHumanReview).toBe(true);
    expect(result.style01Meta?.candidatePersistenceError).toBe('candidate row unavailable');
    expect(result.style01Meta?.pageVisualQa).toEqual(expect.objectContaining({
      passed: true,
      verdict: 'evidence_unknown',
      reason: 'vision_skipped',
      details: 'candidate_persistence_failed_before_qa',
      regenAttempts: 0,
      safetyHazards: [],
      safetyStatus: 'unverified',
      qaInput: {
        expectsChild: true,
        expectsCompanion: false,
        expectedPageTimeOfDay: 'day',
        isEmotionalClosing: true,
        hasStructuredObjects: false,
        hasRailedBedOrCrib: false,
        hasHumanFamily: false,
      },
    }));
  });

  it('verified visual failure is the only path that reserves and renders new bytes', async () => {
    const reserve = vi.fn(async () => true);
    const persistCandidate = vi.fn(async () => {});
    evaluateQaSpy
      .mockResolvedValueOnce(VERIFIED_FAILURE)
      .mockResolvedValueOnce(VERIFIED_PASS);

    const result = await generateImage(baseInput({
      reserveQualityRegen: reserve,
      onCandidateUploaded: persistCandidate,
    }));

    expect(reserve).toHaveBeenCalledTimes(1);
    expect(generateGptSpy).toHaveBeenCalledTimes(2);
    expect(storeBufferSpy).toHaveBeenCalledTimes(2);
    expect(persistCandidate).toHaveBeenCalledTimes(2);
    expect(evaluateQaSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({
      imageUrl: 'https://cdn.example/order-r1a/page-4-1.png',
    }));
    expect(evaluateQaSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({
      imageUrl: 'https://cdn.example/order-r1a/page-4-2.png',
    }));
    expect(result.style01Meta?.pageVisualQa?.regenAttempts).toBe(1);
    expect(result.style01Meta?.pageVisualQa?.verdict).toBe('passed');
  });

  it('keeps the visible one-candidate plus two-replacement bound even if a reserver always grants', async () => {
    const reserve = vi.fn(async () => true);
    evaluateQaSpy.mockResolvedValue(VERIFIED_FAILURE);

    const result = await generateImage(baseInput({
      reserveQualityRegen: reserve,
      onCandidateUploaded: vi.fn(async () => {}),
    }));

    expect(generateGptSpy).toHaveBeenCalledTimes(3);
    expect(evaluateQaSpy).toHaveBeenCalledTimes(3);
    expect(reserve).toHaveBeenCalledTimes(2);
    expect(result.style01Meta?.pageVisualQa?.regenAttempts).toBe(2);
    expect(result.style01Meta?.needsHumanReview).toBe(true);
  });

  it('awaits shipped Style01 upload -> candidate persistence -> QA on the same durable URL', async () => {
    const events: string[] = [];
    storeBufferSpy.mockImplementationOnce(async () => {
      events.push('upload');
      return 'https://cdn.example/order-r1a/persisted-candidate.png';
    });
    evaluateQaSpy.mockImplementationOnce(async (input: { imageUrl: string }) => {
      events.push(`qa:${input.imageUrl}`);
      return VERIFIED_PASS;
    });

    await generateImage(baseInput({
      onCandidateUploaded: async (candidate: { url: string }) => {
        events.push(`persist:${candidate.url}`);
        await Promise.resolve();
        events.push('persist:done');
      },
    }));

    expect(events).toEqual([
      'upload',
      'persist:https://cdn.example/order-r1a/persisted-candidate.png',
      'persist:done',
      'qa:https://cdn.example/order-r1a/persisted-candidate.png',
    ]);
  });

  it('wires the shipped Style01 cover through upload -> page-0 candidate persistence -> QA', async () => {
    const events: string[] = [];
    storeBufferSpy.mockImplementationOnce(async ({ pageNumber }: { pageNumber?: number }) => {
      events.push(`upload:${pageNumber}`);
      return 'https://cdn.example/order-r1a/cover-candidate.png';
    });
    evaluateQaSpy.mockImplementationOnce(async (input: { imageUrl: string }) => {
      events.push(`qa:${input.imageUrl}`);
      return VERIFIED_PASS;
    });

    await generateBookCover({
      childName: 'Noa',
      topicLabel: 'Courage',
      storyTitle: 'Noa and the Quiet Light',
      illustrationStyle: 'soft_hand_drawn_storybook',
      childDescription: 'A six-year-old child with short dark hair and a calm expression.',
      orderId: 'order-r1a',
      onCandidateUploaded: async (candidate) => {
        events.push(`persist:${candidate.url}`);
      },
    });

    expect(events).toEqual([
      'upload:0',
      'persist:https://cdn.example/order-r1a/cover-candidate.png',
      'qa:https://cdn.example/order-r1a/cover-candidate.png',
    ]);
  });

  it('retains the exact assembled cover QA context when candidate persistence fails before Vision', async () => {
    const result = await generateBookCover({
      childName: 'Noa',
      topicLabel: 'Courage',
      storyTitle: 'Noa and the Quiet Light',
      illustrationStyle: 'soft_hand_drawn_storybook',
      childDescription: 'A six-year-old child with short dark hair and a calm expression.',
      orderId: 'order-r1a',
      onCandidateUploaded: async () => {
        throw new Error('cover candidate row unavailable');
      },
    });

    expect(generateGptSpy).toHaveBeenCalledTimes(1);
    expect(storeBufferSpy).toHaveBeenCalledTimes(1);
    expect(evaluateQaSpy).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(result.style01Meta?.needsHumanReview).toBe(true);
    expect(result.style01Meta?.candidatePersistenceError).toBe('cover candidate row unavailable');
    expect(result.style01Meta?.pageVisualQa?.qaInput).toEqual({
      expectsChild: true,
      expectsCompanion: false,
      expectedPageTimeOfDay: 'day',
      isEmotionalClosing: false,
      hasStructuredObjects: false,
      hasRailedBedOrCrib: false,
      hasHumanFamily: false,
    });
  });
});
