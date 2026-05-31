/**
 * Style 01 (gpt-image-1) — guarded book pipeline with lock architecture mirroring Style 02.
 * Gated by PHASE2_STYLE01_BOOK_PIPELINE=true.
 */
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { STYLE_IDS } from './styles';
import type { Style02RefBudgetConfig } from './style02-gptimage';

export const STYLE_01_GPT_MODEL_DEFAULT = 'gpt-image-1';

/** Escalation: set STYLE_01_GPT_MODEL=gpt-image-2 to re-run same lock architecture on gpt-image-2. */
export function resolveStyle01GptModel(): string {
  const raw = process.env.STYLE_01_GPT_MODEL?.trim();
  return raw || STYLE_01_GPT_MODEL_DEFAULT;
}

/** @deprecated Use resolveStyle01GptModel() — kept for imports that expect a constant label. */
export const STYLE_01_GPT_MODEL = STYLE_01_GPT_MODEL_DEFAULT;

export const STYLE_01_REF_DIR = path.join(process.cwd(), 'style-references', '01');

export type Style01SceneClass =
  | 'fantasy-cave'
  | 'forest-day'
  | 'forest-clearing'
  | 'forest-path'
  | 'outdoor-nature'
  | 'cozy-interior'
  | 'outdoor-magical';

export type Style01SceneSubsetKey = 'fantasy-cave' | 'cozy-interior' | 'outdoor-magical';

export const STYLE_01_SHARED =
  "Style 01: soft hand-drawn children's storybook illustration on warm cream paper. Gentle transparent watercolor washes, delicate linework, luminous muted palette, cozy picture-book warmth. NOT cinematic Style 02. NOT dense ink-and-gouache. NOT photorealistic. NOT Pixar CGI.";

export const STYLE_01_RENDERING_CORRECTION =
  'RENDERING: soft watercolor storybook — visible paper texture, gentle pigment bleeds, rounded expressive characters, warm local color, airy negative space. NOT harsh shadows. NOT global orange filter. NOT empty cream void background.';

export const STYLE_01_FRAMING_RULE = `FRAMING RULE — BREATHE:
- Characters fill NO MORE than 35-50% of frame height.
- Environment must occupy at least 50% of visible area.
- Avoid tight portrait crops. Avoid close-up faces unless explicitly specified as "close-up" shotType.
- For "wide" / "medium-wide" / "establishing" shots: characters should be in lower third or off-center, environment dominates.
- For "intimate" shots: still leave breathing room — cave ceiling, surrounding stones, depth visible. NOT a portrait crop.
- FORBIDDEN: character filling frame, tight headshot, claustrophobic framing, no environmental context.`;

export const STYLE_01_REFERENCE_INSTRUCTION =
  'Use attached STYLE reference images for VISUAL STYLE ONLY: soft watercolor technique, paper texture, gentle palette, picture-book warmth. Do NOT copy exact creatures, text, signs, compositions, or characters from references. Create the new original scene below.';

export const STYLE_01_NO_TEXT =
  '[NO TEXT] No readable Hebrew, English, letters, numbers, signs, labels, or watermarks.';

export const STYLE_01_ANTI_STYLE02 =
  'NOT Style 02. NOT cinematic fantasy. NOT dense ink crosshatching. NOT dramatic spotlight noir. NOT semi-realistic portrait rendering.';

export const STYLE_01_CHILD_PHOTO_IDENTITY_RULE =
  'CHILD PHOTO (if attached): IDENTITY ONLY — face shape, hair, skin tone, age, gender. Render as soft hand-drawn watercolor storybook child — NEVER photoreal cutout. Outfit from WARDROBE LOCK and scene, never from photo.';

/** Scene-typed Style 01 reference subsets. */
export const STYLE_01_REF_SUBSETS: Record<
  Style01SceneSubsetKey,
  { filenames: string[]; reason: string }
> = {
  'fantasy-cave': {
    filenames: [
      'ChatGPT Image May 18, 2026, 11_57_09 AM.png',
      'ChatGPT Image May 18, 2026, 11_59_17 AM.png',
      'ChatGPT Image May 18, 2026, 12_00_57 PM.png',
      'ChatGPT Image May 18, 2026, 12_06_22 PM.png',
    ],
    reason: 'Warm cave / magical interior watercolor refs.',
  },
  'cozy-interior': {
    filenames: [
      'ChatGPT Image May 18, 2026, 12_12_02 PM.png',
      'ChatGPT Image May 18, 2026, 12_14_37 PM.png',
      'ChatGPT Image May 18, 2026, 11_48_10 AM.png',
    ],
    reason: 'Bedroom / cozy interior soft watercolor refs.',
  },
  'outdoor-magical': {
    filenames: [
      'ChatGPT Image May 18, 2026, 11_48_10 AM.png',
      'ChatGPT Image May 18, 2026, 12_06_22 PM.png',
      'ChatGPT Image May 18, 2026, 12_14_37 PM.png',
    ],
    reason: 'Outdoor / sky / magical landscape watercolor refs.',
  },
};

const FANTASY_CAVE_RE =
  /\b(cave|cave mouth|cave entrance|cave interior|inside cave|stalactites|stalagmites|mountain cave|mountain peak|cliff|glowing stones?|warm stone|amber glow|cavern|grotto|hollow|rocky walls|מערה|אבנ(?:ים|ה)|הר|מצוק|נטיפים|זיבים)\b/iu;
const FOREST_CLEARING_RE =
  /\b(forest clearing|sunny forest|berry bush|mossy green rock|clearing)\b/iu;
const FOREST_PATH_RE =
  /\b(forest path|deeper forest path|walking into the forest|woods path|path into the forest)\b/iu;
const FOREST_DAY_RE =
  /\b(forest edge|forest\b|woods\b|trees(?: around| nearby| above)|meadow|woodland|יער|חורש|squirrel|berry bush)\b/iu;
const COZY_INTERIOR_RE =
  /\b(bedroom|bedside|crib|windowsill|indoor room|חדר|מיטה|עריסה)\b/iu;
const OUTDOOR_MAGICAL_RE =
  /\b(sky|clouds|mountain peak|above the clouds|שמיים|עננים)\b/iu;

/** Dini audition — recurring object detection keywords. */
export const DRAGON_DINI_RECURRING_OBJECT_CATALOG: Record<string, string[]> = {
  glowing_stone: [
    'glowing stone',
    'warm stone',
    'smooth stone',
    'beloved stone',
    'large stone',
    'אבן',
    'glow',
    'amber',
  ],
  blue_speckled_egg: [
    'blue-speckled',
    'blue speckled',
    'speckled egg',
    'round blue',
    'blue-speckled egg',
    'ביצה',
    'מנוקד',
  ],
};

export const DRAGON_DINI_RECURRING_OBJECT_LOCKS: Record<string, string> = {
  glowing_stone: `RECURRING OBJECT LOCK — GLOWING STONE:
Iconic story object — the same large smooth oval honey-gold stone every time it appears. Warm amber glow from within. Pale polished surface, rounded, heavy, cushion-sized. Identical proportions to pages 1–2 whenever visible. Do not turn it into a crystal, egg, pillow, lamp, random rock pile, or outdoor boulder.`,
  blue_speckled_egg: `RECURRING OBJECT LOCK — BLUE-SPECKLED EGG:
The same round blue-speckled egg whenever shown. Soft pale blue shell with darker blue freckles. Sits on Dini's beloved glowing stone. Do not change to white, green, cracked open early, gem-like, or a different object.`,
};

