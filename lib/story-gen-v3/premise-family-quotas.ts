import type { PremiseFamily, PremiseExperimentSpecV3 } from './types';



export interface PremiseFamilyQuota {

  family: PremiseFamily;

  count: number;

  hint: string;

}



const DINI_FAMILIES: PremiseFamilyQuota[] = [

  { family: 'everyday_magical_invasion', count: 3, hint: 'Magic invades ordinary home/play — pocket, laundry, lunchbox' },

  { family: 'companion_causes_comic_mess', count: 3, hint: 'Dini overhelps physically — wing rearranges room, nest in wrong place' },

  { family: 'child_game_social', count: 3, hint: 'Playground/game try — child wants turn/status/fairness' },

  { family: 'object_creature_absurdity', count: 3, hint: 'Popcorn, sock-ball, sticker rebellion — absurd object logic' },

];



const KOKO_FAMILIES: PremiseFamilyQuota[] = [

  {

    family: 'everyday_magical_invasion',

    count: 3,

    hint: 'New place invades ordinary logic — moving box, hallway, name sticker, empty shelf that echoes',

  },

  {

    family: 'companion_causes_comic_mess',

    count: 3,

    hint: 'Koko color camouflage goes wrong — wall stripes, backpack eyes, panic-orange while saying calm',

  },

  {

    family: 'child_game_social',

    count: 3,

    hint: 'Child tries to make new place playable — map, hideout, door sign, first friend knock',

  },

  {

    family: 'object_creature_absurdity',

    count: 3,

    hint: 'Physical transition objects rebel — label migrates, box refuses unpack, map folds wrong way',

  },

];



const LION_FAMILIES: PremiseFamilyQuota[] = [

  { family: 'sound_has_weight', count: 3, hint: 'Roars/whispers fall, rattle shelves, block paths — anger as physical sound' },

  { family: 'companion_overdoes', count: 3, hint: 'Leo tries too loud/too quiet — volume comedy, tail thumps' },

  { family: 'body_signal_leaks', count: 2, hint: 'Body betrays calm words — tail, paws, squeak pride' },

  { family: 'object_refuses', count: 2, hint: 'Objects need a specific sound to move — not abstract feelings' },

  { family: 'hidden_pattern', count: 2, hint: 'Child discovers pattern in how small sounds work in this world' },

];



const BUNNY_FAMILIES: PremiseFamilyQuota[] = [

  { family: 'quiet_truth', count: 3, hint: 'One small true sentence — ears tell truth before mouth' },

  { family: 'body_signal_leaks', count: 3, hint: 'Ears flop/stand — body before brave words' },

  { family: 'companion_overdoes', count: 2, hint: 'Bunny rehearses bravery backwards — comic over-prep' },

  { family: 'object_refuses', count: 2, hint: 'Waiting-room object — bandage, chair, door — child small agency' },

  { family: 'hidden_pattern', count: 2, hint: 'Child notices what they CAN control in medical moment' },

];



const FOX_FAMILIES: PremiseFamilyQuota[] = [
  {
    family: 'companion_overdoes',
    count: 3,
    hint: 'Uri proud scout — wrong shadow name, overconfident approach, official voice slip',
  },
  {
    family: 'body_signal_leaks',
    count: 3,
    hint: 'Lantern shrinks/flickers; tail hides — body before brave words',
  },
  {
    family: 'object_creature_absurdity',
    count: 3,
    hint: 'Night object misread — laundry, hose, boot, sock; dramatic name then downgrade',
  },
  {
    family: 'hidden_pattern',
    count: 3,
    hint:
      'Child hears/sees what Uri missed — sound source, real shape, safe path. uri_premise_10 MUST be: night sound Uri misreads → ordinary-but-magical truth (drip on bucket, wind chime, moth wing). Plus 2 more hidden_pattern variants with different sounds/objects.',
  },
];

/** Guy-approved fox_uri bank — creation guide for premise-gen (never copy bit lines). */
export function getFoxUriPremiseEngineFromApprovedBank(): string {
  return `## Uri (fox_uri) approved comic engine — creation guide ONLY (do not copy bit lines)
- Lantern-as-courage-meter: shrinks when scared, swells on wrong ID, flickers when too fast, steadies when child leads
- Proud-but-wrong scout: dramatic names for shadows/sounds, then gentle downgrade — NOT wise helper
- Tail/body betrays fear before words admit it
- Child corrects Uri — better ears or braver small step than fox bravado
- Quiet courage: one small light circle, one step — not hero speech
FORBIDDEN in Uri premises: dragon/Dini over-wrap, popcorn nest, wing roof, "העטיפה מדי", bureaucrat plot as whole story`;
}

