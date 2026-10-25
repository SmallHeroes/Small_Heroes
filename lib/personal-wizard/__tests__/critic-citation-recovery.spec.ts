import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { prepareSimpleStory, writeSimpleStory, type SimpleStoryCall } from '../simple-story-engine';
import { SIMPLE_CHILD_MOMENTUM_EXPERIENCE, SIMPLE_CHILD_MOMENTUM_VERSION } from '../simple-story-experience';
import { resolvePersonalWizardOptions } from '../options';
import { createCurrentSimpleStorySource, simpleStoryReadingPackets } from '../simple-story-source';
import { causalSourceReviewPacket, compileCausalSourceReading, compileCausalSourceReadingWithCorrection, CausalExperimentError,
  type CitationCorrectionCall } from '../story-causal-experiment';
import { citationTokens, prepareSourceCitationCorrection } from '../story-source-citations';
import { runSimpleWizardBook } from '../simple-book-flow';
import { createSolWritingTransport, prepareSolWritingWire, SOL_WRITING } from '../../../scripts/personal-sol-writing-transport';

const options = resolvePersonalWizardOptions();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const request = () => ({ kind: 'personal_book_request', version: 'reviewed-personal-book-request/v3', draftId: 'd_citation0001', draftRevision: 1,
  child: { name: 'תמר', age: 6, address: 'girl', residence: 'עיר הדמיון', nameSource: 'typed', ageSource: 'typed', addressSource: 'typed', residenceSource: 'typed' },
  facts: [{ id: 'f_citation0001', kind: 'interest', value: 'לצייר', source: 'typed' }], noDifficulty: true,
  storyPlace: null, companion: { id: 'dragon_dini' }, intent: { kind: 'just_for_fun' }, avoid: [],
  appearance: { photo: 'none' }, bookOptions: { lengthId: 'short', voiceId: null } });
