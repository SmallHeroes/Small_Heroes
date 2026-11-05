import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { NextRequest } from 'next/server';
import { canonicalHash } from '@/lib/canonical-json';
import { frames, manifest } from './fixtures';
import { engineTestDb } from './engine-test-db';
import { startEnginePersonalJob } from '../personal-jobs';
import { parseEngineCheckpoint, runEngineDurableInvocation, type EngineRuntime } from '../durable-worker';
import { type EngineSpendPolicy, engineRecipeSteps } from '../platform-policy';
import { assetBytesSha256, loadEnginePrivateAsset, persistEnginePrivateAsset } from '../private-assets';
import { createEngineMaterializer, validateEngineMaterializedBook, verifyEngineBookAsset } from '../materialize';
import { decodeEngineAudio, prepareEngineNarration } from '../narration';
import { prepareNarrationWire, narrationVoice } from '@/scripts/personal-book-narration';
import { buildEngineBookPdf } from '../book-pdf';
import { engineOperatorIds, loadEngineReaderBook } from '../reader';
import { handleEngineBookRead, handleEngineBookStatus, type EngineReaderPorts } from '../reader-http';
import { type EnginePrivateStorage } from '../private-storage';
const out = resolve('_review/engine-site-launch/m10-reader-materialization/synthetic-tmp');
const policy: EngineSpendPolicy = { version: 'engine-site-spend-policy/v1', sourceRevision: 'a'.repeat(40), maximumMicroUsd: 10_000_000,
  maximumCalls: 200, approvalReference: 'SYNTHETIC_TEST_ONLY', approvedBy: 'synthetic_test', approvedAt: '2026-11-04T00:00:00.000Z', paidProviderActivation: 'owner_approved_live_personal_orders' };