const TURTLE_FAMILIES: PremiseFamilyQuota[] = [

  { family: 'home_object_moves', count: 3, hint: 'Shell, map, mark, ritual object carries home physically' },

  { family: 'map_or_path_changes', count: 3, hint: 'Route/table-space/shell-space — home as place you can touch' },

  { family: 'companion_overdoes', count: 2, hint: 'Turtle packs shell, guest-house offer, wrong retreat timing' },

  { family: 'object_refuses', count: 2, hint: 'New-place furniture/shelf refuses until home mark placed' },

  { family: 'hidden_pattern', count: 2, hint: 'Child discovers repeatable action that makes new place familiar' },

];



export function getPremiseFamilyQuotas(spec: PremiseExperimentSpecV3): PremiseFamilyQuota[] {

  if (spec.companionId === 'chameleon_koko') return KOKO_FAMILIES;

  if (spec.companionId === 'lion_shaket') return LION_FAMILIES;

  if (spec.companionId === 'bunny_ometz') return BUNNY_FAMILIES;

  if (spec.companionId === 'turtle_beiti') return TURTLE_FAMILIES;
  if (spec.companionId === 'fox_uri') return FOX_FAMILIES;

  return DINI_FAMILIES;

}



export function getCompanionPremiseEngineBlock(spec: PremiseExperimentSpecV3): string {

  if (spec.companionId === 'chameleon_koko') {

    return `## Koko comic engine (high-level only — no exact golden lines)

- color changes reveal feelings before words

- tries to blend in and gets it wrong

- over-camouflages at the worst moment

- turns the wrong color by accident

- hides too well / not well enough

- TRANSITION theme = physical crossing into unfamiliar place/state, NOT reassurance fable`;

  }

  if (spec.companionId === 'lion_shaket') {

    return `## Leo (lion_shaket) comic engine — ANGER_FRUSTRATION / sound has weight

- roar/whisper has PHYSICAL weight in fantasy world

- Leo announces quiet in a loud voice; measures roar like fish

- tail thumps while trying to stay calm; gentle roar still moves objects

- NOT "anger is bad" — energy becomes movement, child discovers smaller true sound

- 20-page fantasy needs mid-story turn, not endless escalation`;

  }

  if (spec.companionId === 'bunny_ometz') {

    return `## Bunny (bunny_ometz) comic engine — MEDICAL_PROCEDURE / quiet true courage

- ears tell truth before words; brave sentence comes out backwards

- whisper truest thing — lands bigger than shout

- NEVER: "זה לא יכאב", "אין מה לפחד", "תהיה אמיץ", promise outcomes

- child agency: one true sentence, where to look, familiar object, small pause, tiny job for bunny

- comforting without lying`;

  }

  if (spec.companionId === 'fox_uri') {
    return `${getFoxUriPremiseEngineFromApprovedBank()}
- NIGHT_FEAR / inspectable fear — backyard/porch child-scale adventure, not epic quest`;
  }

  if (spec.companionId === 'panda_anat') {
    return `## Anat (panda_anat) comic engine — SOCIAL / gentle joining
- body-before-mind hesitation — sand sinks, knees vote, talks to objects
- NOT therapist panda — physical shy comedy
- child leads join/play moment; Anat models imperfect try`;
  }

  if (spec.companionId === 'turtle_beiti') {

    return `## Turtle (turtle_beiti) comic engine — HOMESICKNESS / home comes with you

- shell as guest-house; packs on shell; retreats at wrong moment

- home must be PHYSICAL: object, route, ritual, mark, shell-space — NOT slogan

- avoid unearned: "הבית בלב", "הבית תמיד איתך" unless earned by concrete action

- child makes/notices something that carries home into new place`;

  }

  return `## Dini comic engine (high-level only — no exact joke lines)

- protective dragon logic

- big body trying to be careful

- tail/wing betrays emotion

- overprotection

- dragon-scale misreading of small child problems`;

}



export function premiseIdPrefix(spec: PremiseExperimentSpecV3): string {

  if (spec.companionId === 'chameleon_koko') return 'koko_premise';

  if (spec.companionId === 'dragon_dini') return 'dini_premise';

  if (spec.companionId === 'lion_shaket') return 'lion_premise';

  if (spec.companionId === 'bunny_ometz') return 'bunny_premise';

  if (spec.companionId === 'turtle_beiti') return 'turtle_premise';
  if (spec.companionId === 'fox_uri') return 'uri_premise';

  return `${spec.companionId}_premise`;

}

