import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { mkdtempSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolvePersonalWizardOptions } from '../options';
import { prepareSimpleStory, simpleAuthorCall, type SimpleStoryCall } from '../simple-story-engine';
import { SIMPLE_CHILD_MOMENTUM_EXPERIENCE, SIMPLE_CHILD_MOMENTUM_VERSION } from '../simple-story-experience';
import { SIMPLE_WRITING_ROLES } from '../simple-writing-roles';
import { ROLES_SIMPLE_SOURCE_VERSION } from '../simple-story-source';
import { runSimpleWizardBook } from '../simple-book-flow';
import { citationTokens } from '../story-source-citations';
import { SOL_WRITING, createSolWritingTransport, prepareSolWritingWire } from '../../../scripts/personal-sol-writing-transport';
import { createAstraCausalTransport, type WirePolicy } from '../../../scripts/personal-causal-trial-adapters';
import { replaySettlement } from '../../../scripts/personal-new-book-experiment';
import { MOMENTUM_BOOK_TRIAL, PORTRAIT_BOOK_TRIAL, BOOK_E2E_TRIAL, READER_SAFE_BOOK_TRIAL, bookTrialPolicy, trialConfigSchema, trialApiRules,
  TrialApiMeter, TrialMaxBudget, momentumTextRoutes } from '../../../scripts/personal-book-e2e-trial';
import { AUDITION_REVIEW_CAPACITY_VERSION as capV1 } from '../../../scripts/personal-simple-book-reviewed-audition';
import { READER_PORTRAIT_FRAMING_VERSION as portrait } from '../../storybook-scene-framing';

const options = resolvePersonalWizardOptions(), folder = () => mkdtempSync(path.join(tmpdir(), 'momentum-book-'));
const PRIOR = 3_185_794;
const request = { kind: 'personal_book_request', version: 'reviewed-personal-book-request/v3', draftId: 'd_momentumspec01', draftRevision: 1,
  child: { name: 'עידו', age: 6, address: 'boy', residence: 'עיר הדמיון', nameSource: 'typed', ageSource: 'typed', addressSource: 'typed', residenceSource: 'typed' },
  facts: [{ id: 'f_momentumspec01', kind: 'interest', value: 'לסדר קוביות', source: 'typed' }], noDifficulty: true,
  storyPlace: { value: 'בחדר המשחקים', source: 'typed' }, companion: { id: 'bunny_ometz' }, intent: { kind: 'just_for_fun' }, avoid: [],
  appearance: { photo: 'none' }, bookOptions: { lengthId: 'short', voiceId: null } };
