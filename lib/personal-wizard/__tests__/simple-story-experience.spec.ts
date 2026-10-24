import { describe, expect, it, vi } from 'vitest';
import { zodTextFormat } from 'openai/helpers/zod';
import { resolvePersonalWizardOptions } from '../options';
import { canonicalJson } from '../request-acceptance';
import { SIMPLE_STORY_ENGINE_VERSION, SIMPLE_AUTHOR_INSTRUCTIONS, SIMPLE_EDITOR_INSTRUCTIONS,
  prepareSimpleStory, simpleAuthorCall, simpleEditorCall, writeSimpleStory, type SimpleStoryCall, type SimpleStoryDraft } from '../simple-story-engine';
import { SIMPLE_STORY_DELIGHT_VERSION, SIMPLE_STORY_EXPERIENCE, DELIGHT_AUTHOR_INSTRUCTIONS,
  DELIGHT_EDITOR_INSTRUCTIONS, DELIGHT_REVIEW_INSTRUCTIONS, type SimpleStoryExperience } from '../simple-story-experience';
import { admitCurrentSimpleStorySource, createCurrentSimpleStorySource, simpleStoryReadingPackets,
  prepareSimpleStoryRepair, createRepairedSimpleStorySource, simpleStoryFindingIsMaterial } from '../simple-story-source';
import { causalSourceReviewPacket, compileCausalSourceReading } from '../story-causal-experiment';
import { citationTokens } from '../story-source-citations';
import { runSimpleWizardBook } from '../simple-book-flow';
import { createSolWritingTransport, prepareSolWritingWire, SOL_WRITING } from '../../../scripts/personal-sol-writing-transport';

// Entirely fictional synthetic wiring data, deliberately NOT a literary-quality fixture or provider verdict.
const options = resolvePersonalWizardOptions();
const request = () => ({ kind: 'personal_book_request', version: 'reviewed-personal-book-request/v3', draftId: 'd_delighttest01', draftRevision: 1,
  child: { name: 'תמר', age: 6, address: 'girl', residence: 'עיר הדמיון', nameSource: 'typed', ageSource: 'typed', addressSource: 'typed', residenceSource: 'typed' },
  facts: [{ id: 'f_delighttest01', kind: 'interest', value: 'לצייר ציורים', source: 'typed' }], noDifficulty: true,
  storyPlace: null, companion: { id: 'dragon_dini' }, intent: { kind: 'just_for_fun' }, avoid: [],
  appearance: { photo: 'none' }, bookOptions: { lengthId: 'short', voiceId: null } });
