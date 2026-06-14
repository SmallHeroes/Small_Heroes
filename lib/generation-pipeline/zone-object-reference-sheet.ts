import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { generateGPTImage } from '@/lib/generate-image';
import type { BookLocationBible, FixedAnchor, LocationZone } from '@/lib/story-location-bible/types';
import { resolveZoneById } from '@/lib/story-location-bible/compose';
import {
  STYLE_01_ANTI_STYLE02,
  STYLE_01_AVOIDANCE_NEGATIVE,
  STYLE_01_NO_TEXT,
  STYLE_01_SHARED,
  resolveStyle01GptModel,
  resolveStyle01StyleReferencePaths,
} from '@/lib/style01-gptimage';

export type ZoneSheetArtifactKind = 'set' | 'object';

const ZERO_CHARACTERS_LOCK = `ZERO CHARACTERS — CRITICAL:
This is an EMPTY SET reference only. NO child. NO human. NO fox. NO creature. NO animal. NO nurse. NO silhouette figures.
If any character appears, the image is unusable.`;

const DRIP_SOURCE_LOCK = `DRIP SOURCE — ONE FIXED DESIGN:
Use ONE simple stone or plaster ledge drip above the bucket — a small wet ledge with a single water drip falling into the bucket.
NO wall faucet. NO downspout. NO gutter machinery. NO open stream.`;

const BUCKET_SCALE_LOCK = `BUCKET SCALE — READABLE IN-SCENE:
Same small galvanized METAL bucket (dull silver, NOT plastic, NOT blue toy pail).
Include a simple balcony chair or small seat in the set as a fixed scale cue — bucket clearly below seat height, roughly child knee-height, never oversized or basin-sized.`;

function findFixedAnchor(bible: BookLocationBible, id: string): FixedAnchor | undefined {
  return bible.fixedAnchors.find((a) => a.id === id);
}

