/**
 * Illustration style system for image prompts + order persistence.
 * DB enum values remain legacy snake_case for compatibility.
 */
/**
 * STYLES STATE NOTE (Phase 1 cleanup, 2026-04-27):
 * Two active styles for new books: SOFT_HAND_DRAWN_STORYBOOK, DETAILED_WHIMSICAL_WORLD.
 * EXPRESSIVE_PAINTERLY_STORYBOOK / whimsical_comic_fantasy are legacy aliases → Style 02.
 * The DB enum (IllustrationStyle) also includes legacy rows;
 * `realistic_illustrated`, which is silently routed to SOFT_HAND_DRAWN_STORYBOOK.
 * LEGACY_STYLE_INPUT_MAP retains 30+ aliases for in-flight orders / safety;
 * a future phase will trim this once a one-time DB audit confirms which values
 * actually appear. Do not trim entries in this phase.
 */

export const STYLE_IDS = {
  SOFT_HAND_DRAWN_STORYBOOK: 'soft_hand_drawn_storybook',
  EXPRESSIVE_PAINTERLY_STORYBOOK: 'expressive_painterly_storybook',
  DETAILED_WHIMSICAL_WORLD: 'detailed_whimsical_world',
} as const;

export type StyleId = (typeof STYLE_IDS)[keyof typeof STYLE_IDS];

/** Stored in `Order.illustrationStyle` — unchanged for existing orders. */
export type DatabaseIllustrationStyle =
  | 'pencil_watercolor'
  | 'realistic_illustrated'
  | 'whimsical_comic_fantasy'
  | 'detailed_whimsical_world';

export interface StylePipelineProfile {
  colorPalette: string;
  lightingStyle: string;
  textureStyle: string;
  renderingBehavior: string;
  styleToken: string;
  /** Replicate model slug for LoRA-trained version. Null = use base model. */
  /** Trigger word to prepend to prompts when using LoRA model. */
  /** Style reinforcement text appended after trigger word for LoRA prompts. */
}

export interface StyleContract {
  id: StyleId;
  userLabel: string;
  wizardBlurb: string;
  renderingDescription: string;
  lineRules: string[];
  colorRules: string[];
  shadingRules: string[];
  lightingRules: string[];
  backgroundRules: string[];
  compositionRules: string[];
  negativeConstraints: string[];
  pipeline: StylePipelineProfile;
  imageNudge: { title: string; lines: string[] } | null;
  optionBlock: string;
}

const STYLE_SELECTION_SYSTEM = `STYLE_SELECTION_SYSTEM

Choose ONE illustration style from the list below and hold it for the whole book.
Each option is a full visual language; avoid mixing them.

Consistency:
Use the same selected style for every page, the cover, and direction art.
Use one coherent rendering language end-to-end.
Keep the child and cast recognizable within that look.`.trim();

const GLOBAL_BOOK_ILLUSTRATION_RULES = `Global storybook look (applies in every style):
- Return the child as a stable storybook character from page to page, without aiming for a literal portrait.
- Favor "based on the reference" and resemblance language over exact photographic matching.
- Stay in illustrated, print-friendly space: not photorealism, not 3D rendering, not glossy AI polish.
- Keep layouts clear and readable for a printed children's book page.`.trim();

const FINAL_STYLE_INSTRUCTION = `Closing note:

Stay with the selected style across cover, previews, and story pages.
Let emotional clarity read clearly in that style.`.trim();

