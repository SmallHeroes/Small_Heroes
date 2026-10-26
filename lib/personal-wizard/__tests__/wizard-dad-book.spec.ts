import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { callElevenLabs, resolveVoiceSettings } from '../../../backend/providers/audio';
import { findVoiceById } from '../../../backend/config/voices';
import { localReaderPreviewSchema } from '../../local-reader-preview';
import { acceptPersonalBookRequest } from '../request-acceptance';
import { resolvePersonalWizardOptions } from '../options';
import { BOOK_NARRATION, narrationVoice, prepareNarrationWire, narrationMeterRule, createNarrationTransport, planBookNarration, narrateBook,
  writeLocalReaderBundle, probeNarrationAudio } from '../../../scripts/personal-book-narration';
import { MOMENTUM_BOOK_TRIAL, TrialApiMeter, trialApiRules, momentumReaderId } from '../../../scripts/personal-book-e2e-trial';
import { MOMENTUM_WIZARD_SLOT, momentumLocalGate, enqueueMomentumBook, readMomentumBookStatus, resolveMomentumBookSettings,
  MomentumBridgeError } from '../momentum-book-bridge';
import { momentumBookViewSchema } from '../momentum-book-view';

const folder = () => mkdtempSync(path.join(tmpdir(), 'wizard-dad-'));
const PRIOR = 3_185_794, sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const dad = () => narrationVoice('dad_v2', ['dad_v2']);
const audio = Buffer.alloc(4000, 7);
type Reply = { status?: number; cost?: string | null; id?: string | null; type?: string };
function provider(replies: (n: number) => Reply = () => ({})) {
  const calls: { url: string; body: any; headers: any }[] = [];
  const fake = (async (url: string, init: any) => {
    const n = calls.push({ url, body: JSON.parse(init.body), headers: init.headers }) - 1, r = replies(n), body = JSON.parse(init.body);
    const headers: Record<string, string> = { 'content-type': r.type ?? 'audio/mpeg' };
    if (r.cost !== null) headers['character-cost'] = r.cost ?? String(body.text.length);
    if (r.id !== null) headers['request-id'] = r.id ?? `req_${n}`;
    return new Response(new Uint8Array(audio), { status: r.status ?? 200, headers });
  }) as unknown as typeof globalThis.fetch;
  return { calls, transport: createNarrationTransport({ key: () => 'SYNTHETIC-NOT-A-KEY', fetch: fake }) };
}
const pages = Array.from({ length: 9 }, (_, i) => ({ pageNumber: i, text: i ? `עמוד ${i}: עידו ובוני קפצו, צחקו והמשיכו בדרך אל הגבעה.` : 'עידו ובוני בדרך' }));