const seed = 'synthetic-delight-wiring';
function story(): SimpleStoryDraft {
  return { title: 'תמר ודיני מציירות', childGoal: 'תמר רוצה לצייר', companionWant: 'דיני רוצה לשחק', comicPromise: 'משחק משותף', ending: 'הן חוזרות לשחק',
    pages: Array.from({ length: 8 }, (_, i) => ({ text: `תמר ודיני ציירו ציור ושיחקו יחד. ${'הציור הצבעוני נשאר על השולחן. '.repeat(8)} ${'עוד '.repeat(i + 1)}` })),
    pageMap: Array.from({ length: 8 }, (_, i) => ({ location: 'חצר דמיונית', transitionReason: 'המשחק נמשך', childAction: 'תמר מציירת',
      companionAction: 'דיני משחקת', consequence: 'הציור משתנה', continuity: 'הציור על השולחן', factIds: i === 0 ? ['f_delighttest01'] : [] })),
    resilienceMoments: [{ page: 4, childChoice: 'תמר בוחרת לשחק', whatHelps: 'הציור משותף' }] };
}
function cliReply(call: SimpleStoryCall, output: unknown, repair = false) {
  const usage = { inputTokens: 100, outputTokens: 100 }, termination = { code: 0, signal: null };
  return { output, usage, estimatedMicroUsd: 100000,
    metadata: { kind: 'cli_reported_estimate_not_invoice', reportedModels: ['claude-opus-5-5'], termination },
    raw: { termination, killConfirmed: true, stopped: false, stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false,
      session_id: repair ? '33333333-3333-4333-8333-333333333333' : call.stage === 'author' ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222',
      total_cost_usd: .1, modelUsage: { 'claude-opus-5-5': usage }, structured_output: output }) } };
}
function output(call: SimpleStoryCall) {
  const tagged = JSON.parse(call.input).book.storyExperience ? { ...story(), writingContractVersion: SIMPLE_STORY_DELIGHT_VERSION } : story();
  return call.stage === 'author' ? tagged : { ...tagged, editorChanges: ['Synthetic no-op edit, not literary improvement.'] };
}
async function fixture(experience?: SimpleStoryExperience, sol = false) {
  const req = request(), p = prepareSimpleStory(req, options, seed, experience), records: Record<string, any> = {}, calls: SimpleStoryCall[] = [];
  const generate = async (call: SimpleStoryCall) => {
    calls.push(call);
    let receipt;
    if (sol) {
      const value = output(call), raw = { id: `resp_synthetic_${call.stage}`, object: 'response', model: SOL_WRITING.model,
        status: 'completed', service_tier: 'default', output_text: JSON.stringify(value), usage: { input_tokens: 100, output_tokens: 100 },
        output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(value), annotations: [] }] }] };
      const transport = createSolWritingTransport({ key: () => 'SYNTHETIC-NOT-A-REAL-KEY', fetch: async () =>
        new Response(JSON.stringify(raw), { status: 200, headers: { 'content-type': 'application/json' } }) });
      receipt = await transport(prepareSolWritingWire(call), call, new AbortController().signal);
    } else receipt = cliReply(call, output(call));
    records[call.stage] = receipt;
    return { output: receipt.output, usage: receipt.usage!, estimatedUsd: receipt.estimatedMicroUsd! / 1e6 };
  };
  const generated = await writeSimpleStory(p, generate, { model: sol ? SOL_WRITING.model : 'claude-opus-5-5', reservedUsd: 2 });
  const source = createCurrentSimpleStorySource(req, generated, records as any, options, sol ? SOL_WRITING.model : undefined);
  return { req, p, source, generated, calls, records };
}
function readings(f: Awaited<ReturnType<typeof fixture>>) {
  const packets = simpleStoryReadingPackets(f.req, f.source, options);
  return [packets.final, packets.comparison].map((packet, i) => {
    const numbered = causalSourceReviewPacket(packet), wire: any = numbered.packet;
    const unit = i ? null : wire.manuscript.pages[0].units[0];
    return compileCausalSourceReading(packet, { packetDigest: numbered.packetDigest,
      summary: 'Synthetic review only, never product acceptance.', findings: i ? [] : [{ severity: 'meaningful', kind: 'issue',
        criterion: 'Synthetic literary development concern.', explanation: 'Synthetic effect on listener, not a requested plot solution.', original: [],
        revised: [{ startId: unit.id, endId: unit.id, anchor: citationTokens(unit.text).slice(0, 2).join(' ') }] }] });
  });
}

