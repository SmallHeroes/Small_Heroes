import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUALITY_CATEGORIES } from '../local-preview-quality';
import { previewSha } from '../local-story-preview';
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({ default: class { responses = { create }; } }));
import { judgePreviewCandidate } from '../../scripts/lib/local-preview-judge';
let root: string, candidatePath: string, candidateSha: string;
const contextSha = 'a'.repeat(64);
beforeEach(async () => {
  create.mockReset(); root = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-judge-adapter-'));
  const bytes = await sharp({ create: { width: 32, height: 48, channels: 3, background: '#fff' } }).png().toBuffer();
  candidatePath = path.join(root, 'candidate.png'); fs.writeFileSync(candidatePath, bytes); candidateSha = previewSha(bytes);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const response = (value: unknown) => ({ status: 'completed', output_text: JSON.stringify(value), usage: { input_tokens: 10, output_tokens: 10 } });
const args = () => ({ root, candidatePath, candidateSha, contextSha, step: 'judge-test', apiKey: 'test', budgetUsd: 3,
  context: { expectedPose: 'NARRATIVE_SENTINEL' }, references: [] });
describe('real preview judge adapter with mocked provider transport', () => {
  it('blind anatomy failure survives contextual PASS and replay makes zero new calls', async () => {
    create.mockResolvedValueOnce(response({ verdict: 'defect', visibleBodyTraces: ['disconnected visible arm'], observation: 'visible defect', correction: 'connect arm' }))
      .mockResolvedValueOnce(response({ candidateSha, contextSha, checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: 'clear', correction: '' })) }));
    const first = await judgePreviewCandidate(args());
    expect(first.checks.find(c => c.category === 'anatomy')?.verdict).toBe('defect');
    expect(JSON.stringify(create.mock.calls[0])).not.toContain('NARRATIVE_SENTINEL');
    expect(JSON.stringify(create.mock.calls[1])).toContain('NARRATIVE_SENTINEL');
    for (const [request] of create.mock.calls) {
      expect(request.model).toBe('gpt-5.5');
      expect(request.reasoning).toEqual({ effort: 'medium' });
      expect(request.store).toBe(false);
    }
    expect(create.mock.calls[0][0].input[0].content.filter((c: { type: string }) => c.type === 'input_image')).toHaveLength(5);
    expect(await judgePreviewCandidate(args())).toEqual(first); expect(create).toHaveBeenCalledTimes(2);
  });
  it('incomplete inspection cannot dispatch contextual review or become a defect', async () => {
    create.mockResolvedValueOnce({ status: 'incomplete', output_text: '', usage: { input_tokens: 10, output_tokens: 4500 } });
    await expect(judgePreviewCandidate(args())).rejects.toThrow('preview_anatomy_inspection_incomplete');
    await expect(judgePreviewCandidate(args())).rejects.toThrow('preview_anatomy_inspection_incomplete');
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('tampered candidate/reference bytes reject before provider access', async () => {
    await expect(judgePreviewCandidate({ ...args(), candidateSha: 'b'.repeat(64) })).rejects.toThrow('judge_candidate_changed');
    await expect(judgePreviewCandidate({ ...args(), references: [{ role: 'anchor', file: candidatePath, sha: 'b'.repeat(64) }] })).rejects.toThrow('judge_reference_changed');
    expect(create).not.toHaveBeenCalled();
  });
});