describe('Dad narration (book-narration/v1): strict voice, exact wire, once-only metered calls', () => {
  afterEach(() => { delete process.env.ELEVENLABS_API_KEY; });
  it('selects only an allowed selectable registry voice; legacy "dad", other or unknown voices refuse', () => {
    const v = dad(), registry = findVoiceById('dad_v2')!;
    expect(v).toEqual({ id: 'dad_v2', label: 'אבא', elevenlabsVoiceId: 'NaMUH1vcebhHvD4z3Lku', settings: resolveVoiceSettings(registry, false) });
    expect(v.settings).toEqual({ stability: 0.7, similarity_boost: 0.8, style: 0, use_speaker_boost: true });
    for (const [id, allowed] of [['dad', ['dad', 'dad_v2']], ['mom', ['dad_v2']], ['nope', ['nope']], [null, ['dad_v2']]] as const)
      expect(() => narrationVoice(id, allowed as any)).toThrow('narration_voice');
  });
  it('sends byte-for-byte the body callElevenLabs sends for the same text and settings; the display text is not changed', async () => {
    const wire = prepareNarrationWire(3, pages[3].text, dad()), captured: any[] = [];
    process.env.ELEVENLABS_API_KEY = 'SYNTHETIC-NOT-A-KEY';
    const real = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: any) => { captured.push({ url, body: init.body }); return new Response(new Uint8Array(audio), { status: 200 }); }) as any;
    try { await callElevenLabs(wire.body.text, dad().elevenlabsVoiceId, dad().settings); } finally { globalThis.fetch = real; }
    expect(captured).toHaveLength(1); expect(captured[0].url).toBe(wire.url); expect(captured[0].body).toBe(JSON.stringify(wire.body));
    expect(wire.body).toMatchObject({ model_id: 'eleven_v3', language_code: 'he' }); expect(wire.body.text).not.toBe(pages[3].text);
    expect(planBookNarration(pages, dad(), 1_000_000).rows[3].text).toBe(pages[3].text);
  });
  it('the meter rule reserves twice the exact characters and settles max(characters, reported cost); anything unclear is unknown', () => {
    const wire = prepareNarrationWire(1, pages[1].text, dad()), n = wire.body.text.length, known = (cc: number) => Math.max(n, cc) * 100;
    expect(narrationMeterRule.reserve(wire)).toBe(n * 200); expect(narrationMeterRule.reserve({ ...wire, url: 'https://evil.example/x' })).toBeNull();
    const receipt = (cc: number | null, extra: object = {}) => ({ status: 200, characterCost: cc, requestId: 'req', contentType: 'audio/mpeg', bytes: 4000,
      audioSha256: sha(audio), estimatedMicroUsd: cc === null ? null : known(cc), ...extra });
    expect(narrationMeterRule.settle(wire, receipt(n + 5), true)).toEqual({ estimatedMicroUsd: known(n + 5), coherent: true });
    expect(narrationMeterRule.settle(wire, receipt(3), true)).toEqual({ estimatedMicroUsd: n * 100, coherent: true });
    expect(narrationMeterRule.settle(wire, receipt(n, { estimatedMicroUsd: 1 }), true).coherent).toBe(false);
    expect(narrationMeterRule.settle(wire, receipt(n, { requestId: null }), true).coherent).toBe(false);
    expect(narrationMeterRule.settle(wire, null, false)).toEqual({ estimatedMicroUsd: null, coherent: true });
    expect(narrationMeterRule.settle(wire, receipt(null, { status: 200 }), false)).toEqual({ estimatedMicroUsd: null, coherent: true });
  });
  it('one POST per call, never a retry; a missing charge is unknown, an HTTP error or non-audio stops', async () => {
    const wire = prepareNarrationWire(2, pages[2].text, dad()), s = new AbortController().signal;
    const ok = provider(); const r = await ok.transport(wire, s);
    expect(ok.calls).toHaveLength(1); expect(ok.calls[0].headers['xi-api-key']).toBe('SYNTHETIC-NOT-A-KEY'); expect(r.audio.equals(audio)).toBe(true);
    for (const [reply, code, est] of [[{ cost: null }, 'narration_usage_unknown', null], [{ status: 500 }, 'narration_http', 'known'],
      [{ id: null }, 'narration_request_id', 'known'], [{ type: 'application/json' }, 'narration_audio_invalid', 'known']] as const) {
      const p = provider(() => reply as Reply);
      const error: any = await p.transport(wire, s).catch(e => e);
      expect(error.code).toBe(code); expect(p.calls).toHaveLength(1);
      expect(error.receipt.estimatedMicroUsd).toBe(est === null ? null : wire.body.text.length * 100);
    }
  });
  it('plans the whole book before any call, within the narration sublimit, in page order', () => {
    const plan = planBookNarration(pages, dad(), 1_000_000);
    expect(plan.rows).toHaveLength(9); expect(plan.reserveMicroUsd).toBe(plan.characters * 200);
    expect(() => planBookNarration(pages, dad(), plan.reserveMicroUsd - 1)).toThrow('narration_budget');
    expect(() => planBookNarration([pages[1], pages[0]], dad(), 1_000_000)).toThrow('narration_pages');
  });
  it('narrates on the SAME API meter (prior ledger kept), one claimed step per page; a repeat is refused', async () => {
    const dir = folder(), meter = new TrialApiMeter(path.join(dir, 'paid'), '', true, PRIOR), p = provider(), plan = planBookNarration(pages, dad(), 1_000_000);
    const made = await narrateBook({ plan, meter, transport: p.transport, guard: () => {}, outDir: path.join(dir, 'narration'), signal: new AbortController().signal });
    expect(p.calls).toHaveLength(9); expect(made.pages.map(x => x.pageNumber)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(made.accountedMicroUsd).toBe(plan.characters * 100);
    const snap = meter.snapshot(); expect(snap).toMatchObject({ calls: 9, unknownCost: 0, unknownOutcome: 0 });
    expect(snap.cumulativeAccountedMicroUsd).toBe(PRIOR + made.accountedMicroUsd);
    expect(readdirSync(path.join(dir, 'paid')).filter(n => n.endsWith('.claim.json')).sort()).toEqual(pages.map(x => `narration_p${x.pageNumber}.claim.json`).sort());
    await expect(narrateBook({ plan, meter, transport: p.transport, guard: () => {}, outDir: path.join(dir, 'again'), signal: new AbortController().signal })).rejects.toThrow();
    expect(p.calls).toHaveLength(9);
  });
  it('stops at the first unknown charge, and the fence after each claim stops before the provider', async () => {
    const dir = folder(), meter = new TrialApiMeter(path.join(dir, 'paid'), '', true, PRIOR), p = provider(n => n === 3 ? { cost: null } : {});
    await expect(narrateBook({ plan: planBookNarration(pages, dad(), 1_000_000), meter, transport: p.transport, guard: () => {}, outDir: path.join(dir, 'n'),
      signal: new AbortController().signal })).rejects.toThrow('narration_usage_unknown');
    expect(p.calls).toHaveLength(4); expect(meter.snapshot()).toMatchObject({ unknownCost: 1 });
    const fenced = folder(), m2 = new TrialApiMeter(path.join(fenced, 'paid'), '', true, PRIOR), q = provider();
    const guard = () => { if (existsSync(path.join(fenced, 'paid', 'narration_p0.claim.json'))) throw Error('trial_binding_changed'); };
    await expect(narrateBook({ plan: planBookNarration(pages, dad(), 1_000_000), meter: m2, transport: q.transport, guard, outDir: path.join(fenced, 'n'),
      signal: new AbortController().signal })).rejects.toThrow('trial_binding_changed');
    expect(q.calls).toHaveLength(0);
  });
  it('the local Reader bundle is narrated only when every page has audio; otherwise image-only, never partial audio', async () => {
    const dir = folder(), images = pages.map(x => { const f = path.join(dir, `img-${x.pageNumber}.png`); writeFileSync(f, Buffer.from(`png-${x.pageNumber}`)); return f; });
    const audios = pages.map(x => { const f = path.join(dir, `a-${x.pageNumber}.mp3`); writeFileSync(f, Buffer.from(`mp3-${x.pageNumber}`)); return { pageNumber: x.pageNumber, audioFile: f }; });
    const common = { root: path.join(dir, 'previews'), title: pages[0].text, childName: 'עידו', sourceSha256: 'a'.repeat(64),
      pages: pages.map((x, i) => ({ ...x, imageFile: images[i] })) };
    const full = writeLocalReaderBundle({ ...common, id: 'trial-0123456789abcdef', narration: { voice: { id: 'dad_v2', label: 'אבא' }, pages: audios } });
    const m = localReaderPreviewSchema.parse(JSON.parse(readFileSync(path.join(full.directory, 'manifest.json'), 'utf8')));
    expect(m.version).toBe('local-narrated-reader/v1'); expect(m.voice).toEqual({ id: 'dad_v2', label: 'אבא', provider: 'elevenlabs', model: 'eleven_v3' });
    expect(full.url).toBe('/dev/local-reader?book=trial-0123456789abcdef');
    const partial = writeLocalReaderBundle({ ...common, id: 'trial-fedcba9876543210', narration: { voice: { id: 'dad_v2', label: 'אבא' }, pages: audios.slice(0, 4) } });
    const p = localReaderPreviewSchema.parse(JSON.parse(readFileSync(path.join(partial.directory, 'manifest.json'), 'utf8')));
    expect(p.version).toBe('local-image-reader/v1'); expect(readdirSync(partial.directory).some(n => n.endsWith('.mp3'))).toBe(false);
    expect(() => writeLocalReaderBundle({ ...common, id: 'trial-0123456789abcdef', narration: null })).toThrow('reader_bundle_exists');
  });
  it('the media check refuses a file that is not decodable audio', () => {
    const f = path.join(folder(), 'x.mp3'); writeFileSync(f, Buffer.alloc(3000, 1));
    expect(() => probeNarrationAudio(f)).toThrow();
  });
});

