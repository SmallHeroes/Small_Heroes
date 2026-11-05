import {afterEach,describe,expect,it} from 'vitest';
import {engineTestDb} from './engine-test-db';
import {assertEnginePrivateDatabase} from '../private-assets';
import {readFileSync} from 'node:fs';
const stores:Awaited<ReturnType<typeof engineTestDb>>[]=[];
afterEach(async()=>{for(const s of stores.splice(0))await s.pg.close();});
describe('R3-8 whole-public-schema server-only privacy, actual local PostgreSQL',()=>{
 it.each(['AtomicOperationReceipt','ExceptionCase','DeliveryOutbox','BookReadiness','BookReadinessManifest','RefundAttempt'])('refuses anon access on %s outside the old nine-table list',async table=>{
  const s=await engineTestDb();stores.push(s);await s.pg.exec(`GRANT SELECT ON "${table}" TO anon`);
  await expect(assertEnginePrivateDatabase(s.db)).rejects.toThrow('engine_private_database_required');
 });
 it('refuses a newly added public table or view with authenticated/column/PUBLIC privileges and the prepared SQL removes them',async()=>{
  const s=await engineTestDb();stores.push(s);
  await s.pg.exec('CREATE TABLE public."FuturePrivate"(secret text); ALTER TABLE public."FuturePrivate" ENABLE ROW LEVEL SECURITY; GRANT SELECT(secret) ON "FuturePrivate" TO authenticated');
  await expect(assertEnginePrivateDatabase(s.db)).rejects.toThrow('engine_private_database_required');
  await s.pg.exec(readFileSync('_review/engine-site-launch/m17-r3-corrections/PRIVATE-DATABASE-SETUP.sql','utf8'));
  await expect(assertEnginePrivateDatabase(s.db)).resolves.toBeUndefined();
  await s.pg.exec('CREATE VIEW public."FutureView" AS SELECT secret FROM "FuturePrivate"; GRANT SELECT ON "FutureView" TO PUBLIC');
  await expect(assertEnginePrivateDatabase(s.db)).rejects.toThrow('engine_private_database_required');
 });
});
