import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { createEnginePersonalOrder, engineOrderIntakeEnabled, prepareEngineOrder, resolveEngineWizardOptions } from '../personal-orders';
import { handleEngineOrderPost } from '../order-http';
import { engineSiteCheckoutPricing } from '../offer';
import { ENGINE_SITE_LAUNCH_OFFER } from '../offer-definition';
import { syntheticEngineOrderInput, syntheticEngineQaEnv, syntheticQaOrigin } from './synthetic-order';
import { assertEnginePrivateStoragePolicy } from '../private-assets';
import { ENGINE_QA_SESSION_ID } from '../qa-order-policy';

const parent = { id: 'synthetic_parent', email: 'parent@example.invalid', name: 'Synthetic Parent' };
const options = resolveEngineWizardOptions();

let pg: PGlite;
function adapter(tx: Transaction) {
  return {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) =>
      (await tx.query(strings.reduce((s, p, i) => s + (i ? `$${i}` : '') + p, ''), values)).rows,
    wizardSession: {
      upsert: async ({ create }: { create: { sessionId: string; data: unknown } }) => {
        await tx.query('INSERT INTO "WizardSession" (id,"sessionId",data) VALUES ($1,$2,$3) ON CONFLICT ("sessionId") DO NOTHING',
          [randomUUID(), create.sessionId, JSON.stringify(create.data)]);
        return (await tx.query('SELECT * FROM "WizardSession" WHERE "sessionId"=$1', [create.sessionId])).rows[0];
      },
      createMany: async ({ data, skipDuplicates }: { data: [{ sessionId: string; data: unknown }]; skipDuplicates: boolean }) => {
        if (!skipDuplicates) throw Error('expected_qa_atomic_insert');
        const [session] = data;
        await tx.query('INSERT INTO "WizardSession" (id,"sessionId",data) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [randomUUID(), session.sessionId, JSON.stringify(session.data)]);
      },
      findUniqueOrThrow: async ({ where }: { where: { sessionId: string } }) =>
        (await tx.query('SELECT * FROM "WizardSession" WHERE "sessionId"=$1', [where.sessionId])).rows[0],
    },
    order: {
      findUnique: async ({ where }: { where: { wizardSessionId: string } }) =>
        (await tx.query<{ data: object }>('SELECT data FROM "Order" WHERE "wizardSessionId"=$1', [where.wizardSessionId])).rows[0]?.data ?? null,
      create: async ({ data }: { data: { wizardSessionId: string } }) => {
        const row = { ...data, id: randomUUID() };
        await tx.query('INSERT INTO "Order" (id,"wizardSessionId",data) VALUES ($1,$2,$3)', [row.id, data.wizardSessionId, JSON.stringify(row)]);
        return row;
      },
    },
  };
}
const db = { $transaction: (work: (tx: ReturnType<typeof adapter>) => Promise<unknown>) => pg.transaction(tx => work(adapter(tx))) } as unknown as PrismaClient;
beforeAll(async () => {
  vi.stubGlobal('fetch', () => { throw Error('network_forbidden'); });
  pg = new PGlite(); await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE TABLE "WizardSession" (id text PRIMARY KEY,"sessionId" text UNIQUE,data jsonb); ALTER TABLE "WizardSession" ENABLE ROW LEVEL SECURITY; CREATE TABLE "Order" (id text PRIMARY KEY,"wizardSessionId" text UNIQUE REFERENCES "WizardSession"(id),data jsonb); ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY; CREATE TABLE "GenerationJob"(id text PRIMARY KEY); ALTER TABLE "GenerationJob" ENABLE ROW LEVEL SECURITY; CREATE SCHEMA storage; CREATE TABLE storage.objects (bucket_id text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY');
  for(const table of ['UserSession','OtpCode','UserAccount','Customer','PaymentRecord','PaymeWebhookEvent'])await pg.exec(`CREATE TABLE "${table}"(id text PRIMARY KEY);ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
});
beforeEach(async () => { await pg.exec('TRUNCATE "Order", "WizardSession"'); });
afterAll(async () => { await pg.close(); vi.unstubAllGlobals(); });
afterEach(() => vi.unstubAllEnvs());

describe('dedicated QA Wizard intake', () => {
  beforeEach(() => {
    for (const [name, value] of Object.entries(syntheticEngineQaEnv())) vi.stubEnv(name, value);
  });

  it('commits one singleton through the HTTP handler and replays only the identical draft', async () => {
    const send = (input: unknown, actor = parent) => handleEngineOrderPost(new NextRequest(syntheticQaOrigin + '/api/engine-site/v1/orders', {
      method: 'POST', headers: { origin: syntheticQaOrigin, 'content-type': 'application/json' }, body: JSON.stringify(input),
    }), { enabled: true, parent: async () => actor, create: (value, owner) => createEnginePersonalOrder(db, value, owner, options) });
    const input = { ...syntheticEngineOrderInput('dad_v2'), fictionalQa: true };
    const secondDraft = { ...syntheticEngineOrderInput('dad_v2', 'd_synthetic0002'), fictionalQa: true };
    expect((await send(input, { ...parent, id: 'other_parent' })).status).toBe(403);
    const responses = await Promise.all([send(input), send(secondDraft)]);
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    const winner = responses.findIndex(response => response.status === 201);
    const saved = await responses[winner].json();
    const replay = await send(winner === 0 ? input : secondDraft);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ orderId: saved.orderId, replay: true });
    expect((await pg.query('SELECT "sessionId" FROM "WizardSession"')).rows).toEqual([{ sessionId: ENGINE_QA_SESSION_ID }]);
    expect((await pg.query('SELECT id FROM "Order"')).rows).toEqual([{ id: saved.orderId }]);
  });

  it('refuses missing declaration, wrong voice and photo intake before any write', async () => {
    const dad = syntheticEngineOrderInput('dad_v2');
    const invalid = [dad, { ...syntheticEngineOrderInput(), fictionalQa: true },
      { ...dad, fictionalQa: true, appearance: { kind: 'private_photo', assetId: randomUUID() } }];
    for (const input of invalid)
      await expect(createEnginePersonalOrder(db, input, parent, options)).rejects.toThrow('fictional_description_and_dad_required');
    expect((await pg.query('SELECT id FROM "WizardSession"')).rows).toEqual([]);
  });

  it.each([{ VERCEL_ENV: 'production' }, { PAYME_API_BASE_URL: 'https://live.example.invalid/api' },
    { PAYME_CHECKOUT_PAGE_ORIGIN: 'https://sandbox.payme.io.attacker.invalid' },
    { NEXT_PUBLIC_APP_URL: 'https://different.example.invalid' }, { PAYME_WEBHOOK_ALLOW_IP_FALLBACK: 'true' },
    { DATABASE_URL: 'postgresql://synthetic@db.abcdefghijklmnopqrst.supabase.co/postgres?host=other.example.invalid' },
    { SUPABASE_URL: 'https://different.example.invalid' },
    { ENGINE_SITE_QA_SUPABASE_REF: 'yevwpjxqusyyaxalbvyn', SUPABASE_URL: 'https://yevwpjxqusyyaxalbvyn.supabase.co',
      DATABASE_URL: 'postgresql://synthetic@db.yevwpjxqusyyaxalbvyn.supabase.co/postgres' }])(
    'keeps staging intake off with mismatched configuration %j', change => {
      expect(engineOrderIntakeEnabled({ ...syntheticEngineQaEnv(), ENGINE_SITE_ORDER_INTAKE_ENABLED: 'true' })).toBe(true);
      expect(engineOrderIntakeEnabled({ ...syntheticEngineQaEnv(), ENGINE_SITE_ORDER_INTAKE_ENABLED: 'true', ...change })).toBe(false);
    });
});

describe('personal order: reviewed wizard -> immutable owner-scoped Order', () => {
  it('binds the verified private photo bytes, so even a changed server asset record cannot replay the order', async () => {
    const input = { ...syntheticEngineOrderInput(), appearance: { kind: 'private_photo', assetId: randomUUID() } };
    const proof = vi.fn(async () => ({ sha256: 'a'.repeat(64), bytes: 100 }));
    const first = await createEnginePersonalOrder(db, input, parent, options, proof);
    expect((await createEnginePersonalOrder(db, input, parent, options, proof)).orderId).toBe(first.orderId);
    proof.mockResolvedValueOnce({ sha256: 'b'.repeat(64), bytes: 100 });
    await expect(createEnginePersonalOrder(db, input, parent, options, proof)).rejects.toThrow('draft_already_bound');
    expect((await pg.query<{ data: any }>('SELECT data FROM "WizardSession"')).rows[0].data.photoBytes)
      .toEqual({ sha256: 'a'.repeat(64), bytes: 100 });
  });
  it('requires the exact restrictive storage policy even when a broad permissive policy exists', async () => {
    const txDb = adapter({ query: (sql: string, values: unknown[]) => pg.query(sql, values) } as Transaction) as any;
    await expect(assertEnginePrivateStoragePolicy(txDb)).rejects.toThrow('storage_policy_required');
    await pg.exec("CREATE POLICY broad_read ON storage.objects FOR SELECT TO anon, authenticated USING (true); CREATE POLICY engine_site_private_server_only ON storage.objects AS RESTRICTIVE FOR ALL TO anon, authenticated USING (bucket_id <> 'engine-site-private') WITH CHECK (bucket_id <> 'engine-site-private')");
    try { await expect(assertEnginePrivateStoragePolicy(txDb)).resolves.toBeUndefined(); }
    finally { await pg.exec('DROP POLICY engine_site_private_server_only ON storage.objects; DROP POLICY broad_read ON storage.objects'); }
  });
  it('fails closed before child persistence if the Data API roles can access snapshots', async () => {
    await pg.exec('GRANT SELECT ON "WizardSession" TO anon');
    try { await expect(createEnginePersonalOrder(db, syntheticEngineOrderInput(), parent, options)).rejects.toThrow('private_database_required'); }
    finally { await pg.exec('REVOKE SELECT ON "WizardSession" FROM anon'); }
    expect((await pg.query('SELECT * FROM "Order"')).rows).toHaveLength(0);
  });
  it('persists one order, replays identical input and is accepted by the real checkout offer boundary', async () => {
    const first = await createEnginePersonalOrder(db, syntheticEngineOrderInput(), parent, options);
    const second = await createEnginePersonalOrder(db, syntheticEngineOrderInput(), parent, options);
    expect(second).toEqual({ ...first, replay: true });
    const row = (await pg.query<{ data: any }>('SELECT data FROM "Order"')).rows[0].data;
    expect(row).toMatchObject({ userId: parent.id, customerEmail: parent.email, frozenProductVersion: 'engine-site/v1',
      selectionFilename: null, childImageUrl: null, storySourceHash: first.inputSha256,
      basePrice: ENGINE_SITE_LAUNCH_OFFER.priceAgorot, expectedPageCount: 8, audioEnabled: true, pdfEnabled: true });
    expect(engineSiteCheckoutPricing(row)?.totalPrice).toBe(ENGINE_SITE_LAUNCH_OFFER.priceAgorot / 100);
    const snapshot = (await pg.query<{ data: any }>('SELECT data FROM "WizardSession"')).rows[0].data;
    expect(snapshot).toMatchObject({ ownerId: parent.id, imageQuality: 'low', offer: ENGINE_SITE_LAUNCH_OFFER,
      request: syntheticEngineOrderInput().request, appearance: syntheticEngineOrderInput().appearance });
  });
  it('refuses changed input after binding and separates owners using the same draft id', async () => {
    const input = syntheticEngineOrderInput(); await createEnginePersonalOrder(db, input, parent, options);
    await expect(createEnginePersonalOrder(db, { ...input, appearance: { ...input.appearance, description: 'שיער ארוך ועיניים ירוקות' } }, parent, options)).rejects.toThrow('draft_already_bound');
    const other = await createEnginePersonalOrder(db, input, { ...parent, id: 'other_parent' }, options);
    expect(other.replay).toBe(false);
    expect((await pg.query('SELECT * FROM "Order"')).rows).toHaveLength(2);
  });
  it('rejects injected authority, fixture origins, missing voice, unsupported length, stale options and unsent photos', async () => {
    const valid = syntheticEngineOrderInput();
    for (const input of [
      { ...valid, priceAgorot: 1 }, { ...valid, imageQuality: 'medium' },
      { ...valid, optionsFingerprint: '0'.repeat(64) },
      { ...valid, request: { ...valid.request, child: { ...valid.request.child, nameSource: 'fixture' } } },
      { ...valid, request: { ...valid.request, bookOptions: { lengthId: 'short', voiceId: null } } },
      { ...valid, request: { ...valid.request, bookOptions: { ...valid.request.bookOptions, lengthId: 'medium' } } },
      { ...valid, request: { ...valid.request, appearance: { photo: 'local_preview_not_sent' } } },
    ]) expect(() => prepareEngineOrder(input, parent, options)).toThrow();
    await expect(createEnginePersonalOrder(db, { ...valid, appearance: { kind: 'private_photo', assetId: randomUUID() } }, parent, options)).rejects.toThrow('private_photo_unavailable');
    expect((await pg.query('SELECT * FROM "Order"')).rows).toHaveLength(0);
  });
});
describe('personal order HTTP boundary', () => {
  const request = (body: unknown = syntheticEngineOrderInput(), origin = 'https://synthetic.invalid') => new NextRequest('https://synthetic.invalid/api/engine-site/v1/orders', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  it('defaults off and rejects origin/auth before reading or persisting a body', async () => {
    expect(engineOrderIntakeEnabled({})).toBe(false);
    const create = vi.fn(); const auth = vi.fn(async () => parent);
    expect((await handleEngineOrderPost(request(), { enabled: false, parent: auth, create })).status).toBe(404);
    expect((await handleEngineOrderPost(request({}, 'https://foreign.invalid'), { enabled: true, parent: auth, create })).status).toBe(403);
    expect((await handleEngineOrderPost(request(), { enabled: true, parent: async () => null, create })).status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });
  it('uses the production creator, returns 201 then 200, and rejects an oversized stream', async () => {
    const ports = { enabled: true, parent: async () => parent,
      create: (input: unknown) => createEnginePersonalOrder(db, input, parent, options) };
    expect((await handleEngineOrderPost(request(), ports)).status).toBe(201);
    expect((await handleEngineOrderPost(request(), ports)).status).toBe(200);
    expect((await handleEngineOrderPost(request({ oversized: 'x'.repeat(40_000) }), ports)).status).toBe(422);
    expect((await handleEngineOrderPost(request({ ...syntheticEngineOrderInput(), optionsFingerprint: '0'.repeat(64) }), ports)).status).toBe(409);
  });
});
