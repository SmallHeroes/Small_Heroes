import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { comparisonInput, comparisonModels, comparisonSummary, parseComparisonReview } from '../visual-qa-comparison';
import { previewSha } from '../local-story-preview';
import { inspectComparison } from '../../scripts/lib/visual-qa-comparison';

const good = { anatomy: { verdict: 'pass', explanation: 'coherent', findings: [] }, otherFindings: [] };
let root: string, bytes: Buffer;
beforeEach(async () => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-qa-compare-')); bytes = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#fac' } }).png().toBuffer(); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const options = () => ({ root, step: 'image-01', model: 'sonnet' as const, bytes, sha: previewSha(bytes), key: 'secret-sentinel' });
const prediction = (extra = {}) => ({ id: 'prediction123', model: comparisonModels.sonnet.name, version: comparisonModels.sonnet.version,
  status: 'succeeded', output: JSON.stringify(good), metrics: { predict_time: 2 }, input: { secret: 'echo-sentinel' }, logs: 'log-sentinel', ...extra });
const response = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });

describe('cross-family comparison', () => {
  it('separates owner evidence, provisional agreement, unknowns and unlabelled rows', () => {
    expect(comparisonSummary([
      { label: { expected: 'defect', authority: 'owner' }, observed: 'pass' },
      { label: { expected: 'pass', authority: 'provisional' }, observed: 'defect' },
      { label: { expected: 'pass', authority: 'provisional' }, observed: 'unknown' },
      { label: { expected: null, authority: 'unlabelled' }, observed: 'pass' },
    ])).toMatchObject({ owner: { total: 1, missedDefects: 1 }, provisional: { total: 2, falseAlarms: 1, unresolved: 1 }, unlabelled: 1, renderAuthorized: false, generalAccuracyProven: false });
  });
  it('sends identical instruction and image bytes with provider-specific image wrappers only', () => {
    const uri = `data:image/png;base64,${bytes.toString('base64')}`, a = comparisonInput('sonnet', uri), b = comparisonInput('qwen', uri);
    expect(a.system_prompt).toBe(b.system_prompt); expect(a.prompt).toBe(b.prompt); expect(a.image).toBe(uri); expect(b.image).toEqual([uri]);
    expect(a.max_tokens).toBe(3000); expect(b.max_tokens).toBe(3000);
    expect(() => comparisonInput('unknown' as 'sonnet', uri)).toThrow('comparison_model_not_allowed');
  });
  it.each(['not-json', JSON.stringify({ ...good, anatomy: { ...good.anatomy, verdict: 'defect' } }), JSON.stringify({ ...good, additional: true })])('rejects malformed or inconsistent output %s', text => {
    expect(() => parseComparisonReview(text)).toThrow();
  });
  it('pins the real request, filters provider echoes, replays and rejects changed model cache', async () => {
    const mock = vi.fn().mockResolvedValue(response(prediction()));
    const args = { ...options(), fetcher: mock as typeof fetch };
    expect(await inspectComparison(args)).toMatchObject({ observed: 'pass', renderAuthorized: false });
    const request = JSON.parse(mock.mock.calls[0][1].body);
    expect(request.version).toBe(comparisonModels.sonnet.version);
    expect(mock.mock.calls[0][0]).toBe('https://api.replicate.com/v1/predictions');
    expect(mock.mock.calls[0][1].headers['Cancel-After']).toBe('120s');
    expect(JSON.stringify(request)).not.toContain('image-01'); expect(JSON.stringify(request)).not.toContain('expected');
    const receipt = fs.readFileSync(path.join(root,'steps/image-01.result.json'),'utf8');
    for (const sentinel of ['secret-sentinel','echo-sentinel','log-sentinel']) expect(receipt).not.toContain(sentinel);
    expect(JSON.parse(receipt).usage).toBeNull();
    await inspectComparison(args); expect(mock).toHaveBeenCalledTimes(1);
    await expect(inspectComparison({ ...args, model: 'qwen' })).rejects.toThrow('checkpoint_identity_changed');
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('a timed-out creation stays unknown and never repeats POST', async () => {
    const mock = vi.fn().mockRejectedValue(Error('transport-secret'));
    await expect(inspectComparison({ ...options(), fetcher: mock as typeof fetch })).rejects.toThrow();
    await expect(inspectComparison({ ...options(), fetcher: mock as typeof fetch })).rejects.toThrow('paid_step_outcome_unknown');
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('only polls the pinned origin/id and records the dispatch before polling', async () => {
    const mock = vi.fn().mockResolvedValueOnce(response(prediction({ status: 'processing', output: null, urls: { get: 'https://evil.invalid' } })))
      .mockImplementationOnce(async () => { expect(fs.existsSync(path.join(root,'image-01-dispatch.json'))).toBe(true); return response(prediction()); });
    await inspectComparison({ ...options(), fetcher: mock as typeof fetch, pause: async () => {} });
    expect(mock.mock.calls[1][0]).toBe('https://api.replicate.com/v1/predictions/prediction123');
  });
  it('preserves failed known result without a free retry', async () => {
    const mock = vi.fn().mockResolvedValue(response(prediction({ status: 'failed', output: null })));
    for (let n=0;n<2;n++) await expect(inspectComparison({ ...options(), fetcher: mock as typeof fetch })).rejects.toThrow('comparison_provider_not_succeeded');
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('malformed successful output is unknown, not pass or another paid request', async () => {
    const mock = vi.fn().mockResolvedValue(response(prediction({ output: 'bad' })));
    expect(await inspectComparison({ ...options(), fetcher: mock as typeof fetch })).toMatchObject({ observed: 'unknown', renderAuthorized: false });
  });
  it('rejects mismatched source bytes without contacting provider', async () => {
    const mock = vi.fn(); await expect(inspectComparison({ ...options(), sha: '0'.repeat(64), fetcher: mock as typeof fetch })).rejects.toThrow('comparison_image_binding');
    expect(mock).not.toHaveBeenCalled();
  });
  it('recovers a known dispatch by GET only, preserving hidden provider version instead of claiming snapshot attestation', async () => {
    const initial = vi.fn().mockResolvedValueOnce(response(prediction({ status: 'processing', output: null }))).mockRejectedValueOnce(Error('poll failure'));
    await expect(inspectComparison({ ...options(), fetcher: initial as typeof fetch, pause: async () => {} })).rejects.toThrow();
    const recovery = vi.fn().mockResolvedValue(response(prediction({ version: 'hidden' })));
    expect(await inspectComparison({ ...options(), fetcher: recovery as typeof fetch, reconcileOnly: true })).toMatchObject({ observed: 'pass' });
    expect(recovery).toHaveBeenCalledTimes(1); expect(recovery.mock.calls[0][1].method).toBeUndefined();
    expect(JSON.parse(fs.readFileSync(path.join(root,'steps/image-01.result.json'),'utf8')).value.version).toBe('hidden');
  });
  it('reconciliation without a bound claim/dispatch cannot POST', async () => {
    const mock = vi.fn(); await expect(inspectComparison({ ...options(), fetcher: mock as typeof fetch, reconcileOnly: true })).rejects.toThrow();
    expect(mock).not.toHaveBeenCalled();
  });
  it('records HTTP status without response bodies and keeps the uncertain claim', async () => {
    const mock = vi.fn().mockResolvedValue(new Response('secret-echo', {status:422}));
    await expect(inspectComparison({ ...options(), fetcher: mock as typeof fetch })).rejects.toThrow('comparison_provider_http_error');
    const text = fs.readFileSync(path.join(root,'image-01-http.json'),'utf8'); expect(text).toContain('422'); expect(text).not.toContain('secret-echo');
  });
  it('recovers a504 only through one exact-input match, without POST', async () => {
    const failed = vi.fn().mockResolvedValue(new Response('', { status:504 }));
    await expect(inspectComparison({ ...options(), fetcher: failed as typeof fetch })).rejects.toThrow();
    const input = JSON.parse(failed.mock.calls[0][1].body).input;
    const p = prediction({ version:'hidden', input, created_at: new Date().toISOString() });
    const recovery = vi.fn().mockResolvedValueOnce(response({ next: null, results:[p] })).mockResolvedValueOnce(response(p));
    expect(await inspectComparison({ ...options(), fetcher: recovery as typeof fetch, reconcileOnly:true })).toMatchObject({ observed:'pass' });
    for (const [, request] of recovery.mock.calls) expect(request.method).toBeUndefined();
  });
  it('refuses non-unique discovery without posting or fabricating a dispatch', async () => {
    const failed = vi.fn().mockResolvedValue(new Response('', { status:504 }));
    await expect(inspectComparison({ ...options(), fetcher: failed as typeof fetch })).rejects.toThrow();
    const recovery = vi.fn().mockResolvedValue(response({ next:null, results:[] }));
    await expect(inspectComparison({ ...options(), fetcher:recovery as typeof fetch, reconcileOnly:true })).rejects.toThrow('comparison_discovery_not_unique');
    expect(fs.existsSync(path.join(root,'image-01-dispatch.json'))).toBe(false);
  });
  it('does not treat a provider-redacted image as exact input evidence after504', async () => {
    const failed = vi.fn().mockResolvedValue(new Response('', { status:504 }));
    await expect(inspectComparison({ ...options(), fetcher:failed as typeof fetch })).rejects.toThrow();
    const input = { ...JSON.parse(failed.mock.calls[0][1].body).input, image:'data:image/png;base64,...' };
    const recovery = vi.fn().mockResolvedValue(response({ next:null, results:[prediction({ input, created_at:new Date().toISOString() })] }));
    await expect(inspectComparison({ ...options(), fetcher:recovery as typeof fetch, reconcileOnly:true })).rejects.toThrow('comparison_discovery_not_unique');
    expect(recovery).toHaveBeenCalledTimes(1);
  });
  it('holds an unresolved case while a different case can run once within the same reservation ledger', async () => {
    const failed = vi.fn().mockResolvedValue(new Response('', {status:504}));
    await expect(inspectComparison({ ...options(), fetcher:failed as typeof fetch })).rejects.toThrow();
    const mock = vi.fn().mockResolvedValue(response(prediction()));
    expect(await inspectComparison({ ...options(), step:'image-02', fetcher:mock as typeof fetch })).toMatchObject({ observed:'pass' });
    await expect(inspectComparison({ ...options(), fetcher:mock as typeof fetch })).rejects.toThrow('paid_step_outcome_unknown');
    expect(mock).toHaveBeenCalledTimes(1);
    expect(fs.readdirSync(path.join(root,'steps')).filter(f=>f.endsWith('.claim.json'))).toHaveLength(2);
  });
});
