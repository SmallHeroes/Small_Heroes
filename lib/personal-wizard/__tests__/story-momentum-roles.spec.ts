import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { childStoryProfile, CHILD_AUTHOR_INSTRUCTIONS, CHILD_EDITOR_INSTRUCTIONS, CHILD_REVIEW_INSTRUCTIONS } from '../simple-story-child-policy';
import { MOMENTUM_AUTHOR_INSTRUCTIONS, MOMENTUM_EDITOR_INSTRUCTIONS, MOMENTUM_REVIEW_INSTRUCTIONS } from '../simple-story-momentum-policy';
import { resolveChildStoryShape } from '../simple-story-shape-policy';
import { prepareSimpleStory, simpleAuthorCall, simpleEditorCall, simpleStoryDraftSchema, writeSimpleStory, SIMPLE_STORY_SHAPES,
  type SimpleStoryCall } from '../simple-story-engine';
import { SIMPLE_CHILD_MOMENTUM_EXPERIENCE, SIMPLE_CHILD_MOMENTUM_VERSION, SIMPLE_CHILD_SHAPE_EXPERIENCE, SIMPLE_CHILD_SHAPE_VERSION,
  SIMPLE_CHILD_EXPERIENCE, SIMPLE_CHILD_VERSION, SIMPLE_STORY_EXPERIENCE, type SimpleStoryExperience } from '../simple-story-experience';
import { SIMPLE_WRITING_ROLES } from '../simple-writing-roles';
import { resolvePersonalWizardOptions } from '../options';
import { preAdmissionOptions } from './pre-admission-options';
import { canonicalJson } from '../request-acceptance';
import { createCurrentSimpleStorySource, admitCurrentSimpleStorySource, simpleStoryReadingPackets, prepareSimpleStoryRepair,
  SimpleStorySourceError, ROLES_SIMPLE_SOURCE_VERSION, SOL_SIMPLE_SOURCE_VERSION, CURRENT_SIMPLE_SOURCE_VERSION } from '../simple-story-source';
import { runSimpleWizardBook } from '../simple-book-flow';
import { citationTokens } from '../story-source-citations';
import { createSolWritingTransport, prepareSolWritingWire, SOL_WRITING } from '../../../scripts/personal-sol-writing-transport';
import { opusOutputContract, prepareCausalWire } from '../../../scripts/personal-causal-trial-adapters';

const options = resolvePersonalWizardOptions();
const sha = (v: unknown) => createHash('sha256').update(typeof v === 'string' ? v : canonicalJson(v)).digest('hex');
const request = (age: number) => ({ kind: 'personal_book_request', version: 'reviewed-personal-book-request/v3', draftId: 'd_momentum0001', draftRevision: 1,
  child: { name: 'תמר', age, address: 'girl', residence: 'עיר הדמיון', nameSource: 'typed', ageSource: 'typed', addressSource: 'typed', residenceSource: 'typed' },
  facts: [{ id: 'f_momentum0001', kind: 'interest', value: 'לצייר', source: 'typed' }], noDifficulty: true,
  storyPlace: null, companion: { id: 'dragon_dini' }, intent: { kind: 'just_for_fun' }, avoid: [],
  appearance: { photo: 'none' }, bookOptions: { lengthId: 'short', voiceId: null } });
const versionFor: Record<SimpleStoryExperience, string> = { [SIMPLE_STORY_EXPERIENCE]: 'personal-simple-story/delight-v1',
  [SIMPLE_CHILD_EXPERIENCE]: SIMPLE_CHILD_VERSION, [SIMPLE_CHILD_SHAPE_EXPERIENCE]: SIMPLE_CHILD_SHAPE_VERSION, [SIMPLE_CHILD_MOMENTUM_EXPERIENCE]: SIMPLE_CHILD_MOMENTUM_VERSION };