export const DRAGON_DINI_RECURRING_ENTITY_CATALOG: Record<string, string[]> = {
  baby_dragon: [
    'baby dragon',
    'baby — much smaller',
    'hatchling',
    'dragon cub',
    'nestles on',
    'hatched',
    'wobbly legs',
    'tiny harmless flame',
    'דרקון תינוק',
  ],
};

export const DRAGON_DINI_RECURRING_ENTITY_LOCKS: Record<string, string> = {
  baby_dragon: `RECURRING ENTITY LOCK — BABY DRAGON:
The same tiny copper-orange dragon hatchling whenever shown. Same species and color family as Dini — polished copper-to-sunset scales with warm amber highlights, NOT green, NOT teal, NOT blue, NOT lizard-like. Small sunset peach-coral wings, big gentle eyes, wobbly legs, soup-bowl size. Do NOT recolor per page.
Match the baby dragon reference sheets: oversized round head, two tiny soft head bumps (NOT developed horns), small side ear-flaps, folded tiny coral wings, chubby newborn body, soft pale cream underside.
CRITICAL — not a miniature adult Dini: this baby has softer features, NO developed horns, NO back spikes, NO fire yet, newborn proportions. Distinct from Dini's adult form even though they share copper-orange palette.`,
};

export const DRAGON_DINI_PAGE_5_ENVIRONMENT_LOCK = `ENVIRONMENT LOCK — CAVE INTERIOR (mandatory):
Mountain cave interior with rocky walls and warm amber glow from glowing stones. Same large honey-gold glowing stone as previous pages. Baby dragon on the warm zone; Dini displaced at the cooler shadow edge — sharing warmth, not exploring outdoors.
FORBIDDEN: forest, trees, outdoor plants, grass, meadow, open field, jungle foliage, blue-sky landscape outside a cave. This scene is NOT outdoors.`;

export const DRAGON_DINI_COMPANION_LOCK = `COMPANION LOCK — DINI (copper dragon):
Same Dini from the Dini reference sheets. Young copper-orange dragon with rounded childlike body proportions, short rounded snout, exactly two small curved horns on top of the head, small side ear-frills behind the cheeks (same shape every page — do NOT swap between ear, horn, fin and spike), three or four small back spikes behind the head (consistent count and spacing), large dark eyes with one small white highlight in each eye, warm cream belly plates from chin to belly, peach/coral sunset wing membranes, soft copper-orange scales, gentle expressive face. Same head landmarks, same horn shape, same ear-frills, same eye style, same body age and proportions every page. Warm hugging fire only — soft orange glow, never destructive flames.
Dini is a YOUNG PROTECTIVE dragon, older than the hatchling, with calm guardian energy — NOT baby-like, NOT toy-like, NOT a mascot, NOT a chibi/kawaii cartoon dragon. He is a young, friendly, slightly older sibling/companion type — NEVER a fully adult war-dragon, NEVER a stoic mature dragon.
CRITICAL — Dini is NOT a generic dragon, NOT a long lean lizard body, NOT green, NOT blue, NOT a realistic reptile, NOT an adult/ancient dragon, NOT a different rounded mascot. Keep the same rounded friendly Dini identity from the reference sheets across every page he appears.

ANATOMY EXACT COUNT (must not drift between pages):
- Horns: EXACTLY 2 (two), both small and curved upward, on top of the head ONLY.
  No third horn. No horn anywhere except top of head.
- Side ear-frills: EXACTLY 2 (one each side), small leaf-shaped flaps behind the cheeks.
  Must NEVER be drawn as horns. Must NEVER move to the top of the head.
- Back spikes: 3 or 4 small soft bumps ONLY behind the head and on the neck.
  Must NEVER extend down the full spine to the tail. Must NEVER become a saw-spine ridge.
- Wings: 2, peach/coral membrane. Same size relative to body across all pages.
- Body proportion: rounded childlike — head ~30% of body height, body chubby not lean.
  Must NEVER become a long lean adult dragon body.

ABSOLUTE ANATOMY LOCK (mandatory — never drift between pages):
- Body size: small-to-medium dragon. NOT a giant. NOT an adult war-dragon. Dini is approximately the size of a large dog, not a horse.
- Horns: EXACTLY TWO short horns on the head. Not three. Not one. Not changing. Short and slightly curved.
- Side ear-fins: small lateral fin-like ears constant on every page. Same shape, same size.
- Wings: small, folded close to body most of the time. Membrane color: warm peach-orange. NEVER huge spread wings. NEVER bat-like wide.
- Back: small soft ridge bumps (NOT large spikes, NOT changing spike pattern between pages).
- Belly: pale cream with visible soft horizontal segment lines. SAME segmentation every page.
- Eyes: large, friendly, warm amber-brown. SAME size and shape every page.
- Snout: short and rounded, not elongated. Friendly expression.
- Tail: short-to-medium, tapered, ending in a small curved tip. NEVER long whip-tail.

FORBIDDEN DRAGON RENDERINGS:
- NOT a lizard. NOT a dinosaur. NOT a salamander.
- NOT an adult war-dragon. NOT a Skyrim-style dragon.
- NOT a Western heraldic dragon with huge horns and giant spread wings.
- NOT a teen dragon between baby and adult.
- NOT identical to the baby_dragon (anti-merge applies).

CONSISTENCY OVER POSE:
Whatever the pose or angle on each page, Dini's anatomy stays constant: 2 horns (not 4), small folded wings (not huge spread), small ridge bumps (not changing spikes), peach-orange membrane (not red, not yellow, not green).`;

export type Style01SubjectScale = 'small' | 'medium' | 'large';

export function subjectScaleHeightRange(scale: Style01SubjectScale): string {
  switch (scale) {
    case 'small':
      return '25-35';
    case 'medium':
      return '35-50';
    case 'large':
      return '50-60';
  }
}

export type Style01CompositionSpec = {
  shotType: string;
  camera: string;
  subjectDominance: string;
  staging: string;
  pagePurpose: string;
  /** Character height in frame — small/medium/large per Style 01 breathe rule. */
  subjectScale: Style01SubjectScale;
};

