import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorityDigest, bookDigest, boundBookManifest, engineOrderAuthoritySchema } from '../contract';
import {
  evaluateAutomaticAcceptance, evaluateLaunchDeliveryGate, launchDeliveryFenceDigest,
  nextOperatorDecision, operatorDecisionDigest,
} from '../delivery-gate';
import { authority, frames, gate, hash, manifest, NOW } from './fixtures';

afterEach(() => vi.unstubAllGlobals());

function setup() {
  vi.stubGlobal('fetch', () => { throw new Error('network_forbidden'); });
  const auth = authority(), book = manifest(auth), assessed = frames(book);
  const evaluate = () => evaluateAutomaticAcceptance({ authority: auth, manifest: book, frames: assessed, prerequisiteHolds: [] });
  const decide = (decision: 'approve' | 'reject', history: unknown[] = []) => nextOperatorDecision({
    authority: auth, manifest: book, policy: gate(), history, actorId: 'synthetic_operator', now: NOW, decision, reason: 'Synthetic review',
  });
  const deliver = (options: Partial<Parameters<typeof evaluateLaunchDeliveryGate>[0]> = {}) => evaluateLaunchDeliveryGate({
    authority: auth, manifest: book, automatic: evaluate(), policy: gate(), history: [], ...options,
  });
  return { auth, book, assessed, evaluate, decide, deliver };
}