export const STYLE_REGISTRY: Record<StyleId, StyleContract> = {
  [STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK]: {
    id: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    userLabel: 'רך וחמים',
    wizardBlurb:
      'איור רך וחם בצבעי מים — דמויות עגולות וחמודות, גוונים עדינים ואווירת חיבוק. סגנון ספר ילדים קלאסי, מנחם ועדין.',
    renderingDescription:
      "Premium children's book illustration — adorable round characters with large sparkling eyes, rosy cheeks, and button noses. Rich detailed watercolor on textured cream paper with warm soft tones. Lush illustrated backgrounds rendered with watercolor detail that matches the scene described on each page (forests with trees and undergrowth, undersea with coral and kelp, bedrooms with toys, mountains, gardens — whatever the page calls for). Every surface has texture and story. Like a bestselling picture book by a master illustrator. NOT photorealistic, NOT 3D, NOT flat or minimal.",
    pipeline: {
      colorPalette: 'warm storybook palette — soft cream, peach, golden undertones, earthy greens and blues, rich but gentle',
      lightingStyle: 'soft warm glow — gentle and inviting like a cozy storybook page, subtle warmth not harsh golden',
      textureStyle: 'rich watercolor on textured cream paper — visible brushwork, paper grain, layered pigment washes, fine detail',
      renderingBehavior: 'premium children\'s book illustration — adorable round characters, richly detailed backgrounds, master illustrator quality',
      styleToken: 'soft_hand_drawn_storybook',
    },
    imageNudge: {
      title: 'CUTE_STORYBOOK_ILLUSTRATION_NUDGE',
      lines: [
        'Premium children\'s book illustration: adorable round characters with large sparkling eyes, rosy cheeks, button noses. Rich detailed watercolor on cream paper with warm soft tones. Lush backgrounds rendered with detail that matches the page scene (forest, underwater, room, garden — whatever the page describes). Every surface textured and detailed. Like a bestselling picture book. NOT photorealistic, NOT 3D, NOT flat or minimal.',
      ],
    },
    lineRules: ['Soft hand-drawn edges with fine detail — organic, not sharp vector lines', 'Delicate linework visible under rich watercolor washes', 'Charming hand-made quality with fine illustrator detail'],
    colorRules: ['Rich warm storybook palette — cream, peach, soft golden undertones, earthy greens, dusty blues', 'Colors feel like layered watercolor pigment on cream paper — luminous and warm', 'Rich but not garish — warm and inviting tones, subtle golden warmth is good, but avoid monochrome amber flood'],
    shadingRules: ['Soft warm shadows with gentle depth', 'Rich watercolor layering — multiple pigment washes for texture', 'Pleasant overall — shadows add dimension without being dark or heavy'],
    lightingRules: ['Soft warm glow — gentle, inviting, cozy like a storybook page', 'Subtle warmth in the light is good — but not harsh golden-hour flood', 'Light enough to see all fine details clearly'],
    backgroundRules: ['Rich illustrated background — detail appropriate to the page scene (forest foliage, undersea coral, indoor furniture, sky, etc.), never a generic bedroom default', 'Edges and top dissolve into soft warm cream watercolor washes', 'Background has DETAIL and texture near character, dissolving outward — not empty or minimal'],
    compositionRules: ['Character is naturally embedded in the scene — fills 30-50% of the image, not a centered portrait', 'Show richly detailed environmental context around the character — the world matters as much as the face', 'Do NOT crop so tight that character fills 60%+ — leave room for environment, companion, action'],
    negativeConstraints: [
      'No 3D render or CGI',
      'No photorealistic rendering — this is an illustration, not a photo',
      'No AI-glossy or plastic skin look',
      'No anime or manga style',
      'No smooth airbrush gradients or vector art',
      'No stock illustration look',
      'No neon glow or artificial bloom',
      'No extra random characters',
      'No empty white background with floating characters',
      'No dark moody or desaturated palette',
      'No hard rectangular picture frame borders',
      'No fully detailed edge-to-edge backgrounds — background must dissolve',
    ],
    optionBlock: `MEDIUM LOCK — PREMIUM CHILDREN'S BOOK WATERCOLOR ILLUSTRATION:
Richly detailed, adorable children's book illustration by a master picture-book illustrator. Lush watercolor on textured cream paper. Every page feels like opening a beloved storybook.

RENDERING:
Premium illustrated children's book quality — NOT a sketch, NOT minimal, NOT flat.
Rich layered watercolor with fine detail on every surface.
Hand-painted warmth with visible brushwork, paper texture, pigment layering.
Like the work of a top children's book illustrator — charming, detailed, emotionally resonant.

CHARACTER STYLE:
Adorable round face — large sparkling eyes with light reflections, rosy cheeks, small button nose.
Slightly stylized proportions for maximum cuteness — head slightly large, features soft and round.
Sweet expressive features that convey emotion clearly — a face you want to hug.
NOT realistic proportions. NOT photographic. Storybook-cute.

DETAIL LEVEL:
HIGH detail throughout — this is a richly illustrated storybook, not a simple sketch.
Background near character filled with charming detail appropriate to the page scene — what those objects/textures are depends entirely on where the page takes place.
Every surface has texture and visual interest — wood grain, fabric patterns, paper textures.
Fine illustrator detail: tiny highlights in eyes, individual eyelashes, texture in hair curls, stitching on clothes.

COLOR:
Rich warm storybook palette — soft cream, warm peach, gentle golden undertones.
Earthy greens, dusty blues, warm ochres as accent colors.
Colors feel like premium watercolor pigment on cream paper — luminous, layered, warm.
Subtle golden warmth throughout is GOOD — it creates the storybook feeling.
Avoid monochrome amber FLOOD — keep variety in the palette, but warmth is welcome.

BACKGROUND:
Near character: RICHLY DETAILED with illustrated objects and textures.
Edges: gradually dissolve into soft warm cream watercolor washes.
The dissolve is gradual — not a hard cutoff. Rich detail fades organically into cream.

LIGHTING:
Soft warm glow — cozy, inviting, like lamplight in a child's room.
Subtle warmth in the light is part of the charm — NOT harsh, NOT dramatic.
Light enough to see all fine details clearly.

COMPOSITION:
Character occupies 30-50% of the image — naturally embedded in the scene, NOT a centered portrait.
Rich environmental detail visible around the character — the world is as important as the face.
Background dissolves outward from the detailed center area.

TEXTURE:
Textured cream paper visible throughout — paper grain, tooth.
Rich watercolor pigment layering — wet-on-wet edges, color bleeds, pigment granulation.
Visible brushwork — hand-painted quality throughout.
Fine detail in everything — hair curls, fabric folds, object textures.

STRICT EXCLUSIONS:
No text, letters, numbers, symbols. No 3D render. No CGI. No photorealism. No anime. No vector art. No AI-glossy look. No flat minimal style. No empty backgrounds.

ZERO text, letters, numbers, or symbols anywhere.`,
  },
  [STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK]: {
    id: STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK,
    userLabel: 'אקוורל ריאליסטי',
    wizardBlurb: 'הילד נראה כמו ילד אמיתי בתוך סצנת ספר ילדים — לא קריקטורה, אלא איור עדין וחם בצבעי מים שמספר סיפור.',
    renderingDescription:
      "Fine realistic watercolor children's storybook illustration on premium cream paper. Real human proportions, natural features, healthy luminous skin — but always inside a real SCENE: the child interacting with their companion, the environment, and the action of the page. Compositions vary per page (wide shots, medium shots, action shots) like a hand-painted picture book — never the same portrait pose twice. Accomplished watercolor technique with delicate brushwork, transparent pigment layering, luminous skin tones, and visible paper grain. NOT a cartoon, NOT a portrait, NOT dark — a real child painted into the scene that the story describes.",
    pipeline: {
      colorPalette: 'refined storybook watercolor palette — soft cream, warm peach, natural greens, scene-appropriate accents, luminous skin tones, bright with subtle warmth',
      lightingStyle: 'scene-appropriate natural light with subtle warmth — light source comes FROM the scene (sun, lantern, moon, water) not a studio flash; NOT harsh, NOT dramatic',
      textureStyle: 'fine watercolor on premium cream paper — refined brushwork, delicate wet-on-wet edges, luminous pigment layering',
      renderingBehavior: 'fine realistic watercolor storybook scene — real child proportions inside a real environment, varied compositions, accomplished technique, narrative-driven',
      styleToken: 'realistic_artistic_storybook',
    },
    imageNudge: {
      title: 'REALISTIC_WATERCOLOR_STORYBOOK_NUDGE',
      lines: [
        'Fine realistic watercolor childrens storybook ILLUSTRATION on premium cream paper — NOT a portrait. Show the child inside the SCENE the page describes: with the companion, in the location, doing the action. Real child proportions, accomplished technique. Compositions vary per page (wide, medium, action) — never the same standing-portrait pose twice. Soft warm scene-appropriate light dissolving at edges. Paper texture visible, fine pigment layering. NOT cartoon, NOT dark, NOT a posed portrait.',
      ],
    },
    lineRules: ['No outlines — form defined by refined watercolor edges and soft color transitions', 'No cartoon linework — edges are delicate watercolor bleeds', 'Fine detail in features — individual eyelashes, hair strands, freckles, skin texture'],
    colorRules: ['Refined warm palette — soft cream, warm peach, natural greens, luminous skin tones', 'Natural realistic skin — healthy, luminous, with subtle color variation (pink cheeks, warm nose)', 'Watercolor transparency — light passes through pigment, cream paper glows through', 'Bright and warm — subtle golden warmth is fine, but avoid monochrome amber flood', 'Scene colors come from the LOCATION (underwater blues, forest greens, sunset warm tones) — NOT a default neutral cream backdrop'],
    shadingRules: ['Delicate realistic shadows — soft, refined, never harsh', 'Fine watercolor layering for depth — multiple transparent washes building form', 'Light and airy overall — shadows add dimension with subtlety'],
    lightingRules: ['Light source matches the SCENE: lantern glow, underwater shimmer, forest dappled light, sunset warmth, moonlight — never a flat studio light', 'Light and pleasant — bright, refined, with gentle warm tones', 'Natural light that makes the child look healthy and radiant'],
    backgroundRules: ['Background SHOWS the scene location described in the page imageDirection — forest, underwater, bedroom, sky, etc. Never a generic neutral cream void.', 'Environmental detail rendered with refined watercolor — dissolves outward toward edges, not abruptly cropped', 'Cream paper visible at edges — backgrounds fade gently into the page tone', 'The location is recognizable in every page — the reader should know where the child is'],
    compositionRules: ['Show the child INSIDE the scene — with the companion, environment, action, props described in the imageDirection', 'Vary the composition per page — sometimes wide establishing shot, sometimes medium two-shot with companion, sometimes a closer moment of emotion or interaction. NEVER 15 identical centered standing portraits.', 'Child occupies 30-50% of frame — leave room for the companion, the environment, the action', 'Multi-character scenes are normal — the companion should appear when the imageDirection asks for it'],
    negativeConstraints: [
      'No cartoon or anime style — proportions must be REAL',
      'No Pixar, Disney, or animation studio style',
      'No big cartoon eyes or exaggerated cute features',
      'No dark, moody, or museum-painting look',
      'No heavy golden/amber antique tones — keep it LIGHT',
      'No dark backgrounds or heavy shadows',
      'No oil painting heaviness — this is watercolor, light and airy',
      'No flat digital colors',
      'No 3D render or CGI',
      'No hard outlines or linework',
      'No extra random characters',
      'No scary or dramatic atmosphere',
      'NEVER a centered standing-portrait composition repeated across pages — every page must show a different moment of the story',
      'NEVER a neutral cream void background — the scene location must be visible',
      'NEVER omit the companion when the page imageDirection asks for it',
    ],
    optionBlock: `MEDIUM LOCK — FINE REALISTIC WATERCOLOR CHILDREN'S STORYBOOK SCENE ON CREAM PAPER:
Fine watercolor STORYBOOK ILLUSTRATION (not a portrait) — show the child INSIDE the scene that the page imageDirection describes, with the companion, the environment, and the action. Accomplished watercolor on premium textured cream paper. Refined technique — delicate brushwork, luminous pigment layering, fine detail. Real child proportions, natural anatomy, healthy radiant skin. Like the work of a master picture-book watercolor illustrator.

RENDERING:
Real child proportions — natural features, real anatomy, healthy skin (not cartoon, not exaggerated cute).
Fine transparent watercolor technique — light passes through pigment, paper glows through.
Delicate wet-on-wet edges, refined color bleeds, visible paper texture.
HIGH detail level — individual eyelashes, hair strands, freckles, fabric texture, skin luminosity, AND scene props.
NOT a cartoon. NOT heavy oil painting. NOT dark or moody. NOT a portrait shot. NOT flat or simple.

COMPOSITION (CRITICAL — varies per page):
The child occupies 30-55% of frame — leave room for the companion, environment, action, and props.
Compose the frame around the SCENE described in the imageDirection: wide for establishing shots, medium for character interactions, closer for emotional moments. Never the same centered standing pose twice.
Show the COMPANION when the imageDirection asks for it — they share the scene with the child.
Show the LOCATION clearly — underwater, forest, bedroom, sky, wherever the story takes the child.
Show the ACTION — what is happening on this page, not just a posed character.

CHARACTER:
Real child proportions, natural anatomy, healthy luminous skin.
Fine detail in face: natural eyes with light reflections, real skin texture, subtle color variation.
Painted in transparent watercolor — skin has luminosity from cream paper underneath.

COLOR AND LIGHT:
Scene-driven palette — colors come from the location (water blues, forest greens, lantern warmth, sunset peach).
Light source comes from WITHIN the scene (lantern, sun, moon, water shimmer) — not a flat studio light.
Natural skin tones — healthy, luminous, with subtle pink in cheeks and warm nose.
Subtle golden warmth is fine — but avoid a monochrome amber flood that washes out the scene colors.
Colors are refined and elegant, not garish or harsh.

BACKGROUND (CRITICAL — show the scene):
The background MUST show the LOCATION described in the page imageDirection. If the page says 'underwater coral reef' — paint coral, water, kelp. If it says 'dark forest' — paint trees, shadows, light shafts.
Environmental detail fades organically outward toward the edges — refined watercolor dissolves, not hard cutoffs.
Cream paper texture visible at edges.
NEVER a neutral cream void background. NEVER a dark heavy background — keep it light, airy, elegant, AND clearly located.

TEXTURE:
Premium watercolor paper grain visible throughout.
Fine transparent pigment washes — multiple layers building luminous form.
Delicate brushwork — refined, accomplished, master-level technique.
No hard outlines — form defined by subtle color transitions and light.

DETAIL:
Fine detail everywhere — hair strands catching light, fabric weave visible, skin pores suggested, scene props rendered with care.
Refined pigment granulation in shadow areas.
Accomplished watercolor technique — not student work, not simple washes.

STRICT EXCLUSIONS:
No text, letters, numbers, symbols. No cartoon. No Pixar/Disney. No anime. No dark moody tones. No heavy oil painting. No 3D render. No flat or simple washes. NO CENTERED STANDING PORTRAIT. NO NEUTRAL VOID BACKGROUND. NO MISSING COMPANION.

ZERO text, letters, numbers, or symbols anywhere.`,
  },
  [STYLE_IDS.DETAILED_WHIMSICAL_WORLD]: {
    id: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
    userLabel: 'עולם קסום',
    wizardBlurb:
      'עולם פנטזיה עשיר וקולנועי — אור דרמטי, פרטים בכל פינה, קסם ועומק. סגנון פרימיום שמרגיש כמו ספר הרפתקאות יוקרתי.',
    renderingDescription:
      "Traditional ink-and-gouache mixed media on textured paper. Scratchy black/brown ink contour lines with visible nib strokes, crosshatching for shadow, layered opaque gouache pigment, translucent watercolor washes, dry brush texture, paper grain and tooth visible, pigment granulation and ink bleed where colors pool. Matte paint surface, uneven hand-painted edges, misregistered paint at line boundaries. Dense illustrated environment filled with narrative micro-details. Believable child proportions, stylized expressive face. Rough ink nib linework with opaque paint layering throughout.",
    pipeline: {
      colorPalette:
        'muted earthy ochres with cool indigo shadows — desaturated vintage palette, high color harmony',
      lightingStyle:
        'practical light sources in scene (lamps, candles, window light) with cool shadow contrast',
      textureStyle:
        'ink nib linework with opaque gouache and translucent watercolor — visible paper tooth, pigment granulation, dry brush marks',
      renderingBehavior:
        'dense illustrated narrative scene — every surface filled with story props and micro-details',
      styleToken: 'detailed_whimsical_world',
    },
    imageNudge: {
      title: 'DETAILED_WHIMSICAL_WORLD_NUDGE',
      lines: [
        'Ink-and-gouache mixed media: scratchy ink contour lines, crosshatching, opaque gouache pigment layering, matte watercolor washes, paper grain visible, pigment granulation, dry brush marks, ink bleed. Dense illustrated environment with narrative micro-details. Practical light sources with cool indigo shadows. Upper area lighter for text overlay. Rough handmade linework with opaque paint — not colored pencil, not crayon, not smooth digital.',
      ],
    },
    lineRules: [
      'Visible hand-drawn ink outlines — slightly imperfect, organic, sketchy quality',
      'Crisp linework defining forms and details — NOT clean vector lines',
      'Varied line weight: thicker for main characters, thinner for environmental details',
    ],
    colorRules: [
      'Muted earthy palette — desaturated ochres, olive greens, dusty blues, cool indigo shadows',
      'Slightly muted vintage quality with high color harmony',
      'Gouache opacity and watercolor transparency layered together — visible brushwork and pigment variation',
    ],
    shadingRules: [
      'Gouache/watercolor shading with crisp ink linework defining forms',
      'Cool indigo-purple shadows with earthy midtones',
      'Layered depth through atmospheric color temperature shifts — cooler in distance',
    ],
    lightingRules: [
      'Practical light sources in scene (lamps, lanterns, fairy lights, candles, window light)',
      'Cool blue fill in shadows for contrast against practical lights',
      'Lighting motivated by scene objects, not global golden-hour wash',
    ],
    backgroundRules: [
      'FULLY DETAILED edge-to-edge — every surface filled with narrative micro-details',
      'Dense with story props: toys, books, stickers, plants, creature hideouts, decorative objects',
      'Layered depth: foreground clutter, midground action, background context',
      'TOP 20-30% gradually simpler and lighter for text overlay — fewer details, softer tones',
    ],
    compositionRules: [
      'Environment-first composition — the world occupies most of the frame',
      'Character integrated into environment — occupies 30-50% of image',
      'Environmental storytelling: the room/world tells a story through objects and details',
      'Readable from far (clear character silhouette), rewarding when zoomed in (hidden details)',
    ],
    negativeConstraints: [
      'No hyperrealism or photographic rendering',
      'No flat vector or clean digital illustration',
      'No AI-glossy plastic look — must feel hand-made',
      'No sparse or minimal backgrounds — density is the point',
      'No Pixar/Disney 3D rendering style',
      'No anime or manga style',
      'No empty or white backgrounds',
      'No stock illustration look',
      'No text, letters, numbers, or symbols in the image',
    ],
    optionBlock: `MEDIUM LOCK — INK AND GOUACHE MIXED MEDIA:
Traditional mixed-media illustration created with black ink linework and opaque gouache paint on textured paper.

PHYSICAL MEDIA REQUIREMENTS:
Scratchy ink contour lines with visible nib strokes.
Crosshatching for shadow areas.
Opaque gouache pigment layering — matte, not glossy.
Translucent watercolor washes between ink lines.
Dry brush texture on edges and details.
Paper grain and tooth visible throughout.
Pigment granulation where colors pool.
Ink bleed at paint-line boundaries.
Uneven hand-painted edges — misregistered paint.
Rough handmade quality throughout — every mark looks drawn by hand.

ENVIRONMENT-FIRST COMPOSITION:
The world occupies most of the frame — edge-to-edge detail.
Character integrated into environment — 30-50% of image.
Dense with narrative micro-details: props, objects, hidden creatures, textures.
Foreground clutter, midground action, background context.
Top 20-30% gradually lighter and simpler for text overlay.

CHARACTER:
Stylized but proportional — believable child anatomy.
Expressive face with personality.
Clearly visible and recognizable within the dense environment.

COLOR AND LIGHT:
Muted earthy ochres, olive greens, dusty blues, cool indigo shadows.
Practical light sources (lamps, candles, window light) — not global golden wash.
Cool shadows contrast with pools of light from scene objects.

ZERO text, letters, numbers, or symbols anywhere.`,
  },
};

