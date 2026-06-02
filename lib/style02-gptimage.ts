/**
 * Style 02 (gpt-image-2) — locked config lifted from run-style-audition-style02-gptimage2.ts.
 * Phase 2 book pipeline + probes import from here; do not re-derive briefs/subsets.
 */
import { existsSync } from 'fs';
import path from 'path';
import { STYLE_IDS } from './styles';

export const STYLE_02_GPT_MODEL = 'gpt-image-2';

export const STYLE_02_REF_DIR = path.join(process.cwd(), 'style-references', '02');

export type Style02SceneSubsetKey =
  | 'bedroom-night'
  | 'classroom-day'
  | 'clinic-day'
  | 'forest-magical';

export type Style02SceneClass =
  | 'night-bedroom'
  | 'daytime-interior'
  | 'forest-outdoor-environment';

export type Style02RefBudgetConfig = 'A' | 'B' | 'C';

export const STYLE_02_SHARED =
  'Style 02: a richly rendered semi-realistic cinematic fantasy children\'s-book illustration. Highly detailed and immersive, with dimensional painted forms, refined linework, realistic materials, strong motivated lighting, layered foreground-midground-background depth, and dense environmental storytelling. The image should feel hand-crafted and magical, but not soft watercolor, not pale pencil, not flat cartoon, not generic nursery art. Strong cinematic light and shadow; warm local glow balanced by cool shadows; rich colors and visible texture. The child is illustrated and expressive, cute but believable, never CGI, never plastic, never Pixar, never doll-like.';

export const STYLE_02_RENDERING_CORRECTION =
  'RENDERING: dimensional painted rendering, material definition, visible volume, controlled detailed linework, strong light direction, crisp focal hierarchy, layered atmospheric depth, rich shadows, detailed props everywhere. NOT pale watercolor wash, NOT soft pencil haze, NOT muddy softness, NOT low-contrast pastel, NOT simplified nursery look, NOT weak flat lighting, NOT empty backgrounds. "Not photorealistic" does NOT mean soft watercolor — illustrated but deep, material-rich, cinematic.';

export const STYLE_02_REFERENCE_INSTRUCTION =
  'Use attached STYLE reference images for VISUAL STYLE ONLY: rendering quality, dimensionality, cinematic lighting, dense detail, atmospheric depth, material richness, linework language, magical fantasy mood. Do NOT copy exact scene, composition, creatures, text, signs, or labels. Create the new original scene below.';

export const STYLE_02_NO_TEXT =
  '[NO TEXT] No readable Hebrew, English, letters, numbers, signs, labels, book titles, or alphabet charts. Pictorial/abstract marks only. No garbled text.';

export const STYLE_02_ANTI_SOFTNESS =
  'NOT Style 01. NOT soft watercolor. NOT pale pencil. NOT dusty muted wash. NOT generic nursery illustration. NOT flat vector. NOT sparse empty room. NOT global orange/amber/yellow filter over the whole image.';

export const STYLE_02_CHARACTER_GUARD =
  'Child: semi-realistic illustrated storybook character — expressive eyes, natural proportions with slight charm, believable hand-painted skin texture, fabric folds, emotional nuance. NOT Pixar, NOT plastic CGI, NOT doll eyes, NOT hyperreal portrait, NOT flat cartoon, NOT Style-01 nursery simplicity.';

export const STYLE_02_AVOIDANCE_NEGATIVE =
  'No copied owls, dragons, turtles, fairies, giants from references unless tiny toys only. No readable text. No Pixar-smooth child. No photorealistic camera portrait.';

/** Scene-typed subsets — canonical from locked audition manifest. */
export const STYLE_02_REF_SUBSETS: Record<
  Style02SceneSubsetKey,
  { filenames: string[]; reason: string }
