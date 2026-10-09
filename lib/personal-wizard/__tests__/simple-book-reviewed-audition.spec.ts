import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
vi.mock('../storyboard', () => ({
  currentPersonalStoryboardFrame: (_book: unknown, _review: unknown, pageNumber: number) =>
    ({ context: { pageNumber }, render: { prompt: `PAGE ${pageNumber}` } }),
}));
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import type { PageChildResemblanceVisionResult } from '../../generation-pipeline/page-child-resemblance-vision';
import type { PersonalStoryboard } from '../storyboard';
import { auditionSheetDesigns, illustrateReviewedAudition, reviewPenalty, selectAuditionAttempt, reviewedAuditionHTML,
  AUDITION_SHEET_JUDGE_INSTRUCTION, ReviewedAuditionError, type AuditionAttempt } from '../simple-book-reviewed-audition';
import { AuditionMeter } from '../../../scripts/personal-simple-book-reviewed-audition';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const texts = ['She takes the paper.', 'She folds it into a boat.', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
// Data projection input only: one actor-attached item, one prop with a later source state, one landmark.
const fixture = () => ({
  plan: { recurringProps: [{ id: 'paper_boat', appearance: 'red folded paper' }, { id: 'ribbon', appearance: 'gold ribbon' }],
    wardrobe: 'teal shirt', locations: [{ id: 'garden', design: 'garden' }],
    actorAppearance: { child: { clothing: ['teal shirt with a gold ribbon'] } },
    continuity: { entities: [
      { id: 'paper_boat', kind: 'prop', invariants: [{ attribute: 'crease', value: 'flat' }, { attribute: 'color', value: 'red' }] },
      { id: 'ribbon', kind: 'prop', invariants: [{ attribute: 'color', value: 'gold' }] },
      { id: 'old_tree', kind: 'landmark', invariants: [{ attribute: 'design', value: 'forked trunk' }] },
    ], pages: [{ pageNumber: 0, changes: [] }, { pageNumber: 1, changes: [] },
      { pageNumber: 2, changes: [{ entityId: 'paper_boat', attribute: 'crease', value: 'folded boat', storyEvidence: texts[1] }] }] } },
  sequence: { premise: 'one garden', mutableAttributes: [{ entityId: 'paper_boat', attribute: 'crease' }],
    pages: Array.from({ length: 8 }, (_, i) => ({ pageNumber: i + 1, sceneId: i < 3 ? 'scene_a' : 'scene_b',
      states: [{ entityId: 'ribbon', value: { relation: 'attached_to', targetId: 'child' } }] })) },
}) as unknown as PersonalStoryboard;

type Verdict = 'pass' | 'defect' | 'uncertain';
const review = (candidateSha: string, contextSha: string, verdicts: Partial<Record<typeof QUALITY_CATEGORIES[number], Verdict>> = {}) => ({
  candidateSha, contextSha, checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: verdicts[category] ?? 'pass',
    observation: `${category} observed`, correction: verdicts[category] === 'defect' ? `fix ${category}` : '' })) });
const identity = (score: number): PageChildResemblanceVisionResult => ({ status: score >= .7 ? 'passed' : 'failed', resemblanceScore: score,
  threshold: .7, subjectVisible: true, sameChild: score >= .7, reasonCode: score >= .7 ? 'same_child' : 'different_child', attempts: 1, model: 'gpt-4o' } as never);
const image = (name: string) => ({ imageName: `${name}.png`, imageSha: sha(name) });

function harness(opts: { judge?: (step: string) => Partial<Record<typeof QUALITY_CATEGORIES[number], Verdict>>;
  score?: (step: string) => number; renderFail?: (step: string) => Error | null } = {}) {
  const prompts = new Map<string, string>(), judged: string[] = [], saved = new Map<string, unknown>();
  const args = {
    book: fixture(), rawReview: {}, texts, current: { request: {}, writerResult: {}, options: {} as never },
    child: image('child'), companion: image('companion'),
    render: vi.fn(async (step: string, prompt: string, _refs?: unknown, _mode?: unknown, _roles?: unknown) => {
      const error = opts.renderFail?.(step); if (error) throw error;
      prompts.set(step, prompt); return image(step);
    }),
    judge: vi.fn(async (step: string, candidate: { imageSha: string }, _context: unknown, contextSha: string, _refs?: unknown, _predecessor?: { imageName: string } | null) => {
      judged.push(step); return review(candidate.imageSha, contextSha, opts.judge?.(step) ?? {});
    }),
    identity: vi.fn(async (step: string) => identity(opts.score?.(step) ?? .82)),
    check: vi.fn(), save: (name: string, value: unknown) => { saved.set(name, value); },
  };
  return { args, prompts, judged, saved };
}