// Synthetic wiring only. Distinct tokens per position so every source unit has its own words.
function syntheticOutput(call: SimpleStoryCall) {
  const value = { title: 'תמר ודיני בדרך',
    pages: Array.from({ length: 8 }, (_, p) => ({ text: `תמר ודיני רצו לצייר ולשחק. ${Array.from({ length: 80 }, (_, k) => `צעד${p}x${k}`).join(' ')}.` })),
    childGoal: 'תמר רוצה לשחק', companionWant: 'דיני רוצה לצייר', comicPromise: 'משחק משותף', ending: 'הן ממשיכות לשחק',
    pageMap: Array.from({ length: 8 }, (_, i) => ({ location: 'חצר דמיונית', transitionReason: 'המשחק נמשך', childAction: 'תמר מציירת',
      companionAction: 'דיני משחקת', consequence: 'המשחק נמשך', continuity: 'הציור על השולחן', factIds: i ? [] : ['f_citation0001'] })),
    resilienceMoments: [{ page: 4, childChoice: 'תמר בוחרת לשחק', whatHelps: 'הציור משותף' }], writingContractVersion: SIMPLE_CHILD_MOMENTUM_VERSION };
  return call.stage === 'author' ? value : { ...value, editorChanges: ['Synthetic unchanged story, not literary improvement.'] };
}
let sequence = 0;
async function solRecord(call: SimpleStoryCall) {
  const output = syntheticOutput(call), raw = { id: `resp_synthetic_${call.stage}_citation_${sequence++}`, model: SOL_WRITING.model, status: 'completed',
    service_tier: 'default', output_text: JSON.stringify(output), usage: { input_tokens: 100, output_tokens: 100 },
    output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(output), annotations: [] }] }] };
  return createSolWritingTransport({ key: () => 'SYNTHETIC-NOT-A-REAL-KEY', fetch: async () => new Response(JSON.stringify(raw),
    { status: 200, headers: { 'content-type': 'application/json' } }) })(prepareSolWritingWire(call), call, new AbortController().signal);
}
async function packets() {
  const req = request(), p = prepareSimpleStory(req, options, 'citation-recovery', SIMPLE_CHILD_MOMENTUM_EXPERIENCE), records: Record<string, any> = {};
  const generated = await writeSimpleStory(p, async call => { const r = await solRecord(call); records[call.stage] = r;
    return { output: r.output, usage: r.usage!, estimatedUsd: r.estimatedMicroUsd! / 1e6 }; }, { model: SOL_WRITING.model, reservedUsd: 1.2 });
  const source = createCurrentSimpleStorySource(req, generated, records as any, options, SOL_WRITING.model);
  return { req, packets: simpleStoryReadingPackets(req, source, options) };
}
type Unit = { id: string; text: string };
const words = (u: Unit) => citationTokens(u.text);
const unitsOf = (body: any, side: 'original' | 'revised' | 'manuscript') => body[side].pages[0].units as Unit[];
/** The three R14 failure types (prefix dropped, boundary-crossing range started late, wrong unit) plus a valid reference. */
function failingComparison(body: any, digest: string) {
  const o = unitsOf(body, 'original'), r = unitsOf(body, 'revised');
  expect(o.length).toBeGreaterThanOrEqual(3); expect(words(r[0]).slice(0, 3)).toEqual(['תמר', 'ודיני', 'רצו']);
  const valid = (u: Unit) => ({ startId: u.id, endId: u.id, anchor: words(u).slice(0, 2).join(' ') });
  const first = words(o[0]), crossing = `${first[first.length - 1]} ${words(o[1]).slice(0, 2).join(' ')}`;
  const raw = { packetDigest: digest, summary: 'Synthetic comparison for citation wiring only.', findings: [
    { severity: 'meaningful', kind: 'improvement', criterion: 'Synthetic criterion one for wiring.', explanation: 'Synthetic explanation one for wiring.',
      original: [valid(o[1])], revised: [{ startId: r[0].id, endId: r[0].id, anchor: 'דיני רצו' }] },
    { severity: 'polish', kind: 'improvement', criterion: 'Synthetic criterion two for wiring.', explanation: 'Synthetic explanation two for wiring.',
      original: [{ startId: o[1].id, endId: o[1].id, anchor: crossing }], revised: [valid(r[1])] },
    { severity: 'polish', kind: 'new_regression', criterion: 'Synthetic criterion three for wiring.', explanation: 'Synthetic explanation three for wiring.',
      original: [valid(o[1])], revised: [{ startId: r[1].id, endId: r[1].id, anchor: words(r[2]).slice(0, 2).join(' ') }] }] };
  const fixes = { '0/revised/0': { startId: r[0].id, endId: r[0].id, anchor: 'ודיני רצו' },
    '1/original/0': { startId: o[0].id, endId: o[1].id, anchor: crossing },
    '2/revised/0': { startId: r[2].id, endId: r[2].id, anchor: words(r[2]).slice(0, 2).join(' ') } };
  return { raw, fixes };
}
const answerFor = (call: CitationCorrectionCall, fixes: Record<string, { startId: string; endId: string; anchor: string }>) => {
  const input = JSON.parse(call.input);
  return { correctionDigest: input.correctionDigest, corrections: input.correction.invalid.map((row: any) => ({ path: row.path, ...fixes[row.path] })) };
};
async function expectCode(task: Promise<unknown>, code: string) {
  const error = await task.then(() => null, e => e);
  expect(error).toBeInstanceOf(CausalExperimentError); expect((error as CausalExperimentError).code).toBe(code);
}