/** Per-page composition targets for dragon_dini 5-page audition. */
export const DRAGON_DINI_COMPOSITION_BY_PAGE: Record<number, Style01CompositionSpec> = {
  1: {
    shotType: 'wide establishing',
    subjectScale: 'small',
    camera: 'wide angle from inside cave looking out — clouds and sky visible through cave mouth',
    subjectDominance:
      'Vast mountain cave environment dominates; glowing stones scattered; Dini small inside, lower-left of frame',
    staging:
      'Wide establishing — vast mountain cave, clouds and sky visible through cave mouth, glowing stones scattered. Dini small inside, lower-left of frame.',
    pagePurpose: 'Introduce Dini\'s mountain cave above the clouds — no human child',
  },
  2: {
    shotType: 'intimate airy',
    subjectScale: 'medium',
    camera: 'medium-wide inside cave — stone walls and surrounding pebbles visible, not a face close-up',
    subjectDominance:
      'Dini curled on glowing stone in middle of cave; warm light atmosphere; environment shares frame',
    staging:
      'Intimate but airy — Dini curled on glowing stone in middle of cave, stone walls and other glowing pebbles visible around, warm light atmosphere. NOT a tight close-up on Dini\'s face.',
    pagePurpose: 'Intimate comfort moment — one dragon, one stone — no human child',
  },
  3: {
    shotType: 'discovery wide',
    subjectScale: 'small',
    camera: 'wide depth shot — cave entrance backlit with sunset, full cave depth visible',
    subjectDominance:
      'Blue-speckled egg on glowing stone in middle distance; Dini hovering in mid-distance',
    staging:
      'Discovery wide — cave entrance backlit with sunset, Dini hovering in mid-distance, blue-speckled egg on the glowing stone visible in middle distance. Frame shows the depth of the cave.',
    pagePurpose: 'Discovery beat — something new on the stone — no human child',
  },
  4: {
    shotType: 'medium-wide reveal',
    subjectScale: 'medium',
    camera: 'medium-wide inside cave — interior walls and floor visible around subjects',
    subjectDominance:
      'Dini and freshly-hatched baby dragon on glowing stone; both in lower half of frame',
    staging:
      'Medium-wide reveal — Dini and freshly-hatched baby dragon on the glowing stone, cave interior visible around them, hatched eggshell fragments scattered. Both dragons in lower half of frame.',
    pagePurpose: 'Hatching reveal — still no human child',
  },
  5: {
    shotType: 'medium emotional wide',
    subjectScale: 'medium',
    camera: 'medium-wide inside cave — rocky walls, depth and atmosphere visible, no outdoor foliage',
    subjectDominance:
      'Copper baby on warm zone of stone; Dini at cooler edge; cave interior depth visible',
    staging:
      'Emotional wider — Dini at cooler edge, copper baby on warm zone of the stone. Cave interior with depth and atmosphere visible. INTERIOR ONLY — no outdoor staging.',
    pagePurpose: 'Sharing warmth inside the cave — emotional squeeze, not outdoor exploration',
  },
  6: {
    shotType: 'wide establishing transition',
    subjectScale: 'small',
    camera: 'wide interior home — cozy living room visible, child in foreground, family with newborn in background',
    subjectDominance:
      'Cozy home interior — red-roofed house exterior visible through window, child stands separately watching mom and dad cradling a tiny SWADDLED NEWBORN baby; child in lower-third on his own area of the rug, parents on sofa across the room. ONLY mom + dad + newborn — NO grandma, NO siblings, NO extra figures. CRITICAL: the newborn is a TINY HUMAN BABY wrapped in a swaddle blanket, held by an adult — NOT a toddler, NOT another standing child. The child protagonist (Noam) is the only independent standing child in the scene. Clear emotional distance: a coffee table, a pool of light, or the edge of the rug visually separates the child from the family group.',
    staging:
      'Interior home with sunlight through blue window, ONLY mom and dad sitting together holding a swaddled newborn baby in arms (looks newborn-sized in a swaddle, NOT toddler-sized) on sofa, child standing on rug a clear visual distance away watching quietly. Child has his own pool of space — visible separation. NO grandma, NO siblings, NO dragon, NO cave, NO mountain.',
    pagePurpose: 'Switch to child world — new sibling has arrived; emotional distance between child and family is the read',
  },
  7: {
    shotType: 'medium emotional',
    subjectScale: 'small',
    camera: 'medium-wide home interior — family living room, soft warm afternoon light',
    subjectDominance:
      'Three figures attending to the SWADDLED newborn baby: mom holding the swaddled baby + grandma close beside her offering gentle hands. NO additional family characters — NO sister, NO other child, NO extra adult. The child protagonist sits a clear distance away on the floor on his own, holding a small toy block, watching quietly. The baby is a TINY HUMAN NEWBORN wrapped in a swaddle blanket — NOT a toddler, NOT another standing child. The child protagonist remains the only independent child.',
    staging:
      'Living room: mom + grandma clustered around a swaddled newborn baby getting gentle attention; child sits alone on rug holding a wooden block, watching from a clear visual distance (across the rug, with floor space between them). Warm afternoon light. NO sister figure, NO additional adults beyond mom and grandma, NO dragon, NO cave.',
    pagePurpose: "Show the child's quiet emotional distance from the family's focus on baby — the distance itself is the read",
  },
  8: {
    shotType: 'medium magical',
    subjectScale: 'small',
    camera: 'medium-wide interior — orange glowing light path on the floor leading toward door',
    subjectDominance:
      'Small magical orange light glides across living room floor like a soft glowing trail; child rises curiously to follow; family in background still occupied with baby (unaware). The orange light is ABSTRACT — no face, no wings, no creature body, no fairy, no fireball, no eyes.',
    staging:
      'Same home interior. A small orange glowing magical light hovers just above the floor, tracing a path from near the window, under a chair, toward the door. Child standing, drawn to follow. Family in background unaware. NO dragon visible — only the light hint. Light is a soft abstract glow, NOT a creature.',
    pagePurpose: 'Mystery invitation — magical light leads child on a journey',
  },
  9: {
    shotType: 'wide journey',
    subjectScale: 'small',
    camera: 'wide outdoor mountain — narrow path between huge boulders, mountain rises into clouds above',
    subjectDominance:
      'Child small on narrow path between two massive grey boulders; single small orange floating light hovers exactly one step ahead, lighting only the next stone; mountain rises into soft clouds above. The orange light remains ABSTRACT — no face, no wings, no creature, no fairy, no fireball.',
    staging:
      'Outdoor mountain landscape, narrow ascending path between huge stones, child mid-climb carefully, single small orange magical light just one step ahead. The mountain rises into soft clouds. NO cave entrance visible yet — that comes in p10. Light is a soft abstract glow.',
    pagePurpose: 'The journey upward — guidance one step at a time',
  },
  10: {
    shotType: 'discovery medium-wide',
    subjectScale: 'medium',
    camera: 'medium-wide at cave entrance — child peeks in, Dini and baby visible inside',
    subjectDominance:
      "Child cautiously peeks into cave entrance; inside, Dini — clearly older than the baby dragon but still young, friendly and protective (NOT a fully adult war-dragon) — lies tiredly beside the large glowing stone where the baby dragon shivers slightly. EMOTIONAL CENTER: Dini turns his head fully toward the child; their eyes meet directly. The glowing stone is OFF-CENTER and SECONDARY — not the main subject of the frame. Baby dragon is visible but lying small on the stone, also secondary. Exactly ONE Dini (young guardian-type, not adult) and exactly ONE baby dragon. No second dragon.",
    staging:
      "Mountain cave entrance with child standing in the threshold looking in; inside the cave Dini — the older young copper dragon — has his head fully turned toward the child, gaze locking onto the child's face (clear eye contact). The baby dragon nestled on the stone shivering (smaller, secondary, off to one side). The glowing stone is positioned off-center in the frame, NOT central. Atmosphere: cool, dim, in need of warmth. The eye-contact moment is the focal action.",
    pagePurpose: 'First meeting — child arrives at the parallel world; emotional read is child↔Dini connection',
  },
  11: {
    shotType: 'medium tentative reveal',
    subjectScale: 'medium',
    camera: 'medium-wide cave interior — child enters from threshold, Dini and baby visible inside',
    subjectDominance:
      "Child takes one careful step into the cave (foot just over the threshold). Dini raises his head with cautious hope, eyes locking on the child. Baby dragon shivers on the glowing stone. Cave glow is dim but the child's face is determined. EMOTIONAL CENTER: tentative meeting, eye contact between child and Dini.",
    staging:
      'Cave interior, child entering carefully through entrance, Dini raising head from beside the stone, baby on stone shivering. Cave glow dim, atmosphere cautious and hopeful.',
    pagePurpose: 'Crossing the threshold — child accepts the invitation',
  },
  12: {
    shotType: 'medium intimate',
    subjectScale: 'medium',
    camera: 'medium close on Dini at the stone — wing being shifted aside, gap forming',
    subjectDominance:
      "Dini gently shifts ONE wing aside, opening a small space on the warm stone between himself and the shivering baby dragon. Child sits respectfully nearby on cave floor (not yet on the stone). Stone glow brightens fractionally where the new space opens. FOCAL ACTION: Dini's wing-shift creating room.",
    staging:
      'Dini moving his wing aside, creating a visible small gap on the warm stone, baby nestled on warm zone, child sits attentively nearby. Stone glows slightly brighter.',
    pagePurpose: 'Making room — the literal physical act of sharing',
  },
  13: {
    shotType: 'medium intimate three-shot',
    subjectScale: 'medium',
    camera: 'medium close — all three on/around the glowing stone',
    subjectDominance:
      "Child now sits on the warm stone in the gap Dini made. Baby dragon has crawled close and nestled against the child's side. Dini exhales a soft warm breath. Stone glows visibly BRIGHTER under all three. Cave hums (visible warm light). FOCAL READ: three-way warmth.",
    staging:
      "Child seated on the warm stone, baby dragon nestled against child's side, Dini exhaling soft breath nearby, stone glowing visibly brighter with all three together. Cave warm.",
    pagePurpose: 'The "stone of three" — physical inclusion completed',
  },
  14: {
    shotType: 'medium-wide cave perspective',
    subjectScale: 'medium',
    camera: 'medium-wide showing cave wall with smaller stones lighting up around',
    subjectDominance:
      "Cave perspective showing the warmth visibly SPREADING outward. Big stone glows. Smaller stones along the cave wall also light up. Dini's previously-cold tail tip is now warm and visible in light. Baby has sneezed a tiny copper spark that just lit another stone. Dini is wide-eyed in mild amazement.",
    staging:
      'Wider cave view, multiple stones glowing in chain reaction, Dini\'s tail now warm, baby with a tiny spark of fire at its nose, freshly-lit stones around the cave.',
    pagePurpose: 'Warmth multiplies — the uncomfortable truth: "I thought if I give my warmth, I\'d have less"',
  },
  15: {
    shotType: 'intimate medium',
    subjectScale: 'medium',
    camera: 'medium shot — child + Dini + sleeping baby on the bright stone',
    subjectDominance:
      'Child sits with Dini and the now-SLEEPING baby dragon on the bright stone. Child has a soft thoughtful smile. Dini raises a comically expressive dragon eyebrow (the "cookie comparison"). Cave glows steadily warm. Quiet humor moment.',
    staging:
      'Child and Dini side by side on warm stone, sleeping baby curled between them. Dini with one raised eyebrow expression. Cave warm and golden.',
    pagePurpose: '"Warmth isn\'t like a cookie" — the metaphor lands quietly',
  },
  16: {
    shotType: 'medium intimate',
    subjectScale: 'medium',
    camera: 'medium shot of all three settled on the stone, cave fully warm',
    subjectDominance:
      'Dini scoots over slightly MORE, making room one more time. Baby dragon and child both nestled on the warm bright stone. Dini\'s face shows a tiny conceding smile (he\'s accepting it). Cave is FULLY GLOWING WARM now — chain of lit stones throughout.',
    staging:
      'All three on the stone settled in, cave warmly lit throughout, Dini with a softened smile.',
    pagePurpose: '"Stone of three" — name accepted',
  },
  17: {
    shotType: 'medium transitional descent',
    subjectScale: 'small',
    camera: 'medium-wide showing mountain path descending + home visible through window',
    subjectDominance:
      'Child returns DOWN the mountain path with the small abstract orange light leading. Approaching the family home (red roof visible). Inside the window: mom holds a crying newborn baby, dad searching for a pacifier under a blanket — a busy, tired moment. The orange light remains ABSTRACT (NO face, NO wings, NO creature, NO fairy).',
    staging:
      'Mountain path descending toward home with red-roofed house at base. Through the window, busy parents with crying newborn. Small abstract orange light hovering on the path ahead of the child. NO dragon visible.',
    pagePurpose: 'Returning home — same scene as departure but child is changed',
  },
  18: {
    shotType: 'medium intimate family inclusion',
    subjectScale: 'small',
    camera: 'medium-wide on the sofa — mom + dad + child + newborn',
    subjectDominance:
      "Child sits CLOSE to mom on the sofa. Mom's free arm pulls child in (visible inclusion gesture). Baby's tiny hand wraps around the child's finger. Dad sits on other side, just having found the pacifier. The newborn is a TINY SWADDLED human baby — NOT a toddler. Gentle moment of inclusion. Soft evening light through window. NO dragon, NO cave.",
    staging:
      "Cozy living room sofa. Mom + dad on sofa together, swaddled newborn in mom's arms, child pulled in close by mom's free arm, baby's tiny hand on child's finger. Soft evening light.",
    pagePurpose: 'Physical inclusion — the warmth from the cave is now home',
  },
  19: {
    shotType: 'medium-wide family hug',
    subjectScale: 'medium',
    camera: 'medium-wide on the family hug — slightly disheveled, very warm',
    subjectDominance:
      'Family hug: mom, dad, swaddled newborn baby, AND the child all together on the sofa. Imperfect but warm. The pacifier has fallen on the floor visibly. The blanket is half-slumped off the sofa. Everyone slightly disheveled but close. Child eyes softly closed for a moment, peaceful. Golden evening glow through window. THE HEART LINE moment.',
    staging:
      'Sofa family hug, all four members close, slight chaos (pacifier on floor, blanket half-slumped), everyone happy and warm. Golden hour glow through window.',
    pagePurpose: '"The hug didn\'t get smaller — it learned to make room"',
  },
  20: {
    shotType: 'wide intimate bedtime',
    subjectScale: 'small',
    camera: 'wide bedroom at night — child in bed, windowsill in frame',
    subjectDominance:
      'Night. The child is tucked into bed peacefully, soft expression. On the windowsill in the foreground/middle ground, a tiny warm orange spark glows softly — a small ember reminder from the mountain. Moonlight through the window. In the next room (visible through a slightly-open doorway), a faint warm light suggests the baby is also peaceful. Home is quiet and at rest. The orange spark remains ABSTRACT (no face, no creature, no Dini).',
    staging:
      "Child's bedroom at night. Child tucked peacefully in bed. Tiny warm orange spark on windowsill (abstract — just a soft glow). Moonlight. Doorway to baby's room with faint warm light. Quiet rest.",
    pagePurpose: 'Residue ending — "there is room"; the warmth persists',
  },
};

