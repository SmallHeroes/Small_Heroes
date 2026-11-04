/** Synthetic PostgreSQL adapter for actual production SQL/receipt/lease paths. No network, Prisma client constructor or keys. */
import { PGlite, type Transaction } from '@electric-sql/pglite';
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { canonicalHash } from '@/lib/canonical-json';
import { prepareEngineOrder, resolveEngineWizardOptions } from '../personal-orders';
import { syntheticEngineOrderInput } from './synthetic-order';

export async function engineTestDb() {
  const pg = new PGlite();
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE "WizardSession"(id text PRIMARY KEY,"sessionId" text UNIQUE,data jsonb);
    ALTER TABLE "WizardSession" ENABLE ROW LEVEL SECURITY;
    CREATE SCHEMA storage; CREATE TABLE storage.objects(bucket_id text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY engine_site_private_server_only ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated
      USING(bucket_id <> 'engine-site-private') WITH CHECK(bucket_id <> 'engine-site-private');
    CREATE TABLE "Order"(id text PRIMARY KEY,status text NOT NULL DEFAULT 'paid',"paymentProvider" text DEFAULT 'payme',
      "paymeTransactionId" text DEFAULT 'synthetic_transaction',"deliveryHoldReason" text,"manualReviewRequired" boolean DEFAULT false,
      "selectionFilename" text,"visualPackageAuthority" jsonb,"frozenProductVersion" text DEFAULT 'engine-site/v1',
      "lastError" text,"wizardSessionId" text,data jsonb,"deliveryFenceVersion" int DEFAULT 0,"inputVersion" int DEFAULT 0);
    ALTER TABLE "Order" ADD COLUMN "fulfillmentVersion" int DEFAULT 1;
    CREATE TABLE "GenerationJob"(id text DEFAULT 'synthetic_job',"orderId" text PRIMARY KEY REFERENCES "Order"(id),status text DEFAULT 'pending',
      "currentStage" text DEFAULT 'engine_site_story',"pipelineCache" jsonb,"lockedBy" text,"leaseExpiresAt" timestamptz,
      "startedAt" timestamptz,"completedAt" timestamptz,"failedAt" timestamptz,"lastError" text,"retryable" boolean DEFAULT false,
      "generationVersion" int,"quality" text,"provider" text,"model" text,"textDone" boolean DEFAULT false,"imagesDone" boolean DEFAULT false,
      "audioDone" boolean DEFAULT false,"packaged" boolean DEFAULT false);
    CREATE TABLE "AtomicOperationReceipt"(id text PRIMARY KEY,"operationKey" text UNIQUE,"orderId" text REFERENCES "Order"(id),
      kind text,"payloadHash" text,result jsonb,"createdAt" timestamptz);
    CREATE TABLE "BookReadinessManifest"(id text PRIMARY KEY,"orderId" text,scope text,revision int,status text,"inputsHash" text,"inputVersion" int,evidence jsonb,reason text,"createdAt" timestamptz DEFAULT now(), UNIQUE("orderId",scope,revision));
    CREATE TABLE "BookReadiness"(id text PRIMARY KEY,"orderId" text,scope text,status text,"currentManifestId" text,reason text, UNIQUE("orderId",scope));
    CREATE TABLE "DeliveryOutbox"(id text PRIMARY KEY,"dedupeKey" text UNIQUE,"orderId" text,scope text,status text,payload jsonb,"payloadHash" text,"manifestId" text,
      "inputVersion" int,"deliveryFenceVersion" int DEFAULT 0,attempts int DEFAULT 0,"sendAttempts" int DEFAULT 0,"nextAttemptAt" timestamptz,"leaseExpiresAt" timestamptz,
      "lastError" text,"failureClass" text,"sendAttempted" boolean DEFAULT false,"firstSendAttemptAt" timestamptz,"providerMessageId" text,"createdAt" timestamptz DEFAULT now(),"sentAt" timestamptz);
    CREATE TABLE "ExceptionCase"(id text PRIMARY KEY,"activeKey" text UNIQUE,"orderId" text,scope text,kind text,status text,reason text,attempts int DEFAULT 0,
      "nextActionAt" timestamptz,resolution jsonb,"sourceRef" text,"claimVersion" int DEFAULT 0,"leaseExpiresAt" timestamptz,"lastError" text,"refundKey" text UNIQUE,
      "providerActionId" text,"actionAttemptedAt" timestamptz,"notificationAttemptedAt" timestamptz,"notificationMessageId" text,"createdAt" timestamptz DEFAULT now(),"updatedAt" timestamptz DEFAULT now());
    CREATE TABLE "ExceptionCaseAudit"(id text PRIMARY KEY,"eventKey" text UNIQUE,"caseId" text,"fromStatus" text,"toStatus" text,actor text,reason text,metadata jsonb,"createdAt" timestamptz DEFAULT now());
    CREATE TABLE "RefundAttempt"(id text PRIMARY KEY,"refundKey" text UNIQUE,provider text,"providerSaleId" text,status text,"providerActionId" text,"createdAt" timestamptz DEFAULT now(),"updatedAt" timestamptz DEFAULT now());
  `);
  const jsonColumns = new Set(['data', 'pipelineCache', 'visualPackageAuthority', 'result', 'evidence', 'payload', 'resolution', 'metadata']);
  function adapter(q: Pick<Transaction, 'query'>) {
    const one = async (sql: string, values: unknown[]) => (await q.query<any>(sql, values)).rows[0] ?? null;
    const params = () => { const values: unknown[] = []; return { values, param: (v: unknown) => { values.push(v); return `$${values.length}`; } }; };
    function whereSql(where: Record<string, any> = {}, param: (v: unknown) => string): string {
      return Object.entries(where).filter(([, v]) => v !== undefined).map(([key, value]) => {
        if (key === 'orderId_scope') return whereSql(value, param);
        if (key === 'AND' || key === 'OR') return `(${(Array.isArray(value) ? value : [value]).map(v => whereSql(v, param)).join(` ${key} `)})`;
        if (key === 'NOT') return `NOT (${whereSql(value, param)})`;
        if (value === null) return `"${key}" IS NULL`;
        if (value && typeof value === 'object' && !(value instanceof Date)) {
          if ('in' in value) return `"${key}"=ANY(${param(value.in)}::text[])`;
          if ('notIn' in value) return `NOT("${key}"=ANY(${param(value.notIn)}::text[]))`;
          for (const [op, sql] of [['lt','<'],['lte','<='],['gt','>'],['gte','>='],['not','<>'],['equals','=']])
            if (op in value) return value[op] === null ? `"${key}" IS NOT NULL` : `"${key}"${sql}${param(value[op])}`;
        }
        return `"${key}"=${param(value)}`;
      }).join(' AND ') || 'TRUE';
    }
    const encode = (key: string, value: any) => jsonColumns.has(key) ? (value === null || value?.constructor?.name === 'DbNull' ? null : JSON.stringify(value)) : value;
    function model(table: string) {
      const read = async ({ where, orderBy, take }: any = {}, first = false) => {
        const p = params(), suffix = orderBy ? ` ORDER BY ${Object.entries(orderBy).map(([k,v]) => `"${k}" ${v === 'desc' ? 'DESC' : 'ASC'}`).join(',')}` : '';
        const rows = (await q.query<any>(`SELECT * FROM "${table}" WHERE ${whereSql(where,p.param)}${suffix}${take || first ? ` LIMIT ${first ? 1 : Number(take)}` : ''}`,p.values)).rows;
        return first ? rows[0] ?? null : rows;
      };
      const create = async ({ data, skipDuplicates }: any) => {
        const row = { id: randomUUID(), ...data }, keys = Object.keys(row).filter(k => row[k] !== undefined), p = params();
        try { return (await q.query<any>(`INSERT INTO "${table}" (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${keys.map(k=>p.param(encode(k,row[k]))+(jsonColumns.has(k)?'::jsonb':'')).join(',')}) ${skipDuplicates?'ON CONFLICT DO NOTHING':''} RETURNING *`,p.values)).rows[0]; }
        catch (error) { if ((error as any).code === '23505') (error as any).code = 'P2002'; throw error; }
      };
      const update = async ({ where, data }: any, many = false) => {
        const p = params(), keys = Object.keys(data).filter(k=>data[k]!==undefined);
        if (!keys.length) return many ? { count: 0 } : read({where},true);
        const fields = keys.map(k => `"${k}"=`+(data[k] && typeof data[k] === 'object' && 'increment' in data[k] ? `"${k}"+${p.param(data[k].increment)}` : p.param(encode(k,data[k]))+(jsonColumns.has(k)?'::jsonb':'')));
        const rows = (await q.query<any>(`UPDATE "${table}" SET ${fields.join(',')} WHERE ${whereSql(where,p.param)} RETURNING *`,p.values)).rows;
        return many ? { count: rows.length } : rows[0];
      };
      return { findUnique: (a: any) => read(a,true), findFirst: (a: any) => read(a,true), findMany: (a: any) => read(a), create,
        update: (a: any) => update(a), updateMany: (a: any) => update(a,true),
        upsert: async (a: any) => await read({where:a.where},true) ? update({where:a.where,data:a.update}) : create({data:a.create}),
        createMany: async (a: any) => { let count=0; for(const data of a.data) if(await create({data,skipDuplicates:a.skipDuplicates})) count++; return {count}; } };
    }
    const order = model('Order');
    return {
      $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) =>
        (await q.query(strings.reduce((s, part, i) => s + (i ? `$${i}` : '') + part, ''), values)).rows,
      $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) =>
        (await q.query(strings.reduce((s,part,i)=>s+(i?`$${i}`:'')+part,''),values)).affectedRows ?? 0,
      wizardSession: model('WizardSession'), bookReadiness: model('BookReadiness'), bookReadinessManifest: model('BookReadinessManifest'),
      deliveryOutbox: model('DeliveryOutbox'), exceptionCase: model('ExceptionCase'), exceptionCaseAudit: model('ExceptionCaseAudit'), refundAttempt: model('RefundAttempt'),
      order: {
        ...order,
        findUnique: async ({ where, include }: any) => {
          const row = await one('SELECT * FROM "Order" WHERE id=$1', [where.id]);
          if (!row) return null;
          return { ...row.data, ...row, ...(include?.wizardSession ? { wizardSession: await one('SELECT * FROM "WizardSession" WHERE id=$1', [row.wizardSessionId]) } : {}) };
        },
      },
      generationJob: model('GenerationJob'), atomicOperationReceipt: model('AtomicOperationReceipt'),
    };
  }
  const db = { ...adapter(pg), $transaction: (work: any) => pg.transaction(tx => work(adapter(tx))) } as unknown as PrismaClient;
  const parent = { id: 'synthetic_parent', email: 'parent@example.invalid', name: 'Synthetic' };
  const prepared = prepareEngineOrder(syntheticEngineOrderInput(), parent, resolveEngineWizardOptions());
  await pg.query('INSERT INTO "WizardSession" VALUES ($1,$2,$3)', ['synthetic_session', prepared.sessionId, JSON.stringify({ ...prepared.snapshot, inputSha256: prepared.inputSha256 })]);
  const orderData = { userId: parent.id, storySourceHash: prepared.inputSha256, expectedPageCount: 8, storyLength: 'short',
    audioEnabled: true, pdfEnabled: true, videoEnabled: false, bundleEnabled: false, basePrice: 5900, addonsPrice: 0, totalPrice: 5900,
    couponCode: null, couponDiscountAgorot: null, customerEmail: parent.email, customerName: parent.name, childName: 'סינתטי' };
  await pg.query('INSERT INTO "Order"(id,"wizardSessionId",data) VALUES ($1,$2,$3)', ['synthetic_order', 'synthetic_session', JSON.stringify(orderData)]);
  return { db, pg, prepared, parent, checksum: canonicalHash };
}