describe('critic citation recovery: one bounded correction through the shared helper (provider-free)', () => {
  it('repairs the three R14 failure types with ONE call; only the refused references change; the strict compiler admits it', async () => {
    const { packets: p } = await packets(), n = causalSourceReviewPacket(p.comparison), { raw, fixes } = failingComparison(n.packet, n.packetDigest);
    const before = structuredClone(raw), calls: CitationCorrectionCall[] = [];
    expect(() => compileCausalSourceReading(p.comparison, raw)).toThrow('causal_experiment_critic_evidence');
    const result = await compileCausalSourceReadingWithCorrection(p.comparison, raw, async call => { calls.push(call); return answerFor(call, fixes); });
    expect(calls.length).toBe(1); expect(calls[0].stage).toBe('citation_correction');
    expect(JSON.parse(calls[0].input).correction.invalid.map((r: any) => r.path).sort()).toEqual(['0/revised/0', '1/original/0', '2/revised/0']);
    for (const rule of ['ו, ה, ב, ל, כ, מ or ש', 'the range must include both units', 'startId is the unit that contains the first word']) expect(calls[0].instructions).toContain(rule);
    expect(raw).toEqual(before);
    const out = result.reading.sourceEvidence.output;
    expect(out.summary).toBe(raw.summary);
    out.findings.forEach((row: any, i: number) => {
      for (const key of ['severity', 'kind', 'criterion', 'explanation'] as const) expect(row[key]).toBe((raw.findings[i] as any)[key]);
    });
    expect(out.findings[0].original).toEqual(raw.findings[0].original); expect(out.findings[1].revised).toEqual(raw.findings[1].revised);
    expect(out.findings[0].revised[0]).toEqual(fixes['0/revised/0']); expect(out.findings[1].original[0]).toEqual(fixes['1/original/0']);
    expect(result.citationCorrection).toMatchObject({ version: 'story-source-citations-correction/v1', instructions: 'v2', paths: ['0/revised/0', '1/original/0', '2/revised/0'],
      instructionsDigest: sha(JSON.stringify(calls[0].instructions)) });
    expect(compileCausalSourceReading(p.comparison, out)).toEqual(result.reading);
  });
  it('a correction that is still wrong stops with critic_evidence after exactly one call', async () => {
    const { packets: p } = await packets(), n = causalSourceReviewPacket(p.comparison), { raw, fixes } = failingComparison(n.packet, n.packetDigest);
    let calls = 0;
    await expectCode(compileCausalSourceReadingWithCorrection(p.comparison, raw, async call => { calls++;
      return answerFor(call, { ...fixes, '0/revised/0': { ...fixes['0/revised/0'], anchor: 'דיני רצו' } }); }), 'critic_evidence');
    expect(calls).toBe(1);
  });
  it('a correction cannot rewrite a finding, drop or add a path, or bind another request', async () => {
    const { packets: p } = await packets(), n = causalSourceReviewPacket(p.comparison), { raw, fixes } = failingComparison(n.packet, n.packetDigest);
    const run = (edit: (answer: any) => void) => compileCausalSourceReadingWithCorrection(p.comparison, raw, async call => { const a = answerFor(call, fixes); edit(a); return a; });
    await expectCode(run(a => { a.corrections[0].explanation = 'rewritten finding text'; }), 'critic_binding');
    await expectCode(run(a => { a.corrections.pop(); }), 'critic_evidence');
    await expectCode(run(a => { a.corrections.push({ ...a.corrections[0] }); }), 'critic_evidence');
    await expectCode(run(a => { a.correctionDigest = 'a'.repeat(64); }), 'critic_binding');
  });
  it('makes no call for a valid answer, a binding failure or a structural (non-citation) failure, and keeps the plain codes', async () => {
    const { packets: p } = await packets(), n = causalSourceReviewPacket(p.comparison), { raw, fixes } = failingComparison(n.packet, n.packetDigest);
    let calls = 0; const correct = async (call: CitationCorrectionCall) => { calls++; return answerFor(call, fixes); };
    const fixed = structuredClone(raw); fixed.findings.forEach((row, i) => { if (i === 0) row.revised[0] = fixes['0/revised/0']; if (i === 1) row.original[0] = fixes['1/original/0'];
      if (i === 2) row.revised[0] = fixes['2/revised/0']; });
    expect((await compileCausalSourceReadingWithCorrection(p.comparison, fixed, correct)).citationCorrection).toBeNull();
    await expectCode(compileCausalSourceReadingWithCorrection(p.comparison, { ...raw, packetDigest: 'b'.repeat(64) }, correct), 'critic_binding');
    const oneSided = structuredClone(raw); oneSided.findings[1].revised = [];
    await expectCode(compileCausalSourceReadingWithCorrection(p.comparison, oneSided, correct), 'critic_evidence');
    const wrongKind = structuredClone(raw); wrongKind.findings[0].kind = 'issue';
    const plain = (() => { try { compileCausalSourceReading(p.comparison, wrongKind); } catch (e) { return (e as CausalExperimentError).code; } })();
    await expectCode(compileCausalSourceReadingWithCorrection(p.comparison, wrongKind, correct), plain!);
    expect(calls).toBe(0);
  });
  it('keeps the plain compiler codes for every structural rule after the per-row shape refactor', async () => {
    const { packets: p } = await packets(), fin = causalSourceReviewPacket(p.final), cmp = causalSourceReviewPacket(p.comparison);
    const m = unitsOf(fin.packet, 'manuscript'), o = unitsOf(cmp.packet, 'original'), r = unitsOf(cmp.packet, 'revised');
    const ref = (u: Unit) => ({ startId: u.id, endId: u.id, anchor: words(u).slice(0, 2).join(' ') });
    const row = (kind: string, original: unknown[], revised: unknown[]) => ({ severity: 'polish', kind, criterion: 'Synthetic criterion for codes.', explanation: 'Synthetic explanation for codes.', original, revised });
    const codeOf = (packet: any, digest: string, findings: unknown[]) => { try { compileCausalSourceReading(packet, { packetDigest: digest, summary: 'Synthetic summary for codes.', findings }); return 'ok'; }
      catch (e) { return (e as CausalExperimentError).code; } };
    expect(codeOf(p.final, fin.packetDigest, [row('issue', [], [ref(m[0])])])).toBe('ok');
    expect(codeOf(p.final, fin.packetDigest, [row('improvement', [], [ref(m[0])])])).toBe('critic_comparison_leak');
    expect(codeOf(p.final, fin.packetDigest, [row('issue', [], [])])).toBe('critic_evidence');
    expect(codeOf(p.comparison, cmp.packetDigest, [row('improvement', [ref(o[0])], [ref(r[0])])])).toBe('ok');
    expect(codeOf(p.comparison, cmp.packetDigest, [row('issue', [ref(o[0])], [ref(r[0])])])).toBe('critic_comparison_kind');
    expect(codeOf(p.comparison, cmp.packetDigest, [row('improvement', [ref(o[0])], [])])).toBe('critic_evidence');
    expect(codeOf(p.comparison, cmp.packetDigest, [row('improvement', [ref(o[0])], [ref(r[0])]), row('issue', [ref(o[0])], [ref(r[0])])])).toBe('critic_comparison_kind');
  });
  it('leaves the existing correction contract byte-identical by default (v1 wording, same body and digest for v2)', async () => {
    const { packets: p } = await packets(), n = causalSourceReviewPacket(p.comparison), { raw } = failingComparison(n.packet, n.packetDigest);
    const v1 = prepareSourceCitationCorrection(n, raw), v2 = prepareSourceCitationCorrection(n, raw, 'v2');
    // sha256 of the v1 wording read from base 0a77fc1c via Git (artifact v1-wording-sha.cjs).
    expect(sha(v1.instructions)).toBe('b4b0e1efe0596fb76a5f867a2d30bb712a1aeae601b9b0ea9bc33e7c57a4409c');
    expect(v2.instructions).not.toBe(v1.instructions);
    expect(v2.body).toEqual(v1.body); expect(v2.correctionDigest).toBe(v1.correctionDigest); expect(v2.input).toBe(v1.input);
  });
});

