import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { previewSha } from '../../local-story-preview';
import { canonicalJson } from '../request-acceptance';
import { AuditionMeter, type MeterRule } from '../../../scripts/personal-simple-book-reviewed-audition';
import { FRESH_BOOK_CYCLE, freshBookProfileSchema, freshBookProfileSha, claimFreshBook, assertFreshBookPaid, freshBookCycleLedger,
  assertLaterPagesAllowed, freshBookReadingOrder, assertFreshBookAdmission, type FreshBookProfile, type FreshBookGrant, type FreshBookEnv }
  from '../../../scripts/personal-fresh-book-authority';
import { REREVIEW_AMENDMENT, type RereviewConfig } from '../../../scripts/personal-child-anchor-rereview';

const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const profile: FreshBookProfile = freshBookProfileSchema.parse({ version: 'fresh-book-profile/v1', cycle: FRESH_BOOK_CYCLE.id,
  child: { name: 'Noa', age: 6, gender: 'girl', design: 'A fictional six-year-old girl with short wavy chestnut hair, light olive skin, hazel eyes and a small scar on her chin.',
    wardrobe: 'a teal raincoat, grey leggings and yellow boots', fictional: true },
  companion: { id: 'otter_pip', design: 'a small river otter with a cream chest patch and one notched ear' },
  parentInputs: { about: 'She is curious, a little afraid of deep water, and loves collecting smooth stones.', wish: 'to feel brave trying new things' },
  seed: 'fresh-book-test-seed', request: { kind: 'synthetic' }, routes: FRESH_BOOK_CYCLE.routes, childAnchor: 'child-anchor-inspection/v1' });
const roots: string[] = [];
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });
const setup = () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fresh-book-')); roots.push(root);
  const authority = path.join(root, 'authority'), ws = path.join(root, 'ws'); mkdirSync(authority); mkdirSync(ws);
  writeFileSync(path.join(ws, 'engine.ts'), 'export {}');
  let head = 'a'.repeat(40);
  const env: FreshBookEnv = { authorityRoot: authority, head: () => ({ head, branch: 'claude/book-render-20261009', clean: true }) };
  const grant: FreshBookGrant = { version: 'fresh-book-grant/v1', cycle: FRESH_BOOK_CYCLE.id, approval: FRESH_BOOK_CYCLE.approval, profileSha256: freshBookProfileSha(profile),
    engine: { head, branch: 'claude/book-render-20261009' }, pins: { 'engine.ts': sha('export {}') }, nativePlanSha256: 'b'.repeat(64), bookDir: path.join(root, 'book') };
  const grantFile = path.join(root, 'grant.json'); writeFileSync(grantFile, JSON.stringify(grant));
  return { root, authority, ws, env, grant, grantFile, grantSha: sha(readFileSync(grantFile)), move: () => { head = 'c'.repeat(40); } };
};

describe('fresh-book profile (frozen fictional inputs, fixed routes)', () => {
  it('refuses Dini, an Astra planner or a non-inspection anchor', () => {
    expect(() => freshBookProfileSchema.parse({ ...profile, companion: { ...profile.companion, id: 'dragon_dini' } })).toThrow('fresh_book_companion_scope');
    expect(() => freshBookProfileSchema.parse({ ...profile, routes: { ...profile.routes, storyboardPlanner: 'gpt-6-astra' } })).toThrow();
    expect(() => freshBookProfileSchema.parse({ ...profile, childAnchor: 'child-anchor-style/v1' })).toThrow();
  });
});

describe('one owner-cycle claim, fixed outside configurable paths', () => {
  it('claims once; another grant, profile or book folder cannot claim again', () => {
    const s = setup();
    claimFreshBook(s.env, s.grant, s.grantSha);
    expect(() => claimFreshBook(s.env, { ...s.grant, bookDir: path.join(s.root, 'book-2') }, 'd'.repeat(64))).toThrow('fresh_book_slot_used');
    expect(() => claimFreshBook(s.env, { ...s.grant, profileSha256: 'e'.repeat(64) }, s.grantSha)).toThrow('fresh_book_slot_used');
  });
  it('a finished cycle (outcome present) cannot be claimed even if the claim file were missing', () => {
    const s = setup(); writeFileSync(path.join(s.authority, FRESH_BOOK_CYCLE.outcomeName), '{}');
    expect(() => claimFreshBook(s.env, s.grant, s.grantSha)).toThrow('fresh_book_slot_used');
  });
  it('every paid claim re-checks grant bytes, profile, claim ownership, source head and pins', () => {
    const s = setup(), args = { env: s.env, grantFile: s.grantFile, grantSha: s.grantSha, profile, workspace: s.ws };
    expect(() => assertFreshBookPaid(args)).toThrow('fresh_book_claim');
    claimFreshBook(s.env, s.grant, s.grantSha);
    expect(assertFreshBookPaid(args).profileSha256).toBe(freshBookProfileSha(profile));
    expect(() => assertFreshBookPaid({ ...args, profile: { ...profile, parentInputs: { ...profile.parentInputs, wish: 'something else entirely' } } })).toThrow('fresh_book_profile_changed');
    const other = path.join(s.root, 'other.json'); writeFileSync(other, JSON.stringify({ ...s.grant, bookDir: path.join(s.root, 'moved') }));
    expect(() => assertFreshBookPaid({ ...args, grantFile: other, grantSha: sha(readFileSync(other)) })).toThrow('fresh_book_claim_foreign');
    writeFileSync(path.join(s.ws, 'engine.ts'), 'export const x = 1');
    expect(() => assertFreshBookPaid(args)).toThrow('fresh_book_source_changed');
    writeFileSync(path.join(s.ws, 'engine.ts'), 'export {}'); s.move();
    expect(() => assertFreshBookPaid(args)).toThrow('fresh_book_source_changed');
  });
});