let image: Buffer, audio: Buffer;
beforeAll(async () => {
  mkdirSync(out, { recursive: true }); writeFileSync(resolve(out, '.gitignore'), '*\n');
  image = await sharp(Buffer.from('<svg width="1024" height="1536"><rect width="1024" height="1536" fill="#397a81"/><circle cx="512" cy="740" r="240" fill="#edc173"/><rect x="48" y="48" width="928" height="1440" fill="none" stroke="#fff" stroke-width="12"/></svg>')).png().toBuffer();
  const load = createRequire(resolve('package.json')), ffmpeg = load('@ffmpeg-installer/ffmpeg').path;
  const file = resolve(out, 'synthetic-tone.mp3');
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1.2', '-b:a', '96k', file], { windowsHide: true });
  audio = readFileSync(file);
});
const stores: Awaited<ReturnType<typeof engineTestDb>>[] = [];
afterEach(async () => { vi.restoreAllMocks(); for (const s of stores.splice(0)) await s.pg.close(); });
async function setup() {
  const s = await engineTestDb(); stores.push(s); const objects = new Map<string, Buffer>();
  const storage: EnginePrivateStorage = { put: async (key, bytes) => { objects.set(key, Buffer.from(bytes)); }, read: async key => objects.get(key)!, sign: async () => { throw Error('no_signed_public_assets'); } };
  await startEnginePersonalJob(s.db, 'synthetic_order', policy);
  const snapshot = s.prepared.snapshot, title = 'הַסֵּפֶר שֶׁל סינתטי 123', text = 'סינתטי הביט סביבו. הוא שמע צליל קטן, לקח נשימה והמשיך ללכת בדרך. איזה יום יפה!';
  const pages = frames(manifest()).map((f, n) => ({ pageNumber: n, contextSha: canonicalHash(n), status: 'qa_supported', attempts: [],
    chosen: { ...f.attempt, attempt: 0, status: 'qa_supported', review: {}, candidate: { imageName: `page_${n}_0.png`, imageSha: assetBytesSha256(image) } } }));
  const invoke = (recipe: (r: EngineRuntime) => Promise<void>) => runEngineDurableInvocation(s.db, 'synthetic_order', { executor: 'chunk', storage, recipe, assertAdmission: async () => {} });
  const seed = async (r: EngineRuntime) => {
    for (let n = 0; n < 9; n++) {
      const step = `page_${n}_0`, wire = { synthetic: true, n };
      await r.call({ wire, call: { step, wireSha256: canonicalHash(wire), maximumMicroUsd: engineRecipeSteps().find(s => s.id === step)!.maximumMicroUsd }, requiredMs: 1000,
        execute: async () => ({ kind: 'completed', result: { output: { b64: image.toString('base64'), imageSha: assetBytesSha256(image) }, raw: { synthetic: true }, estimatedMicroUsd: 0 } }) });
    }
    await r.save('prepared_source', { source: { manuscript: { title, pages: Array.from({ length: 8 }, () => ({ text })) } }, sourceDigest: canonicalHash('source'), storyboardDigest: canonicalHash('storyboard') });
    await r.save('native_book', { pages }); await r.advance('materialize');
  };
  for (let n = 0; n < 9; n++) expect((await invoke(seed)).kind).toBe('progress');
  const fetchTts = vi.fn(async (_url: unknown, init: any) => {
    const body = JSON.parse(init.body); return new Response(new Uint8Array(audio), { headers: { 'content-type': 'audio/mpeg', 'request-id': 'synthetic-tts', 'character-cost': String(body.text.length) } });
  });
  const materialize = createEngineMaterializer({ db: s.db, storage, snapshot, narration: { fetch: fetchTts as typeof fetch, key: () => 'SYNTHETIC_NOT_A_KEY' } });
  const finish = async () => { for (let n = 0; n < 9; n++) expect((await invoke(materialize)).kind).toBe('progress'); return loadEngineReaderBook(s.db, storage, 'synthetic_order'); };
  const ports: EngineReaderPorts = { db: s.db, storage: () => storage, enabled: true, proxyBytes: true, parent: async () => ({ id: s.parent.id }) };
  return { ...s, storage, objects, pages, materialize, invoke, finish, fetchTts, ports, title, text };
}
describe('private nine-scene book/narration/PDF materialization (synthetic providers only)', () => {
  it('R2-11 persists and settles billed audio before a free decode outage, then retries decode without repurchasing that page',async()=>{
    const s=await setup(),probe=vi.fn().mockRejectedValueOnce(Object.assign(Error('synthetic_missing_decoder'),{code:'ENOENT'})).mockResolvedValue(1.2);
    const retryable=createEngineMaterializer({db:s.db,storage:s.storage,snapshot:s.prepared.snapshot,
      narration:{key:()=> 'SYNTHETIC',fetch:s.fetchTts as typeof fetch,probe}});
    expect(await s.invoke(retryable)).toMatchObject({kind:'held',terminalWritten:false});
    const c=parseEngineCheckpoint((await s.db.generationJob.findUnique({where:{orderId:'synthetic_order'}}))!.pipelineCache);
    expect(c.phase).toBe('materialize');expect(c.calls.narration_0.settled).toBe(true);
    const receipt=(await s.db.atomicOperationReceipt.findMany({where:{kind:'engine_site_call_result_v1'}})).find(r=>(r.result as any)?.value.step==='narration_0')!;
    expect((receipt.result as any).value).toMatchObject({completed:true,estimatedMicroUsd:s.title.length*100});
    const asset=await loadEnginePrivateAsset(s.db,(receipt.result as any).value.privateResultAssetId);
    const saved=JSON.parse((await s.storage.read(asset.key)).toString('utf8'));expect(saved.result.output.b64).toBe(audio.toString('base64'));
    vi.spyOn(Date,'now').mockReturnValue(Date.now()+180_000);
    await s.invoke(retryable);
    expect(s.fetchTts.mock.calls.filter(([,init])=>JSON.parse(init.body).text===s.title)).toHaveLength(1);
    const after=parseEngineCheckpoint((await s.db.generationJob.findUnique({where:{orderId:'synthetic_order'}}))!.pipelineCache);
    expect(after.outputs.reader_audio_verified_0).toBeDefined();
  },120_000);
  it('materializes exact bytes once across actual durable invocations and serves only published final assets', async () => {
    const s = await setup(), c = await s.finish();
    expect(c.checkpoint.phase).toBe('accept'); expect(s.fetchTts).toHaveBeenCalledTimes(9);
    expect(c.book.pages).toHaveLength(9); expect(c.book.pages[0].text).toBe(s.title);
    expect(c.book.manifest.pdfSha256).toBe(c.book.pdf.sha256);
    expect(c.book.pages.every(p => p.image.sha256 === assetBytesSha256(image) && p.audio.sha256 === assetBytesSha256(audio))).toBe(true);
    const replaced = structuredClone(c.book); replaced.pages[2].text += ' שינוי';
    expect(() => validateEngineMaterializedBook(c, replaced)).toThrow('engine_reader_manifest_changed');
    const exactText = structuredClone(c.book); exactText.pages[1].text = 'café';
    exactText.manifest.pages[1].textSha256 = assetBytesSha256(Buffer.from(exactText.pages[1].text, 'utf8'));
    expect(validateEngineMaterializedBook(c, exactText).pages[1].text).toBe('café');
    exactText.pages[1].text = exactText.pages[1].text.normalize('NFD');
    expect(() => validateEngineMaterializedBook(c, exactText)).toThrow('engine_reader_manifest_changed');
    const pdf = await verifyEngineBookAsset(s.db, s.storage, c, c.book.pdf, 'pdf');
    const parsed = await PDFDocument.load(pdf); expect(parsed.getPageCount()).toBe(9);
    expect(parsed.getPages().map(p => p.getSize())).toEqual([{ width: 480, height: 720 }, ...Array.from({ length: 8 }, () => ({ width: 960, height: 720 }))]);
    writeFileSync(resolve(out, 'synthetic-nine-page-book.pdf'), pdf);
    await s.invoke(s.materialize); expect(s.fetchTts).toHaveBeenCalledTimes(9);
    const req = (path = '', extra: Record<string, string> = {}) => new NextRequest(`http://localhost/api/engine-site/v1/books/synthetic_order${path}`, { headers: extra });
    expect((await handleEngineBookRead(req(), 'synthetic_order', s.ports)).status).toBe(404);
    const published = { ...s.ports, familyReady: async () => true };
    const response = await handleEngineBookRead(req(), 'synthetic_order', published), payload = await response.json();
    expect(payload.book.pages).toHaveLength(9); expect(payload.book.pages[0].audioUrl).toContain('/assets/');
    // A random opaque UUID may contain the hex substring b64. Check forbidden fields, not arbitrary id fragments.
    expect(JSON.stringify(payload)).not.toMatch(/"(?:b64|candidate|receipt|bucket)"\s*:|request-id|synthetic-tts/);
    const partial = await handleEngineBookRead(req('', { range: 'bytes=10-29' }), 'synthetic_order', published, c.book.pages[0].audio.assetId);
    expect(partial.status).toBe(206); expect(Buffer.from(await partial.arrayBuffer())).toEqual(audio.subarray(10, 30));
    expect((await handleEngineBookRead(req('', { range: 'bytes=99999999-' }), 'synthetic_order', published, c.book.pages[0].audio.assetId)).status).toBe(416);
    const photo = await persistEnginePrivateAsset(s.db, s.storage, { ownerId: s.parent.id, draftId: c.checkpoint.draftId, orderId: 'synthetic_order', kind: 'child_photo', contentType: 'image/png' }, image);
    expect((await handleEngineBookRead(req(), 'synthetic_order', published, photo.assetId)).status).toBe(404);
    expect((await handleEngineBookRead(req(), 'synthetic_order', { ...published, parent: async () => ({ id: 'another_parent' }) })).status).toBe(404);
    expect((await handleEngineBookRead(req('?preview=1'), 'synthetic_order', s.ports)).status).toBe(404);
    expect((await handleEngineBookRead(req('?preview=1'), 'synthetic_order', { ...s.ports, operatorIds: [s.parent.id] })).status).toBe(200);
    const sign = vi.fn(async () => 'https://private.example.invalid/signed/synthetic?ttl=60');
    const direct = await handleEngineBookRead(req(), 'synthetic_order', { ...published, proxyBytes: false, storage: () => ({ ...s.storage, sign }) }, c.book.pdf.assetId);
    expect(direct.status).toBe(307); expect(sign).toHaveBeenCalledTimes(1); expect(direct.headers.get('cache-control')).toContain('no-store');
    const status = await handleEngineBookStatus(req(), 'synthetic_order', s.ports); expect(await status.json()).toMatchObject({ status: 'preparing', readerUrl: null, pdfUrl: null });
    s.objects.set((await loadEnginePrivateAsset(s.db, c.book.pages[0].image.assetId)).key, Buffer.from('changed'));
    expect((await handleEngineBookRead(req(), 'synthetic_order', published, c.book.pages[0].image.assetId)).status).toBe(404);
  }, 120_000);
  it('charges known unusable audio once, retains the hold, and never continues with missing narration', async () => {
    const s = await setup();
    const fail = createEngineMaterializer({ db: s.db, storage: s.storage, snapshot: s.prepared.snapshot,
      narration: { key: () => 'SYNTHETIC', fetch: vi.fn(async (_url, init) => new Response(new Uint8Array(Buffer.alloc(1200)), { headers: {
        'content-type': 'audio/mpeg', 'request-id': 'synthetic-broken', 'character-cost': String(JSON.parse(init!.body as string).text.length) } })) as typeof fetch } });
    expect(await s.invoke(fail)).toMatchObject({ kind: 'held' });
    const checkpoint = parseEngineCheckpoint((await s.db.generationJob.findUnique({ where: { orderId: 'synthetic_order' } }))!.pipelineCache);
    expect(checkpoint.outputs.materialized_book).toBeUndefined(); expect(checkpoint.phase).toBe('held');
    const recorded = (await s.pg.query<any>('SELECT result FROM "AtomicOperationReceipt" WHERE kind=$1', ['engine_site_call_result_v1'])).rows;
    expect(recorded.find(r => r.result.value.step === 'narration_0').result.value).toMatchObject({ completed: true, estimatedMicroUsd: s.title.length * 100 });
  }, 120_000);
  it('preserves Hebrew and rejects text overflow, incomplete coverage, wrong image format and manifest substitution', async () => {
    const pages = Array.from({ length: 9 }, (_, pageNumber) => ({ pageNumber, text: pageNumber ? 'לילה טוב 123. שָׁלוֹם!' : 'הסיפור שלי', image }));
    expect((await PDFDocument.load(await buildEngineBookPdf(pages[0].text, pages))).getPageCount()).toBe(9);
    await expect(buildEngineBookPdf(pages[0].text, pages.slice(1))).rejects.toThrow('engine_pdf_coverage');
    await expect(buildEngineBookPdf(pages[0].text, pages.map((p, n) => n === 2 ? { ...p, text: 'שלום '.repeat(900) } : p))).rejects.toThrow('engine_pdf_text_overflow');
    await expect(buildEngineBookPdf(pages[0].text, pages.map((p, n) => n === 1 ? { ...p, image: Buffer.from('bad') } : p))).rejects.toThrow();
    expect(engineOperatorIds({ ENGINE_SITE_OPERATOR_USER_IDS: '["synthetic"]' })).toEqual(['synthetic']);
    expect(engineOperatorIds({ ENGINE_SITE_OPERATOR_USER_IDS: '[null]' })).toEqual([]);
  }, 30_000);
  it('decodes actual MP3 and holds unknown usage or wrong voice/wire before dispatch', async () => {
    expect(await decodeEngineAudio(audio)).toBeGreaterThan(1);
    const s = await setup(), c = parseEngineCheckpoint((await s.db.generationJob.findUnique({ where: { orderId: 'synthetic_order' } }))!.pipelineCache);
    const wire = prepareNarrationWire(0, s.title, narrationVoice('mom', ['mom'])), network = vi.fn();
    const plan = prepareEngineNarration(c.authority, wire, { key: () => { throw Error('no_key'); }, fetch: network });
    await expect(plan.execute(undefined, new AbortController().signal, async () => { throw Error('fence_lost'); })).rejects.toThrow('fence_lost');
    expect(network).not.toHaveBeenCalled();
    const unknown = prepareEngineNarration(c.authority, wire, { key: () => 'SYNTHETIC', fetch: vi.fn(async () => new Response(new Uint8Array(audio), { headers: { 'content-type': 'audio/mpeg' } })) as typeof fetch });
    expect(await unknown.execute(undefined, new AbortController().signal, async () => {})).toMatchObject({ kind: 'completed', result: { usable: false, estimatedMicroUsd: null } });
  }, 120_000);
});
