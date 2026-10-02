import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BookTrialGuard, BOOK_TRIAL_FAMILY, BOOK_TRIAL_STAGES, assertBookTrialSlots, type BookTrialSlot } from '../../../scripts/personal-book-companion-trial-guard';
import { loadFrozenBookEngine, assertFrozenExecutionImports } from '../../../scripts/personal-story-frozen-engine';
import { bookTrialPlan, executeBookTrial, renderBookTrial, bookTrialTerminal } from '../../../scripts/personal-book-companion-trial';
import { personalStoryboardFixture, fixtureEditorOutput } from './personal-storyboard-fixture';
import type { PersonalBookProvider } from '../book-runner';

const roots: string[] = [];
function setup() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'book-six-guard-')); roots.push(root);
  const common = path.join(root, 'git'); mkdirSync(common);
  const caps = [[12,8,16,32,39], [14,10,18,39,47], [16,12,20,51,55]];
  const slots: BookTrialSlot[] = Array.from({ length: 30 }, (_, i) => ({ caseId: `case${Math.floor(i / 5) + 1}`,
    stage: BOOK_TRIAL_STAGES[i % 5], maxOutputTokens: caps[Math.floor(i / 5) % 3][i % 5] * 1000, inputCeiling: i % 5 < 3 ? 64_000 : 128_000 }));
  const output = path.join(root, 'output');
  return { root, common, output, slots, claim: () => BookTrialGuard.claim(common, output, slots, { test: true }) };
}
const call = (slot: BookTrialSlot) => ({ stage: slot.stage, maxOutputTokens: slot.maxOutputTokens, instructions: 'test only', input: '{}' });
const answer = async () => ({ output: {}, usage: { inputTokens: 1, outputTokens: 1 } });
let frozen: Awaited<ReturnType<typeof loadFrozenBookEngine>>;
let fixture: Awaited<ReturnType<typeof personalStoryboardFixture>>;
beforeAll(async () => {
  frozen = await loadFrozenBookEngine(process.cwd(), '9a1ba1f20ef5c36c643c469c5e045b0bb32dea46');
  fixture = await personalStoryboardFixture();
}, 30_000);
function fixtureProvider(holdAt?: number): PersonalBookProvider {
  return { story: { generate: async (c: any) => {
    const output = c.stage === 'plan' ? { ...structuredClone(fixture.draftResult.plan), adventureSelection: structuredClone(fixture.draftResult.planning!.selection) }
      : { ...fixture.draftResult.manuscript, planDigest: JSON.parse(c.input).planDigest };
    if (c.stage === 'plan' && holdAt === 1) (output as any).adventureSelection.outlineChecks.earned_payoff.outcome = 'needs_work';
    return { output, usage: { inputTokens: 1, outputTokens: 1 } };
  } }, editor: { generate: async (c: any) => {
    const output = fixtureEditorOutput(c); if (holdAt === 3) output.checks.causal_magic.outcome = 'needs_work';
    return { output, usage: { inputTokens: 1, outputTokens: 1 } };
  } }, visual: { generate: async (c: any) => {
    const output = c.stage === 'storyboard' ? structuredClone(fixture.draft) : { ...structuredClone(fixture.review), sourceDigest: c.context.sourceDigest, storyboardDigest: c.context.storyboardDigest };
    if (c.stage === 'review' && holdAt === 5) (output as any).bookChecks[0].verdict = 'uncertain';
    return { output, usage: { inputTokens: 1, outputTokens: 1 } };
  } } };
}
function oneCasePlan() { const plan = bookTrialPlan(frozen.engine, process.cwd()); plan.cases = [{ id: 'case1', request: structuredClone(fixture.request) }]; return plan; }
afterEach(() => { vi.restoreAllMocks(); roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });

