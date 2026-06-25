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
import type { BookVisualContract } from './types';
import type { ResolvedPageContract } from './derivePageVisualContracts';

export type ContractQaCheck =
  | 'wrong_location'
  | 'forbidden_entity'
  | 'missing_major_prop'
  | 'companion_wardrobe_drift'
  | 'cover_world_mismatch';

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
}

export interface ContractQaFailure {
  check: ContractQaCheck;
  detail: string;
}

export interface ContractQaVerdict {
  pass: boolean;
  failures: ContractQaFailure[];
}

/** Pure verdict over a vision observation — exactly the 5 checks, nothing more. */
export function evaluatePageContractQa(input: {
  page: ResolvedPageContract;
  observation: PageVisionObservation;
  isCover?: boolean;
}): ContractQaVerdict {
  const { page, observation, isCover } = input;
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
    'JSON keys: locationMatchesContract (bool), forbiddenEntitiesPresent (string[]), missingMajorProps (string[]), companionWardrobeMatches (bool|null), coverWorldMatches (bool|null).',
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
  return {
    // Fail-safe: if the model didn't clearly confirm the location, treat as mismatch (gate is hard).
    locationMatchesContract: parsed.locationMatchesContract === true,
    forbiddenEntitiesPresent: strArr(parsed.forbiddenEntitiesPresent),
    missingMajorProps: strArr(parsed.missingMajorProps),
    companionWardrobeMatches: boolOrNull(parsed.companionWardrobeMatches),
    coverWorldMatches: boolOrNull(parsed.coverWorldMatches),
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
  const verdict = evaluatePageContractQa({ page: input.page, observation, isCover: input.isCover });
  return { observation, verdict };
}