const WIZARD_STYLE_ORDER: readonly StyleId[] = [
  STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
];

/** Wizard-facing style list with id, label, blurb. Consumed by backend/config/wizard.ts. */
export const WIZARD_ILLUSTRATION_STYLES = WIZARD_STYLE_ORDER.map((id) => {
  const c = STYLE_REGISTRY[id];
  return { id: c.id, label: c.userLabel, blurb: c.wizardBlurb };
});

const LEGACY_STYLE_INPUT_MAP: Record<string, StyleId> = {
  // Canonical active IDs
  [STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK]: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  [STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK]: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  [STYLE_IDS.DETAILED_WHIMSICAL_WORLD]: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,

  // Existing DB enum values
  pencil_watercolor: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  whimsical_comic_fantasy: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  // Legacy compatibility only — not offered for new books.
  realistic_illustrated: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,

  // Legacy product IDs / aliases
  SIMPLE_CALM: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  FUN_COLORFUL: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  // Legacy compatibility only — not offered for new books.
  EMOTIONAL_ARTISTIC: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,

  PENCIL_WATERCOLOR: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  WHIMSICAL_COMIC_FANTASY: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  DETAILED_WHIMSICAL_WORLD: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  // Legacy compatibility only — not offered for new books.
  REALISTIC_ILLUSTRATED: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,

  CLASSIC_CARTOON: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  illustrative_classic: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  classic: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  SIMPLE_CARTOON: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  clean_cartoon_2d: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  soft_3d_animation: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  cartoon_simple: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  simple: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  watercolor: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  comic: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  emotional: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  realistic_cartoon: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  detailed: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  realistic: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  cartoon: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
};

