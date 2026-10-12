import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { prepareSimpleStory, writeSimpleStory, type SimpleStoryDraft } from '../simple-story-engine';
import { createCurrentSimpleStorySource } from '../simple-story-source';
import { preparePersonalStoryboard, prepareCurrentPersonalStoryboard, compilePersonalStoryboard, personalStoryboardFrame, personalStoryboardReviewInput,
  storyboardReviewDisposition, storyboardInstructions, storyboardDraftSchema, PERSONAL_STORYBOARD_INSTRUCTION, OWNED_STORYBOARD_INSTRUCTION } from '../storyboard';
import { LANDMARK_KIND_CONTRACT_VERSION, KIND_STORYBOARD_ADDENDUM, KIND_REVIEW_ADDENDUM } from '../storyboard-landmark-kind';
import { personalBookProviderSchema } from '../book-openai';
import { personalBookOutputLimits } from '../book-config';
import { runSimpleStoryboardDiagnostic, type SimpleStoryboardDiagnosticCall } from '../simple-storyboard-diagnostic';
import { auditionPageChecks } from '../simple-book-reviewed-audition';
import { wholeBookDraftSchema } from '../../local-book-planning';
import { textCanonOptions } from '../../../scripts/personal-simple-story';
import { savedLandmarkKindContract } from '../../../scripts/personal-simple-book-reviewed-audition';

const options = resolvePersonalWizardOptions();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
// The fixture's one landmark is the hut; the contract adds its declared kind (and nothing else) to the same draft.
const withKind = (draft: any, value = 'hut', change: (d: any) => void = () => {}) => {
  const d = structuredClone(draft);
  d.plan.continuity.entities.find((e: any) => e.id === 'hut').invariants.push({ attribute: 'kind', value });
  change(d);
  return d;
};
async function kindBook() {
  const f = await personalStoryboardFixture();
  const source = preparePersonalStoryboard(f.request, f.result, options, undefined, undefined, true);
  const book = compilePersonalStoryboard(source, withKind(f.draft));
  return { ...f, source, kindBook: book, kindReview: { ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest } };
}

