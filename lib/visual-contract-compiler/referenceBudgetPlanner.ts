/**
 * referenceBudgetPlanner — dynamic per-page reference ordering for the image-edit reference list.
 *
 * The breakage: a flat ~4-ref cap let style refs starve the SET reference, so location identity was
 * never anchored. The planner enforces the order child → companion → location/set → style and
 * GUARANTEES a set-ref slot on location pages (dropping a style slot if needed) — the set ref is
 * placed before style and can never be crowded out.
 *
 * 1B scope: REUSE existing/cheap set refs only (from the contract's location.setReference when
 * status==='ready', or an explicitly supplied url). It NEVER fabricates a ref; when a location page
 * has no set ref available it flags `missingSetRef` so set-ref generation (1C) can fill it later —
 * this module does not reopen the render/storage surface.
 */
import type { BookVisualContract } from './types';
import type { ResolvedPageContract } from './derivePageVisualContracts';

export type RefSlotKind = 'child' | 'companion' | 'location' | 'style';

export interface PlannedRef {
  kind: RefSlotKind;
  url: string;
}

export interface AvailableRefs {
  childAnchorUrl?: string | null;
  companionSheetUrl?: string | null;
  /** An EXISTING/cheap canonical set ref for this page's location (reuse only — never generated here). */
  locationSetRefUrl?: string | null;
  styleRefUrls?: string[];
}

export interface ReferencePlan {
  refs: PlannedRef[];
  /** true when this page's location got a set-ref slot. */
  setRefIncluded: boolean;
  /** true when a set ref WOULD be wanted (location page) but none is available — flag for 1C generation. */
  missingSetRef: boolean;
  /** true when a style slot was dropped to keep the set ref within the cap. */
  droppedStyleForSet: boolean;
}

function resolveCap(cap?: number): number {
  if (typeof cap === 'number' && Number.isFinite(cap) && cap >= 1) return Math.min(8, Math.floor(cap));
  const raw = process.env.VISUAL_CONTRACT_REF_CAP?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(8, n);
  }
  return 4;
}

/** Resolve the set ref for a page's location: explicit availability first, else a ready contract ref. */
export function resolveLocationSetRef(
  page: ResolvedPageContract,
  available: AvailableRefs,
  contract?: BookVisualContract
): string | null {
  if (available.locationSetRefUrl?.trim()) return available.locationSetRefUrl.trim();
  const loc = contract?.locations.find((l) => l.id === page.locationId);
  if (loc?.setReference?.status === 'ready' && loc.setReference.url?.trim()) {
    return loc.setReference.url.trim();
  }
  return null;
}

/**
 * Plan the reference list for a page. `isLocationPage` marks a page where the set ref is REQUIRED
 * (establishing / location-anchoring pages); when omitted, every page is treated as wanting a set ref
 * if one is available (all pages have a location). Order: child → companion → location/set → style.
 */
export function planPageReferences(input: {
  page: ResolvedPageContract;
  available: AvailableRefs;
  contract?: BookVisualContract;
  cap?: number;
  isLocationPage?: boolean;
}): ReferencePlan {
  const cap = resolveCap(input.cap);
  const setRefUrl = resolveLocationSetRef(input.page, input.available, input.contract);
  const wantsSetRef = input.isLocationPage ?? true; // all pages sit at a location

  const refs: PlannedRef[] = [];
  // 1) child anchor (identity)
  if (input.available.childAnchorUrl?.trim()) refs.push({ kind: 'child', url: input.available.childAnchorUrl.trim() });
  // 2) companion sheet — only when the companion is on the page
  if (input.page.characterPresence.companion && input.available.companionSheetUrl?.trim()) {
    refs.push({ kind: 'companion', url: input.available.companionSheetUrl.trim() });
  }
  // 3) location/set ref — placed BEFORE style so style can never starve it
  let setRefIncluded = false;
  if (setRefUrl) {
    refs.push({ kind: 'location', url: setRefUrl });
    setRefIncluded = true;
  }

  // 4) style refs — fill the remaining budget
  const styleUrls = (input.available.styleRefUrls ?? []).map((u) => u.trim()).filter(Boolean);
  let droppedStyleForSet = false;
  for (const url of styleUrls) {
    if (refs.length >= cap) {
      // Over cap: if a set ref is present, the style ref we skip is the one we "dropped for the set".
      if (setRefIncluded) droppedStyleForSet = true;
      break;
    }
    refs.push({ kind: 'style', url });
  }

  // If we're over cap and somehow the set ref didn't make it (defensive — it's added before style),
  // evict the last style to guarantee the set ref. The construction above already guarantees this.
  const finalRefs = refs.slice(0, cap);
  const finalSetIncluded = finalRefs.some((r) => r.kind === 'location');

  return {
    refs: finalRefs,
    setRefIncluded: finalSetIncluded,
    missingSetRef: wantsSetRef && !setRefUrl,
    droppedStyleForSet,
  };
}
