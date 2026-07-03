/**
 * Contract projection adapters (WS0b commit c) — BUILT + available, NOT wired.
 *
 * The frozen BookVisualContract is the single source of truth; the pipeline's existing consumers
 * (location continuity / scene-memory / character injection / per-page QA) keep their shapes and are, in a
 * later slice (WS0b(e) steering, behind VISUAL_CONTRACT_STEERING, default OFF), fed by THESE projections. In
 * WS0b(c) the adapters are pure functions with unit tests; NOTHING calls them on the render path, so render
 * output is byte-identical to today.
 *
 * General, never book-specific. A page/zone the contract does not describe projects to a NEUTRAL, empty value
 * (never a fabricated default) — matching the contract layer's "unknown → neutral, never nature-default" rule.
 */
import type {
  BookVisualContract,
  PageVisualContract,
  VisualLocation,
} from './types';
import type {
  StoryLocationPlanBundle,
  BookLocationBible,
  LocationZone,
  FixedAnchor,
  PageLocationPlan,
  LocationContinuityMode,
} from '@/lib/story-location-bible/types';

// ─────────────────────────────────────────────────────────────────────────────
// 1. contract → StoryLocationPlanBundle
// ─────────────────────────────────────────────────────────────────────────────

function continuityModeOf(contract: BookVisualContract): LocationContinuityMode {
  const n = contract.locations.length;
  if (n <= 1) return 'single_location';
  // A declared before/threshold/after transition between zones of DIFFERENT locations reads as a journey.
  const hasCrossLocationMove = contract.pageContracts.some((p) => p.transition && p.transition.kind !== 'steady');
  return hasCrossLocationMove ? 'journey' : 'location_cluster';
}

/** locationId → the location's anchor descriptions (stable visual anchors reused across its pages). */
function anchorsByLocation(contract: BookVisualContract): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const loc of contract.locations) {
    m.set(loc.id, (loc.anchors ?? []).map((a) => a.description));
  }
  return m;
}

function toLocationZone(
  zone: BookVisualContract['zones'][number],
  anchorsFor: Map<string, string[]>,
): LocationZone {
  return {
    id: zone.id,
    description: zone.description,
    stableGeometry: [],
    visualAnchors: anchorsFor.get(zone.locationId) ?? [],
    allowedCameraAccess: zone.shot ? [zone.shot] : [],
  };
}

function toFixedAnchors(locations: VisualLocation[]): FixedAnchor[] {
  return locations.flatMap((loc) =>
    (loc.anchors ?? []).map((a) => ({
      id: a.id,
      label: a.id,
      description: a.description,
      mustRemainSameAcrossPages: true,
    })),
  );
}

function toPageLocationPlan(pc: PageVisualContract): PageLocationPlan {
  return {
    page: pc.pageNumber,
    zoneId: pc.zoneId ?? '',
    // The contract's mustShow are the page's visible anchors; mustNotShow are its forbidden-drift guards.
    visibleAnchors: pc.mustShow ?? [],
    allowedVariation: '',
    forbiddenDrift: pc.mustNotShow ?? [],
    // A page's camera is the ONLY dimension imageDirection may influence — carried as the position hint.
    ...(pc.camera ? { cameraPositionHint: pc.camera } : {}),
  };
}

/**
 * Project the contract into a StoryLocationPlanBundle (the shape buildLocationContinuityPromptBlock / scene-memory
 * consume). Conservative: core continuity fields are mapped faithfully; advanced optional layers (sceneGraph,
 * setTopology composition, reference sheets) are intentionally left unset for WS0b(e) to fill against the real
 * consumers. `source` is `derived` (the bible-source union has no contract-specific value in WS0b).
 */
