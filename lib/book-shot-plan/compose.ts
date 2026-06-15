import type { Style01CompositionSpec } from '../style01-gptimage';

type EnricherPageLayout =
  | 'full_bleed_soft'
  | 'vignette_breath'
  | 'asymmetric_split'
  | 'letter'
  | 'cover';
import type { PageShot, ShotType } from './types';

export class OverShoulderGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OverShoulderGuardError';
  }
}

/** OTS is manual-only — throw when used on forbidden pages. */
export function assertOverShoulderAllowed(shot: PageShot): void {
  if (shot.angle !== 'over_shoulder') return;
  if (shot.page === 1) {
    throw new OverShoulderGuardError('over_shoulder forbidden on page 1');
  }
  if (shot.shot === 'close_up') {
    throw new OverShoulderGuardError('over_shoulder forbidden on close_up');
  }
  if (shot.shot === 'intimate') {
    throw new OverShoulderGuardError('over_shoulder forbidden on intimate emotional peak');
  }
}

export function pageShotFramingFamily(shot: PageShot): string {
  if (shot.angle === 'over_shoulder') return 'over_shoulder';
  return shot.shot;
}

export function formatPageShotFramingSummary(shot: PageShot): string {
  const angle = shot.angle ?? 'eye';
  const family = pageShotFramingFamily(shot);
  const spec = shotPlanToCompositionSpec(shot);
  const scaleLine =
    spec.frameHeightPercent != null
      ? `characters ${spec.frameHeightPercent}%`
      : spec.subjectScale === 'small'
        ? 'characters 15–25%, environment dominates'
        : spec.subjectScale === 'large'
          ? 'characters 65–80%, close-up crop'
          : 'characters 35–50%, balanced scene';
  return [
    `p${shot.page} — ${shot.shot} / ${angle}`,
    `camera: ${spec.camera}`,
    `scale: ${scaleLine}`,
    `framing family: ${family}`,
  ].join('\n');
}

/** Map BookShotPlan slot → Style 01 COMPOSITION block spec (B1 shot-aware). */
export function shotPlanToCompositionSpec(shot: PageShot): Style01CompositionSpec {
  assertOverShoulderAllowed(shot);
  const angle = shot.angle ?? 'eye';

  if (angle === 'over_shoulder') {
    return {
      shotType: 'over_the_shoulder',
      subjectScale: 'medium',
      frameHeightPercent: '35-45',
      framingFamily: 'over_shoulder',
      camera:
        'over-the-shoulder from behind the child shoulder — focal subject and story object ahead in mid-ground',
      subjectDominance:
        'foreground shoulder/back-of-head cue; nurse/companion/object on focal plane ahead',
      staging:
        'OTS framing — partial child silhouette in near foreground; what is being looked at reads clearly ahead',
      pagePurpose: 'Procedure / discovery beat — OTS readability (manual override only)',
    };
  }

  switch (shot.shot) {
    case 'establishing_wide':
      return {
        shotType: 'wide establishing',
        subjectScale: 'small',
        frameHeightPercent: '15-25',
        framingFamily: 'establishing_wide',
        camera: `wide environmental ${angle} angle — full setting visible end-to-end`,
        subjectDominance:
          'environment dominates and leads; child and companion embedded small in the world',
        staging:
          'Full place visible: room depth, floor, walls, ceiling/sky, entry points, and important props; characters not dominating',
        pagePurpose: 'Establish place and relationship',
        allowSmallChildForEstablishing: true,
      };
    case 'medium_wide':
      return {
        shotType: 'medium-wide establishing',
        subjectScale: 'small',
        frameHeightPercent: '20-30',
        framingFamily: 'medium_wide',
        camera: `medium-wide ${angle} angle — environment shares frame with characters`,
        subjectDominance: 'Balanced setting and characters; room context visible',
        staging: 'Characters in setting with clear spatial context and breathing room',
        pagePurpose: 'Story beat with environmental readability',
        allowSmallChildForEstablishing: true,
      };
    case 'medium':
      return {
        shotType: 'medium story beat',
        subjectScale: 'medium',
        frameHeightPercent: '35-50',
        framingFamily: 'medium',
        camera: `medium shot, ${angle} level`,
        subjectDominance: 'Balanced character and environment — full figures readable',
        staging: 'Action embedded in setting — objects and companions legible',
        pagePurpose: 'Quiet transition or story advancement',
      };
    case 'intimate':
      return {
        shotType: 'intimate story beat',
        subjectScale: 'medium',
        framingFamily: 'intimate',
        camera: 'medium framing on emotional focus — surroundings still visible',
        subjectDominance:
          'Child + companion share frame; intimacy without blank portrait crop',
        staging: 'Cozy shared moment; ceiling/walls/depth remain visible',
        pagePurpose: 'Emotional beat',
      };
    case 'close_up':
      return {
        shotType: 'close_up',
        subjectScale: 'large',
        frameHeightPercent: '65-80',
        framingFamily: 'close_up',
        camera:
          'TRUE CLOSE-UP — face + hands + emotional object/gesture fill the frame; crop at face/shoulders/hands',
        subjectDominance:
          'Face + hands + meaningful gesture/object dominate; minimal contextual background only',
        staging:
          'Tight crop — do NOT show full body or full room; identity cues (face, hair, outfit) clearly visible',
        pagePurpose: 'Emotional peak — quiet truth beat',
      };
    case 'dynamic_angle':
      return {
        shotType: 'dynamic action beat',
        subjectScale: 'medium',
        framingFamily: 'dynamic_angle',
        camera:
          angle === 'low'
            ? 'Camera placed near floor/chair height, looking slightly upward at the action — playful heroic energy'
            : angle === 'high'
              ? 'high angle — comic movement in environment'
              : 'dynamic angle — movement and staging in full scene',
        subjectDominance:
          angle === 'low'
            ? 'Acting character playfully heroic from below; action energy clear with natural anatomy'
            : 'Action energy with environment context',
        staging:
          angle === 'low'
            ? 'Foreground shows floor tiles / chair legs / low furniture edges; child looks upward toward the action'
            : 'Comedy/action staging — motion in full scene context',
        pagePurpose: 'Action/comedy beat',
      };
    default:
      return {
        shotType: 'medium story beat',
        subjectScale: 'medium',
        framingFamily: 'medium',
        camera: 'medium shot, eye-level',
        subjectDominance: 'Balanced character and environment',
        staging: 'Action embedded in setting',
        pagePurpose: 'Advance story moment',
      };
  }
}

