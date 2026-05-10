/**
 * Illustration style system for image prompts + order persistence.
 * DB enum values remain legacy snake_case for compatibility.
 */
/**
 * STYLES STATE NOTE (Phase 1 cleanup, 2026-04-27):
 * Three active styles for new books: SOFT_HAND_DRAWN_STORYBOOK, EXPRESSIVE_PAINTERLY_STORYBOOK,
 * DETAILED_WHIMSICAL_WORLD. The DB enum (IllustrationStyle) also includes legacy rows;
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
  loraModel: string | null;
  /** Trigger word to prepend to prompts when using LoRA model. */
  loraTriggerWord: string | null;
  /** Style reinforcement text appended after trigger word for LoRA prompts. */
  loraStylePrefix: string | null;
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
    userLabel: 'מאוייר חם ועדין',
    wizardBlurb: 'דמויות עגולות וחמודות בסגנון ספר ילדים מצויר — צבעי מים רכים, רקע קרם חם, הרגשה של חיבוק.',
    renderingDescription:
      "Cinematic painterly realistic portrait — characters look like real children rendered as fine-art oil paintings with warm watercolor background dissolution. Rich warm lighting, visible brushstrokes, natural skin texture. Background dissolves into soft warm watercolor washes. NOT a cartoon, NOT Pixar, NOT flat illustration.",
    pipeline: {
      colorPalette: 'rich warm cinematic palette with deep ambers, warm golds, and natural skin tones',
      lightingStyle: 'cinematic golden-hour lighting with rich depth of field and soft bokeh',
      textureStyle: 'painterly brushstrokes, oil-painting texture, soft realistic skin',
      renderingBehavior: 'realistic artistic portrait rendering with watercolor warmth',
      styleToken: 'soft_hand_drawn_storybook',
      loraModel: process.env.LORA_MODEL_STYLE_01 || null,
      loraTriggerWord: 'REALISTART01',
      loraStylePrefix: 'realistic artistic portrait, warm watercolor background dissolution, characters in sharp detail with surroundings fading to warm washes, cinematic lighting,',
    },
    imageNudge: {
      title: 'REALISTIC_ARTISTIC_PORTRAIT_NUDGE',
      lines: [
        'Realistic artistic portrait: characters look like REAL children painted as fine-art oil portraits with warm watercolor background dissolution. Painterly brushstrokes, natural skin texture, cinematic warm lighting. Background dissolves into soft warm washes. Top 20-30% open warm space for text. NOT a cartoon, NOT Pixar, NOT flat illustration. No hard edges or picture frame borders.',
      ],
    },
    lineRules: ['No visible outlines or linework — painterly realism only', 'Soft edges from brushwork, not drawn lines', 'Natural form definition through light and shadow'],
    colorRules: ['Rich warm palette — deep ambers, warm golds, natural skin tones', 'High warmth with medium-to-high saturation', 'No flat or desaturated colors'],
    shadingRules: ['Cinematic light-to-shadow transitions', 'Rich volumetric shading on faces and skin', 'Soft realistic shadows with warm bounce light'],
    lightingRules: ['Cinematic golden-hour or warm interior lighting', 'Rich depth of field with soft bokeh background', 'Dramatic but warm — not cold or flat'],
    backgroundRules: ['Background dissolves into soft warm watercolor washes — NOT a fully detailed scene', 'Only show partial environmental hints near the subject; edges and top fade to abstract warm tones', 'No hard edges or rectangular framing — organic painterly dissolution'],
    compositionRules: ['Characters rendered in sharp realistic detail, background dissolves around them', 'Top 20-30% must be open warm space (faded watercolor wash) for text overlay', 'Medium-close portrait framing — character fills 60-70% of the image, NOT a wide shot', 'Do NOT show the full room or full landscape — only immediately relevant scene details', 'Think: warm portrait with story context, not a landscape with a small person in it'],
    negativeConstraints: [
      'No 3D render',
      'No CGI',
      'No Pixar/Disney-like rendering',
      'No anime or manga style',
      'No flat cartoon illustration',
      'No plastic skin',
      'No smooth airbrush gradients',
      'No vector art',
      'No stock illustration look',
      'No pencil sketch or line drawing',
      'No neon glow or artificial bloom',
      'No extra random characters',
      'No empty white background with floating characters',
      'No desaturated or cold color palette',
      'No hard rectangular picture frame borders',
      'No fully detailed edge-to-edge backgrounds — background must dissolve',
    ],
    optionBlock: `STYLE OPTION 1:
internal_id: soft_hand_drawn_storybook
USER_LABEL_HE: פורטרט אמנותי
STYLE LOCK — REALISTIC ARTISTIC PORTRAIT:
A cinematic, painterly realistic portrait — characters look like real children rendered as fine-art oil paintings or high-end editorial portraits with warm watercolor treatment.

The illustration must feel like a real photograph transformed into a painting, NOT a cartoon or sketch.

RENDERING:
Painterly realism — like a fine art oil painting or editorial photograph.
Real human proportions, realistic facial features, natural skin texture.
Visible artistic brushstrokes but realistic form.
Characters are rendered in sharp detail — the rest of the scene dissolves.

BACKGROUND DISSOLUTION:
The background is NOT a fully detailed scene. Only partial environmental elements are visible near the subject.
Edges and surroundings dissolve into soft warm watercolor washes — abstract warm amber and cream tones.
Think: realistic characters emerging from a warm watercolor fog. Like the subject was painted in detail and the background was left as loose washes.
The top 20-30% of the image should be mostly warm empty space (faded watercolor) for text placement.
No hard rectangular edges. No picture frame borders. Organic painterly dissolution.

LIGHTING:
Cinematic golden-hour or warm interior lighting on the characters.
Rich warm shadows with amber bounce light.
Dramatic but never cold — always warm and inviting.

COLOR:
Rich warm palette — deep ambers, warm golds, natural skin tones.
Medium-to-high saturation on the characters, fading to softer washes in the background.
Colors should feel like oil paint, not digital fills.

TEXTURE FEEL:
Painterly oil-painting texture with visible brushwork.
Soft realistic skin with natural warmth.
No pencil lines, no sketch texture.

PROPORTIONS AND ANATOMY:
Realistic child proportions — not stylized, not chibi, not cartoon.
Natural anatomically correct features. Arms, hands, sleeves must be clearly distinct — no merging of clothing with skin.
Each character is a separate entity with correct anatomy.

EMOTIONAL CONNECTION:
Characters must interact with each other — eye contact, gestures, emotional expressions.
If a scene has two characters, they should be looking at each other or reacting to each other.

IMPORTANT:
The illustration should feel cinematic, warm, and emotionally rich.
Characters are the focus — the background serves them, not the other way around.

STRICT RULE:
If the image looks like a cartoon, sketch, flat illustration, or anime — it is a failed style result.
If the background is fully detailed edge-to-edge with no dissolution — it is a failed composition.

STRICT STYLE EXCLUSIONS:
No text, letters, numbers, symbols, captions, speech bubbles. No 3D render. No CGI. No Pixar-style rendering. No anime or manga style. No flat cartoon illustration. No pencil sketch or line drawing. No vector art. No stock illustration look. No extra random characters. No hard rectangular picture frame borders.

PAGE INTEGRATION RULE:
Characters are painted in realistic detail, surrounded by dissolving warm watercolor washes. Top area is open warm space for text. No hard edges, no picture frames. The image feels like a fine-art painting that breathes on the page.`,
  },
  [STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK]: {
    id: STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK,
    userLabel: 'אקוורל ריאליסטי',
    wizardBlurb: 'הילד נראה כמו ילד אמיתי בציור אקוורל עדין — לא קריקטורה, אלא פורטרט רך וחם עם נגיעות צבעי מים.',
    renderingDescription:
      "Warm realistic watercolor painting of a real child — NOT a cartoon, NOT dark or moody. Render as a light, airy watercolor with real human proportions, real skin, natural colors. Soft warm cream and peach background that gently fades and dissolves at the edges. Bright and pleasant — this is a children's book, it must feel safe, warm, and inviting. The child looks REAL but the mood is gentle and light. Think: beautiful realistic watercolor portrait, warm sunlight, cream paper showing through.",
    pipeline: {
      colorPalette: 'light warm watercolor palette — soft cream, warm peach, gentle greens, natural skin tones, airy and bright',
      lightingStyle: 'bright warm natural light — soft and pleasant, NOT dark or dramatic',
      textureStyle: 'watercolor on cream paper — visible paper grain, soft wet-on-wet edges, gentle color bleeds',
      renderingBehavior: 'realistic watercolor with real human proportions — light, airy, pleasant',
      styleToken: 'realistic_artistic_storybook',
      loraModel: process.env.LORA_MODEL_STYLE_02 || null,
      loraTriggerWord: 'REALISTART02',
      loraStylePrefix: 'realistic watercolor painting, real child proportions, warm bright light, cream paper background, airy and pleasant, NOT cartoon, NOT dark,',
    },
    imageNudge: {
      title: 'REALISTIC_WATERCOLOR_NUDGE',
      lines: [
        'This MUST look like a warm realistic watercolor — NOT a cartoon, NOT dark oil painting. Real child proportions but LIGHT and AIRY mood. Soft cream/peach background dissolving at edges. Bright pleasant children\'s book feeling. Watercolor paper texture visible. Top 20-30% should fade to soft warm cream for text.',
      ],
    },
    lineRules: ['No outlines — form defined by watercolor edges and soft color transitions', 'No cartoon linework, no ink lines', 'Edges are soft watercolor bleeds — wet-on-wet technique'],
    colorRules: ['Light warm palette — soft cream, warm peach, gentle natural greens and blues', 'Natural realistic skin tones — warm and healthy looking', 'Watercolor transparency — light passes through the pigment, cream paper shows through', 'BRIGHT and pleasant — NOT dark, NOT heavy, NOT golden-antique'],
    shadingRules: ['Gentle realistic shadows — soft and warm, never harsh or dark', 'Watercolor layering for depth — multiple transparent washes', 'Light and airy overall — shadows are warm, not black or muddy'],
    lightingRules: ['Bright warm natural light — like a sunny day or soft indoor light', 'Light and pleasant — the image should feel WARM not HOT, BRIGHT not DARK', 'Natural light that makes the child look healthy and happy'],
    backgroundRules: ['Background dissolves into soft warm cream/peach watercolor washes', 'Cream paper visible at edges — backgrounds fade gently, not sharp cutoff', 'Environment rendered with less detail further from subject — watercolor dissolution', 'NEVER a fully dark or heavily detailed background — keep it light and airy'],
    compositionRules: ['Child is the focal point — rendered in realistic detail, fills 60-70% of frame', 'Medium-close portrait framing — NOT a wide establishing shot', 'Background dissolves outward from subject into warm cream tones — only essential scene details visible', 'Top 20-30% fades to soft cream for text overlay', 'Think: warm portrait with story context, character IS the page'],
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
    ],
    optionBlock: `STYLE OPTION 2:
internal_id: realistic_artistic_storybook
USER_LABEL_HE: ריאליסטי אמנותי
STYLE LOCK — REALISTIC WARM WATERCOLOR:
A light, warm, realistic watercolor. This is NOT a cartoon. NOT dark or moody. NOT an old oil painting.
The child must look like a REAL child painted in beautiful warm watercolor.

CRITICAL DISTINCTION FROM STYLE 01:
Style 01 is a cinematic painterly portrait with rich warm tones and oil-painting brushwork — dramatic and golden.
THIS style (Style 02) is LIGHTER and AIRIER — a delicate watercolor, not heavy oil paint.
Both styles show REAL children (not cartoon), but Style 02 is brighter, softer, more watercolor-transparent.
If it looks dark, antique, or museum-like — it is WRONG.
If it looks like a cartoon — it is also WRONG.

CHARACTER RENDERING:
REAL child proportions — normal-sized eyes, natural face shape, real body.
NOT cute/chibi/cartoon proportions. NOT big anime eyes.
Natural skin with warm healthy tones — the child looks like a real kid.
Real hair texture — individual strands visible, natural movement.
The child should look like a real child in a beautiful watercolor portrait.

PAINTING MEDIUM:
Warm watercolor on cream paper — soft wet-on-wet edges, visible paper grain.
Transparent watercolor washes — light passes through, cream paper shows through.
Background dissolves into soft warm cream and peach tones at the edges.
Think: beautiful realistic watercolor portrait, NOT heavy oil painting.

COLOR AND TONE:
LIGHT and WARM — soft cream, peach, gentle greens and blues.
Natural skin tones — warm, healthy, pleasant.
Watercolor transparency — the palette is airy, not heavy.
NEVER dark golden/amber like an old museum painting.
The overall feeling must be: warm, safe, bright, inviting.

LIGHTING:
Bright natural light — soft and warm, like a pleasant sunny day.
NOT dramatic chiaroscuro. NOT dark golden-hour heaviness.
Light that makes the child look healthy and the scene feel comfortable.

BACKGROUND:
Dissolves into soft cream/peach watercolor washes.
Cream paper texture visible at edges.
Less detail further from the child — watercolor dissolution effect.
NEVER a fully dark or heavy background.

ANIMALS AND COMPANIONS:
Animals look realistic but pleasant — real proportions, warm coloring.
Painted in same warm watercolor style as the child.
A fox looks like a real fox — but friendly and warm, not scary.

STRICT RULE:
If the child has big cartoon eyes — FAILED.
If the image looks dark, antique, or museum-like — FAILED.
If the image looks like a cartoon or cute illustration — FAILED.
The result must be: a light, warm, realistic watercolor — pleasant and inviting.

STRICT STYLE EXCLUSIONS:
No text, letters, numbers, symbols. No cartoon rendering. No Pixar/Disney. No anime. No dark moody tones. No heavy oil painting look. No antique golden cast. No scary atmosphere. No 3D render.

PAGE INTEGRATION RULE:
Top 20-30% fades to soft warm cream tones for text placement. The painting is warm, light, and emotionally inviting — like a beautiful watercolor portrait in a children's book.`,
  },
  [STYLE_IDS.DETAILED_WHIMSICAL_WORLD]: {
    id: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
    userLabel: 'עולם קסום מפורט',
    wizardBlurb:
      'עולם שלם של פרטים קטנים — כל דף הוא הרפתקה ויזואלית עם מאות פרטים חבויים, כמו ספר איור אירופי קלאסי.',
    renderingDescription:
      "Highly detailed whimsical storybook illustration in a rich 'Where\\'s Waldo meets modern animated indie comic' style. Hand-drawn ink outlines with slightly imperfect sketchy lines, expressive characters, warm cinematic lighting, and dense environmental storytelling. Every part of the image filled with charming tiny details, layered objects, toys, decorations, textures, books, stickers, plants, lights, and hidden visual moments. Style balance: halfway between realistic and cartoon — believable proportions but stylized faces and environments. Soft painterly watercolor/gouache shading combined with crisp line-art detail. Cozy, emotional, nostalgic atmosphere. Rich color harmony with warm amber lights and cool blue shadows. Slightly exaggerated perspective for charm. The scene should feel alive and deeply immersive, like a premium illustrated children's book spread. Tons of micro-details visible on second glance. Composition readable from far away but rewarding when zooming in. Rendering references: detailed European children's books, cozy animated indie comics, gentle Studio Ghibli warmth, hand-painted watercolor textures. Important: organic imperfect lines, textured brushwork, layered depth, cozy clutter, expressive lighting, emotionally warm mood, cinematic framing, highly detailed background storytelling. NOT AI-glossy plastic, NOT hyperrealism, NOT flat cartoon, NOT clean vector, NOT flat modern minimalism.",
    pipeline: {
      colorPalette:
        'rich warm ambers and golds with cool blue-violet shadows — high color harmony, slightly muted vintage palette',
      lightingStyle:
        'warm cinematic indoor/golden-hour lighting with cool shadow contrast — cozy and atmospheric',
      textureStyle:
        'hand-drawn ink outlines with watercolor/gouache fill — visible brushwork, paper texture, organic imperfect lines',
      renderingBehavior:
        'dense illustrated storybook with environmental storytelling — every corner filled with narrative detail',
      styleToken: 'detailed_whimsical_world',
      loraModel: process.env.LORA_MODEL_STYLE_03 || null,
      loraTriggerWord: null,
      loraStylePrefix: null,
    },
    imageNudge: {
      title: 'DETAILED_WHIMSICAL_WORLD_NUDGE',
      lines: [
        'Dense whimsical storybook illustration: hand-drawn ink outlines with slightly imperfect sketchy lines, soft painterly watercolor/gouache shading with crisp line-art detail. Warm cinematic lighting with amber lights and cool blue shadows. Fill every part with charming micro-details — toys, books, stickers, plants, lights, hidden creatures, textures, cozy clutter. Organic imperfect lines, textured brushwork, layered depth, expressive lighting. Scene feels alive and immersive like a premium European children\'s book spread. Top 20-30% gradually fades to softer detail for text overlay. NOT AI-glossy, NOT hyperreal, NOT flat vector, NOT clean minimalism.',
      ],
    },
    lineRules: [
      'Visible hand-drawn ink outlines — slightly imperfect, organic, sketchy quality',
      'Crisp linework defining forms and details — NOT clean vector lines',
      'Varied line weight: thicker for main characters, thinner for environmental details',
    ],
    colorRules: [
      'Rich warm palette — deep ambers, warm golds, earthy tones with cool blue-violet shadows',
      'Slightly muted vintage quality — NOT oversaturated or neon',
      'High color harmony with intentional warm/cool contrast',
      'Watercolor/gouache color application — visible brushwork and color layering',
    ],
    shadingRules: [
      'Soft painterly watercolor/gouache shading combined with crisp linework',
      'Warm ambient occlusion in cozy spaces',
      'Cool blue-purple shadows contrasting warm amber lights',
      'Layered depth through atmospheric color temperature shifts',
    ],
    lightingRules: [
      'Warm cinematic interior/golden-hour lighting as primary',
      'Cool blue fill light in shadows for mood contrast',
      'Practical light sources in scene (lamps, lanterns, fairy lights, candles, moonlight)',
      'Expressive lighting that serves the emotional narrative',
    ],
    backgroundRules: [
      'FULLY DETAILED edge-to-edge environmental storytelling — NOT dissolving backgrounds',
      'Dense with narrative micro-details: toys, books, stickers, plants, creature hideouts, decorative objects',
      'Layered depth with foreground clutter, midground action, background context',
      'TOP 20-30% should gradually become SIMPLER and LIGHTER — fewer details, softer colors, fading toward warm cream/amber so text can be overlaid',
      `Think "Where's Waldo" density in the lower 70% but gentler fade at top`,
    ],
    compositionRules: [
      'Character is part of a rich environment — NOT an isolated portrait',
      'Wide or medium framing showing the full scene — character occupies 30-50% of image',
      'Environmental storytelling: the room/world tells a story through its objects and details',
      'Readable from far away (clear character silhouette) but rewarding when zooming in (hidden details)',
      'Slightly exaggerated perspective for charm — cozy fish-eye or gentle wide-angle feel',
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
    optionBlock: `STYLE OPTION 3:
internal_id: detailed_whimsical_world
USER_LABEL_HE: עולם קסום מפורט
STYLE LOCK — DETAILED WHIMSICAL STORYBOOK ILLUSTRATION:
A richly detailed, hand-drawn storybook illustration filled with hundreds of charming micro-details.
Think: premium European illustrated children's book meets "Where's Waldo" environmental density.

CRITICAL DISTINCTION FROM STYLES 01 AND 02:
Styles 01 and 02 are PORTRAIT styles — the character fills 60-70% of the image and the background dissolves.
THIS style (Style 03) is a WORLD style — the character is PART OF a dense, fully-detailed environment.
The entire image is filled edge-to-edge with narrative details, objects, textures, and hidden moments.
If the background is dissolving or empty — it is WRONG for this style.

CHARACTER RENDERING:
Characters are stylized but proportional — halfway between realistic and cartoon.
Expressive faces with personality but NOT huge anime eyes or chibi proportions.
Characters are clearly visible and recognizable but integrated INTO the environment.
The child is 30-50% of the image, not 60-70% like in portrait styles.

ILLUSTRATION MEDIUM:
Hand-drawn ink outlines — slightly imperfect, organic, sketchy quality.
Watercolor and gouache fills between the lines — layered, slightly imperfect brushwork with visible paper texture.
NOT flat digital fills. NOT clean vector.

COLOR AND LIGHT:
Rich warm ambers and golds in light; cool blue-violet in shadow — vintage picture-book harmony.
Practical lights (lamps, candles, fairy lights) may motivate warm pools; shadows stay cool and readable.

ENVIRONMENT DENSITY:
Foreground, midground, and background all carry story props, textures, and micro-gags.
The lower ~70% can be busiest; the top 20-30% must simplify and lighten for Hebrew text safety.

STRICT RULE:
If the scene feels like a soft portrait with a dissolving background — FAILED for this style.
If the image is sparse, minimal, or mostly empty — FAILED.

STRICT STYLE EXCLUSIONS:
No text, letters, numbers, symbols, captions. No photographic hyperrealism. No glossy AI plastic skin. No flat vector. No Pixar/Disney 3D. No anime/manga.

PAGE INTEGRATION RULE:
Top 20-30% gradually fades to softer color and simpler detail toward warm cream/amber so overlay text stays readable.`,
  },
};

