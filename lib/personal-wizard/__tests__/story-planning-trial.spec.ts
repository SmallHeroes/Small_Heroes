import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, existsSync, unlinkSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TrialFamilyGuard, TRIAL_FAMILY, safeUsage } from '../../../scripts/personal-story-trial-guard';
import { loadFrozenStoryEngine, gitEnvironment } from '../../../scripts/personal-story-frozen-engine';
import { executeCohort, main, trialPlan, trialRepo, TRIAL_BASELINE, TRIAL_CURRENT } from '../../../scripts/personal-story-planning-trial';
import { fixtureAdventureSelection } from './story-planning-fixture';
import { STORY_EDITOR_CRITERIA } from '../story-editor-contract';

const temporaries: string[] = [];
function temp() {
  const root = mkdtempSync(path.join(tmpdir(), 'sh-planning-trial-')); temporaries.push(root);
  const common = path.join(root, 'common'), outputs = path.join(root, 'outputs'); mkdirSync(common); mkdirSync(outputs);
  return { root, common, output: path.join(outputs, TRIAL_FAMILY) };
}
afterEach(() => {
  vi.unstubAllGlobals(); vi.restoreAllMocks();
  for (const root of temporaries.splice(0)) {
    if (!path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(root).startsWith('sh-planning-trial-')) throw Error('unsafe_test_cleanup');
    rmSync(root, { recursive: true, force: true });
  }
});
const usage = { inputTokens: 100, outputTokens: 200 };
describe('persistent aggregate family boundary', () => {
  it('claims once across output roots and preserves a failed family', () => {
    const f = temp(); const slots = [{ id: 'one', maxOutputTokens: 100 }];
    const guard = TrialFamilyGuard.claim(f.common, f.output, slots, {}); guard.stop('trial_setup_failed');
    expect(() => TrialFamilyGuard.claim(f.common, f.output + '-other', slots, {})).toThrow('trial_already_claimed');
    expect(readFileSync(path.join(f.common, 'codex-text-trials', TRIAL_FAMILY, 'events.jsonl'), 'utf8')).toContain('trial_setup_failed');
  });
  it('atomically permits only one competing claim', async () => {
    const f = temp();
    const answers = await Promise.allSettled([0, 1].map(async () => TrialFamilyGuard.claim(f.common, f.output, [{ id: 'one', maxOutputTokens: 100 }], {})));
    expect(answers.filter(answer => answer.status === 'fulfilled')).toHaveLength(1);
    expect(answers.filter(answer => answer.status === 'rejected')).toHaveLength(1);
  });
  it('two real processes in different cwd compete for the same shared claim', async () => {
    const f = temp(); const second = path.join(f.root, 'other'); mkdirSync(second);
    const code = `const {TrialFamilyGuard}=require(${JSON.stringify(path.join(trialRepo, 'scripts/personal-story-trial-guard.ts'))}); try {TrialFamilyGuard.claim(process.argv[1],process.argv[2],[{id:'one',maxOutputTokens:1}],{});console.log('claimed')} catch {console.log('refused')}`;
    const run = (cwd: string) => promisify(execFile)(process.execPath, [require.resolve('tsx/cli'), '-e', code, f.common, f.output], { cwd });
    const results = await Promise.all([run(f.root), run(second)]);
    expect(results.map(row => row.stdout.trim()).sort()).toEqual(['claimed', 'refused']);
  }, 30_000);
  it('journal failure before dispatch performs zero provider calls and cannot restart', async () => {
    const f = temp(); const slots = [{ id: 'one', maxOutputTokens: 1 }]; const guard = TrialFamilyGuard.claim(f.common, f.output, slots, {});
    const journal = path.join(f.common, 'codex-text-trials', TRIAL_FAMILY, 'events.jsonl'); unlinkSync(journal); mkdirSync(journal);
    const run = vi.fn(async () => ({ output: {}, usage })); await expect(guard.dispatch('one', 1, run)).rejects.toThrow();
    expect(run).not.toHaveBeenCalled(); expect(() => TrialFamilyGuard.claim(f.common, f.output + '-again', slots, {})).toThrow('trial_already_claimed');
  });
  it.each([0, 16])('refuses %i slots before claim', count => {
    const f = temp(); expect(() => TrialFamilyGuard.claim(f.common, f.output, Array.from({ length: count }, (_, n) => ({ id: `c${n}`, maxOutputTokens: 100 })), {})).toThrow('trial_budget');
    expect(existsSync(f.output)).toBe(false);
  });
  it('refuses reservation over $5 and duplicate slots', () => {
    const f = temp(); expect(() => TrialFamilyGuard.claim(f.common, f.output, Array.from({ length: 15 }, (_, n) => ({ id: `c${n}`, maxOutputTokens: 20_000 })), {})).toThrow('trial_budget');
    expect(() => TrialFamilyGuard.claim(f.common, f.output, [{ id: 'one', maxOutputTokens: 1 }, { id: 'one', maxOutputTokens: 1 }], {})).toThrow('trial_budget');
  });
  it('persists before dispatch; allows fifteen once and blocks sixteen', async () => {
    const f = temp(); const guard = TrialFamilyGuard.claim(f.common, f.output, Array.from({ length: 15 }, (_, n) => ({ id: `c${n}`, maxOutputTokens: 100 })), {});
    let calls = 0;
    for (let n = 0; n < 15; n++) await guard.dispatch(`c${n}`, 100, async () => {
      expect(readFileSync(path.join(f.common, 'codex-text-trials', TRIAL_FAMILY, 'events.jsonl'), 'utf8')).toContain(`"id":"c${n}","status":"started"`);
      calls++; return { output: {}, usage };
    });
    await expect(guard.dispatch('c15', 100, async () => { calls++; return { output: {}, usage }; })).rejects.toThrow('trial_dispatch_refused');
    expect(calls).toBe(15); expect(guard.snapshot().providerAttempts).toBe(15);
  });
  it('wrong caps, unknown slots and replay do not dispatch', async () => {
    const f = temp(); const guard = TrialFamilyGuard.claim(f.common, f.output, [{ id: 'one', maxOutputTokens: 100 }], {}); const run = vi.fn(async () => ({ output: {}, usage }));
    await expect(guard.dispatch('one', 101, run)).rejects.toThrow(); await expect(guard.dispatch('other', 100, run)).rejects.toThrow(); expect(run).not.toHaveBeenCalled();
    await guard.dispatch('one', 100, run); await expect(guard.dispatch('one', 100, run)).rejects.toThrow(); expect(run).toHaveBeenCalledTimes(1);
  });
  it.each([null, { inputTokens: -1, outputTokens: 1 }, { inputTokens: Infinity, outputTokens: 1 }])('unknown/invalid usage stops without refund: %j', async bad => {
    const f = temp(); const guard = TrialFamilyGuard.claim(f.common, f.output, [{ id: 'one', maxOutputTokens: 100 }, { id: 'two', maxOutputTokens: 100 }], {});
    await expect(guard.dispatch('one', 100, async () => ({ output: {}, usage: bad as any }))).rejects.toThrow('trial_usage_unknown');
    const run = vi.fn(); await expect(guard.dispatch('two', 100, run)).rejects.toThrow(); expect(run).not.toHaveBeenCalled();
    expect(guard.snapshot().estimatedUsd).toBeNull(); expect(guard.snapshot().reservedUsd).toBeGreaterThan(0);
  });
  it('retains billed failure usage and blocks later calls without leaking', async () => {
    const f = temp(); const guard = TrialFamilyGuard.claim(f.common, f.output, [{ id: 'one', maxOutputTokens: 100 }, { id: 'two', maxOutputTokens: 100 }], {});
    await expect(guard.dispatch('one', 100, async () => { throw Object.assign(Error('PRIVATE_PROVIDER_SECRET'), { providerUsage: usage }); })).rejects.toThrow();
    const run = vi.fn(); await expect(guard.dispatch('two', 100, run)).rejects.toThrow(); expect(run).not.toHaveBeenCalled();
    expect(guard.snapshot().rows[0].usage).toEqual(usage);
    expect(readFileSync(path.join(f.common, 'codex-text-trials', TRIAL_FAMILY, 'events.jsonl'), 'utf8')).not.toContain('PRIVATE_PROVIDER_SECRET');
  });
  it('known per-slot overrun cannot be hidden by total reservation', async () => {
    const f = temp(); const guard = TrialFamilyGuard.claim(f.common, f.output, [{ id: 'one', maxOutputTokens: 1 }, { id: 'two', maxOutputTokens: 100 }], {});
    await expect(guard.dispatch('one', 1, async () => ({ output: {}, usage: { inputTokens: 100_000, outputTokens: 0 } }))).rejects.toThrow('trial_reservation_exceeded');
    expect(guard.snapshot().stopped).toBe(true);
  });
  it('hostile usage is unknown and Git overrides are removed', () => {
    expect(safeUsage({ get inputTokens() { throw Error('PRIVATE'); } })).toBeNull();
    expect(Object.keys(gitEnvironment()).some(key => key.toUpperCase().startsWith('GIT_'))).toBe(false);
  });
});

