import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { personalStoryboardFixture } from '../personal-wizard/__tests__/personal-storyboard-fixture';
import { preparePersonalStory } from '../personal-wizard/story-writer';
import { resolvePersonalWizardOptions } from '../personal-wizard/options';
import { causalDigest, causalSourceReviewPacket } from '../personal-wizard/story-causal-experiment';
import { prepareOriginalReaderProbe, runOriginalReaderProbe, prepareOriginalReaderComparison, runOriginalReaderComparison,
  SOLUTION_REASONING_READER_INSTRUCTIONS } from '../../scripts/personal-original-reader-probe';
import { generationTimeoutMs } from '../personal-wizard/story-config';

const dirs: string[] = [];
afterEach(() => { vi.useRealTimers(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
async function setup() {
  const f = await personalStoryboardFixture();
  const prepared = preparePersonalStory(f.request, resolvePersonalWizardOptions());
  const original = { plan: f.result.plan, manuscript: f.result.manuscript, characterDigest: prepared.brief.companion.characterDigest };
  const root = mkdtempSync(path.join(tmpdir(), 'original-reader-probe-')); dirs.push(root);
  const args = { prepared, original, expectedOriginalDigest: causalDigest(original), approvalReference: 'synthetic-reader-probe-approval',
    commonDir: root, outputParent: root, key: vi.fn(() => 'synthetic-no-real-key'), signal: new AbortController().signal };
  const probe = prepareOriginalReaderProbe(args, args.approvalReference);
  const output = { packetDigest: probe.manifest.packetDigest, summary: 'Synthetic original reading, not product acceptance.', findings: [] };
  const fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'resp_synthetic', object: 'response', status: 'completed',
    model: 'gpt-6-astra', service_tier: 'default', usage: { input_tokens: 10, output_tokens: 20 },
    output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(output), annotations: [] }] }] }),
    { status: 200, headers: { 'content-type': 'application/json' } }));
  return { args, probe, fetch, output, root,
    journal: path.join(root, 'codex-causal-text-trials', probe.family), outputRoot: path.join(root, probe.family) };
}
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
describe('one original-only source-bound probe, no live provider', () => {
  it('candidate profile changes only bound instructions and metadata, never source, schema, cap or approval family', async () => {
    const h = await setup(), before = structuredClone(h.args.original);
    const candidate = prepareOriginalReaderProbe({ ...h.args, readingProfile: 'solution_reasoning' }, h.args.approvalReference);
    expect(candidate.family).toBe(h.probe.family);
    expect(candidate.manifest.readingProfile).toBe('solution_reasoning');
    expect(h.probe.manifest).not.toHaveProperty('readingProfile');
    expect(candidate.packet.instructions).toBe(h.probe.packet.instructions + SOLUTION_REASONING_READER_INSTRUCTIONS);
    expect(candidate.call.instructions).toBe(causalSourceReviewPacket(candidate.packet).instructions);
    expect(candidate.packet.manuscript).toEqual(h.probe.packet.manuscript);
    expect(candidate.packet.brief).toEqual(h.probe.packet.brief);
    expect(candidate.call.schema).toBe(h.probe.call.schema);
    expect(candidate.call.maxOutputTokens).toBe(h.probe.call.maxOutputTokens);
    expect(candidate.manifest.packetDigest).not.toBe(h.probe.manifest.packetDigest);
    expect(candidate.wire.digest).not.toBe(h.probe.wire.digest);
    expect(candidate.wire.payload.instructions).toBe(candidate.call.instructions);
    expect(h.args.original).toEqual(before);
  });
  it.each(['other', null, 'baseline'])('invalid profile %s fails before reservation or provider', async readingProfile => {
    const h = await setup();
    await expect(runOriginalReaderProbe({ ...h.args, readingProfile: readingProfile as any, fetch: h.fetch })).rejects.toThrow('reader_profile');
    expect(existsSync(h.journal)).toBe(false); expect(h.args.key).not.toHaveBeenCalled(); expect(h.fetch).not.toHaveBeenCalled();
  });
  it('reserves and dispatches before key, calls once, retains reading/usage, seals and forbids approval reuse across roots', async () => {
    const h = await setup(), before = structuredClone(h.args.original);
    h.args.key.mockImplementation(() => {
      expect(existsSync(path.join(h.journal, 'dispatch-case1-original_review.json'))).toBe(true);
      expect(read(path.join(h.journal, 'reservation.json')).slots).toHaveLength(1);
      return 'synthetic-no-real-key';
    });
    const r = await runOriginalReaderProbe({ ...h.args, fetch: h.fetch });
    expect(h.fetch).toHaveBeenCalledOnce(); expect(h.args.key).toHaveBeenCalledOnce();
    expect(r.reading.stage).toBe('original_review'); expect(r.reading.runtimeEligible).toBe(false);
    expect(h.args.original).toEqual(before); expect(r.receipt.estimatedMicroUsd).toBe(1125);
    expect(read(path.join(h.journal, 'sealed.json')).reason).toBe('completed_diagnostic');
    expect(read(path.join(r.outputRoot, 'manifest.json')).maximumMicroUsd).toBe(1_000_000);
    expect(r.manifest.reservedMicroUsd).toBeLessThanOrEqual(1_000_000);
    const other = mkdtempSync(path.join(tmpdir(), 'original-reader-other-')); dirs.push(other);
    await expect(runOriginalReaderProbe({ ...h.args, outputParent: other, fetch: h.fetch })).rejects.toThrow('family_consumed');
    expect(h.fetch).toHaveBeenCalledOnce(); expect(h.args.key).toHaveBeenCalledOnce();
    expect(existsSync(path.join(other, h.probe.family))).toBe(false);
  });
  it('wrong source fails before reservation, key or network', async () => {
    const h = await setup();
    await expect(runOriginalReaderProbe({ ...h.args, expectedOriginalDigest: 'f'.repeat(64), fetch: h.fetch })).rejects.toThrow('reader_probe_binding');
    expect(existsSync(h.journal)).toBe(false); expect(h.args.key).not.toHaveBeenCalled(); expect(h.fetch).not.toHaveBeenCalled();
  });
  it('whole-wire budget fails before reservation even though the output cap is unchanged', async () => {
    const h = await setup(); h.args.original.manuscript.pages.forEach(p => { p.text = 'טקסט '.repeat(270).trim(); });
    h.args.expectedOriginalDigest = causalDigest(h.args.original);
    await expect(runOriginalReaderProbe({ ...h.args, fetch: h.fetch })).rejects.toThrow('wire_budget');
    expect(existsSync(h.journal)).toBe(false); expect(h.args.key).not.toHaveBeenCalled(); expect(h.fetch).not.toHaveBeenCalled();
  });
  it.each(['incomplete', 'malformed', 'wrong_quote', 'wrong_digest', 'unknown_usage', 'over_budget'] as const)('%s retains failure evidence and consumes exactly one allowance', async mode => {
    const h = await setup();
    if (mode === 'wrong_quote') h.output.findings = [{ severity: 'meaningful', criterion: 'Synthetic unsupported quote', kind: 'issue',
      original: [{ pageNumber: 1, quote: 'THIS TEXT NEVER OCCURS' }], revised: [], explanation: 'Synthetic assertion only, no real literary judgment.' }] as any;
    if (mode === 'wrong_digest') h.output.packetDigest = 'f'.repeat(64);
    const raw = { id: 'resp_synthetic', object: 'response', status: mode === 'incomplete' ? 'incomplete' : 'completed',
      incomplete_details: mode === 'incomplete' ? { reason: 'max_output_tokens' } : null,
      model: 'gpt-6-astra', service_tier: 'default',
      usage: mode === 'unknown_usage' ? null : { input_tokens: mode === 'over_budget' ? 100000 : 10, output_tokens: 20 },
      output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: mode === 'malformed' ? '{' : JSON.stringify(h.output), annotations: [] }] }] };
    h.fetch.mockImplementation(async () => new Response(JSON.stringify(raw), { status: 200, headers: { 'content-type': 'application/json' } }));
    await expect(runOriginalReaderProbe({ ...h.args, fetch: h.fetch })).rejects.toThrow();
    expect(h.fetch).toHaveBeenCalledOnce(); expect(h.args.key).toHaveBeenCalledOnce();
    expect(read(path.join(h.journal, 'sealed.json')).reason).toBe('failed');
    // The real SDK adds output_text while keeping every provider response field.
    const { output_text, ...savedRaw } = read(path.join(h.journal, 'receipt-case1-original_review.json')).raw;
    expect(savedRaw).toEqual(raw); expect(output_text).toBe(raw.output[0].content[0].text);
    expect(existsSync(path.join(h.outputRoot, 'reading.json'))).toBe(false);
    await expect(runOriginalReaderProbe({ ...h.args, fetch: h.fetch })).rejects.toThrow('output_exists');
    expect(h.fetch).toHaveBeenCalledOnce();
  });
  it('pre-aborted probe cannot reserve or read key', async () => {
    const h = await setup(), c = new AbortController(); c.abort();
    await expect(runOriginalReaderProbe({ ...h.args, signal: c.signal, fetch: h.fetch })).rejects.toThrow('cancelled');
    expect(h.args.key).not.toHaveBeenCalled(); expect(h.fetch).not.toHaveBeenCalled(); expect(existsSync(h.journal)).toBe(false);
  });
});

