import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { judgePreviewIdentity } from '../../scripts/lib/local-preview-identity';
import { previewSha } from '../local-story-preview';

let root: string, file: string, sha: string;
const decision = { referenceChildVisible: true, candidateChildVisible: true, candidateChildCount: 1,
  comparisonUsable: true, sameChildDecision: 'same', faceStructure: 'match', eyesBrows: 'match',
  noseMouth: 'match', hairIdentity: 'match', distinctiveFeatures: 'match' };
const response = (value: unknown, status = 'completed') => new Response(JSON.stringify({ id: 'resp-test', model: 'gpt-5.5',
  status, output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
  usage: { input_tokens: 100, output_tokens: 100 } }));
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-identity-'));
  file = path.join(root, 'image.png'); fs.writeFileSync(file, Buffer.from('exact-test-bytes')); sha = previewSha(fs.readFileSync(file));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const args = () => ({ root, step: 'identity-00', budgetUsd: 1, apiKey: 'sentinel-test-key',
  anchorPath: file, anchorSha: sha, candidatePath: file, candidateSha: sha });

describe('local 5.5 medium identity receipt adapter', () => {
  it('dispatches exact images once, preserves raw usage and replays without billing', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(url).toBe('https://api.openai.com/v1/responses');
      const request = JSON.parse(String(init?.body));
      expect(request).toMatchObject({ model: 'gpt-5.5', reasoning: { effort: 'medium' } });
      expect(request.input[0].content[0].image_url).toBe(`data:image/png;base64,${fs.readFileSync(file).toString('base64')}`);
      return response(decision);
    });
    const first = await judgePreviewIdentity({ ...args(), fetchImpl });
    expect(first.value.result.status).toBe('passed'); expect(first.value.raw).toMatchObject({ id: 'resp-test' });
    expect(first.usage).toEqual({ input_tokens: 100, output_tokens: 100 });
    expect(await judgePreviewIdentity({ ...args(), fetchImpl })).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync(path.join(root, 'steps/identity-00.result.json'), 'utf8')).not.toContain('sentinel-test-key');
  });
  it('holds hidden-face evidence while retaining feature score, not an automatic pass', async () => {
    const record = await judgePreviewIdentity({ ...args(), fetchImpl: async () => response({ ...decision, comparisonUsable: false, sameChildDecision: 'uncertain' }) });
    expect(record.value.result).toMatchObject({ status: 'evidence_unknown', reasonCode: 'subject_not_assessable' });
  });
  it('persists incomplete as unknown and never dispatches a retry on replay', async () => {
    const fetchImpl = vi.fn(async () => response(decision, 'incomplete'));
    const first = await judgePreviewIdentity({ ...args(), fetchImpl });
    expect(first.value.result.status).toBe('evidence_unknown');
    expect(await judgePreviewIdentity({ ...args(), fetchImpl })).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('rejects changed bytes before dispatch and orphan claims before rebilling', async () => {
    const fetchImpl = vi.fn(async () => response(decision));
    await expect(judgePreviewIdentity({ ...args(), candidateSha: 'f'.repeat(64), fetchImpl })).rejects.toThrow('identity_image_binding');
    fs.mkdirSync(path.join(root, 'steps')); fs.writeFileSync(path.join(root, 'steps/identity-00.claim.json'), '{}');
    await expect(judgePreviewIdentity({ ...args(), fetchImpl })).rejects.toThrow('paid_step_outcome_unknown');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
