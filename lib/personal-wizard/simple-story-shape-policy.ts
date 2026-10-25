import 'server-only';
import { childStoryProfile } from './simple-story-child-policy';
import type { SimpleStoryShape } from './simple-story-engine';

/** General creative premises, not plot state, scene quotas, a ranker or a second writer. Legacy library is unchanged. */
const premises: Record<SimpleStoryShape['id'], string> = {
  big_day_sideways: 'A much-anticipated occasion takes an amusing unexpected turn. Develop its connected consequences and the child\'s improvisation toward a payoff that changes what made this day special.',
  great_mixup: 'A concrete misunderstanding changes what the characters try and expect. Develop that same comic predicament until the child finds a satisfying way through it.',
  strange_visitor: 'An unusual visitor brings a distinctive wish or habit into an ordinary situation. Its interaction with the child creates the comedy and a worthwhile discovery about what the visitor wants.',
  there_and_back: 'A concrete want takes the child beyond the familiar and home with an earned change or comic payoff. Develop the central encounter rather than a tour of places and inhabitants.',
  in_charge: 'The child unexpectedly gets responsibility for something they care about. A concrete comic complication lets them find their own useful contribution and a satisfying way of doing the job.',
  making_together: 'The child and companion want to make something they care about. Let the creation and their interaction develop through connected attempts toward an imperfect, delightful result.',
  secret_world: 'An ordinary place reveals a surprising hidden world. A concrete situation there gives the child something worth doing; establish any essential rule through observable events before it matters to the outcome.',
  wrong_size: 'A striking mismatch of size changes an ordinary activity into a comic adventure. Develop what the child wants and how they use or respond to that mismatch, not an inventory of oversized scenery.',
  silly_contest: 'A playful contest with understandable rules produces anticipation and comic surprise. The child\'s contribution changes the outcome; develop the same experience rather than a quota of separate rounds.',
  something_missing: 'Something concrete that matters to the characters is missing. Their search and discoveries change what they try; the reason for its absence gives the child an earned, understandable payoff.',
  just_this_once: 'A special opportunity happens for a limited time. Make clear why the child wants to take part and let their contribution and the interaction make this occasion worth remembering.',
  learning_something: 'The child or companion wants to accomplish something concrete and enjoyable. Let their attempts and partnership produce surprising consequences and an earned discovery, not a demonstration of persistence exercises.',
  the_chase: 'A clear pursuit develops through connected action, anticipation and a comic reversal. Changes of place serve what is happening in the pursuit, rather than supplying a succession of stations.',
  one_more: 'A recognisable cumulative pattern develops until its accumulation creates a comic turn that the child helps resolve. Each return changes the expectation or situation; the pleasure is not a quota of extra guests or props.',
};

export function resolveChildStoryShape(id: SimpleStoryShape['id'], age: number) {
  const audience = childStoryProfile(age);
  if (!Object.prototype.hasOwnProperty.call(premises,id)) throw Error('story_shape_id');
  const interpretation = age <= 4
    ? 'For this young listener, make the immediate want, essential cause and changing situation directly graspable in action or dialogue. A reason may surprise at discovery, but show it concretely then: understanding the story must not require reconstructing an unspoken motive or route. A purposeful comic pattern is welcome without bookkeeping.'
    : age <= 6
      ? 'Develop connected attempts, scene-visible clues or a concrete misunderstanding so the listener can anticipate a consequence. Make an essential reason clear when it matters. Give the main interaction room rather than multiplying errands, rules or side problems.'
      : 'Use room for anticipation, a consequential plan, character motives and a fair reversal. Established clues can reward inference and a delayed explanation can change their meaning. Complexity should deepen this predicament and payoff, not add unrelated events or ornate wording.';
  return { version:'story-shape-age-fit/v1' as const,shapeId:id,age,band:audience.band,premise:premises[id],interpretation };
}
export type ChildStoryShapeResolution = ReturnType<typeof resolveChildStoryShape>;