// Synthetic wiring only: intentionally not an example of an enjoyable story.
function syntheticOutput(call: SimpleStoryCall) {
  const book = JSON.parse(call.input).book;
  const value = { title: 'תמר ודיני משחקות',
    pages: Array.from({ length: 8 }, () => ({ text: `תמר ודיני רצו לצייר ולשחק. ${'הציור נשאר על השולחן ליד הכיסא והן הסתכלו בו וצחקו יחד. '.repeat(5)}` })),
    childGoal: 'תמר רוצה לשחק', companionWant: 'דיני רוצה לצייר', comicPromise: 'משחק משותף', ending: 'הן ממשיכות לשחק',
    pageMap: Array.from({ length: 8 }, (_, i) => ({ location: 'חצר דמיונית', transitionReason: 'המשחק נמשך',
      childAction: 'תמר מציירת', companionAction: 'דיני משחקת', consequence: 'המשחק נמשך', continuity: 'הציור על השולחן', factIds: i ? [] : ['f_momentum0001'] })),
    resilienceMoments: [{ page: 4, childChoice: 'תמר בוחרת לשחק', whatHelps: 'הציור משותף' }],
    ...(book.storyExperience ? { writingContractVersion: versionFor[book.storyExperience as SimpleStoryExperience] } : {}),
  };
  return call.stage === 'author' ? value : { ...value, editorChanges: ['Synthetic unchanged story, not literary improvement.'] };
}
let sequence = 0;
async function solRecord(call: SimpleStoryCall, output: unknown = syntheticOutput(call)) {
  const raw = { id: `resp_synthetic_${call.stage}_momentum_${sequence++}`, model: SOL_WRITING.model, status: 'completed', service_tier: 'default',
    output_text: JSON.stringify(output), usage: { input_tokens: 100, output_tokens: 100 },
    output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(output), annotations: [] }] }] };
  const transport = createSolWritingTransport({ key: () => 'SYNTHETIC-NOT-A-REAL-KEY', fetch: async () =>
    new Response(JSON.stringify(raw), { status: 200, headers: { 'content-type': 'application/json' } }) });
  return transport(prepareSolWritingWire(call), call, new AbortController().signal);
}
/** The saved shape of an actual Claude CLI reply (runClaudeCli), with synthetic content and session. */
function cliRecord(call: SimpleStoryCall, output: unknown = syntheticOutput(call)) {
  const usage = { inputTokens: 1000, outputTokens: 2000 }, termination = { code: 0, signal: null };
  const session = `${call.stage === 'author' ? '1' : '2'}1111111-1111-4111-8111-${String(100000000000 + sequence++).slice(-12)}`;
  return { output, usage, estimatedMicroUsd: 100_000,
    metadata: { kind: 'cli_reported_estimate_not_invoice', reportedModels: ['claude-opus-5-5'], termination },
    raw: { termination, killConfirmed: true, stopped: false, stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false,
      session_id: session, total_cost_usd: 0.1, modelUsage: { 'claude-opus-5-5': usage }, structured_output: output }) } };
}
type Kind = 'cli' | 'sol';
async function source(roles: { author: Kind; editor: Kind }, model: string, experience: SimpleStoryExperience = SIMPLE_CHILD_MOMENTUM_EXPERIENCE, age = 6) {
  const req = request(age), p = prepareSimpleStory(req, options, 'momentum-roles', experience), records: Record<string, any> = {};
  const generated = await writeSimpleStory(p, async call => {
    const r: any = roles[call.stage] === 'cli' ? cliRecord(call) : await solRecord(call); records[call.stage] = r;
    return { output: r.output, usage: r.usage, estimatedUsd: r.estimatedMicroUsd / 1e6 };
  }, { model, reservedUsd: 2.6 });
  return { req, p, records, generated };
}
const split = () => source({ author: 'cli', editor: 'sol' }, SIMPLE_WRITING_ROLES.label);
function code(action: () => unknown) {
  try { action(); } catch (error) { expect(error).toBeInstanceOf(SimpleStorySourceError); return (error as SimpleStorySourceError).code; }
  return expect.fail('expected a source refusal');
}

