import { describe, expect, it } from 'vitest';
import { childStoryProfile, CHILD_REVIEW_INSTRUCTIONS } from '../simple-story-child-policy';
import { prepareSimpleStory, simpleAuthorCall, simpleEditorCall, simpleStoryDraftSchema, editorFindings, writeSimpleStory, type SimpleStoryCall } from '../simple-story-engine';
import { SIMPLE_CHILD_EXPERIENCE, SIMPLE_CHILD_VERSION, SIMPLE_STORY_EXPERIENCE, type SimpleStoryExperience } from '../simple-story-experience';
import { resolvePersonalWizardOptions } from '../options';
import { createCurrentSimpleStorySource, admitCurrentSimpleStorySource, simpleStoryReadingPackets, prepareSimpleStoryRepair, createRepairedSimpleStorySource, projectSimpleSolReceipt } from '../simple-story-source';
import { causalSourceReviewPacket, compileCausalSourceReading } from '../story-causal-experiment';
import { prepareStoryTextReview } from '../story-text-review';
import { preparePersonalStory } from '../story-writer';
import { citationTokens } from '../story-source-citations';
import { createSolWritingTransport, prepareSolWritingWire, SOL_WRITING } from '../../../scripts/personal-sol-writing-transport';
import { runSimpleWizardBook } from '../simple-book-flow';

const options = resolvePersonalWizardOptions();
const request = (age: number) => ({ kind: 'personal_book_request', version: 'reviewed-personal-book-request/v3', draftId: 'd_childpolicy01', draftRevision: 1,
  child: { name: 'תמר', age, address: 'girl', residence: 'עיר הדמיון', nameSource: 'typed', ageSource: 'typed', addressSource: 'typed', residenceSource: 'typed' },
  facts: [{ id: 'f_childpolicy01', kind: 'interest', value: 'לצייר', source: 'typed' }], noDifficulty: true,
  storyPlace: null, companion: { id: 'dragon_dini' }, intent: { kind: 'just_for_fun' }, avoid: [],
  appearance: { photo: 'none' }, bookOptions: { lengthId: 'short', voiceId: null } });

// Synthetic wiring only: intentionally not an example of enjoyable or age-appropriate prose.
function syntheticOutput(call: SimpleStoryCall) {
  const book = JSON.parse(call.input).book;
  const value = { title: 'תמר ודיני משחקות',
    pages: Array.from({ length: 8 }, () => ({ text: `תמר ודיני רצו לצייר ולשחק. ${'הציור נשאר על השולחן ליד הכיסא והן הסתכלו בו וצחקו יחד. '.repeat(5)}` })),
    childGoal: 'תמר רוצה לשחק', companionWant: 'דיני רוצה לצייר', comicPromise: 'משחק משותף', ending: 'הן ממשיכות לשחק',
    pageMap: Array.from({ length: 8 }, (_, i) => ({ location: 'חצר דמיונית', transitionReason: 'המשחק נמשך',
      childAction: 'תמר מציירת', companionAction: 'דיני משחקת', consequence: 'המשחק נמשך', continuity: 'הציור על השולחן', factIds: i ? [] : ['f_childpolicy01'] })),
    resilienceMoments: [{ page: 4, childChoice: 'תמר בוחרת לשחק', whatHelps: 'הציור משותף' }],
    ...(book.storyExperience ? { writingContractVersion: book.storyExperience === SIMPLE_CHILD_EXPERIENCE ? SIMPLE_CHILD_VERSION : 'personal-simple-story/delight-v1' } : {}),
  };
  return call.stage === 'author' ? value : { ...value, editorChanges: ['Synthetic unchanged story, not literary improvement.'] };
}
let syntheticSequence = 0;
async function receipt(call: SimpleStoryCall, output = syntheticOutput(call)) {
  const raw = { id: `resp_synthetic_${call.stage}_child_${syntheticSequence++}`, model: SOL_WRITING.model, status: 'completed', service_tier: 'default',
    output_text: JSON.stringify(output), usage: { input_tokens: 100, output_tokens: 100 },
    output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(output), annotations: [] }] }] };
  const transport = createSolWritingTransport({ key: () => 'SYNTHETIC-NOT-A-REAL-KEY', fetch: async () =>
    new Response(JSON.stringify(raw), { status: 200, headers: { 'content-type': 'application/json' } }) });
  return transport(prepareSolWritingWire(call), call, new AbortController().signal);
}
async function fixture(age = 4, experience?: SimpleStoryExperience) {
  const req = request(age), p = prepareSimpleStory(req, options, 'child-focus', experience ?? SIMPLE_CHILD_EXPERIENCE), records: Record<string, any> = {};
  const generated = await writeSimpleStory(p, async call => {
    const r = await receipt(call); records[call.stage] = r;
    return { output: r.output, usage: r.usage!, estimatedUsd: r.estimatedMicroUsd! / 1e6 };
  }, { model: SOL_WRITING.model, reservedUsd: 1.2 });
  const source = createCurrentSimpleStorySource(req, generated, records as any, options, SOL_WRITING.model);
  return { req, p, records, generated, source };
}
function reading(packet: ReturnType<typeof simpleStoryReadingPackets>['final' | 'comparison'], material = false) {
  const n = causalSourceReviewPacket(packet), body: any = n.packet, unit = body.manuscript?.pages[0].units[0];
  return { packetDigest: n.packetDigest, summary: 'Synthetic review, not a product or literary judgment.', findings: material ? [{
    severity: 'meaningful', kind: 'issue', criterion: 'Synthetic age comprehension concern', explanation: 'Synthetic listener effect for boundary wiring only.',
    original: [], revised: [{ startId: unit.id, endId: unit.id, anchor: citationTokens(unit.text).slice(0, 2).join(' ') }],
  }] : [] };
}

