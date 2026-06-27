/**
 * pageVisualContractQa — the HARD vision-QA gate (a gate, not a report).
 *
 * EXACTLY 5 checks, deliberately small to avoid false-positive ping-pong:
 *   1. wrong_location            — rendered location != contract locationId
 *   2. forbidden_entity          — any forbiddenGlobalElement present (e.g. the stray dragon)
 *   3. missing_major_prop        — a required major prop (a recurringProp in mustShow) is absent
 *   4. companion_wardrobe_drift  — companion present but its outfit != companionWardrobeLock
 *   5. cover_world_mismatch      — (cover only) world / time-of-day doesn't match the story
 *
 * The pure verdict (`evaluatePageContractQa`) is separate from the vision call
 * (`observePageForContractQa`) so the gate is verifiable without a live vision model. A FAIL must
 * trigger a bounded reroll and must NEVER proceed to the full book (enforced by the orchestrator).
 */
import type { BookVisualContract, CompanionScaleContract } from './types';
import type { ResolvedPageContract } from './derivePageVisualContracts';

/** Min vision confidence to TRUST a scale measurement; below it → not_measurable (never a failure). */
export const SCALE_CONFIDENCE_MIN = 0.6;

export type ContractQaCheck =
  | 'wrong_location'
  | 'forbidden_entity'
  | 'missing_major_prop'
  | 'companion_wardrobe_drift'
  | 'cover_world_mismatch'
  | 'companion_scale';

/** What the vision model reports about a rendered image, normalized for the gate. */
export interface PageVisionObservation {
  /** Does the depicted place match the contract's location identity? */
  locationMatchesContract: boolean;
  /** Which forbiddenGlobalElements (or other uninvited creatures) are visible. */
  forbiddenEntitiesPresent: string[];
  /** Required major props (from mustShow) that are NOT visible. */
  missingMajorProps: string[];
  /** companion outfit matches the lock? null when no companion is on the page. */
  companionWardrobeMatches: boolean | null;
  /** cover only: world/time-of-day matches the story? null for non-cover pages. */
  coverWorldMatches?: boolean | null;
  /**
   * Scale MEASUREMENTS — vision MEASURES, the code DECIDES. Companion pages only; all optional, and
   * absent/uncertain → not_measurable (never a failure). The fractions are each character's
   * head-to-foot height as a fraction (0..1) of the image height.
   */
  childHeightFraction?: number | null;
  companionHeightFraction?: number | null;
  /** BOTH shown full-body (head to feet, not cropped/seated/lying/occluded). */
  bothFullBody?: boolean | null;
  /** Both standing on the same ground at the same depth (so the ratio is meaningful). */
  sameGroundPlane?: boolean | null;
  /** 0..1 confidence in the two height measurements. */
  scaleConfidence?: number | null;
}

export interface ContractQaFailure {
  check: ContractQaCheck;
  detail: string;
}

export interface ContractQaVerdict {
  pass: boolean;
  failures: ContractQaFailure[];
}

/** Pure verdict over a vision observation — the 5 location/cast checks plus the code-computed scale check. */
export function evaluatePageContractQa(input: {
  page: ResolvedPageContract;
  observation: PageVisionObservation;
  isCover?: boolean;
  /** Companion size-vs-child lock (contract.cast.companion.scaleContract) — enables the scale check. */
  scaleContract?: CompanionScaleContract | null;
}): ContractQaVerdict {
  const { page, observation, isCover, scaleContract } = input;
  const failures: ContractQaFailure[] = [];

  // 1. wrong location
  if (!observation.locationMatchesContract) {
    failures.push({ check: 'wrong_location', detail: `rendered place is not ${page.locationId}` });
  }
  // 2. forbidden entity
  if (observation.forbiddenEntitiesPresent.length > 0) {
    failures.push({
      check: 'forbidden_entity',
      detail: `forbidden present: ${observation.forbiddenEntitiesPresent.join(', ')}`,
    });
  }
  // 3. missing major prop
  if (observation.missingMajorProps.length > 0) {
    failures.push({
      check: 'missing_major_prop',
      detail: `missing required: ${observation.missingMajorProps.join(', ')}`,
    });
  }
  // 4. companion wardrobe drift — only when the companion is on the page
  if (page.characterPresence.companion && observation.companionWardrobeMatches === false) {
    failures.push({
      check: 'companion_wardrobe_drift',
      detail: `companion outfit != "${page.companionWardrobeLock ?? 'locked outfit'}"`,
    });
  }
  // 5. cover world mismatch — cover only
  if (isCover && observation.coverWorldMatches === false) {
    failures.push({ check: 'cover_world_mismatch', detail: 'cover world/time-of-day does not match the story' });
  }
  // 6. companion scale — CODE-COMPUTED, measurable-only. Vision MEASURES heights; the code computes
  //    companion ÷ child and compares to the canonical band. Hard-fail ONLY when BOTH are full-body at
  //    the same depth with a confident measurement; otherwise not_measurable → never a failure
  //    (conservative — avoids false positives on close-ups, seated/lying, partial, or different depth).
  if (scaleContract && page.characterPresence.companion) {
    const childH = observation.childHeightFraction;
    const compH = observation.companionHeightFraction;
    const measurable =
      observation.bothFullBody === true &&
      observation.sameGroundPlane === true &&
      (observation.scaleConfidence ?? 0) >= SCALE_CONFIDENCE_MIN &&
      typeof childH === 'number' &&
      childH > 0 &&
      typeof compH === 'number' &&
      compH > 0;
    if (measurable) {
      const ratio = (compH as number) / (childH as number);
      const [min, max] = scaleContract.ratioBand;
      if (ratio < min || ratio > max) {
        failures.push({
          check: 'companion_scale',
          detail: `companion ≈ ${Math.round(ratio * 100)}% of child height (allowed ${Math.round(
            min * 100
          )}–${Math.round(max * 100)}%)`,
        });
      }
    }
  }

  return { pass: failures.length === 0, failures };
}