/** bear_cub_gahal (Dobi) — 10-page continuity audition composition targets. */
export const BEAR_CUB_DOBI_COMPOSITION_BY_PAGE: Record<number, Style01CompositionSpec> = {
  1: {
    shotType: 'wide establishing',
    subjectScale: 'small',
    camera: 'wide forest clearing — trees and sky visible, Dobi small in lower third',
    subjectDominance: 'Forest clearing and berry bush territory dominate; Dobi small beside bush',
    staging: 'Sunny forest clearing beside mossy green rock and berry bush — environment breathes',
    pagePurpose: 'Introduce Dobi and his beloved berry bush',
  },
  2: {
    shotType: 'medium reaction',
    subjectScale: 'medium',
    camera: 'medium-wide on Dobi and empty berry bush — forest context visible',
    subjectDominance: "Dobi's frustration at bare bush; squirrel on branch; woods around",
    staging: 'Berry bush stripped bare; Dobi tensing, paws ready; clearing visible',
    pagePurpose: 'Anger rising — unfair empty bush',
  },
  3: {
    shotType: 'medium walk-away',
    subjectScale: 'medium',
    camera: 'medium-wide tracking shot — forest path depth visible',
    subjectDominance: 'Dobi clamping mouth shut with effort, cheeks puffed, shoulders hunched, taking one careful step away; path and trees share frame',
    staging: 'Forest path, tense shoulders, squirrel watching from bush',
    pagePurpose: 'Choosing safe release over lashing out',
  },
  4: {
    shotType: 'medium two-shot',
    subjectScale: 'medium',
    camera: 'medium-wide at forest edge — trees and path visible behind figures',
    subjectDominance: 'Child with broken crayon; Dobi pauses; both in lower half, environment visible',
    staging: 'Forest edge meeting — child present, emotional mirror; open woodland context',
    pagePurpose: 'Child and Dobi share the same hot anger',
  },
  5: {
    shotType: 'intimate gentle',
    subjectScale: 'medium',
    camera: 'medium shot — forest edge depth visible, not a portrait crop',
    subjectDominance: 'Gentle invitation — Dobi nudges hand; child surprised; environment breathes',
    staging: 'Soft forest edge; Dobi nudges hand; child surprised; trees and path in background',
    pagePurpose: 'Companion invites child toward safe release',
  },
  6: {
    shotType: 'wide establishing transition',
    subjectScale: 'small',
    camera: 'wide forest path opening into clearing — depth visible, archway of trees, pond clearing ahead',
    subjectDominance: 'Dobi and child small in lower third walking forward; lush ferns, mossy roots, pond clearing revealed ahead',
    staging: 'Forest path with tall ferns and mossy roots opening into pond clearing — round blue pond and large fallen log visible ahead',
    pagePurpose: 'Transition from anger to safe space — environment shift, discovery of pond',
  },
  7: {
    shotType: 'intimate medium',
    subjectScale: 'medium',
    camera: 'medium shot — Dobi at pond edge, mirror-still water with his reflection visible',
    subjectDominance: 'Dobi alone at pond edge, mouth closed after the roar, seeing his upset reflection in the still blue water; ripples beginning to break the reflection',
    staging: 'Still mirror pond, Dobi just finished roaring, mouth now closed, ripples spreading from where his roar hit the water, his rippled reflection beginning to fragment',
    pagePurpose: 'Self-confrontation through reflection — discovering safe roar',
  },
  8: {
    shotType: 'medium two-shot',
    subjectScale: 'medium',
    camera: 'medium-wide at pond edge — both characters and water visible',
    subjectDominance: 'Child and Dobi side by side at pond edge; child mid-roar toward the water (NOT toward Dobi), Dobi watching calmly',
    staging: 'Pond edge, child roaring toward the still water with soft round open mouth (vowel shape, no teeth), Dobi watching gently from beside, ripples spreading outward across pond',
    pagePurpose: 'Child learns roaring at safe space — the pond receives it',
  },
  9: {
    shotType: 'medium-wide action',
    subjectScale: 'medium',
    camera: 'medium-wide at pond — sky visible above tree canopy',
    subjectDominance: 'Child and Dobi both roaring together toward the water; two small birds startled from a tree branch overhead, one looking offended (secondary detail, not focal)',
    staging: 'Pond, both characters mid-roar toward water (not at each other, not at viewer), two small birds flying up from nearby tree branch — birds are background secondary',
    pagePurpose: 'Shared release — anger begins to move through the body',
  },
  10: {
    shotType: 'medium action',
    subjectScale: 'medium',
    camera: 'medium shot at pond edge — both characters mid-throw, water with splashes',
    subjectDominance: 'Dobi skipping a flat stone across pond; child mid-throw with a smooth grey stone; visible splashes and ripples in pond',
    staging: 'Pond edge with small smooth grey stones scattered around the bank; both characters mid-throw, two small splashes visible in pond water',
    pagePurpose: 'Physical release through stone-throwing — safe water receiving heavy feelings',
  },
};