describe('new-engine launch authority and the single delivery gate', () => {
  it('permits LOW customer / LOW test policies, never HIGH or another engine/length/bank field', () => {
    expect(engineOrderAuthoritySchema.parse(authority()).imageQuality).toBe('low');
    expect(engineOrderAuthoritySchema.safeParse({ ...authority(), purpose: 'test', imageQuality: 'low' }).success).toBe(true);
    for (const patch of [{ imageQuality: 'high' }, { imageQuality: 'auto' }, { imageQuality: 'medium' },
      { narrativePages: 15 }, { engine: 'native-cde-book/v2' }, { selectionFilename: 'retired-bank' }, { budget: undefined }]) {
      expect(engineOrderAuthoritySchema.safeParse({ ...authority(), ...patch }).success).toBe(false);
    }
  });

  it('holds an automatically accepted book for launch review, then sends eligibility through the same path', () => {
    const s = setup();
    expect(s.evaluate().status).toBe('accepted');
    expect(s.deliver().holdReasons).toEqual(['operator_review_required']);
    const review = s.decide('approve');
    expect(review).toMatchObject({ actorId: 'synthetic_operator', decidedAt: NOW.toISOString(),
      orderId: s.auth.orderId, bookSha256: bookDigest(s.book), sequence: 1, previousDecisionSha256: null });
    expect(s.deliver({ history: [review] }).eligible).toBe(true);
  });

  it('explicit off allows an unreviewed acceptable book without changing its automatic result', () => {
    const s = setup(), automatic = s.evaluate();
    const result = s.deliver({ policy: gate('off') });
    expect(result.eligible).toBe(true);
    expect(s.evaluate()).toEqual(automatic);
    expect(s.deliver({ policy: gate('off'), history: [s.decide('reject')] }).holdReasons).toEqual(['operator_rejected']);
  });

  it.each([null, undefined, {}, { ...gate(), mode: 'false' }, { ...gate(), reason: '' }])(
    'does not silently disable review for malformed/missing policy %j', policy => {
      expect(setup().deliver({ policy }).holdReasons).toContain('launch_policy_unavailable');
    });

  it('detail notes do not block or request another image', () => {
    const s = setup();
    for (const frame of s.assessed) {
      frame.attempt.assessment!.counts.detail = 99;
      frame.attempt.assessment!.findings.push({ category: 'style', verdict: 'defect', impact: 'detail',
        requirement: 'minor_framing', note: 'Synthetic nonblocking note', bound: false });
    }
    expect(s.evaluate().status).toBe('accepted');
    expect(s.deliver({ policy: gate('off') }).eligible).toBe(true);
    expect(s.assessed[0].attempt.assessment!.findings).toHaveLength(1);
  });

  it.each(['story', 'identity', 'continuity'] as const)('a material %s defect is never overridden by approve or off', impact => {
    const s = setup(); s.assessed[2].attempt.assessment!.counts[impact] = 1;
    expect(s.evaluate().status).toBe('held');
    expect(s.deliver({ history: [s.decide('approve')] }).eligible).toBe(false);
    expect(s.deliver({ policy: gate('off') }).eligible).toBe(false);
  });

  it.each(['safety', 'citation', 'missing_identity', 'unknown_identity', 'low_identity', 'different_threshold'])('fails closed for %s', kind => {
    const s = setup(), attempt = s.assessed[1].attempt;
    if (kind === 'safety') attempt.assessment!.safetyBlocked = true;
    if (kind === 'citation') attempt.assessment!.invalidCitations = 1;
    if (kind === 'missing_identity') attempt.identity = null;
    if (kind === 'unknown_identity') attempt.identity!.status = 'evidence_unknown';
    if (kind === 'low_identity') attempt.identity!.resemblanceScore = 0.699;
    if (kind === 'different_threshold') attempt.identity!.threshold = 0.69;
    expect(s.evaluate().status).toBe('held');
    expect(s.deliver({ policy: gate('off') }).eligible).toBe(false);
  });

  it('requires exact complete ordered coverage and preserves explicit engine prerequisite holds', () => {
    const s = setup(); s.assessed[1].pageNumber = 0;
    expect(s.evaluate().holdReasons).toContain('engine_frame_coverage');
    const result = evaluateAutomaticAcceptance({ authority: s.auth, manifest: s.book, frames: frames(s.book),
      prerequisiteHolds: ['source_not_admitted', 'scale_evidence_unknown'] });
    expect(result.holdReasons).toEqual(['scale_evidence_unknown', 'source_not_admitted']);
    expect(s.deliver({ automatic: result, policy: gate('off') }).eligible).toBe(false);
  });

  it.each(['text', 'image', 'audio', 'pdf', 'storyboard', 'source'])(
    'changed %s bytes invalidate review and the send-time token', kind => {
      const s = setup(), review = s.decide('approve'), old = s.deliver({ history: [review] });
      if (kind === 'text') s.book.pages[3].textSha256 = hash('f');
      if (kind === 'image') s.book.pages[3].imageSha256 = hash('f');
      if (kind === 'audio') s.book.pages[3].audioSha256 = hash('f');
      if (kind === 'pdf') s.book.pdfSha256 = hash('f');
      if (kind === 'storyboard') s.book.storyboardSha256 = hash('f');
      if (kind === 'source') s.book.sourceSha256 = hash('f');
      const automatic = evaluateAutomaticAcceptance({ authority: s.auth, manifest: s.book, frames: frames(s.book), prerequisiteHolds: [] });
      const changed = s.deliver({ history: [review], automatic });
      expect(changed.holdReasons).toContain('operator_review_required');
      expect(launchDeliveryFenceDigest(changed)).not.toBe(launchDeliveryFenceDigest(old));
      expect(s.deliver({ history: [review] }).eligible).toBe(false);
    });

  it('cannot reuse automatic acceptance for changed bytes/order or with hidden hold reasons', () => {
    const s = setup(), result = s.evaluate(); s.book.pages[3].textSha256 = hash('f');
    expect(s.deliver({ automatic: result, policy: gate('off') }).eligible).toBe(false);
    expect(s.deliver({ automatic: { ...s.evaluate(), holdReasons: ['held'] }, policy: gate('off') }).eligible).toBe(false);
    expect(() => boundBookManifest(s.auth, { ...s.book, orderId: 'other_order' })).toThrow('book_authority_mismatch');
  });

  it('does not silently lose promised narration/PDF or accept wrong-quality assets for customer authority', () => {
    const s = setup(); s.book.pages[5].audioSha256 = null;
    expect(() => s.deliver()).toThrow('book_narration_incomplete');
    const pdfAuthority = { ...s.auth, entitlements: { narration: true, pdf: true } };
    expect(() => boundBookManifest(pdfAuthority, manifest(pdfAuthority))).toThrow('book_pdf_incomplete');
    expect(() => boundBookManifest(s.auth, { ...manifest(s.auth), imageQuality: 'medium' })).toThrow('book_authority_mismatch');
  });

  it('appends audited reject/approve decisions and refuses reordered/truncated/cross-order history', () => {
    const s = setup(), rejected = s.decide('reject'), approved = s.decide('approve', [rejected]);
    expect(approved.previousDecisionSha256).toBe(operatorDecisionDigest(rejected));
    expect(s.deliver({ history: [rejected, approved] }).eligible).toBe(true);
    for (const history of [[approved], [approved, rejected], [{ ...rejected, orderId: 'another_order' }],
      [{ ...rejected, authoritySha256: hash('f') }], [rejected, { ...approved, previousDecisionSha256: null }]]) {
      expect(() => s.deliver({ history })).toThrow('operator_history_invalid');
    }
  });

  it('policy changes invalidate send-time evidence and require current-policy review when re-enabled', () => {
    const s = setup(), review = s.decide('approve'), accepted = s.deliver({ history: [review] });
    const changed = s.deliver({ history: [review], policy: { ...gate(), revision: 'new_revision' } });
    expect(changed.eligible).toBe(false);
    expect(launchDeliveryFenceDigest(changed)).not.toBe(launchDeliveryFenceDigest(accepted));
    const disabled = s.deliver({ policy: gate('off') });
    expect(launchDeliveryFenceDigest(s.deliver())).not.toBe(launchDeliveryFenceDigest(disabled));
  });

  it('never delivers a synthetic LOW test book even with gate off', () => {
    const auth = { ...authority(), purpose: 'test' as const, imageQuality: 'low' as const }, book = manifest(auth);
    const automatic = evaluateAutomaticAcceptance({ authority: auth, manifest: book, frames: frames(book), prerequisiteHolds: [] });
    expect(evaluateLaunchDeliveryGate({ authority: auth, manifest: book, automatic, policy: gate('off'), history: [] })
      .holdReasons).toContain('test_book_not_deliverable');
    expect(authorityDigest(auth)).not.toBe(authorityDigest(authority()));
  });
});