function buildZoneSetPrompt(zone: LocationZone, bible: BookLocationBible): string {
  const bucket = findFixedAnchor(bible, 'metal_bucket');
  const drip = findFixedAnchor(bible, 'drip_source');
  const homeNight = findFixedAnchor(bible, 'home_night');

  return [
    STYLE_01_SHARED,
    STYLE_01_NO_TEXT,
    STYLE_01_ANTI_STYLE02,
    '',
    'ZONE REFERENCE SHEET — EMPTY SET (balcony drip area):',
    ZERO_CHARACTERS_LOCK,
    '',
    `ZONE: ${zone.description}`,
    zone.stableGeometry.length ? `STABLE GEOMETRY: ${zone.stableGeometry.join('; ')}` : '',
    zone.visualAnchors.length ? `VISUAL ANCHORS: ${zone.visualAnchors.join('; ')}` : '',
    bucket ? `BUCKET: ${bucket.description}` : '',
    drip ? `DRIP: ${drip.description}` : '',
    homeNight ? `MOOD: ${homeNight.description}` : '',
    '',
    DRIP_SOURCE_LOCK,
    BUCKET_SCALE_LOCK,
    '',
    'COMPOSITION: Medium-wide view of the small safe home balcony / under-window corner.',
    'Show spatial relationships: wall/window edge, safe low railing, floor tiles, chair scale cue, metal bucket under the ledge drip, moonlit home-night mood.',
    'Warm indoor glow from nearby window; soft watercolor storybook Style 01.',
    'Clean readable reference — not a dramatic camera angle.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildObjectAnchorFromSetPrompt(zone: LocationZone, bible: BookLocationBible): string {
  const bucket = findFixedAnchor(bible, 'metal_bucket');
  const drip = findFixedAnchor(bible, 'drip_source');
  const homeNight = findFixedAnchor(bible, 'home_night');

  return [
    STYLE_01_SHARED,
    STYLE_01_NO_TEXT,
    STYLE_01_ANTI_STYLE02,
    '',
    'OBJECT ANCHOR SHEET — DERIVED FROM APPROVED ZONE SET (set-candidate-01):',
    ZERO_CHARACTERS_LOCK,
    '',
    'MATCH THE APPROVED SET REFERENCE EXACTLY — one continuous asset truth:',
    '- LEFT: same warm yellow window glow, same stone/plaster window-ledge drip source above bucket',
    '- FLOOR: same terracotta square tiles',
    '- RIGHT: same safe black metal-bar railing (story text: metal railing / מעקה המתכת)',
    '- SCALE: same simple wooden balcony chair on the right — bucket clearly below chair-seat height, child knee-height',
    '- BUCKET: same small galvanized METAL bucket (dull silver, wire handle) directly under the ledge drip, ripples in water',
    '- SKY/MOOD: same dark moonlit home-night — crescent moon and stars visible, warm window vs cool night contrast',
    '- NO daylight, NO dusk/orange sunset, NO alternate furniture, NO stone balustrade, NO lavender pots unless in set ref',
    '',
    `CONTEXT: ${zone.description}`,
    bucket ? `BUCKET LOCK: ${bucket.description}` : '',
    drip ? `DRIP LOCK: ${drip.description}` : '',
    homeNight ? `MOOD LOCK: ${homeNight.description}` : '',
    '',
    DRIP_SOURCE_LOCK,
    '',
    'COMPOSITION: Medium-close crop centered on bucket + ledge drip.',
    'Window glow, chair, railing, and night sky remain visible for continuity — same layout as set reference, tighter framing only.',
    'Soft watercolor Style 01. No characters.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildObjectAnchorPrompt(zone: LocationZone, bible: BookLocationBible): string {
  const bucket = findFixedAnchor(bible, 'metal_bucket');
  const drip = findFixedAnchor(bible, 'drip_source');

  return [
    STYLE_01_SHARED,
    STYLE_01_NO_TEXT,
    STYLE_01_ANTI_STYLE02,
    '',
    'OBJECT ANCHOR SHEET — METAL BUCKET + DRIP (same assets as zone set):',
    ZERO_CHARACTERS_LOCK,
    '',
    `CONTEXT ZONE: ${zone.description}`,
    bucket ? `BUCKET: ${bucket.description}` : '',
    drip ? `DRIP: ${drip.description}` : '',
    '',
    DRIP_SOURCE_LOCK,
    BUCKET_SCALE_LOCK,
    '',
    'COMPOSITION: Close view centered on the same small galvanized metal bucket and the same stone/plaster ledge drip above it.',
    'Balcony floor and railing edge may appear in background for context. Chair scale cue partially visible OK.',
    'One continuous asset truth with the zone set sheet — same bucket design, same drip source, same scale.',
    'Soft watercolor Style 01. No characters.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildZoneSheetPrompt(input: {
  kind: ZoneSheetArtifactKind;
  zone: LocationZone;
  bible: BookLocationBible;
}): string {
  return input.kind === 'set'
    ? buildZoneSetPrompt(input.zone, input.bible)
    : buildObjectAnchorPrompt(input.zone, input.bible);
}

export type ZoneSheetCandidateResult = {
  kind: ZoneSheetArtifactKind;
  candidateIndex: number;
  localPath: string;
  prompt: string;
  styleRefsUsed: string[];
  model: string;
  durationMs: number;
};

export type ZoneSheetGenerationBundle = {
  storyKey: string;
  zoneId: string;
  generatedAt: string;
  quality: 'low' | 'medium' | 'high';
  candidatesPerArtifact: number;
  set: ZoneSheetCandidateResult[];
  bucket: ZoneSheetCandidateResult[];
  /** When bucket regen derives from an approved set reference. */
  derivedFromSet?: string;
};

const BUCKET_NEGATIVE =
  [
    STYLE_01_AVOIDANCE_NEGATIVE,
    'child',
    'human',
    'fox',
    'creature',
    'animal',
    'person',
    'character',
    'faucet',
    'downspout',
    'plastic bucket',
    'blue bucket',
    'oversized bucket',
    'basin',
    'daylight',
    'sunset',
    'dusk',
    'orange sky',
    'stone balustrade',
    'wrought iron scroll',
  ].join(', ');

async function renderBucketCandidate(input: {
  zoneId: string;
  candidateIndex: number;
  localPath: string;
  prompt: string;
  referenceImages: string[];
  referenceMode: 'style' | 'zone_set_derived_object';
  styleRefsUsed: string[];
  quality: 'low' | 'medium' | 'high';
}): Promise<ZoneSheetCandidateResult> {
  const gen = await generateGPTImage({
    finalPrompt: input.prompt,
    negativePrompt: BUCKET_NEGATIVE,
    referenceImages: input.referenceImages,
    referenceMode: input.referenceMode,
    requireReferenceEdit: input.referenceImages.length > 0,
    size: '1024x1024',
    quality: input.quality,
    modelOverride: resolveStyle01GptModel(),
  });

  mkdirSync(dirname(input.localPath), { recursive: true });
  writeFileSync(input.localPath, gen.buffer);

  console.log(
    `[zone-sheet] ${input.zoneId} bucket candidate ${input.candidateIndex} → ${input.localPath} (${gen.durationMs}ms)`
  );

  return {
    kind: 'object',
    candidateIndex: input.candidateIndex,
    localPath: input.localPath,
    prompt: input.prompt,
    styleRefsUsed: input.styleRefsUsed,
    model: gen.model,
    durationMs: gen.durationMs,
  };
}

export async function generateBucketCandidatesFromSetReference(input: {
  storyKey: string;
  zoneId: string;
  bible: BookLocationBible;
  outDir: string;
  approvedSetPath: string;
  candidates?: number;
  quality?: 'low' | 'medium' | 'high';
  outputPrefix?: string;
}): Promise<ZoneSheetGenerationBundle> {
  const zone = resolveZoneById(input.bible, input.zoneId);
  if (!zone) throw new Error(`Unknown zone: ${input.zoneId}`);

  const approvedSetPath = input.approvedSetPath.trim();
  if (!approvedSetPath) throw new Error('approvedSetPath is required');
  if (!existsSync(approvedSetPath)) {
    throw new Error(`Approved set reference not found: ${approvedSetPath}`);
  }

  const candidatesPerArtifact = input.candidates ?? 3;
  const quality = input.quality ?? 'low';
  const prefix = input.outputPrefix ?? 'bucket-from-set';
  const prompt = buildObjectAnchorFromSetPrompt(zone, input.bible);
  const generatedAt = new Date().toISOString();
  const bundle: ZoneSheetGenerationBundle = {
    storyKey: input.storyKey,
    zoneId: input.zoneId,
    generatedAt,
    quality,
    candidatesPerArtifact,
    set: [],
    bucket: [],
    derivedFromSet: approvedSetPath,
  };

  mkdirSync(input.outDir, { recursive: true });

  for (let i = 1; i <= candidatesPerArtifact; i += 1) {
    const localPath = join(
      input.outDir,
      `${prefix}-candidate-${String(i).padStart(2, '0')}.png`
    );
    const result = await renderBucketCandidate({
      zoneId: input.zoneId,
      candidateIndex: i,
      localPath,
      prompt,
      referenceImages: [approvedSetPath],
      referenceMode: 'zone_set_derived_object',
      styleRefsUsed: [approvedSetPath],
      quality,
    });
    bundle.bucket.push(result);
  }

  writeFileSync(join(input.outDir, 'bucket-from-set-report.json'), JSON.stringify(bundle, null, 2));
  return bundle;
}

export async function generateZoneObjectSheetCandidates(input: {
  storyKey: string;
  zoneId: string;
  bible: BookLocationBible;
  outDir: string;
  candidatesPerArtifact?: number;
  quality?: 'low' | 'medium' | 'high';
}): Promise<ZoneSheetGenerationBundle> {
  const zone = resolveZoneById(input.bible, input.zoneId);
  if (!zone) throw new Error(`Unknown zone: ${input.zoneId}`);
  if (!zone.referenceSheet) {
    throw new Error(`Zone ${input.zoneId} has no referenceSheet declaration in location bible`);
  }

  const candidatesPerArtifact = input.candidatesPerArtifact ?? 3;
  const quality = input.quality ?? 'low';
  const styleRefs = resolveStyle01StyleReferencePaths('cozy-interior', 2);
  const generatedAt = new Date().toISOString();
  const bundle: ZoneSheetGenerationBundle = {
    storyKey: input.storyKey,
    zoneId: input.zoneId,
    generatedAt,
    quality,
    candidatesPerArtifact,
    set: [],
    bucket: [],
  };

  mkdirSync(input.outDir, { recursive: true });

  for (const kind of ['set', 'object'] as ZoneSheetArtifactKind[]) {
    const prompt = buildZoneSheetPrompt({ kind, zone, bible: input.bible });
    const prefix = kind === 'set' ? 'set' : 'bucket';

    for (let i = 1; i <= candidatesPerArtifact; i += 1) {
      const localPath = join(input.outDir, `${prefix}-candidate-${String(i).padStart(2, '0')}.png`);
      if (kind === 'object') {
        const result = await renderBucketCandidate({
          zoneId: input.zoneId,
          candidateIndex: i,
          localPath,
          prompt,
          referenceImages: styleRefs,
          referenceMode: 'style',
          styleRefsUsed: styleRefs,
          quality,
        });
        bundle.bucket.push(result);
        continue;
      }

      const gen = await generateGPTImage({
        finalPrompt: prompt,
        negativePrompt: BUCKET_NEGATIVE,
        referenceImages: styleRefs,
        referenceMode: 'style',
        requireReferenceEdit: styleRefs.length > 0,
        size: '1536x1536',
        quality,
        modelOverride: resolveStyle01GptModel(),
      });

      mkdirSync(dirname(localPath), { recursive: true });
      writeFileSync(localPath, gen.buffer);

      const result: ZoneSheetCandidateResult = {
        kind,
        candidateIndex: i,
        localPath,
        prompt,
        styleRefsUsed: styleRefs,
        model: gen.model,
        durationMs: gen.durationMs,
      };

      bundle.set.push(result);

      console.log(
        `[zone-sheet] ${input.zoneId} ${prefix} candidate ${i}/${candidatesPerArtifact} → ${localPath} (${gen.durationMs}ms)`
      );
    }
  }

  writeFileSync(join(input.outDir, 'report.json'), JSON.stringify(bundle, null, 2));
  return bundle;
}

function buildIsolatedBucketObjectPrompt(bible: BookLocationBible): string {
  const bucket = findFixedAnchor(bible, 'metal_bucket');
  return [
    STYLE_01_SHARED,
    STYLE_01_NO_TEXT,
    STYLE_01_ANTI_STYLE02,
    '',
    'ISOLATED OBJECT SHEET — GALVANIZED METAL BUCKET (character-sheet style):',
    ZERO_CHARACTERS_LOCK,
    '',
    'OBJECT ONLY on neutral warm cream paper background — like a companion character sheet.',
    'NO balcony, NO window, NO chair, NO railing, NO moon, NO plants, NO floor tiles, NO environment, NO scene.',
    bucket ? `BUCKET: ${bucket.description}` : '',
    '',
    'Small galvanized METAL household bucket with wire handle and dull silver texture.',
    'Child knee-height scale intent (small bucket, NOT basin, NOT tub, NOT oversized).',
    'Soft hand-drawn watercolor Style 01 — NOT photorealistic product photography.',
    'Single centered object, clean readable reference for identity only.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function generateIsolatedBucketObjectSheet(input: {
  storyKey: string;
  zoneId: string;
  bible: BookLocationBible;
  outPath: string;
  quality?: 'low' | 'medium' | 'high';
}): Promise<{ localPath: string; prompt: string; model: string; durationMs: number }> {
  const prompt = buildIsolatedBucketObjectPrompt(input.bible);
  const styleRefs = resolveStyle01StyleReferencePaths('cozy-interior', 1);
  const quality = input.quality ?? 'low';

  const gen = await generateGPTImage({
    finalPrompt: prompt,
    negativePrompt: [
      STYLE_01_AVOIDANCE_NEGATIVE,
      'balcony',
      'window',
      'chair',
      'railing',
      'moon',
      'plant',
      'environment',
      'scene',
      'photorealistic',
      'product photo',
      'plastic bucket',
      'blue bucket',
      'basin',
      'tub',
      'oversized',
    ].join(', '),
    referenceImages: styleRefs,
    referenceMode: 'style',
    requireReferenceEdit: styleRefs.length > 0,
    size: '1024x1024',
    quality,
    modelOverride: resolveStyle01GptModel(),
  });

  mkdirSync(dirname(input.outPath), { recursive: true });
  writeFileSync(input.outPath, gen.buffer);
  console.log(`[zone-sheet] isolated bucket-object → ${input.outPath} (${gen.durationMs}ms)`);
  return { localPath: input.outPath, prompt, model: gen.model, durationMs: gen.durationMs };
}

export type LionBedtimeObjectKind = 'pillow_cave' | 'blanket_fold';

const LION_OBJECT_ZERO_CHAR = `ZERO CHARACTERS — CRITICAL:
NO child. NO human. NO lion. NO creature. NO animal. NO silhouette figures.
If any character appears, the image is unusable.`;

const BLANKET_FOLD_NEGATIVE = [
  STYLE_01_AVOIDANCE_NEGATIVE,
  'lightning',
  'thunder bolt',
  'symbol',
  'glow',
  'portal',
  'magic',
  'magical',
  'artifact',
  'orb',
  'beam',
  'text',
  'letters',
  'hebrew',
  'special effect',
  'sparkle',
  'shimmer',
  'neon',
  'character',
  'human',
  'lion',
  'child',
].join(', ');

const PILLOW_CAVE_NEGATIVE = [
  STYLE_01_AVOIDANCE_NEGATIVE,
  'character',
  'human',
  'lion',
  'child',
  'bedroom scene',
  'full room',
  'lamp dominating',
  'text',
].join(', ');

function buildLionPillowCaveObjectPrompt(bible: BookLocationBible, variant: 'collapsed' | 'built' = 'collapsed'): string {
  const pillow = findFixedAnchor(bible, 'pillow_cave');
  const stateLine =
    variant === 'collapsed'
      ? 'Show COLLAPSED / SCATTERED pillow fort: 2–3 child-scale pillows tumbled on cream paper — one top pillow fallen sideways, fort FAILED (not a standing cave).'
      : 'Show a small built pillow fort with soft opening — optional second state.';
  return [
    STYLE_01_SHARED,
    STYLE_01_NO_TEXT,
    STYLE_01_ANTI_STYLE02,
    '',
    'ISOLATED OBJECT SHEET — PILLOW-CAVE FORT:',
    LION_OBJECT_ZERO_CHAR,
    '',
    'OBJECT ONLY on neutral warm cream paper background — like a companion character sheet.',
    'NO full bedroom, NO bed frame, NO child, NO lamp dominating frame, NO environment scene.',
    pillow ? `PILLOW CAVE: ${pillow.description}` : '',
    '',
    stateLine,
    'Child-scale soft pillows (not adult sofa cushions). Soft watercolor Style 01 storybook.',
    'Readable identity reference for the same pillow-cave object across pages.',
    'Single object group centered on cream paper.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildLionBlanketFoldObjectPrompt(bible: BookLocationBible): string {
  const fold = findFixedAnchor(bible, 'blanket_thunder_corner');
  return [
    STYLE_01_SHARED,
    STYLE_01_NO_TEXT,
    STYLE_01_ANTI_STYLE02,
    '',
    'ISOLATED OBJECT SHEET — BLANKET FOLD BY PILLOW (plain, NOT magical):',
    LION_OBJECT_ZERO_CHAR,
    '',
    'OBJECT ONLY on neutral warm cream paper background.',
    'NO full bedroom. NO child. NO lion. NO lamp. NO scene layout.',
    fold ? `FOLD: ${fold.description}` : '',
    '',
    'Show ONLY: a soft corner/fold of a child blanket beside a simple pillow edge hint.',
    'The fold is ORDINARY fabric — cozy quilt or soft blanket with a gentle crease.',
    'PLAIN blanket detail — emotionally named thunder corner in story but visually NOT special.',
    'HARD NEGATIVES: NO lightning bolt, NO thunder symbol, NO glow, NO portal, NO magic artifact, NO text.',
    'If it looks magical or like a special power object, the image is REJECTED.',
    'Soft watercolor Style 01. Single close object study on cream paper.',
  ]
    .filter(Boolean)
    .join('\n');
}

export type LionBedtimeObjectCandidate = {
  kind: LionBedtimeObjectKind;
  candidateIndex: number;
  localPath: string;
  prompt: string;
  model: string;
  durationMs: number;
};

export async function generateLionBedtimeObjectCandidates(input: {
  bible: BookLocationBible;
  outDir: string;
  candidates?: number;
  quality?: 'low' | 'medium' | 'high';
  pillowVariant?: 'collapsed' | 'built';
  objects?: 'both' | 'pillow' | 'fold';
}): Promise<{
  generatedAt: string;
  quality: 'low' | 'medium' | 'high';
  candidatesPerObject: number;
  pillowCave: LionBedtimeObjectCandidate[];
  blanketFold: LionBedtimeObjectCandidate[];
}> {
  const candidatesPerObject = input.candidates ?? 3;
  const quality = input.quality ?? 'low';
  const pillowVariant = input.pillowVariant ?? 'collapsed';
  const objects = input.objects ?? 'both';
  const styleRefs = resolveStyle01StyleReferencePaths('cozy-interior', 2);
  const generatedAt = new Date().toISOString();
  const pillowCave: LionBedtimeObjectCandidate[] = [];
  const blanketFold: LionBedtimeObjectCandidate[] = [];

  mkdirSync(input.outDir, { recursive: true });

  for (let i = 1; i <= candidatesPerObject; i += 1) {
    if (objects === 'both' || objects === 'pillow') {
      const pillowPath = join(input.outDir, `pillow-cave-candidate-${String(i).padStart(2, '0')}.png`);
      const pillowPrompt = buildLionPillowCaveObjectPrompt(input.bible, pillowVariant);
      const pillowGen = await generateGPTImage({
        finalPrompt: pillowPrompt,
        negativePrompt: PILLOW_CAVE_NEGATIVE,
        referenceImages: styleRefs,
        referenceMode: 'style',
        requireReferenceEdit: styleRefs.length > 0,
        size: '1024x1024',
        quality,
        modelOverride: resolveStyle01GptModel(),
      });
      writeFileSync(pillowPath, pillowGen.buffer);
      pillowCave.push({
        kind: 'pillow_cave',
        candidateIndex: i,
        localPath: pillowPath,
        prompt: pillowPrompt,
        model: pillowGen.model,
        durationMs: pillowGen.durationMs,
      });
      console.log(`[lion-object] pillow-cave (${pillowVariant}) candidate ${i} → ${pillowPath} (${pillowGen.durationMs}ms)`);
    }

    if (objects === 'both' || objects === 'fold') {
      const foldPath = join(input.outDir, `blanket-fold-candidate-${String(i).padStart(2, '0')}.png`);
      const foldPrompt = buildLionBlanketFoldObjectPrompt(input.bible);
      const foldGen = await generateGPTImage({
        finalPrompt: foldPrompt,
        negativePrompt: BLANKET_FOLD_NEGATIVE,
        referenceImages: styleRefs,
        referenceMode: 'style',
        requireReferenceEdit: styleRefs.length > 0,
        size: '1024x1024',
        quality,
        modelOverride: resolveStyle01GptModel(),
      });
      writeFileSync(foldPath, foldGen.buffer);
      blanketFold.push({
        kind: 'blanket_fold',
        candidateIndex: i,
        localPath: foldPath,
        prompt: foldPrompt,
        model: foldGen.model,
        durationMs: foldGen.durationMs,
      });
      console.log(`[lion-object] blanket-fold candidate ${i} → ${foldPath} (${foldGen.durationMs}ms)`);
    }
  }

  const report = { generatedAt, quality, candidatesPerObject, pillowCave, blanketFold };
  writeFileSync(join(input.outDir, 'report.json'), JSON.stringify(report, null, 2));
  return report;
}
