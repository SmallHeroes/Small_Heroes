import type { BookShotPlan } from '../book-shot-plan/types';
import type {
  BookLocationBible,
  PageLocationPlan,
  StoryLocationPlanBundle,
} from '../story-location-bible/types';
import {
  deriveFactKind,
  isStateBearingFactId,
  normalizeObservedState,
} from './fact-compare';
import type {
  SceneMemory,
  SceneMemoryObservedState,
  SceneMemoryPlan,
  SceneMemorySceneType,
  SceneMemorySeedSource,
  SceneMemoryStatefulObject,
} from './types';

const STATE_KEYWORDS =
  /\b(collapsed|scattered|built|dimmed|dimming|fold|folded|fallen|tent|fort)\b/i;

function deriveSceneType(bible: BookLocationBible): SceneMemorySceneType {
  const mode = bible.continuityMode?.toLowerCase() ?? '';
  if (mode.includes('journey') || mode.includes('travel')) return 'journey_leg';
  if (mode.includes('exterior') || mode.includes('outdoor')) return 'fixed_exterior';
  if (mode.includes('abstract')) return 'abstract';
  return 'fixed_interior';
}

function deriveSceneId(bible: BookLocationBible): string {
  const zoneId = bible.allowedZones[0]?.id?.trim() || 'scene';
  const time =
    bible.setTopology?.timeOfDay?.trim().toLowerCase().replace(/\s+/g, '_') || 'unspecified';
  const type = deriveSceneType(bible);
  return `${type}_${zoneId}_${time}`.replace(/[^a-z0-9_]+/gi, '_');
}

function pickSeedSource(
  bible: BookLocationBible,
  bookShotPlan: BookShotPlan | null | undefined
): SceneMemorySeedSource {
  const hasWide =
    bookShotPlan?.pages.some(
      (p) => p.shot === 'establishing_wide' || p.shot === 'medium_wide'
    ) ?? false;
  if (bible.setTopology?.elements?.length) return 'authored_seed';
  if (hasWide) return 'approved_wide_page';
  return 'authored_seed';
}

function withFactKind(
  factId: string,
  fact: Omit<SceneMemory['stableFacts'][string], 'factKind'>
): SceneMemory['stableFacts'][string] {
  return { ...fact, factKind: deriveFactKind(factId) };
}

function stableFactsFromTopology(bible: BookLocationBible): SceneMemory['stableFacts'] {
  const topo = bible.setTopology;
  if (!topo?.elements?.length) return {};

  const facts: SceneMemory['stableFacts'] = {};
  for (const el of topo.elements) {
    const id = el.id.trim();
    if (!id) continue;
    facts[id] = withFactKind(id, {
      position: el.placement.trim(),
      appearance: el.zone?.trim(),
      color: el.colorLock?.trim(),
      confidence: 0.85,
      lockLevel: 'soft',
      provenance: ['authored_seed'],
    });
  }
  if (topo.walls) {
    facts.walls = withFactKind('walls', {
      position: topo.walls,
      confidence: 0.85,
      lockLevel: 'soft',
      provenance: ['authored_seed'],
    });
  }
  if (topo.floor) {
    facts.floor = withFactKind('floor', {
      position: topo.floor,
      confidence: 0.85,
      lockLevel: 'soft',
      provenance: ['authored_seed'],
    });
  }
  return facts;
}

/**
 * Scene-Graph recurring objects → book-wide stable facts. Used only for SINGLE-scene books
 * (one fixed room): the objects live in that one room every page, so asserting them as a
 * book-wide set is correct and desirable. Each object's identity becomes one stable fact.
 *
 * Only WHOLE-STORY objects (those declaring appearsInScenes) are seeded; an object that
 * appears partway through (stateTimeline only, e.g. a note drawn on page 6, a thunder-corner
 * made on page 6) must NOT be asserted as "always present" — the per-page RECURRING OBJECT
 * LOCK governs it on exactly the pages it exists.
 */
function stableFactsFromSceneGraph(bible: BookLocationBible): SceneMemory['stableFacts'] {
  const recurring = bible.sceneGraph?.recurringObjects ?? [];
  const facts: SceneMemory['stableFacts'] = {};
  for (const obj of recurring) {
    const id = obj.id.trim();
    if (!id || facts[id]) continue;
    if (!obj.appearsInScenes?.length) continue;
    facts[id] = withFactKind(id, {
      position: obj.identity.trim(),
      confidence: 0.8,
      lockLevel: 'soft',
      provenance: ['authored_seed'],
    });
  }
  return facts;
}

/**
 * A MULTI-scene scene-graph (journey) book has no single fixed set: its recurring objects
 * appear in some scenes and are absent from others. Continuity for them is governed per-page
 * by the scene-aware RECURRING OBJECT LOCK, NOT by a book-wide scene-memory set — which would
 * wrongly assert e.g. the color gate as "must remain" on the real-world pages where it is
 * forbidden. A SINGLE-scene book (one room) is a genuine fixed set and is NOT suppressed.
 */
function isSceneGraphJourneyBook(bible: BookLocationBible): boolean {
  return (
    Boolean(bible.sceneGraph?.recurringObjects?.length) &&
    (bible.sceneGraph?.scenes?.length ?? 0) > 1 &&
    !bible.setTopology?.elements?.length
  );
}