const SEED = 'momentum-spec-seed';
// Synthetic wiring only: intentionally not an example of an enjoyable story.
function draftFor(call: SimpleStoryCall) {
  const book = JSON.parse(call.input).book, child = book.child.name;
  const value = { title: `${child} ובוני בדרך`, writingContractVersion: SIMPLE_CHILD_MOMENTUM_VERSION,
    pages: Array.from({ length: 8 }, (_, i) => ({ text: `${child} ובוני יצאו לדרך ${i + 1}. ${'השביל התפתל בין הגבעות והם צעדו יחד וצחקו מהרוח הקלה. '.repeat(5)}בסוף הגיעו אל מגדל הענן הכחול.` })),
    childGoal: `${child} רוצה לגלות`, companionWant: 'בוני רוצה לקפוץ', comicPromise: 'מסע משותף', ending: 'הם חוזרים הביתה',
    pageMap: Array.from({ length: 8 }, (_, i) => ({ location: 'שביל דמיוני', transitionReason: 'המסע נמשך', childAction: `${child} צועד`,
      companionAction: 'בוני קופץ', consequence: 'הם מתקדמים', continuity: 'השביל', factIds: i ? [] : ['f_momentumspec01'] })),
    resilienceMoments: [{ page: 4, childChoice: `${child} בוחר להמשיך`, whatHelps: 'בוני לידו' }] };
  return call.stage === 'author' ? value : { ...value, editorChanges: ['Synthetic unchanged story, not literary improvement.'] };
}
const USAGE = { input_tokens: 1000, output_tokens: 500, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } };
let seq = 0;
const responses = (answer: (body: any) => unknown, count: { n: number }) => (async (_url: unknown, init: any) => {
  count.n++; const body = JSON.parse(String(init.body)), output = answer(body), text = JSON.stringify(output), id = `resp_synthetic_momentum_${seq++}`;
  return new Response(JSON.stringify({ id, model: SOL_WRITING.model, status: 'completed', service_tier: 'default', output_text: text, usage: USAGE,
    output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] }] }),
    { status: 200, headers: { 'content-type': 'application/json' } });
}) as unknown as typeof fetch;
/** The saved shape of an actual Claude CLI reply (runClaudeCli), with synthetic content and session. */
function cliRecord(call: SimpleStoryCall) {
  const output = draftFor(call), usage = { inputTokens: 1000, outputTokens: 2000 }, termination = { code: 0, signal: null };
  return { output, usage, estimatedMicroUsd: 100_000, metadata: { kind: 'cli_reported_estimate_not_invoice', reportedModels: ['claude-opus-5-5'], termination },
    raw: { termination, killConfirmed: true, stopped: false, stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false,
      session_id: `11111111-1111-4111-8111-${String(100000000000 + seq++).slice(-12)}`, total_cost_usd: 0.1, modelUsage: { 'claude-opus-5-5': usage }, structured_output: output }) } };
}
const policy = (workspace: string): WirePolicy => ({ executable: 'C:/synthetic/claude.exe', executableSha256: '0'.repeat(64), workspace, maxWireBytes: 104000,
  rates: { opus: replaySettlement.rates.opus, astra: replaySettlement.rates.sol }, openAIReviewModel: 'gpt-6.1-sol', astraInlineReferences: true, plannerSchema: 'definition-names/v1' });