describe('reviewed audition sheet scope', () => {
  it('keeps only initial forms, excludes actor-owned items and clothing, and keeps every other fixed fact', () => {
    const d = auditionSheetDesigns(fixture(), texts);
    expect(d.actorOwnedIds).toEqual(['ribbon']);
    expect(d.entities.entities.map((e: { id: string }) => e.id)).toEqual(['paper_boat']);
    expect(d.entities.props.map((e: { id: string }) => e.id)).toEqual(['paper_boat']);
    expect('childClothingAuthority' in d.entities).toBe(false);
    expect(d.entities.entities[0].invariants).toHaveLength(2);
    expect(d.entities.referenceState.mutableAttributes).toEqual([expect.objectContaining({ entityId: 'paper_boat',
      knownValues: [{ value: 'flat', pageNumber: 0, evidence: null }] })]);
    expect(d.entities.referenceState.stableAttachments).toEqual([]);
    expect(d.entities.referenceOwnership.assignments.map((a: { entityId: string }) => a.entityId)).toEqual(['paper_boat', 'old_tree']);
    expect(d.locations.landmarks.map((e: { id: string }) => e.id)).toEqual(['old_tree']);
    expect(d.entities.sheetScope).toMatchObject({ depiction: 'initial_form_only', actorOwnedIds: ['ribbon'] });
    expect(AUDITION_SHEET_JUDGE_INSTRUCTION).toMatch(/Safety reports concrete visible issues/);
  });
});

describe('reviewed audition selection', () => {
  const attempt = (n: number, verdicts: Partial<Record<typeof QUALITY_CATEGORIES[number], Verdict>>, score?: number): AuditionAttempt => {
    const r = review(sha(`c${n}`), sha('ctx'), verdicts) as never;
    return { attempt: n, candidate: image(`c${n}`), review: r, disposition: 'repair', penalty: reviewPenalty(r), ...(score === undefined ? {} : { identity: identity(score) }) };
  };
  it('makes a safety defect blocking and penalises uncertainty more than a minor defect', () => {
    expect(reviewPenalty(review('a'.repeat(64), 'b'.repeat(64), { safety: 'defect' }))).toBe(Number.POSITIVE_INFINITY);
    expect(reviewPenalty(review('a'.repeat(64), 'b'.repeat(64), { safety: 'uncertain' }))).toBe(10);
    expect(reviewPenalty(review('a'.repeat(64), 'b'.repeat(64), { anatomy: 'defect', framing: 'uncertain' }))).toBe(6);
    expect(selectAuditionAttempt([attempt(0, { safety: 'defect' })], false)).toBeNull();
  });
  it('prefers an identity pass, then the lowest penalty, then the latest attempt', () => {
    expect(selectAuditionAttempt([attempt(0, {}, .5), attempt(1, { props: 'defect' }, .8)], true)!.attempt).toBe(1);
    expect(selectAuditionAttempt([attempt(0, { props: 'defect' }, .8), attempt(1, { anatomy: 'defect' }, .8)], true)!.attempt).toBe(0);
    expect(selectAuditionAttempt([attempt(0, { props: 'defect' }, .8), attempt(1, { framing: 'defect' }, .8)], true)!.attempt).toBe(1);
  });
});

