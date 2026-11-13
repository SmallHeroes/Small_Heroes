import { describe, expect, it } from 'vitest';
import { exhaustedFrameEditParent, type AuditionAttempt, type SavedPage } from '@/lib/personal-wizard/simple-book-reviewed-audition';
import { localCurrentMediaRecoverySchema, localCurrentMediaRecoverySlots } from '../local-current-entities';

const image = 'a'.repeat(64);
const spec = { page: 4, afterPage: 5, parentImageSha256: image };
const defect = { bound: true, derived: false, verdict: 'defect', impact: 'story', requirement: 'scene_plan' };

function frame() {
  const attempts = [0, 1, 2].map(attempt => ({
    attempt, status: 'held', candidate: { imageSha: attempt === 2 ? image : String(attempt).repeat(64) },
    review: {}, assessment: { safetyBlocked: false, invalidCitations: 0, findings: [defect] },
    identity: { status: 'passed', subjectVisible: true, sameChild: true, reasonCode: 'same_child', threshold: .7, resemblanceScore: .94 },
  })) as unknown as AuditionAttempt[];
  return { pageNumber: 4, status: 'held', attempts } as SavedPage;
}

describe('one bounded material frame edit', () => {
  it('uses the pinned rejected attempt even if it is not the comparison predecessor', () => {
    const page = frame();
    expect(exhaustedFrameEditParent(page, spec)).toBe(page.attempts[2]);
  });

  it.each([
    ['different page', (p: SavedPage) => { p.pageNumber = 3; }],
    ['already supported', (p: SavedPage) => { p.status = 'qa_supported'; }],
    ['unexhausted', (p: SavedPage) => { p.attempts.shift(); }],
    ['safety', (p: SavedPage) => { p.attempts[0].assessment!.safetyBlocked = true; }],
    ['invalid citation', (p: SavedPage) => { p.attempts[2].assessment!.invalidCitations = 1; }],
    ['unmeasured identity', (p: SavedPage) => { p.attempts[1].identity = null; }],
    ['subthreshold identity', (p: SavedPage) => { p.attempts[2].identity!.resemblanceScore = .69; }],
    ['wrong candidate', (p: SavedPage) => { p.attempts[2].candidate!.imageSha = 'b'.repeat(64); }],
    ['uncertainty only', (p: SavedPage) => { p.attempts[2].assessment!.findings = []; }],
    ['derived finding', (p: SavedPage) => { p.attempts[2].assessment!.findings =
      p.attempts[2].assessment!.findings.map(f => ({ ...f, derived: true })); }],
  ] as const)('refuses %s', (_label, change) => {
    const page = frame();
    change(page);
    expect(() => exhaustedFrameEditParent(page, spec)).toThrow('audition_exhausted_frame_binding');
  });

  it('adds only render, review and identity at the same reservations as the ordinary slots', () => {
    const steps = ['page_4_2', 'page_4_2_qa', 'page_4_2_identity', 'page_5_2'].map((id,i) => ({id,maximumMicroUsd:10+i}));
    const next = localCurrentMediaRecoverySlots(steps,4);
    expect(next).toEqual([...steps,{id:'page_4_3',maximumMicroUsd:10},{id:'page_4_3_qa',maximumMicroUsd:11},{id:'page_4_3_identity',maximumMicroUsd:12}]);
    expect(() => localCurrentMediaRecoverySlots(next,4)).toThrow('local_media_recovery_slots');
    expect(() => localCurrentMediaRecoverySlots(steps,5)).toThrow('local_media_recovery_slots');
    expect(localCurrentMediaRecoverySchema.shape.targetReviewStep.safeParse('page_5_0_qa').success).toBe(true);
    for (const step of ['page_5_0_qa2','page_5_2_qa','page_0_0_qa','page_5_0_identity'])
      expect(localCurrentMediaRecoverySchema.shape.targetReviewStep.safeParse(step).success).toBe(false);
  });
});