describe('the momentum book policy carries the Dad narration inside the same caps', () => {
  it('policy, meter steps and reader id', () => {
    expect(MOMENTUM_BOOK_TRIAL.narration).toEqual({ version: BOOK_NARRATION.version, voiceIds: ['dad_v2'], maximumMicroUsd: 1_000_000, calls: 9 });
    expect(MOMENTUM_BOOK_TRIAL).toMatchObject({ apiCapMicroUsd: 7_000_000, priorApiMicroUsd: PRIOR, cycleCapMicroUsd: 8_000_000, maxResourceMicroUsd: 2_000_000 });
    for (let n = 0; n <= 8; n++) expect(trialApiRules(`narration_p${n}`)).toBe(narrationMeterRule);
    for (const s of ['narration_p9', 'narration_p', 'momentum_s0_narration_p0']) expect(trialApiRules(s)).toBeUndefined();
    const id = momentumReaderId('0123456789abcdef'.repeat(4));
    expect(momentumBookViewSchema.shape.readerUrl.safeParse(`/dev/local-reader?book=${id}`).success).toBe(true);
  });
  it('the Wizard bridge slot is exactly the trial policy (cycle, voices, used companions)', () => {
    expect(MOMENTUM_WIZARD_SLOT.cycle).toBe(MOMENTUM_BOOK_TRIAL.id); expect(MOMENTUM_WIZARD_SLOT.voiceIds).toEqual(MOMENTUM_BOOK_TRIAL.narration.voiceIds);
    expect(MOMENTUM_WIZARD_SLOT.usedCompanions).toEqual(MOMENTUM_BOOK_TRIAL.usedCompanions);
  });
  it('the executor plans narration from the frozen text before images, keeps its room in page repairs, and narrates only the momentum book', () => {
    const src = readFileSync(path.resolve(__dirname, '../../../scripts/personal-book-e2e-trial.ts'), 'utf8'), body = src.slice(src.indexOf('export async function executeBookTrial'));
    const plan = body.indexOf('narrationPlan=planBookNarration('), child = body.indexOf("const childDir=path.join(config.bookDir,'child')"), narrate = body.indexOf('made=await narrateBook(');
    expect(plan).toBeGreaterThan(0); expect(plan).toBeLessThan(child); expect(narrate).toBeGreaterThan(body.indexOf("save('final-selection'"));
    expect(body).toContain('if(apiSpent+1_400_000+narrationReserve>BOOK_E2E_TRIAL.apiCapMicroUsd||');
    expect(body).toContain('momentum&&apiSpent+max.snapshot().accountedMicroUsd+1_400_000+narrationReserve>MOMENTUM_BOOK_TRIAL.cycleCapMicroUsd)break;');
    expect(body).toContain('transport:createNarrationTransport({key:elevenLabsKeyReader(config.keyFile)})');
    expect(body).toContain("return finish('full_book_diagnostic',{...(momentum?{narration,readerPreview}:{}),");
    expect(body.match(/narrateBook\(/g)).toHaveLength(1);
  });
});

describe('local Wizard → momentum book bridge (provider-free, one request, progress only)', () => {
  const options = resolvePersonalWizardOptions();
  const draft = (over: { companion?: string; voice?: string | null; length?: string; name?: string } = {}) => ({ kind: 'personal_book_request', version: 'reviewed-personal-book-request/v3',
    draftId: 'd_wizarddad0001', draftRevision: 1, child: { name: over.name ?? 'עידו', age: 6, address: 'boy', residence: 'כפר סבא', nameSource: 'typed', ageSource: 'typed',
      addressSource: 'typed', residenceSource: 'typed' }, facts: [{ id: 'f_wizarddad0001', kind: 'interest', value: 'לסדר קוביות', source: 'typed' }],
    noDifficulty: true, storyPlace: null, companion: { id: over.companion ?? 'bunny_ometz' }, intent: { kind: 'just_for_fun' }, avoid: [], appearance: { photo: 'none' },
    bookOptions: { lengthId: over.length ?? 'short', voiceId: over.voice === undefined ? 'dad_v2' : over.voice } });
  const accepted = (raw: unknown) => { const r = acceptPersonalBookRequest(raw, options); if (!r.ok) throw Error('fixture_not_accepted'); return r; };
  const setup = () => { const dir = folder(); mkdirSync(path.join(dir, 'run')); return { dir, config: { version: 'local-momentum-wizard-config/v1' as const,
    cycle: MOMENTUM_WIZARD_SLOT.cycle, seed: 'momentum-ido-bunny-new-story-20261025', intakeFile: path.join(dir, 'intake.json'), runDirectory: path.join(dir, 'run'),
    bookDir: path.join(dir, 'book') } }; };
  const code = (f: () => unknown) => { try { f(); } catch (e) { expect(e).toBeInstanceOf(MomentumBridgeError); return (e as MomentumBridgeError).code; } return 'no_error'; };
  it('is off unless the preview, the runner flag and an absolute config are all set', () => {
    expect(resolveMomentumBookSettings({})).toBeNull();
    expect(resolveMomentumBookSettings({ PERSONAL_WIZARD_PREVIEW: 'true', PERSONAL_WIZARD_MOMENTUM_BOOK_RUNNER: 'true', PERSONAL_WIZARD_MOMENTUM_BOOK_CONFIG: 'relative.json' })).toBeNull();
    expect(resolveMomentumBookSettings({ PERSONAL_WIZARD_PREVIEW: 'true', PERSONAL_WIZARD_MOMENTUM_BOOK_RUNNER: 'true', PERSONAL_WIZARD_MOMENTUM_BOOK_CONFIG: 'C:/x/config.json' }))
      .toEqual({ configFile: 'C:/x/config.json' });
  });
  it('local gate: dev host names, real local Host, same-origin writes', () => {
    const base = { hostname: 'localhost', host: 'localhost:3480', protocol: 'http:', method: 'POST', origin: 'http://localhost:3480' };
    expect(momentumLocalGate(base)).toBeNull(); expect(momentumLocalGate({ ...base, method: 'GET', origin: null })).toBeNull();
    expect(momentumLocalGate({ ...base, hostname: 'qa.example.com' })).toBe('not_found');
    expect(momentumLocalGate({ ...base, host: 'evil.example:80' })).toBe('invalid_host');
    expect(momentumLocalGate({ ...base, origin: 'http://evil.example' })).toBe('invalid_origin');
    expect(momentumLocalGate({ ...base, origin: null })).toBe('invalid_origin');
  });
  it('records exactly the Wizard request once; the same request is idempotent, a different one is refused', () => {
    const { config } = setup(), r = accepted(draft());
    const view = enqueueMomentumBook(config, { request: r.canonical, requestId: r.requestId });
    expect(view).toMatchObject({ phase: 'received', requestId: r.requestId, readerUrl: null, runtimeEligible: false, productAccepted: false });
    const intake = JSON.parse(readFileSync(config.intakeFile, 'utf8'));
    expect(intake).toMatchObject({ version: 'local-momentum-wizard-intake/v1', requestId: r.requestId, voiceId: 'dad_v2', consent: MOMENTUM_WIZARD_SLOT.consent });
    expect(intake.request).toEqual(r.canonical);
    expect(enqueueMomentumBook(config, { request: r.canonical, requestId: r.requestId })).toEqual(view);
    const other = accepted(draft({ name: 'נועם' }));
    expect(code(() => enqueueMomentumBook(config, { request: other.canonical, requestId: other.requestId }))).toBe('momentum_slot_consumed');
  });
  it('refuses requests outside this slot before recording anything', () => {
    const { config } = setup();
    const cases: [ReturnType<typeof draft>, string][] = [[draft({ companion: 'panda_anat' }), 'momentum_companion_used'], [draft({ voice: 'mom' }), 'momentum_voice'],
      [draft({ voice: null }), 'momentum_voice'], [draft({ length: 'long' }), 'momentum_length']];
    let checked = 0;
    for (const [raw, expected] of cases) {
      const r = acceptPersonalBookRequest(raw, options);
      if (!r.ok) continue; // A choice the Wizard itself cannot submit is refused even earlier.
      expect(code(() => enqueueMomentumBook(config, { request: r.canonical, requestId: r.requestId }))).toBe(expected); checked++;
    }
    expect(checked).toBe(cases.length); // Every case is a valid Wizard submission that only this slot refuses.
    const r = accepted(draft());
    expect(code(() => enqueueMomentumBook(config, { request: r.canonical, requestId: 'b'.repeat(64) }))).toBe('momentum_request_binding');
    expect(existsSync(config.intakeFile)).toBe(false);
  });
  it('the real route: off without its flags; local same-origin POST records once (202); foreign origin or host refused', async () => {
    const { NextRequest } = await import('next/server'), route = await import('../../../app/api/dev/personal-wizard/momentum-book/route');
    const { dir, config } = setup(), file = path.join(dir, 'config.json'); writeFileSync(file, JSON.stringify(config));
    const env = { PERSONAL_WIZARD_PREVIEW: 'true', PERSONAL_WIZARD_MOMENTUM_BOOK_RUNNER: 'true', PERSONAL_WIZARD_MOMENTUM_BOOK_CONFIG: file }, saved = { ...process.env };
    const r = accepted(draft()), body = JSON.stringify({ request: r.canonical, requestId: r.requestId, consent: MOMENTUM_WIZARD_SLOT.consent });
    const post = (headers: Record<string, string>, url = 'http://localhost:3480/api/dev/personal-wizard/momentum-book') =>
      route.POST(new NextRequest(url, { method: 'POST', body, headers: { 'content-type': 'application/json', host: 'localhost:3480', origin: 'http://localhost:3480', ...headers } }));
    try {
      expect((await post({})).status).toBe(404); // No flags: the route does not exist.
      Object.assign(process.env, env);
      expect((await post({ origin: 'http://evil.example' })).status).toBe(403);
      expect((await post({ host: 'evil.example' })).status).toBe(403);
      expect(existsSync(config.intakeFile)).toBe(false);
      const ok = await post({}); expect(ok.status).toBe(202);
      expect(momentumBookViewSchema.parse(await ok.json())).toMatchObject({ phase: 'received', requestId: r.requestId });
      const status = await route.GET(new NextRequest(`http://localhost:3480/api/dev/personal-wizard/momentum-book?requestId=${r.requestId}`, { headers: { host: 'localhost:3480' } }));
      expect(status.status).toBe(200); expect((await status.json()).phase).toBe('received');
      const info = await (await route.GET(new NextRequest('http://localhost:3480/api/dev/personal-wizard/momentum-book', { headers: { host: 'localhost:3480' } }))).json();
      expect(info).toMatchObject({ configured: true, engine: 'momentum-v4-roles', voiceIds: ['dad_v2'], operatorWorkerRequired: true, runtimeEligible: false });
    } finally { for (const k of Object.keys(env)) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });
  it('reports progress only from the operator run folder, and only to the recorded request', () => {
    const { config } = setup(), r = accepted(draft()), at = (n: string) => path.join(config.runDirectory, n);
    enqueueMomentumBook(config, { request: r.canonical, requestId: r.requestId });
    writeFileSync(at('live.json'), '{}'); writeFileSync(at('stdout.jsonl'), `${JSON.stringify({ at: 'x', event: 'phase storyboard' })}\nnot json\n`);
    expect(readMomentumBookStatus(config, r.requestId)).toMatchObject({ phase: 'running', event: 'phase storyboard', readerUrl: null });
    const reader = `/dev/local-reader?book=${momentumReaderId(r.requestId)}`;
    writeFileSync(at('EXECUTION-RESULT.json'), JSON.stringify({ result: { status: 'full_book_diagnostic', narration: { status: 'narrated' }, readerPreview: { url: reader },
      accounting: { api: { cumulativeAccountedMicroUsd: 5_600_000 }, claudeMax: { accountedMicroUsd: 230_000 } } } }));
    expect(readMomentumBookStatus(config, r.requestId)).toMatchObject({ phase: 'ready', readerUrl: reader, narration: 'narrated',
      accounting: { apiCumulativeMicroUsd: 5_600_000, claudeMaxMicroUsd: 230_000 } });
    writeFileSync(at('EXECUTION-RESULT.json'), JSON.stringify({ result: { status: 'held_storyboard' } }));
    expect(readMomentumBookStatus(config, r.requestId)).toMatchObject({ phase: 'held', readerUrl: null });
    expect(code(() => readMomentumBookStatus(config, 'c'.repeat(64)))).toBe('momentum_owner');
  });
});