describe('child-first/v4 story momentum (provider-free, not literary proof)', () => {
  it.each([3,4,5,6,7,8])('age%s: v3 profile and exact shape resolution, plus the momentum writers and a new required tag', age => {
    const p = prepareSimpleStory(request(age), options, 'momentum-age', SIMPLE_CHILD_MOMENTUM_EXPERIENCE);
    expect(p.version).toBe(SIMPLE_CHILD_MOMENTUM_VERSION);
    expect(p.book.childStoryProfile).toEqual(childStoryProfile(age));
    expect(p.book.storyShapeResolution).toEqual(resolveChildStoryShape(p.shape.id, age));
    const author = simpleAuthorCall(p), editor = simpleEditorCall(p, syntheticOutput(author) as any, []);
    expect(author.instructions).toBe(MOMENTUM_AUTHOR_INSTRUCTIONS);
    expect(editor.instructions).toBe(MOMENTUM_EDITOR_INSTRUCTIONS);
    for (const call of [author, editor]) expect(JSON.parse(call.input).book.childStoryProfile).toEqual(childStoryProfile(age));
    const tag = simpleStoryDraftSchema(8, SIMPLE_CHILD_MOMENTUM_EXPERIENCE).shape.writingContractVersion!;
    expect(tag.safeParse(SIMPLE_CHILD_MOMENTUM_VERSION).success).toBe(true);
    expect(tag.safeParse(SIMPLE_CHILD_SHAPE_VERSION).success).toBe(false);
  });
  it('asks the author for momentum and wonder, treats the start place as a start and the interest as a flavour', () => {
    const text = MOMENTUM_AUTHOR_INSTRUCTIONS;
    for (const phrase of ['Give the story momentum.', 'something surprising happens', 'Make each turn of the page worth turning',
      'biggest moment', 'Bring wonder', 'book.storyMayStartAt is where the story begins, not a fence around it',
      'the story has not started yet', 'An interest need not be the subject of the story', 'decide its biggest moment']) expect(text).toContain(phrase);
    // The stay-small permissions that, with one indoor interest, made a local object problem the safest answer.
    for (const removed of ['A quiet one-setting story can be exciting to hear', 'must earn the attention they cost',
      'A familiar object is not interesting merely because it talks', 'Weave at least one approved interest naturally without making it a magic key']) expect(text).not.toContain(removed);
    // No quotas or mandatory events.
    expect(text).not.toMatch(/\b(at least|exactly|minimum of)\s+(two|three|four|\d+)\s+(places|locations|events|jokes|laughs|scenes|stations)/i);
    expect(text).toContain('No fixed laugh, sound or refrain quota.');
  });
  it('keeps the v2 theme, narration and safety rules verbatim, and the editor keeps all but the shrinking paragraph', () => {
    const author = MOMENTUM_AUTHOR_INSTRUCTIONS.split('\n\n'), v2 = CHILD_AUTHOR_INSTRUCTIONS.split('\n\n');
    expect(author).toContain(v2[4]); expect(author).toContain(v2[6]);
    for (const rule of ['while still afraid', 'Real sirens, medical care', 'With no theme, invent no personal weakness', 'Name a parent only if supplied',
      'Respect avoidSubjects', 'no new convenient powers', 'Return the exact required writingContractVersion']) expect(MOMENTUM_AUTHOR_INSTRUCTIONS).toContain(rule);
    const editor = MOMENTUM_EDITOR_INSTRUCTIONS.split('\n\n'), old = CHILD_EDITOR_INSTRUCTIONS.split('\n\n');
    expect(editor.length).toBe(old.length);
    expect(editor.filter((paragraph, i) => paragraph !== old[i]).length).toBe(1);
    expect(editor[1]).toContain('Protect and strengthen the story\'s momentum');
    expect(editor[1]).not.toContain('Remove or combine errands, talking-object wishes');
  });
  it('refuses co-mutated age/profile and a swapped shape resolution before either v4 writer call', () => {
    const p = prepareSimpleStory(request(4), options, 'momentum-age', SIMPLE_CHILD_MOMENTUM_EXPERIENCE), draft = syntheticOutput(simpleAuthorCall(p));
    const other = SIMPLE_STORY_SHAPES.find(s => s.id !== p.shape.id)!;
    const swapped = structuredClone(p); swapped.book.storyShapeResolution = resolveChildStoryShape(other.id, 4);
    expect(() => simpleAuthorCall(swapped)).toThrow('story_shape_binding');
    expect(() => simpleEditorCall(swapped, draft as any, [])).toThrow('story_shape_binding');
    const aged = structuredClone(p); aged.book.child.age = 8; aged.book.childStoryProfile = childStoryProfile(8);
    expect(() => simpleAuthorCall(aged)).toThrow('story_child_profile_binding');
    expect(() => simpleEditorCall(aged, draft as any, [])).toThrow('story_child_profile_binding');
  });
  it('leaves every older version\'s author and editor call bytes exactly as captured at base 05c99721', () => {
    // Same inputs as the artifact capture legacy-digests.ts (640 calls, all 14 shapes); digest recorded before any R14 edit.
    const legacyRequest = (age: number) => ({ ...request(age), draftId: 'd_legacydigest', facts: [{ id: 'f_legacydigest', kind: 'interest', value: 'לצייר', source: 'typed' }],
      storyPlace: { value: 'בחצר', source: 'typed' }, companion: { id: 'panda_anat' } });
    const draft = { title: 'ת', childGoal: 'ת', companionWant: 'ת', comicPromise: 'ת', ending: 'ת', pages: Array.from({ length: 8 }, (_, i) => ({ text: `עמוד ${i + 1}` })),
      pageMap: Array.from({ length: 8 }, () => ({ location: 'ת', transitionReason: 'ת', childAction: 'ת', companionAction: 'ת', consequence: 'ת', factIds: [], continuity: 'ת' })),
      resilienceMoments: [{ page: 1, childChoice: 'ת', whatHelps: 'ת' }] };
    const calls = (menu: typeof options) => {
      const out: Record<string, unknown> = {};
      for (const [name, experience] of [['v1', undefined], ['delight', SIMPLE_STORY_EXPERIENCE], ['v2', SIMPLE_CHILD_EXPERIENCE], ['v3', SIMPLE_CHILD_SHAPE_EXPERIENCE]] as const) {
        for (const age of [3, 4, 6, 8]) for (let n = 0; n < 40; n++) {
          const p = prepareSimpleStory(legacyRequest(age), menu, `legacy-${n}`, experience);
          const a = simpleAuthorCall(p), e = simpleEditorCall(p, draft as any, ['Pages 2 are shorter than 45 words; give them a little more story.']);
          out[`${name}:${age}:${n}:${p.shape.id}`] = { version: p.version, author: sha({ i: a.instructions, x: a.input, s: opusOutputContract(a).schema, m: a.maxOutputTokens }),
            editor: sha({ i: e.instructions, x: e.input, s: opusOutputContract(e).schema, m: e.maxOutputTokens }) };
        }
      }
      return out;
    };
    // Under the menu as it was at capture (before Momo's admission) the bytes are exactly as captured.
    const captured = calls(preAdmissionOptions(options));
    expect(new Set(Object.keys(captured).map(k => k.split(':')[3])).size).toBe(14);
    expect(sha(captured)).toBe('6550e9c5f4e9fdfc51ae7b5d60e3f6fc10ce9ac09f1e139ec47b6f37c517f0f6');
    // The current menu (Momo offered) changes each request's identity, and with it the seeded story-shape pick; the instructions do not change.
    expect(sha(calls(options))).toBe('06ec8f2b44de94407abd46ed9f5c40768577a0eb8c277d9a78425ad13a75fcaf');
  }, 60_000);
  it('adds the momentum questions to all three v4 review packets and leaves v3 packets as they were', async () => {
    const v4 = await split(), s4 = createCurrentSimpleStorySource(v4.req, v4.generated, v4.records as any, options, SIMPLE_WRITING_ROLES.label);
    for (const packet of Object.values(simpleStoryReadingPackets(v4.req, s4, options))) {
      expect(packet.instructions.endsWith(MOMENTUM_REVIEW_INSTRUCTIONS)).toBe(true);
      expect(packet.instructions).toContain('has a meaningful literary weakness for this listener');
      expect(packet.brief.childStoryProfile).toEqual(childStoryProfile(6));
    }
    const v3 = await source({ author: 'sol', editor: 'sol' }, SOL_WRITING.model, SIMPLE_CHILD_SHAPE_EXPERIENCE);
    const s3 = createCurrentSimpleStorySource(v3.req, v3.generated, v3.records as any, options, SOL_WRITING.model);
    for (const packet of Object.values(simpleStoryReadingPackets(v3.req, s3, options))) {
      expect(packet.instructions.endsWith(CHILD_REVIEW_INSTRUCTIONS.replace('Child-first/v2:', 'Child-first/v3:'))).toBe(true);
      expect(packet.instructions).not.toContain('Child-first/v4');
    }
  });
});

