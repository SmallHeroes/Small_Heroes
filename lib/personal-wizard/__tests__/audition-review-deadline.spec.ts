import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
const sdk = vi.hoisted(() => ({ create: vi.fn(), options: [] as unknown[] }));
vi.mock('openai', () => ({ default: class { responses = { create: sdk.create }; constructor(options: unknown) { sdk.options.push(options); } } }));
import { AuditionMeter, auditionAdapters, auditionJudgePayload, digestImages, AUDITION_REVIEW_TIMEOUT_MS } from '../../../scripts/personal-simple-book-reviewed-audition';
import { previewSha } from '../../local-story-preview';
import { canonicalJson } from '../request-acceptance';

// The actual call seam of the pixel review (2026-10-21; transport 2026-10-22): the SDK client and the create call the paid judge makes,
// provider-free. The transport itself is exercised against a real local server in audition-review-transport.spec.ts.
const setup = async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'audition-deadline-')), images = path.join(dir, 'illustrations'); mkdirSync(images);
  const meter = new AuditionMeter(path.join(dir, 'paid'), 7000000, 89, 0);
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 120, g: 60, b: 90 } } }).png().toBuffer();
  return { dir, images, meter, png };
};
const adapters = (s: Awaited<ReturnType<typeof setup>>, expectedWire?: Record<string, string>) => auditionAdapters({ directory: s.images, meter: s.meter,
  key: () => 'sk-synthetic-test-value-not-a-credential', signal: new AbortController().signal, ...(expectedWire ? { expectedWire } : {}) });
beforeEach(() => { sdk.create.mockReset(); sdk.options.length = 0; });

describe('the pixel review call seam: a 600 s client deadline and no retries; a call it ends has an unknown cost and nothing is sent after it', () => {
  it('the deadline and the request; a deadline is not a receipt: the meter records an unknown cost and refuses the next claim before any dispatch', async () => {
    const s = await setup(), io = adapters(s);
    const candidate = await io.writeImage('page_2_0.png', s.png), contextSha = 'a'.repeat(64);
    sdk.create.mockImplementation(async () => { throw new Error('Request timed out.'); });
    await expect(io.judge('page_2_0_qa', candidate, { version: 'synthetic-context' }, contextSha, [], null, 'page')).rejects.toThrow('Request timed out.');
    expect(AUDITION_REVIEW_TIMEOUT_MS).toBe(600_000);
    expect(sdk.create).toHaveBeenCalledTimes(1);
    expect(sdk.create.mock.calls[0][1]).toMatchObject({ timeout: 600_000 });
    expect(sdk.options[0]).toMatchObject({ maxRetries: 0, baseURL: 'https://api.openai.com/v1' });
    // The client is built on the call's own transport (reviewTransport), never on Node's process-wide fetch dispatcher.
    expect(typeof (sdk.options[0] as { fetch?: unknown }).fetch).toBe('function');
    // The request itself is unchanged: the same model, tier, output cap, schema and no storage.
    expect(sdk.create.mock.calls[0][0]).toMatchObject({ model: 'gpt-6.1-sol', service_tier: 'default', store: false, max_output_tokens: 12000,
      reasoning: { effort: 'medium' }, text: { format: { name: 'personal_audition_pixels_v4' } } });
    expect(s.meter.snapshot()).toMatchObject({ unknownCost: 1, unknownOutcome: 0, failed: 1, newKnownApiMicroUsd: 0 });
    expect(readdirSync(path.join(s.dir, 'paid')).sort()).toEqual(['page_2_0_qa.claim.json', 'page_2_0_qa.failure.json', 'page_2_0_qa.result.json', 'page_2_0_qa.wire.json']);
    // Nothing is sent after it: the next paid call is refused before its claim, and the provider is never reached again.
    await expect(io.judge('page_2_1_qa', candidate, { version: 'synthetic-context' }, contextSha, [], null, 'page')).rejects.toThrow('audition_unknown_cost');
    expect(sdk.create).toHaveBeenCalledTimes(1);
    expect(readdirSync(path.join(s.dir, 'paid')).filter(n => n.startsWith('page_2_1'))).toEqual([]);
  });

  it('a re-review step must send exactly its lost request: another request is refused before its claim; the identical one is claimed and sent once', async () => {
    const s = await setup(), writer = adapters(s);
    const candidate = await writer.writeImage('page_2_2.png', s.png), contextSha = 'b'.repeat(64), context = { version: 'synthetic-context' };
    const payload = await auditionJudgePayload({ candidate, candidateBytes: s.png, context, contextSha, refs: [], predecessor: null, kind: 'page' });
    const lost = previewSha(canonicalJson(digestImages(payload)));
    const wrong = adapters(s, { r2_page_2_2_qa: 'f'.repeat(64) });
    await expect(wrong.judge('r2_page_2_2_qa', candidate, context, contextSha, [], null, 'page')).rejects.toThrow('audition_rereview_wire');
    // Another context is another request: refused too.
    const right = adapters(s, { r2_page_2_2_qa: lost });
    await expect(right.judge('r2_page_2_2_qa', candidate, { version: 'other-context' }, contextSha, [], null, 'page')).rejects.toThrow('audition_rereview_wire');
    expect([existsPaid(s), sdk.create.mock.calls.length]).toEqual([[], 0]);
    sdk.create.mockImplementation(async () => { throw new Error('Request timed out.'); });
    await expect(right.judge('r2_page_2_2_qa', candidate, context, contextSha, [], null, 'page')).rejects.toThrow('Request timed out.');
    expect(sdk.create).toHaveBeenCalledTimes(1);
    expect(existsPaid(s)).toEqual(['r2_page_2_2_qa.claim.json', 'r2_page_2_2_qa.failure.json', 'r2_page_2_2_qa.result.json', 'r2_page_2_2_qa.wire.json']);
  });
});
const existsPaid = (s: { dir: string }) => { try { return readdirSync(path.join(s.dir, 'paid')).sort(); } catch { return []; } };
