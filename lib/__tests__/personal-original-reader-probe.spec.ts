import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { personalStoryboardFixture } from '../personal-wizard/__tests__/personal-storyboard-fixture';
import { preparePersonalStory } from '../personal-wizard/story-writer';
import { resolvePersonalWizardOptions } from '../personal-wizard/options';
import { causalDigest } from '../personal-wizard/story-causal-experiment';
import { prepareOriginalReaderProbe, runOriginalReaderProbe } from '../../scripts/personal-original-reader-probe';

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
  const output = { packetDigest: causalDigest(probe.packet), summary: 'Synthetic original reading, not product acceptance.', findings: [] };
  const fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'resp_synthetic', object: 'response', status: 'completed',
    model: 'gpt-6-astra', service_tier: 'default', usage: { input_tokens: 10, output_tokens: 20 },
    output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(output), annotations: [] }] }] }),
    { status: 200, headers: { 'content-type': 'application/json' } }));
  return { args, probe, fetch, output, root,
    journal: path.join(root, 'codex-causal-text-trials', probe.family), outputRoot: path.join(root, probe.family) };
}
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
describe('one original-only source-bound probe, no live provider', () => {
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