export const BEAR_CUB_DOBI_RECURRING_OBJECT_CATALOG: Record<string, string[]> = {
  berry_bush: ['berry bush', 'shrub', 'bush', 'branches', 'פטל', 'שיח'],
  mossy_rock: ['mossy green rock', 'mossy rock', 'green rock', 'סלע'],
  broken_crayon: ['broken crayon', 'red-orange crayon', 'snapped crayon', 'broken red crayon', 'עפרון שבור'],
  pond: ['pond', 'water', 'mirror-like water', 'blue pond', 'still pond', 'בריכה'],
  fallen_log: ['fallen log', 'fallen tree', 'log', 'tree trunk', 'גזע'],
};

export const BEAR_CUB_DOBI_RECURRING_OBJECT_LOCKS: Record<string, string> = {
  berry_bush: `RECURRING OBJECT LOCK — BERRY BUSH:
The same wild forest berry bush. Distinctive visual signature: round dark-green leaves arranged in clusters of three, with bright crimson-red berries (small, round, ~1cm each) hanging in tight clusters of 5–7 berries. Bush height approximately knee-high to the child. Slightly weathered look — a real forest bush, not a manicured garden plant. Same exact bush appears in every page where present — same shape, same berry density, same lean to one side.`,
  mossy_rock: `RECURRING OBJECT LOCK — MOSSY GREEN ROCK:
The same large mossy boulder. Distinctive visual signature: rounded grey granite boulder approximately waist-high to the child, with a thick velvety moss covering the top third (vivid green moss, soft texture, slightly darker green in shaded crevices). Small patches of orange-yellow lichen on the exposed grey rock face. Same exact rock in every page where present — same silhouette, same moss coverage, same lichen pattern.`,
  broken_crayon: `RECURRING OBJECT LOCK — BROKEN CRAYON:
The same broken crayon, snapped into two uneven pieces. Color: warm red-orange (like a sun-drawing crayon, NOT blue, NOT green, NOT yellow). Both pieces visible, jagged white break edge between them. Held in the child's left hand throughout pages where present — same color, same break angle, same proportions. NEVER intact, NEVER a different color.`,
  pond: `RECURRING OBJECT LOCK — POND:
The same hidden forest pond. Distinctive visual signature: round shape, roughly 4-5 meters across (NOT a lake, NOT an ocean, NOT a river, NOT a swimming pool, NOT a puddle). Water color is deep clear blue (like a piece of sky fallen to earth), mirror-still surface when calm with reflections of the tree canopy above. Surrounded by smooth grey river stones and small mossy rocks at the edge. One large fallen log lies near the right edge of the pond. Same exact pond appears in every page where present — same size, same shape, same blue water tone, same edge details. It is small, intimate, contained — a safe container the size of a child's bedroom rug.`,
  fallen_log: `RECURRING OBJECT LOCK — FALLEN LOG:
The same large fallen tree trunk lying horizontally near the pond's right edge. Distinctive visual signature: thick old oak or pine trunk, weathered grey-brown bark with patches of vivid green moss along the top length, gentle slope (one end slightly higher than the other), broken at one end with exposed pale heartwood. Approximately as long as 4 children laid end-to-end. Same exact log appears in every page where present — same orientation, same moss coverage, same broken end.`,
};

