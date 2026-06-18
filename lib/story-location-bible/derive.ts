import { resolveScenarioSettingLock } from '../scenario-setting-lock';
import type { PageBeatInput } from '../book-shot-plan/types';
import type {
  BookLocationBible,
  LocationContinuityMode,
  LocationZone,
  PageLocationPlan,
  SceneGraph,
} from './types';

const DERIVED_ALLOWED_VARIATION =
  'Camera may move closer or wider per PageShot; object identity and spatial relationships remain stable.';

/** Scene-Graph → allowedZones. One zone per scene node (single source of truth). */
export function deriveZonesFromSceneGraph(sceneGraph: SceneGraph): LocationZone[] {
  return sceneGraph.scenes.map((scene) => ({
    id: scene.id,
    description: scene.description,
    stableGeometry: [],
    visualAnchors: scene.visualAnchors ?? [],
    allowedCameraAccess: [],
  }));
}

function sceneGraphPageCount(sceneGraph: SceneGraph, pageCount?: number): number {
  if (Number.isFinite(pageCount) && (pageCount as number) > 0) return pageCount as number;
  const scenePages = sceneGraph.scenes.flatMap((s) => s.pages ?? []);
  const objectPages = sceneGraph.recurringObjects.flatMap((o) =>
    o.stateTimeline.map((s) => s.page)
  );
  return Math.max(0, ...scenePages, ...objectPages);
}

/**
 * Scene-Graph → pagePlans. Each page maps to the scene whose `pages` covers it. By default EVERY
 * page (1..total) must be covered — an uncovered page THROWS (no silent carry-forward). Set
 * `sceneGraph.allowCarryForward = true` to intentionally let a gap inherit the previous scene.
 * pageAction is intentionally left undefined — the per-page action comes from the story's
 * imageDirection, and recurring-object state is injected by the RECURRING OBJECT LOCK block.
 */
export function derivePagePlansFromSceneGraph(
  sceneGraph: SceneGraph,
  pageCount?: number
): PageLocationPlan[] {
  if (!sceneGraph.scenes.length) return [];
  const total = sceneGraphPageCount(sceneGraph, pageCount);
  if (total <= 0) return [];

  const pageToScene = new Map<number, (typeof sceneGraph.scenes)[number]>();
  for (const scene of sceneGraph.scenes) {
    for (const page of scene.pages ?? []) pageToScene.set(page, scene);
  }

  const allowCarryForward = sceneGraph.allowCarryForward === true;
  if (!allowCarryForward) {
    const missing: number[] = [];
    for (let page = 1; page <= total; page++) {
      if (!pageToScene.has(page)) missing.push(page);
    }
    if (missing.length) {
      throw new Error(
        `SceneGraph page coverage gap: page(s) ${missing.join(', ')} of ${total} map to no scene. ` +
          `Add them to a scene's "pages", or set sceneGraph.allowCarryForward=true to inherit the previous scene.`
      );
    }
  }

  const forbiddenDrift = sceneGraph.forbiddenDrift ?? [];
  const plans: PageLocationPlan[] = [];
  let lastScene = sceneGraph.scenes[0];
  for (let page = 1; page <= total; page++) {
    const scene = pageToScene.get(page) ?? lastScene;
    lastScene = scene;
    plans.push({
      page,
      zoneId: scene.id,
      visibleAnchors: scene.visualAnchors ?? [],
      allowedVariation: DERIVED_ALLOWED_VARIATION,
      forbiddenDrift,
    });
  }
  return plans;
}

export type SceneGraphValidationIssue = { code: string; detail: string };

/**
 * SceneGraph QA — deterministic structural hard-signal over the bible (the world-lock analogue of
 * entity-QA, at plan level). Validates: every page maps to a scene (unless allowCarryForward); every
 * recurringObject references real scenes; whole_scene objects declare appearsInScenes; explicit_pages
 * objects declare appearsOnPages; stateTimeline/appearsOnPages pages are within range. Returns all
 * issues (empty = pass). The post-render VISION version (true Phase D) is a separate follow-up.
 */
export function validateSceneGraph(
  sceneGraph: SceneGraph | undefined,
  pageCount?: number
): SceneGraphValidationIssue[] {
  const issues: SceneGraphValidationIssue[] = [];
  if (!sceneGraph) return issues;

  const sceneIds = new Set(sceneGraph.scenes.map((s) => s.id));
  const total = sceneGraphPageCount(sceneGraph, pageCount);

  if (!sceneGraph.allowCarryForward && total > 0) {
    const covered = new Set<number>();
    for (const s of sceneGraph.scenes) for (const p of s.pages ?? []) covered.add(p);
    const missing: number[] = [];
    for (let p = 1; p <= total; p++) if (!covered.has(p)) missing.push(p);
    if (missing.length) {
      issues.push({ code: 'page_coverage_gap', detail: `pages ${missing.join(', ')} map to no scene` });
    }
  }

  for (const s of sceneGraph.scenes) {
    for (const p of s.pages ?? []) {
      if (total > 0 && (p < 1 || p > total)) {
        issues.push({ code: 'scene_page_out_of_range', detail: `scene ${s.id} page ${p} > ${total}` });
      }
    }
  }

  for (const o of sceneGraph.recurringObjects) {
    const policy = o.presencePolicy ?? 'timeline_only';
    for (const sceneId of o.appearsInScenes ?? []) {
      if (!sceneIds.has(sceneId)) {
        issues.push({ code: 'object_unknown_scene', detail: `${o.id} → unknown scene "${sceneId}"` });
      }
    }
    if (policy === 'whole_scene' && !o.appearsInScenes?.length) {
      issues.push({ code: 'whole_scene_no_scenes', detail: `${o.id} is whole_scene but has no appearsInScenes` });
    }
    if (policy === 'explicit_pages' && !o.appearsOnPages?.length) {
      issues.push({ code: 'explicit_pages_no_pages', detail: `${o.id} is explicit_pages but has no appearsOnPages` });
    }
    for (const p of [...o.stateTimeline.map((t) => t.page), ...(o.appearsOnPages ?? [])]) {
      if (total > 0 && (p < 1 || p > total)) {
        issues.push({ code: 'object_page_out_of_range', detail: `${o.id} page ${p} > ${total}` });
      }
    }
  }

  return issues;
}

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
