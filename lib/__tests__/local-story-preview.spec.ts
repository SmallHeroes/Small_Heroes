import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindPreviewRun, previewCheckpoint, previewImageDigest, previewPagePrompt, previewSha, previewStory, validatePreviewPlan, previewUsageUpperUsd, previewAccountedUsd, previewAutomatedPassed, type PreviewPlan } from '../local-story-preview';
import { planGPTImageRequest } from '../generate-image';

const roots: string[] = [];
const temp = () => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-local-preview-')); roots.push(root); return root; };
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
const raw = '---\ntitle: "{{childName}} בעולם"\npages: 2\n---\n--- Page 1 ---\n{{childName}} {צחק|צחקה}.\n--- Page 2 ---\n{הוא|היא} {נח|נחה}.';
const plan = (count = 2): PreviewPlan => ({
  wardrobe: 'blue shirt', visualLanguage: 'soft watercolor',
  recurringProps: [{ id: 'cart', design: 'four-wheel red cart' }],
  locations: [{ id: 'park', design: 'grass beside a round pond' }],
  pages: Array.from({ length: count + 1 }, (_, i) => ({ pageNumber: i, locationId: 'park',
    shot: (['wide', 'medium', 'close'] as const)[i % 3], angle: (['low', 'eye_level', 'high'] as const)[i % 3],
    composition: 'off-center diagonal action', childAction: 'pulling', childExpression: `concentrating ${i}`, childGaze: 'cart wheel',
    companionAction: 'steadying the cart', scene: 'one moment on path', props: [{ id: 'cart', state: 'tilted slightly' }],
  })),
});

