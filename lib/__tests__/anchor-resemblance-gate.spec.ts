import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  evaluateAnchorEmbeddingScore,
  evaluateAnchorSemanticQa,
  isChildAnchorReviewApproved,
  resolveAnchorGateConfig,
} from '../anchor-resemblance-gate';

describe('anchor-resemblance-gate', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('hard-fails embedding below 0.20', () => {
    const cfg = resolveAnchorGateConfig();
    expect(evaluateAnchorEmbeddingScore(0.19, cfg).verdict).toBe('hard_fail');
    expect(evaluateAnchorEmbeddingScore(0.19, cfg).hardFail).toBe(true);
  });

  it('treats mid-band embedding as soft_ok requiring approval', () => {
    const cfg = resolveAnchorGateConfig();
    const mid = evaluateAnchorEmbeddingScore(0.4, cfg);
    expect(mid.verdict).toBe('soft_ok');
    expect(mid.needsHumanApproval).toBe(true);
    expect(mid.hardFail).toBe(false);
  });

  it('does not hard-fail mid-band even below page threshold 0.70', () => {
    const mid = evaluateAnchorEmbeddingScore(0.65, resolveAnchorGateConfig());
    expect(mid.hardFail).toBe(false);
    expect(mid.verdict).toBe('soft_ok');
  });

  it('passes semantic checks when gender and hair traits match', () => {
    const semantic = evaluateAnchorSemanticQa({
      childGender: 'girl',
      childPhotoDescription: 'long curly brown hair past shoulders',
      childStructuredHair: 'long curly brown hair',
      anchorVisionDescription: 'girl with long curly brown hair',
      faceDetectConfidence: 0.9,
    });
    expect(semantic.ok).toBe(true);
    expect(semantic.missingHairTraits).toEqual([]);
  });

  it('fails semantic checks on gender mismatch', () => {
    const semantic = evaluateAnchorSemanticQa({
      childGender: 'girl',
      childPhotoDescription: 'long brown hair',
      anchorVisionDescription: 'young boy with long brown hair',
      faceDetectConfidence: 0.9,
    });
    expect(semantic.ok).toBe(false);
    expect(semantic.genderMismatch).toBe(true);
  });

  it('reads CHILD_ANCHOR_REVIEW_OK_ORDER_IDS', () => {
    process.env.CHILD_ANCHOR_REVIEW_OK_ORDER_IDS = 'order-a,order-b';
    expect(isChildAnchorReviewApproved('order-b', null, null)).toBe(true);
    expect(isChildAnchorReviewApproved('order-c', null, null)).toBe(false);
  });
});