/**
 * Shot-aware FRAMING RULE block — wins over static STYLE_01_FRAMING_RULE when PageShot is set.
 * PageShot composition > shot-aware house rules > general Style01 safety rules.
 */
export function buildShotAwareFramingRule(shot: PageShot): string {
  assertOverShoulderAllowed(shot);
  const angle = shot.angle ?? 'eye';

  if (angle === 'over_shoulder') {
    return [
      'FRAMING RULE — over_shoulder (manual override):',
      '- Over-the-shoulder from behind the child shoulder — focal subject/object ahead.',
      '- Foreground: child shoulder/hair/back-of-head cue visible.',
      '- Focal plane: name what is being looked at (nurse, thermometer, companion, object).',
      '- Child face may be partial — identity survives via hair/outfit/shoulder cue.',
      '- Do NOT use for identity-critical face-reading pages.',
    ].join('\n');
  }

  switch (shot.shot) {
    case 'establishing_wide':
      return [
        'FRAMING RULE — establishing_wide:',
        '- CHARACTER SCALE: small — child and companion approx 15–25% of frame height.',
        '- The environment dominates and leads the image.',
        '- Full place visible: room depth, floor, walls, ceiling/sky, entry points, important props.',
        '- Characters embedded in the world, not dominating it.',
        '- Child recognizable for identity continuity: face/hair/outfit cues visible, preferably frontal or 3/4 — not anonymous silhouette.',
      ].join('\n');
    case 'close_up':
      return [
        'FRAMING RULE — close_up:',
        '- TRUE CLOSE-UP: face + hands + emotional object/gesture fill the frame.',
        '- Main child/subject occupies approx 65–80% of frame height.',
        '- Do NOT show full body.',
        '- Do NOT include the full room; only minimal contextual background allowed.',
        '- Crop at face / shoulders / hands.',
        '- Meaningful gesture/object must be visible.',
        '- Identity clear: same face, hair, age, skin, outfit cues where visible.',
      ].join('\n');
    case 'intimate':
      return [
        'FRAMING RULE — intimate:',
        '- Intimate, emotionally close scene, but not a blank portrait.',
        '- Show enough surrounding context to read the story moment.',
        '- Avoid giant isolated face-only portraits.',
        '- Child and companion share frame; environment still breathes.',
      ].join('\n');
    case 'dynamic_angle':
      if (angle === 'low') {
        return [
          'FRAMING RULE — dynamic_angle (low):',
          '- Camera placed near floor/chair height, looking slightly upward at the action.',
          '- Foreground shows floor tiles / chair legs / low furniture edges.',
          '- Acting character appears playfully heroic from below.',
          '- Child looks upward or toward the action.',
          '- Action energy clear; anatomy remains natural.',
          '- Medium-wide storybook scene — environment still visible.',
        ].join('\n');
      }
      return [
        'FRAMING RULE — dynamic_angle:',
        '- Dynamic action staging in full scene context.',
        '- Characters fill NO MORE than 35–50% of frame height unless action demands closer staging.',
        '- Environment visible; avoid tight portrait crops.',
      ].join('\n');
    case 'medium_wide':
    case 'medium':
    default:
      return [
        'FRAMING RULE — BREATHE (medium):',
        '- Medium-wide storybook scene; environment visible; child and companion mostly full-figure.',
        '- Characters fill NO MORE than 35–50% of frame height.',
        '- Environment must occupy meaningful visible area.',
        '- Avoid tight portrait crops.',
        '- For medium-wide: characters in lower third or off-center when setting allows.',
      ].join('\n');
  }
}

