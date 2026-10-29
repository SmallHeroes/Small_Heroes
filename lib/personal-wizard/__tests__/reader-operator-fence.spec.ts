import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
const sdk = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({ default: class { responses = { create: sdk.create }; } }));
const image = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('../../generate-image', async (original) => ({ ...(await original<typeof import('../../generate-image')>()), generateGPTImage: image.generate }));
import { AuditionMeter, auditionAdapters } from '../../../scripts/personal-simple-book-reviewed-audition';

// CSR-1 (2026-10-28): the reader operator's caller guard (a live lease) is checked inside each claimed call before the key and the provider,
// and again when the call returns, before its result is used, as the companion sheet operator does (Codex CS-S0-F1, same class).
const setup = async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'reader-fence-')), images = path.join(dir, 'illustrations'); mkdirSync(images);
  const meter = new AuditionMeter(path.join(dir, 'paid'), 7000000, 89, 0);
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 120, g: 60, b: 90 } } }).png().toBuffer();
  const lease = { held: true, checks: 0 }, keys = { reads: 0 };
  const io = auditionAdapters({ directory: images, meter, signal: new AbortController().signal,
    key: () => { keys.reads++; return 'sk-synthetic-test-value-not-a-credential'; },
    guard: () => { lease.checks++; if (!lease.held) throw new Error('lease_gone'); } });
  return { dir, images, meter, png, lease, keys, io };
};
/** Revokes the lease inside the claimed call of `step`, after its claim is durable and before its callback runs. */
const revokeAfterClaim = (lease: { held: boolean }, step: string) => {
  const original = AuditionMeter.prototype.run;
  return vi.spyOn(AuditionMeter.prototype, 'run').mockImplementation(function (this: AuditionMeter, s: string, wire: unknown, max: number, dispatch: any) {
    return original.call(this, s, wire, max, async () => { if (s === step) lease.held = false; return dispatch(); });
  } as never);
};
const paid = (dir: string) => readdirSync(path.join(dir, 'paid')).sort();
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const pngOf = (size: string) => { const [width, height] = size.split('x').map(Number);
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 190, b: 180 } } }).png().toBuffer(); };
afterEach(() => { vi.restoreAllMocks(); sdk.create.mockReset(); image.generate.mockReset(); });

