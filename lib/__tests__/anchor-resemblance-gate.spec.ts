import { describe, expect, it, afterEach } from 'vitest';
import {
  evaluateAnchorEmbeddingScore,
  evaluateAnchorSemanticQa,
  isChildAnchorReviewApproved,
  resolveAnchorDeliveryGate,
  resolveAnchorGateConfig,
} from '../anchor-resemblance-gate';

describe('anchor-resemblance-gate', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('uses the calibrated Style-01 anchor-vs-photo defaults (separate from the 0.70 page gate)', () => {
    const cfg = resolveAnchorGateConfig();
    expect(cfg.embeddingHardFailBelow).toBe(0.15);
    expect(cfg.embeddingSoftAcceptAt).toBe(0.22);
  });

  it('hard-fails an occluded / clearly-wrong anchor (~0.12)', () => {
    const cfg = resolveAnchorGateConfig();
    const bad = evaluateAnchorEmbeddingScore(0.12, cfg);
    expect(bad.band).toBe('hard_fail');
    expect(bad.verdict).toBe('hard_fail');
    expect(bad.hardFail).toBe(true);
    expect(bad.autoAccept).toBe(false);
  });

  it('does NOT hard-fail a good ~0.19 Style-01 anchor (יובל a1 — eyeballed good)', () => {
    // Regression: the old 0.20 hard-fail floor wrongly rejected this good likeness.
    const review = evaluateAnchorEmbeddingScore(0.19, resolveAnchorGateConfig());
    expect(review.hardFail).toBe(false);
    expect(review.band).toBe('review');
    expect(review.autoAccept).toBe(false);
    expect(review.needsHumanApproval).toBe(true);
  });

  it('auto-accepts the previously-blocked good anchor (יובל best-of-N 0.281)', () => {
    // Regression: this scored 0.281 and was wrongly held at ANCHOR_REVIEW_REQUIRED.
    const yuval = evaluateAnchorEmbeddingScore(0.281, resolveAnchorGateConfig());
    expect(yuval.band).toBe('auto_accept');
    expect(yuval.autoAccept).toBe(true);
    expect(yuval.hardFail).toBe(false);
    expect(yuval.needsHumanApproval).toBe(false);
    expect(yuval.verdict).toBe('soft_ok');
  });

  it('auto-accepts a strong anchor (Leo 0.594)', () => {
    const leo = evaluateAnchorEmbeddingScore(0.594, resolveAnchorGateConfig());
    expect(leo.band).toBe('auto_accept');
    expect(leo.autoAccept).toBe(true);
  });

  it('honors env overrides for the anchor thresholds', () => {
    process.env.ANCHOR_EMBEDDING_HARD_FAIL_BELOW = '0.10';
    process.env.ANCHOR_SOFT_ACCEPT_AT = '0.30';
    const cfg = resolveAnchorGateConfig();
    expect(cfg.embeddingHardFailBelow).toBe(0.1);
    expect(cfg.embeddingSoftAcceptAt).toBe(0.3);
    expect(evaluateAnchorEmbeddingScore(0.25, cfg).band).toBe('review');
    expect(evaluateAnchorEmbeddingScore(0.31, cfg).band).toBe('auto_accept');
  });

  it('keeps softAccept strictly above hardFail even on misconfiguration', () => {
    process.env.ANCHOR_EMBEDDING_HARD_FAIL_BELOW = '0.40';
    process.env.ANCHOR_SOFT_ACCEPT_AT = '0.20'; // soft below hard — invalid
    const cfg = resolveAnchorGateConfig();
    expect(cfg.embeddingSoftAcceptAt).toBeGreaterThan(cfg.embeddingHardFailBelow);
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

  describe('resolveAnchorDeliveryGate (delivery hold consumer)', () => {
    it('delivers a clear anchor (>= soft accept): ready + book-ready email', () => {
      const gate = resolveAnchorDeliveryGate(undefined);
      expect(gate.held).toBe(false);
      expect(gate.orderStatus).toBe('ready');
      expect(gate.sendBookReadyEmail).toBe(true);
      expect(gate.reason).toBeNull();
    });

    it('HOLDS a soft-band anchor (0.15–0.22): renders, needs_human_qa, NO email', () => {
      const gate = resolveAnchorDeliveryGate({ reason: 'soft_band', score: 0.18 });
      expect(gate.held).toBe(true);
      expect(gate.orderStatus).toBe('needs_human_qa');
      expect(gate.sendBookReadyEmail).toBe(false);
      expect(gate.reason).toBe('anchor_low_confidence:soft_band');
    });

    it('HOLDS a hard-band anchor (<0.15): renders for internal review, needs_human_qa, NO email', () => {
      const gate = resolveAnchorDeliveryGate({ reason: 'hard_band', score: 0.12 });
      expect(gate.held).toBe(true);
      expect(gate.orderStatus).toBe('needs_human_qa');
      expect(gate.sendBookReadyEmail).toBe(false);
      expect(gate.reason).toBe('anchor_low_confidence:hard_band');
    });
  });

  it('reads CHILD_ANCHOR_REVIEW_OK_ORDER_IDS (dev/QA override path retained)', () => {
    process.env.CHILD_ANCHOR_REVIEW_OK_ORDER_IDS = 'order-a,order-b';
    expect(isChildAnchorReviewApproved('order-b', null, null)).toBe(true);
    expect(isChildAnchorReviewApproved('order-c', null, null)).toBe(false);
  });
});
