import { describe, expect, it } from 'vitest';
import { personalStoryboardFixture, fixtureEditorOutput } from './personal-storyboard-fixture';
import { preparePersonalStory } from '../story-writer';
import { resolvePersonalWizardOptions } from '../options';
import { prepareStoryEdit, compileStoryEdit, assertStoryEditBinding, editorNeedsWork, storyEditorOutputTokens, storyEditorReservationUsd, STORY_EDITOR_INSTRUCTIONS } from '../story-editor';
import { editedStoryResultSchema, STORY_EDITOR_CRITERIA } from '../story-editor-contract';
import { preparePersonalStoryboard } from '../storyboard';
import { personalBookReservationUsd } from '../book-config';
import { readBookPartialPreview, readBookPreview } from '../book-preview';

const options = resolvePersonalWizardOptions();
async function setup(length = 'short') {
  const f = await personalStoryboardFixture(length);
  const prepared = preparePersonalStory(f.request, options);
  const call = prepareStoryEdit(prepared, f.draftResult);
  return { ...f, prepared, call, output: fixtureEditorOutput(call) };
}
describe('whole-story editing without product or render authority', () => {
  it.each(['short', 'medium', 'long'])('binds a complete edited %s manuscript and preserves original bytes', async length => {
    const f = await setup(length); const before = JSON.stringify(f.draftResult);
    f.output.manuscript.pages[0].text += ' נועה חייכה והציעה רעיון חדש.';
    f.output.plan.beats[0].childAction = 'נועה מציעה רעיון חדש';
    const result = compileStoryEdit(f.prepared, f.draftResult, f.output, { inputTokens: 100, outputTokens: 200 });
    assertStoryEditBinding(result);
    expect(result.editing.original).toEqual({ plan: f.draftResult.plan, manuscript: f.draftResult.manuscript, characterDigest: f.draftResult.characterDigest });
    expect(JSON.stringify(f.draftResult)).toBe(before); expect(result.manuscript.planDigest).toBe(result.planDigest);
    expect(result.planDigest).not.toBe(f.draftResult.planDigest); expect(result.editing.finalDigest).not.toBe(result.editing.draftDigest);
    expect(result.accounting.providerCalls).toBe(3); expect(result.accounting.usage).toHaveLength(3);
    expect(result.runtimeEligible).toBe(false); expect(result.editorialStatus).toBe('pending_product_review');
    expect(result.editing.kind).toBe('model_edit_not_product_acceptance');
    expect(preparePersonalStoryboard(f.request, result, options).story.pages).toEqual(result.manuscript.pages);
  });
  it.each(['outer', 'original'] as const)('detects altered %s character provenance in the editing receipt', async kind => {
    const f = await setup(); const result = structuredClone(f.result);
    if (kind === 'outer') result.characterDigest = 'f'.repeat(64);
    else result.editing.original.characterDigest = 'f'.repeat(64);
    expect(editedStoryResultSchema.safeParse(result).success).toBe(false);
    expect(() => assertStoryEditBinding(result)).toThrow('revision_binding');
  });
  it('reads a self-consistent archived v1 receipt without upgrading its authoring character', async () => {
    const f = await setup(); const legacy = structuredClone(f.result);
    delete legacy.characterDigest; delete legacy.editing.original.characterDigest;
    legacy.editing.version = 'personal-story-editor/diagnostic-v1';
    const { createHash } = await import('node:crypto'); const { canonicalJson } = await import('../request-acceptance');
    const digest = (data: unknown) => createHash('sha256').update(canonicalJson(data)).digest('hex');
    legacy.editing.draftDigest = digest(legacy.editing.original);
    legacy.editing.finalDigest = digest({ plan: legacy.plan, manuscript: legacy.manuscript });
    expect(editedStoryResultSchema.safeParse(legacy).success).toBe(true);
    expect(() => assertStoryEditBinding(legacy)).not.toThrow();
    expect(() => preparePersonalStoryboard(f.request, legacy, options)).toThrow('character_binding');
    expect(f.result.characterDigest).toBeDefined();
  });
  it.each(STORY_EDITOR_CRITERIA)('holds %s without changing any observation to ready', async category => {
    const f = await setup(); f.output.checks[category].outcome = 'needs_work';
    const edited = compileStoryEdit(f.prepared, f.draftResult, f.output, null);
    expect(editorNeedsWork(edited)).toBe(true); expect(edited.accounting.estimatedUsd).toBeNull();
    expect(() => preparePersonalStoryboard(f.request, edited, options)).toThrow('editorial_held');
  });
  it('includes the editing receipt in the visual source identity even when plan and prose are unchanged', async () => {
    const f = await setup(); const changed = structuredClone(f.result);
    changed.editing.checks.causal_magic.note += ' Another model observation, not an approval.';
    assertStoryEditBinding(changed);
    expect(changed.plan).toEqual(f.result.plan); expect(changed.manuscript).toEqual(f.result.manuscript);
    const before = preparePersonalStoryboard(f.request, f.result, options);
    const after = preparePersonalStoryboard(f.request, changed, options);
    expect(after.sourceDigest).not.toBe(before.sourceDigest);
  });
  it('documents that deliberate removal of the receipt can impersonate legacy data, without runtime authority', async () => {
    const f = await setup(); const held = structuredClone(f.result);
    held.editing.checks.causal_magic.outcome = 'needs_work';
    expect(() => preparePersonalStoryboard(f.request, held, options)).toThrow('editorial_held');
    const { editing: _receipt, accounting, ...unedited } = held;
    const legacy = { ...unedited, accounting: { ...accounting, providerCalls: 2, usage: accounting.usage.slice(0, 2) } };
    const source = preparePersonalStoryboard(f.request, legacy, options);
    expect(source.result.runtimeEligible).toBe(false);
    expect(editedStoryResultSchema.safeParse(legacy).success).toBe(false);
  });
  it.each(['request', 'draft', 'pages', 'numbering', 'beats', 'fact', 'interest', 'mode', 'moment', 'duplicate', 'dash', 'direction', 'checks', 'extra'])('rejects edited %s corruption', async kind => {
    const f = await setup(); const raw: any = f.output;
    if (kind === 'request') raw.requestId = 'foreign';
    if (kind === 'draft') raw.draftDigest = 'a'.repeat(64);
    if (kind === 'pages') raw.manuscript.pages.pop();
    if (kind === 'numbering') raw.manuscript.pages[1].pageNumber = 1;
    if (kind === 'beats') raw.plan.beats[1].pageNumber = 1;
    if (kind === 'fact') raw.plan.beats[0].factIds = ['invented_fact'];
    if (kind === 'interest') raw.plan.beats.forEach((b: any) => { b.factIds = []; });
    if (kind === 'mode') raw.plan.resilience.mode = 'chosen_topic';
    if (kind === 'moment') raw.plan.resilience.moments[0].pageNumber = 9;
    if (kind === 'duplicate') raw.plan.resilience.moments.push(raw.plan.resilience.moments[0]);
    if (kind === 'dash') raw.manuscript.pages[0].text += ' — לא טוב';
    if (kind === 'direction') raw.manuscript.pages[0].text += ' imageDirection: do something';
    if (kind === 'checks') delete raw.checks.hebrew_and_age;
    if (kind === 'extra') raw.apiKey = 'private';
    expect(() => compileStoryEdit(f.prepared, f.draftResult, raw, null)).toThrow();
  });
  it('honours an exact exclusion at the final prose boundary', async () => {
    const f = await setup(); f.request.avoid = ['ציפורים'];
    const prepared = preparePersonalStory(f.request, options);
    // Rebind only this synthetic fixture to the changed approved brief.
    const draft = structuredClone(f.draftResult);
    draft.requestId = draft.plan.requestId = draft.manuscript.requestId = prepared.accepted.requestId;
    const { createHash } = await import('crypto'); const { canonicalJson } = await import('../request-acceptance');
    draft.planDigest = draft.manuscript.planDigest = createHash('sha256').update(canonicalJson(draft.plan)).digest('hex');
    draft.planning!.sourcePlanDigest = draft.planDigest;
    const raw = fixtureEditorOutput(prepareStoryEdit(prepared, draft)); raw.manuscript.pages[0].text += ' היו שם ציפורים.';
    expect(() => compileStoryEdit(prepared, draft, raw, null)).toThrow('excluded_subject');
  });
  it.each(['plan', 'original', 'prose', 'receipt'])('detects stale or altered %s revision binding', async kind => {
    const f = await setup(); const result = structuredClone(f.result);
    if (kind === 'plan') result.plan.ending = 'סיום שונה';
    if (kind === 'original') result.editing.original.manuscript.pages[0].text += ' שינוי';
    if (kind === 'prose') result.manuscript.pages[0].text += ' שינוי';
    if (kind === 'receipt') result.editing.draftDigest = 'a'.repeat(64);
    expect(() => assertStoryEditBinding(result)).toThrow('revision_binding');
    expect(() => preparePersonalStoryboard(f.request, result, options)).toThrow();
  });
  it('keeps legacy two-call manuscripts partial/offline only, never a complete v2 book', async () => {
    const f = await setup(); expect(() => preparePersonalStoryboard(f.request, f.draftResult, options)).not.toThrow();
    expect(editedStoryResultSchema.safeParse(f.draftResult).success).toBe(false);
    const accounting = { reservedUsd: 3, estimatedUsd: .1, knownUsageEstimateUsd: .1, providerAttempts: 3, kind: 'usage_estimate_not_invoice' };
    expect(readBookPartialPreview({ error: 'book_editor_invalid', writerResult: f.draftResult, accounting }, f.result.requestId)).not.toBeNull();
    expect(readBookPreview({ version: 'personal-book-runner/diagnostic-v2', status: 'review_supported', writerResult: f.draftResult,
      storyboard: f.book, review: { disposition: 'review_supported', runtimeEligible: false, review: f.review }, runtimeEligible: false, accounting }, f.result.requestId)).toBeNull();
  });
  it.each([8, 12, 16])('reserves reasoning-inclusive editing for %i at both Sol rate cards', count => {
    const cap = 12_000 + 500 * count;
    expect(storyEditorOutputTokens(count)).toBe(cap);
    const amount = (64_000 * 2 + cap * 10) / 1e6 * 1.1;
    expect(storyEditorReservationUsd('gpt-6.1-sol', count)).toBe(amount);
    expect(personalBookReservationUsd('gpt-6.1-sol', count)).toBe(personalBookReservationUsd('gpt-6-sol', count));
  });
  it.each([0, 9, 17, NaN])('rejects unsupported spread count %s', count => expect(() => storyEditorOutputTokens(count)).toThrow());
  it('addresses creative feedback generally, without copying the diagnostic plot into prompts', () => {
    expect(STORY_EDITOR_INSTRUCTIONS).toContain('child a felt experience');
    expect(STORY_EDITOR_INSTRUCTIONS).toContain('important magical rule');
    expect(STORY_EDITOR_INSTRUCTIONS).toContain('generic witty catchphrase');
    expect(STORY_EDITOR_INSTRUCTIONS).not.toMatch(/balloon|tunnel|leaf.pool|bell|Bar|Uri/);
  });
});
