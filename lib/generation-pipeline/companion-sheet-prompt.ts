import type { ChallengeCategory } from '@/lib/companions';

/**
 * The shared, pure companion sheet prompt data (moved verbatim from companion-character-sheet.ts on 2026-10-28, so the metered personal
 * sheet operator uses the same view and style text without importing the legacy generator). The legacy builder composes its prompts
 * from here; its output is byte-identical (pinned by a digest of every legacy prompt in companion-sheets.spec.ts). No per-companion text.
 */

/** Standard multi-angle companion sheet views (creature side of #20). */
export type CompanionSheetViewKind =
  | 'front'
  | 'three_quarter_front'
  | 'side'
  | 'three_quarter_back'
  | 'happy'
  | 'theme';

export const COMPANION_SHEET_VIEW_KINDS: CompanionSheetViewKind[] = [
  'front',
  'three_quarter_front',
  'side',
  'three_quarter_back',
  'happy',
  'theme',
];

/** On-disk filenames under style01-sheets/ or outputs/companion-sheets/<id>/ */
export const COMPANION_SHEET_VIEW_FILENAME: Record<CompanionSheetViewKind, string> = {
  front: 'front.png',
  three_quarter_front: '3-4.png',
  side: 'side.png',
  three_quarter_back: 'back.png',
  happy: 'happy.png',
  theme: 'theme.png',
};

export const PALETTE_FAITHFULNESS =
  "Match the reference's exact color palette and saturation. Keep the muted, soft watercolor tones of the reference — do NOT brighten, do NOT increase saturation or vividness. Same hue, same softness as the source.";

export const COMPANION_SHEET_VIEW_SCENE: Record<CompanionSheetViewKind, string> = {
  front:
    'FRONT-FACING full-body view: creature faces the viewer, neutral calm expression, centered on near-empty warm cream background.',
  three_quarter_front:
    'THREE-QUARTER FRONT view: creature turned slightly (~30°) so both eyes and snout/profile read clearly; full body visible.',
  side:
    'SIDE PROFILE view: creature in clean lateral profile (left or right), full body silhouette readable, neutral expression.',
  three_quarter_back:
    'THREE-QUARTER BACK view: mostly back/tail/wings visible with a hint of cheek or eye; same proportions and markings.',
  happy:
    'HAPPY expression: warm gentle smile or bright friendly eyes; same identity; subtle cheerful pose OK; still isolated on cream background.',
  theme: '', // filled per category below
};

export const THEME_EXPRESSION_BY_CATEGORY: Partial<Record<ChallengeCategory, string>> = {
  NIGHT_FEAR:
    'THEME expression (calm & reassuring): soft steady eyes, relaxed posture — a gentle night-guide mood, not scared, not predatory.',
  ANGER_FRUSTRATION:
    'THEME expression (calm breath): soft settling posture, eyes focused but soft — upset energy redirected, still lovable.',
  SOCIAL:
    'THEME expression (quiet belonging): gentle open posture, soft eyes — calm social presence without needing to be loud.',
  TRANSITION:
    'THEME expression (shy warmth): soft curious eyes, tail gently curled — new-place courage without chaos.',
  NEW_SIBLING:
    'THEME expression (protective guardian): proud gentle stance, nurturing eyes — big-sibling protector mood, not aggressive.',
  SENSITIVITY_OVERWHELM:
    'THEME expression (gentle overwhelm): slightly wide eyes, small comforting gesture — sensitive but safe.',
  GENERAL_FEARS:
    'THEME expression (brave curiosity): cautious but curious eyes, small forward lean — courage without fearlessness caricature.',
};

export function resolveCompanionThemeScene(category: ChallengeCategory | null): string {
  const base =
    category && THEME_EXPRESSION_BY_CATEGORY[category]
      ? THEME_EXPRESSION_BY_CATEGORY[category]!
      : 'THEME expression: one gentle story-appropriate mood matching the companion role — still the SAME creature.';
  return `${base} Isolated on near-empty warm cream background. NO scene. NO child. NO humans.`;
}

/** The generic view line of a kind (no category: the generic theme). */
export function companionSheetViewLine(kind: CompanionSheetViewKind, category: ChallengeCategory | null): string {
  return kind === 'theme' ? resolveCompanionThemeScene(category) : COMPANION_SHEET_VIEW_SCENE[kind];
}

/** The Style 01 blocks a sheet prompt carries; passed in by the caller (they live in the Style 01 modules). */
export type CompanionSheetStyleBlocks = { shared: string; renderingCorrection: string; noText: string; antiStyle02: string };

/**
 * One sheet prompt. `prompt_only_front`, `front_from_reference` and `angle_variant` are the legacy modes, unchanged.
 * `concept_front_technique_refs` (2026-10-28) is a new companion's first front drawn from its written lock, with technique-only
 * references: it does not ask to match a reference palette, since the references are other creatures.
 */