describe('storyboard landmark-kind contract (opt-in, source-bound)', () => {
  it('flag absent: every existing identity, instruction and schema is byte-identical (pinned before the change, at 22616c00)', async () => {
    const f = await personalStoryboardFixture();
    expect(preparePersonalStoryboard(f.request, f.result, options).sourceDigest).toBe('f1ad9a28816945b860324527a4050018ecd43cbb4eae2bd01b60975dfc4344f5');
    expect(preparePersonalStoryboard(f.request, f.result, options, true).sourceDigest).toBe('a72da5d557dba2e097c190febd3c0940ed1ac6a9b292f2b4e12aebb4ef379edb');
    expect(f.book.storyboardDigest).toBe('cb09f0812bafb902f1a7c27de12cc0593636b42b2e33498ac9501c20402c8c1f');
    expect(personalStoryboardFrame(f.book, f.review, 1, f.current).packetDigest).toBe('d737d76dc01ff5f9311247ec78c78a79cdf09b4579802a0b3a7160e8454514a1');
    expect(sha(PERSONAL_STORYBOARD_INSTRUCTION)).toBe('858f442ec1fde66c0ae79382fa961a50b1fd88803599570799264527edcc04bd');
    expect(sha(OWNED_STORYBOARD_INSTRUCTION)).toBe('a2286e4848e970b8ccef0917b0580801dbd64ab664b873f5774c3d3cc29fc8e7');
    expect(storyboardInstructions({})).toBe(PERSONAL_STORYBOARD_INSTRUCTION);
    expect('landmarkKind' in f.book).toBe(false);
    expect('landmarkKindContract' in personalStoryboardReviewInput(f.book)).toBe(false);
    // The contract changes no schema: kind is an ordinary invariant whose meaning is switched on by the bound marker only.
    expect(storyboardDraftSchema({ landmarkKindContract: true })).toBe(wholeBookDraftSchema);
  });

  it('flag absent: an invariant that happens to be named "kind" stays ordinary design data', async () => {
    const f = await personalStoryboardFixture();
    const book = compilePersonalStoryboard(preparePersonalStoryboard(f.request, f.result, options), withKind(f.draft, 'beside a red sign'));
    expect('landmarkKind' in book).toBe(false);
    const hut = auditionPageChecks(book, 1, 'x').uniqueLandmarks.find(l => l.id === 'hut')!;
    expect(hut.features.some(feature => feature.aspect === 'kind')).toBe(false);
    expect(hut.features.map(feature => `${feature.decisive ? '+' : '~'}${feature.aspect}:${feature.text}`)).toEqual(['+material:wood', '~colour:red']);
  });

  it('flag on: the marker is bound into source, book, review input and frame, and the kind becomes a decisive cue of its own aspect', async () => {
    const k = await kindBook();
    const plain = preparePersonalStoryboard(k.request, k.result, options);
    expect(k.source.sourceDigest).not.toBe(plain.sourceDigest);
    expect(k.kindBook.landmarkKind).toBe(LANDMARK_KIND_CONTRACT_VERSION);
    const legacySameDraft = compilePersonalStoryboard(plain, withKind(k.draft));
    expect(k.kindBook.plan).toEqual(legacySameDraft.plan);
    expect(k.kindBook.storyboardDigest).not.toBe(legacySameDraft.storyboardDigest);
    expect(storyboardInstructions({ landmarkKindContract: true })).toBe(`${PERSONAL_STORYBOARD_INSTRUCTION}\n${KIND_STORYBOARD_ADDENDUM}`);
    expect(personalStoryboardReviewInput(k.kindBook).landmarkKindContract).toEqual({ version: LANDMARK_KIND_CONTRACT_VERSION, landmarks: [{ id: 'hut', kind: 'hut' }] });
    expect(personalStoryboardFrame(k.kindBook, k.kindReview, 1, k.current).context.landmarkKind).toBe(LANDMARK_KIND_CONTRACT_VERSION);
    const hut = auditionPageChecks(k.kindBook, 1, 'x').uniqueLandmarks.find(l => l.id === 'hut')!;
    expect(hut.features.map(feature => `${feature.decisive ? '+' : '~'}${feature.aspect}:${feature.text}`)).toEqual(['+kind:hut', '+material:wood']);
    // The same book compiled without the contract reads the same invariant as plain text: no kind aspect.
    expect(auditionPageChecks(legacySameDraft, 1, 'x').uniqueLandmarks[0].features.some(feature => feature.aspect === 'kind')).toBe(false);
  });

  it('flag on: a missing, duplicated, mutable or non-object kind fails closed (syntax only; meaning is the review\'s)', async () => {
    const k = await kindBook();
    const compile = (draft: unknown) => compilePersonalStoryboard(k.source, draft);
    expect(() => compile(structuredClone(k.draft))).toThrow('personal_storyboard_landmark_kind');
    // A kind under any other spelling of the attribute is not the contract's kind.
    const miscased = structuredClone(k.draft) as any;
    miscased.plan.continuity.entities.find((e: any) => e.id === 'hut').invariants.push({ attribute: 'Kind', value: 'hut' });
    expect(() => compile(miscased)).toThrow('personal_storyboard_landmark_kind');
    for (const value of ['beside the hut', 'not a hut', 'small wooden garden hut', 'hut!', 'hut and shed'])
      expect(() => compile(withKind(k.draft, value))).toThrow('personal_storyboard_landmark_kind');
    expect(() => compile(withKind(k.draft, 'hut', d => d.plan.continuity.entities[0].invariants.push({ attribute: 'Kind', value: 'shed' }))))
      .toThrow('personal_storyboard_landmark_kind');
    expect(() => compile(withKind(k.draft, 'hut', d => d.sequence.mutableAttributes.push({ entityId: 'hut', attribute: 'kind' }))))
      .toThrow('personal_storyboard_landmark_kind');
    expect(() => preparePersonalStoryboard(k.request, k.result, options, undefined, undefined, 'yes' as never)).toThrow('landmark_kind_policy');
    // The review instruction carries the semantic responsibility; syntax alone never qualifies a kind.
    expect(KIND_REVIEW_ADDENDUM).toContain('names what sort of object that landmark itself is');
  });

  it('a stripped, added or foreign marker, a swapped review or a misbound book is refused', async () => {
    const k = await kindBook();
    const { landmarkKind: _marker, ...stripped } = k.kindBook;
    expect(() => personalStoryboardReviewInput(stripped as never)).toThrow('unvalidated_or_changed_book');
    expect(() => personalStoryboardReviewInput({ ...k.book, landmarkKind: LANDMARK_KIND_CONTRACT_VERSION } as never)).toThrow('unvalidated_or_changed_book');
    // A plain-contract review cannot be replayed onto the kind storyboard, nor the reverse.
    expect(() => storyboardReviewDisposition(k.kindBook, k.review)).toThrow('review_binding');
    expect(() => storyboardReviewDisposition(k.book, k.kindReview)).toThrow('review_binding');
    // The audition only accepts the exact version, and the runner takes the flag only from the saved, digest-bound book.
    expect(() => auditionPageChecks({ ...k.kindBook, landmarkKind: 'storyboard-landmark-kind/v0' } as never, 1, 'x')).toThrow('audition_landmark_kind');
    expect(savedLandmarkKindContract(undefined)).toBeUndefined();
    expect(savedLandmarkKindContract({})).toBeUndefined();
    expect(savedLandmarkKindContract({ landmarkKind: LANDMARK_KIND_CONTRACT_VERSION })).toBe(true);
    expect(() => savedLandmarkKindContract({ landmarkKind: 'storyboard-landmark-kind/v0' })).toThrow('audition_board_binding');
  });

  it('the provider context accepts only true for the flag', () => {
    const call = (landmarkKindContract?: unknown) => ({ stage: 'storyboard' as const, instructions: 'x', input: '{}',
      maxOutputTokens: personalBookOutputLimits(8).storyboardOutputTokens,
      context: { narrativeSpreads: 8, sourceDigest: 'a'.repeat(64), ...(landmarkKindContract !== undefined ? { landmarkKindContract } : {}) } });
    expect(() => personalBookProviderSchema(call(true) as never)).not.toThrow();
    expect(() => personalBookProviderSchema(call('yes') as never)).toThrow('book_provider_context');
  });

  it('the diagnostic driver carries the flag to both calls and the review instruction; an old approval is not reused', async () => {
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
    const kindDraft = withKind(f.draft);
    const book = compilePersonalStoryboard(prepareCurrentPersonalStoryboard(f.request, writerResult, textOptions, undefined, undefined, true), kindDraft);
    const review = { ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest };
    const generate = vi.fn(async (call: SimpleStoryboardDiagnosticCall) => structuredClone(call.stage === 'storyboard' ? kindDraft : review));
    const result = await runSimpleStoryboardDiagnostic({ request: f.request, writerResult, options: textOptions, signal: new AbortController().signal, generate,
      landmarkKindContract: true });
    const [storyboardCall, reviewCall] = generate.mock.calls.map(c => c[0]);
    expect(storyboardCall.instructions.endsWith(KIND_STORYBOARD_ADDENDUM)).toBe(true);
    expect(storyboardCall.context).toMatchObject({ landmarkKindContract: true });
    expect(reviewCall.instructions.endsWith(KIND_REVIEW_ADDENDUM)).toBe(true);
    expect(reviewCall.context).toMatchObject({ landmarkKindContract: true });
    expect(JSON.parse(reviewCall.input).landmarkKindContract).toEqual({ version: LANDMARK_KIND_CONTRACT_VERSION, landmarks: [{ id: 'hut', kind: 'hut' }] });
    expect(result).toMatchObject({ status: 'review_supported', storyboardDigest: book.storyboardDigest });
    expect(result.framePackets[1].context.landmarkKind).toBe(LANDMARK_KIND_CONTRACT_VERSION);
    // A plain-contract review cannot be replayed onto the kind storyboard.
    const plainBook = compilePersonalStoryboard(prepareCurrentPersonalStoryboard(f.request, writerResult, textOptions), withKind(f.draft));
    const stale = { ...review, sourceDigest: plainBook.sourceDigest, storyboardDigest: plainBook.storyboardDigest };
    const replay = vi.fn(async (call: SimpleStoryboardDiagnosticCall) => structuredClone(call.stage === 'storyboard' ? kindDraft : stale));
    await expect(runSimpleStoryboardDiagnostic({ request: f.request, writerResult, options: textOptions, signal: new AbortController().signal,
      generate: replay, landmarkKindContract: true })).rejects.toThrow('review_binding');
  });
});
