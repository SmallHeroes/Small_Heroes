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
  PageCastState,
  VisualLocation,
  EnvironmentClass,
} from './types';
import type {
  StoryLocationPlanBundle,
  BookLocationBible,
  LocationZone,
  FixedAnchor,
  PageLocationPlan,
  LocationContinuityMode,
  SetTopology,
  SetTopologyElement,
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
    // (WS0b P1-2c / Slice B) STILL EMPTY here. VisualZone.stableGeometry authoring now exists (Slice B), but this
    // adapter output feeds scene-memory's stableFactsFromZoneGeometry (seed.ts), which FLATTENS every zone's geometry
    // into ONE book-wide SCENE MEMORY LOCK emitted on EVERY page (the P1-2 leak). Its per-page fix lives in
    // lib/scene-memory/* + lib/story-location-bible/compose.ts — OUTSIDE Slice B's allowed files. So authored zone
    // geometry is instead steered PER-PAGE through the authoritative CONTRACT PROMPT BLOCK
    // (buildVisualContractPromptBlock → each page emits only its OWN resolved zone's geometry — no cross-zone leak),
    // and this projection stays [] so the scene-memory path is byte/behavior-identical. Un-emptying it belongs with the
    // scene-memory per-page fix (a follow-up once that file set is in scope).
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

/** (Slice B) The laterality clause for a cast member — injection/bandage arm + which hand holds the parent's hand. */
function lateralityPhrase(cs: PageCastState): string | null {
  const bits: string[] = [];
  if (cs.injectionArm) bits.push(`the injection is on the ${cs.injectionArm} arm`);
  if (cs.bandageArm) bits.push(`the bandage is on the ${cs.bandageArm} arm`);
  if (cs.freeHand) bits.push(`holding the parent's hand with the ${cs.freeHand} hand`);
  return bits.length ? bits.join(', ') : null;
}

/**
 * (Slice B) Compose the MANDATORY page-action line from the page's per-(page,castId) body-state + laterality and its
 * prop-state transitions. General (never book-specific): a page with none of these yields '' → the caller omits the
 * pageAction key → buildPageActionPromptBlock returns null → byte-identical off-path.
 */
function composePageAction(
  pc: PageVisualContract,
  propNameById?: Map<string, string>,
  castLabelById?: Map<string, string>,
): string {
  const parts: string[] = [];
  for (const cs of pc.castStates ?? []) {
    const label = castLabelById?.get(cs.castId) ?? cs.castId;
    if (cs.bodyState?.trim()) parts.push(`${label} ${cs.bodyState.trim()}`);
    const lat = lateralityPhrase(cs);
    if (lat) parts.push(`${label} — ${lat}`);
  }
  for (const ps of pc.propState ?? []) {
    const name = propNameById?.get(ps.propId) ?? ps.propId;
    if (ps.state?.trim()) parts.push(`${name}: ${ps.state.trim()}`);
  }
  return parts.join('; ');
}

function toPageLocationPlan(
  pc: PageVisualContract,
  propNameById?: Map<string, string>,
  castLabelById?: Map<string, string>,
): PageLocationPlan {
  // (Slice B) Promote per-(page,castId) body-state/laterality + prop-state transitions into the MANDATORY page action.
  // Empty → the pageAction key is omitted → buildPageActionPromptBlock returns null → byte-identical off-path.
  const pageAction = composePageAction(pc, propNameById, castLabelById);
  return {
    page: pc.pageNumber,
    zoneId: pc.zoneId ?? '',
    // The contract's mustShow are the page's visible anchors; mustNotShow are its forbidden-drift guards.
    visibleAnchors: pc.mustShow ?? [],
    allowedVariation: '',
    forbiddenDrift: pc.mustNotShow ?? [],
    // A page's camera is the ONLY dimension imageDirection may influence — carried as the position hint.
    ...(pc.camera ? { cameraPositionHint: pc.camera } : {}),
    // (WS0b P1-1) Project the page's OWN transition so the consumer emits per-page continuity — NOT the whole book's
    // future-transition list on every page. Absent → no per-page transition line.
    ...(pc.transition ? { transition: pc.transition } : {}),
    ...(pageAction ? { pageAction } : {}),
  };
}

/**
 * Project the single-room SET TOPOLOGY LOCK geometry — ONLY for a genuine ONE-ROOM book: exactly one location AND
 * exactly one zone (the lock means "same room every page" + "no unlisted props"). (WS0b P1-2) A one-location but
 * MULTI-zone story (e.g. waiting_room → exam_room) must NOT get it: "same room" contradicts the zone change and "no
 * unlisted props" would ban the destination zone's furniture. Multi-zone per-page geometry rides on the zone's own
 * `description` instead. Elements come from the location's anchors + its freeform topology as a `layout` element.
 * Neutral (undefined) when the room has neither → fabricate nothing (matches the adapter's unknown→neutral rule).
 */
function setTopologyOf(contract: BookVisualContract): SetTopology | undefined {
  if (contract.locations.length !== 1 || contract.zones.length !== 1) return undefined;
  const loc = contract.locations[0];
  const elements: SetTopologyElement[] = (loc.anchors ?? []).map((a) => ({ id: a.id, placement: a.description }));
  if (loc.topology?.trim()) elements.push({ id: 'layout', placement: loc.topology.trim() });
  if (!elements.length) return undefined;
  const timeOfDay = loc.timeOfDay ?? contract.coverContract.timeOfDay;
  const forbidden = contract.forbiddenGlobalElements ?? [];
  return {
    elements,
    ...(timeOfDay ? { timeOfDay } : {}),
    ...(forbidden.length ? { forbidden } : {}),
  };
}

/**
 * The page-0 (cover) location plan, projected from the contract's coverContract, so resolvePageLocationPlan(bundle,
 * 0) returns THIS directly instead of synthesizing a legacy page-1-derived cover (which appended a story-specific
 * "home-night" anchor). zoneId is the cover location's first declared zone so the plan stays inside allowedZones.
 * `contractCover: true` (WS0b A2b) marks this as the contract's cover authority — its forbiddenDrift (from
 * coverContract.mustNotShow) carries the cover's no-spoiler intent, so the consumer suppresses the legacy
 * hardcoded COVER_MYSTERY_LOCK for it. Render-qualified contracts carry an explicit cover zone; the first-zone
 * fallback remains only for enforcement-off legacy contracts.
 */
function coverPageLocationPlan(contract: BookVisualContract): PageLocationPlan {
  const cover = contract.coverContract;
  const coverZone = cover.zoneId
    ? contract.zones.find((z) => z.id === cover.zoneId && z.locationId === cover.locationId)
    : contract.zones.find((z) => z.locationId === cover.locationId) ?? contract.zones[0];
  return {
    page: 0,
    zoneId: coverZone?.id ?? '',
    visibleAnchors: cover.mustShow ?? [],
    allowedVariation: '',
    forbiddenDrift: cover.mustNotShow ?? [],
    contractCover: true,
  };
}

/** The STORY WORLD header — one location's name, or all names spanned (journey → arrows, cluster → commas). */
function primarySettingOf(contract: BookVisualContract, mode: LocationContinuityMode): string {
  const names = contract.locations.map((l) => l.name).filter((n) => n && n.trim());
  if (names.length === 0) return contract.worldType;
  if (names.length === 1) return names[0];
  return names.join(mode === 'journey' ? ' → ' : ', ');
}

/**
 * Project the contract into a StoryLocationPlanBundle (the shape buildLocationContinuityPromptBlock / scene-memory
 * consume). Core continuity fields PLUS the contract's full spatial authority: per-page transition rules, a
 * single-room SET TOPOLOGY LOCK derived from location topology (the ONLY topology-derived spatial lock; per-zone
 * `stableGeometry` is intentionally empty per P1-2c — zone geometry rides on `zone.description`), a multi-location
 * STORY WORLD header, and an explicit page-0 cover plan from coverContract. Unknown → neutral (never fabricated). `source` is
 * `derived`. (Consumed only under VISUAL_CONTRACT_STEERING — inert/byte-identical when off.)
 */
export function contractToLocationPlanBundle(contract: BookVisualContract): StoryLocationPlanBundle {
  const anchorsFor = anchorsByLocation(contract);
  const mode = continuityModeOf(contract);
  const setTopology = setTopologyOf(contract);
  const bible: BookLocationBible = {
    continuityMode: mode,
    primarySetting: primarySettingOf(contract, mode),
    allowedZones: contract.zones.map((z) => toLocationZone(z, anchorsFor)),
    fixedAnchors: toFixedAnchors(contract.locations),
    forbiddenDrift: contract.forbiddenGlobalElements ?? [],
    // (WS0b P1-1) Contract books drive continuity PER-PAGE (PageLocationPlan.transition) — no global future-transition
    // list leaks onto every page. Legacy books still populate + emit their own bible.transitionRules.
    transitionRules: [],
    source: 'derived',
    pageCount: contract.pageContracts.length,
    ...(setTopology ? { setTopology } : {}),
  };
  // (Slice B) Prop NAME + cast LABEL lookups so the composed pageAction reads naturally (not raw ids).
  const propNameById = new Map(contract.recurringProps.map((p) => [p.id, p.name]));
  const castLabelById = new Map(contractToCastRegistry(contract).map((e) => [e.id, e.name ?? e.role]));
  // Page 0 (cover) FIRST → resolvePageLocationPlan(bundle, 0) returns the contract's cover authority instead of the
  // legacy "home-night" synthesis. Real pages follow, unchanged.
  const pagePlans = [
    coverPageLocationPlan(contract),
    ...contract.pageContracts.map((pc) => toPageLocationPlan(pc, propNameById, castLabelById)),
  ];
  return { bible, pagePlans };
}

/**
 * (WS0b e4a) The coarse environment class (`indoor|outdoor|neutral`) the contract LOCKS for a page — from the
 * page's location. Drives style-ref routing "locks-first, regex-last": when present it overrides the regex
 * scene-class, and `neutral` means ZERO style refs (never a nature default). Returns null when the page (or its
 * location's environmentClass) is not in the contract → the caller falls back to the legacy regex classifier.
 *
 * (WS0b location authority) Page 0 = the COVER, which has NO entry in pageContracts (those are the story pages
 * 1..N); its location authority lives in coverContract. Resolving page 0 from coverContract.locationId closes the
 * pageContracts-only gap that otherwise leaked the cover to the regex classifier (→ outdoor-nature for a clinic book).
 */
export function contractPageEnvironmentClass(
  contract: BookVisualContract,
  pageNumber: number,
): EnvironmentClass | null {
  const locationId =
    pageNumber === 0
      ? contract.coverContract.locationId
      : contract.pageContracts.find((p) => p.pageNumber === pageNumber)?.locationId;
  if (!locationId) return null;
  const loc = contract.locations.find((l) => l.id === locationId);
  return loc?.environmentClass ?? null;
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

/** A supporting-character descriptor for the render's page.supportingCharacters channel (image.ts consumer). */
export interface ContractSupportingCharacter {
  name: string;
  relationship: string;
  description: string;
}

/** Compose a single prompt description from a human cast entry — gender + role + appearance + wardrobe + drift guards. */
function composeHumanDescription(e: ContractCastRegistryEntry): string {
  const parts: string[] = [];
  const genderPrefix = e.gender && e.gender !== 'unspecified' ? `${e.gender} ` : '';
  parts.push(`${genderPrefix}${e.role}`.trim());
  if (e.description) parts.push(e.description); // coarse appearance lock
  if (e.wardrobe) parts.push(`wearing ${e.wardrobe}`);
  if (e.forbiddenAppearance.length > 0) parts.push(`must never appear: ${e.forbiddenAppearance.join(', ')}`);
  return parts.join('; ');
}

/**
 * (WS0b e4b) The recurring HUMAN cast PRESENT on a page, as render `supportingCharacters` — the doctor-flip /
 * mom-wardrobe fix. Each entry's `description` carries the FROZEN gender + coarse appearance + wardrobe + drift
 * guards, so the contract OUTRANKS a vague imageDirection at render. Child/companion are excluded (the pipeline
 * already handles them). Empty when no human is on the page. Order-stable.
 */
export function contractPageSupportingCharacters(
  contract: BookVisualContract,
  pageNumber: number,
): ContractSupportingCharacter[] {
  return contractToCastRegistry(contract)
    .filter((e) => e.kind === 'human' && e.pagesPresent.includes(pageNumber))
    .map((e) => ({
      name: e.name ?? e.role,
      relationship: e.role,
      description: composeHumanDescription(e),
    }));
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

// ─────────────────────────────────────────────────────────────────────────────
// 4. contract → per-page WORLD-QA expectation (GATE-DRIVING — Slice A)
// ─────────────────────────────────────────────────────────────────────────────

/** The frozen setting + recurring-object identities a page must honor, for the delivered-bytes WORLD QA. */
export interface ContractPageWorldExpectation {
  /** The page's expected setting — the zone's description (else its location's). */
  zoneDescription: string;
  /** Every recurring prop with its LOCKED identity (label + design). */
  objects: Array<{ label: string; identity: string }>;
  /** Settings/scenes the page must NOT be (the contract's forbidden global elements). */
  forbiddenScenes: string[];
}

/**
 * (Slice A) Project the page's frozen WORLD expectation for the post-render gate (lib/generation-pipeline/
 * page-world-qa). UNLIKE contractToQaObservability above — which is carried ALONGSIDE the gate and can never
 * change a decision — THIS is gate-driving: the delivered-verdict producer runs page-world-qa against it and a
 * hard drift (wrong_zone / recurring-object identity redesign / forbidden_scene) fails the durable verdict.
 *
 * General, never book-specific. `objects` is the FULL recurring-prop set with each prop's locked identity: an
 * out-of-frame prop is not a failure (page-world-qa fails only a VISIBLE, redesigned prop), so passing them all
 * is safe and catches an exam-chair-style identity drift regardless of per-page propState. `forbiddenScenes` are
 * the contract's forbidden global elements — page-world-qa fails only if the page's SETTING matches one, so
 * element-level entries stay inert.
 *
 * Returns null (→ no world QA, neutral) when the page is absent from the contract or has no describable setting —
 * the same unknown→neutral rule as the other adapters, so a contract-less / steering-off render is byte-identical.
 */
export function contractPageWorldExpectation(
  contract: BookVisualContract,
  pageNumber: number,
): ContractPageWorldExpectation | null {
  const pc = contract.pageContracts.find((p) => p.pageNumber === pageNumber);
  if (!pc) return null;
  const loc = contract.locations.find((l) => l.id === pc.locationId);
  const zone = pc.zoneId ? contract.zones.find((z) => z.id === pc.zoneId) : undefined;
  const zoneDescription = (zone?.description ?? loc?.description ?? loc?.name ?? '').trim();
  if (!zoneDescription) return null; // no describable setting → no world QA (neutral)
  const objects = (contract.recurringProps ?? []).map((p) => ({ label: p.name, identity: p.description }));
  const forbiddenScenes = contract.forbiddenGlobalElements ?? [];
  return { zoneDescription, objects, forbiddenScenes };
}
