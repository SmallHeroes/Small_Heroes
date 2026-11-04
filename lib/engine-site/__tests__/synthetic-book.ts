/** Entirely synthetic complete book boundary for SQL fulfillment tests. It makes local fake provider calls only. */
import { expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { canonicalHash } from '@/lib/canonical-json';
import { frames, manifest } from './fixtures';
import { engineTestDb } from './engine-test-db';
import { startEnginePersonalJob } from '../personal-jobs';
import { runEngineDurableInvocation, type EngineRuntime } from '../durable-worker';
import { type EngineSpendPolicy, engineRecipeSteps } from '../platform-policy';
import { assetBytesSha256 } from '../private-assets';
import { createEngineMaterializer } from '../materialize';
import { loadEngineReaderBook } from '../reader';
import type { EngineReaderPorts } from '../reader-http';
import type { EnginePrivateStorage } from '../private-storage';
const policy: EngineSpendPolicy = { version: 'engine-site-spend-policy/v1', sourceRevision: 'a'.repeat(40), maximumMicroUsd: 10_000_000,
  maximumCalls: 200, approvalReference: 'SYNTHETIC_TEST_ONLY', approvedBy: 'synthetic_test', approvedAt: '2026-11-04T00:00:00.000Z', paidProviderActivation: 'owner_approved_live_personal_orders' };
export async function syntheticMaterializedEngineBook(image: Buffer, audio: Buffer) {
  const s = await engineTestDb(); const objects = new Map<string, Buffer>();
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