export type CompanionSheetPromptMode = 'prompt_only_front' | 'front_from_reference' | 'angle_variant' | 'concept_front_technique_refs';

const INTRO: Record<CompanionSheetPromptMode, readonly string[]> = {
  prompt_only_front: [
    'STYLE 01 COMPANION CHARACTER SHEET — FRONT (canon redo from visual lock only).',
    'NO reference photo. Draw this companion EXACTLY from the COMPANION VISUAL LOCK below.',
    'Cute simplified hand-drawn watercolor storybook illustration — NOT photoreal, NOT 3D render.',
  ],
  front_from_reference: [
    'STYLE 01 COMPANION CHARACTER SHEET — FRONT (identity lock from reference photo).',
    'Image 1 is the canonical companion reference photo. Preserve EXACT species, colors, markings, proportions, accessories, and silhouette.',
    'Re-render as cute simplified hand-drawn watercolor storybook illustration — NOT photoreal, NOT 3D render.',
  ],
  angle_variant: [
    'STYLE 01 COMPANION CHARACTER SHEET — angle/expression variant.',
    'Image 1 is the APPROVED Style 01 front view of this companion. Preserve EXACT colors, markings, proportions, species, and accessories.',
    'Change ONLY camera angle, facing direction, and expression as specified — NOT a new creature.',
  ],
  concept_front_technique_refs: [
    'STYLE 01 COMPANION CHARACTER SHEET — FRONT (new companion concept from its visual lock).',
    'The reference images are TECHNIQUE references only: match their paper, linework, soft watercolor and colored-pencil rendering and friendly eye style. NEVER copy their species, anatomy, colors, markings or accessories.',
    'Draw this NEW companion EXACTLY from the COMPANION VISUAL LOCK below, as a cute simplified hand-drawn watercolor storybook illustration — NOT photoreal, NOT 3D render.',
  ],
};

export const COMPANION_SHEET_BACKGROUND_RULE =
  'Clean near-empty warm cream paper background. NO environment scene. NO forest. NO room. NO child protagonist. NO human family. NO other creatures. NO text or letters.';

/**
 * The companion-only blocks of the prospective sheet path (CSR-1, 2026-10-28). They replace the Style 01 rendering correction there,
 * which is written for a child ("Render the child with recognizably human facial proportions…") and says "NOT empty cream void
 * background" next to the cream-background rule. They also replace the Style 01 page negative (Dini, cave pages, duplicate children).
 * The legacy modes above keep their exact text.
 */
export const COMPANION_SHEET_RENDERING =
  'RENDERING: soft watercolor storybook — visible paper texture, gentle pigment bleeds, warm local color, delicate linework, airy cream space around ONE isolated full-body figure. Hand-painted, never photographic. NOT harsh shadows. NOT a global orange filter.';
export const COMPANION_SHEET_NEGATIVE =
  'No readable text. No scene, ground props, panels or frames. No other creature, no child and no human. No tight crop and no figure filling the frame. No Style 02 cinematic rendering.';

/**
 * One prompt of the prospective companion-only path: an angle/expression variant under its view contract, or a new companion's
 * concept front. No child, page or story prose.
 */
export function composeCompanionOnlySheetPrompt(input: {
  mode: 'angle_variant_contract' | 'concept_front_technique_refs';
  viewLine: string;
  /** The view contract text (required for an angle variant, absent for a concept front). */
  contract?: string;
  visualLock: string;
  accessoryLock?: string;
  style: Pick<CompanionSheetStyleBlocks, 'shared' | 'noText' | 'antiStyle02'>;
}): string {
  const variant = input.mode === 'angle_variant_contract';
  if (variant !== Boolean(input.contract?.trim())) throw new Error('companion_sheet_contract_required');
  return [
    ...(variant ? INTRO.angle_variant : INTRO.concept_front_technique_refs),
    variant ? PALETTE_FAITHFULNESS : undefined,
    input.viewLine,
    input.contract,
    COMPANION_SHEET_BACKGROUND_RULE,
    input.style.shared,
    COMPANION_SHEET_RENDERING,
    `COMPANION VISUAL LOCK (verbatim): ${input.visualLock}`,
    input.accessoryLock,
    input.style.noText,
    input.style.antiStyle02,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function composeCompanionSheetPrompt(input: {
  mode: CompanionSheetPromptMode;
  viewLine: string;
  visualLock: string;
  accessoryLock?: string;
  style: CompanionSheetStyleBlocks;
}): string {
  return [
    ...INTRO[input.mode],
    input.mode === 'concept_front_technique_refs' ? undefined : PALETTE_FAITHFULNESS,
    input.viewLine,
    COMPANION_SHEET_BACKGROUND_RULE,
    input.style.shared,
    input.style.renderingCorrection,
    `COMPANION VISUAL LOCK (verbatim): ${input.visualLock}`,
    input.accessoryLock,
    input.style.noText,
    input.style.antiStyle02,
  ]
    .filter(Boolean)
    .join('\n\n');
}
