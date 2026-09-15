import { describe, expect, it, vi } from 'vitest';
import { ANATOMY_INSPECTION_INSTRUCTION, PREVIEW_JUDGE_INSTRUCTION, PREVIEW_QUALITY_VERSION, QUALITY_CATEGORIES, qualityDisposition, runPreviewQualityLoop, validatePreviewContinuity, previewContinuityContext, validateQualityCalibration, type PreviewQualityReview, type PreviewContinuity } from '../local-preview-quality';
import { createHash } from 'node:crypto';
const a = 'a'.repeat(64), b = 'b'.repeat(64);
function review(candidateSha = a, contextSha = b, defect?: string): PreviewQualityReview {
  return { candidateSha, contextSha, checks: QUALITY_CATEGORIES.map(category => ({ category,
    verdict: category === defect ? 'defect' : 'pass', observation: 'visible evidence', correction: category === defect ? 'repair visible connection' : '' })) };
}
const plan = { recurringProps: [{ id: 'cake' }], locations: [{ id: 'bridge' }, { id: 'slope' }],
  pages: [0, 1, 2].map(pageNumber => ({ pageNumber, locationId: pageNumber === 2 ? 'slope' : 'bridge', shot: 'wide', props: [{ id: 'cake' }] })) };
function continuity(): PreviewContinuity {
  return { companionStandingHeightInChildHeights: 0.65,
    entities: [{ id: 'cake', kind: 'prop', invariants: [{ attribute: 'state', value: 'whole' }, { attribute: 'tiers', value: '3' }] },
      { id: 'bridge', kind: 'landmark', invariants: [{ attribute: 'material', value: 'wood' }] }],
    pages: [0, 1, 2].map(pageNumber => ({ pageNumber, visibleLocationIds: pageNumber === 2 ? ['slope', 'bridge'] : ['bridge'],
      visibleEntityIds: ['cake', 'bridge'], changes: [], childHeightFraction: 0.3, environmentAreaFraction: 0.7 })) };
}
describe('preview continuity contract', () => {
  it('preserves a visible bridge after transition and applies source-backed state cumulatively', () => {
    const c = continuity(); c.pages[1].changes = [{ entityId: 'cake', attribute: 'state', value: 'sliced', storyEvidence: 'cut the cake' }];
    validatePreviewContinuity(c, plan, ['cover', 'They cut the cake.', 'At the slope.']);
    const context = previewContinuityContext(c, 2);
    expect(context.page.visibleLocationIds).toEqual(['slope', 'bridge']);
    expect(context.entities[0].currentState).toEqual({ state: 'sliced', tiers: '3' });
    expect(context.entities[1].currentState.material).toBe('wood');
    expect(previewContinuityContext(c, 0).entities[0].currentState.state).toBe('whole');
  });
  it.each(['unknown_location', 'missing_prop', 'unknown_change', 'invented_evidence', 'duplicate_attribute', 'tight', 'wide', 'cover_change'])('rejects %s', kind => {
    const c = continuity();
    if (kind === 'unknown_location') c.pages[2].visibleLocationIds.push('unknown');
    if (kind === 'missing_prop') c.pages[1].visibleEntityIds = ['bridge'];
    if (kind === 'unknown_change' || kind === 'invented_evidence') c.pages[1].changes = [{ entityId: kind === 'unknown_change' ? 'absent' : 'cake', attribute: 'state', value: 'cut', storyEvidence: 'not in story' }];
    if (kind === 'duplicate_attribute') c.entities[0].invariants.push(c.entities[0].invariants[0]);
    if (kind === 'tight') c.pages[1].environmentAreaFraction = 0.2;
    if (kind === 'wide') c.pages[1].childHeightFraction = 0.45;
    if (kind === 'cover_change') c.pages[0].changes = [{ entityId: 'cake', attribute: 'state', value: 'cut', storyEvidence: 'cover' }];
    expect(() => validatePreviewContinuity(c, plan, ['cover', 'page one', 'page two'])).toThrow();
  });
});
describe('evidence-bound quality disposition', () => {
  it('rejects missing, failed, stale, incomplete or falsely summarized calibration before paid rendering', () => {
    const hash = (s: string) => createHash('sha256').update(s).digest('hex');
    const record = { version: PREVIEW_QUALITY_VERSION, model: 'gpt-5.5', effort: 'medium', instructionSha: hash(PREVIEW_JUDGE_INSTRUCTION), anatomyInstructionSha: hash(ANATOMY_INSPECTION_INSTRUCTION),
      status: 'calibration_cases_matched', results: [['anatomy', 'defect'], ['anatomy', 'pass'], ['props', 'defect'], ['environment', 'defect']].map(([category, verdict]) => ({
        matched: true, expected: [{ category, verdict }], review: review(a, b, verdict === 'defect' ? category : undefined),
      })) };
    expect(validateQualityCalibration(record).results).toHaveLength(4);
    for (const invalid of [{}, { ...record, status: 'calibration_hold' }, { ...record, instructionSha: a },
      { ...record, version: 'local-preview-quality/v4' }, { ...record, model: 'gpt-5.4' }, { ...record, effort: 'high' },
      { ...record, results: record.results.slice(1) }, { ...record, results: record.results.map(r => ({ ...r, review: review() })) }]) {
      expect(() => validateQualityCalibration(invalid)).toThrow();
    }
  });
  it.each(QUALITY_CATEGORIES)('every %s defect blocks pass', category => {
    expect(qualityDisposition(review(a, b, category), a, b).disposition).toBe('repair');
  });
  it('missing/duplicate categories, stale image/context, empty corrections and malformed evidence never pass', () => {
    const missing = review(); missing.checks.pop();
    const duplicate = review(); duplicate.checks[1] = duplicate.checks[0];
    const empty = review(a, b, 'anatomy'); empty.checks[0].correction = ' ';
    for (const value of [missing, duplicate, empty, {}, review(b, b), review(a, a)]) expect(() => qualityDisposition(value, a, b)).toThrow();
  });
  it('uncertainty holds even with another verified defect', () => {
    const r = review(a, b, 'anatomy'); r.checks[1].verdict = 'uncertain';
    expect(qualityDisposition(r, a, b).disposition).toBe('held_uncertain');
  });
});
describe('actual render/review/repair orchestration', () => {
  const render = () => vi.fn(async (attempt: number) => ({ imageSha: String(attempt + 1).repeat(64), imageName: `attempt-${attempt}.png` }));
  it('repairs a concrete defect and rechecks ALL categories on new bytes', async () => {
    const make = render();
    const judge = vi.fn(async (candidate, contextSha, attempt) => review(candidate.imageSha, contextSha, attempt === 0 ? 'anatomy' : undefined));
    const result = await runPreviewQualityLoop({ context: { sourceSha: a }, maxRepairs: 2, render: make, judge });
    expect(result.status).toBe('passed'); expect(result.history).toHaveLength(2);
    expect(make.mock.calls[1][0]).toBe(1); expect(judge).toHaveBeenCalledTimes(2);
    expect(result.history[0].review.checks[0].verdict).toBe('defect');
  });
  it('stops at exactly two repairs without promoting the last failure', async () => {
    const make = render(); const result = await runPreviewQualityLoop({ context: {}, maxRepairs: 2, render: make,
      judge: async (candidate, contextSha) => review(candidate.imageSha, contextSha, 'environment') });
    expect(make).toHaveBeenCalledTimes(3); expect(result.status).toBe('held_repair_limit');
  });
  it.each(['timeout', 'malformed', 'uncertain', 'stale'])('%s cannot trigger a paid repair', async failure => {
    const make = render();
    const execute = () => runPreviewQualityLoop({ context: {}, maxRepairs: 2, render: make,
      judge: async (candidate, contextSha) => {
        if (failure === 'timeout') throw Error('transport_failed');
        if (failure === 'malformed') return {};
        if (failure === 'stale') return review(a, contextSha, 'anatomy');
        const r = review(candidate.imageSha, contextSha); r.checks[0].verdict = 'uncertain'; return r;
      } });
    if (failure === 'uncertain') expect((await execute()).status).toBe('held_uncertain');
    else await expect(execute()).rejects.toThrow();
    expect(make).toHaveBeenCalledTimes(1);
  });
  it('changed context changes the binding and rejects replayed judgments', async () => {
    const result = await runPreviewQualityLoop({ context: { previousImage: a }, maxRepairs: 0, render: render(), judge: async (c, h) => review(c.imageSha, h) });
    await expect(runPreviewQualityLoop({ context: { previousImage: b }, maxRepairs: 0, render: render(), judge: async () => result.history[0].review })).rejects.toThrow('quality_evidence_binding');
  });
  it('unchanged repaired pixels cannot loop', async () => {
    await expect(runPreviewQualityLoop({ context: {}, maxRepairs: 2, render: async () => ({ imageName: 'same.png', imageSha: a }),
      judge: async (c, h) => review(c.imageSha, h, 'anatomy') })).rejects.toThrow('quality_repair_unchanged');
  });
});