function stableFactsFromZoneGeometry(bible: BookLocationBible): SceneMemory['stableFacts'] {
  const facts: SceneMemory['stableFacts'] = {};
  for (const zone of bible.allowedZones) {
    for (const line of zone.stableGeometry ?? []) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const id = trimmed.split(/\s+/).slice(0, 2).join('_').toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (!facts[id]) {
        facts[id] = withFactKind(id, {
          position: trimmed,
          confidence: 0.7,
          lockLevel: 'open',
          provenance: ['authored_seed'],
        });
      }
    }
  }
  return facts;
}

function factIdMentionedInText(factId: string, text: string): boolean {
  const idNorm = factId.toLowerCase().replace(/[+]/g, ' ').replace(/-/g, ' ');
  const hay = text.toLowerCase();
  const tokens = idNorm.split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return false;
  if (hay.includes(idNorm)) return true;
  if (hay.includes(factId.toLowerCase())) return true;
  return tokens.every((t) => hay.includes(t));
}

function extractStateForFact(factId: string, action: string): SceneMemoryObservedState | null {
  const actionLower = action.toLowerCase();
  const idVariants = [
    factId.toLowerCase(),
    factId.toLowerCase().replace(/[+]/g, ' ').replace(/-/g, ' '),
  ];

  for (const variant of idVariants) {
    const idx = actionLower.indexOf(variant);
    if (idx === -1) continue;

    const prefix = actionLower.slice(Math.max(0, idx - 20), idx);
    const prefixMatch = prefix.match(
      /(?:^|\s)(collapsed|scattered|built|dimmed|dimming|folded|fallen|tent|fort)\s*$/i
    );
    if (prefixMatch) return normalizeObservedState(prefixMatch[1]);

    const forward = actionLower.slice(idx, idx + variant.length + 40);
    const forwardMatch = forward.match(STATE_KEYWORDS);
    if (forwardMatch) return normalizeObservedState(forwardMatch[0]);

    return null;
  }

  return null;
}

function extractStatefulObjects(
  pagePlans: PageLocationPlan[],
  stableFactIds: string[]
): Record<string, SceneMemoryStatefulObject> {
  const stateBearingIds = stableFactIds.filter(isStateBearingFactId);
  const out: Record<string, SceneMemoryStatefulObject> = {};

  for (const factId of stateBearingIds) {
    out[factId] = { identity: factId, timeline: [] };
  }

  for (const plan of pagePlans) {
    const action = plan.pageAction?.trim() ?? '';
    if (!action) continue;

    for (const factId of stateBearingIds) {
      const state = extractStateForFact(factId, action);
      if (!state || state === 'unchanged' || state === 'ambiguous') continue;

      const exists = out[factId].timeline.some((t) => t.page === plan.page);
      if (!exists) {
        out[factId].timeline.push({ page: plan.page, state, authorizedBy: 'story' });
      }
    }
  }

  for (const factId of stateBearingIds) {
    if (out[factId].timeline.length === 0) delete out[factId];
  }

  return out;
}

export function seedSceneMemoryPlan(args: {
  storyLocationPlan: StoryLocationPlanBundle;
  bookShotPlan?: BookShotPlan | null;
}): SceneMemoryPlan | null {
  const bible = args.storyLocationPlan.bible;

  // Journey scene-graph books: recurring objects are locked per-page/scene by the
  // RECURRING OBJECT LOCK block, so we do not also build a contradictory book-wide set.
  if (isSceneGraphJourneyBook(bible)) return null;

  const seedSource = pickSeedSource(bible, args.bookShotPlan ?? null);

  const fromTopology = stableFactsFromTopology(bible);
  const fromSceneGraph = stableFactsFromSceneGraph(bible);
  const stableFacts =
    Object.keys(fromTopology).length > 0
      ? fromTopology
      : Object.keys(fromSceneGraph).length > 0
        ? fromSceneGraph
        : stableFactsFromZoneGeometry(bible);

  if (!Object.keys(stableFacts).length && bible.continuityMode !== 'single_location') {
    return null;
  }

  const stableFactIds = Object.keys(stableFacts);
  const statefulObjects = extractStatefulObjects(args.storyLocationPlan.pagePlans, stableFactIds);

  const inventory = [...stableFactIds];

  const forbiddenChanges = [
    ...(bible.setTopology?.forbidden ?? []),
    ...bible.forbiddenDrift,
    ...(bible.sceneGraph?.forbiddenDrift ?? []),
    ...(bible.sceneGraph?.recurringObjects ?? []).flatMap((o) => o.forbiddenDrift ?? []),
    'props not listed in scene inventory',
    'relocating fixed furniture without story authorization',
  ];

  const allowedChanges = [
    ...bible.transitionRules,
    'camera distance and framing per BookShot',
    'state changes explicitly authorized in pageAction / story text',
  ];

  const memory: SceneMemory = {
    sceneId: deriveSceneId(bible),
    sceneType: deriveSceneType(bible),
    seedSource,
    stableFacts,
    statefulObjects,
    unknowns: [],
    allowedChanges,
    forbiddenChanges,
    inventory,
  };

  return { memory };
}