/** Minimal vision seam: a prompt describing the image, model returns JSON the gate can read. */
export type ContractVisionCaller = (imageUrl: string, instruction: string) => Promise<string>;

/** The set of "major props" the gate treats as required-to-be-present: mustShow ∩ recurringProps. */
export function resolveMajorProps(page: ResolvedPageContract, contract: BookVisualContract): string[] {
  const propNames = new Set(contract.recurringProps.map((p) => p.name.toLowerCase()));
  const propIds = new Set(contract.recurringProps.map((p) => p.id.toLowerCase()));
  return (page.mustShow ?? []).filter((m) => {
    const lc = m.toLowerCase();
    return propNames.has(lc) || propIds.has(lc) || [...propNames].some((n) => lc.includes(n));
  });
}

/** Build the vision instruction (what to look for) — pure, testable. */
export function buildContractVisionInstruction(
  page: ResolvedPageContract,
  contract: BookVisualContract,
  isCover?: boolean
): string {
  const location = contract.locations.find((l) => l.id === page.locationId);
  const wantsScale =
    page.characterPresence.companion && Boolean(contract.cast.companion?.scaleContract);
  return [
    'Inspect this children\'s-book illustration and answer ONLY as JSON.',
    `Expected place: ${location?.name ?? page.locationId}${location?.description ? ` (${location.description})` : ''}.`,
    `Forbidden (must NOT appear): ${(contract.forbiddenGlobalElements ?? []).join(', ') || 'none'}.`,
    'In forbiddenEntitiesPresent, list EVERY LIVE animal/creature visible that is NOT the child and NOT the declared companion — including a background or secondary live animal (e.g. an armadillo, pangolin, or extra pet) EVEN IF the companion is also present. A second live creature is a violation. Do NOT list plush toys, stuffed animals, dolls, pictures, or decor — only living characters.',
    `Required to be visible: ${resolveMajorProps(page, contract).join(', ') || 'none'}.`,
    page.characterPresence.companion
      ? `Companion outfit must be: ${page.companionWardrobeLock ?? '(locked outfit)'}.`
      : 'No companion expected on this page.',
    isCover ? `Cover world/time-of-day must be: ${contract.coverContract.worldType}${contract.coverContract.timeOfDay ? `, ${contract.coverContract.timeOfDay}` : ''}.` : '',
    wantsScale
      ? 'SCALE MEASUREMENT (measure ONLY — do NOT judge size): if BOTH the child and the companion are shown FULL-BODY (head to feet, not cropped, not seated/lying, not occluded) standing on the SAME ground at the SAME distance, set bothFullBody=true and sameGroundPlane=true and report childHeightFraction and companionHeightFraction = each one\'s head-to-foot height as a fraction (0..1) of the FULL image height, plus scaleConfidence (0..1). If they are NOT both full-body at the same depth, set bothFullBody=false and leave the fractions null — never guess.'
      : '',
    `JSON keys: locationMatchesContract (bool), forbiddenEntitiesPresent (string[]), missingMajorProps (string[]), companionWardrobeMatches (bool|null), coverWorldMatches (bool|null)${
      wantsScale
        ? ', childHeightFraction (number|null), companionHeightFraction (number|null), bothFullBody (bool), sameGroundPlane (bool), scaleConfidence (number 0..1)'
        : ''
    }.`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Parse a vision model's JSON into a normalized observation (defensive / fail-safe defaults). */
export function interpretVisionJson(raw: string): PageVisionObservation {
  let parsed: Record<string, unknown> = {};
  try {
    const text = raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, '');
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    parsed = first >= 0 && last > first ? (JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }
  const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const boolOrNull = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
  const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    // Fail-safe: if the model didn't clearly confirm the location, treat as mismatch (gate is hard).
    locationMatchesContract: parsed.locationMatchesContract === true,
    forbiddenEntitiesPresent: strArr(parsed.forbiddenEntitiesPresent),
    missingMajorProps: strArr(parsed.missingMajorProps),
    companionWardrobeMatches: boolOrNull(parsed.companionWardrobeMatches),
    coverWorldMatches: boolOrNull(parsed.coverWorldMatches),
    childHeightFraction: numOrNull(parsed.childHeightFraction),
    companionHeightFraction: numOrNull(parsed.companionHeightFraction),
    bothFullBody: boolOrNull(parsed.bothFullBody),
    sameGroundPlane: boolOrNull(parsed.sameGroundPlane),
    scaleConfidence: numOrNull(parsed.scaleConfidence),
  };
}

/** Observe a rendered image via an injected vision caller and evaluate the gate. */
export async function observePageForContractQa(input: {
  imageUrl: string;
  page: ResolvedPageContract;
  contract: BookVisualContract;
  isCover?: boolean;
  vision: ContractVisionCaller;
}): Promise<{ observation: PageVisionObservation; verdict: ContractQaVerdict }> {
  const instruction = buildContractVisionInstruction(input.page, input.contract, input.isCover);
  const raw = await input.vision(input.imageUrl, instruction);
  const observation = interpretVisionJson(raw);
  const verdict = evaluatePageContractQa({
    page: input.page,
    observation,
    isCover: input.isCover,
    scaleContract: input.contract.cast.companion?.scaleContract ?? null,
  });
  return { observation, verdict };
}