export const BEAR_CUB_DOBI_COMPANION_LOCK = `COMPANION LOCK — DOBI (warm living bear cub):
Same living bear cub from the Dobi reference sheets. Small chubby warm honey-brown fur, round cub body, small rounded ears on top, large amber-brown eyes with white highlight, thick expressive eyebrows, shiny black wet nose, short rounded snout, warm cream chest patch, soft slightly messy head fur, oversized soft paws. Same fur tone and proportions every page.
CRITICAL — Dobi is a soft hand-drawn living bear cub character, NOT a teddy bear toy, NOT plush, NOT a stuffed animal, NOT a mascot costume, NOT overly human-like, NOT a polar bear, NOT a panda, NOT a realistic photo bear, NOT a brown grizzly. Storybook cub presence — alive, gentle, expressive.

CUB PROPORTIONS LOCK (mandatory — never violate):
- Dobi is a BEAR CUB, not an adult bear. Body length is approximately equal to the child's torso, NOT taller.
- If standing on all fours next to a 6-year-old child, Dobi's shoulder height reaches the child's WAIST at most. Never higher.
- If reared up on hind legs, Dobi's head reaches the child's CHEST. Never the child's shoulder or higher.
- Head is proportionally LARGE relative to body (cub proportions — ~30% of total body length). Eyes are large and round (juvenile facial structure).
- Legs are short and stubby relative to body. NOT the long muscular legs of an adult bear.
- Snout is short and rounded — almost button-like. NOT the long muzzle of an adult.
- Belly is round and soft. NOT the lean, muscular silhouette of an adult brown bear.
- The viewer should immediately read "young animal" — not "scaled-down adult bear."

ABSOLUTE SIZE RULE vs CHILD (mandatory on every page where both appear):
- Dobi is noticeably SMALLER than the child. Never the same height.
- On all fours: top of Dobi's head reaches BELOW the child's hip line.
- Standing upright on hind legs: top of Dobi's head reaches BELOW the child's chest line.
- If Dobi appears alone in a page (no child), Dobi still reads visually as a small cub — small body, large head, short stubby legs.
- NEVER scale Dobi up to teen-bear or adult-bear size. NEVER let Dobi tower over or match the child.

CHILD-SAFE EMOTION RULE (mandatory — never violate, even on anger/frustration pages):
- NO bared teeth visible. Mouth stays closed or slightly open in a soft pout.
- NO snarling expression. NO aggressive baring of canines or incisors.
- NO threatening posture (no raised hackles, no aggressive forward lean with claws extended).
- Anger or frustration is expressed via: furrowed brow, eyes squinted slightly, ears flattened back, shoulders hunched, head lowered, paws curled into soft fists.
- The emotion should read as "upset child" — pouting, sulky, sad-angry — never as "wild predator."
- Even on the most intense emotional pages, Dobi remains visually GENTLE and SAFE for a 4–6 year old reader.`;

export type Style01StoryLockBundle = {
  recurringObjectCatalog?: Record<string, string[]>;
  recurringObjectLocks: Record<string, string>;
  recurringEntityCatalog?: Record<string, string[]>;
  recurringEntityLocks: Record<string, string>;
  companionLock?: string;
  compositionByPage?: Record<number, Style01CompositionSpec>;
  pageEnvironmentLock?: (pageNumber: number) => string | undefined;
};

export function resolveStyle01StoryLocks(companionId?: string | null): Style01StoryLockBundle {
  if (companionId === 'dragon_dini') {
    return {
      recurringObjectCatalog: DRAGON_DINI_RECURRING_OBJECT_CATALOG,
      recurringObjectLocks: DRAGON_DINI_RECURRING_OBJECT_LOCKS,
      recurringEntityCatalog: DRAGON_DINI_RECURRING_ENTITY_CATALOG,
      recurringEntityLocks: DRAGON_DINI_RECURRING_ENTITY_LOCKS,
      companionLock: DRAGON_DINI_COMPANION_LOCK,
      compositionByPage: DRAGON_DINI_COMPOSITION_BY_PAGE,
      pageEnvironmentLock: (pageNumber) =>
        pageNumber === 5 ? DRAGON_DINI_PAGE_5_ENVIRONMENT_LOCK : undefined,
    };
  }
  if (companionId === 'bear_cub_gahal') {
    return {
      recurringObjectCatalog: BEAR_CUB_DOBI_RECURRING_OBJECT_CATALOG,
      recurringObjectLocks: BEAR_CUB_DOBI_RECURRING_OBJECT_LOCKS,
      recurringEntityCatalog: undefined,
      recurringEntityLocks: {},
      companionLock: BEAR_CUB_DOBI_COMPANION_LOCK,
      compositionByPage: BEAR_CUB_DOBI_COMPOSITION_BY_PAGE,
    };
  }
  return {
    recurringObjectLocks: {},
    recurringEntityLocks: {},
  };
}

export function isStyle01Phase2BookPipelineEnabled(): boolean {
  return process.env.PHASE2_STYLE01_BOOK_PIPELINE?.trim().toLowerCase() === 'true';
}

export function isStyle01BookStyle(styleIdInput?: string | null): boolean {
  if (!styleIdInput) return false;
  const s = styleIdInput.trim().toLowerCase();
  return (
    s === STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK ||
    s === 'soft_hand_drawn_storybook' ||
    s === 'pencil_watercolor' ||
    s === 'realistic_illustrated'
  );
}

export function shouldUseStyle01Phase2Path(styleIdInput?: string | null): boolean {
  return isStyle01Phase2BookPipelineEnabled() && isStyle01BookStyle(styleIdInput);
}

export function resolveStyle01RefBudgetConfig(): Style02RefBudgetConfig {
  const raw = (process.env.PHASE2_STYLE01_REF_CONFIG ?? process.env.PHASE2_STYLE02_REF_CONFIG ?? 'A')
    .trim()
    .toUpperCase();
  if (raw === 'B' || raw === 'C') return raw;
  return 'A';
}

export function resolveStyle01SceneRefSubset(sceneClass: Style01SceneClass): Style01SceneSubsetKey {
  if (sceneClass === 'fantasy-cave') return 'fantasy-cave';
  if (sceneClass === 'cozy-interior') return 'cozy-interior';
  return 'outdoor-magical';
}

export function classifyStyle01SceneClass(input: {
  imagePrompt?: string;
  bookPageText?: string;
  rawScenePrompt?: string;
}): Style01SceneClass {
  const hay = [input.imagePrompt ?? '', input.rawScenePrompt ?? '', input.bookPageText ?? ''].join(' ');

  // Cave is the most specific scene — when cave keywords appear, cave wins
  // even if forest words also appear (e.g. plants near cave entrance).
  if (FANTASY_CAVE_RE.test(hay)) return 'fantasy-cave';

  if (FOREST_PATH_RE.test(hay)) return 'forest-path';
  if (FOREST_CLEARING_RE.test(hay)) return 'forest-clearing';
  if (FOREST_DAY_RE.test(hay)) return 'forest-day';

  if (COZY_INTERIOR_RE.test(hay)) return 'cozy-interior';
  if (OUTDOOR_MAGICAL_RE.test(hay)) return 'outdoor-nature';
  return 'fantasy-cave';
}