let old: Awaited<ReturnType<typeof loadFrozenStoryEngine>>, current: Awaited<ReturnType<typeof loadFrozenStoryEngine>>;
beforeAll(async () => { old = await loadFrozenStoryEngine(trialRepo, TRIAL_BASELINE, false); current = await loadFrozenStoryEngine(trialRepo, TRIAL_CURRENT, true); }, 30_000);
function mockResponse(payload: any, hold = false) {
  const { brief, planDigest, draftDigest, draft } = JSON.parse(payload.input), stage = payload.text.format.name;
  let output: any;
  if (stage === 'personal_story_plan') {
    output = { requestId: brief.requestId, title: 'משחק מפתיע', childGoal: 'לעזור לחבר למצוא דרך', companionWant: 'רוצה לחזור למשחק', comicPromise: 'הכדור מתגלגל ומדגדג',
      resilience: { mode: brief.resilienceMode, moments: [{ pageNumber: 2, childChoice: 'מבקשת עזרה', whatHelps: 'החבר נשאר קרוב' }] },
      beats: Array.from({ length: brief.beats }, () => ({ location: 'בגינה', transitionReason: 'יוצאים למצוא דרך', childAction: 'מציע משחק', companionAction: 'מקשיב לילד', consequence: 'מוצאים דרך', factIds: ['f_interest0001'], continuity: 'הכדור ליד הילד' })), ending: 'שבים למשחק יחד' };
    if (payload.text.format.schema.properties.adventureSelection) {
      output.adventureSelection = fixtureAdventureSelection(brief.beats);
      if (hold) output.adventureSelection.outlineChecks.causal_child_choices.outcome = 'needs_work';
    }
  } else if (stage === 'personal_story_manuscript') output = { requestId: brief.requestId, planDigest, title: 'משחק מפתיע',
    pages: Array.from({ length: brief.beats }, () => ({ text: `${brief.child.name} יצא למשחק. החבר הצטרף וצחק איתו, והם חזרו יחד אחרי שמצאו את הדרך.` })) };
  else {
    const { requestId: _id, ...plan } = draft.plan; plan.beats = plan.beats.map(({ pageNumber: _n, ...beat }: any) => beat);
    output = { requestId: brief.requestId, draftDigest, plan, manuscript: { title: draft.manuscript.title,
      pages: draft.manuscript.pages.map(({ text }: any) => ({ text: text + ' כולם חייכו.' })) },
      checks: Object.fromEntries(STORY_EDITOR_CRITERIA.map(category => [category, { outcome: 'ready_for_reading', note: 'Synthetic fixture only not literary quality acceptance' }])) };
  }
  return new Response(JSON.stringify({ id: 'resp_mock', object: 'response', created_at: 0, status: 'completed',
    output: [{ id: 'msg_mock', type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(output), annotations: [] }] }],
    usage: { input_tokens: 100, output_tokens: 200, total_tokens: 300 } }), { headers: { 'content-type': 'application/json' } });
}
describe('frozen engines through real SDK adapters with mocked HTTP', () => {
  it('authenticates frozen source/caps and exact cohort policy', () => {
    expect(old.evidence.commit).toBe(TRIAL_BASELINE); expect(current.evidence.commit).toBe(TRIAL_CURRENT);
    expect(old.evidence.sourceSha256['lib/personal-wizard/story-openai.ts']).not.toBe(current.evidence.sourceSha256['lib/personal-wizard/story-openai.ts']);
    expect(old.engine.personalStoryOutputLimits(16).planOutputTokens).toBe(12_000); expect(current.engine.personalStoryOutputLimits(16).planOutputTokens).toBe(16_000);
    const plan = trialPlan(old.engine, current.engine); expect(plan.reservedUsd).toBeCloseTo(4.158, 10); expect(plan.slots).toHaveLength(15);
    expect(plan.profiles.map(profile => profile.id)).toEqual(['synthetic_1', 'synthetic_5', 'synthetic_9']);
  });
  it('six drafts precede three edits with real adapter/packaging bindings', async () => {
    const f = temp(); const plan = trialPlan(old.engine, current.engine); const guard = TrialFamilyGuard.claim(f.common, f.output, plan.slots, {});
    const payloads: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init: any) => { const p = JSON.parse(init.body); payloads.push(p); return mockResponse(p); }));
    const result = await executeCohort({ old: old.engine, current: current.engine, guard, profiles: plan.profiles, root: f.output, key: 'FAKE_SPEC_KEY', signal: new AbortController().signal });
    expect(result.manuscriptCount).toBe(6); expect(payloads).toHaveLength(15);
    expect(payloads.slice(0, 12).some(p => p.text.format.name === 'personal_story_editor')).toBe(false);
    expect(payloads.slice(12).every(p => p.text.format.name === 'personal_story_editor')).toBe(true);
    expect(payloads.every(p => p.model === 'gpt-6.1-sol' && p.store === false && p.service_tier === 'default' && p.reasoning.effort === 'medium')).toBe(true);
    expect(JSON.parse(readFileSync(path.join(f.output, 'private-evidence.json'), 'utf8')).cases.every((row: any) => row.planningComparisonAvailable)).toBe(true);
    expect(JSON.parse(readFileSync(path.join(f.output, 'review-first-drafts/review.json'), 'utf8')).pairs).toHaveLength(3);
    expect(JSON.parse(readFileSync(path.join(f.output, 'review-editing/review.json'), 'utf8')).pairs).toHaveLength(3);
    expect(readFileSync(path.join(f.output, 'manifest.json'), 'utf8')).not.toContain('FAKE_SPEC_KEY');
  }, 30_000);
  it('preserves valid HOLD without editing it; other planned cases continue', async () => {
    const f = temp(); const plan = trialPlan(old.engine, current.engine); const guard = TrialFamilyGuard.claim(f.common, f.output, plan.slots, {}); let count = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init: any) => { count++; const p = JSON.parse(init.body); return mockResponse(p, JSON.parse(p.input).brief.beats === 8); }));
    await executeCohort({ old: old.engine, current: current.engine, guard, profiles: plan.profiles, root: f.output, key: 'FAKE_SPEC_KEY', signal: new AbortController().signal });
    expect(count).toBe(13); expect(existsSync(path.join(f.output, 'synthetic_1-improved-held.json'))).toBe(true);
    expect(existsSync(path.join(f.output, 'synthetic_1-improved-edited.json'))).toBe(false);
    expect(JSON.parse(readFileSync(path.join(f.output, 'review-first-drafts/review.json'), 'utf8')).pairs).toHaveLength(2);
  }, 30_000);
  it('transport fails once, unknown usage stops whole family', async () => {
    const f = temp(); const plan = trialPlan(old.engine, current.engine); const guard = TrialFamilyGuard.claim(f.common, f.output, plan.slots, {});
    const fetch = vi.fn(async () => { throw Error('PRIVATE_TRANSPORT'); }); vi.stubGlobal('fetch', fetch);
    await expect(executeCohort({ old: old.engine, current: current.engine, guard, profiles: plan.profiles, root: f.output, key: 'FAKE_SPEC_KEY', signal: new AbortController().signal })).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1); expect(guard.snapshot().providerAttempts).toBe(1); expect(guard.snapshot().estimatedUsd).toBeNull();
    expect(existsSync(path.join(f.output, 'manifest.json'))).toBe(true);
  }, 30_000);
  it('pre-cancelled produces no attempt or HTTP', async () => {
    const f = temp(); const plan = trialPlan(old.engine, current.engine); const guard = TrialFamilyGuard.claim(f.common, f.output, plan.slots, {});
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); const controller = new AbortController(); controller.abort();
    await expect(executeCohort({ old: old.engine, current: current.engine, guard, profiles: plan.profiles, root: f.output, key: 'FAKE_SPEC_KEY', signal: controller.signal })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled(); expect(guard.snapshot().providerAttempts).toBe(0);
  });
  it('late HTTP completion after cancellation cannot alter accounting or dispatch again', async () => {
    const f = temp(); const plan = trialPlan(old.engine, current.engine); const guard = TrialFamilyGuard.claim(f.common, f.output, plan.slots, {});
    let finish!: (response: Response) => void, started!: () => void, payload: any;
    const began = new Promise<void>(resolve => { started = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init: any) => { payload = JSON.parse(init.body); started(); return new Promise<Response>(resolve => { finish = resolve; }); }));
    const controller = new AbortController(); const execution = executeCohort({ old: old.engine, current: current.engine, guard, profiles: plan.profiles, root: f.output, key: 'FAKE_SPEC_KEY', signal: controller.signal });
    const failed = expect(execution).rejects.toThrow(); await began; controller.abort(); await failed;
    const before = guard.snapshot(); finish(mockResponse(payload)); await new Promise(resolve => setTimeout(resolve, 10));
    expect(guard.snapshot()).toEqual(before); expect(before.providerAttempts).toBe(1); expect(before.estimatedUsd).toBeNull();
  }, 30_000);
  it('unsupported resume/root flags reject before source/key work', async () => {
    await expect(main(['--resume'])).rejects.toThrow('trial_arguments');
    await expect(main(['--execute', '--output-root', '/other'])).rejects.toThrow('trial_arguments');
  });
});
