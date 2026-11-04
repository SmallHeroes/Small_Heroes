import { afterEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ create: vi.fn(() => ({ storage: {} })) }));
vi.mock('@supabase/supabase-js', () => ({ createClient: m.create }));
import { productionEnginePrivateStorage } from '../private-storage';
import { assertEnginePrivateDatabase } from '../private-assets';
import { engineTestDb } from './engine-test-db';
import { readFileSync } from 'fs';
const stores: Awaited<ReturnType<typeof engineTestDb>>[] = [];
afterEach(async () => { for (const s of stores.splice(0)) await s.pg.close(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe('Q12/Q13 actual private storage factory and PostgreSQL privacy guard', () => {
  it('the prepared SQL removes actual table/column grants in offline PostgreSQL; both client roles are denied',async()=>{
    const s=await engineTestDb();stores.push(s);
    await s.pg.exec('GRANT SELECT ON "Order","GenerationJob" TO anon,authenticated; GRANT SELECT(data) ON "WizardSession" TO anon; GRANT TRUNCATE ON "WizardSession" TO authenticated');
    await expect(assertEnginePrivateDatabase(s.db)).rejects.toThrow('private_database_required');
    await s.pg.exec(readFileSync('_review/engine-site-launch/m13-qa-r1-fixes/PRIVATE-DATABASE-SETUP.sql','utf8'));
    await expect(assertEnginePrivateDatabase(s.db)).resolves.toBeUndefined();
    for(const role of ['anon','authenticated']) {
      await s.pg.exec(`SET ROLE ${role}`);
      try { await expect(s.pg.query('SELECT * FROM "Order"')).rejects.toThrow('permission denied');
        await expect(s.pg.query('SELECT data FROM "WizardSession"')).rejects.toThrow('permission denied');
      } finally { await s.pg.exec('RESET ROLE'); }
    }
  });
  it.each(['postgresql://postgres:SYNTHETIC_ONLY@db.aaaaaaaaaaaaaaaaaaaa.supabase.co:5432/postgres',
    'postgresql://postgres.aaaaaaaaaaaaaaaaaaaa:SYNTHETIC_ONLY@aws-0-test.pooler.supabase.com:6543/postgres'])(
    'Q12 accepts a matching direct/pooler project without a network request',url=>{
      vi.stubEnv('SUPABASE_URL','https://aaaaaaaaaaaaaaaaaaaa.supabase.co');vi.stubEnv('DATABASE_URL',url);vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','SYNTHETIC_ONLY');
      expect(()=>productionEnginePrivateStorage()).not.toThrow();expect(m.create).toHaveBeenCalledTimes(1);
    });
  it('Q12 refuses a policy database from another project before constructing Storage', () => {
    vi.stubEnv('SUPABASE_URL', 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'SYNTHETIC_ONLY');
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres:SYNTHETIC_ONLY@db.bbbbbbbbbbbbbbbbbbbb.supabase.co:5432/postgres');
    expect(() => productionEnginePrivateStorage()).toThrow('engine_private_project_mismatch'); expect(m.create).not.toHaveBeenCalled();
  });
  it.each(['Order', 'GenerationJob'])('Q13 refuses direct client access to child-bearing %s', async table => {
    const s = await engineTestDb(); stores.push(s); await s.pg.exec(`GRANT SELECT ON "${table}" TO anon`);
    await expect(assertEnginePrivateDatabase(s.db)).rejects.toThrow('engine_private_database_required');
  });
  it.each(['GRANT SELECT(data) ON "WizardSession" TO authenticated', 'GRANT TRUNCATE ON "WizardSession" TO anon'])(
    'P3 catches column and non-row table grants: %s', async grant => {
      const s = await engineTestDb(); stores.push(s); await s.pg.exec(grant);
      await expect(assertEnginePrivateDatabase(s.db)).rejects.toThrow('engine_private_database_required');
    });
});