export function resolveStyle01StyleReferencePaths(
  sceneClass: Style01SceneClass,
  maxCount: number
): string[] {
  const subsetKey = resolveStyle01SceneRefSubset(sceneClass);
  const subset = STYLE_01_REF_SUBSETS[subsetKey];
  return subset.filenames.slice(0, maxCount).map((f) => path.join(STYLE_01_REF_DIR, f));
}

export function listStyle01SheetImages(dir: string, maxCount: number): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort()
    .slice(0, maxCount)
    .map((f) => path.join(dir, f))
    .filter((p) => existsSync(p));
}

export function resolveStyle01CompanionReferencePaths(input: {
  companionId?: string | null;
  companionImage?: string | null;
  presentEntities?: string[];
}): string[] {
  const companionId = input.companionId?.trim();
  const paths: string[] = [];

  if (companionId === 'dragon_dini' && input.presentEntities?.includes('baby_dragon')) {
    const babyDir = path.join(
      process.cwd(),
      'public',
      'companions',
      'dragon_dini',
      'style01-sheets',
      'baby-dragon'
    );
    paths.push(...listStyle01SheetImages(babyDir, 1));
  }

  if (companionId) {
    const sheetsDir = path.join(process.cwd(), 'public', 'companions', companionId, 'style01-sheets');
    const sheetPaths = listStyle01SheetImages(sheetsDir, 3);
    if (sheetPaths.length >= 3) {
      return sheetPaths.slice(0, 3);
    }
  }

  const single = resolveStyle01CompanionReferencePath(input.companionImage);
  return single ? [single] : [];
}