> = {
  'bedroom-night': {
    filenames: [
      'ChatGPT Image May 18, 2026, 11_41_28 AM.png',
      'ChatGPT Image May 18, 2026, 11_41_49 AM.png',
      'ChatGPT Image May 18, 2026, 12_49_00 PM.png',
      'ChatGPT Image May 18, 2026, 01_45_01 PM.png',
    ],
    reason: 'Dense bedroom-night refs; child-prominent — no turtle/fairy/Pixar-leaning refs.',
  },
  'classroom-day': {
    filenames: [
      'ChatGPT Image May 18, 2026, 12_36_35 PM.png',
      'ChatGPT Image May 18, 2026, 01_46_14 PM.png',
      'ChatGPT Image May 18, 2026, 11_41_43 AM.png',
      'ChatGPT Image May 18, 2026, 02_01_50 PM.png',
    ],
    reason: 'Daytime interior + dimensional materials; no night refs.',
  },
  'clinic-day': {
    filenames: [
      'ChatGPT Image May 18, 2026, 12_36_35 PM.png',
      'ChatGPT Image May 18, 2026, 02_01_50 PM.png',
      'ChatGPT Image May 18, 2026, 01_46_14 PM.png',
      'ChatGPT Image May 18, 2026, 11_41_43 AM.png',
    ],
    reason: 'Bright clinic/day interior + jars/wood study materials.',
  },
  'forest-magical': {
    filenames: [
      'ChatGPT Image May 18, 2026, 11_41_36 AM.png',
      'ChatGPT Image May 18, 2026, 02_39_29 PM.png',
      'ChatGPT Image May 18, 2026, 02_05_22 PM.png',
      'ChatGPT Image May 18, 2026, 02_04_04 PM.png',
    ],
    reason: 'Environment-heavy fairy-village / magical forest stack.',
  },
};

const SCENE_CLASS_TO_SUBSET: Record<Style02SceneClass, Style02SceneSubsetKey> = {
  'night-bedroom': 'bedroom-night',
  'daytime-interior': 'classroom-day',
  'forest-outdoor-environment': 'forest-magical',
};

/** Gated Phase 2 — never active in production unless explicitly enabled. */
export function isStyle02Phase2BookPipelineEnabled(): boolean {
  return process.env.PHASE2_STYLE02_BOOK_PIPELINE?.trim().toLowerCase() === 'true';
}

export function isStyle02BookStyle(styleIdInput?: string | null): boolean {
  if (!styleIdInput) return false;
  const s = styleIdInput.trim().toLowerCase();
  return (
    s === STYLE_IDS.DETAILED_WHIMSICAL_WORLD ||
    s === 'detailed_whimsical_world' ||
    s === 'detailed_whimsical'
  );
}

export function shouldUseStyle02Phase2Path(styleIdInput?: string | null): boolean {
  return isStyle02Phase2BookPipelineEnabled() && isStyle02BookStyle(styleIdInput);
}

export function resolveStyle02RefBudgetConfig(): Style02RefBudgetConfig {
  const raw = (process.env.PHASE2_STYLE02_REF_CONFIG ?? 'A').trim().toUpperCase();
  if (raw === 'B' || raw === 'C') return raw;
  return 'A';
}

const NIGHT_BEDROOM_RE =
  /\b(bedroom|bed\b|bedside|blanket|pillow|quilt|mattress|shelf|asleep|sleeping|sleep\b|bedtime|nightlight|night light|lamplight|lantern|indoor lantern|dusk window|thermometer|moonlight|moon\b|stars at night|bolly|armadillo|plate open|warm glow|child in bed|beside the child)\b|(?:מיטה|שמיכה|כרית|חדר|לילה|נרדם|ישן|ישנה|מדחום|מדף|מסדרון|עמום|בּוֹלִי|בולי)/iu;

const DAYTIME_INTERIOR_RE =
  /\b(classroom|kindergarten|school\b|gan\b|clinic|office|kitchen|living room|indoor)\b|(?:כיתה|גן|בית ספר|מרפאה)/iu;

/** Outdoor magical — only when no bedroom/daytime interior cues matched first. */
const FOREST_OUTDOOR_RE =
  /\b(forest|woods|trees|mushroom|meadow|glade|wildflowers|hills|trail through|path through|garden path|village square|outdoor sunbeam)\b|(?:יער|שביל|אחו|גבעות|פרחי בר)/iu;

/** Classify page scene text → scene class for reference subset selection. */
export function classifyStyle02SceneClass(input: {
  imagePrompt?: string;
  bookPageText?: string;
  environment?: string;
  lighting?: string;
}): Style02SceneClass {
  const hay = [
    input.imagePrompt ?? '',
    input.bookPageText ?? '',
    input.environment ?? '',
    input.lighting ?? '',
  ].join(' ');

  if (NIGHT_BEDROOM_RE.test(hay)) {
    return 'night-bedroom';
  }
  if (DAYTIME_INTERIOR_RE.test(hay)) {
    return 'daytime-interior';
  }
  if (FOREST_OUTDOOR_RE.test(hay)) {
    return 'forest-outdoor-environment';
  }
  return 'daytime-interior';
}

