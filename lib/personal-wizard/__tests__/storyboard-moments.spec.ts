import { describe, expect, it, vi } from 'vitest';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { prepareSimpleStory, writeSimpleStory, type SimpleStoryDraft } from '../simple-story-engine';
import { createCurrentSimpleStorySource } from '../simple-story-source';
import { preparePersonalStoryboard, prepareCurrentPersonalStoryboard, compilePersonalStoryboard, personalStoryboardFrame,
  personalStoryboardReviewInput, storyboardInstructions, storyboardDraftSchema, OWNED_STORYBOARD_INSTRUCTION, PERSONAL_STORYBOARD_INSTRUCTION } from '../storyboard';
import { MOMENT_STORYBOARD_ADDENDUM, MOMENT_REVIEW_ADDENDUM, STORYBOARD_MOMENTS_VERSION } from '../storyboard-moments';
import { personalBookProviderSchema } from '../book-openai';
import { personalBookOutputLimits } from '../book-config';
import { runSimpleStoryboardDiagnostic, type SimpleStoryboardDiagnosticCall } from '../simple-storyboard-diagnostic';
import { wholeBookDraftSchema, ownedWholeBookDraftSchema } from '../../local-book-planning';
import { textCanonOptions } from '../../../scripts/personal-simple-story';

const options = resolvePersonalWizardOptions();
// Page 6 ends with both actors INSIDE the hut; the picture may show the instant of climbing back in.
const moments = (count: number, change: (frames: any[]) => void = () => {}) => {
  const frames: any[] = Array.from({ length: count + 1 }, () => ({ requirements: [], depicted: null }));
  frames[0].requirements = [{ kind: 'avoid', subject: 'no second ribbon or new objects before the story starts', evidence: 'הסרט האדום' }];
  frames[6] = { requirements: [{ kind: 'show', subject: 'the red ribbon still in the child\'s hand', evidence: 'the ribbon stays with נועה' }],
    depicted: { evidence: 'They climb inside the hut again', attributes: [], relations: ['child', 'companion'].map(entityId =>
      ({ entityId, value: { relation: 'beside', targetId: 'hut' }, evidence: 'They climb inside the hut again' })) } };
  change(frames);
  return { version: STORYBOARD_MOMENTS_VERSION, frames };
};
async function books(change?: (frames: any[]) => void) {
  const f = await personalStoryboardFixture(), count = f.result.manuscript.pages.length;
  const source = preparePersonalStoryboard(f.request, f.result, options, undefined, true);
  const book = compilePersonalStoryboard(source, { ...structuredClone(f.draft), moments: moments(count, change) });
  const review = { ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest };
  return { ...f, count, source, book, momentReview: review };
}