/** A reviewer reply whose meaningful finding cites the right words in the wrong unit, then a correction that cites the unit that holds them. */
function reviewer(material: boolean) {
  return (body: any) => {
    const input = JSON.parse(body.input);
    if (input.correctionDigest) return { correctionDigest: input.correctionDigest, corrections: input.correction.invalid.map((row: any) => {
      const want = citationTokens(row.returned.anchor), unit = row.units.find((u: any) => { const t = citationTokens(u.text); return t.some((_, i) => want.every((w, k) => t[i + k] === w)); });
      return { path: row.path, startId: unit.id, endId: unit.id, anchor: want.join(' ') }; }) };
    const units = input.packet.manuscript?.pages[0].units;
    if (!units || !material) return { packetDigest: input.packetDigest, summary: 'Synthetic review only, not a literary verdict.', findings: [] };
    return { packetDigest: input.packetDigest, summary: 'Synthetic review only, not a literary verdict.', findings: [{ severity: 'meaningful', kind: 'issue',
      criterion: 'Synthetic: most spreads repeat one walk', explanation: 'Synthetic listener effect for route test only.', original: [],
      revised: [{ startId: units[0].id, endId: units[0].id, anchor: citationTokens(units[units.length - 1].text).slice(-2).join(' ') }] }] };
  };
}
function harness(o: { guard?: (h: any) => void; material?: boolean; outside?: { api?: number; max?: number } } = {}) {
  const dir = folder(), apiRoot = path.join(dir, 'paid-stages'), maxRoot = path.join(dir, 'claude-max-stages'), text = path.join(dir, 'text');
  const h: any = { dir, apiRoot, maxRoot, authorCalls: 0, editorFetch: { n: 0 }, readerFetch: { n: 0 }, wires: [] as any[] };
  const maxOf = (prefix = '') => new TrialMaxBudget(maxRoot, prefix, MOMENTUM_BOOK_TRIAL.maxResourceMicroUsd,
    { capMicroUsd: MOMENTUM_BOOK_TRIAL.cycleCapMicroUsd, outside: () => o.outside?.max ?? apiOf().snapshot().cumulativeAccountedMicroUsd });
  const apiOf = (prefix = ''): TrialApiMeter => new TrialApiMeter(apiRoot, prefix, true, PRIOR,
    { capMicroUsd: MOMENTUM_BOOK_TRIAL.cycleCapMicroUsd, outside: () => o.outside?.api ?? new TrialMaxBudget(maxRoot, '').snapshot().accountedMicroUsd });
  h.max = maxOf; h.api = apiOf;
  h.routes = momentumTextRoutes({ guard: () => o.guard?.(h), max: maxOf('momentum_s0_'), api: apiOf('momentum_s0_'), policy: policy(text), dir: dir,
    conversation: step => `trial:spec:0:${step}`,
    author: (async (wire: any, call: any) => { h.authorCalls++; h.wires.push(wire); return cliRecord(call); }) as any,
    editor: createSolWritingTransport({ key: () => 'SYNTHETIC-NOT-A-KEY', fetch: responses(body => draftFor({ stage: 'editor', input: body.input } as any), h.editorFetch) }),
    reader: createAstraCausalTransport({ key: () => 'SYNTHETIC-NOT-A-KEY', rates: replaySettlement.rates.sol, model: 'gpt-6.1-sol', inlineReferences: true,
      fetch: responses(reviewer(o.material ?? true), h.readerFetch) }),
    observe: dispatch => dispatch() });
  h.flow = () => runSimpleWizardBook({ request, options, seed: SEED, signal: new AbortController().signal, reservedWritingUsd: 2,
    writingModel: SIMPLE_WRITING_ROLES.label, storyExperience: MOMENTUM_BOOK_TRIAL.storyExperience,
    opus: h.routes.opus, reader: h.routes.reader, citationCorrector: h.routes.citationCorrector,
    visual: async () => { throw Error('STOP_BEFORE_STORYBOARD_PROVIDER'); }, publish: () => {} });
  h.steps = (root: string) => existsSync(root) ? readdirSync(root).filter(n => n.endsWith('.claim.json')).map(n => n.replace('.claim.json', '')).sort() : [];
  return h;
}

