/**
 * Curated golden examples for few-shot recipe generation.
 *
 * Selection: 3 per direction, each from a different topic so the model
 * learns the GENRE patterns (bedtime cadence, adventure arc, fantasy
 * world-building) rather than memorizing topic-specific tropes.
 *
 * Each example points to a .md file in story-bank/v5-fixed-v2/.
 */

export type RecipeDirection = 'bedtime' | 'adventure' | 'fantasy';

export interface GoldenExampleRef {
  slug: string; // matches story-bank/v5-fixed-v2/<slug>.md
  direction: RecipeDirection;
  category: string;
  companionName: string; // canonical
  why: string;           // why this example was selected for the training set
}

/**
 * The recommended 9 — 3 distinct topics per direction.
 * Picked to maximize craft-pattern coverage:
 *  - bedtime: night fear, racing thoughts, medical anxiety
 *  - adventure: focus, anger, disappointment
 *  - fantasy: new sibling, sensory overload, shyness
 */
export const GOLDEN_TRAINING_SET: GoldenExampleRef[] = [
  // ===== BEDTIME (10p) =====
  {
    slug: 'owl_chacham_bedtime',
    direction: 'bedtime',
    category: 'NIGHT_FEAR',
    companionName: 'בובו',
    why: "Naming sounds shrinks them. Heart line p10. Companion who listens before speaking.",
  },
  {
    slug: 'bat_lily_bedtime',
    direction: 'bedtime',
    category: 'RACING_THOUGHTS',
    companionName: 'לילי',
    why: "'Silence is suspicious' reframe. Companion's mechanism transfers from sounds → thoughts.",
  },
  {
    slug: 'starfish_kokhavi_bedtime',
    direction: 'bedtime',
    category: 'MEDICAL_PROCEDURE',
    companionName: 'כוכבי',
    why: "Quiet healing demonstration (bowl scene). 'Body works in silence.' Self-compassion agency transfer.",
  },

  // ===== ADVENTURE (15p) =====
  {
    slug: 'dolphin_shahkan_adventure',
    direction: 'adventure',
    category: 'FOCUS_LEARNING',
    companionName: 'דודי',
    why: "'One sound under a sea of sounds' — focus as a single chosen anchor. Residue: pink hum shell.",
  },
  {
    slug: 'bear_cub_gahal_adventure',
    direction: 'adventure',
    category: 'ANGER_FRUSTRATION',
    companionName: 'דובי',
    why: "Four-stage body release (roar/stones/stomp/breathe). 'Calm down is a closing door.' Reconciliation via berry-gift.",
  },
  {
    slug: 'bear_mati_adventure',
    direction: 'adventure',
    category: 'DISAPPOINTMENT_LOSING',
    companionName: 'מתי',
    why: "Reframe via 'second box' for things-I-saw beside the trophy box. Two characters who both lost.",
  },

  // ===== FANTASY (20p) =====
  {
    slug: 'dragon_dini_fantasy',
    direction: 'fantasy',
    category: 'NEW_SIBLING',
    companionName: 'דיני',
    why: "Parallel-world structure (dragon mirrors child). 'Stone of three.' Heart line: 'hug learned to make room.'",
  },
  {
    slug: 'fawn_tzvi_fantasy',
    direction: 'fantasy',
    category: 'SENSORY_OVERLOAD',
    companionName: 'צבי',
    why: "Every sound has a body in this forest. 'I did it for me, not them.' Agency transfer p16: child regulates a frightened creature.",
  },
  {
    slug: 'bunny_ometz_fantasy',
    direction: 'fantasy',
    category: 'SHYNESS_SOCIAL',
    companionName: 'בוני',
    why: "Word-creatures in magical clearing. Tangled word-creature p14-15. Role reversal: companion also practices her words.",
  },
];

export function selectExamplesForDirection(direction: RecipeDirection): GoldenExampleRef[] {
  return GOLDEN_TRAINING_SET.filter((ex) => ex.direction === direction);
}