describe('cumulative cycle ledger (priced, unpriced, orphan, resume)', () => {
  const rule: MeterRule = { reserve: () => 100000, settle: (_w, r, completed) => ({ estimatedMicroUsd: r?.cost ?? null, coherent: completed ? r != null : true }) };
  const rules = (step: string) => step.startsWith('call') ? rule : undefined;
  const stage = (root: string, name: string) => ({ name, dir: path.join(root, name), rules, maxCalls: 6 });
  const pay = async (dir: string, step: string, cost: number | null) => {
    mkdirSync(dir, { recursive: true });
    const meter = new AuditionMeter(path.join(dir, 'paid-stages'), 7_000_000, 6, 0, 0, rules);
    await meter.run(step, { step }, 100000, async () => ({ value: null, estimatedMicroUsd: cost, receipt: { cost } })).catch(() => {});
  };
  it('sums every stage after the diagnostic spend; next cap is min(7M, 8M - diagnostic)', async () => {
    const s = setup(); await pay(path.join(s.root, 'text'), 'call_a', 30000); await pay(path.join(s.root, 'child'), 'call_b', 20000);
    const l = freshBookCycleLedger({ diagnosticSettledMicroUsd: 59910 + 12000, stages: [stage(s.root, 'text'), stage(s.root, 'child'), stage(s.root, 'audition')] });
    expect(l).toMatchObject({ bookKnownMicroUsd: 50000, cycleAccountedMicroUsd: 121910, nextCapMicroUsd: 7_000_000 });
  });
  it('an unpriced answer or an orphan claim (resume after a crash) halts; nothing resets the diagnostic floor', async () => {
    const s = setup(); await pay(path.join(s.root, 'text'), 'call_a', null);
    expect(() => freshBookCycleLedger({ diagnosticSettledMicroUsd: 59910, stages: [stage(s.root, 'text')] })).toThrow('fresh_book_ledger_unknown');
    const orphan = path.join(s.root, 'child', 'paid-stages'); mkdirSync(orphan, { recursive: true });
    writeFileSync(path.join(orphan, 'call_b.wire.json'), JSON.stringify({ step: 'call_b' }));
    writeFileSync(path.join(orphan, 'call_b.claim.json'), JSON.stringify({ step: 'call_b', seq: 0, wireDigest: previewSha(canonicalJson({ step: 'call_b' })), maximumMicroUsd: 100000 }));
    expect(() => freshBookCycleLedger({ diagnosticSettledMicroUsd: 59910, stages: [stage(s.root, 'child')] })).toThrow('fresh_book_ledger_unknown');
    expect(() => freshBookCycleLedger({ diagnosticSettledMicroUsd: 0, stages: [] })).toThrow('fresh_book_ledger_diagnostic');
  });
});

describe('sample gate and reading order', () => {
  it('a held sample stops the remaining pages and cover; two passed samples allow them', () => {
    expect(() => assertLaterPagesAllowed([{ page: 2, disposition: 'passed' }, { page: 6, disposition: 'held_uncertain' }])).toThrow('fresh_book_sample_held');
    expect(() => assertLaterPagesAllowed([{ page: 2, disposition: 'passed' }])).toThrow('fresh_book_sample_set');
    expect(() => assertLaterPagesAllowed([{ page: 2, disposition: 'passed' }, { page: 6, disposition: 'passed' }])).not.toThrow();
  });
  it('the viewer is cover then 1..8; complete only when all passed, otherwise partial/held', () => {
    const all = Array.from({ length: 8 }, (_, i) => ({ page: i + 1, disposition: 'passed' as const }));
    expect(freshBookReadingOrder('passed', all).status).toBe('complete');
    expect(freshBookReadingOrder('held_uncertain', all).status).toBe('partial');
    expect(freshBookReadingOrder('passed', all).order.map(o => o.slot)).toEqual(['cover', ...all.map(p => `page-${p.page}`)]);
    expect(freshBookReadingOrder(null, all.slice(0, 2)).status).toBe('partial');
  });
});

describe('book admission derives from the settled amendment, never a flag', () => {
  const config = { round: 1 } as RereviewConfig;
  it('no claimed round refuses; a claimed round without its outcome (in flight) refuses', async () => {
    const s = setup();
    await expect(assertFreshBookAdmission(config, s.env)).rejects.toThrow('fresh_book_admission_missing');
    writeFileSync(path.join(s.authority, REREVIEW_AMENDMENT.claimName(1)), '{}');
    await expect(assertFreshBookAdmission(config, s.env)).rejects.toThrow('fresh_book_admission_inflight');
  });
});