describe('local story preview — offline', () => {
  it('face identity cannot promote malformed or unassessed anatomy', () => {
    const visual = { clearVisualSafetyIssue: false, sceneMatches: true, recurringPropsConsistent: true, childFeelsActive: true };
    expect(previewAutomatedPassed('passed', visual)).toBe(false);
    expect(previewAutomatedPassed('passed', { ...visual, anatomyCoherent: false })).toBe(false);
    expect(previewAutomatedPassed('passed', { ...visual, anatomyCoherent: true })).toBe(true);
    expect(previewAutomatedPassed('evidence_unknown', { ...visual, anatomyCoherent: true })).toBe(false);
  });
  it('transports an explicit role map without injecting legacy companion or style identities', () => {
    const request = planGPTImageRequest({ finalPrompt: 'soft watercolor. image 1 child; image 2 orange dragon', referenceImages: ['one.png', 'two.png'], referenceMode: 'explicit_role_map', modelOverride: 'gpt-image-2', quality: 'low' }, { defaultModel: 'gpt-image-2', defaultQuality: 'low', maxReferences: 4 });
    expect(request.finalPrompt).not.toMatch(/BOLLY|Style 02/i);
    expect(request.requestOptions.maxRetries).toBe(0);
    expect(request.referenceCountPassed).toBe(2);
  });
  it.each(['boy', 'girl'] as const)('personalizes %s without changing source', gender => {
    const before = previewSha(raw); const result = previewStory(raw, 'בר', gender);
    expect(result.pages[0].text).toBe(gender === 'boy' ? 'בר צחק.' : 'בר צחקה.');
    expect(result.title).toBe('בר בעולם'); expect(previewSha(raw)).toBe(before);
    expect(result.sourceSha).toBe(before);
  });
  it.each([
    raw.replace('Page 2', 'Page 3'), raw.replace('pages: 2', 'pages: 3'),
    raw.replace('Page 2', 'Page 1'), raw.replace('נח|נחה', 'unknown'),
  ])('rejects malformed source before spend', input => expect(() => previewStory(input, 'בר', 'boy')).toThrow());
  it('accepts complete varied plan, preserves source prose in prompt', () => {
    const p = validatePreviewPlan(plan(6), 6); const prompt = previewPagePrompt(p, 2, 'immutable source', 5, 'boy', 'orange dragon');
    expect(prompt).toContain('immutable source'); expect(prompt).toContain('four-wheel red cart');
    expect(prompt).toContain('EXPRESS'); expect(prompt).toContain('image 2 = exact companion');
    expect(prompt).toContain('ANATOMY INTEGRITY'); expect(prompt).toContain('FRAMING RULE');
    expect(prompt).toContain('distinct supporting children'); expect(prompt).not.toContain('NEVER two children');
  });
  it.each(['pages', 'prop', 'location', 'expression', 'camera', 'empty'] as const)('rejects plan defect %s', defect => {
    const p = plan(6);
    if (defect === 'pages') p.pages.pop();
    if (defect === 'prop') p.pages[1].props[0].id = 'unknown';
    if (defect === 'location') p.pages[1].locationId = 'unknown';
    if (defect === 'expression') p.pages.forEach(page => { page.childExpression = 'same smile'; });
    if (defect === 'camera') p.pages.forEach(page => { page.shot = 'medium'; });
    if (defect === 'empty') p.pages[1].childAction = '';
    expect(() => validatePreviewPlan(p, 6)).toThrow();
  });
  it('binds exact run identity and rejects an occupied directory', () => {
    const root = temp(); bindPreviewRun(root, { sha: 'a' }); bindPreviewRun(root, { sha: 'a' });
    expect(() => bindPreviewRun(root, { sha: 'b' })).toThrow('preview_input_changed');
    const occupied = temp(); fs.writeFileSync(path.join(occupied, 'user-file'), 'keep');
    expect(() => bindPreviewRun(occupied, {})).toThrow('preview_root_not_empty');
    expect(fs.readFileSync(path.join(occupied, 'user-file'), 'utf8')).toBe('keep');
  });
  it('replays persisted results with zero new calls', async () => {
    const root = temp(); const produce = vi.fn(async () => ({ value: { sha: 'abc' }, usage: { input_tokens: 42 } }));
    const args = { root, step: 'page-00', input: { source: 's', refs: ['r'], prompt: 'p' }, reserveUsd: 0.5, budgetUsd: 1, produce };
    const first = await previewCheckpoint(args); const second = await previewCheckpoint(args);
    expect(second).toEqual(first); expect(produce).toHaveBeenCalledTimes(1);
    await expect(previewCheckpoint({ ...args, input: { ...args.input, source: 'changed' } })).rejects.toThrow('checkpoint_identity_changed');
  });
  it('retains uncertain attempts and refuses automatic retry', async () => {
    const root = temp(); const produce = vi.fn(async () => { throw Error('transport timeout'); });
    const args = { root, step: 'page-00', input: {}, reserveUsd: 0.5, budgetUsd: 1, produce };
    await expect(previewCheckpoint(args)).rejects.toThrow('transport timeout');
    await expect(previewCheckpoint(args)).rejects.toThrow('paid_step_outcome_unknown');
    expect(produce).toHaveBeenCalledTimes(1);
    await expect(previewCheckpoint({ ...args, step: 'page-01', reserveUsd: 0.6 })).rejects.toThrow('preview_budget_exhausted');
  });
  it('charges reservations for successful calls too', async () => {
    const root = temp(); const produce = vi.fn(async () => ({ value: 'image' }));
    await previewCheckpoint({ root, step: 'page-00', input: {}, reserveUsd: 1, budgetUsd: 1, produce });
    await expect(previewCheckpoint({ root, step: 'page-01', input: {}, reserveUsd: 0.1, budgetUsd: 1, produce })).rejects.toThrow('preview_budget_exhausted');
    expect(produce).toHaveBeenCalledTimes(1);
  });
  it('settles known usage at an upper rate, retains missing usage reservations', async () => {
    const root = temp();
    await previewCheckpoint({ root, step: 'plan', input: {}, reserveUsd: 1, budgetUsd: 1,
      produce: async () => ({ value: 'plan', usage: { input_tokens: 500, output_tokens: 500 } }) });
    expect(previewAccountedUsd(path.join(root, 'steps'))).toBeCloseTo(0.03);
    await previewCheckpoint({ root, step: 'page-00', input: {}, reserveUsd: 0.5, budgetUsd: 1,
      produce: async () => ({ value: 'image' }) });
    expect(previewAccountedUsd(path.join(root, 'steps'))).toBeCloseTo(0.53);
    await expect(previewCheckpoint({ root, step: 'page-01', input: {}, reserveUsd: 0.5, budgetUsd: 1, produce: async () => ({ value: 'bad' }) })).rejects.toThrow('preview_budget_exhausted');
  });
  it('preserves an over-reservation result and holds replay without rebilling', async () => {
    const root = temp(); const produce = vi.fn(async () => ({ value: 'saved', usage: { input_tokens: 20000, output_tokens: 1000 } }));
    const args = { root, step: 'judge', input: {}, reserveUsd: 0.5, budgetUsd: 1, produce };
    await expect(previewCheckpoint(args)).rejects.toThrow('preview_usage_exceeded_reservation');
    expect(JSON.parse(fs.readFileSync(path.join(root, 'steps/judge.result.json'), 'utf8')).value).toBe('saved');
    await expect(previewCheckpoint(args)).rejects.toThrow('preview_usage_exceeded_reservation');
    expect(produce).toHaveBeenCalledTimes(1);
    expect(previewAccountedUsd(path.join(root, 'steps'))).toBeCloseTo(0.63);
  });
  it.each([null, {}, { input_tokens: -1, output_tokens: 4 }, { input_tokens: 0, output_tokens: 0 }, { input_tokens: '1', output_tokens: 4 }])('unknown usage is never treated as free', usage => {
    expect(previewUsageUpperUsd(usage)).toBeNull();
  });
  it.each([NaN, -1, 0, Infinity, 11])('rejects invalid budget %s', async budgetUsd => {
    const produce = vi.fn(async () => ({ value: 'bad' }));
    await expect(previewCheckpoint({ root: temp(), step: 'page-00', input: {}, reserveUsd: 0.5, budgetUsd, produce })).rejects.toThrow('invalid_preview_budget');
    expect(produce).not.toHaveBeenCalled();
  });
  it('refuses non-PNG images', () => {
    const file = path.join(temp(), 'page-00.png'); fs.writeFileSync(file, 'not a PNG');
    expect(() => previewImageDigest(file)).toThrow('preview_image_not_png');
  });
});
