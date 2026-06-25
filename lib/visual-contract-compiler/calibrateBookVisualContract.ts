/**
 * Calibration orchestrator — render ONLY the 5 risk pages, run the hard vision-QA gate on each, and
 * bounded-reroll on a fail. Proceed to a full render ONLY if all risk pages pass.
 *
 * The renderer and vision model are INJECTED so the orchestration (selection → render → gate →
 * reroll → all-pass decision) is verifiable without real renders or a live vision API. A live
 * calibration run (e.g. on ענת's book) supplies real renderer/vision implementations; this module
 * never renders by itself, keeping the render/spend surface out of the unit-tested core.
 *
 * Fail-closed: a missing/invalid contract throws before any render (assertValidBookVisualContract).
 */
import type { BookVisualContract } from './types';
import {
  assertValidBookVisualContract,
} from './validateBookVisualContract';
import { derivePageVisualContracts, type ResolvedPageContract } from './derivePageVisualContracts';
import { selectCalibrationPages } from './selectCalibrationPages';
import {
  evaluatePageContractQa,
  type ContractQaVerdict,
  type PageVisionObservation,
} from './pageVisualContractQa';

export interface CalibrationRenderTarget {
  /** Page number, or 0 for the cover. */
  pageNumber: number;
  isCover: boolean;
  page?: ResolvedPageContract;
}

export interface CalibrationRenderer {
  render(target: CalibrationRenderTarget, attempt: number): Promise<{ imageUrl: string }>;
}

export interface CalibrationVision {
  observe(input: {
    imageUrl: string;
    target: CalibrationRenderTarget;
    contract: BookVisualContract;
  }): Promise<PageVisionObservation>;
}

export interface CalibrationPageResult {
  pageNumber: number;
  isCover: boolean;
  pass: boolean;
  attempts: number;
  finalVerdict: ContractQaVerdict;
  imageUrl?: string;
}

export interface CalibrationResult {
  allPass: boolean;
  results: CalibrationPageResult[];
  /** Convenience: the page numbers that failed after all rerolls. */
  failedPages: number[];
}

function resolveMaxRerolls(maxRerolls?: number): number {
  if (typeof maxRerolls === 'number' && maxRerolls >= 0) return Math.min(5, Math.floor(maxRerolls));
  const raw = process.env.VISUAL_CONTRACT_MAX_REROLLS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0) return Math.min(5, n);
  }
  return 2;
}

export async function runVisualContractCalibration(input: {
  contract: BookVisualContract;
  renderer: CalibrationRenderer;
  vision: CalibrationVision;
  maxRerolls?: number;
}): Promise<CalibrationResult> {
  // Fail-closed before any render.
  assertValidBookVisualContract(input.contract);

  const pages = derivePageVisualContracts(input.contract);
  const byNumber = new Map(pages.map((p) => [p.pageNumber, p]));
  const selection = selectCalibrationPages(input.contract);
  const maxRerolls = resolveMaxRerolls(input.maxRerolls);

  const results: CalibrationPageResult[] = [];

  for (const pageNumber of selection.pageNumbers) {
    const isCover = pageNumber === 0;
    const page = isCover ? undefined : byNumber.get(pageNumber);
    if (!isCover && !page) continue; // selection only yields real pages; defensive
    const target: CalibrationRenderTarget = { pageNumber, isCover, page };

    let attempts = 0;
    let lastVerdict: ContractQaVerdict = { pass: false, failures: [] };
    let lastUrl: string | undefined;

    // attempt 0 = first render; up to maxRerolls additional attempts on failure.
    for (let attempt = 0; attempt <= maxRerolls; attempt++) {
      attempts = attempt + 1;
      const { imageUrl } = await input.renderer.render(target, attempt);
      lastUrl = imageUrl;
      const observation = await input.vision.observe({ imageUrl, target, contract: input.contract });
      lastVerdict = evaluatePageContractQa({
        // For the cover we still evaluate via a synthetic page-like contract derived from coverContract.
        page: page ?? coverAsPage(input.contract),
        observation,
        isCover,
      });
      if (lastVerdict.pass) break;
    }

    results.push({
      pageNumber,
      isCover,
      pass: lastVerdict.pass,
      attempts,
      finalVerdict: lastVerdict,
      imageUrl: lastUrl,
    });
  }

  const failedPages = results.filter((r) => !r.pass).map((r) => r.pageNumber);
  return { allPass: failedPages.length === 0, results, failedPages };
}

/** Represent the cover contract as a page-shaped object so the same gate logic applies to it. */
function coverAsPage(contract: BookVisualContract): ResolvedPageContract {
  const cover = contract.coverContract;
  return {
    pageNumber: 0,
    locationId: cover.locationId,
    zoneId: undefined,
    sameLocationAs: null,
    mustShow: cover.mustShow ?? [],
    mustNotShow: [...(cover.mustNotShow ?? []), ...(contract.forbiddenGlobalElements ?? [])],
    characterPresence: { child: true, companion: false },
    propState: [],
    camera: 'cover composition',
    childWardrobeLock: contract.cast.child.wardrobe.description,
    companionWardrobeLock: undefined,
    locationName: contract.locations.find((l) => l.id === cover.locationId)?.name ?? cover.locationId,
    zoneName: undefined,
  };
}