export function resolveStyle02SubsetKey(sceneClass: Style02SceneClass): Style02SceneSubsetKey {
  return SCENE_CLASS_TO_SUBSET[sceneClass];
}

export function resolveStyle02StyleReferencePaths(
  subsetKey: Style02SceneSubsetKey,
  maxCount: number
): string[] {
  const subset = STYLE_02_REF_SUBSETS[subsetKey];
  return subset.filenames.slice(0, maxCount).map((f) => path.join(STYLE_02_REF_DIR, f));
}

export function resolveCompanionReferencePath(companionImage?: string | null): string | undefined {
  if (!companionImage?.trim()) return undefined;
  const trimmed = companionImage.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const publicAbs = path.join(process.cwd(), 'public', trimmed.replace(/^\//, ''));
  if (existsSync(publicAbs)) return publicAbs;
  if (existsSync(trimmed)) return trimmed;
  return undefined;
}

/** ONE stable child visual lock — identical bytes on every page when provided. */
export function buildStyle02ChildVisualLock(input: {
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
    return `CHILD VISUAL LOCK (verbatim every page): ${cs.face}. ${cs.hair}. ${cs.body}.${ageBit}${genderBit} ${cs.signature ?? ''}`.trim();
  }
  const name = (input.childName ?? 'the child').trim();
  const desc = (input.childDescription ?? 'young child protagonist').trim();
  const ageBit = input.childAge ? ` Age ${input.childAge}.` : '';
  const genderBit = input.childGender ? ` ${input.childGender}.` : '';
  return `CHILD VISUAL LOCK (verbatim every page): ${name} — ${desc}.${ageBit}${genderBit}`.trim();
}

/** ONE wardrobe lock — identical outfit every page (Phase 2 test control). */
export function buildStyle02WardrobeLock(input: {
  childStructured?: { clothing: string };
  childDescription?: string;
}): string {
  const clothing = input.childStructured?.clothing?.trim();
  if (clothing) {
    return `BOOK WARDROBE LOCK (verbatim every page — same outfit all pages): ${clothing}`;
  }
  return 'BOOK WARDROBE LOCK (verbatim every page — same outfit all pages): comfortable adventure clothes — long-sleeve top, durable pants, simple shoes; colors stay consistent across all pages.';
}

export function buildStyle02CompanionTextLock(input: {
  companionName?: string;
  companionStructured?: { species: string; size: string; coloring: string; feature: string };
  companionVisualDescription?: string;
}): string {
  const cps = input.companionStructured;
  if (cps?.species?.trim()) {
    return `COMPANION LOCK: ${input.companionName ?? 'companion'} — ${cps.species}, ${cps.size}. ${cps.coloring}. ${cps.feature}. Same design every page.`;
  }
  if (input.companionVisualDescription?.trim()) {
    return `COMPANION LOCK: ${input.companionName ?? 'companion'} — ${input.companionVisualDescription.trim()}. Same design every page.`;
  }
  return '';
}

export const STYLE_02_CHILD_PHOTO_IDENTITY_RULE =
  'CHILD PHOTO (if attached): IDENTITY ONLY — face shape, hair color/length, skin tone, eye shape, age, gender. The child MUST render fully in Style 02: hand-illustrated, semi-realistic, dimensional painted storybook art — NEVER a photoreal pasted cutout, NEVER plastic CGI/Pixar. Outfit and pose come from WARDROBE LOCK and SCENE, never from the photo.';

export const STYLE_02_BOOK_REFERENCE_PREFIX = (
  '[STYLE 02 BOOK — REFERENCE IMAGES]\n' +
  'Earlier attached images (if any) are Guy\'s Style 02 VISUAL STYLE references only — rendering, lighting, materials, density. Do NOT copy their creatures, text, signs, or compositions.\n' +
  'If a child photo is attached: IDENTITY ONLY — re-render as Style 02 illustrated child (semi-realistic storybook), not photoreal.\n' +
  'If a companion reference is attached: match canonical companion design only — not pose or background from the ref.\n\n' +
  '[TARGET SCENE]\n'
);

export type Style02BookPromptProfile = 'default' | 'guarded-v1' | 'guarded-v2';

/** Step 5 Config B guarded-v1 — verbatim locks (do not paraphrase). */
export const GUARDED_V1_WARDROBE_LOCK = `WARDROBE — IDENTICAL ON EVERY PAGE:
brown peaked cap, navy long-sleeve shirt, olive trousers, brown shoes,
small brown crossbody satchel.
No outfit changes. No added accessories. No seasonal swaps.
Cap stays on indoors and outdoors.

CAP RULES:
the cap must NOT hide the face, eyes, or hair silhouette.
Curls and hair shape must remain visible and consistent on every page.
Position the cap so the brim does not cast a shadow across the eyes.`;

export const GUARDED_V1_CHILD_LOCK = `CHILD — same illustrated child on every page.
Use the reference photo as INSPIRATION ONLY for age-appropriate build, face shape, hair, skin tone, and expression.
Illustration, not portraiture — do NOT chase photoreal likeness, do NOT invent a different generic child between pages.
Same child. Same face structure. Same hair. Same expression vocabulary.
Do NOT invent hair clips, glasses, hats, jewelry, or facial marks unless they appear in the photo reference.`;

export const GUARDED_V1_COMPANION_LOCK = `BOLLY — same named recurring companion on every page.
Bolly is NOT a generic armadillo. He is the same specific character throughout.

Visible in every illustration of this book.
Bolly fits in a child's lap. He is small enough to sit on a pillow without dominating it.
Knee-height to the child. Tan-brown segmented shell with visible plates.
Soft pink belly. Large gentle dark eyes. Short rounded snout. Rounded body.
In close-up shots, Bolly's body must still appear distinctly smaller than the child's torso.
Same proportions, same colors, same shell design, same warm personality on every page.

Do NOT change shell pattern. Do NOT change species or proportions.
Never realistic wildlife photography. Never threatening or scary.
Never larger than a small dog. Never as large as a medium dog. Never child-sized.
Always a stylized storybook companion.`;

export const GUARDED_V1_CLOSE_UP_RULE = `CLOSE-UP RULE: preserve visible painterly brushwork and storybook linework on the child's face.
Avoid photographic skin pores, photographic eye highlights, or live-action portrait realism.
Even at this distance, this is illustrated children's-book art — not a photo portrait.`;

export const STYLE_02_BEDTIME_MEDICAL_TONE = `BEDTIME-MEDICAL TONE — every page:
warm intimate child's bedroom (or quiet indoor space), safe and emotionally grounded.
this is a soft bedtime story about anxiety before a medical procedure.
magical details are allowed only as small comforting accents (a soft glow, a gentle shimmer),
NEVER as a full fantasy world. NO fairy lanterns covering the walls.
NO glowing creatures filling the room. NO magical forest seeping through the window.
The world must feel grounded and real, with subtle warmth — not enchanted.`;

export function isStyle02CloseUpScene(sceneDescription: string): boolean {
  const hay = sceneDescription.toLowerCase();
  return (
    /\bclose[- ]?up\b/.test(hay) ||
    /\bclose emotional\b/.test(hay) ||
    /\bintimate\b/.test(hay) ||
    /\bface fills\b/.test(hay)
  );
}

export function shouldInjectBedtimeMedicalTone(input: {
  directionArchetype?: string | null;
  challengeCategory?: string | null;
  sceneClass?: Style02SceneClass;
}): boolean {
  if (input.directionArchetype !== 'bedtime') return false;
  const cat = (input.challengeCategory ?? '').toUpperCase();
  if (cat.includes('MEDICAL')) return true;
  return input.sceneClass === 'night-bedroom';
}

export const GUARDED_V1_COMPOSITION_VARIETY = `DO NOT render five centered medium shots.
Required variety across the 5 pages:
- 1 wide establishing
- 1 medium with environment context
- 1 close emotional (face fills 50–70%)
- 1 action/movement composition
- 1 intimate/low-light scene
Vary camera angle and child/Bolly positioning. No identical staging twice.`;

export function resolveStyle02Step5Profile(): Style02BookPromptProfile | null {
  const raw = process.env.PHASE2_STEP5_PROFILE?.trim().toLowerCase();
  if (raw === 'guarded-v1') return 'guarded-v1';
  if (raw === 'guarded-v2') return 'guarded-v2';
  if (!raw) return null;
  return null;
}

/** Live book pipeline — same env knob as Step 5 (`PHASE2_STEP5_PROFILE`). */
export function resolveStyle02BookPromptProfile(): Style02BookPromptProfile {
  return resolveStyle02Step5Profile() ?? 'default';
}

export function buildStyle02BookPagePrompt(input: {
  sceneDescription: string;
  childVisualLock?: string;
  wardrobeLock?: string;
  companionTextLock?: string;
  profile?: Style02BookPromptProfile;
  /** Per-page composition reminder (guarded-v1). */
  pageCompositionNote?: string;
  bedtimeMedicalTone?: boolean;
  closeUpRule?: boolean;
  /** guarded-v2 uses assembleGuardedV2PagePrompt — pass pre-built prompt when set. */
  guardedV2PromptOverride?: string;
}): string {
  if (input.guardedV2PromptOverride) {
    return input.guardedV2PromptOverride;
  }
  if (input.profile === 'guarded-v1') {
    return [
      input.sceneDescription.trim(),
      input.bedtimeMedicalTone ? STYLE_02_BEDTIME_MEDICAL_TONE : '',
      STYLE_02_SHARED,
      STYLE_02_RENDERING_CORRECTION,
      GUARDED_V1_WARDROBE_LOCK,
      GUARDED_V1_CHILD_LOCK,
      GUARDED_V1_COMPANION_LOCK,
      input.closeUpRule ? GUARDED_V1_CLOSE_UP_RULE : '',
      GUARDED_V1_COMPOSITION_VARIETY,
      input.pageCompositionNote?.trim() ?? '',
      STYLE_02_CHILD_PHOTO_IDENTITY_RULE,
      STYLE_02_REFERENCE_INSTRUCTION,
      STYLE_02_NO_TEXT,
      STYLE_02_ANTI_SOFTNESS,
      STYLE_02_CHARACTER_GUARD,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return [
    input.sceneDescription.trim(),
    input.bedtimeMedicalTone ? STYLE_02_BEDTIME_MEDICAL_TONE : '',
    STYLE_02_SHARED,
    STYLE_02_RENDERING_CORRECTION,
    input.childVisualLock ?? '',
    input.wardrobeLock ?? '',
    input.companionTextLock ?? '',
    STYLE_02_CHILD_PHOTO_IDENTITY_RULE,
    STYLE_02_REFERENCE_INSTRUCTION,
    STYLE_02_NO_TEXT,
    STYLE_02_ANTI_SOFTNESS,
    STYLE_02_CHARACTER_GUARD,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Assemble reference image paths per probe config A/B/C. */
export function assembleStyle02BookReferences(input: {
  styleRefPaths: string[];
  childPhotoPath?: string;
  companionRefPath?: string;
  otherCharacterRefPaths?: string[];
  config: Style02RefBudgetConfig;
}): { paths: string[]; breakdown: Record<string, string[]> } {
  const styleAll = input.styleRefPaths;
  const breakdown: Record<string, string[]> = { style: [], child: [], companion: [], otherCharacters: [] };

  switch (input.config) {
    case 'A': {
      const style = styleAll.slice(0, 2);
      breakdown.style = style;
      if (input.childPhotoPath) breakdown.child = [input.childPhotoPath];
      if (input.companionRefPath) breakdown.companion = [input.companionRefPath];
      break;
    }
    case 'B': {
      const style = styleAll.slice(0, 3);
      breakdown.style = style;
      if (input.childPhotoPath) breakdown.child = [input.childPhotoPath];
      break;
    }
    case 'C': {
      const style = styleAll.slice(0, 3);
      breakdown.style = style;
      if (input.companionRefPath) breakdown.companion = [input.companionRefPath];
      break;
    }
  }

  // Identity-critical ordering: character anchors must precede style refs.
  breakdown.otherCharacters = (input.otherCharacterRefPaths ?? []).filter(Boolean);
  const paths = [
    ...breakdown.child,
    ...breakdown.companion,
    ...breakdown.otherCharacters,
    ...breakdown.style,
  ];
  return { paths, breakdown };
}
