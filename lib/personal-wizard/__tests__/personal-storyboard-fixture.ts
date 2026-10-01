import { preparePersonalStory, writePersonalStory, type StoryCall } from '../story-writer';
import { IntakeLedger } from '../intake-ledger';
import { resolvePersonalWizardOptions } from '../options';
import { preparePersonalStoryboard, compilePersonalStoryboard, STORYBOARD_BOOK_CHECKS, STORYBOARD_FRAME_CHECKS } from '../storyboard';
import type { ReviewedPersonalBookRequest } from '../contract';
import { prepareStoryEdit, compileStoryEdit, type StoryEditorCall } from '../story-editor';
import { STORY_EDITOR_CRITERIA, type StoryEditorOutput } from '../story-editor-contract';
import { fixtureAdventureSelection } from './story-planning-fixture';

export function fixtureEditorOutput(call: StoryEditorCall): StoryEditorOutput {
  const { brief, draft, draftDigest } = JSON.parse(call.input);
  const { requestId: _planId, ...plan } = draft.plan;
  const { requestId: _storyId, planDigest: _planDigest, ...manuscript } = draft.manuscript;
  return { requestId: brief.requestId, draftDigest, plan, manuscript,
    checks: Object.fromEntries(STORY_EDITOR_CRITERIA.map(key => [key, { outcome: 'ready_for_reading', note: 'synthetic editor fixture, NOT literary acceptance' }])) as StoryEditorOutput['checks'] };
}

const options = resolvePersonalWizardOptions();
const prose = [
  'נועה and Dini wait inside their wooden hut. A red ribbon is in her hand.',
  'They look out from inside the hut. נועה considers another idea.',
  'They leave the hut for the garden, carrying the ribbon.',
  'They walk down the lane, then pause at the oak tree.',
  'They turn back into the garden and stop beside the same hut.',
  'They climb inside the hut again, and the ribbon stays with נועה.',
];

