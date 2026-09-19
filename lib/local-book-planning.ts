import { z } from 'zod';
import { BOOK_SEQUENCE_VERSION, bookSequenceSchema, validateBookSequence } from './local-book-sequence';
import { previewPlanV2Schema, previewSha, validatePreviewPlan, type previewStory } from './local-story-preview';
import { validatePreviewContinuity } from './local-preview-quality';

export const WHOLE_BOOK_PLANNING_VERSION = 'local-whole-book-planning/v1';
// The model authors facts, never their hashes. Sparse transitions avoid restating
// every unchanged fact on every page. Expansion is deterministic before any image.
const sequencePage = bookSequenceSchema.shape.pages.element;
export const wholeBookDraftSchema = z.object({
  plan: previewPlanV2Schema,
  sequence: z.object({
    premise: bookSequenceSchema.shape.premise,
    mutableAttributes: bookSequenceSchema.shape.mutableAttributes,
    initialStates: sequencePage.shape.states,
    pages: z.array(sequencePage.omit({ states: true })).min(2).max(24),
  }).strict(),
}).strict();

export const WHOLE_BOOK_PLANNING_INSTRUCTION = `Before planning any individual illustration, read ALL pages and determine the complete causal journey.
Return one object with plan and sequence. Plan retains the existing visual-plan schema, including cover0 and all body pages.
Sequence is mandatory and covers ALL body pages, not the cover. State the book premise and choose one readable beat per page.
Assign stable scene visit IDs: a scene continues until a source-supported time/place/situation cut. Camera/angle changes are NOT scene cuts.
Entity IDs (including child and companion) and location IDs must be distinct across the entire book; use separate IDs for a place and its landmark.
Declare initialStates for child, companion and EVERY continuity entity (not location IDs). Use unestablished/null for not-yet-introduced entities.
Track the principal physical relation per entity: at, inside, beside, on, held_by, attached_to, or unestablished.
Targets are declared entity/location IDs, never invented names. held_by targets a cast member. Do not create containment/custody cycles.
Every page inherits ALL prior state, including offscreen objects and people. Not mentioned again does NOT mean moved, rebuilt or vanished.
If people are inside their cardboard station and no move occurs, they stay inside; changing the camera does not move them outside.
Author only actual transitions with entityId, exact from/to values, and an exact same-page personalized source excerpt as evidence.
For pages without changes, transitions is empty. Page1 has no transitions or sceneChangeEvidence. Later scene changes need same-page source evidence.
Changes must be semantically supported, not merely accompanied by an unrelated matching quote. Do not use cuts to hide unexplained relocation.
visibleCastIds controls the drawn cast; hidden entities retain their physical state without being forced into the image.
Keep appearances, structure, scale and geography fixed. mutableAttributes lists only story-supported appearance/state attributes that may change.
Separate WORLD STATE from PRESENTATION: vary camera, distance, angle, framing, expression and gaze without changing physical relationships.
Do not duplicate compositions just to preserve continuity. Do not add an object before its reveal, and do not draw multiple sequential instants.
Plan the ending too so later states do not contradict earlier setup. Never rewrite the approved story.`;

export function wholeBookPlanningInput(story: ReturnType<typeof previewStory>, childAge: number, gender: string, companionDescription: string) {
  return { planningVersion: WHOLE_BOOK_PLANNING_VERSION, story: structuredClone(story), childAge, gender, companionDescription };
}

export function compileWholeBookDraft(raw: unknown, story: ReturnType<typeof previewStory>) {
  const draft = wholeBookDraftSchema.parse(raw);
  const texts = [story.title, ...story.pages.map(p => p.text)];
  const plan = validatePreviewPlan(draft.plan, story.pages.length);
  plan.continuity = validatePreviewContinuity(plan.continuity, plan, texts);
  const planBytes = JSON.stringify(plan, null, 2) + '\n';
  if (new Set(draft.sequence.initialStates.map(x => x.entityId)).size !== draft.sequence.initialStates.length) throw Error('book_sequence_duplicate_initial_entity');
  const states = new Map(draft.sequence.initialStates.map(x => [x.entityId, structuredClone(x.value)]));
  const pages = draft.sequence.pages.map(page => {
    for (const change of page.transitions) {
      if (!states.has(change.entityId)) throw Error('book_sequence_unknown_transition_entity');
      states.set(change.entityId, structuredClone(change.to));
    }
    return { ...page, states: [...states].map(([entityId, value]) => ({ entityId, value: structuredClone(value) })) };
  });
  const sequence = validateBookSequence({ version: BOOK_SEQUENCE_VERSION, sourceSha: story.sourceSha,
    planSha: previewSha(planBytes), premise: draft.sequence.premise, mutableAttributes: draft.sequence.mutableAttributes, pages },
  { sourceSha: story.sourceSha, planSha: previewSha(planBytes), plan, texts });
  return { plan, sequence };
}
