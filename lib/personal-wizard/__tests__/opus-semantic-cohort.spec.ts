import { describe, expect, it } from 'vitest';
import { companionTrialCohort } from '../../../scripts/personal-book-companion-cohort';
import { preparePersonalStory } from '../story-writer';
import { resolvePersonalWizardOptions } from '../options';
import { personalManuscriptSchema, personalStoryPlanSchema } from '../story-contract';
import { comparableText } from '../contract';
import { canonicalJson } from '../request-acceptance';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { prepareStoryEdit } from '../story-editor';
import { storyEditorProviderSchema } from '../story-editor-openai';
// Importing the runner never calls the CLI or executes main.
const runner = require('../../../scripts/personal-opus-semantic-cohort.cjs');
const engine = { companionTrialCohort, preparePersonalStory, resolvePersonalWizardOptions, personalStoryPlanSchema, personalManuscriptSchema, comparableText, canonicalJson };
describe('one-use six-book Opus diagnostic, no forged GPT accounting', () => {
  it('randomizes reproducibly with six companions, balanced lengths and intact fictional biography', () => {
    const cases = runner.buildCases(engine, 'frozen-seed');
    expect(runner.buildCases(engine, 'frozen-seed')).toEqual(cases);
    expect(runner.buildCases(engine, 'different-seed')).not.toEqual(cases);
    expect(new Set(cases.map((c: any) => c.request.companion.id)).size).toBe(6);
    for (const n of [8, 12, 16]) expect(cases.filter((c: any) => c.brief.beats === n)).toHaveLength(2);
    expect(cases.reduce((n: number, c: any) => n + c.capUsd * 2, 0)).toBe(12);
    for (const c of cases) {
      const original = companionTrialCohort().find(row => row.id === c.id)!;
      expect(c.request.child).toEqual(original.request.child); expect(c.request.facts).toEqual(original.request.facts);
      expect(c.request.intent).toEqual(original.request.intent); expect(c.brief.child).toHaveProperty('name');
    }
  });
  it.each(['model', 'cost', 'over', 'total', 'native', 'timeout', 'error', 'utf8'])('seals %s failure instead of allowing another dispatch', kind => {
    const payload: any = { subtype: 'success', is_error: false, modelUsage: { 'claude-opus-5-5': {} }, total_cost_usd: .2 };
    if (kind === 'model') payload.modelUsage = { other: {} };
    if (kind === 'cost') delete payload.total_cost_usd;
    if (kind === 'over') payload.total_cost_usd = .81;
    if (kind === 'error') payload.is_error = true;
    expect(() => runner.validateCli(payload, { code: kind === 'native' ? 1 : 0, signal: null }, kind === 'timeout', kind === 'utf8' ? '\ufffd' : '{}', .8, kind === 'total' ? 11900000 : 0)).toThrow();
  });
  it('keeps native cost exact in the receipt guard without converting tokens at GPT prices', () => {
    expect(runner.validateCli({ subtype: 'success', is_error: false, modelUsage: { 'claude-opus-5-5': {} }, total_cost_usd: .2892632 }, { code: 0, signal: null }, false, '{}', .8, 0)).toBe(289263);
  });
  it('admits matching documents without any production accounting envelope', async () => {
    const f = await personalStoryboardFixture(); const prepared = preparePersonalStory(f.request, resolvePersonalWizardOptions());
    const call = prepareStoryEdit(prepared, f.draftResult);
    const context = JSON.parse(call.input), raw = { requestId: context.brief.requestId, plan: context.draft.plan, manuscript: context.draft.manuscript };
    const normalized = runner.normalize(raw, prepared.brief, engine);
    expect(normalized).toEqual(context.draft); expect(normalized).not.toHaveProperty('accounting');
    const schema = storyEditorProviderSchema(call);
    expect(schema.shape).toHaveProperty('semanticAudit');
    expect(schema.omit({ draftDigest: true, checks: true, semanticAudit: true }).shape).not.toHaveProperty('semanticAudit');
    for (const change of ['request', 'fact', 'mode', 'prose']) {
      const broken = structuredClone(raw);
      if (change === 'request') broken.requestId = 'other';
      if (change === 'fact') broken.plan.beats[0].factIds = ['unknown'];
      if (change === 'mode') broken.plan.resilience.mode = 'chosen_topic';
      if (change === 'prose') broken.manuscript.pages[0].text += ' imageDirection: stale';
      expect(() => runner.normalize(broken, prepared.brief, engine)).toThrow();
    }
  });
});