describe('reviewed audition orchestration', () => {
  it('renders two sheets and nine pages, stopping each at the first fully passing attempt', async () => {
    const h = harness(), manifest = await illustrateReviewedAudition(h.args);
    expect(h.args.render.mock.calls.map(c => c[0])).toEqual(['sheet_entities_0', 'sheet_locations_0',
      ...Array.from({ length: 9 }, (_, n) => `page_${n}_0`)]);
    expect(manifest.pages.map(p => p.flags)).toEqual(Array(9).fill([]));
    expect(manifest).toMatchObject({ runtimeEligible: false, productionQualified: false, ownerReviewRequired: true });
    // Locations sheet gets the chosen entities sheet as its third authority; pages get all four.
    expect(h.args.render.mock.calls[1][2]).toEqual([image('child'), image('companion'), image('sheet_entities_0')]);
    expect(h.args.render.mock.calls[1][4]).toEqual(['child_design_authority', 'companion_design_authority', 'entity_design_authority']);
    expect(h.args.render.mock.calls[2][2]).toEqual([image('child'), image('companion'), image('sheet_entities_0'), image('sheet_locations_0')]);
    // Same-scene predecessor (pages 2, 3 and 5..8), compared only; pages 1 and 4 start new scenes.
    const predecessors = h.args.judge.mock.calls.filter(c => c[0].startsWith('page_')).map(c => c[5]?.imageName ?? null);
    expect(predecessors).toEqual([null, null, 'page_1_0.png', 'page_2_0.png', null, 'page_4_0.png', 'page_5_0.png', 'page_6_0.png', 'page_7_0.png']);
  });

  it('keeps going after defects, feeds the last notes forward and publishes the best candidate with its flags', async () => {
    const h = harness({ judge: step => step.startsWith('page_3_0') ? { props: 'defect', anatomy: 'defect' }
      : step.startsWith('page_3_1') ? { framing: 'uncertain' } : step.startsWith('page_3_2') ? { anatomy: 'defect', scene: 'defect' } : {} });
    const manifest = await illustrateReviewedAudition(h.args);
    expect(h.prompts.get('page_3_1')).toContain('- props (defect): fix props');
    expect(h.prompts.get('page_3_1')).toContain('They can be wrong');
    expect(h.prompts.get('page_3_2')).toContain('- framing (uncertain): framing observed');
    const page = manifest.pages[3];
    expect(page).toMatchObject({ attempts: 3, flags: ['judge_notes'], candidate: image('page_3_1') });
    expect(page.notes).toEqual([{ category: 'framing', verdict: 'uncertain', observation: 'framing observed' }]);
  });

  it('flags a page below the identity threshold instead of hiding it, preferring any identity-passing attempt', async () => {
    const low = harness({ score: step => step.startsWith('page_5') ? .55 : .8 });
    const m1 = await illustrateReviewedAudition(low.args);
    expect(m1.pages[5]).toMatchObject({ attempts: 3, flags: ['identity_below_threshold'], identityScore: .55, identityPassed: false });
    const mixed = harness({ score: step => step === 'page_5_1_identity' ? .75 : step.startsWith('page_5') ? .6 : .8,
      judge: step => step.startsWith('page_5_1') ? { props: 'defect' } : {} });
    const m2 = await illustrateReviewedAudition(mixed.args);
    expect(m2.pages[5]).toMatchObject({ candidate: image('page_5_1'), flags: ['judge_notes'], identityPassed: true });
  });

  it('treats one provider failure as one lost attempt, but ends the run on spending or cancellation errors', async () => {
    const glitch = harness({ renderFail: step => step === 'page_2_0' ? Object.assign(new Error('x'), { code: 'audition_image_provider_failed' }) : null });
    const m = await illustrateReviewedAudition(glitch.args);
    expect(m.pages[2]).toMatchObject({ attempts: 2, candidate: image('page_2_1'), flags: [] });
    const broke = harness({ renderFail: step => step === 'page_2_0' ? new ReviewedAuditionError('audition_budget_exhausted') : null });
    await expect(illustrateReviewedAudition(broke.args)).rejects.toThrow('audition_budget_exhausted');
    expect(broke.args.render.mock.calls[broke.args.render.mock.calls.length - 1][0]).toBe('page_2_0');
  });

  it('never publishes a safety defect: no eligible attempt stops the book', async () => {
    const h = harness({ judge: step => step.startsWith('page_4') ? { safety: 'defect' } : {} });
    await expect(illustrateReviewedAudition(h.args)).rejects.toThrow('audition_page_4_unavailable');
    expect(h.args.identity.mock.calls.some(c => String(c[0]).startsWith('page_4'))).toBe(false);
  });

  it('renders an escaped owner-review HTML with per-page QA notes', async () => {
    const h = harness({ judge: step => step.startsWith('page_1') ? { props: 'defect' } : {} });
    const manifest = await illustrateReviewedAudition(h.args);
    const html = reviewedAuditionHTML(manifest, { title: 'A <b> title', pages: texts.map(text => ({ text })) }, i => `data:${i.imageName}`);
    expect(html).toContain('A &lt;b&gt; title');
    expect(html).toContain('props · defect');
    expect(html).toContain('data:page_8_0.png');
    expect(html).toContain('לא אישור לייצור');
  });
});

describe('audition meter', () => {
  it('journals before dispatch, counts a failed unknown-cost call at its reservation and keeps admitting within the cap', async () => {
    const root = path.join(mkdtempSync(path.join(tmpdir(), 'audition-meter-')), 'paid');
    const meter = new AuditionMeter(root, 1000000);
    await expect(meter.run('first', { a: 1 }, 400000, async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(meter.snapshot()).toMatchObject({ accountedMicroUsd: 400000, calls: 1, failed: 1, unknown: 1 });
    expect(await meter.run('second', { a: 2 }, 500000, async () => ({ value: 7, estimatedMicroUsd: 30000, receipt: {} }))).toBe(7);
    expect(meter.snapshot()).toMatchObject({ accountedMicroUsd: 430000, knownMicroUsd: 30000, calls: 2 });
    const dispatch = vi.fn();
    await expect(meter.run('third', { a: 3 }, 600000, dispatch)).rejects.toThrow('audition_budget_exhausted');
    expect(dispatch).not.toHaveBeenCalled();
    expect(readdirSync(root).filter(n => n.startsWith('third'))).toEqual([]);
    expect(() => new AuditionMeter(root, 9000000)).toThrow('audition_meter_policy');
  });
});
