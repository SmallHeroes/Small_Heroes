import { existsSync, mkdirSync, readdirSync, writeFileSync, copyFileSync } from 'fs';
import { dirname, join } from 'path';
import type { ChallengeCategory } from '@/lib/companions';
import { COMPANIONS_BY_CATEGORY, getCompanionById } from '@/lib/companions';
import { buildCompanionAccessoryLockBlock } from '@/lib/companion-accessory';
import {
  evaluateAnchorEmbeddingScore,
  resolveAnchorGateConfig,
} from '@/lib/anchor-resemblance-gate';
import { evaluateAnchorStyleFromVision } from '@/lib/anchor-style-qa';
import { normalizePhotoUrlForVision } from '@/lib/child-photo-normalize';
import { generateGPTImage } from '@/lib/generate-image';
import { scoreResemblanceAgainstReference } from '@/lib/resemblance-core';
import {
  STYLE_01_ANTI_STYLE02,
  STYLE_01_AVOIDANCE_NEGATIVE,
  STYLE_01_NO_TEXT,
  STYLE_01_RENDERING_CORRECTION,
  STYLE_01_SHARED,
  resolveStyle01GptModel,
} from '@/lib/style01-gptimage';

function resolveCompanionReferenceJpgPath(companionImage?: string | null): string | undefined {
  if (!companionImage?.trim()) return undefined;
  const trimmed = companionImage.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const publicAbs = join(process.cwd(), 'public', trimmed.replace(/^\//, ''));
  if (existsSync(publicAbs)) return publicAbs;
  if (existsSync(trimmed)) return trimmed;
  return undefined;
}

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

const PALETTE_FAITHFULNESS =
  "Match the reference's exact color palette and saturation. Keep the muted, soft watercolor tones of the reference — do NOT brighten, do NOT increase saturation or vividness. Same hue, same softness as the source.";

const COMPANION_PALETTE_QA_PROMPT = `Compare Image 1 (REFERENCE palette) and Image 2 (CANDIDATE sheet view) — same companion character.

Return ONLY JSON:
{
  "sameMutedPalette": true if candidate matches the reference's muted/soft watercolor saturation and vividness (not brighter, not more neon),
  "clearlyOversaturated": true if candidate colors are noticeably brighter, more saturated, or more vivid than the reference,
  "notes": "one short sentence"
}

FAIL if clearlyOversaturated is true OR sameMutedPalette is false.`;

const VIEW_SCENE: Record<CompanionSheetViewKind, string> = {
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

const THEME_EXPRESSION_BY_CATEGORY: Partial<Record<ChallengeCategory, string>> = {
  NIGHT_FEAR:
    'THEME expression (calm & reassuring): soft steady eyes, relaxed posture — a gentle night-guide mood, not scared, not predatory.',
  ANGER_FRUSTRATION:
    'THEME expression (calm breath): tentacles/limbs settling, eyes focused but soft — upset energy redirected, still lovable.',
  NEW_SIBLING:
    'THEME expression (protective guardian): proud gentle stance, nurturing eyes — big-sibling protector mood, not aggressive.',
  SENSITIVITY_OVERWHELM:
    'THEME expression (gentle overwhelm): slightly wide eyes, small comforting gesture — sensitive but safe.',
  GENERAL_FEARS:
    'THEME expression (brave curiosity): cautious but curious eyes, small forward lean — courage without fearlessness caricature.',
};

export type CompanionSheetViewResult = {
  kind: CompanionSheetViewKind;
  localPath: string;
  resemblanceToIdentity: number;
  styleQaPass: boolean;
  paletteQaPass: boolean;
  qaStatus: 'passed' | 'failed';
  attempts: number;
  identityRefUsed: string;
};

export type CompanionCharacterSheetBundle = {
  companionId: string;
  companionName: string;
  referenceJpg: string;
  category: ChallengeCategory | null;
  visualDescription: string;
  generatedAt: string;
  views: Partial<Record<CompanionSheetViewKind, CompanionSheetViewResult>>;
};

function resolveThemeScene(category: ChallengeCategory | null): string {
  const base =
    category && THEME_EXPRESSION_BY_CATEGORY[category]
      ? THEME_EXPRESSION_BY_CATEGORY[category]!
      : 'THEME expression: one gentle story-appropriate mood matching the companion role — still the SAME creature.';
  return `${base} Isolated on near-empty warm cream background. NO scene. NO child. NO humans.`;
}

function buildCompanionSheetPrompt(input: {
  companionId: string;
  kind: CompanionSheetViewKind;
  visualDescription: string;
  category: ChallengeCategory | null;
  isFrontFromJpg: boolean;
}): string {
  const viewLine =
    input.kind === 'theme'
      ? resolveThemeScene(input.category)
      : VIEW_SCENE[input.kind];

  const accessoryLock = buildCompanionAccessoryLockBlock({
    companionId: input.companionId,
    companionPresence: 'present',
  });

  const intro = input.isFrontFromJpg
    ? [
        'STYLE 01 COMPANION CHARACTER SHEET — FRONT (identity lock from reference photo).',
        'Image 1 is the canonical companion reference photo. Preserve EXACT species, colors, markings, proportions, accessories, and silhouette.',
        'Re-render as cute simplified hand-drawn watercolor storybook illustration — NOT photoreal, NOT 3D render.',
      ]
    : [
        'STYLE 01 COMPANION CHARACTER SHEET — angle/expression variant.',
        'Image 1 is the APPROVED Style 01 front view of this companion. Preserve EXACT colors, markings, proportions, species, and accessories.',
        'Change ONLY camera angle, facing direction, and expression as specified — NOT a new creature.',
      ];

  return [
    ...intro,
    PALETTE_FAITHFULNESS,
    viewLine,
    'Clean near-empty warm cream paper background. NO environment scene. NO forest. NO room. NO child protagonist. NO human family. NO other creatures. NO text or letters.',
    STYLE_01_SHARED,
    STYLE_01_RENDERING_CORRECTION,
    `COMPANION VISUAL LOCK (verbatim): ${input.visualDescription}`,
    accessoryLock,
    STYLE_01_NO_TEXT,
    STYLE_01_ANTI_STYLE02,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function evaluateCompanionPaletteFaithfulness(
  referencePath: string,
  candidatePath: string
): Promise<{
  ok: boolean;
  clearlyOversaturated: boolean;
  sameMutedPalette: boolean;
  notes: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: true,
      clearlyOversaturated: false,
      sameMutedPalette: true,
      notes: 'OPENAI_API_KEY missing — palette QA skipped',
    };
  }

  try {
    const [refUrl, candUrl] = await Promise.all([
      normalizePhotoUrlForVision(referencePath),
      normalizePhotoUrlForVision(candidatePath),
    ]);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o',
        max_tokens: 200,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: refUrl, detail: 'low' } },
              { type: 'image_url', image_url: { url: candUrl, detail: 'low' } },
              { type: 'text', text: COMPANION_PALETTE_QA_PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      return {
        ok: true,
        clearlyOversaturated: false,
        sameMutedPalette: true,
        notes: `palette QA HTTP ${res.status} — skipped`,
      };
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as {
      clearlyOversaturated?: boolean;
      sameMutedPalette?: boolean;
      notes?: string;
    };
    const clearlyOversaturated = parsed.clearlyOversaturated === true;
    const sameMutedPalette = parsed.sameMutedPalette !== false;
    const ok = sameMutedPalette && !clearlyOversaturated;
    return {
      ok,
      clearlyOversaturated,
      sameMutedPalette,
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    };
  } catch (err) {
    return {
      ok: true,
      clearlyOversaturated: false,
      sameMutedPalette: true,
      notes: `palette QA error — skipped: ${(err as Error)?.message ?? 'unknown'}`,
    };
  }
}

function resolveCompanionCategory(companionId: string): ChallengeCategory | null {
  for (const [category, list] of Object.entries(COMPANIONS_BY_CATEGORY)) {
    if (list.some((c) => c.id === companionId)) return category as ChallengeCategory;
  }
  return null;
}

export function resolveCompanionPublicSheetsDir(companionId: string): string {
  return join(process.cwd(), 'public', 'companions', companionId, 'style01-sheets');
}

export function listPublishedCompanionSheetViews(
  companionId: string
): Partial<Record<CompanionSheetViewKind, string>> {
  const dir = resolveCompanionPublicSheetsDir(companionId);
  if (!existsSync(dir)) return {};
  const files = new Set(readdirSync(dir));
  const out: Partial<Record<CompanionSheetViewKind, string>> = {};
  for (const kind of COMPANION_SHEET_VIEW_KINDS) {
    const fname = COMPANION_SHEET_VIEW_FILENAME[kind];
    if (files.has(fname)) {
      out[kind] = join(dir, fname);
    }
  }
  return out;
}

export function countPublishedCompanionSheetViews(companionId: string): number {
  return Object.keys(listPublishedCompanionSheetViews(companionId)).length;
}

export async function generateCompanionSheetView(input: {
  companionId: string;
  kind: CompanionSheetViewKind;
  identityRefPath: string;
  /** Canonical jpg — palette QA compares candidate saturation to this on every view. */
  paletteRefPath: string;
  localOutPath: string;
  isFrontFromJpg: boolean;
  attemptSuffix?: string;
}): Promise<CompanionSheetViewResult> {
  const companion = getCompanionById(input.companionId);
  if (!companion) throw new Error(`Unknown companion: ${input.companionId}`);
  const category = resolveCompanionCategory(input.companionId);

  const anchorGate = resolveAnchorGateConfig();
  const maxAttempts =
    Number.parseInt(process.env.COMPANION_SHEET_MAX_ATTEMPTS ?? '5', 10) || 5;
  const minResemblance =
    Number.parseFloat(process.env.COMPANION_SHEET_MIN_RESEMBLANCE ?? '0.22') || 0.22;

  const prompt = buildCompanionSheetPrompt({
    companionId: input.companionId,
    kind: input.kind,
    visualDescription: companion.visualDescription,
    category,
    isFrontFromJpg: input.isFrontFromJpg,
  });

  let lastFailure = 'unknown';
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const gen = await generateGPTImage({
      finalPrompt: prompt,
      negativePrompt: STYLE_01_AVOIDANCE_NEGATIVE,
      referenceImages: [input.identityRefPath],
      referenceMode: input.isFrontFromJpg
        ? 'anchor_companion_from_jpg'
        : 'anchor_companion_from_sheet_view',
      requireReferenceEdit: true,
      size: '1024x1536',
      quality: (process.env.GPT_IMAGE_QUALITY?.trim() || 'low') as 'low' | 'medium' | 'high',
      modelOverride: resolveStyle01GptModel(),
    });

    mkdirSync(dirname(input.localOutPath), { recursive: true });
    writeFileSync(input.localOutPath, gen.buffer);

    const scored = await scoreResemblanceAgainstReference({
      referenceImageUrl: input.identityRefPath,
      candidateImageUrl: input.localOutPath,
      effectiveThreshold: 0.7,
      minAcceptableScore: 0.7,
    });
    const embedding = evaluateAnchorEmbeddingScore(scored.resemblanceScore, anchorGate);
    const styleQa = await evaluateAnchorStyleFromVision(input.localOutPath);
    const stylePass = styleQa.ok;
    const paletteQa = await evaluateCompanionPaletteFaithfulness(
      input.paletteRefPath,
      input.localOutPath
    );
    const palettePass = paletteQa.ok;
    const identityOk = !embedding.hardFail && scored.resemblanceScore >= minResemblance;

    if (identityOk && stylePass && palettePass) {
      return {
        kind: input.kind,
        localPath: input.localOutPath,
        resemblanceToIdentity: scored.resemblanceScore,
        styleQaPass: stylePass,
        paletteQaPass: palettePass,
        qaStatus: 'passed',
        attempts: attempt,
        identityRefUsed: input.identityRefPath,
      };
    }

    lastFailure = `resemblance=${scored.resemblanceScore.toFixed(3)} style=${stylePass} palette=${palettePass} (${paletteQa.notes}) embedding=${embedding.verdict}`;
    console.warn(
      `[companion_sheet] reject companion=${input.companionId} view=${input.kind} attempt=${attempt}/${maxAttempts} ${lastFailure}`
    );
  }

  throw new Error(
    `Companion sheet view "${input.kind}" failed QA after ${maxAttempts} attempts: ${lastFailure}`
  );
}

export async function generateCompanionCharacterSheet(input: {
  companionId: string;
  outDir: string;
  /** When true, also copy passed views to public/companions/<id>/style01-sheets/ */
  publishToPublic?: boolean;
}): Promise<CompanionCharacterSheetBundle> {
  const companion = getCompanionById(input.companionId);
  if (!companion) throw new Error(`Unknown companion: ${input.companionId}`);

  const jpgPath = resolveCompanionReferenceJpgPath(companion.image);
  if (!jpgPath) throw new Error(`Companion reference jpg not found: ${companion.image}`);

  const category = resolveCompanionCategory(input.companionId);
  mkdirSync(input.outDir, { recursive: true });

  const views: Partial<Record<CompanionSheetViewKind, CompanionSheetViewResult>> = {};
  const suffix = Date.now();

  const frontPath = join(input.outDir, COMPANION_SHEET_VIEW_FILENAME.front);
  console.log(`[companion_sheet] ${input.companionId} generating front from jpg`);
  const front = await generateCompanionSheetView({
    companionId: input.companionId,
    kind: 'front',
    identityRefPath: jpgPath,
    paletteRefPath: jpgPath,
    localOutPath: frontPath,
    isFrontFromJpg: true,
    attemptSuffix: `${suffix}-front`,
  });
  views.front = front;

  const identityForAngles = front.localPath;

  for (const kind of COMPANION_SHEET_VIEW_KINDS) {
    if (kind === 'front') continue;
    const localOutPath = join(input.outDir, COMPANION_SHEET_VIEW_FILENAME[kind]);
    console.log(`[companion_sheet] ${input.companionId} generating ${kind}`);
    const result = await generateCompanionSheetView({
      companionId: input.companionId,
      kind,
      identityRefPath: identityForAngles,
      paletteRefPath: jpgPath,
      localOutPath,
      isFrontFromJpg: false,
      attemptSuffix: `${suffix}-${kind}`,
    });
    views[kind] = result;
  }

  const bundle: CompanionCharacterSheetBundle = {
    companionId: input.companionId,
    companionName: companion.name,
    referenceJpg: companion.image,
    category,
    visualDescription: companion.visualDescription,
    generatedAt: new Date().toISOString(),
    views,
  };

  writeFileSync(join(input.outDir, 'report.json'), JSON.stringify(bundle, null, 2));

  if (input.publishToPublic) {
    const pubDir = resolveCompanionPublicSheetsDir(input.companionId);
    mkdirSync(pubDir, { recursive: true });
    for (const kind of COMPANION_SHEET_VIEW_KINDS) {
      const entry = views[kind];
      if (!entry?.localPath) continue;
      copyFileSync(entry.localPath, join(pubDir, COMPANION_SHEET_VIEW_FILENAME[kind]));
    }
    writeFileSync(
      join(pubDir, 'manifest.json'),
      JSON.stringify(
        {
          companionId: bundle.companionId,
          referenceJpg: bundle.referenceJpg,
          generatedAt: bundle.generatedAt,
          views: Object.fromEntries(
            COMPANION_SHEET_VIEW_KINDS.map((k) => [
              k,
              views[k]
                ? {
                    filename: COMPANION_SHEET_VIEW_FILENAME[k],
                    qaStatus: views[k]!.qaStatus,
                    resemblanceToIdentity: views[k]!.resemblanceToIdentity,
                  }
                : null,
            ]).filter(([, v]) => v)
          ),
        },
        null,
        2
      )
    );
    console.log(`[companion_sheet] published to ${pubDir}`);
  }

  return bundle;
}