describe('one new opt-in momentum book: Opus author on Max, Sol for the rest, continuing ledger', () => {
  it('is one distinct new policy on the portrait line, with the explicit Max allowance, prior ledger and cycle ceiling', () => {
    expect(bookTrialPolicy(MOMENTUM_BOOK_TRIAL.id)).toBe(MOMENTUM_BOOK_TRIAL);
    expect(MOMENTUM_BOOK_TRIAL).toMatchObject({ apiCapMicroUsd: 7_000_000, maxApiCalls: 98, priorApiMicroUsd: PRIOR, cycleCapMicroUsd: 8_000_000,
      maxResourceMicroUsd: 2_000_000, sourceRepairs: 0, citationCorrections: 2, storyboardAttempts: 3, pageAttempts: 3, pages: 8,
      readerFraming: portrait, reviewCapacity: capV1, storyExperience: SIMPLE_CHILD_MOMENTUM_EXPERIENCE });
    expect(MOMENTUM_BOOK_TRIAL.routes).toEqual({ ...PORTRAIT_BOOK_TRIAL.routes, writing: SIMPLE_WRITING_ROLES.label });
    expect(MOMENTUM_BOOK_TRIAL.routes).toMatchObject({ images: 'gpt-image-2/low', numericIdentity: 'gpt-4o', identityThreshold: .7 });
    expect(new Set([BOOK_E2E_TRIAL, READER_SAFE_BOOK_TRIAL, PORTRAIT_BOOK_TRIAL, MOMENTUM_BOOK_TRIAL].flatMap(t => [t.id, t.claim, t.outcome])).size).toBe(12);
    expect(MOMENTUM_BOOK_TRIAL.usedCompanions).toEqual(expect.arrayContaining(['fox_uri', 'lion_shaket', 'dragon_dini', 'chameleon_koko', 'panda_anat']));
    expect(MOMENTUM_BOOK_TRIAL.usedCompanions).not.toContain('bunny_ometz');
    // Older policies are untouched.
    expect(PORTRAIT_BOOK_TRIAL).toMatchObject({ maxResourceMicroUsd: 0, sourceRepairs: 1, citationCorrections: 1 });
    expect(PORTRAIT_BOOK_TRIAL.routes.writing).toBe('gpt-6.1-sol/openai_responses'); expect(BOOK_E2E_TRIAL.maxResourceMicroUsd).toBe(6_000_000);
    expect('priorApiMicroUsd' in PORTRAIT_BOOK_TRIAL).toBe(false);
    const config = { version: 'book-e2e-trial-config/v1', cycle: MOMENTUM_BOOK_TRIAL.id, ownerFile: 'C:/o', ownerSha: 'a'.repeat(64), bookDir: 'C:/b', profileFile: 'C:/p',
      profileSha: 'b'.repeat(64), executable: 'C:/exe', executableSha256: 'c'.repeat(64), keyFile: 'C:/existing' };
    expect(trialConfigSchema.safeParse(config).success).toBe(false);
    // A momentum config also carries its sealed Wizard receipt (R4 F1; momentum-request-binding.spec).
    const operated = { ...config, operatorFile: 'C:/operator.cjs', operatorSha: 'd'.repeat(64) };
    expect(trialConfigSchema.safeParse(operated).success).toBe(false);
    expect(trialConfigSchema.safeParse({ ...operated, requestBinding: { version: 'wizard-request-binding/v1', intakeFile: 'C:/i', intakeSha256: 'e'.repeat(64),
      bindingFile: 'C:/b', bindingSha256: 'f'.repeat(64), wizardConfigFile: 'C:/w', wizardConfigSha256: '1'.repeat(64) } }).success).toBe(true);
  });
  it('meters the editor, storyboard, readings and one correction per reading on the API; the author never', () => {
    const p = prepareSimpleStory(request, options, SEED, SIMPLE_CHILD_MOMENTUM_EXPERIENCE), author = simpleAuthorCall(p);
    expect(trialApiRules('momentum_s0_author')).toBeUndefined();
    const editorWire = prepareSolWritingWire({ ...author, stage: 'editor' } as any), authorWire = prepareSolWritingWire(author);
    expect(trialApiRules('momentum_s0_editor')!.reserve(editorWire)).toBeGreaterThanOrEqual(600000);
    expect(trialApiRules('momentum_s0_editor')!.reserve(authorWire)).toBeNull();
    for (const step of ['momentum_s1_storyboard', 'momentum_s0_final_review', 'momentum_s0_comparison', 'momentum_s3_storyboard_review',
      'momentum_s0_citation_correction_final_review', 'momentum_s0_citation_correction_comparison']) expect(trialApiRules(step)).toBeDefined();
    for (const step of ['momentum_s0_citation_correction', 'momentum_s0_citation_correction_storyboard_review', 'momentum_s6_editor', 'momentum_s0_author_editor'])
      expect(trialApiRules(step)).toBeUndefined();
    // Portrait steps keep their rules.
    expect(trialApiRules('portrait_s0_author')).toBeDefined(); expect(trialApiRules('portrait_s0_citation_correction')).toBeDefined();
  });
  it('the real flow writes a roles-v1 v4 source: one Max author session, Sol editor, readings and the bounded correction on the API', async () => {
    const h = harness(), held = await h.flow();
    expect(held.status).toBe('story_held');
    expect(held.source.simpleSource.version).toBe(ROLES_SIMPLE_SOURCE_VERSION);
    expect(held.source.simpleSource.author).toMatchObject({ model: 'claude-opus-5-5', costKind: 'cli_reported_estimate_not_invoice', estimatedMicroUsd: 100_000 });
    expect(held.source.simpleSource.editor).toMatchObject({ model: SOL_WRITING.model, costKind: 'provider_reported_usage_estimate_not_invoice' });
    expect(held.source.accounting).toMatchObject({ model: SIMPLE_WRITING_ROLES.label, providerCalls: 2, estimatedUsd: null });
    expect(held.citationCorrections).toEqual([{ stage: 'final_review', provenance: expect.objectContaining({ instructions: 'v2' }) }]);
    expect(h.steps(h.maxRoot)).toEqual(['momentum_s0_author']);
    expect(readdirSync(h.maxRoot).sort()).toEqual(['claim', 'receipt', 'result', 'wire'].map(kind => `momentum_s0_author.${kind}.json`));
    expect(h.steps(h.apiRoot)).toEqual(['citation_correction_final_review', 'comparison', 'editor', 'final_review'].map(s => `momentum_s0_${s}`));
    expect(h.authorCalls).toBe(1); expect(h.editorFetch.n).toBe(1); expect(h.readerFetch.n).toBe(3);
    expect(h.wires[0].args.slice(0, 6)).toEqual(['-p', '--safe-mode', '--model', 'claude-opus-5-5', '--effort', 'medium']);
    expect(h.wires[0].args[h.wires[0].args.indexOf('--max-budget-usd') + 1]).toBe('2');
    expect(JSON.parse(h.wires[0].stdin).book.storyExperience).toBe(SIMPLE_CHILD_MOMENTUM_EXPERIENCE);
    const max = h.max().snapshot(), api = h.api().snapshot();
    expect(max).toMatchObject({ accountedMicroUsd: 100_000, unknownAttemptCosts: 0, logicalAttempts: 1, stopped: false });
    expect(api).toMatchObject({ calls: 4, unknownCost: 0, unknownOutcome: 0 });
    expect(api.cumulativeAccountedMicroUsd).toBe(PRIOR + api.newKnownApiMicroUsd);
  });
  it('a valid reading needs no correction call, and the flow does not invent one', async () => {
    const h = harness({ material: false });
    await expect(h.flow()).rejects.toThrow('personal_storyboard_author_failed');
    expect(h.steps(h.apiRoot)).toEqual(['comparison', 'editor', 'final_review'].map(s => `momentum_s0_${s}`));
  });
  it('the live fence runs after the author claim: a mid-claim change stops before the CLI and settles the claim as failed', async () => {
    const claim = (h: any) => path.join(h.maxRoot, 'momentum_s0_author.claim.json');
    const h = harness({ guard: h => { if (existsSync(claim(h))) throw Object.assign(Error('trial_binding_changed'), { code: 'trial_binding_changed' }); } });
    await expect(h.flow()).rejects.toThrow('trial_binding_changed');
    expect(h.authorCalls).toBe(0); expect(h.steps(h.apiRoot)).toEqual([]);
    expect(JSON.parse(readFileSync(path.join(h.maxRoot, 'momentum_s0_author.result.json'), 'utf8'))).toMatchObject({ completed: false, estimatedMicroUsd: null });
    // The unknown counts its full reservation and stops the journal: no second session can follow.
    expect(h.max().snapshot()).toMatchObject({ accountedMicroUsd: 2_000_000, unknownAttemptCosts: 1, stopped: true });
  });
  it('the live fence runs after the editor claim too: no Sol request is sent', async () => {
    const h = harness({ guard: h => { if (existsSync(path.join(h.apiRoot, 'momentum_s0_editor.claim.json'))) throw Error('trial_binding_changed'); } });
    await expect(h.flow()).rejects.toThrow('trial_binding_changed');
    expect(h.authorCalls).toBe(1); expect(h.editorFetch.n).toBe(0);
  });
  it('the Max allowance is one author session; the cycle ceiling counts API plus Max before any claim', async () => {
    const h = harness(), p = prepareSimpleStory(request, options, SEED, SIMPLE_CHILD_MOMENTUM_EXPERIENCE), call = simpleAuthorCall(p);
    await h.routes.opus(call, new AbortController().signal);
    const again = async () => ({ value: 1, estimatedMicroUsd: 1, receipt: {} }), session = (maximum: number) => async () => h.max('momentum_s1_').run('author', { synthetic: true }, maximum, again);
    await expect(session(2_000_000)()).rejects.toThrow('trial_max_cap');
    await expect(session(1_000_000)()).rejects.toThrow('trial_max_session_guard');
    expect(h.steps(h.maxRoot)).toEqual(['momentum_s0_author']);
    // Max room: API cumulative 6.5M + a 2M session > 8M.
    const tight = harness({ outside: { max: 6_500_000 } });
    await expect(tight.routes.opus(call, new AbortController().signal)).rejects.toThrow('trial_cycle_cap');
    expect(tight.authorCalls).toBe(0); expect(tight.steps(tight.maxRoot)).toEqual([]);
    // API room: prior + Max 4.4M + the editor reservation and its cache margin > 8M, while the API cap alone would still allow it.
    const api = harness({ outside: { api: 4_400_000 } }), editor = { ...call, stage: 'editor' } as any;
    await expect(api.routes.opus(editor, new AbortController().signal)).rejects.toThrow('trial_cycle_cap');
    expect(api.editorFetch.n).toBe(0); expect(api.steps(api.apiRoot)).toEqual([]);
  });
  it('the API meter continues the prior ledger against the same cap; defaults stay exact for older cycles', async () => {
    const dir = folder(), legacy = new TrialApiMeter(dir), resumed = new TrialApiMeter(dir, 'momentum_s0_', true, PRIOR);
    expect(legacy.snapshot().cumulativeAccountedMicroUsd).toBe(0); expect(legacy.cycle).toBeUndefined();
    expect(resumed.snapshot().cumulativeAccountedMicroUsd).toBe(PRIOR);
    expect(new TrialMaxBudget(folder(), '').allowanceMicroUsd).toBe(BOOK_E2E_TRIAL.maxResourceMicroUsd);
    const nearly = new TrialApiMeter(dir, 'momentum_s0_', true, 6_900_000), call: any = { stage: 'editor', instructions: 'Synthetic', input: 'Synthetic', maxOutputTokens: 12000,
      schema: z.object({ title: z.string() }).strict() }, wire = prepareSolWritingWire(call);
    let calls = 0;
    await expect(nearly.run('editor', wire, trialApiRules('momentum_s0_editor')!.reserve(wire)!, async () => { calls++; throw Error('must not run'); })).rejects.toThrow('audition_budget_exhausted');
    expect(calls).toBe(0); expect(existsSync(path.join(dir, 'momentum_s0_editor.claim.json'))).toBe(false);
  });
  it('at most one correction per reading, each its own metered step; a repeat or a third is refused before any request', async () => {
    const call: any = { stage: 'citation_correction', instructions: 'Synthetic correction', input: JSON.stringify({ correctionDigest: 'a'.repeat(64),
      correction: { invalid: [] } }), maxOutputTokens: 4000, schema: z.object({ correctionDigest: z.string(), corrections: z.array(z.unknown()) }).strict() };
    const s = new AbortController().signal, h = harness();
    await h.routes.citationCorrector('final_review', call, s); await h.routes.citationCorrector('comparison', call, s);
    expect(h.steps(h.apiRoot)).toEqual(['momentum_s0_citation_correction_comparison', 'momentum_s0_citation_correction_final_review']);
    await expect(h.routes.citationCorrector('final_review', call, s)).rejects.toThrow('trial_citation_used');
    expect(h.readerFetch.n).toBe(2);
    const again = harness();
    await again.routes.citationCorrector('final_review', call, s);
    await expect(again.routes.citationCorrector('final_review', call, s)).rejects.toThrow();
    expect(again.readerFetch.n).toBe(1); expect(again.steps(again.apiRoot)).toEqual(['momentum_s0_citation_correction_final_review']);
  });
});
