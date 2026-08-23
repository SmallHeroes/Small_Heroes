/**
 * Derive resolved per-page contracts from a BookVisualContract.
 *
 * Deterministic enrichment (no LLM, no I/O): resolve each page's companion wardrobe lock from the
 * cast, fold the book-level forbiddenGlobalElements into every page's mustNotShow (so the global
 * "never render" list — e.g. the stray dragon — is enforced per page), and attach human-readable
 * location/zone names for the prompt block.
 */
import type {
  BookVisualContract,
  PageVisualContract,
  VisualLocation,
  VisualZone,
  WardrobeLock,
} from './types';
import {
  resolveCompanionAppearanceState,
  type ResolvedCompanionAppearanceState,
} from '@/lib/companion-appearance-state';

export interface ResolvedPageContract extends PageVisualContract {
  /** mustNotShow ∪ forbiddenGlobalElements (deduped). */
  mustNotShow: string[];
  /** Companion outfit lock, resolved from cast.companion — only when the companion is on the page. */
  companionWardrobeLock?: string;
  /** Child outfit lock, resolved from cast.child. */
  childWardrobeLock: string;
  /** Exact page-resolved child wardrobe authority. */
  childWardrobe: WardrobeLock;
  /** Exact carried-forward companion appearance state, only while visible. */
  resolvedCompanionState?: ResolvedCompanionAppearanceState;
  locationName: string;
  zoneName?: string;
  /** (Slice B) The page's own zone stableGeometry, resolved for the authoritative prompt block (per-page → no leak). */
  zoneStableGeometry?: string[];
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => typeof v === 'string' && v.trim().length > 0)));
}

export function derivePageVisualContracts(contract: BookVisualContract): ResolvedPageContract[] {
  const locationById = new Map<string, VisualLocation>(contract.locations.map((l) => [l.id, l]));
  const zoneById = new Map<string, VisualZone>(contract.zones.map((z) => [z.id, z]));
  const childWardrobe = contract.cast.child.wardrobe;
  const companionWardrobeLock = contract.cast.companion?.wardrobe.description;
  const companionStateAuthority =
    contract.cast.companion?.companionAppearanceStateAuthority;
  const globalForbidden = contract.forbiddenGlobalElements ?? [];
  let currentCompanionState = companionStateAuthority
    ? resolveCompanionAppearanceState(
        companionStateAuthority,
        companionStateAuthority.defaultStateId,
      )
    : null;
  if (companionStateAuthority && !currentCompanionState) {
    throw new Error('frozen companion appearance-state default is unresolved');
  }

  return contract.pageContracts
    .slice()
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page): ResolvedPageContract => {
      const location = locationById.get(page.locationId);
      const zone = page.zoneId ? zoneById.get(page.zoneId) : undefined;
      const effectiveChildWardrobe = page.childWardrobeOverride ?? childWardrobe;
      if (page.companionStateOverride && companionStateAuthority) {
        const nextState = resolveCompanionAppearanceState(
          companionStateAuthority,
          page.companionStateOverride.stateId,
        );
        if (!nextState) {
          throw new Error(
            `page ${page.pageNumber} companion appearance-state is unresolved`,
          );
        }
        currentCompanionState = nextState;
      }
      return {
        ...page,
        mustNotShow: uniq([...(page.mustNotShow ?? []), ...globalForbidden]),
        childWardrobeLock: effectiveChildWardrobe.description,
        childWardrobe: {
          description: effectiveChildWardrobe.description,
          ...(effectiveChildWardrobe.forbidden
            ? { forbidden: [...effectiveChildWardrobe.forbidden] }
            : {}),
        },
        // Only lock the companion outfit on pages where the companion actually appears.
        companionWardrobeLock: page.characterPresence.companion ? companionWardrobeLock : undefined,
        ...(page.characterPresence.companion && currentCompanionState
          ? { resolvedCompanionState: structuredClone(currentCompanionState) }
          : {}),
        locationName: location?.name ?? page.locationId,
        zoneName: zone?.name,
        // (Slice B) each page carries ONLY its own zone's geometry → the prompt block emits per-page, no cross-zone leak.
        zoneStableGeometry: zone?.stableGeometry,
      };
    });
}

/**
 * Derive the COVER (page 0) as a page-shaped ResolvedPageContract. Page 0 is absent from `pageContracts`, but its
 * location / cast / forbidden authority lives in `coverContract` — projecting it here lets the cover flow through
 * the SAME per-page consumers as real pages (the authoritative prompt block via buildVisualContractPromptBlock,
 * and the calibration QA gate). Deterministic, general, never book-specific: the global forbiddens fold into the
 * cover's mustNotShow (deduped, matching the page projection); companion presence is conservatively `false` (the
 * cover's `mustShow` carries any companion requirement) so the block never over-asserts cast; camera is the fixed
 * cover-composition hint. A location the cover names but the contract does not declare falls back to the raw id.
 */
export function deriveCoverVisualContract(contract: BookVisualContract): ResolvedPageContract {
  const cover = contract.coverContract;
  const location = contract.locations.find((l) => l.id === cover.locationId);
  const zone = cover.zoneId ? contract.zones.find((candidate) => candidate.id === cover.zoneId) : undefined;
  const castIds = cover.castIds ?? [contract.cast.child.id];
  const coverShowsCompanion = contract.cast.companion
    ? castIds.includes(contract.cast.companion.id)
    : false;
  const companionStateAuthority =
    contract.cast.companion?.companionAppearanceStateAuthority;
  const resolvedCompanionState =
    coverShowsCompanion && companionStateAuthority
      ? resolveCompanionAppearanceState(
          companionStateAuthority,
          companionStateAuthority.defaultStateId,
        )
      : null;
  if (coverShowsCompanion && companionStateAuthority && !resolvedCompanionState) {
    throw new Error('cover companion appearance-state default is unresolved');
  }
  return {
    pageNumber: 0,
    locationId: cover.locationId,
    zoneId: cover.zoneId,
    sameLocationAs: null,
    mustShow: cover.mustShow ?? [],
    mustNotShow: uniq([...(cover.mustNotShow ?? []), ...(contract.forbiddenGlobalElements ?? [])]),
    characterPresence: {
      child: castIds.includes(contract.cast.child.id),
      companion: coverShowsCompanion,
    },
    castIds,
    propState: [],
    camera: 'cover composition',
    childWardrobeLock: contract.cast.child.wardrobe.description,
    childWardrobe: {
      description: contract.cast.child.wardrobe.description,
      ...(contract.cast.child.wardrobe.forbidden
        ? { forbidden: [...contract.cast.child.wardrobe.forbidden] }
        : {}),
    },
    companionWardrobeLock: undefined,
    ...(resolvedCompanionState
      ? { resolvedCompanionState: structuredClone(resolvedCompanionState) }
      : {}),
    locationName: location?.name ?? cover.locationId,
    zoneName: zone?.name,
    zoneStableGeometry: zone?.stableGeometry,
  };
}
