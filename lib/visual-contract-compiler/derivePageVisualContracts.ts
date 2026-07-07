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
} from './types';

export interface ResolvedPageContract extends PageVisualContract {
  /** mustNotShow ∪ forbiddenGlobalElements (deduped). */
  mustNotShow: string[];
  /** Companion outfit lock, resolved from cast.companion — only when the companion is on the page. */
  companionWardrobeLock?: string;
  /** Child outfit lock, resolved from cast.child. */
  childWardrobeLock: string;
  locationName: string;
  zoneName?: string;
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => typeof v === 'string' && v.trim().length > 0)));
}

export function derivePageVisualContracts(contract: BookVisualContract): ResolvedPageContract[] {
  const locationById = new Map<string, VisualLocation>(contract.locations.map((l) => [l.id, l]));
  const zoneById = new Map<string, VisualZone>(contract.zones.map((z) => [z.id, z]));
  const childWardrobeLock = contract.cast.child.wardrobe.description;
  const companionWardrobeLock = contract.cast.companion?.wardrobe.description;
  const globalForbidden = contract.forbiddenGlobalElements ?? [];

  return contract.pageContracts
    .map((page): ResolvedPageContract => {
      const location = locationById.get(page.locationId);
      const zone = page.zoneId ? zoneById.get(page.zoneId) : undefined;
      return {
        ...page,
        mustNotShow: uniq([...(page.mustNotShow ?? []), ...globalForbidden]),
        childWardrobeLock,
        // Only lock the companion outfit on pages where the companion actually appears.
        companionWardrobeLock: page.characterPresence.companion ? companionWardrobeLock : undefined,
        locationName: location?.name ?? page.locationId,
        zoneName: zone?.name,
      };
    })
    .sort((a, b) => a.pageNumber - b.pageNumber);
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
  return {
    pageNumber: 0,
    locationId: cover.locationId,
    zoneId: undefined,
    sameLocationAs: null,
    mustShow: cover.mustShow ?? [],
    mustNotShow: uniq([...(cover.mustNotShow ?? []), ...(contract.forbiddenGlobalElements ?? [])]),
    characterPresence: { child: true, companion: false },
    propState: [],
    camera: 'cover composition',
    childWardrobeLock: contract.cast.child.wardrobe.description,
    companionWardrobeLock: undefined,
    locationName: location?.name ?? cover.locationId,
    zoneName: undefined,
  };
}
