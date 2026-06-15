import type { PageShot } from '../book-shot-plan/types';
import type { SceneMemory, SceneMemoryObservedState, SceneMemoryStableFact } from './types';

const COMPOSITION_ONLY = new Set(['background', 'foreground', 'top', 'bottom']);

const WEAK_POSITION_TOKENS = new Set([
  'center',
  'foreground',
  'background',
  'bottom',
  'top',
  'middle',
]);

const COLLAPSED_ACCEPTABLE: SceneMemoryObservedState[] = [
  'collapsed',
  'scattered',
  'loose_pile',
  'nest',
];

const STATE_SYNONYMS: Record<SceneMemoryObservedState, SceneMemoryObservedState[]> = {
  standing_canopy: ['standing_canopy', 'built_or_tent'],
  built_or_tent: ['standing_canopy', 'built_or_tent'],
  loose_pile: ['loose_pile', 'nest', 'collapsed', 'scattered'],
  nest: ['nest', 'loose_pile', 'collapsed', 'scattered'],
  collapsed: ['collapsed', 'scattered', 'loose_pile', 'nest'],
  scattered: ['scattered', 'collapsed', 'loose_pile', 'nest'],
  folded: ['folded'],
  dimmed: ['dimmed'],
  unchanged: ['unchanged'],
  not_visible: ['not_visible'],
  ambiguous: ['ambiguous'],
};

export function deriveFactKind(factId: string): SceneMemoryStableFact['factKind'] {
  const id = factId.toLowerCase();
  if (id === 'walls' || id === 'floor') return 'appearance';
  if (/pillow|blanket|lamp/.test(id)) return 'stateful';
  return 'position';
}

export function isStateBearingFactId(factId: string): boolean {
  return deriveFactKind(factId) === 'stateful';
}

/** Primary fort-form fact — only this id carries cave/tent/canopy state drift. */
export function isFortFormPrimaryFact(factId: string): boolean {
  const id = factId.toLowerCase();
  return /cave|fort/.test(id);
}

export function isPillowAggregateFact(factId: string): boolean {
  const id = factId.toLowerCase();
  return /pillow/.test(id) && !/cave|fort/.test(id);
}

export function isBlanketFact(factId: string): boolean {
  return factId.toLowerCase().includes('blanket');
}

export function isLampFact(factId: string): boolean {
  return factId.toLowerCase().includes('lamp');
}

export function isFixedPositionFact(factId: string): boolean {
  return deriveFactKind(factId) === 'position';
}

export function normalizeObservedState(raw: string | undefined | null): SceneMemoryObservedState {
  const s = (raw ?? '').toLowerCase().trim();
  if (!s) return 'ambiguous';
  if (/loose.?pile|^pile$|heap|nest/.test(s)) return 'loose_pile';
  if (/standing.?canopy|canopy|tunnel|roof|roofed/.test(s)) return 'standing_canopy';
  if (/built_or_tent|built|tent|fort|standing/.test(s)) return 'standing_canopy';
  if (/collapsed|fallen/.test(s)) return 'collapsed';
  if (/scattered/.test(s)) return 'scattered';
  if (/fold/.test(s)) return 'folded';
  if (/dim/.test(s)) return 'dimmed';
  if (/not.?visible|occluded|cropped/.test(s)) return 'not_visible';
  if (/unchanged|same/.test(s)) return 'unchanged';
  if (/ambiguous|uncertain|unknown/.test(s)) return 'ambiguous';
  return 'ambiguous';
}

export function isStandingCanopy(state: SceneMemoryObservedState): boolean {
  return state === 'standing_canopy' || state === 'built_or_tent';
}

export function isAcceptableCollapsedPile(state: SceneMemoryObservedState): boolean {
  return COLLAPSED_ACCEPTABLE.includes(state);
}

