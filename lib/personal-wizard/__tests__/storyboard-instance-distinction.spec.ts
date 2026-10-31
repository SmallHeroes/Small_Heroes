import { describe, expect, it, vi } from 'vitest';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { prepareSimpleStory, writeSimpleStory, type SimpleStoryDraft } from '../simple-story-engine';
import { createCurrentSimpleStorySource } from '../simple-story-source';
import { preparePersonalStoryboard, prepareCurrentPersonalStoryboard, compilePersonalStoryboard, personalStoryboardFrame, personalStoryboardReviewInput,
  storyboardReviewDisposition, storyboardInstructions, storyboardDraftSchema, PERSONAL_STORYBOARD_INSTRUCTION } from '../storyboard';
import { KIND_STORYBOARD_ADDENDUM, KIND_REVIEW_ADDENDUM } from '../storyboard-landmark-kind';
import { INSTANCE_DISTINCTION_VERSION, INSTANCE_STORYBOARD_ADDENDUM, INSTANCE_REVIEW_ADDENDUM, splitLocationPopulations } from '../storyboard-instance-distinction';
import { personalBookProviderSchema } from '../book-openai';
import { personalBookOutputLimits } from '../book-config';
import { runSimpleStoryboardDiagnostic, storyboardReviewInstructions, type SimpleStoryboardDiagnosticCall } from '../simple-storyboard-diagnostic';
import { wholeBookDraftSchema } from '../../local-book-planning';
import { textCanonOptions } from '../../../scripts/personal-simple-story';

const options = resolvePersonalWizardOptions();
const ERROR = 'personal_storyboard_instance_distinction';
// Positional contracts after options: landmark kind (always) and, when asked, instance distinction (the 16th).
const flags = (instance?: true) => [undefined, undefined, true, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, instance] as const;
type Mark = { kind?: string; distinction?: string };
/**
 * The fixture's two locations (garden, lane), one landmark (hut) and one prop (ribbon), annotated under the contract. Two synthetic worlds:
 * W1 forest (a "tree" landmark among "tree" dressing, told apart by a lightning split) and W2 harbour (a "boat" prop among "boat" dressing).
 */
const annotate = (draft: any, o: { populations?: Record<string, string[] | undefined>; hut?: Mark; ribbon?: Mark; change?: (d: any) => void } = {}) => {
  const d = structuredClone(draft), populations = o.populations ?? { garden: [], lane: [] };
  for (const l of d.plan.locations) if (populations[l.id] !== undefined) l.population = populations[l.id];
  for (const [id, m] of [['hut', o.hut ?? { kind: 'hut' }], ['ribbon', o.ribbon ?? { kind: 'ribbon' }]] as const) {
    const e = d.plan.continuity.entities.find((x: any) => x.id === id);
    if (m.kind !== undefined) e.invariants.push({ attribute: 'kind', value: m.kind });
    if (m.distinction !== undefined) e.invariants.push({ attribute: 'distinction', value: m.distinction });
  }
  o.change?.(d);
  return d;
};
const W1 = { populations: { garden: ['tree'], lane: [] }, hut: { kind: 'tree', distinction: 'split by lightning down its trunk' } };
const W2 = { populations: { garden: [], lane: ['boat'] }, ribbon: { kind: 'boat', distinction: 'a red sail with a white star' } };

async function world() {
  const f = await personalStoryboardFixture();
  const source = preparePersonalStoryboard(f.request, f.result, options, ...flags(true));
  const compile = (draft: unknown) => compilePersonalStoryboard(source, draft);
  return { ...f, source, compile };
}