describe('fresh six-book durable family', () => {
  it('rejects surviving image/storage imports before bundle evaluation', () => {
    for (const name of ['@supabase/supabase-js', 'replicate', 'sharp', 'fs/promises', 'os']) {
      expect(() => assertFrozenExecutionImports([{ path: name, external: true }])).toThrow('trial_execution_import');
    }
    expect(frozen.evidence.executionImports.map(item => item.path)).not.toContain('replicate');
  });
  it('prices exactly thirty fixed slots, rejects changed limits/order before claim', () => {
    const f = setup(); assertBookTrialSlots(f.slots);
    for (const mutate of [(s: BookTrialSlot[]) => s.pop(), (s: BookTrialSlot[]) => s[0].maxOutputTokens++, (s: BookTrialSlot[]) => s[3].inputCeiling = 64_000]) {
      const changed = structuredClone(f.slots); mutate(changed); expect(() => assertBookTrialSlots(changed)).toThrow('policy_changed');
    }
    const guard = f.claim(); expect(guard.snapshot()).toMatchObject({ reservedUsd: 14.4716, budgetUsd: 15, providerAttempts: 0 });
    expect(() => BookTrialGuard.claim(f.common, path.join(f.root, 'another'), f.slots, {})).toThrow('already_claimed');
  });
  it('leaves even an empty/partial claim consumed', () => {
    const f = setup(); mkdirSync(path.join(f.common, 'codex-text-trials', BOOK_TRIAL_FAMILY), { recursive: true });
    expect(f.claim).toThrow('already_claimed');
  });
  it('serializes a real two-process claim race', async () => {
    const f = setup(), script = path.resolve('scripts/personal-book-companion-trial-guard.ts');
    const source = `const {BookTrialGuard}=require(${JSON.stringify(script)});try{BookTrialGuard.claim(${JSON.stringify(f.common)},${JSON.stringify(f.output)},${JSON.stringify(f.slots)},{});process.stdout.write('claimed')}catch{process.stdout.write('refused')}`;
    const run = () => promisify(execFile)(process.execPath, ['--import', 'tsx', '-e', source], { cwd: process.cwd(), timeout: 20_000 });
    const result = await Promise.all([run(), run()]); expect(result.map(r => r.stdout).sort()).toEqual(['claimed', 'refused']);
  }, 30_000);
  it('rejects stage/cap/order/oversize/duplicate, then refuses a31st dispatch', async () => {
    const f = setup(), guard = f.claim(), run = vi.fn(answer);
    for (const wrong of [{ ...call(f.slots[0]), stage: 'editor' }, { ...call(f.slots[0]), maxOutputTokens: 1 }, { ...call(f.slots[0]), input: 'x'.repeat(64_000) }]) {
      await expect(guard.dispatch('case1', wrong, run)).rejects.toThrow('dispatch_refused');
    }
    await expect(guard.dispatch('case2', call(f.slots[0]), run)).rejects.toThrow(); expect(run).not.toHaveBeenCalled();
    for (let i = 0; i < 30; i++) { await guard.dispatch(f.slots[i].caseId, call(f.slots[i]), run); if (i % 5 === 4) guard.finishCase(f.slots[i].caseId, 'completed'); }
    await expect(guard.dispatch('case1', call(f.slots[0]), run)).rejects.toThrow('dispatch_refused'); expect(run).toHaveBeenCalledTimes(30);
  });
  it('refuses dispatch on journal failure before run, retains claim', async () => {
    const f = setup(), guard = f.claim(), run = vi.fn(answer);
    const journal = path.join(f.common, 'codex-text-trials', BOOK_TRIAL_FAMILY, 'events.jsonl');
    rmSync(journal); mkdirSync(journal); // OS-level failure, not a mocked helper.
    await expect(guard.dispatch('case1', call(f.slots[0]), run)).rejects.toThrow(); expect(run).not.toHaveBeenCalled(); expect(guard.snapshot().sealed).toBe(true);
  });
  it.each(['unknown', 'invalid', 'billed', 'overrun'])('seals %s failure without refund or second call', async kind => {
    const f = setup(), guard = f.claim();
    const run = async () => { if (kind === 'billed') throw Object.assign(Error('PRIVATE'), { providerUsage: { inputTokens: 10, outputTokens: 20 } });
      return { output: {}, usage: kind === 'unknown' ? null : kind === 'invalid' ? { inputTokens: -1, outputTokens: 1 } : { inputTokens: 1_000_000, outputTokens: 1 } }; };
    await expect(guard.dispatch('case1', call(f.slots[0]), run)).rejects.toThrow();
    expect(guard.snapshot()).toMatchObject({ sealed: true, providerAttempts: 1, reservedUsd: 14.4716 });
    if (kind === 'billed') expect(guard.snapshot().rows[0].usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    expect(readFileSync(path.join(f.common, 'codex-text-trials', BOOK_TRIAL_FAMILY, 'events.jsonl'), 'utf8')).not.toContain('PRIVATE');
    await expect(guard.dispatch('case1', call(f.slots[0]), answer)).rejects.toThrow();
  });
  it.each(['resolve', 'reject'])('late %s cannot rewrite sealed receipt', async mode => {
    const f = setup(), guard = f.claim(); let resolve!: (v: any) => void, reject!: (e: any) => void;
    const pending = guard.dispatch('case1', call(f.slots[0]), () => new Promise((a, b) => { resolve = a; reject = b; }));
    await expect(guard.dispatch('case1', call(f.slots[0]), answer)).rejects.toThrow();
    guard.stop('book_trial_cancelled'); const before = JSON.stringify(guard.snapshot());
    if (mode === 'resolve') resolve(await answer()); else reject(Object.assign(Error('PRIVATE'), { providerUsage: { inputTokens: 1, outputTokens: 1 } }));
    await expect(pending).rejects.toThrow(); expect(JSON.stringify(guard.snapshot())).toBe(before);
  });
  it('skips only creative boundary1/3/5, stops after two consecutive holds', async () => {
    const f = setup(), guard = f.claim(); expect(() => guard.finishCase('case1', 'held')).toThrow();
    await guard.dispatch('case1', call(f.slots[0]), answer); guard.finishCase('case1', 'held');
    for (let n = 5; n < 8; n++) await guard.dispatch('case2', call(f.slots[n]), answer);
    guard.finishCase('case2', 'held'); expect(guard.snapshot()).toMatchObject({ sealed: true, providerAttempts: 4, reservedUsd: 14.4716 });
    expect(guard.snapshot().outcomes.map(row => row.skipped)).toEqual([4,2]);
  });
  it('loads the real frozen book runner, matches derived reservations and runs five stages offline', async () => {
    const all = bookTrialPlan(frozen.engine, process.cwd()); expect(all.cases).toHaveLength(6); expect(all.slots).toHaveLength(30);
    const f = setup(), guard = f.claim();
    const result = await executeBookTrial({ engine: frozen.engine, plan: oneCasePlan(), guard, root: f.output, key: 'fake-test-key', signal: new AbortController().signal, providerFactory: () => fixtureProvider() });
    expect(result[0].status).toBe('review_supported'); expect(guard.snapshot().providerAttempts).toBe(5);
    expect(JSON.parse(readFileSync(path.join(f.output, 'case1-replay.json'), 'utf8')).framePackets).toBe(9);
    expect(renderBookTrial(f.output)).toContain('נועה'); expect(readdirSync(f.output)).toContain('case1-review-output.json');
  }, 30_000);
  it.each([1,3,5])('preserves actual runner creative HOLD after %s calls without more dispatch', async stage => {
    const f = setup(), guard = f.claim();
    const outcomes = await executeBookTrial({ engine: frozen.engine, plan: oneCasePlan(), guard, root: f.output, key: 'fake', signal: new AbortController().signal, providerFactory: () => fixtureProvider(stage) });
    expect(guard.snapshot().providerAttempts).toBe(stage);
    expect(guard.snapshot().outcomes[0]).toEqual({ caseId: 'case1', outcome: 'held', skipped: 5-stage });
    expect(outcomes[0].status).toBe(stage === 1 ? 'book_outline_held' : stage === 3 ? 'book_editorial_held' : 'held_uncertain');
    if (stage !== 5) expect(JSON.parse(readFileSync(path.join(f.output, 'case1-held.json'), 'utf8'))).toHaveProperty(stage === 1 ? 'planningResult' : 'writerResult.editing.original');
    else expect(JSON.parse(readFileSync(path.join(f.output, 'case1-result.json'), 'utf8')).framePackets).toEqual([]);
    expect(readdirSync(f.output)).not.toContain(stage === 1 ? 'case1-manuscript-call.json' : stage === 3 ? 'case1-storyboard-call.json' : 'case2-plan-call.json');
  });
  it('seals at the real runner abort signal before a late adapter can write output or usage', async () => {
    const f = setup(), guard = f.claim(), controller = new AbortController(), provider = fixtureProvider();
    let release!: (v: any) => void, started!: () => void;
    const running = new Promise<void>(resolve => { started = resolve; });
    provider.story.generate = async () => { started(); return new Promise(resolve => { release = resolve; }); };
    const result = executeBookTrial({ engine: frozen.engine, plan: oneCasePlan(), guard, root: f.output, key: 'fake', signal: controller.signal, providerFactory: () => provider });
    const rejection = expect(result).rejects.toHaveProperty('code', 'book_cancelled');
    await running; controller.abort(); const sealed = JSON.stringify(guard.snapshot());
    expect(guard.snapshot()).toMatchObject({ sealed: true, terminalReason: 'book_trial_cancelled', providerAttempts: 1 });
    release(await answer()); await rejection;
    await new Promise(resolve => setImmediate(resolve));
    expect(JSON.stringify(guard.snapshot())).toBe(sealed);
    expect(readdirSync(f.output)).not.toContain('case1-plan-output.json');
    expect(readFileSync(path.join(f.common, 'codex-text-trials', BOOK_TRIAL_FAMILY, 'events.jsonl'), 'utf8')).not.toContain('dispatch_completed');
  });
  it('retains unknown-usage adapter output but refuses a later call', async () => {
    const f = setup(), guard = f.claim(), provider = fixtureProvider();
    provider.story.generate = async () => ({ output: { diagnostic: 'partial answer' }, usage: null as any });
    await expect(executeBookTrial({ engine: frozen.engine, plan: oneCasePlan(), guard, root: f.output, key: 'fake', signal: new AbortController().signal, providerFactory: () => provider })).rejects.toHaveProperty('code', 'book_provider_failed');
    expect(JSON.parse(readFileSync(path.join(f.output, 'case1-plan-output.json'), 'utf8')).output.diagnostic).toBe('partial answer');
    expect(guard.snapshot()).toMatchObject({ sealed: true, estimatedUsd: null, providerAttempts: 1 });
    expect(readdirSync(f.output)).not.toContain('case1-manuscript-call.json');
  });
  it('does not turn a final two-HOLD stop or isolated held book into complete', async () => {
    const f = setup(), guard = f.claim();
    for (let n=0; n<30; n++) { await guard.dispatch(f.slots[n].caseId, call(f.slots[n]), answer); if (n%5 === 4) guard.finishCase(f.slots[n].caseId, n>=20 ? 'held' : 'completed'); }
    const outcomes = Array.from({length:6}, (_,i) => ({status: i<4 ? 'review_supported' : 'held_uncertain'}));
    expect(bookTrialTerminal(outcomes, guard.snapshot())).toBe('book_trial_repeated_hold');
    expect(bookTrialTerminal(outcomes, { ...guard.snapshot(), terminalReason: null })).toBe('book_trial_completed_with_holds');
  });
  it('escapes manuscript HTML and explicitly presents a missing book as incomplete', () => {
    const f = setup(), guard = f.claim();
    writeFileSync(path.join(f.output, 'case1-result.json'), JSON.stringify({ status: 'held_uncertain', writerResult: { manuscript: { title: '<script>PRIVATE</script>', pages: [{pageNumber:1,text:'<img src=x onerror=evil()> & "'}] } } }));
    const html = renderBookTrial(f.output); expect(html).not.toContain('<script>'); expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;'); expect(html).toContain('אין סיפור מלא'); expect(html).toContain('held_uncertain');
    guard.stop('book_trial_complete');
  });
});