const WIZARD_STYLE_ORDER: readonly StyleId[] = [
  STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK,
  STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
];

const LEGACY_STYLE_INPUT_MAP: Record<string, StyleId> = {
  // Canonical active IDs
  [STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK]: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  [STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK]: STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK,
  [STYLE_IDS.DETAILED_WHIMSICAL_WORLD]: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,

  // Existing DB enum values
  pencil_watercolor: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  whimsical_comic_fantasy: STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK,
  detailed_whimsical_world: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  // Legacy compatibility only — not offered for new books.
  realistic_illustrated: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,

  // Legacy product IDs / aliases
  SIMPLE_CALM: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  FUN_COLORFUL: STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK,
  // Legacy compatibility only — not offered for new books.
  EMOTIONAL_ARTISTIC: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,

  PENCIL_WATERCOLOR: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  WHIMSICAL_COMIC_FANTASY: STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK,
  DETAILED_WHIMSICAL_WORLD: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  // Legacy compatibility only — not offered for new books.
  REALISTIC_ILLUSTRATED: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,

  CLASSIC_CARTOON: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  illustrative_classic: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  classic: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  SIMPLE_CARTOON: STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK,
  clean_cartoon_2d: STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK,
  soft_3d_animation: STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK,
  cartoon_simple: STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK,
  simple: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  watercolor: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  comic: STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK,
  emotional: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  realistic_cartoon: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  detailed: STYLE_IDS.DETAILED_WHIMSICAL_WORLD,
  realistic: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  cartoon: STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK,
};

const STYLE_TO_DB_MAP: Record<StyleId, DatabaseIllustrationStyle> = {
  [STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK]: 'pencil_watercolor',
  [STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK]: 'whimsical_comic_fantasy',
  [STYLE_IDS.DETAILED_WHIMSICAL_WORLD]: 'detailed_whimsical_world',
};

const DB_TO_STYLE: Record<DatabaseIllustrationStyle, StyleId> = {
  pencil_watercolor: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  whimsical_comic_fantasy: STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK,
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
