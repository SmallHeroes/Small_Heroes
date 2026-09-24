import { describe, expect, it, vi } from 'vitest';
import { compileVisualPriorityPolicy, visualPriorityDigest, visualPriorityForPage, visualPriorityPrompt, VISUAL_PRIORITY_VERSION } from '../local-visual-priority';
import { QUALITY_CATEGORIES, previewQualityContextSha, qualityDisposition, runPreviewQualityLoop, type PreviewContinuity } from '../local-preview-quality';
import { ownerDraftRepairPrompt, runGatedDraftPages } from '../../scripts/run-owner-book-draft';

const a = 'a'.repeat(64), b = 'b'.repeat(64);
function fixture() {
  const continuity: PreviewContinuity = { companionStandingHeightInChildHeights: 0.7,
    entities: [{ id: 'cart', kind: 'prop', invariants: [{ attribute: 'material', value: 'wood' }] }],
    pages: [0, 1, 2].map(pageNumber => ({ pageNumber, visibleLocationIds: ['park'], visibleEntityIds: pageNumber === 2 ? [] : ['cart'], changes: [], childHeightFraction: 0.3, environmentAreaFraction: 0.7 })) };
  const raw = { version: VISUAL_PRIORITY_VERSION, sourceSha: a, planSha: b,
    decorativePreferences: [{ id: 'flowers', entityId: 'cart', attribute: 'painted_motif', preference: 'tiny painted flowers', scope: 'nonfunctional_surface_detail', rationale: 'Decoration has no narrative or functional role.' }] };
  const authority = { sourceSha: a, planSha: b, continuity };
  const book = compileVisualPriorityPolicy(raw, authority);
  return { raw, authority, book, policy: visualPriorityForPage(book, 1)! };
}
function review(policy: ReturnType<typeof fixture>['policy'], candidateSha = a, contextSha = b) {
  return { candidateSha, contextSha, policySha: visualPriorityDigest(policy),
    checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass' as 'pass' | 'defect' | 'uncertain', observation: 'Observed mandatory requirement intact', correction: '' })),
    decorativeChecks: policy.decorativePreferences.map(p => ({ preferenceId: p.id, verdict: 'variation' as 'variation' | 'uncertain', observation: 'Painted dots instead of flowers; same coherent object.' })) };
}
describe('prospective decorative preferences, not retroactive waivers', () => {
  it('retains cosmetic evidence without consuming a repair and never reinterprets legacy reviews', async () => {
    const { policy } = fixture(), render = vi.fn(async () => ({ imageSha: a, imageName: 'page.png' }));
    const result = await runPreviewQualityLoop({ context: {}, policy, maxRepairs: 2, render,
      judge: async (c, h) => review(policy, c.imageSha, h) });
    expect(result.status).toBe('passed'); expect(render).toHaveBeenCalledTimes(1);
    expect(result.history[0].review).toHaveProperty('decorativeChecks.0.verdict', 'variation');
    const old = { candidateSha: a, contextSha: b, checks: review(policy).checks };
    expect(() => qualityDisposition(old, a, b, policy)).toThrow();
    expect(() => qualityDisposition(review(policy), a, b)).toThrow();
    expect(qualityDisposition(old, a, b).disposition).toBe('passed');
    expect(previewQualityContextSha({})).not.toBe(previewQualityContextSha({}, policy));
  });
  it.each(QUALITY_CATEGORIES)('cannot waive a mandatory %s defect, even with cosmetic variation', category => {
    const { policy } = fixture(), r = review(policy);
    Object.assign(r.checks.find(c => c.category === category)!, { verdict: 'defect', correction: 'REQUIRED_REPAIR_ONLY' });
    expect(qualityDisposition(r, a, b, policy).disposition).toBe('repair');
    const prompt = ownerDraftRepairPrompt('BASE', { imageSha: a, imageName: 'page.png' }, r, b, 3, policy);
    expect(prompt).toContain('REQUIRED_REPAIR_ONLY'); expect(prompt).not.toContain('Painted dots');
  });
  it('uncertainty still holds, including uncertain cosmetic significance alongside a real defect', () => {
    const { policy } = fixture(), r = review(policy);
    Object.assign(r.checks[0], { verdict: 'defect', correction: 'restore arm' });
    r.decorativeChecks[0].verdict = 'uncertain';
    expect(qualityDisposition(r, a, b, policy).disposition).toBe('held_uncertain');
    expect(() => ownerDraftRepairPrompt('', { imageSha: a, imageName: 'x' }, r, b, 3, policy)).toThrow('draft_repair_requires_bound_defect');
  });
  it.each(['source', 'plan', 'duplicate_id', 'duplicate_attribute', 'unknown', 'character', 'collision', 'changed', 'scope'])('rejects invalid prospective data: %s', kind => {
    const { raw, authority } = fixture();
    if (kind === 'source') raw.sourceSha = b;
    if (kind === 'plan') raw.planSha = a;
    if (kind === 'duplicate_id') raw.decorativePreferences.push({ ...raw.decorativePreferences[0], attribute: 'other' });
    if (kind === 'duplicate_attribute') raw.decorativePreferences.push({ ...raw.decorativePreferences[0], id: 'other' });
    if (kind === 'unknown') raw.decorativePreferences[0].entityId = 'missing';
    if (kind === 'character') authority.continuity.entities[0].kind = 'supporting_character';
    if (kind === 'collision') raw.decorativePreferences[0].attribute = ' MATERIAL ';
    if (kind === 'changed') authority.continuity.pages[1].changes.push({ entityId: 'cart', attribute: 'painted_motif', value: 'dots', storyEvidence: 'painted' });
    if (kind === 'scope') raw.decorativePreferences[0].scope = 'anatomy';
    expect(() => compileVisualPriorityPolicy(raw, authority)).toThrow();
  });
  it('rejects mutated or self-issued policy handles; raw data mutation cannot mutate compiled policy', () => {
    const { raw, book, policy } = fixture(), before = visualPriorityDigest(book);
    raw.decorativePreferences[0].preference = 'mutated'; expect(visualPriorityDigest(book)).toBe(before);
    expect(() => visualPriorityDigest(structuredClone(policy))).toThrow('visual_priority_unvalidated_or_changed');
    policy.decorativePreferences[0].preference = 'mutated'; expect(() => visualPriorityPrompt(policy)).toThrow('visual_priority_unvalidated_or_changed');
  });
  it.each(['policy', 'missing', 'duplicate', 'unknown', 'image', 'context', 'core_coverage'])('fails closed on malformed review: %s', kind => {
    const { policy } = fixture(), r = review(policy);
    if (kind === 'policy') r.policySha = a;
    if (kind === 'missing') r.decorativeChecks = [];
    if (kind === 'duplicate') r.decorativeChecks.push(r.decorativeChecks[0]);
    if (kind === 'unknown') r.decorativeChecks[0].preferenceId = 'unknown';
    if (kind === 'image') r.candidateSha = b;
    if (kind === 'context') r.contextSha = a;
    if (kind === 'core_coverage') r.checks.pop();
    expect(() => qualityDisposition(r, a, b, policy)).toThrow();
  });
  it('projects only visible preferences; zero visible details still bind a distinct policy and page', () => {
    const { book, policy } = fixture(), hidden = visualPriorityForPage(book, 2)!;
    expect(visualPriorityPrompt(hidden)).not.toContain('tiny painted flowers');
    expect(hidden.decorativePreferences).toEqual([]);
    expect(qualityDisposition(review(hidden), a, b, hidden).disposition).toBe('passed');
    expect(() => qualityDisposition(review(policy), a, b, hidden)).toThrow('quality_priority_binding');
    expect(() => visualPriorityForPage(policy, 2)).toThrow('visual_priority_requires_book_policy');
    expect(() => visualPriorityForPage(book, 9)).toThrow('visual_priority_unknown_page');
    expect(visualPriorityPrompt(book, [])).not.toContain('tiny painted flowers'); // props-only board projection
  });
  it.each(['matched', 'variation', 'not_visible'] as const)('preserves an advisory %s without silently changing its verdict', verdict => {
    const { policy } = fixture(); const base = review(policy);
    const data = { ...base, decorativeChecks: [{ ...base.decorativeChecks[0], verdict }] };
    const decision = qualityDisposition(data, a, b, policy);
    expect(decision.disposition).toBe('passed'); expect(decision.review).toEqual(data);
    expect(() => ownerDraftRepairPrompt('', { imageSha: a, imageName: 'x' }, data, b, 3, policy)).toThrow('draft_repair_requires_bound_defect');
  });
  it('runs the real shared sample loop across two pages; keeps warnings and stops on core defects', async () => {
    const { book } = fixture(), render = vi.fn(async () => ({ imageSha: a, imageName: 'test.png' })), persist = vi.fn();
    const args = { pages: [1, 2], policy: book, context: (pageNumber: number) => ({ pageNumber }), render, persist,
      judge: async (page: number, candidate: { imageSha: string }, _context: unknown, hash: string) => review(visualPriorityForPage(book, page)!, candidate.imageSha, hash) };
    expect((await runGatedDraftPages(args)).results).toHaveLength(2);
    expect(render).toHaveBeenCalledTimes(2); expect(persist.mock.calls[0][0].history[0].review.decorativeChecks[0].verdict).toBe('variation');
    render.mockClear();
    const held = await runGatedDraftPages({ ...args, judge: async (...values) => {
      const r = await args.judge(...values.slice(0, 4) as Parameters<typeof args.judge>);
      Object.assign(r.checks[5], { verdict: 'defect', correction: 'return child inside the same shelter' }); return r;
    } });
    expect(held.unassessed).toEqual([2]); expect(render).toHaveBeenCalledTimes(1);
  });
  it('does not claim schema validation proves a decorative declaration is semantically true', () => {
    const { raw, authority } = fixture();
    raw.decorativePreferences[0].preference = 'A misleading author calls a structural part decorative';
    expect(() => compileVisualPriorityPolicy(raw, authority)).not.toThrow();
    // Content review remains required. Core defect veto is tested for every category above.
  });
});