const STYLE_TO_DB_MAP: Record<StyleId, DatabaseIllustrationStyle> = {
  [STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK]: 'pencil_watercolor',
  [STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK]: 'detailed_whimsical_world',
  [STYLE_IDS.DETAILED_WHIMSICAL_WORLD]: 'detailed_whimsical_world',
};

const DB_TO_STYLE: Record<DatabaseIllustrationStyle, StyleId> = {
  pencil_watercolor: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  whimsical_comic_fantasy: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  detailed_whimsical_world: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  // Legacy compatibility only — not offered for new books.
  realistic_illustrated: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
};

export function normalizeStyleId(input?: string | null): StyleId {
  if (!input) return STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK;
  const normalized = LEGACY_STYLE_INPUT_MAP[input];
  if (!normalized) {
    console.warn(
      `[StyleNormalize] Unknown illustration style "${input}" -> "${STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK}"`
    );
    return STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK;
  }
  if (input === 'realistic_illustrated' || input === 'REALISTIC_ILLUSTRATED' || input === 'EMOTIONAL_ARTISTIC') {
    console.warn(
      `[StyleNormalize] Deprecated style "${input}" -> "${STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK}"`
    );
  }
  return normalized;
}

export function getStyleContract(styleIdInput?: string | null): StyleContract {
  return STYLE_REGISTRY[normalizeStyleId(styleIdInput)];
}