export function fortFormStateIsDrift(
  expected: SceneMemoryObservedState,
  observed: SceneMemoryObservedState
): boolean {
  if (observed === 'ambiguous' || observed === 'not_visible') return false;
  if (isStandingCanopy(observed)) {
    return isAcceptableCollapsedPile(expected) || expected === 'collapsed' || expected === 'scattered';
  }
  if (isAcceptableCollapsedPile(observed)) {
    return !(isAcceptableCollapsedPile(expected) || expected === 'unchanged');
  }
  return !statesCompatible(expected, observed);
}

export function statesCompatible(
  expected: SceneMemoryObservedState,
  observed: SceneMemoryObservedState
): boolean {
  if (observed === 'ambiguous' || observed === 'not_visible') return false;
  if (
    isStandingCanopy(observed) &&
    (isAcceptableCollapsedPile(expected) || expected === 'collapsed' || expected === 'scattered')
  ) {
    return false;
  }
  if (expected === observed) return true;
  const allowed = STATE_SYNONYMS[expected] ?? [expected];
  return allowed.includes(observed);
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function extractPositionBuckets(text: string): Set<string> {
  const n = normalizeText(text);
  const buckets = new Set<string>();
  if (/back-left|upper-left/.test(n)) buckets.add('back-left');
  if (/back-right|upper-right|top-right/.test(n)) buckets.add('back-right');
  if (/\bleft\b/.test(n)) buckets.add('left');
  if (/\bright\b/.test(n)) buckets.add('right');
  if (/center|middle|between/.test(n)) buckets.add('center');
  if (/foreground/.test(n)) buckets.add('foreground');
  if (/background/.test(n)) buckets.add('background');
  return buckets;
}

export function isCompositionOnlyPosition(observed: string | undefined): boolean {
  if (!observed) return false;
  const n = normalizeText(observed);
  return COMPOSITION_ONLY.has(n) || (n.split(/\s+/).length === 1 && COMPOSITION_ONLY.has(n));
}

export function isWeakPositionToken(position: string | undefined): boolean {
  if (!position) return true;
  const n = normalizeText(position);
  if (isCompositionOnlyPosition(n)) return true;
  return WEAK_POSITION_TOKENS.has(n);
}

export function shouldDegradeFixedPositionToUnknown(args: {
  factId: string;
  expectedFact: SceneMemoryStableFact;
  observed?: { position?: string; confidence: number; visibility: string };
  pageShot?: PageShot | null;
}): boolean {
  if (!isFixedPositionFact(args.factId)) return false;
  const observed = args.observed;
  if (!observed?.position) return false;

  const closeFraming =
    args.pageShot?.shot === 'close_up' || args.pageShot?.shot === 'intimate';

  if (closeFraming && isWeakPositionToken(observed.position)) return true;
  if (closeFraming && !positionsCompatible(args.expectedFact.position, observed.position)) return true;

  if (
    isWeakPositionToken(observed.position) &&
    !positionsCompatible(args.expectedFact.position, observed.position)
  ) {
    return true;
  }

  if (
    observed.confidence < 0.7 &&
    !positionsCompatible(args.expectedFact.position, observed.position)
  ) {
    return true;
  }

  return false;
}

export function positionsCompatible(expected: string, observed: string): boolean {
  const o = normalizeText(observed);
  if (!o || isCompositionOnlyPosition(o)) return false;

  const eBuckets = extractPositionBuckets(expected);
  const oBuckets = extractPositionBuckets(observed);

  for (const b of oBuckets) {
    if (eBuckets.has(b)) return true;
  }

  if (oBuckets.has('right') && (eBuckets.has('right') || eBuckets.has('back-right') || eBuckets.has('center'))) {
    return true;
  }
  if (oBuckets.has('left') && (eBuckets.has('left') || eBuckets.has('back-left') || eBuckets.has('center'))) {
    return true;
  }
  if (oBuckets.has('center') && eBuckets.has('center')) return true;
  if (oBuckets.has('back-right') && eBuckets.has('right')) return true;
  if (oBuckets.has('back-left') && eBuckets.has('left')) return true;

  return false;
}

const PALETTE_HINTS = [
  'blue',
  'purple',
  'mustard',
  'yellow',
  'cream',
  'white',
  'gold',
  'coral',
  'sand',
  'beige',
  'grey',
  'gray',
];

export function isWithinLockedPalette(
  expectedColor: string | undefined,
  observedColor: string | undefined
): boolean {
  if (!expectedColor || !observedColor) return false;
  const e = normalizeText(expectedColor);
  const o = normalizeText(observedColor);
  const allowed = PALETTE_HINTS.filter((h) => e.includes(h));
  if (!allowed.length) return false;
  return allowed.some((h) => o.includes(h));
}

export function appearanceCompatible(expected: SceneMemoryStableFact, observed: {
  appearance?: string;
  color?: string;
  position?: string;
}): boolean | 'unknown' {
  const expectedAppearance = normalizeText(
    [expected.color, expected.appearance, expected.position].filter(Boolean).join(' ')
  );
  const observedAppearance = normalizeText(
    [observed.color, observed.appearance].filter(Boolean).join(' ')
  );

  if (observedAppearance) {
    const warmNeutrals = ['cream', 'beige', 'tan', 'warm', 'sand', 'off-white'];
    const eWarm = warmNeutrals.some((w) => expectedAppearance.includes(w));
    const oWarm = warmNeutrals.some((w) => observedAppearance.includes(w));
    if (eWarm && oWarm) return true;

    const woodTokens = ['wood', 'wooden', 'brown', 'plank'];
    const eWood = woodTokens.some((w) => expectedAppearance.includes(w));
    const oWood = woodTokens.some((w) => observedAppearance.includes(w));
    if (eWood && oWood) return true;

    if (isWithinLockedPalette(expected.color, observed.color ?? observed.appearance)) return true;

    if (expectedAppearance.includes(observedAppearance) || observedAppearance.includes(expectedAppearance)) {
      return true;
    }
    const eTokens = expectedAppearance.split(/[\s,.;]+/).filter((t) => t.length > 3);
    const oTokens = observedAppearance.split(/[\s,.;]+/).filter((t) => t.length > 3);
    const overlap = eTokens.filter((t) => oTokens.some((o) => o.includes(t) || t.includes(o)));
    if (overlap.length > 0) return true;
    return false;
  }

  if (isCompositionOnlyPosition(observed.position)) return 'unknown';
  return 'unknown';
}

export function getExpectedStateForPage(
  memory: SceneMemory,
  factId: string,
  page: number
): SceneMemoryObservedState {
  const obj = memory.statefulObjects[factId];
  if (!obj?.timeline.length) return 'unchanged';

  const exact = obj.timeline.find((t) => t.page === page);
  if (exact) return exact.state;

  const prior = [...obj.timeline].filter((t) => t.page < page).sort((a, b) => b.page - a.page);
  if (prior.length) return prior[0].state;

  return 'unchanged';
}

export function pageHasStatefulExpectation(memory: SceneMemory, factId: string, page: number): boolean {
  const obj = memory.statefulObjects[factId];
  return Boolean(obj?.timeline.some((t) => t.page === page));
}

export function pageAuthorizesLampBrightness(memory: SceneMemory, page: number): boolean {
  const lampKey = Object.keys(memory.statefulObjects).find((k) => isLampFact(k));
  if (!lampKey) return false;
  return memory.statefulObjects[lampKey].timeline.some(
    (t) => t.page === page && (t.state === 'dimmed' || normalizeObservedState(t.state) === 'dimmed')
  );
}

export function shouldEnforceStatefulDrift(
  factId: string,
  memory: SceneMemory,
  page: number
): boolean {
  if (isFortFormPrimaryFact(factId)) return true;
  if (isPillowAggregateFact(factId)) return false;
  if (isLampFact(factId)) return pageAuthorizesLampBrightness(memory, page);
  if (isBlanketFact(factId)) return pageHasStatefulExpectation(memory, factId, page);
  return pageHasStatefulExpectation(memory, factId, page);
}