export function contractToLocationPlanBundle(contract: BookVisualContract): StoryLocationPlanBundle {
  const anchorsFor = anchorsByLocation(contract);
  const bible: BookLocationBible = {
    continuityMode: continuityModeOf(contract),
    primarySetting: contract.locations[0]?.name || contract.worldType,
    allowedZones: contract.zones.map((z) => toLocationZone(z, anchorsFor)),
    fixedAnchors: toFixedAnchors(contract.locations),
    forbiddenDrift: contract.forbiddenGlobalElements ?? [],
    transitionRules: [],
    source: 'derived',
    pageCount: contract.pageContracts.length,
  };
  const pagePlans = contract.pageContracts.map(toPageLocationPlan);
  return { bible, pagePlans };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. contract → Character Registry (recurring human cast, stable ids)
// ─────────────────────────────────────────────────────────────────────────────

export type ContractCastKind = 'child' | 'companion' | 'human';

/** A stable-id cast entry projected from the contract — the input WS0b(e) turns into supportingCharacters. */
export interface ContractCastRegistryEntry {
  id: string;
  kind: ContractCastKind;
  role: string;
  name?: string;
  /** Coarse appearance lock (human) or the cast member's wardrobe (child/companion). */
  description: string;
  wardrobe: string;
  forbiddenAppearance: string[];
  gender?: 'male' | 'female' | 'unspecified';
  /** Other phrases the story uses for this member — the detection tokens (humanCast aliases; else the name). */
  aliases: string[];
  /** Page numbers this member appears on (derived from characterPresence / humanCast.pagesPresent). */
  pagesPresent: number[];
}

function pagesWithPresence(contract: BookVisualContract, who: 'child' | 'companion'): number[] {
  return contract.pageContracts
    .filter((p) => p.characterPresence?.[who])
    .map((p) => p.pageNumber);
}

/**
 * Project the recurring cast (child + optional companion + every recurring human) into stable-id registry
 * entries. Deterministic + order-stable. An empty humanCast (many stories) → just child (+ companion).
 */
export function contractToCastRegistry(contract: BookVisualContract): ContractCastRegistryEntry[] {
  const entries: ContractCastRegistryEntry[] = [];
  const child = contract.cast.child;
  entries.push({
    id: child.id,
    kind: 'child',
    role: 'child',
    ...(child.name ? { name: child.name } : {}),
    description: child.wardrobe.description,
    wardrobe: child.wardrobe.description,
    forbiddenAppearance: child.wardrobe.forbidden ?? [],
    aliases: child.name ? [child.name] : [],
    pagesPresent: pagesWithPresence(contract, 'child'),
  });
  const companion = contract.cast.companion;
  if (companion) {
    entries.push({
      id: companion.id,
      kind: 'companion',
      role: 'companion',
      ...(companion.name ? { name: companion.name } : {}),
      description: companion.wardrobe.description,
      wardrobe: companion.wardrobe.description,
      forbiddenAppearance: companion.wardrobe.forbidden ?? [],
      aliases: companion.name ? [companion.name] : [],
      pagesPresent: pagesWithPresence(contract, 'companion'),
    });
  }
  for (const human of contract.humanCast ?? []) {
    entries.push({
      id: human.id,
      kind: 'human',
      role: human.role,
      description: human.coarseAppearance,
      wardrobe: human.wardrobe.description,
      forbiddenAppearance: human.forbiddenAppearance ?? [],
      gender: human.gender,
      // The story's phrases for this person are the detection tokens (e.g. "הרופא", "the doctor").
      aliases: [...human.aliases],
      pagesPresent: [...human.pagesPresent],
    });
  }
  return entries;
}

/** A detection-registry entry (CharacterAnchorRecord-shaped subset) — text lock only, no anchor image. */
export interface HumanCastDetectionEntry {
  name: string;
  description: string;
  relationship: string;
  aliases: string[];
}

/**
 * The recurring HUMAN cast as detection-registry entries keyed by stable id (e.g. `human:doctor`). Consumed as an
 * EPHEMERAL augment `{ ...anchorRegistry, ...entries }` for per-page character detection ONLY — never merged into
 * the persisted anchorRegistry (which flows to Order.characterAnchors). Child/companion are omitted (the pipeline
 * already registers them). Detection matches on `[name, ...aliases]`, so both carry the story's phrases.
 */
export function contractToHumanCastDetectionEntries(
  contract: BookVisualContract,
): Record<string, HumanCastDetectionEntry> {
  const out: Record<string, HumanCastDetectionEntry> = {};
  for (const e of contractToCastRegistry(contract)) {
    if (e.kind !== 'human') continue;
    out[e.id] = {
      name: e.name ?? e.role,
      description: e.description,
      relationship: e.role,
      aliases: e.aliases,
    };
  }
  return out;
}

/** The stable cast ids expected present on a page — the contract's per-page castIds, else child/companion presence. */
export function expectedCastIdsForPage(contract: BookVisualContract, pageNumber: number): string[] {
  const pc = contract.pageContracts.find((p) => p.pageNumber === pageNumber);
  if (!pc) return [];
  if (pc.castIds && pc.castIds.length > 0) return [...pc.castIds];
  const ids: string[] = [];
  if (pc.characterPresence?.child) ids.push(contract.cast.child.id);
  if (pc.characterPresence?.companion && contract.cast.companion) ids.push(contract.cast.companion.id);
  return ids;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. contract → per-page QA observability (contractHash + pageContract + check ids + cast expectations)
// ─────────────────────────────────────────────────────────────────────────────

export interface FrozenCastExpectation {
  id: string;
  role: string;
  kind: ContractCastKind;
}

/**
 * Observability-only per-page QA projection. Carried ALONGSIDE the gate-driving QaContext (never merged into it),
 * so it can never change a gate decision — it records what a WS1 location/cast check WOULD verify for this page.
 */
export interface ContractQaObservability {
  contractHash: string | null;
  pageContract: PageVisualContract | null;
  /** Namespaced ids of the checks this page implies (location/zone/transition/cast/prop) — for logging/telemetry. */
  requiredCheckIds: string[];
  frozenCastExpectations: FrozenCastExpectation[];
}

function requiredCheckIdsFor(pc: PageVisualContract): string[] {
  const ids: string[] = [`location:${pc.locationId}`];
  if (pc.zoneId) ids.push(`zone:${pc.zoneId}`);
  ids.push(`transition:${pc.transition?.kind ?? 'steady'}`);
  for (const id of pc.castIds ?? []) ids.push(`cast:${id}`);
  for (const ps of pc.propState ?? []) ids.push(`prop:${ps.propId}`);
  return ids;
}

export function contractToQaObservability(
  contract: BookVisualContract,
  pageNumber: number,
  contractHash: string | null,
): ContractQaObservability {
  const pc = contract.pageContracts.find((p) => p.pageNumber === pageNumber) ?? null;
  if (!pc) {
    return { contractHash, pageContract: null, requiredCheckIds: [], frozenCastExpectations: [] };
  }
  const registryById = new Map(contractToCastRegistry(contract).map((e) => [e.id, e]));
  const frozenCastExpectations: FrozenCastExpectation[] = expectedCastIdsForPage(contract, pageNumber)
    .map((id) => registryById.get(id))
    .filter((e): e is ContractCastRegistryEntry => e != null)
    .map((e) => ({ id: e.id, role: e.role, kind: e.kind }));
  return {
    contractHash,
    pageContract: pc,
    requiredCheckIds: requiredCheckIdsFor(pc),
    frozenCastExpectations,
  };
}
