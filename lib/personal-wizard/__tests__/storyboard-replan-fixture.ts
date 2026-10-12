import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { prepareSimpleStory, writeSimpleStory, type SimpleStoryDraft } from '../simple-story-engine';
import { createCurrentSimpleStorySource } from '../simple-story-source';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard } from '../storyboard';
import { textCanonOptions } from '../../../scripts/personal-simple-story';

/**
 * The 6-spread storyboard fixture re-admitted as a CURRENT simple source (the re-plan driver's only input), with an actor-owned-appearance
 * parent draft and its synthetic supported review. Synthetic structure only: no literary, visual or product acceptance.
 */
export async function replanFixture() {
  const f = await personalStoryboardFixture(), options = textCanonOptions(resolvePersonalWizardOptions());
  const prepared = prepareSimpleStory(f.request, options, 'diagnostic-fixture'), plan = f.result.plan;
  const story: SimpleStoryDraft = { title: plan.title, childGoal: plan.childGoal, companionWant: plan.companionWant, comicPromise: plan.comicPromise,
    ending: plan.ending, pages: f.result.manuscript.pages.map(page => ({ text: `${page.text} נועה ודיני משחקות בציור.` })),
    pageMap: plan.beats.map(({ pageNumber: _page, ...row }) => row),
    resilienceMoments: plan.resilience.moments.map(({ pageNumber, ...row }) => ({ page: pageNumber, ...row })) };
  const records: Record<string, unknown> = {};
  const generated = await writeSimpleStory(prepared, async call => {
    const output = call.stage === 'author' ? structuredClone(story) : { ...structuredClone(story), editorChanges: ['Synthetic structural fixture.'] };
    const usage = { inputTokens: 1000, outputTokens: 2000 }, termination = { code: 0, signal: null };
    records[call.stage] = { output, usage, estimatedMicroUsd: 100000, metadata: { kind: 'cli_reported_estimate_not_invoice', reportedModels: ['claude-opus-5-5'], termination },
      raw: { termination, killConfirmed: true, stopped: false, stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false,
        session_id: call.stage === 'author' ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222',
        total_cost_usd: .1, modelUsage: { 'claude-opus-5-5': usage }, structured_output: output }) } };
    return { output, usage, estimatedUsd: .1 };
  }, { model: 'claude-opus-5-5', reservedUsd: 2 });
  const writerResult = createCurrentSimpleStorySource(f.request, generated, records as { author: unknown; editor: unknown }, options);
  const draft = structuredClone(f.draft) as any;
  delete draft.plan.wardrobe;
  draft.plan.actorAppearance = { child: { role: 'child', clothing: ['red shirt', 'blue shorts', 'teal shoes'] },
    companion: { role: 'companion', authority: 'companionVisualAuthority' } };
  const book = compilePersonalStoryboard(prepareCurrentPersonalStoryboard(f.request, writerResult, options, true), draft);
  const review = { ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest };
  return { f, request: f.request, options, writerResult, draft, book, review };
}

/** The fixture's one landmark is the hut: the re-plan adds its declared kind and (unless `change` says otherwise) nothing else. */
export const withKind = (draft: unknown, value = 'hut', change: (d: any) => void = () => {}) => {
  const d = structuredClone(draft) as any;
  d.plan.continuity.entities.find((e: any) => e.id === 'hut').invariants.push({ attribute: 'kind', value });
  change(d);
  return d;
};

/** The provider wire shapes (page order and binding metadata are engine-side, never model output). */
export const providerStoryboard = (draft: any) => {
  const strip = ({ pageNumber: _n, ...row }: any) => row;
  const { pages: cp, ...continuity } = draft.plan.continuity, { pages: pp, ...plan } = draft.plan, { pages: sp, ...sequence } = draft.sequence;
  return { plan: { ...plan, pages: pp.map(strip), continuity: { ...continuity, pages: cp.map(strip) } }, sequence: { ...sequence, pages: sp.map(strip) } };
};
export const providerReview = (review: any) => {
  const group = (rows: any[]) => Object.fromEntries(rows.map(({ category, ...row }) => [category, row]));
  return { bookChecks: group(review.bookChecks), frames: review.frames.map((frame: any) => group(frame.checks)) };
};