describe('book flow opt-in citationCorrector', () => {
  const flow = (corrector: boolean, correctReading = false, calls: string[] = []) => runSimpleWizardBook({ request: request(), options, seed: 'citation-recovery',
    signal: new AbortController().signal, storyExperience: SIMPLE_CHILD_MOMENTUM_EXPERIENCE, writingModel: SOL_WRITING.model, reservedWritingUsd: 1.2,
    opus: async call => solRecord(call) as any,
    reader: async call => {
      const data = JSON.parse(call.input), body = data.packet;
      if (call.stage === 'comparison') return failingComparison(body, data.packetDigest).raw;
      const unit = unitsOf(body, 'manuscript')[0];
      return { packetDigest: data.packetDigest, summary: 'Synthetic final review for flow wiring.', findings: [{ severity: 'meaningful', kind: 'issue',
        criterion: 'Synthetic material concern for flow wiring.', explanation: 'Synthetic listener effect for flow wiring.', original: [],
        revised: [{ startId: unit.id, endId: unit.id, anchor: words(unit).slice(0, 2).join(' ') }] }] };
    },
    ...(corrector ? { citationCorrector: async (stage: string, call: CitationCorrectionCall) => {
      calls.push(stage); const input = JSON.parse(call.input);
      return { correctionDigest: input.correctionDigest, corrections: input.correction.invalid.map((row: any) => {
        const units: Unit[] = row.units, at = (id: string) => units.findIndex(u => u.id === id);
        if (row.path === '0/revised/0') return { path: row.path, startId: units[0].id, endId: units[0].id, anchor: 'ודיני רצו' };
        if (row.path === '1/original/0') return { path: row.path, startId: units[at(row.returned.startId) - 1].id, endId: row.returned.endId, anchor: row.returned.anchor };
        const next = units[at(row.returned.startId) + 1]; return { path: row.path, startId: next.id, endId: next.id, anchor: row.returned.anchor };
      }) }; } } : {}),
    ...(correctReading ? { correctReading: async () => { throw Error('UNUSED'); } } : {}),
    visual: async () => { throw Error('STOP_BEFORE_STORYBOARD_PROVIDER'); }, publish: () => {} });
  it('admits a comparison after one bounded correction and reports its provenance', async () => {
    const calls: string[] = [], result: any = await flow(true, false, calls);
    expect(result.status).toBe('story_held'); expect(calls).toEqual(['comparison']);
    expect(result.citationCorrections).toHaveLength(1); expect(result.citationCorrections[0].stage).toBe('comparison');
    expect(result.citationCorrections[0].provenance.paths).toEqual(['0/revised/0', '1/original/0', '2/revised/0']);
  });
  it('the existing correctReading route still corrects through its own callback after the restructure', async () => {
    const used: string[] = [];
    const result: any = await runSimpleWizardBook({ request: request(), options, seed: 'citation-recovery', signal: new AbortController().signal,
      storyExperience: SIMPLE_CHILD_MOMENTUM_EXPERIENCE, writingModel: SOL_WRITING.model, reservedWritingUsd: 1.2, opus: async call => solRecord(call) as any,
      reader: async call => { const data = JSON.parse(call.input), body = data.packet;
        if (call.stage === 'comparison') return failingComparison(body, data.packetDigest).raw;
        const unit = unitsOf(body, 'manuscript')[0];
        return { packetDigest: data.packetDigest, summary: 'Synthetic final review for flow wiring.', findings: [{ severity: 'meaningful', kind: 'issue',
          criterion: 'Synthetic material concern for flow wiring.', explanation: 'Synthetic listener effect for flow wiring.', original: [],
          revised: [{ startId: unit.id, endId: unit.id, anchor: words(unit).slice(0, 2).join(' ') }] }] }; },
      correctReading: async (stage, numbered, raw) => { used.push(stage);
        const { fixes } = failingComparison(numbered.packet, numbered.packetDigest), corrected: any = structuredClone(raw);
        for (const [p, ref] of Object.entries(fixes)) { const [f, side, i] = p.split('/'); corrected.findings[Number(f)][side][Number(i)] = ref; }
        return corrected; },
      visual: async () => { throw Error('STOP_BEFORE_STORYBOARD_PROVIDER'); }, publish: () => {} });
    expect(used).toEqual(['comparison']); expect(result.status).toBe('story_held'); expect(result).not.toHaveProperty('citationCorrections');
  });
  it('without the opt-in the same answer still stops; both correction routes together refuse', async () => {
    await expect(flow(false)).rejects.toThrow('causal_experiment_critic_evidence');
    await expect(flow(true, true)).rejects.toThrow('simple_book_citation_correction_route');
  });
});
