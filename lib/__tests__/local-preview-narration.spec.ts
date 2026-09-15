import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { narratePreviewPage } from '../../scripts/lib/local-preview-narration';
import { previewAccountedUsd, previewSha } from '../local-story-preview';
const roots: string[] = [];
const root = () => { const r = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-narration-test-')); roots.push(r); return r; };
afterEach(() => { for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true }); });
describe('local narration checkpoint and source binding', () => {
  it('reuses existing voice/settings and exact source; replay never bills twice', async () => {
    const fetchImpl = vi.fn(async () => new Response('ID3audio', { headers: { 'Content-Type': 'audio/mpeg' } }));
    const args = { root: root(), pageNumber: 1, text: 'בר חייך.', voiceId: 'mom', apiKey: 'test', budgetUsd: 1, fetchImpl };
    const first = await narratePreviewPage(args); expect(await narratePreviewPage(args)).toEqual(first);
    expect(first.textSha).toBe(previewSha(args.text)); expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(previewAccountedUsd(path.join(args.root, 'steps'))).toBe(0.5);
    await expect(narratePreviewPage({ ...args, text: 'טקסט אחר' })).rejects.toThrow('checkpoint_identity_changed');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it.each(['timeout', 'status', 'invalid_audio'])('%s retains the attempt and never retries', async kind => {
    const fetchImpl = vi.fn(async () => {
      if (kind === 'timeout') throw Error('transport_failed');
      return new Response('invalid', { status: kind === 'status' ? 503 : 200 });
    });
    const args = { root: root(), pageNumber: 1, text: 'בר חייך.', voiceId: 'mom', apiKey: 'test', budgetUsd: 1, fetchImpl };
    await expect(narratePreviewPage(args)).rejects.toThrow();
    await expect(narratePreviewPage(args)).rejects.toThrow('paid_step_outcome_unknown');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('rejects unknown voices before provider access', async () => {
    const fetchImpl = vi.fn();
    await expect(narratePreviewPage({ root: root(), pageNumber: 1, text: 'בר חייך.', voiceId: 'made_up', apiKey: 'test', budgetUsd: 1, fetchImpl })).rejects.toThrow('unknown_narration_voice');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
