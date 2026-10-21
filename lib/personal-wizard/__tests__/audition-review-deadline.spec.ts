import { describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
const sdk = vi.hoisted(() => ({ create: vi.fn(), options: [] as unknown[] }));
vi.mock('openai', () => ({ default: class { responses = { create: sdk.create }; constructor(options: unknown) { sdk.options.push(options); } } }));
import { AuditionMeter, auditionAdapters, AUDITION_REVIEW_TIMEOUT_MS } from '../../../scripts/personal-simple-book-reviewed-audition';

// The actual call seam of the pixel review (2026-10-21): the SDK client and the create call the paid judge makes, provider-free.
describe('the pixel review call seam: a 600 s client deadline and no retries; a call it ends has an unknown cost and nothing is sent after it', () => {
  it('the deadline and the request; a deadline is not a receipt: the meter records an unknown cost and refuses the next claim before any dispatch', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'audition-deadline-')), images = path.join(dir, 'illustrations'); mkdirSync(images);
    const meter = new AuditionMeter(path.join(dir, 'paid'), 7000000, 89, 0);
    const io = auditionAdapters({ directory: images, meter, key: () => 'sk-synthetic-test-value-not-a-credential', signal: new AbortController().signal });
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 120, g: 60, b: 90 } } }).png().toBuffer();
    const candidate = await io.writeImage('page_2_0.png', png), contextSha = 'a'.repeat(64);
    sdk.create.mockImplementation(async () => { throw new Error('Request timed out.'); });
    await expect(io.judge('page_2_0_qa', candidate, { version: 'synthetic-context' }, contextSha, [], null, 'page')).rejects.toThrow('Request timed out.');
    expect(AUDITION_REVIEW_TIMEOUT_MS).toBe(600_000);
    expect(sdk.create).toHaveBeenCalledTimes(1);
    expect(sdk.create.mock.calls[0][1]).toMatchObject({ timeout: 600_000 });
    expect(sdk.options[0]).toMatchObject({ maxRetries: 0, baseURL: 'https://api.openai.com/v1' });
    // The request itself is unchanged: the same model, tier, output cap, schema and no storage.
    expect(sdk.create.mock.calls[0][0]).toMatchObject({ model: 'gpt-6.1-sol', service_tier: 'default', store: false, max_output_tokens: 12000,
      reasoning: { effort: 'medium' }, text: { format: { name: 'personal_audition_pixels_v4' } } });
    expect(meter.snapshot()).toMatchObject({ unknownCost: 1, unknownOutcome: 0, failed: 1, newKnownApiMicroUsd: 0 });
    expect(readdirSync(path.join(dir, 'paid')).sort()).toEqual(['page_2_0_qa.claim.json', 'page_2_0_qa.failure.json', 'page_2_0_qa.result.json', 'page_2_0_qa.wire.json']);
    // Nothing is sent after it: the next paid call is refused before its claim, and the provider is never reached again.
    await expect(io.judge('page_2_1_qa', candidate, { version: 'synthetic-context' }, contextSha, [], null, 'page')).rejects.toThrow('audition_unknown_cost');
    expect(sdk.create).toHaveBeenCalledTimes(1);
    expect(readdirSync(path.join(dir, 'paid')).filter(n => n.startsWith('page_2_1'))).toEqual([]);
  });
});