export async function personalStoryboardFixture(lengthId = 'short', companionId = 'dragon_dini') {
  const request: ReviewedPersonalBookRequest = {
    kind: 'personal_book_request', version: 'reviewed-personal-book-request/v3', draftId: 'd_storyboard01', draftRevision: 3,
    child: { name: 'נועה', age: 5, address: 'girl', residence: 'אודם', nameSource: 'typed', ageSource: 'typed', addressSource: 'typed', residenceSource: 'typed' },
    facts: [{ id: 'f_interest0001', kind: 'interest', value: 'ציור', source: 'typed' }], noDifficulty: true,
    storyPlace: { value: 'הגינה', source: 'typed' }, companion: { id: companionId }, intent: { kind: 'just_for_fun' }, avoid: [],
    appearance: { photo: 'none' }, bookOptions: { lengthId, voiceId: null },
  };
  const prepared = preparePersonalStory(request, options);
  const draftResult = await writePersonalStory({ prepared, userId: 'synthetic', jobId: 's_storyboard0001',
    settings: { model: 'gpt-6-sol', budgetUsd: 1, maxJobs: 1, operators: new Set() }, ledger: new IntakeLedger(), signal: new AbortController().signal,
    provider: () => ({ generate: async (call: StoryCall) => {
      const { brief, planDigest } = JSON.parse(call.input);
      const output = call.stage === 'plan' ? {
        adventureSelection: fixtureAdventureSelection(brief.beats),
        requestId: brief.requestId, title: 'נועה והסרט האדום', childGoal: 'למצוא רעיון', companionWant: 'לעזור וגם לצייר', comicPromise: 'הסרט מדגדג',
        resilience: { mode: brief.resilienceMode, moments: [{ pageNumber: 2, childChoice: 'מציעה רעיון', whatHelps: 'החברה מקשיבה' }] },
        beats: Array.from({ length: brief.beats }, (_, i) => ({ pageNumber: i + 1, location: 'הגינה', transitionReason: 'מחפשות רעיון',
          childAction: 'נועה מציעה', companionAction: 'החברה מקשיבה', consequence: 'מנסות דרך אחרת', factIds: ['f_interest0001'], continuity: 'הסרט בידי נועה' })), ending: 'שבות לבקתה',
      } : { requestId: brief.requestId, planDigest, title: 'נועה והסרט האדום',
        pages: Array.from({ length: brief.beats }, (_, i) => ({ pageNumber: i + 1, text: prose[i] ?? 'נועה and her companion remain inside the same hut and plan their next drawing.' })) };
      return { output, usage: { inputTokens: 1, outputTokens: 1 } };
    } }),
  });
  const result = compileStoryEdit(prepared, draftResult, fixtureEditorOutput(prepareStoryEdit(prepared, draftResult)), { inputTokens: 1, outputTokens: 1 });
  const count = result.manuscript.pages.length;
  const location = (n: number) => n === 4 ? 'lane' : 'garden';
  const visible = (n: number) => n === 4 ? ['ribbon'] : n === 2 ? ['hut'] : ['hut', 'ribbon'];
  const shot = (n: number) => (['wide', 'medium', 'close'] as const)[Math.max(0, n - 1) % 3];
  const target = (n: number) => n === 4 ? { relation: 'at' as const, targetId: 'lane' }
    : n === 3 || n === 5 ? { relation: 'beside' as const, targetId: 'hut' } : { relation: 'inside' as const, targetId: 'hut' };
  const sceneId = (n: number) => n <= 2 ? 'hut_first' : n === 3 ? 'garden_first' : n === 4 ? 'lane_visit' : n === 5 ? 'garden_return' : 'hut_return';
  const draft = {
    plan: {
      wardrobe: 'red shirt, blue shorts, teal shoes', visualLanguage: 'warm watercolor',
      recurringProps: [{ id: 'ribbon', design: 'one red cotton ribbon' }],
      locations: [{ id: 'garden', design: 'garden with a wooden hut beside an oak' }, { id: 'lane', design: 'stone lane beside the garden' }],
      pages: Array.from({ length: count + 1 }, (_, n) => ({ pageNumber: n, locationId: location(n), shot: shot(n),
        angle: (['low', 'high', 'eye_level'] as const)[n % 3], composition: `different framing ${n}`,
        childAction: 'considers her plan', childExpression: `feeling ${n}`, childGaze: 'companion', companionAction: n === 2 ? 'offscreen inside hut' : 'listens',
        scene: 'one coherent instant', props: visible(n).includes('ribbon') ? [{ id: 'ribbon', state: 'held by child' }] : [] })),
      continuity: {
        companionStandingHeightInChildHeights: .75,
        entities: [{ id: 'hut', kind: 'landmark', invariants: [{ attribute: 'material', value: 'wood' }] },
          { id: 'ribbon', kind: 'prop', invariants: [{ attribute: 'color', value: 'red' }] }],
        pages: Array.from({ length: count + 1 }, (_, n) => ({ pageNumber: n, visibleLocationIds: [location(n)], visibleEntityIds: visible(n),
          changes: [], childHeightFraction: .3, environmentAreaFraction: .7 })),
      },
    },
    sequence: {
      premise: 'A child and a companion explore and return with an idea', mutableAttributes: [],
      initialStates: [{ entityId: 'child', value: target(1) }, { entityId: 'companion', value: target(1) },
        { entityId: 'hut', value: { relation: 'at', targetId: 'garden' } }, { entityId: 'ribbon', value: { relation: 'held_by', targetId: 'child' } }],
      pages: Array.from({ length: count }, (_, i) => {
        const n = i + 1;
        return { pageNumber: n, sceneId: sceneId(n), beat: `readable moment ${n}`,
          sceneChangeEvidence: n >= 3 && n <= 6 ? result.manuscript.pages[i].text : null,
          visibleCastIds: n === 2 ? ['child'] : ['child', 'companion'],
          transitions: n >= 3 && n <= 6 ? ['child', 'companion'].map(entityId => ({ entityId, from: target(n - 1), to: target(n), evidence: result.manuscript.pages[i].text })) : [] };
      }),
    },
  };
  const source = preparePersonalStoryboard(request, result, options);
  const book = compilePersonalStoryboard(source, draft);
  const review = {
    sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest,
    bookChecks: STORYBOARD_BOOK_CHECKS.map(category => ({ category, verdict: 'supported' as const, observation: 'synthetic review, NOT creative acceptance' })),
    frames: Array.from({ length: count + 1 }, (_, pageNumber) => ({ pageNumber,
      checks: STORYBOARD_FRAME_CHECKS.map(category => ({ category, verdict: 'supported' as const, observation: 'synthetic observable binding' })) })),
  };
  return { request, result, draftResult, source, draft, book, review, current: { request, writerResult: result, options } };
}