export function mapStyleToDatabaseValue(styleIdInput?: string | null): DatabaseIllustrationStyle {
  return STYLE_TO_DB_MAP[normalizeStyleId(styleIdInput)];
}

export function normalizeIllustrationStyle(styleId: string): DatabaseIllustrationStyle {
  return mapStyleToDatabaseValue(styleId);
}

export function styleIdFromDatabaseValue(db: string | null | undefined): StyleId {
  if (!db) return STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK;
  return (
    LEGACY_STYLE_INPUT_MAP[db] ??
    DB_TO_STYLE[db as DatabaseIllustrationStyle] ??
    STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK
  );
}

export function getPositiveStylePromptBlock(styleIdInput?: string | null): string {
  const style = getStyleContract(styleIdInput);
  return [
    STYLE_SELECTION_SYSTEM,
    '',
    'SELECTED_STYLE (this book — apply only this one):',
    `internal_id: ${style.id}`,
    `USER_LABEL_HE: ${style.userLabel}`,
    '',
    style.optionBlock,
    '',
    GLOBAL_BOOK_ILLUSTRATION_RULES,
    '',
    'STRUCTURED_LOCK (summary):',
    `RENDERING: ${style.renderingDescription}`,
    `LINE_RULES: ${style.lineRules.join('; ')}`,
    `COLOR_RULES: ${style.colorRules.join('; ')}`,
    `SHADING_RULES: ${style.shadingRules.join('; ')}`,
    `LIGHTING_RULES: ${style.lightingRules.join('; ')}`,
    `BACKGROUND_RULES: ${style.backgroundRules.join('; ')}`,
    `COMPOSITION_RULES: ${style.compositionRules.join('; ')}`,
    '',
    FINAL_STYLE_INSTRUCTION,
  ].join('\n');
}