async function comparisonSetup() {
  const h = await setup();
  const sources = [1, 2, 3].map(index => {
    const original = structuredClone(h.args.original);
    original.manuscript.pages[0].text += ` דגימה ${index}.`;
    return { prepared: h.args.prepared, original, expectedOriginalDigest: causalDigest(original) };
  });
  const args = { ...h.args, sources }, prepared = prepareOriginalReaderComparison(sources, args.approvalReference);
  const reply = (input: string, patch: Record<string, unknown> = {}) => {
    const packet = JSON.parse(input), output = { packetDigest: packet.packetDigest, summary: 'Synthetic complete source-only reading.', findings: [] };
    return new Response(JSON.stringify({ id: 'resp_synthetic', object: 'response', status: 'completed',
      model: 'gpt-6-astra', service_tier: 'default', usage: { input_tokens: 10, output_tokens: 20 },
      output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(output), annotations: [] }] }], ...patch }),
      { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const fetch = vi.fn(async (_url: any, init: any) => reply(JSON.parse(init.body).input));
  return { ...h, args, prepared, fetch, reply };
}

describe('fixed three-source paired reader calibration, no live provider', () => {
  it('binds six paired calls in one 6 USD family, dispatches each once and keeps labels out of the provider payload', async () => {
    const h = await comparisonSetup(), before = structuredClone(h.args.sources);
    expect(h.prepared.slots).toHaveLength(6);
    expect(h.prepared.manifest.maximumMicroUsd).toBe(6_000_000);
    expect(h.prepared.manifest.reservedMicroUsd).toBeLessThanOrEqual(6_000_000);
    expect(new Set(h.prepared.calls.map(row => row.call.conversationKey)).size).toBe(6);
    expect(h.prepared.calls.map(row => row.profile)).toEqual(['baseline', 'solution_reasoning', 'solution_reasoning', 'baseline', 'baseline', 'solution_reasoning']);
    for (const sourceIndex of [1, 2, 3]) {
      const pair = h.prepared.calls.filter(row => row.sourceIndex === sourceIndex);
      expect(pair[0].packet.manuscript).toEqual(pair[1].packet.manuscript);
      expect(pair[0].packet.brief).toEqual(pair[1].packet.brief);
      for (const row of pair) {
        expect(Object.keys(row.packet).sort()).toEqual(Object.keys(h.probe.packet).sort());
        expect(row.wire.model).toBe('gpt-6-astra'); expect(row.call.maxOutputTokens).toBe(h.probe.call.maxOutputTokens);
        expect(row.wire.reservedMicroUsd).toBeLessThanOrEqual(1_000_000);
      }
    }
    h.args.key.mockImplementation(() => {
      const ordinal = h.args.key.mock.calls.length;
      expect(existsSync(path.join(h.journal, `dispatch-case${ordinal}-original_review.json`))).toBe(true);
      expect(read(path.join(h.journal, 'reservation.json')).slots).toHaveLength(6);
      return 'synthetic-no-real-key';
    });
    const result = await runOriginalReaderComparison({ ...h.args, fetch: h.fetch });
    expect(h.fetch).toHaveBeenCalledTimes(6); expect(h.args.key).toHaveBeenCalledTimes(6);
    expect(result.readings).toHaveLength(6); expect(result.runtimeEligible).toBe(false);
    expect(h.args.sources).toEqual(before);
    expect(read(path.join(h.journal, 'sealed.json')).reason).toBe('completed_diagnostic');
    expect(read(path.join(result.outputRoot, 'accounting.json')).estimatedMicroUsd).toBe(6750);
    const other = mkdtempSync(path.join(tmpdir(), 'reader-calibration-other-')); dirs.push(other);
    await expect(runOriginalReaderComparison({ ...h.args, outputParent: other, fetch: h.fetch })).rejects.toThrow('family_consumed');
    await expect(runOriginalReaderProbe({ ...h.args.sources[0], ...h.args, readingProfile: 'solution_reasoning',
      outputParent: other, fetch: h.fetch })).rejects.toThrow('family_consumed');
    expect(h.fetch).toHaveBeenCalledTimes(6);
  });
  it.each(['count', 'duplicate', 'injected_profile', 'third_digest', 'last_wire'] as const)('%s rejects the whole comparison before any reservation or key', async mode => {
    const h = await comparisonSetup();
    if (mode === 'count') h.args.sources.pop();
    if (mode === 'duplicate') h.args.sources[2] = structuredClone(h.args.sources[0]);
    if (mode === 'injected_profile') (h.args.sources[2] as any).readingProfile = 'solution_reasoning';
    if (mode === 'third_digest') h.args.sources[2].expectedOriginalDigest = 'f'.repeat(64);
    if (mode === 'last_wire') {
      h.args.sources[2].original.manuscript.pages.forEach(page => { page.text = 'טקסט '.repeat(270).trim(); });
      h.args.sources[2].expectedOriginalDigest = causalDigest(h.args.sources[2].original);
    }
    await expect(runOriginalReaderComparison({ ...h.args, fetch: h.fetch })).rejects.toThrow();
    expect(existsSync(h.journal)).toBe(false); expect(h.fetch).not.toHaveBeenCalled(); expect(h.args.key).not.toHaveBeenCalled();
  });
  it.each([1, 3])('failure at reading %s seals partial evidence and never dispatches the next slot', async ordinal => {
    const h = await comparisonSetup(); let count = 0;
    h.fetch.mockImplementation(async (_url, init) => h.reply(JSON.parse(init.body).input,
      ++count === ordinal ? { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } } : {}));
    await expect(runOriginalReaderComparison({ ...h.args, fetch: h.fetch })).rejects.toThrow();
    expect(h.fetch).toHaveBeenCalledTimes(ordinal); expect(h.args.key).toHaveBeenCalledTimes(ordinal);
    expect(read(path.join(h.journal, 'sealed.json')).reason).toBe('failed');
    expect(read(path.join(h.outputRoot, 'failure.json')).completedReadings).toBe(ordinal - 1);
    expect(existsSync(path.join(h.journal, `dispatch-case${ordinal + 1}-original_review.json`))).toBe(false);
    expect(existsSync(path.join(h.journal, `receipt-case${ordinal}-original_review.json`))).toBe(true);
  });
  it.each(['cancel', 'timeout'] as const)('%s during a request seals the family; late completion cannot admit a reading', async mode => {
    const h = await comparisonSetup(); vi.useFakeTimers();
    const controller = new AbortController(); let release!: (value: Response) => void;
    h.fetch.mockImplementation(() => new Promise<Response>(resolve => { release = resolve; }));
    const job = runOriginalReaderComparison({ ...h.args, signal: controller.signal, fetch: h.fetch });
    const outcome = expect(job).rejects.toThrow(mode === 'cancel' ? 'cancelled' : 'timeout');
    await vi.advanceTimersByTimeAsync(1);
    expect(h.fetch).toHaveBeenCalledOnce();
    if (mode === 'cancel') controller.abort(); else await vi.advanceTimersByTimeAsync(generationTimeoutMs(12000) + 1);
    await outcome;
    const seal = readFileSync(path.join(h.journal, 'sealed.json'), 'utf8');
    release(h.reply(h.prepared.calls[0].call.input));
    await vi.advanceTimersByTimeAsync(1);
    expect(h.fetch).toHaveBeenCalledOnce();
    expect(readFileSync(path.join(h.journal, 'sealed.json'), 'utf8')).toBe(seal);
    expect(existsSync(path.join(h.outputRoot, 'reading-case1-original_review.json'))).toBe(false);
    expect(existsSync(path.join(h.journal, 'dispatch-case2-original_review.json'))).toBe(false);
  });
});