describe('prospective story experience, same engine and no provider', () => {
  it('preserves the legacy default and selects a visibly versioned new source only explicitly', () => {
    const old = prepareSimpleStory(request(), options, seed), next = prepareSimpleStory(request(), options, seed, SIMPLE_STORY_EXPERIENCE);
    expect(old.version).toBe(SIMPLE_STORY_ENGINE_VERSION); expect(old.book).not.toHaveProperty('storyExperience');
    expect(simpleAuthorCall(old).instructions).toBe(SIMPLE_AUTHOR_INSTRUCTIONS);
    expect(simpleEditorCall(old, story(), []).instructions).toBe(SIMPLE_EDITOR_INSTRUCTIONS);
    expect(next.version).toBe(SIMPLE_STORY_DELIGHT_VERSION); expect(next.book.storyExperience).toBe(SIMPLE_STORY_EXPERIENCE);
    expect(next.shape).toEqual(old.shape); expect(next.brief).toEqual(old.brief);
    expect(simpleAuthorCall(next).instructions).toBe(DELIGHT_AUTHOR_INSTRUCTIONS);
    expect(simpleEditorCall(next, story(), []).instructions).toBe(DELIGHT_EDITOR_INSTRUCTIONS);
    expect(() => prepareSimpleStory(request(), options, seed, 'unreviewed' as any)).toThrow('simple_story_experience_invalid');
  });
  it('keeps prose-first fields/caps and changes the old forced-refrain description only in the new schema', () => {
    const old = simpleAuthorCall(prepareSimpleStory(request(), options, seed));
    const next = simpleAuthorCall(prepareSimpleStory(request(), options, seed, SIMPLE_STORY_EXPERIENCE));
    const schema = (call: SimpleStoryCall) => zodTextFormat(call.schema, 'test').schema as any;
    expect(Object.keys(schema(next).properties).filter(key => key !== 'writingContractVersion')).toEqual(Object.keys(schema(old).properties));
    expect(schema(next).required).toContain('writingContractVersion');
    expect(schema(old).properties).not.toHaveProperty('writingContractVersion');
    expect(Object.keys(schema(next).properties).slice(0, 2)).toEqual(['title', 'pages']);
    expect(schema(old).properties.comicPromise.description).toContain('running joke');
    expect(schema(next).properties.comicPromise.description).toContain('recurring gag is optional');
    expect(next.maxOutputTokens).toBe(old.maxOutputTokens);
    expect(prepareSolWritingWire(next).bytes).toBeLessThan(SOL_WRITING.maxWireBytes);
    expect(DELIGHT_AUTHOR_INSTRUCTIONS.length).toBeLessThan(6500); expect(DELIGHT_EDITOR_INSTRUCTIONS.length).toBeLessThan(4500);
  });
  it.each([false, true])('admits the actual injected %s route receipt and binds all three review packets to that source policy', async sol => {
    const f = await fixture(SIMPLE_STORY_EXPERIENCE, sol);
    expect(f.calls.map(c => c.stage)).toEqual(['author', 'editor']);
    expect(f.generated.evidence.source.engineVersion).toBe(SIMPLE_STORY_DELIGHT_VERSION);
    expect(admitCurrentSimpleStorySource(f.req, f.source, options)).toEqual(f.source);
    const packets = simpleStoryReadingPackets(f.req, f.source, options);
    for (const packet of Object.values(packets)) {
      expect(packet.instructions).toContain(DELIGHT_REVIEW_INSTRUCTIONS);
      expect(causalSourceReviewPacket(packet).instructions).toContain(DELIGHT_REVIEW_INSTRUCTIONS);
    }
    const legacy = await fixture();
    for (const packet of Object.values(simpleStoryReadingPackets(legacy.req, legacy.source, options))) expect(packet.instructions).not.toContain(DELIGHT_REVIEW_INSTRUCTIONS);
  });
  it.each(['upgrade_old', 'downgrade_new', 'unknown', 'call_mismatch'])('rejects %s rather than reinterpreting saved receipts', async mutation => {
    const f = await fixture(mutation === 'upgrade_old' ? undefined : SIMPLE_STORY_EXPERIENCE);
    const raw: any = structuredClone(f.source);
    if (mutation === 'upgrade_old') raw.simpleSource.evidence.source.engineVersion = SIMPLE_STORY_DELIGHT_VERSION;
    if (mutation === 'downgrade_new') raw.simpleSource.evidence.source.engineVersion = SIMPLE_STORY_ENGINE_VERSION;
    if (mutation === 'unknown') raw.simpleSource.evidence.source.engineVersion = 'personal-simple-story/unknown';
    if (mutation === 'call_mismatch') raw.simpleSource.evidence.calls.editor = 'a'.repeat(64);
    expect(() => admitCurrentSimpleStorySource(f.req, raw, options)).toThrow();
  });
  it('cannot reuse a legacy review answer as a new-policy reading of the same exact prose', async () => {
    const old = await fixture(), next = await fixture(SIMPLE_STORY_EXPERIENCE);
    expect(next.source.manuscript).toEqual(old.source.manuscript);
    const oldPacket = simpleStoryReadingPackets(old.req, old.source, options).final;
    const newPacket = simpleStoryReadingPackets(next.req, next.source, options).final;
    const raw = { packetDigest: causalSourceReviewPacket(oldPacket).packetDigest, summary: 'Synthetic legacy reading only.', findings: [] };
    expect(() => compileCausalSourceReading(oldPacket, raw)).not.toThrow();
    expect(() => compileCausalSourceReading(newPacket, raw)).toThrow('critic_binding');
  });
  it('inherits the new policy for bounded repair, preserves lineage/cost and still refuses a repair chain', async () => {
    const f = await fixture(SIMPLE_STORY_EXPERIENCE), rs = readings(f), ready = prepareSimpleStoryRepair(f.req, f.source, rs, options);
    expect(ready.prepared.version).toBe(SIMPLE_STORY_DELIGHT_VERSION);
    expect(ready.call.instructions).toBe(DELIGHT_EDITOR_INSTRUCTIONS);
    expect(ready.call.input).toContain('not a new story');
    const edited = { ...ready.priorEvidence.edited, editorChanges: ready.guidance.findings.map(f => `${f.id} kept: Synthetic response, not quality proof.`) };
    const repaired = createRepairedSimpleStorySource(f.req, f.source, rs, cliReply(ready.call, edited, true), options, 1);
    expect(repaired.source.accounting.providerCalls).toBe(3);
    expect(repaired.source.simpleSource.author).toEqual(f.source.simpleSource.author);
    expect(() => prepareSimpleStoryRepair(f.req, repaired.source, rs, options)).toThrow();
    expect(canonicalJson(repaired.generated.evidence.source)).toBe(canonicalJson(f.generated.evidence.source));
  });
  it('runs the real orchestration with two writing calls and blind final/comparison, without another judge or any visual call on HOLD', async () => {
    const opus = vi.fn(async (call: SimpleStoryCall) => cliReply(call, output(call)));
    const reader = vi.fn(async (call: any) => {
      expect(call.instructions).toContain(DELIGHT_REVIEW_INSTRUCTIONS);
      const wire = JSON.parse(call.input), unit = wire.packet.manuscript?.pages[0].units[0];
      return { packetDigest: wire.packetDigest, summary: 'Synthetic held literary result, not actual judgment.', findings: unit ? [{
        severity: 'meaningful', kind: 'issue', criterion: 'Synthetic sustained-interest concern.', explanation: 'Synthetic reader impact for flow only.', original: [],
        revised: [{ startId: unit.id, endId: unit.id, anchor: citationTokens(unit.text).slice(0, 2).join(' ') }] }] : [] };
    });
    const visual = vi.fn();
    const result = await runSimpleWizardBook({ request: request(), options, seed, storyExperience: SIMPLE_STORY_EXPERIENCE,
      signal: new AbortController().signal, opus, reader, visual, publish: vi.fn(), reservedWritingUsd: 2 });
    expect(result.status).toBe('story_held'); expect(result.runtimeEligible).toBe(false);
    expect(opus.mock.calls.map(([call]) => call.stage)).toEqual(['author', 'editor']);
    expect(reader.mock.calls.map(([call]) => call.stage)).toEqual(['final_review', 'comparison']);
    expect(visual).not.toHaveBeenCalled();
    expect(JSON.parse(reader.mock.calls[0][0].input).packet).not.toHaveProperty('original');
  });
  it('cannot switch a repair to another literary contract before dispatch', async () => {
    const f = await fixture(), opus = vi.fn(), reader = vi.fn(), visual = vi.fn();
    await expect(runSimpleWizardBook({ request: f.req, options, seed, storyExperience: SIMPLE_STORY_EXPERIENCE,
      repair: { prior: f.source, readings: readings(f) }, signal: new AbortController().signal,
      opus, reader, visual, publish: vi.fn(), reservedWritingUsd: 1 })).rejects.toThrow('simple_book_repair_policy');
    expect([opus.mock.calls.length, reader.mock.calls.length, visual.mock.calls.length]).toEqual([0, 0, 0]);
  });
  it('passes a new-policy admitted source into the existing storyboard boundary when both synthetic readings have no findings', async () => {
    const opus = vi.fn(async (call: SimpleStoryCall) => cliReply(call, output(call)));
    const reader = vi.fn(async (call: any) => ({ packetDigest: JSON.parse(call.input).packetDigest,
      summary: 'Synthetic empty findings are not literary approval.', findings: [] }));
    const visual = vi.fn(async () => { throw Error('synthetic_stop_at_existing_storyboard'); });
    await expect(runSimpleWizardBook({ request: request(), options, seed, storyExperience: SIMPLE_STORY_EXPERIENCE,
      signal: new AbortController().signal, opus, reader, visual, publish: vi.fn(), reservedWritingUsd: 2 }))
      // Existing planner wrapper deliberately converts callback errors; the call count below proves arrival.
      .rejects.toThrow('personal_storyboard_author_failed');
    expect(opus).toHaveBeenCalledTimes(2); expect(reader).toHaveBeenCalledTimes(2); expect(visual).toHaveBeenCalledTimes(1);
  });
  it('inherits a new-policy repair in the actual flow without a caller having to select that policy again', async () => {
    const f = await fixture(SIMPLE_STORY_EXPERIENCE), rs = readings(f);
    const ready = prepareSimpleStoryRepair(f.req, f.source, rs, options);
    const opus = vi.fn(async (call: SimpleStoryCall) => {
      expect(call.instructions).toBe(DELIGHT_EDITOR_INSTRUCTIONS);
      return cliReply(call, { ...ready.priorEvidence.edited, editorChanges: ready.guidance.findings.map(f => `${f.id} kept: Synthetic repair response only.`) }, true);
    });
    const reader = vi.fn(async (_call: any) => { throw Error('synthetic_stop_at_repaired_reading'); });
    await expect(runSimpleWizardBook({ request: f.req, options, seed, repair: { prior: f.source, readings: rs },
      signal: new AbortController().signal, opus, reader, visual: vi.fn(), publish: vi.fn(), reservedWritingUsd: 1 }))
      .rejects.toThrow('synthetic_stop_at_repaired_reading');
    expect(opus).toHaveBeenCalledTimes(1); expect(reader).toHaveBeenCalledTimes(1);
    expect(reader.mock.calls[0][0].instructions).toContain(DELIGHT_REVIEW_INSTRUCTIONS);
  });
  it('refuses a policy change while the injected author is running, before a second writing call', async () => {
    const args: any = { request: request(), options, seed, storyExperience: SIMPLE_STORY_EXPERIENCE,
      signal: new AbortController().signal, reader: vi.fn(), visual: vi.fn(), publish: vi.fn(), reservedWritingUsd: 2 };
    args.opus = vi.fn(async (call: SimpleStoryCall) => { args.storyExperience = undefined; return cliReply(call, output(call)); });
    await expect(runSimpleWizardBook(args)).rejects.toThrow('simple_book_source_changed');
    expect(args.opus).toHaveBeenCalledTimes(1); expect(args.reader).not.toHaveBeenCalled(); expect(args.visual).not.toHaveBeenCalled();
  });
  it('keeps material literary issues, polish and preferences on the existing classifier', () => {
    expect(simpleStoryFindingIsMaterial({ severity: 'meaningful', kind: 'issue' })).toBe(true);
    expect(simpleStoryFindingIsMaterial({ severity: 'meaningful', kind: 'preference' })).toBe(false);
    expect(simpleStoryFindingIsMaterial({ severity: 'polish', kind: 'issue' })).toBe(false);
  });
  it.each([false, true])('rejects legacy writer raw reused as new %s route output, including parsed-only tag backfill', async sol => {
    const old = await fixture(undefined, sol), next = await fixture(SIMPLE_STORY_EXPERIENCE, sol);
    expect(() => createCurrentSimpleStorySource(next.req, next.generated, old.records as any, options, sol ? SOL_WRITING.model : undefined)).toThrow();
    const decorated = structuredClone(old.records);
    for (const stage of ['author', 'editor']) decorated[stage].output.writingContractVersion = SIMPLE_STORY_DELIGHT_VERSION;
    // In-memory decoration must not stand in for the unchanged provider/CLI raw response.
    expect(() => createCurrentSimpleStorySource(next.req, next.generated, decorated as any, options, sol ? SOL_WRITING.model : undefined)).toThrow();
    await expect(writeSimpleStory(next.p, async call => ({ output: old.records[call.stage].output,
      usage: old.records[call.stage].usage, estimatedUsd: old.records[call.stage].estimatedMicroUsd / 1e6 }),
    { model: sol ? SOL_WRITING.model : 'claude-opus-5-5', reservedUsd: 2 })).rejects.toThrow('simple_story_author_invalid');
  });
  it.each(['author', 'editor'] as const)('requires the literal in the actual %s response for every new-policy run', async stage => {
    const p = prepareSimpleStory(request(), options, seed, SIMPLE_STORY_EXPERIENCE), calls: string[] = [];
    await expect(writeSimpleStory(p, async call => {
      calls.push(call.stage); const value: any = output(call);
      if (call.stage === stage) delete value.writingContractVersion;
      return { output: value, usage: { inputTokens: 10, outputTokens: 10 }, estimatedUsd: .1 };
    }, { model: 'claude-opus-5-5', reservedUsd: 2 })).rejects.toThrow(`simple_story_${stage}_invalid`);
    expect(calls).toEqual(stage === 'author' ? ['author'] : ['author', 'editor']);
  });
  it.each(['author', 'editor'] as const)('rejects a wrong %s output-contract literal instead of dropping it', async stage => {
    const p = prepareSimpleStory(request(), options, seed, SIMPLE_STORY_EXPERIENCE);
    await expect(writeSimpleStory(p, async call => {
      const value: any = output(call);
      if (call.stage === stage) value.writingContractVersion = SIMPLE_STORY_ENGINE_VERSION;
      return { output: value, usage: { inputTokens: 10, outputTokens: 10 }, estimatedUsd: .1 };
    }, { model: 'claude-opus-5-5', reservedUsd: 2 })).rejects.toThrow(`simple_story_${stage}_invalid`);
  });
});
