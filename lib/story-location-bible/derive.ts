import { resolveScenarioSettingLock } from '../scenario-setting-lock';
import type { PageBeatInput } from '../book-shot-plan/types';
import type { BookLocationBible, LocationContinuityMode, PageLocationPlan } from './types';

const NIGHT_FEAR_FORBIDDEN = [
  'forest',
  'stream',
  'river',
  'pond',
  'bridge',
  'rooftop',
  'cliff',
  'village overlook',
  'unrelated outdoor landscape',
  'open water body',
];

function inferContinuityMode(
  direction: string | null | undefined,
  category: string | null | undefined
): LocationContinuityMode {
  const dir = (direction ?? '').toLowerCase();
  const cat = (category ?? '').toUpperCase();
  if (dir === 'fantasy') return 'fantasy_world';
  if (cat === 'NIGHT_FEAR' || cat === 'MEDICAL_PROCEDURE') return 'location_cluster';
  if (dir === 'bedtime') return 'single_location';
  return 'location_cluster';
}

/** Deterministic fallback when no story-specific bible exists. */
export function deriveBookLocationBible(args: {
  challengeCategory: string | null | undefined;
  storyWorldOverride?: string | null;
  direction?: string | null;
  pages: PageBeatInput[];
}): BookLocationBible {
  const scenarioSeed =
    resolveScenarioSettingLock(args.challengeCategory, {
      storyWorldOverride: args.storyWorldOverride,
    }) ?? 'Consistent story-world setting across all pages.';

  const cat = args.challengeCategory?.trim().toUpperCase() ?? '';
  const forbiddenDrift =
    cat === 'NIGHT_FEAR'
      ? [
          ...NIGHT_FEAR_FORBIDDEN,
          'new bedroom design every page',
          'bucket under bed unless story text explicitly says so',
          'high dangerous balcony',
        ]
      : ['unrelated location redesign between pages', 'new room every page'];

  const fixedAnchors =
    cat === 'NIGHT_FEAR'
      ? [
          {
            id: 'child_bedroom',
            label: 'child bedroom',
            description: 'Same child bedroom at night with bed, window, curtains, warm lamp glow',
            mustRemainSameAcrossPages: true,
          },
          {
            id: 'home_night',
            label: 'home night mood',
            description: 'Same moonlit home-night atmosphere — warm indoor light and soft outdoor moonlight',
            mustRemainSameAcrossPages: true,
          },
        ]
      : [];

  return {
    continuityMode: inferContinuityMode(args.direction, args.challengeCategory),
    primarySetting: scenarioSeed,
    allowedZones: [
      {
        id: 'story_default',
        description: scenarioSeed,
        stableGeometry: ['Keep the same spatial relationships implied by the story beats'],
        visualAnchors: fixedAnchors.map((a) => a.description),
        allowedCameraAccess: ['eye level', 'medium wide', 'close detail on story objects'],
      },
    ],
    fixedAnchors,
    forbiddenDrift,
    transitionRules: [
      'Camera may move; the physical set must not redesign between pages.',
      'Only change zone when the story text clearly moves to another part of the same world.',
    ],
    source: 'derived',
    pageCount: args.pages.length,
  };
}

/** Map beats to a single default zone when no authored page plans exist. */
export function derivePageLocationPlans(
  bible: BookLocationBible,
  pages: PageBeatInput[]
): PageLocationPlan[] {
  const zone = bible.allowedZones[0]?.id ?? 'story_default';
  const zoneDef = bible.allowedZones.find((z) => z.id === zone);
  const anchors = zoneDef?.visualAnchors ?? bible.fixedAnchors.map((a) => a.description);
  const forbidden = bible.forbiddenDrift.slice(0, 8);

  return pages.map((p) => ({
    page: p.page,
    zoneId: zone,
    visibleAnchors: anchors.slice(0, 6),
    allowedVariation:
      'Camera may move closer or wider per PageShot; object identity and spatial relationships remain stable.',
    forbiddenDrift: forbidden,
  }));
}