export function getNegativeStylePromptBlock(styleIdInput?: string | null): string {
  const style = getStyleContract(styleIdInput);
  return style.negativeConstraints.join('; ');
}

export interface StyleProfile {
  id: DatabaseIllustrationStyle;
  label: string;
  colorPalette: string;
  lightingStyle: string;
  textureStyle: string;
  renderingBehavior: string;
  styleToken: string;
}

export const STYLE_PROFILES: Record<DatabaseIllustrationStyle, StyleProfile> = {
  pencil_watercolor: {
    id: 'pencil_watercolor',
    label: 'רך וחמים',
    colorPalette: 'warm pastels with cream base',
    lightingStyle: 'soft diffused',
    textureStyle: 'hand-drawn ink outlines',
    renderingBehavior: 'cute illustrated characters',
    styleToken: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  },
  whimsical_comic_fantasy: {
    id: 'whimsical_comic_fantasy',
    label: 'עולם קסום (legacy)',
    colorPalette: 'rich saturated gouache',
    lightingStyle: 'dramatic warm',
    textureStyle: 'thick painterly strokes',
    renderingBehavior: 'expressive painterly storybook',
    styleToken: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  },
  detailed_whimsical_world: {
    id: 'detailed_whimsical_world',
    label: 'עולם קסום',
    colorPalette: 'warm amber with cool shadows',
    lightingStyle: 'ambient storybook',
    textureStyle: 'dense crosshatch ink',
    renderingBehavior: 'dense illustrated world',
    styleToken: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  },
  realistic_illustrated: {
    id: 'realistic_illustrated',
    label: 'Realistic Artistic',
    colorPalette: 'natural watercolor washes',
    lightingStyle: 'cinematic natural',
    textureStyle: 'fine watercolor on paper',
    renderingBehavior: 'realistic artistic portraits',
    styleToken: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  },
};