export function resolveStyle01CompanionReferencePath(
  companionImage?: string | null
): string | undefined {
  if (!companionImage?.trim()) return undefined;
  const trimmed = companionImage.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const publicAbs = path.join(process.cwd(), 'public', trimmed.replace(/^\//, ''));
  if (existsSync(publicAbs)) return publicAbs;
  if (existsSync(trimmed)) return trimmed;
  return undefined;
}

export function buildStyle01ChildVisualLock(input: {
  childName?: string | null;
  childDescription?: string;
  childStructured?: { face: string; hair: string; body: string; signature: string };
  childAge?: number | null;
  childGender?: string | null;
}): string {
  const cs = input.childStructured;
  if (cs?.face?.trim() && cs?.hair?.trim()) {
    const ageBit = input.childAge ? ` Age ${input.childAge}.` : '';
    const genderBit = input.childGender ? ` ${input.childGender}.` : '';
    return `CHILD VISUAL LOCK (verbatim when child appears): ${cs.face}. ${cs.hair}. ${cs.body}.${ageBit}${genderBit} ${cs.signature ?? ''}`.trim();
  }
  const name = (input.childName ?? 'the child').trim();
  const desc = (input.childDescription ?? 'young child protagonist').trim();
  return `CHILD VISUAL LOCK (verbatim when child appears): ${name} — ${desc}.`.trim();
}

export function buildStyle01WardrobeLock(_input?: {
  childStructured?: { clothing: string };
}): string {
  /**
   * NOAM TEST CHILD ANCHOR (temporary):
   *
   * For this Dini/Noam audition only, the yellow sun icon on the blue shirt is
   * part of Noam's temporary test-child visual DNA. It is a deliberate QA anchor
   * used to measure character consistency across pages. It must NOT become a
   * production default. In production, wardrobe will be derived from the
   * uploaded child photo and/or parent-provided child configuration.
   *
   * Do NOT overfit the whole child identity to the sun icon. The sun is a
   * secondary visual anchor, not the definition of the child. See
   * buildStyle01ChildAnatomicalLock for the identity-side anchors.
   */
  return `BOOK WARDROBE LOCK (mandatory — never drift, every page where child appears):
- Shirt: plain solid sky-blue t-shirt with a small yellow sun graphic at center chest. NO stripes. NO patterns. NO logos. NO other shapes. NEVER a striped shirt. NEVER a plain blue shirt without the sun.
- Shorts: dark denim shorts, mid-thigh length. Same wash on every page.
- Shoes: RED sneakers with white laces and white rubber soles. MANDATORY red. NEVER white sneakers. NEVER any other color.
- Wrist accessory: small green wristband on LEFT wrist, visible on every page.
- Same outfit on every page. NEVER substitute or simplify any element.`;
}

export function buildStyle01ChildAnatomicalLock(_input?: {
  childStructured?: { age: number };
}): string {
  return `CHILD ANATOMICAL LOCK (mandatory — never drift between pages):
- Age: approximately 4–5 years old (preschool/kindergarten age). NOT 7–8. NOT a school-age child. NOT a teenager. NOT a toddler-baby.
- Body proportions: small child body. Head is slightly large relative to body (typical preschool proportions). NOT an adult body shrunk down. NOT a teen build.
- Hair: dark brown, slightly wavy, short-to-medium length. SAME volume and silhouette on every page. NOT straight, NOT longer than mid-ear, NOT styled differently between pages.
- Face: large dark eyes, soft round cheeks, small button nose, gentle childlike expression. SAME face shape and features every page.
- Skin tone: SAME light olive skin tone on every page. NEVER drift lighter or darker between pages.
- Ethnicity: SAME apparent ethnicity on every page. No drift between pages.
- Forbidden child renderings: NOT a teen, NOT a school-age (8+) child, NOT a baby/toddler, NOT a different child between pages.

CHILD CONSISTENCY OVER WARDROBE ANCHORS:
The wardrobe (sun icon, red shoes, green wristband) is a secondary visual anchor — it helps but does not define the child. The child's age, face, hair, body proportions, and skin tone must remain consistent across every page even when the sun icon or wristband is partially hidden or out of frame. NEVER define the child by the wardrobe.`;
}

export function buildStyle01CompanionTextLock(input: {
  companionName?: string;
  companionStructured?: { species: string; size: string; coloring: string; feature: string };
  companionVisualDescription?: string;
  storyCompanionLock?: string;
}): string {
  if (input.storyCompanionLock?.trim()) return input.storyCompanionLock.trim();
  const cps = input.companionStructured;
  if (cps?.species?.trim()) {
    return `COMPANION LOCK: ${input.companionName ?? 'companion'} — ${cps.species}, ${cps.size}. ${cps.coloring}. ${cps.feature}. Same design every page.`;
  }
  if (input.companionVisualDescription?.trim()) {
    return `COMPANION LOCK: ${input.companionName ?? 'companion'} — ${input.companionVisualDescription.trim()}. Same design every page.`;
  }
  return '';
}

export function buildStyle01RecurringObjectLocks(
  objectKeys: string[],
  lockMap: Record<string, string> = DRAGON_DINI_RECURRING_OBJECT_LOCKS
): string {
  return objectKeys
    .map((key) => lockMap[key])
    .filter(Boolean)
    .join('\n\n');
}

export function buildStyle01RecurringEntityLocks(
  entityKeys: string[],
  lockMap: Record<string, string> = DRAGON_DINI_RECURRING_ENTITY_LOCKS
): string {
  return entityKeys
    .map((key) => lockMap[key])
    .filter(Boolean)
    .join('\n\n');
}

export function buildStyle01CompositionBlock(input: {
  pageNumber: number;
  imageDirection?: string | null;
  compositionOverride?: Style01CompositionSpec;
  compositionByPage?: Record<number, Style01CompositionSpec>;
}): string {
  const spec =
    input.compositionOverride ??
    input.compositionByPage?.[input.pageNumber] ??
    DRAGON_DINI_COMPOSITION_BY_PAGE[input.pageNumber] ??
    inferCompositionFromImageDirection(input.imageDirection);

  const scale = spec.subjectScale ?? 'medium';
  const heightRange = subjectScaleHeightRange(scale);

  return [
    'COMPOSITION:',
    `shotType: ${spec.shotType}`,
    `camera: ${spec.camera}`,
    `subjectDominance: ${spec.subjectDominance}`,
    `staging: ${spec.staging}`,
    `pagePurpose: ${spec.pagePurpose}`,
    `SUBJECT SCALE: ${scale}. Character occupies approx ${heightRange}% of frame height. Environment fills the rest.`,
  ].join('\n');
}

function inferCompositionFromImageDirection(imageDirection?: string | null): Style01CompositionSpec {
  const hay = (imageDirection ?? '').toLowerCase();
  if (/\bwide\b|establishing|above the clouds|mountain cave/.test(hay)) {
    return {
      shotType: 'wide establishing',
      subjectScale: 'small',
      camera: 'wide angle environmental shot',
      subjectDominance: 'environment-led; character embedded in scene',
      staging: 'Show full setting with breathing room',
      pagePurpose: 'Establish place and mood',
    };
  }
  if (/\bclose\b|intimate|curled|snugly/.test(hay)) {
    return {
      shotType: 'intimate airy',
      subjectScale: 'medium',
      camera: 'medium-wide on emotional focus — surroundings still visible',
      subjectDominance: 'Primary subject clear but environment shares frame',
      staging: 'Cozy moment with ceiling, walls, or depth visible — not portrait crop',
      pagePurpose: 'Emotional beat',
    };
  }
  if (/\bdiscovery\b|entrance|hovers|cautious|looking in/.test(hay)) {
    return {
      shotType: 'discovery wide',
      subjectScale: 'small',
      camera: 'threshold or entrance backlit view with depth',
      subjectDominance: 'New object draws the eye; character in mid-distance',
      staging: 'Character reacts at boundary of space; environment dominates',
      pagePurpose: 'Discovery / surprise',
    };
  }
  return {
    shotType: 'medium story beat',
    subjectScale: 'medium',
    camera: 'medium shot, eye-level or gentle angle',
    subjectDominance: 'Balanced character and environment',
    staging: 'Action embedded in setting',
    pagePurpose: 'Advance story moment',
  };
}

export function buildStyle01EntityPresenceBlock(input: {
  childPresence: string;
  companionPresence: string;
  forbiddenEntities: string[];
}): string {
  const lines = [
    'ENTITY PRESENCE CONTRACT:',
    `childPresence: ${input.childPresence}`,
    `companionPresence: ${input.companionPresence}`,
  ];
  if (input.childPresence === 'absent') {
    lines.push(
      'CRITICAL: NO human child in this illustration. Do NOT depict any boy, girl, kid, or human protagonist.',
      'Do NOT use child reference photos for this page.'
    );
  } else if (input.childPresence === 'background') {
    lines.push('Child may appear small in background only — not the focal subject.');
  } else if (input.childPresence === 'partial') {
    lines.push('Child partial visibility only (hand, silhouette, edge) — not full portrait.');
  } else {
    lines.push('Child MUST appear clearly and match CHILD VISUAL LOCK.');
  }
  if (input.companionPresence === 'present') {
    lines.push('Companion MUST appear and match COMPANION LOCK.');
  } else {
    lines.push('NO companion creature in this scene.');
  }
  if (input.forbiddenEntities.length > 0) {
    lines.push(`FORBIDDEN: ${input.forbiddenEntities.join(', ')}.`);
  }
  return lines.join('\n');
}

export function buildStyle01BookPagePrompt(input: {
  sceneDescription: string;
  childVisualLock?: string;
  wardrobeLock?: string;
  childAnatomicalLock?: string;
  companionTextLock?: string;
  recurringObjectLocks?: string;
  recurringEntityLocks?: string;
  environmentLock?: string;
  compositionBlock?: string;
  entityPresenceBlock?: string;
}): string {
  return [
    input.sceneDescription.trim(),
    input.entityPresenceBlock ?? '',
    input.compositionBlock ?? '',
    input.environmentLock ?? '',
    STYLE_01_FRAMING_RULE,
    STYLE_01_SHARED,
    STYLE_01_RENDERING_CORRECTION,
    input.recurringObjectLocks ?? '',
    input.recurringEntityLocks ?? '',
    input.companionTextLock ?? '',
    input.childVisualLock ?? '',
    input.wardrobeLock ?? '',
    input.childAnatomicalLock ?? '',
    STYLE_01_CHILD_PHOTO_IDENTITY_RULE,
    STYLE_01_REFERENCE_INSTRUCTION,
    STYLE_01_NO_TEXT,
    STYLE_01_ANTI_STYLE02,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function assembleStyle01BookReferences(input: {
  styleRefPaths: string[];
  childPhotoPath?: string;
  /** @deprecated use companionRefPaths */
  companionRefPath?: string;
  companionRefPaths?: string[];
  config: Style02RefBudgetConfig;
  includeChildPhoto: boolean;
  useMultiCompanionSheets?: boolean;
}): { paths: string[]; breakdown: Record<string, string[]> } {
  const styleAll = input.styleRefPaths;
  const breakdown: Record<string, string[]> = { style: [], child: [], companion: [] };
  const companionPaths =
    input.companionRefPaths ??
    (input.companionRefPath ? [input.companionRefPath] : []);
  const multiSheets = input.useMultiCompanionSheets && companionPaths.length >= 3;

  switch (input.config) {
    case 'A': {
      if (multiSheets) {
        breakdown.style = styleAll.slice(0, 1);
        breakdown.companion = companionPaths.slice(0, input.includeChildPhoto && input.childPhotoPath ? 2 : 3);
        if (input.includeChildPhoto && input.childPhotoPath) {
          breakdown.child = [input.childPhotoPath];
        }
      } else {
        breakdown.style = styleAll.slice(0, 2);
        if (input.includeChildPhoto && input.childPhotoPath) {
          breakdown.child = [input.childPhotoPath];
        }
        if (companionPaths[0]) breakdown.companion = [companionPaths[0]];
      }
      break;
    }
    case 'B': {
      breakdown.style = styleAll.slice(0, multiSheets ? 1 : 3);
      if (input.includeChildPhoto && input.childPhotoPath) {
        breakdown.child = [input.childPhotoPath];
      }
      if (multiSheets) {
        breakdown.companion = companionPaths.slice(0, 3);
      }
      break;
    }
    case 'C': {
      breakdown.style = styleAll.slice(0, multiSheets ? 1 : 3);
      if (multiSheets) {
        breakdown.companion = companionPaths.slice(0, 3);
      } else if (companionPaths[0]) {
        breakdown.companion = [companionPaths[0]];
      }
      break;
    }
  }

  const paths = [...breakdown.style, ...breakdown.child, ...breakdown.companion];
  return { paths, breakdown };
}

export const STYLE_01_AVOIDANCE_NEGATIVE =
  'No readable text. No photoreal child portrait. No green dragon (Dini is copper-orange). No green/teal baby dragon hatchling. No outdoor forest on Dini cave pages. No tight portrait crop or character filling frame. No Style 02 cinematic rendering. No duplicate human children.';