describe('child-first exact age and story focus (provider-free, not literary proof)', () => {
  it('makes plot, humour, language and attention substantially different at4 and8, not only word counts', () => {
    const young = childStoryProfile(4), older = childStoryProfile(8);
    expect(young.band).toBe('3-4'); expect(older.band).toBe('7-8');
    for (const key of ['plot', 'humour', 'language', 'attention'] as const) expect(young[key]).not.toBe(older[key]);
    expect(young.age).toBe(4); expect(older.age).toBe(8);
  });
  it.each([3,4,5,6,7,8])('carries exact age%s in real author/editor inputs and a new required output tag', age => {
    const p = prepareSimpleStory(request(age), options, 'child-focus', SIMPLE_CHILD_EXPERIENCE);
    expect(p.version).toBe(SIMPLE_CHILD_VERSION);
    const author = simpleAuthorCall(p), editor = simpleEditorCall(p, syntheticOutput(author) as any, []);
    for (const call of [author, editor]) {
      const data = JSON.parse(call.input);
      expect(data.book.childStoryProfile).toEqual(childStoryProfile(age));
      expect(data.book.child.age).toBe(age);
      expect(call.instructions).toContain('central');
      expect(call.instructions).toContain('familiar');
      expect(call.input).not.toContain(`pages of about ${p.book.wordsPerPage.min} to ${p.book.wordsPerPage.max} words each`);
    }
    expect(simpleStoryDraftSchema(8, SIMPLE_CHILD_EXPERIENCE).shape.writingContractVersion!.safeParse(SIMPLE_CHILD_VERSION).success).toBe(true);
    expect(simpleStoryDraftSchema(8, SIMPLE_CHILD_EXPERIENCE).shape.writingContractVersion!.safeParse('personal-simple-story/delight-v1').success).toBe(false);
  });
  it.each([2,9,4.5,NaN,Infinity])('does not silently extend or clamp unsupported age%s', age => {
    expect(() => childStoryProfile(age)).toThrow();
    expect(() => prepareSimpleStory(request(age), options, 'child-focus', SIMPLE_CHILD_EXPERIENCE)).toThrow();
  });
  it('does not turn short-page metrics into compulsory padding under the new policy', () => {
    const p = prepareSimpleStory(request(4), options, 'child-focus', SIMPLE_CHILD_EXPERIENCE);
    const messages = editorFindings(p, { hard: [], soft: ['short_pages:2'], dashSnippets: [], words: {} } as any);
    expect(messages.join(' ')).not.toContain('give them a little more story');
  });
  it('refuses a mutated age profile before either writer call can be built', () => {
    const p = prepareSimpleStory(request(4), options, 'child-focus', SIMPLE_CHILD_EXPERIENCE);
    p.book.childStoryProfile = childStoryProfile(8);
    expect(() => simpleAuthorCall(p)).toThrow('story_child_profile_binding');
    expect(() => simpleEditorCall(p, {} as any, [])).toThrow('story_child_profile_binding');
  });
  it('keeps chosen fear/theme explicit but not compulsory for a just-for-fun story', () => {
    const req = request(4), topic = options.topics[0];
    const themed = { ...req, noDifficulty: false, facts: [...req.facts,
      { id: 'f_childfear001', kind: 'difficulty', value: 'חוששת לפעמים לנסות משהו חדש', source: 'typed' }],
      intent: { kind: 'topic', topicId: topic.id } };
    const chosen = prepareSimpleStory(themed, options, 'child-focus', SIMPLE_CHILD_EXPERIENCE);
    const free = prepareSimpleStory(req, options, 'child-focus', SIMPLE_CHILD_EXPERIENCE);
    expect(chosen.book.theme).toBe(topic.label); expect(free.book.theme).toBeNull();
    const text = simpleAuthorCall(chosen).instructions;
    expect(text).toContain('while still afraid'); expect(text).toContain('Real sirens, medical care');
    expect(text).toContain('With no theme, invent no personal weakness');
  });
  it('actually rejects unchanged and parsed-only retagged delight raw in either new writer projection', async () => {
    const old = await fixture(4, SIMPLE_STORY_EXPERIENCE), next = prepareSimpleStory(old.req, options, 'child-focus', SIMPLE_CHILD_EXPERIENCE);
    const author = simpleAuthorCall(next), editor = simpleEditorCall(next, syntheticOutput(author) as any, []);
    for (const call of [author, editor]) {
      expect(() => projectSimpleSolReceipt(call, old.records[call.stage])).toThrow();
      const decorated = { ...old.records[call.stage], output: { ...old.records[call.stage].output, writingContractVersion: SIMPLE_CHILD_VERSION } };
      expect(() => projectSimpleSolReceipt(call, decorated)).toThrow();
    }
  });
  it.each([3,4,5,6,7,8])('binds age%s to actual source and all three numbered review packets', async age => {
    const f = await fixture(age), packets = simpleStoryReadingPackets(f.req, f.source, options);
    expect(admitCurrentSimpleStorySource(f.req, f.source, options)).toEqual(f.source);
    for (const packet of Object.values(packets)) {
      expect(packet.brief.childStoryProfile).toEqual(childStoryProfile(age));
      expect(packet.instructions).toContain(CHILD_REVIEW_INSTRUCTIONS);
      const numbered = causalSourceReviewPacket(packet);
      expect((numbered.packet as any).brief.childStoryProfile).toEqual(childStoryProfile(age));
      expect(numbered.instructions).toContain(CHILD_REVIEW_INSTRUCTIONS);
    }
    const document = { manuscript: f.source.manuscript, plan: f.source.plan, characterDigest: f.source.characterDigest };
    expect(() => prepareStoryTextReview(preparePersonalStory(f.req, options), document, document, childStoryProfile(age === 8 ? 4 : 8))).toThrow('story_child_profile_binding');
  });
  it('rejects relabeling between delight-v1 and child-v2, including parsed-only decoration of old raw', async () => {
    const old = await fixture(4, SIMPLE_STORY_EXPERIENCE);
    const changed: any = structuredClone(old.generated);
    changed.evidence.source.engineVersion = SIMPLE_CHILD_VERSION;
    changed.evidence.draft.writingContractVersion = SIMPLE_CHILD_VERSION;
    changed.evidence.edited.writingContractVersion = SIMPLE_CHILD_VERSION;
    expect(() => createCurrentSimpleStorySource(old.req, changed, old.records as any, options, SOL_WRITING.model)).toThrow();
    const next = await fixture(), down: any = structuredClone(next.source);
    down.simpleSource.evidence.source.engineVersion = 'personal-simple-story/delight-v1';
    expect(() => admitCurrentSimpleStorySource(next.req, down, options)).toThrow();
    const packets = simpleStoryReadingPackets(old.req, old.source, options);
    for (const packet of Object.values(packets)) {
      expect(packet.brief).not.toHaveProperty('childStoryProfile');
      expect(packet.instructions).not.toContain(CHILD_REVIEW_INSTRUCTIONS);
    }
  });
  it('inherits the same child policy and age in one bounded repair, never a new chain', async () => {
    const f = await fixture(), packets = simpleStoryReadingPackets(f.req, f.source, options);
    const reads = [compileCausalSourceReading(packets.final, reading(packets.final, true)), compileCausalSourceReading(packets.comparison, reading(packets.comparison))];
    const ready = prepareSimpleStoryRepair(f.req, f.source, reads, options);
    expect(JSON.parse(ready.call.input).book.childStoryProfile).toEqual(childStoryProfile(4));
    const response: any = syntheticOutput(ready.call);
    response.editorChanges = JSON.parse(ready.call.input).readerObservations.findings.map((f: any) => `${f.id} kept: synthetic observation not a creative judgment.`);
    const repaired = createRepairedSimpleStorySource(f.req, f.source, reads, await receipt(ready.call, response), options, .6);
    expect(repaired.generated.evidence.source.engineVersion).toBe(SIMPLE_CHILD_VERSION);
    for (const packet of Object.values(simpleStoryReadingPackets(f.req, repaired.source, options))) expect(packet.brief.childStoryProfile).toEqual(childStoryProfile(4));
    expect(() => prepareSimpleStoryRepair(f.req, repaired.source, reads, options)).toThrow();
  });
  it.each([true,false])('uses the existing real flow and keeps its material-HOLD/downstream boundary (%s)', async material => {
    const stages: string[] = [];
    const task = runSimpleWizardBook({ request: request(4), options, seed: 'child-focus', signal: new AbortController().signal,
      storyExperience: SIMPLE_CHILD_EXPERIENCE, writingModel: SOL_WRITING.model, reservedWritingUsd: 1.2,
      opus: async call => { stages.push(call.stage); return receipt(call); },
      reader: async call => {
        stages.push(call.stage); const data = JSON.parse(call.input), body: any = data.packet;
        expect(body.brief.childStoryProfile).toEqual(childStoryProfile(4));
        const unit = body.manuscript?.pages[0].units[0];
        return { packetDigest: data.packetDigest, summary: 'Synthetic review only, not a literary verdict.', findings: material && call.stage === 'final_review' ? [{
          severity: 'meaningful', kind: 'issue', criterion: 'Synthetic age comprehension concern', explanation: 'Synthetic effect on listener for route test only.',
          original: [], revised: [{ startId: unit.id, endId: unit.id, anchor: citationTokens(unit.text).slice(0, 2).join(' ') }],
        }] : [] };
      },
      visual: async () => { stages.push('visual_boundary'); throw Error('STOP_BEFORE_STORYBOARD_PROVIDER'); }, publish: () => {},
    });
    if (material) { expect((await task).status).toBe('story_held'); expect(stages).not.toContain('visual_boundary'); }
    else { await expect(task).rejects.toThrow('personal_storyboard_author_failed'); expect(stages[stages.length - 1]).toBe('visual_boundary'); }
    expect(stages.slice(0,4)).toEqual(['author','editor','final_review','comparison']);
  });
});