describe('reader operator: the caller guard fences every claimed call', () => {
  it('render: a guard revoked after the claim stops before the key and the provider; the claim closes with its cost unknown', async () => {
    const s = await setup(); revokeAfterClaim(s.lease, 'page_1_0');
    await expect(s.io.render('page_1_0', 'A page prompt.', [], 'identity')).rejects.toThrow('lease_gone');
    expect([image.generate.mock.calls.length, s.keys.reads]).toEqual([0, 0]);
    expect(paid(s.dir)).toEqual(['page_1_0.claim.json', 'page_1_0.failure.json', 'page_1_0.result.json', 'page_1_0.wire.json']);
    expect(JSON.parse(readFileSync(path.join(s.dir, 'paid', 'page_1_0.failure.json'), 'utf8')).receipt).toBeNull();
    expect(s.meter.snapshot()).toMatchObject({ calls: 1, unknownCost: 1, newKnownApiMicroUsd: 0 });
  });
  it('render: a guard lost while the call is in flight keeps the real receipt and known cost, and the result is not returned', async () => {
    const s = await setup();
    image.generate.mockImplementation(async (input: any) => {
      s.lease.held = false; const usage = { input_tokens: 1500, output_tokens: 1800 }; input.observeProviderResponse?.({ usage });
      return { buffer: await pngOf(input.size), model: 'gpt-image-2', usage, fallbackUsed: false };
    });
    await expect(s.io.render('page_1_0', 'A page prompt.', [], 'identity')).rejects.toThrow('lease_gone');
    expect(image.generate).toHaveBeenCalledTimes(1); expect(s.keys.reads).toBe(1);
    const result = JSON.parse(readFileSync(path.join(s.dir, 'paid', 'page_1_0.result.json'), 'utf8'));
    expect(result).toMatchObject({ completed: true, estimatedMicroUsd: expect.any(Number) });
    expect(JSON.parse(readFileSync(path.join(s.dir, 'paid', 'page_1_0.receipt.json'), 'utf8')).candidate.imageName).toBe('page_1_0.png');
    expect(s.meter.snapshot()).toMatchObject({ calls: 1, unknownCost: 0, failed: 0 });
  });
  it('render: with the guard held the call runs and returns its candidate (behaviour unchanged)', async () => {
    const s = await setup();
    image.generate.mockImplementation(async (input: any) => { const usage = { input_tokens: 10, output_tokens: 10 }; input.observeProviderResponse?.({ usage });
      return { buffer: await pngOf(input.size), model: 'gpt-image-2', usage, fallbackUsed: false }; });
    await expect(s.io.render('page_1_0', 'A page prompt.', [], 'identity')).resolves.toMatchObject({ imageName: 'page_1_0.png' });
    expect(s.lease.checks).toBe(3); // before the claim, inside it, after it
  });
  it('judge: a guard revoked after the claim stops before the key and the review call', async () => {
    const s = await setup(), candidate = await s.io.writeImage('page_2_0.png', s.png); revokeAfterClaim(s.lease, 'page_2_0_qa');
    await expect(s.io.judge('page_2_0_qa', candidate, { version: 'synthetic-context' }, 'a'.repeat(64), [], null, 'page')).rejects.toThrow('lease_gone');
    expect([sdk.create.mock.calls.length, s.keys.reads]).toEqual([0, 0]);
    expect(s.meter.snapshot()).toMatchObject({ calls: 1, unknownCost: 1 });
  });
  it('identity: a guard revoked after the claim stops before the key and the HTTP call; the claim closes with its cost unknown', async () => {
    const s = await setup(), fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy);
    const ref = await s.io.writeImage('child_ref.png', s.png), cand = await s.io.writeImage('page_1_0.png', s.png);
    revokeAfterClaim(s.lease, 'page_1_0_identity');
    await expect(s.io.identity('page_1_0_identity', ref, cand)).rejects.toThrow('lease_gone');
    expect([fetchSpy.mock.calls.length, s.keys.reads]).toEqual([0, 0]);
    expect(JSON.parse(readFileSync(path.join(s.dir, 'paid', 'page_1_0_identity.failure.json'), 'utf8')).receipt).toBeNull();
    expect(s.meter.snapshot()).toMatchObject({ calls: 1, unknownCost: 1 });
    vi.unstubAllGlobals();
  });
  it('identity: a guard lost while the HTTP call is in flight keeps the real receipt and known cost, and the score is not returned', async () => {
    const s = await setup();
    vi.stubGlobal('fetch', vi.fn(async () => { s.lease.held = false;
      return new Response(JSON.stringify({ model: 'gpt-4o', usage: { prompt_tokens: 1200, completion_tokens: 60 },
        choices: [{ message: { content: JSON.stringify({ subjectVisible: true, sameChild: true, resemblanceScore: 0.9 }) } }] }), { status: 200 }); }));
    const ref = await s.io.writeImage('child_ref.png', s.png), cand = await s.io.writeImage('page_1_0.png', s.png);
    await expect(s.io.identity('page_1_0_identity', ref, cand)).rejects.toThrow('lease_gone');
    expect(s.keys.reads).toBe(1);
    expect(JSON.parse(readFileSync(path.join(s.dir, 'paid', 'page_1_0_identity.result.json'), 'utf8'))).toMatchObject({ completed: true, estimatedMicroUsd: expect.any(Number) });
    expect(JSON.parse(readFileSync(path.join(s.dir, 'paid', 'page_1_0_identity.receipt.json'), 'utf8'))).toMatchObject({ status: 200, raw: { model: 'gpt-4o' } });
    expect(s.meter.snapshot()).toMatchObject({ calls: 1, unknownCost: 0, failed: 0 });
    vi.unstubAllGlobals();
  });
  it('judge: a guard lost while the review is in flight never drops the real receipt (the in-claim tail is cancellation only)', async () => {
    const s = await setup(), candidate = await s.io.writeImage('page_2_0.png', s.png);
    sdk.create.mockImplementation(async () => { s.lease.held = false;
      return { status: 'completed', model: 'gpt-6.1-sol', service_tier: 'default', usage: { input_tokens: 9000, output_tokens: 2500 }, output_text: '{}' }; });
    // A synthetic answer the page schema refuses: recorded with its receipt and known cost. (A schema-valid page verdict is not synthesised
    // here; the post-review fence is the same one statement as the render's, which the render in-flight case proves.)
    await expect(s.io.judge('page_2_0_qa', candidate, { version: 'synthetic-context' }, 'a'.repeat(64), [], null, 'page')).rejects.toThrow();
    expect(sdk.create).toHaveBeenCalledTimes(1); expect(s.keys.reads).toBe(1);
    expect(JSON.parse(readFileSync(path.join(s.dir, 'paid', 'page_2_0_qa.failure.json'), 'utf8')).receipt).toMatchObject({ estimatedMicroUsd: expect.any(Number) });
    expect(s.meter.snapshot()).toMatchObject({ calls: 1, unknownCost: 0 });
  });
  it('the current R17 caller: its guard reads only its own inputs, trial claim and outcome (never a meter record), so it holds inside a claim', async () => {
    // Source pin: the R17 book trial's guard, and that the SAME guard fences its child and page adapters (read only, never executed here).
    const src = readFileSync(path.resolve(__dirname, '../../../scripts/personal-book-e2e-trial.ts'), 'utf8');
    expect(src).toContain("const guard=()=>{currentInputs();if(shaFile(claimFile)!==claimSha||existsSync(outcomeFile)||");
    expect(src).toContain('const childIO=auditionAdapters({directory:childImages,meter,key,signal,guard})');
    expect(src).toContain('const art=auditionAdapters({directory:imageDir,meter,key,signal,guard,readerFraming:');
    // Its text routes already call guard() inside their claims (the pattern the fence now applies to images, reviews and identity).
    expect(src).toContain("return o.api.run(step,wire,reserve,async()=>{o.guard();");
    // The same guard shape over real files: the meter's own claim records (paid/) never touch the trial claim, so the in-claim check
    // passes; an outcome written while the call is in flight is refused only after the receipt settles.
    const s = await setup(), claimFile = path.join(s.dir, 'trial.claim.json'), outcomeFile = path.join(s.dir, 'trial.outcome.json');
    writeFileSync(claimFile, '{"cycle":"r17"}'); const claimSha = sha(readFileSync(claimFile));
    const guard = () => { if (sha(readFileSync(claimFile)) !== claimSha || existsSync(outcomeFile)) throw new Error('trial_claim_changed'); };
    const io = auditionAdapters({ directory: s.images, meter: s.meter, key: () => 'k', signal: new AbortController().signal, guard });
    image.generate.mockImplementation(async (input: any) => { const usage = { input_tokens: 10, output_tokens: 10 }; input.observeProviderResponse?.({ usage });
      return { buffer: await pngOf(input.size), model: 'gpt-image-2', usage, fallbackUsed: false }; });
    await expect(io.render('page_1_0', 'A page prompt.', [], 'identity')).resolves.toMatchObject({ imageName: 'page_1_0.png' });
    image.generate.mockImplementation(async (input: any) => { writeFileSync(outcomeFile, '{}'); const usage = { input_tokens: 10, output_tokens: 10 };
      input.observeProviderResponse?.({ usage }); return { buffer: await pngOf(input.size), model: 'gpt-image-2', usage, fallbackUsed: false }; });
    await expect(io.render('page_2_0', 'A page prompt.', [], 'identity')).rejects.toThrow('trial_claim_changed');
    expect(JSON.parse(readFileSync(path.join(s.dir, 'paid', 'page_2_0.result.json'), 'utf8'))).toMatchObject({ completed: true, estimatedMicroUsd: expect.any(Number) });
    expect(s.meter.snapshot()).toMatchObject({ calls: 2, unknownCost: 0, failed: 0 });
  });
  it('without a guard nothing changes: cancellation only', async () => {
    const s = await setup(), io = auditionAdapters({ directory: s.images, meter: s.meter, key: () => 'k', signal: new AbortController().signal });
    image.generate.mockImplementation(async (input: any) => { const usage = { input_tokens: 10, output_tokens: 10 }; input.observeProviderResponse?.({ usage });
      return { buffer: await pngOf(input.size), model: 'gpt-image-2', usage, fallbackUsed: false }; });
    await expect(io.render('page_1_0', 'A page prompt.', [], 'identity')).resolves.toMatchObject({ imageName: 'page_1_0.png' });
  });
});