describe('instance-distinction/v1: the compiler admits only internally consistent annotations', () => {
  it('flag absent: instruction, schema and kind-only source are exactly as before; the flag needs the kind contract', async () => {
    const f = await personalStoryboardFixture();
    expect(storyboardInstructions({ landmarkKindContract: true })).toBe(`${PERSONAL_STORYBOARD_INSTRUCTION}\n${KIND_STORYBOARD_ADDENDUM}`);
    expect(storyboardDraftSchema({ landmarkKindContract: true })).toBe(wholeBookDraftSchema);
    expect(storyboardReviewInstructions({ landmarkKindContract: true }).endsWith(KIND_REVIEW_ADDENDUM)).toBe(true);
    const kindOnly = preparePersonalStoryboard(f.request, f.result, options, ...flags()), both = preparePersonalStoryboard(f.request, f.result, options, ...flags(true));
    expect(both.sourceDigest).not.toBe(kindOnly.sourceDigest);
    expect('instanceDistinctionContract' in kindOnly).toBe(false);
    const noKind = [undefined, undefined, undefined, ...flags(true).slice(3)] as unknown as ReturnType<typeof flags>;
    expect(() => preparePersonalStoryboard(f.request, f.result, options, ...noKind)).toThrow('instance_distinction_policy');
    const yes = [...flags().slice(0, 15), 'yes'] as unknown as ReturnType<typeof flags>;
    expect(() => preparePersonalStoryboard(f.request, f.result, options, ...yes)).toThrow('instance_distinction_policy');
  });

  it('W1 forest: a "tree" landmark among "tree" dressing with a fixed distinction is admitted and bound in book, digest and review input', async () => {
    const w = await world(), book = w.compile(annotate(w.draft, W1));
    expect(book.instanceDistinction).toEqual({ version: INSTANCE_DISTINCTION_VERSION,
      populations: [{ locationId: 'garden', kinds: ['tree'] }, { locationId: 'lane', kinds: [] }],
      entities: [{ id: 'hut', kind: 'tree', distinction: 'split by lightning down its trunk' }, { id: 'ribbon', kind: 'ribbon', distinction: null }] });
    expect(personalStoryboardReviewInput(book).instanceDistinctionContract).toEqual(book.instanceDistinction);
    // The populations never reach the unchanged plan; the kind-only book of the same draft has the same plan and another digest.
    const kindOnly = compilePersonalStoryboard(preparePersonalStoryboard(w.request, w.result, options, ...flags()), splitLocationPopulations(annotate(w.draft, W1)).draft);
    expect(book.plan).toEqual(kindOnly.plan); expect(book.plan.locations.some(l => 'population' in l)).toBe(false);
    expect(book.storyboardDigest).not.toBe(kindOnly.storyboardDigest);
    const review = { ...structuredClone(w.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest };
    expect(personalStoryboardFrame(book, review, 1, w.current).context.storyboardDigest).toBe(book.storyboardDigest);
    expect(storyboardInstructions(w.source)).toContain(`${KIND_STORYBOARD_ADDENDUM}\n${INSTANCE_STORYBOARD_ADDENDUM}`);
  });

  it('W2 harbour: a "boat" prop among "boat" dressing needs its distinction; matching keys without one refuse', async () => {
    const w = await world();
    expect(w.compile(annotate(w.draft, W2)).instanceDistinction!.entities.find(e => e.id === 'ribbon'))
      .toEqual({ id: 'ribbon', kind: 'boat', distinction: 'a red sail with a white star' });
    expect(() => w.compile(annotate(w.draft, { ...W2, ribbon: { kind: 'boat' } }))).toThrow(ERROR);
    expect(() => w.compile(annotate(w.draft, { ...W1, hut: { kind: 'tree' } }))).toThrow(ERROR);
  });

  it('different keys never collide, and matching is exact: no alias, stemming or sub-type ("oak tree" is not "tree")', async () => {
    const w = await world();
    for (const kind of ['rock', 'oak', 'oak tree', 'trees']) expect(() => w.compile(annotate(w.draft, { ...W1, hut: { kind } }))).not.toThrow();
  });

  it('every location declares its population: absent refuses, [] is "no same-sort dressing"; keys use the kind syntax', async () => {
    const w = await world();
    expect(() => w.compile(annotate(w.draft, { populations: { garden: [], lane: [] } }))).not.toThrow();
    expect(() => w.compile(annotate(w.draft, { populations: { garden: ['tree'], lane: undefined }, hut: W1.hut }))).toThrow(ERROR);
    for (const kinds of [['beside the hut'], ['tree!'], ['tree', 'Tree'], ['small old garden tree']])
      expect(() => w.compile(annotate(w.draft, { populations: { garden: kinds, lane: [] }, hut: W1.hut }))).toThrow(ERROR);
  });

  it('every prop and landmark declares exactly one kind; at most one exact distinction; kind and distinction are never mutable', async () => {
    const w = await world();
    expect(() => w.compile(annotate(w.draft, { ribbon: {} }))).toThrow(ERROR);
    expect(() => w.compile(annotate(w.draft, { ribbon: { kind: 'not a ribbon' } }))).toThrow(ERROR);
    // A second exact "distinction" is already the plan compiler's duplicate attribute; a second spelling is this contract's refusal.
    expect(() => w.compile(annotate(w.draft, { ...W1, change: d => d.plan.continuity.entities[0].invariants.push({ attribute: 'distinction', value: 'a second cue' }) })))
      .toThrow('duplicate_continuity_attribute');
    expect(() => w.compile(annotate(w.draft, { ...W1, change: d => d.plan.continuity.entities[0].invariants.push({ attribute: 'Distinction', value: 'a second cue' }) })))
      .toThrow(ERROR);
    expect(() => w.compile(annotate(w.draft, { ...W1, change: d => d.plan.continuity.entities[0].invariants.find((i: any) => i.attribute === 'distinction').attribute = 'Distinction' })))
      .toThrow(ERROR);
    expect(() => w.compile(annotate(w.draft, { ...W1, change: d => d.sequence.mutableAttributes.push({ entityId: 'hut', attribute: 'distinction' }) }))).toThrow(ERROR);
    expect(() => w.compile(annotate(w.draft, { ...W2, change: d => d.sequence.mutableAttributes.push({ entityId: 'ribbon', attribute: 'kind' }) }))).toThrow(ERROR);
  });

  it('two story objects of one kind each need a distinction, and the two must differ', async () => {
    const w = await world(), shared = (hut: string | undefined, ribbon: string | undefined) => annotate(w.draft,
      { hut: { kind: 'boat', ...(hut ? { distinction: hut } : {}) }, ribbon: { kind: 'boat', ...(ribbon ? { distinction: ribbon } : {}) } });
    expect(() => w.compile(shared('a blue hull', 'a red sail'))).not.toThrow();
    expect(() => w.compile(shared('a red sail', undefined))).toThrow(ERROR);
    expect(() => w.compile(shared('A red sail', 'a red sail'))).toThrow(ERROR);
  });

  it('the planner instructions describe the exact nested population wire, never an incompatible top-level field', () => {
    expect(INSTANCE_STORYBOARD_ADDENDUM).toContain('In EACH plan.locations entry, declare population:');
    expect(INSTANCE_STORYBOARD_ADDENDUM).toContain('do not add a top-level populations field');
    expect(INSTANCE_STORYBOARD_ADDENDUM).not.toContain('populations (beside plan and sequence)');
  });

  it('the planner wire and the draft schema carry each location population only under the flag (which needs the kind contract)', () => {
    const call = (context: Record<string, unknown>) => ({ stage: 'storyboard' as const, instructions: 'x', input: '{}',
      maxOutputTokens: personalBookOutputLimits(8).storyboardOutputTokens, context: { narrativeSpreads: 8, sourceDigest: 'a'.repeat(64), ...context } });
    const location = (schema: any) => schema.shape.plan.shape.locations.element;
    expect(() => personalBookProviderSchema(call({ instanceDistinctionContract: true }) as never)).toThrow('book_provider_context');
    expect(() => personalBookProviderSchema(call({ landmarkKindContract: true, instanceDistinctionContract: 'yes' }) as never)).toThrow('book_provider_context');
    const wire = personalBookProviderSchema(call({ landmarkKindContract: true, instanceDistinctionContract: true }) as never) as any;
    expect(location(wire).safeParse({ id: 'garden', design: 'a garden', population: ['tree'] }).success).toBe(true);
    expect(location(wire).safeParse({ id: 'garden', design: 'a garden' }).success).toBe(false);
    expect(location(personalBookProviderSchema(call({ landmarkKindContract: true }) as never) as any).safeParse({ id: 'g', design: 'd', population: [] }).success).toBe(false);
    expect(location(storyboardDraftSchema({ landmarkKindContract: true, instanceDistinctionContract: true })).safeParse({ id: 'g', design: 'd', population: [] }).success).toBe(true);
  });

  it('splitting never mutates the planner draft', async () => {
    const w = await world(), draft = annotate(w.draft, W1), before = JSON.stringify(draft);
    const split = splitLocationPopulations(draft);
    expect(JSON.stringify(draft)).toBe(before);
    expect(split.populations).toEqual([{ locationId: 'garden', kinds: ['tree'] }, { locationId: 'lane', kinds: [] }]);
  });
});

describe('instance-distinction/v1: semantic completeness is the review\'s, and a held review admits nothing', () => {
  async function simpleWorld() {
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
    return { f, writerResult, textOptions };
  }
  // Recorded review fixtures (the model is never called): one supported review, and three that hold on the contract's own audit.
  const held: [string, string][] = [
    ['an incomplete population', 'the garden design shows trees, but its population is [] (incomplete population)'],
    ['a sub-type key', 'the hut is keyed "oak" while the garden dressing is "tree": a sub-type masks the collision'],
    ['an unsupported design', 'instance_distinction_unsupported: the story gives the hut no stable visible cue'],
  ];
  it.each([['supported', ''] as [string, string], ...held])('%s', async (name, observation) => {
    const { f, writerResult, textOptions } = await simpleWorld();
    const planned = annotate(f.draft, { populations: { garden: [], lane: [] }, hut: { kind: name === 'a sub-type key' ? 'oak' : 'hut' } });
    const book = compilePersonalStoryboard(prepareCurrentPersonalStoryboard(f.request, writerResult, textOptions, ...flags(true)), planned);
    const review = { ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest };
    if (observation) Object.assign(review.bookChecks.find(c => c.category === 'continuity')!, { verdict: 'contradiction', observation });
    const generate = vi.fn(async (call: SimpleStoryboardDiagnosticCall) => structuredClone(call.stage === 'storyboard' ? planned : review));
    const result = await runSimpleStoryboardDiagnostic({ request: f.request, writerResult, options: textOptions, signal: new AbortController().signal, generate,
      landmarkKindContract: true, instanceDistinctionContract: true });
    const [storyboardCall, reviewCall] = generate.mock.calls.map(c => c[0]);
    expect(storyboardCall.instructions.endsWith(INSTANCE_STORYBOARD_ADDENDUM)).toBe(true);
    expect(storyboardCall.context).toMatchObject({ landmarkKindContract: true, instanceDistinctionContract: true });
    expect(reviewCall.instructions.endsWith(INSTANCE_REVIEW_ADDENDUM)).toBe(true);
    expect(reviewCall.context).toMatchObject({ instanceDistinctionContract: true });
    expect(JSON.parse(reviewCall.input).instanceDistinctionContract).toEqual(book.instanceDistinction);
    if (!observation) { expect(result.status).toBe('review_supported'); expect(result.framePackets).toHaveLength(book.narrativeSpreads + 1); return; }
    // Held: the source is not admitted, so no frame packet (and therefore no sheet or page) exists.
    expect(result.status).toBe('held_contradiction'); expect(result.framePackets).toEqual([]);
    expect(storyboardReviewDisposition(book, review).disposition).toBe('held_contradiction');
    expect(() => personalStoryboardFrame(book, review, 1, { request: f.request, writerResult, options: textOptions })).toThrow('held_contradiction');
  });
  it('the review addendum states the four audits and the unsupported hold', () => {
    const flat = INSTANCE_REVIEW_ADDENDUM.replace(/\s+/g, ' ');
    for (const text of ['(a) every location\'s population', '(b) an entity and same-sort dressing share ONE broad key', '(c) each distinction is visible',
      '(d) no distinction was created by changing the story', 'instance_distinction_unsupported']) expect(flat).toContain(text);
  });
});