describe('role-split writing source roles-v1: Opus author, Sol editor (provider-free)', () => {
  it('admits exactly a Claude CLI author receipt plus a Sol Responses editor receipt, with no blended cost', async () => {
    const f = await split(), s = createCurrentSimpleStorySource(f.req, f.generated, f.records as any, options, SIMPLE_WRITING_ROLES.label);
    expect(s.simpleSource.version).toBe(ROLES_SIMPLE_SOURCE_VERSION);
    expect(s.simpleSource.author).toMatchObject({ model: 'claude-opus-5-5', version: 'simple-cli-receipt-projection/v1', costKind: 'cli_reported_estimate_not_invoice', estimatedMicroUsd: 100_000 });
    expect(s.simpleSource.editor).toMatchObject({ model: 'gpt-6.1-sol', version: 'simple-responses-receipt-projection/v1', costKind: 'provider_reported_usage_estimate_not_invoice' });
    expect(s.accounting).toMatchObject({ model: SIMPLE_WRITING_ROLES.label, providerCalls: 2, estimatedUsd: null });
    expect(admitCurrentSimpleStorySource(f.req, s, options)).toEqual(s);
  });
  it.each([[{ author: 'sol', editor: 'sol' }], [{ author: 'cli', editor: 'cli' }], [{ author: 'sol', editor: 'cli' }]] as const)(
    'refuses any other provider per role under the role-split route (%j)', async roles => {
    const f = await source(roles as any, SIMPLE_WRITING_ROLES.label);
    expect(code(() => createCurrentSimpleStorySource(f.req, f.generated, f.records as any, options, SIMPLE_WRITING_ROLES.label))).toBe('receipt_invalid');
  });
  it('refuses relabelling in either direction and any blended or misattributed accounting', async () => {
    const f = await split(), s: any = createCurrentSimpleStorySource(f.req, f.generated, f.records as any, options, SIMPLE_WRITING_ROLES.label);
    const variant = (change: (x: any) => void) => { const x = structuredClone(s); change(x); return code(() => admitCurrentSimpleStorySource(f.req, x, options)); };
    expect(variant(x => { x.simpleSource.version = SOL_SIMPLE_SOURCE_VERSION; })).toBe('receipt_route');
    expect(variant(x => { x.simpleSource.version = CURRENT_SIMPLE_SOURCE_VERSION; })).toBe('receipt_route');
    expect(variant(x => { [x.simpleSource.author, x.simpleSource.editor] = [x.simpleSource.editor, x.simpleSource.author]; })).toBe('receipt_route');
    expect(variant(x => { x.accounting.estimatedUsd = (s.simpleSource.author.estimatedMicroUsd + s.simpleSource.editor.estimatedMicroUsd) / 1e6; })).toBe('accounting_binding');
    expect(variant(x => { x.accounting.model = 'claude-opus-5-5'; })).toBe('accounting_binding');
    expect(variant(x => { x.accounting.model = 'gpt-6.1-sol'; })).toBe('accounting_binding');
    expect(variant(x => { delete x.simpleSource.editor; })).toBe('invalid');
    // A real Sol-only v4 source cannot be passed off as role-split, and an Opus-only one cannot either.
    const sol = await source({ author: 'sol', editor: 'sol' }, SOL_WRITING.model);
    const solSource: any = createCurrentSimpleStorySource(sol.req, sol.generated, sol.records as any, options, SOL_WRITING.model);
    expect(solSource.accounting.estimatedUsd).not.toBeNull();
    const relabel = (x: any) => { x = structuredClone(x); x.simpleSource.version = ROLES_SIMPLE_SOURCE_VERSION; x.accounting.model = SIMPLE_WRITING_ROLES.label; x.accounting.estimatedUsd = null; return x; };
    expect(code(() => admitCurrentSimpleStorySource(sol.req, relabel(solSource), options))).toBe('receipt_route');
    const opus = await source({ author: 'cli', editor: 'cli' }, 'claude-opus-5-5');
    const opusSource = createCurrentSimpleStorySource(opus.req, opus.generated, opus.records as any, options, 'claude-opus-5-5');
    expect(opusSource.simpleSource.version).toBe(CURRENT_SIMPLE_SOURCE_VERSION);
    expect(code(() => admitCurrentSimpleStorySource(opus.req, relabel(opusSource), options))).toBe('receipt_route');
  });
  it('is not repairable: repair_route before any reading or editor call is used', async () => {
    const f = await split(), s = createCurrentSimpleStorySource(f.req, f.generated, f.records as any, options, SIMPLE_WRITING_ROLES.label);
    expect(code(() => prepareSimpleStoryRepair(f.req, s, [], options))).toBe('repair_route');
  });
  it('builds the author wire as the existing Claude CLI route: claude-opus-5-5 with --effort medium', () => {
    const p = prepareSimpleStory(request(6), options, 'momentum-roles', SIMPLE_CHILD_MOMENTUM_EXPERIENCE), call = simpleAuthorCall(p);
    const wire = prepareCausalWire({ ...call, role: 'opus', conversationKey: 'r14:author' }, { executable: 'C:/synthetic/claude.exe', executableSha256: '0'.repeat(64),
      workspace: 'C:/synthetic', maxWireBytes: 104_000, rates: { opus: { inputMicroUsdPerToken: 4, outputMicroUsdPerToken: 20 }, astra: { inputMicroUsdPerToken: 2, outputMicroUsdPerToken: 10 } } },
      2_000_000, 'C:/synthetic/author-instructions.txt');
    expect(wire.model).toBe('claude-opus-5-5');
    expect(wire.args!.slice(0, 6)).toEqual(['-p', '--safe-mode', '--model', 'claude-opus-5-5', '--effort', 'medium']);
    expect(wire.args).toContain('--max-budget-usd'); expect(wire.args![wire.args!.indexOf('--max-budget-usd') + 1]).toBe('2');
    expect(wire.stdin).toBe(call.input);
  });
  it('only the role-split label suppresses the summed estimate; single-model routes still sum', async () => {
    for (const [model, roles] of [['claude-opus-5-5', { author: 'cli', editor: 'cli' }], [SOL_WRITING.model, { author: 'sol', editor: 'sol' }]] as const) {
      const f = await source(roles as any, model);
      expect(f.generated.result.accounting.estimatedUsd).toBeGreaterThan(0);
    }
    expect((await split()).generated.result.accounting.estimatedUsd).toBeNull();
  });
  it('runs through the existing book flow to the review stages and the visual boundary', async () => {
    const stages: string[] = [];
    const task = runSimpleWizardBook({ request: request(6), options, seed: 'momentum-roles', signal: new AbortController().signal,
      storyExperience: SIMPLE_CHILD_MOMENTUM_EXPERIENCE, writingModel: SIMPLE_WRITING_ROLES.label, reservedWritingUsd: 2.6,
      opus: async call => { stages.push(call.stage); return (call.stage === 'author' ? cliRecord(call) : await solRecord(call)) as any; },
      reader: async call => {
        stages.push(call.stage); const data = JSON.parse(call.input), body: any = data.packet;
        expect(body.brief.childStoryProfile).toEqual(childStoryProfile(6));
        return { packetDigest: data.packetDigest, summary: 'Synthetic review only, not a literary verdict.', findings: [] };
      },
      visual: async () => { stages.push('visual_boundary'); throw Error('STOP_BEFORE_STORYBOARD_PROVIDER'); }, publish: () => {},
    });
    await expect(task).rejects.toThrow('personal_storyboard_author_failed');
    expect(stages.slice(0, 4)).toEqual(['author', 'editor', 'final_review', 'comparison']); expect(stages[stages.length - 1]).toBe('visual_boundary');
  });
  it('a meaningful momentum finding is material under the unchanged predicate', async () => {
    const stages: string[] = [];
    const held = await runSimpleWizardBook({ request: request(6), options, seed: 'momentum-roles', signal: new AbortController().signal,
      storyExperience: SIMPLE_CHILD_MOMENTUM_EXPERIENCE, writingModel: SIMPLE_WRITING_ROLES.label, reservedWritingUsd: 2.6,
      opus: async call => { stages.push(call.stage); return (call.stage === 'author' ? cliRecord(call) : await solRecord(call)) as any; },
      reader: async call => {
        stages.push(call.stage); const data = JSON.parse(call.input), unit = data.packet.manuscript?.pages[0].units[0];
        return { packetDigest: data.packetDigest, summary: 'Synthetic review only, not a literary verdict.', findings: call.stage === 'final_review' ? [{
          severity: 'meaningful', kind: 'issue', criterion: 'Synthetic: most spreads circle one object with little change', explanation: 'Synthetic listener effect for route test only.',
          original: [], revised: [{ startId: unit.id, endId: unit.id, anchor: citationTokens(unit.text).slice(0, 2).join(' ') }] }] : [] };
      },
      visual: async () => { stages.push('visual_boundary'); throw Error('STOP_BEFORE_STORYBOARD_PROVIDER'); }, publish: () => {},
    });
    expect(held.status).toBe('story_held'); expect(stages).not.toContain('visual_boundary');
  });
});
