import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftManifest, draftOutputRoot, loadOwnerDraft, ownerDraftSchema } from '../scripts/run-owner-book-draft';
import { previewCheckpoint, previewSha, bindPreviewRun } from './local-story-preview';

const roots: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true }); });
function fixture() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-draft-test-')); roots.push(repo);
  fs.mkdirSync(path.join(repo, 'outputs'));
  const source = '---\ntitle: Test\npages: 2\n---\n--- Page 1 ---\nFirst.\n--- Page 2 ---\nSecond.';
  const plan = { wardrobe: 'blue', visualLanguage: 'watercolor', recurringProps: [], locations: [{ id: 'garden', design: 'garden' }],
    pages: [0, 1, 2].map(pageNumber => ({ pageNumber, locationId: 'garden', shot: 'wide', angle: 'eye_level', composition: 'wide garden', childAction: 'walk', childExpression: 'curious', childGaze: 'path', companionAction: 'walk', scene: 'garden', props: [] })),
    continuity: { companionStandingHeightInChildHeights: 0.75, entities: [], pages: [0, 1, 2].map(pageNumber => ({ pageNumber, visibleLocationIds: ['garden'], visibleEntityIds: [], changes: [], childHeightFraction: 0.33, environmentAreaFraction: 0.65 })) } };
  const put = (file: string, value: string) => { fs.writeFileSync(path.join(repo, file), value); return { file, sha: previewSha(value) }; };
  const config = { intent: 'owner_requested_unaccepted_draft', story: put('story.md', source), plan: put('plan.json', JSON.stringify(plan)),
    childAnchor: put('child.png', 'input'), companionAnchor: put('companion.png', 'input'), childName: 'Bar', childAge: 5, gender: 'boy', companionDescription: 'panda',
    outputDir: 'outputs/test-book', imageBudgetUsd: 10, qaBudgetUsd: 10 };
  return { repo, config };
}
describe('explicit local editorial draft boundary', () => {
  it('loads pinned source and complete continuity without granting acceptance', () => {
    const { repo, config } = fixture(); const { story } = loadOwnerDraft(repo, config);
    expect(story.pages).toHaveLength(2);
    expect(draftManifest(story, config.plan.sha, [])).toMatchObject({ productionReady: false, productAcceptance: 'pending', automaticRepair: 'disabled_uncalibrated' });
  });
  it.each(['accepted', 'pending', '', undefined])('rejects other intent %s', intent => { const { config } = fixture(); expect(() => ownerDraftSchema.parse({ ...config, intent })).toThrow(); });
  it.each(['VERCEL', 'VERCEL_ENV', 'NODE_ENV'])('rejects hosted/production %s', name => {
    const { repo, config } = fixture(); vi.stubEnv(name, name === 'NODE_ENV' ? 'production' : '1'); expect(() => loadOwnerDraft(repo, config)).toThrow('local_draft_only');
  });
  it.each(['outputs', 'outputs/../../escape', 'outputs/foo/bar', 'app/test-book'])('contains destination %s', destination => {
    const { repo } = fixture(); expect(() => draftOutputRoot(repo, destination)).toThrow('draft_output_scope');
  });
  it('rejects changed source and plan before live work', () => {
    const { repo, config } = fixture(); fs.appendFileSync(path.join(repo, 'story.md'), '\nchanged'); expect(() => loadOwnerDraft(repo, config)).toThrow('draft_input_changed');
  });
  it('rejects absent continuity', () => {
    const { repo, config } = fixture(); const plan = JSON.parse(fs.readFileSync(path.join(repo, 'plan.json'), 'utf8')); delete plan.continuity;
    const text = JSON.stringify(plan); fs.writeFileSync(path.join(repo, 'plan.json'), text); config.plan.sha = previewSha(text);
    expect(() => loadOwnerDraft(repo, config)).toThrow();
  });
  it('rejects insufficient initial image allowance', () => { const { repo, config } = fixture(); expect(() => loadOwnerDraft(repo, { ...config, imageBudgetUsd: 1 })).toThrow('draft_initial_reservation_limit'); });
  it('cannot adopt a nonempty root or rebind an existing run', () => {
    const { repo } = fixture(); const root = path.join(repo, 'outputs/test-book'); bindPreviewRun(root, { source: 'one' });
    expect(() => bindPreviewRun(root, { source: 'two' })).toThrow('preview_input_changed_new_run_required');
    expect(() => bindPreviewRun(path.join(repo, 'outputs'), {})).toThrow('preview_root_not_empty');
  });
  it('replays known steps without dispatch and refuses unknown paid retries', async () => {
    const { repo } = fixture(); let calls = 0;
    const args = { root: path.join(repo, 'outputs/test-book'), step: 'page-00', input: { source: 'one' }, reserveUsd: 0.5, budgetUsd: 10,
      produce: async () => { calls++; return { value: { sha: 'saved' }, usage: { input_tokens: 100, output_tokens: 100 } }; } };
    await previewCheckpoint(args); await previewCheckpoint(args); expect(calls).toBe(1);
    const failed = { ...args, step: 'page-01', produce: async () => { calls++; throw Error('unknown'); } };
    await expect(previewCheckpoint(failed)).rejects.toThrow('unknown');
    await expect(previewCheckpoint(failed)).rejects.toThrow('paid_step_outcome_unknown_no_automatic_retry'); expect(calls).toBe(2);
  });
});