describe('storyboard moments contract (drawn instant separate from the end-of-page ledger)', () => {
  it('is opt-in: the existing source, schema and instruction are untouched without the flag', async () => {
    const f = await personalStoryboardFixture();
    expect(storyboardInstructions({})).toBe(PERSONAL_STORYBOARD_INSTRUCTION);
    expect(storyboardInstructions({ actorOwnedAppearance: true })).toBe(OWNED_STORYBOARD_INSTRUCTION);
    expect(storyboardDraftSchema({})).toBe(wholeBookDraftSchema);
    expect(storyboardDraftSchema({ actorOwnedAppearance: true })).toBe(ownedWholeBookDraftSchema);
    expect('moments' in f.book).toBe(false);
    expect(storyboardInstructions({ momentContract: true })).toBe(`${PERSONAL_STORYBOARD_INSTRUCTION}\n${MOMENT_STORYBOARD_ADDENDUM}`);
    const plain = preparePersonalStoryboard(f.request, f.result, options), moment = preparePersonalStoryboard(f.request, f.result, options, undefined, true);
    expect(moment.sourceDigest).not.toBe(plain.sourceDigest);
    expect(() => compilePersonalStoryboard(plain, { ...structuredClone(f.draft), moments: moments(f.result.manuscript.pages.length) })).toThrow('moments_not_enabled');
    expect(() => compilePersonalStoryboard(moment, structuredClone(f.draft))).toThrow('moments_required');
  });

  it('keeps the ledger identical and projects the drawn instant only into that frame', async () => {
    const m = await books();
    expect(m.book.moments!.frames[6].depicted!.relations).toHaveLength(2);
    const reference = compilePersonalStoryboard(preparePersonalStoryboard(m.request, m.result, options), structuredClone(m.draft));
    expect(m.book.sequence).toEqual(reference.sequence);
    expect(m.book.plan).toEqual(reference.plan);
    expect(m.book.storyboardDigest).not.toBe(reference.storyboardDigest);
    const frame = personalStoryboardFrame(m.book, m.momentReview, 6, m.current);
    const relations = Object.fromEntries((frame.context.sequence as any).relations.map((s: any) => [s.entityId, s.value]));
    expect(relations.child).toEqual({ relation: 'beside', targetId: 'hut' });
    expect((frame.context.sequence as any).endOfPageLedger).toEqual([
      { entityId: 'child', value: { relation: 'inside', targetId: 'hut' } }, { entityId: 'companion', value: { relation: 'inside', targetId: 'hut' } }]);
    expect(frame.context).toMatchObject({ moment: { version: STORYBOARD_MOMENTS_VERSION, requirements: [expect.objectContaining({ kind: 'show' })] } });
    expect(frame.render.prompt).toContain('DRAWN INSTANT (this picture, not the end of the page): "They climb inside the hut again"');
    expect(frame.render.prompt).toContain('MUST SHOW: the red ribbon still in the child\'s hand');
    // Neighbouring frames keep end-of-page relations and carry no drawn instant.
    const next = personalStoryboardFrame(m.book, m.momentReview, 5, m.current);
    expect((next.context.sequence as any).drawnInstant).toBeUndefined();
    expect(next.context).toMatchObject({ moment: { depicted: null, requirements: [] } });
    expect(personalStoryboardReviewInput(m.book)).toMatchObject({ moments: m.book.moments });
    const cover = personalStoryboardFrame(m.book, m.momentReview, 0, m.current);
    expect(cover.render.prompt).toContain('MUST AVOID: no second ribbon');
  });

  it('refuses unquoted, impossible or no-op instants instead of trusting the author', async () => {
    const cases: [string, (frames: any[]) => void][] = [
      ['depicted_evidence', frames => { frames[6].depicted.evidence = 'They fly away on the ribbon'; }],
      ['depicted_evidence', frames => { frames[6].depicted.relations[0].evidence = 'not on this page'; }],
      ['cover_depicted', frames => { frames[0].depicted = frames[6].depicted; }],
      ['unknown_entity', frames => { frames[6].depicted.relations[0].entityId = 'ghost'; }],
      ['depicted_noop', frames => { frames[6].depicted.relations[0].value = { relation: 'inside', targetId: 'hut' }; }],
      ['drawn_relation_binding', frames => { frames[6].depicted.relations.push({ entityId: 'ribbon', value: { relation: 'unestablished', targetId: null }, evidence: 'the ribbon stays with נועה' }); }],
      ['drawn_custody_target', frames => { frames[6].depicted.relations.push({ entityId: 'ribbon', value: { relation: 'held_by', targetId: 'hut' }, evidence: 'the ribbon stays with נועה' }); }],
      ['depicted_attribute', frames => { frames[6].depicted.attributes.push({ entityId: 'ribbon', attribute: 'color', value: 'blue', evidence: 'the ribbon stays with נועה' }); }],
      ['depicted_empty', frames => { frames[6].depicted.relations = []; }],
      ['requirement_evidence', frames => { frames[6].requirements[0].evidence = 'a quote from another page'; }],
      ['requirement_evidence', frames => { frames[2].requirements = [{ kind: 'show', subject: 'the ribbon', evidence: 'the ribbon stays with נועה' }]; }],
      ['duplicate_requirement', frames => { frames[6].requirements.push({ ...frames[6].requirements[0] }); }],
    ];
    for (const [code, change] of cases) await expect(books(change), code).rejects.toThrow(`storyboard_moments_${code}`);
  });

  it('adds the moments object to the provider schema only for the opt-in call', () => {
    const call = (momentContract?: true) => ({ stage: 'storyboard' as const, instructions: 'x', input: '{}',
      maxOutputTokens: personalBookOutputLimits(8).storyboardOutputTokens,
      context: { narrativeSpreads: 8, sourceDigest: 'a'.repeat(64), ...(momentContract ? { momentContract } : {}) } });
    expect('moments' in (personalBookProviderSchema(call()) as any).shape).toBe(false);
    const schema = personalBookProviderSchema(call(true)) as any;
    expect(schema.shape.moments.shape.frames.safeParse(Array(9).fill({ requirements: [], depicted: null })).success).toBe(true);
    expect(schema.shape.moments.shape.frames.safeParse(Array(8).fill({ requirements: [], depicted: null })).success).toBe(false);
    expect(() => personalBookProviderSchema({ ...call(), context: { ...call().context, momentContract: 'yes' as never } })).toThrow('book_provider_context');
  });

  it('drives a new storyboard and a NEW review under the contract (old approval is not reused)', async () => {
    const f = await personalStoryboardFixture(), textOptions = textCanonOptions(resolvePersonalWizardOptions());
    const prepared = prepareSimpleStory(f.request, textOptions, 'diagnostic-fixture'), plan = f.result.plan;
    const draft: SimpleStoryDraft = { title: plan.title, childGoal: plan.childGoal, companionWant: plan.companionWant, comicPromise: plan.comicPromise,
      ending: plan.ending, pages: f.result.manuscript.pages.map(page => ({ text: `${page.text} נועה ודיני משחקות בציור.` })),
      pageMap: plan.beats.map(({ pageNumber: _page, ...row }) => row),
      resilienceMoments: plan.resilience.moments.map(({ pageNumber, ...row }) => ({ page: pageNumber, ...row })) };
    const records: Record<string, any> = {};
    const generated = await writeSimpleStory(prepared, async call => {
      const output = call.stage === 'author' ? structuredClone(draft) : { ...structuredClone(draft), editorChanges: ['Synthetic structural fixture.'] };
      const usage = { inputTokens: 1000, outputTokens: 2000 }, termination = { code: 0, signal: null };
      records[call.stage] = { output, usage, estimatedMicroUsd: 100000, metadata: { kind: 'cli_reported_estimate_not_invoice', reportedModels: ['claude-opus-5-5'], termination },
        raw: { termination, killConfirmed: true, stopped: false, stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false,
          session_id: call.stage === 'author' ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222',
          total_cost_usd: .1, modelUsage: { 'claude-opus-5-5': usage }, structured_output: output }) } };
      return { output, usage, estimatedUsd: .1 };
    }, { model: 'claude-opus-5-5', reservedUsd: 2 });
    const writerResult = createCurrentSimpleStorySource(f.request, generated, records as { author: unknown; editor: unknown }, textOptions);
    const momentDraft = { ...structuredClone(f.draft), moments: moments(f.result.manuscript.pages.length) };
    const book = compilePersonalStoryboard(prepareCurrentPersonalStoryboard(f.request, writerResult, textOptions, undefined, true), momentDraft);
    const review = { ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest };
    const generate = vi.fn(async (call: SimpleStoryboardDiagnosticCall) => structuredClone(call.stage === 'storyboard' ? momentDraft : review));
    const result = await runSimpleStoryboardDiagnostic({ request: f.request, writerResult, options: textOptions, signal: new AbortController().signal, generate, momentContract: true });
    const [storyboardCall, reviewCall] = generate.mock.calls.map(c => c[0]);
    expect(storyboardCall.instructions.endsWith(MOMENT_STORYBOARD_ADDENDUM)).toBe(true);
    expect(storyboardCall.context).toMatchObject({ momentContract: true });
    expect(reviewCall.instructions.endsWith(MOMENT_REVIEW_ADDENDUM)).toBe(true);
    expect(JSON.parse(reviewCall.input).moments).toEqual(book.moments);
    expect(result).toMatchObject({ status: 'review_supported', storyboardDigest: book.storyboardDigest });
    expect(result.framePackets[6].render.prompt).toContain('DRAWN INSTANT');
    // A plain-contract review cannot be replayed onto the moments storyboard.
    const plainBook = compilePersonalStoryboard(prepareCurrentPersonalStoryboard(f.request, writerResult, textOptions), structuredClone(f.draft));
    const stale = { ...review, sourceDigest: plainBook.sourceDigest, storyboardDigest: plainBook.storyboardDigest };
    const replay = vi.fn(async (call: SimpleStoryboardDiagnosticCall) => structuredClone(call.stage === 'storyboard' ? momentDraft : stale));
    await expect(runSimpleStoryboardDiagnostic({ request: f.request, writerResult, options: textOptions, signal: new AbortController().signal,
      generate: replay, momentContract: true })).rejects.toThrow('review_binding');
  });
});