/** Layout enricher COMPOSITION RULES — shot-aware; suppresses conflicting 35–50% / AVOID TIGHT CROPS on wide/close. */
export function buildShotAwareEnricherCompositionRules(
  shot: PageShot,
  layout: EnricherPageLayout,
  wordCount: number
): string {
  assertOverShoulderAllowed(shot);
  const density =
    wordCount > 45
      ? 'Use simplified composition with strong silhouettes — keep it readable.'
      : 'Composition can include rich detail, varied textures, painterly nuance.';

  const bleedBase = [
    'COMPOSITION RULES:',
    '- TRUE full-bleed illustration filling the ENTIRE frame edge-to-edge. Aspect 4:5 vertical.',
    '- Paint EVERY area of the canvas fully, including the bottom — do NOT leave any region quiet, blurred, empty, faded, or dissolving into paper.',
    '- Keep the main face/focal subject out of the very bottom ~15% strip (mobile overlays caption text there), but still PAINT that strip fully.',
    `- ${density}`,
    '- PALETTE: soft, muted, gentle watercolor tones on warm cream paper.',
  ];

  if (layout === 'cover') {
    return [
      'COMPOSITION RULES:',
      '- Full-page bleed. Aspect 4:5 vertical.',
      '- Hero composition: child and companion together, warmth, intrigue.',
      '- Reserve TOP 25% for title overlay — soft sky/light/gradient area.',
    ].join('\n');
  }

  if (layout === 'vignette_breath') {
    return [
      'COMPOSITION RULES:',
      '- Centered VIGNETTE composition. Aspect 1:1 square.',
      '- Image occupies inner 65% of canvas. Edges fade to soft cream/paper-tone.',
      '- ONE primary focal element. Painterly soft edges.',
    ].join('\n');
  }

  const family = pageShotFramingFamily(shot);
  if (family === 'establishing_wide' || family === 'medium_wide') {
    return [
      ...bleedBase,
      '- CHARACTER SCALE: small — child and companion approx 15–25% of frame height.',
      '- Environment dominates and leads; full setting visible.',
      '- Characters embedded in the world — not portrait close-ups.',
    ].join('\n');
  }
  if (family === 'close_up') {
    return [
      ...bleedBase,
      '- TRUE CLOSE-UP: face + hands + gesture/object fill the frame (65–80% frame height).',
      '- Do NOT show full body or full room — minimal contextual background only.',
      '- Crop at face / shoulders / hands.',
    ].join('\n');
  }
  if (family === 'intimate') {
    return [
      ...bleedBase,
      '- Intimate emotional framing — enough context to read the beat; avoid giant isolated face-only portraits.',
    ].join('\n');
  }
  if (family === 'over_shoulder') {
    return [
      ...bleedBase,
      '- Over-the-shoulder: foreground shoulder/back-of-head; focal subject ahead.',
    ].join('\n');
  }
  if (family === 'dynamic_angle' && shot.angle === 'low') {
    return [
      ...bleedBase,
      '- Low camera near floor/chair height, looking slightly upward.',
      '- Foreground floor tiles / chair legs / low furniture edges visible.',
    ].join('\n');
  }

  return [
    ...bleedBase,
    '- CHARACTER SIZE: main character roughly 35–50% of the frame.',
    '- ENVIRONMENT VISIBLE: show the world around the character with depth and props.',
    '- AVOID TIGHT CROPS unless storyboard specifies close_up.',
    '- Characters live within fully-painted illustrated worlds, not as portrait close-ups.',
  ].join('\n');
}

/** @deprecated Use buildShotAwareFramingRule — kept for callers checking close/intimate pages. */
export function pageShotUsesRelaxedBreathe(shot: PageShot | undefined): boolean {
  return shot?.shot === 'close_up' || shot?.shot === 'intimate';
}

export function resolveStyle01FramingRuleForPageShot(
  shot: PageShot | undefined
): string | undefined {
  if (!shot) return undefined;
  return buildShotAwareFramingRule(shot);
}
