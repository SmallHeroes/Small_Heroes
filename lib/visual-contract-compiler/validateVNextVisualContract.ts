/**
 * vNext (WS0) fail-closed validation — the STRICTER contract layer on top of the base validator.
 *
 * The base `validateBookVisualContract` guarantees structural soundness for 1A/1B (locations, zones,
 * cast, cover, page location/zone references). vNext adds the WS0 authority rules ON TOP, without changing
 * base behavior (so every existing contract/consumer/test stays green):
 *
 *   1. EXACT per-page coverage — every page resolves to BOTH a location AND a zone (zoneId required).
 *   2. Cast resolution — every per-page `castIds[]` entry resolves to a defined cast member
 *      (cast.child.id | cast.companion?.id | humanCast[].id).
 *   3. Transitions well-formed — for a non-`steady` transition, from/to zones exist and differ, and the
 *      page's own zone aligns with the kind (before → origin, after → destination, threshold → either).
 *      A `before_transition`/`steady` page can therefore NEVER sit in the destination zone.
 *   4. Human cast well-formed — stable id, coarse gender bound to text evidence, pagesPresent reference
 *      real pages.
 *
 * Enforcement of the *content* checks (does the render actually match?) lands in WS1/WS2; this validator is
 * the STRUCTURAL gate only. Malformed → fail closed (never silently pass).
 */
import { validateBookVisualContract } from './validateBookVisualContract';
import type {
  BookVisualContract,
  PageTransition,
  PageVisualContract,
  RecurringHumanCastMember,
} from './types';

export type VNextContractValidationResult =
  | { ok: true; contract: BookVisualContract }
  | { ok: false; errors: string[] };

export class InvalidVNextVisualContractError extends Error {
  readonly isInvalidVNextVisualContract = true as const;
  constructor(readonly errors: string[]) {
    super(`Invalid vNext BookVisualContract: ${errors.join('; ')}`);
    this.name = 'InvalidVNextVisualContractError';
  }
}

export function isInvalidVNextVisualContractError(
  e: unknown,
): e is InvalidVNextVisualContractError {
  return (
    e instanceof InvalidVNextVisualContractError ||
    (e as { isInvalidVNextVisualContract?: boolean })?.isInvalidVNextVisualContract === true
  );
}

const TRANSITION_KINDS = new Set<PageTransition['kind']>([
  'steady',
  'before_transition',
  'threshold',
  'after_transition',
]);
const HUMAN_GENDERS = new Set<RecurringHumanCastMember['gender']>([
  'male',
  'female',
  'unspecified',
]);

function isStr(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Collect every id a per-page `castIds[]` entry is allowed to resolve to. */
function collectCastIds(contract: BookVisualContract): Set<string> {
  const ids = new Set<string>();
  if (isStr(contract.cast?.child?.id)) ids.add(contract.cast.child.id);
  if (isStr(contract.cast?.companion?.id)) ids.add(contract.cast.companion!.id);
  for (const member of contract.humanCast ?? []) {
    if (isStr(member?.id)) ids.add(member.id);
  }
  return ids;
}

function validateTransition(
  label: string,
  page: PageVisualContract,
  zoneIds: Set<string>,
  errors: string[],
): void {
  const t = page.transition;
  if (t == null) return; // absent === steady; nothing to check
  if (typeof t !== 'object' || Array.isArray(t) || !TRANSITION_KINDS.has(t.kind)) {
    errors.push(`${label}.transition.kind invalid (${String((t as PageTransition)?.kind)})`);
    return;
  }
  if (t.kind === 'steady') {
    // A steady page must not sit in a "destination" — it declares no move.
    if (isStr(t.toZoneId)) {
      errors.push(`${label} is steady but declares a destination zone "${t.toZoneId}"`);
    }
    return;
  }
  // Non-steady: from/to must exist and differ.
  if (!isStr(t.fromZoneId) || !zoneIds.has(t.fromZoneId)) {
    errors.push(`${label}.transition.fromZoneId "${String(t.fromZoneId)}" is not a declared zone`);
  }
  if (!isStr(t.toZoneId) || !zoneIds.has(t.toZoneId)) {
    errors.push(`${label}.transition.toZoneId "${String(t.toZoneId)}" is not a declared zone`);
  }
  if (isStr(t.fromZoneId) && isStr(t.toZoneId) && t.fromZoneId === t.toZoneId) {
    errors.push(`${label}.transition from/to zones must differ ("${t.fromZoneId}")`);
  }
  // Zone alignment per kind: before → origin, after → destination, threshold → either endpoint.
  if (t.kind === 'before_transition') {
    if (isStr(t.toZoneId) && page.zoneId === t.toZoneId) {
      errors.push(`${label} is before_transition but already sits in the destination zone "${t.toZoneId}"`);
    }
    if (isStr(t.fromZoneId) && isStr(page.zoneId) && page.zoneId !== t.fromZoneId) {
      errors.push(`${label} before_transition zone "${page.zoneId}" must be the origin "${t.fromZoneId}"`);
    }
  } else if (t.kind === 'after_transition') {
    if (isStr(t.toZoneId) && isStr(page.zoneId) && page.zoneId !== t.toZoneId) {
      errors.push(`${label} after_transition zone "${page.zoneId}" must be the destination "${t.toZoneId}"`);
    }
  } else if (t.kind === 'threshold') {
    if (
      isStr(page.zoneId) &&
      isStr(t.fromZoneId) &&
      isStr(t.toZoneId) &&
      page.zoneId !== t.fromZoneId &&
      page.zoneId !== t.toZoneId
    ) {
      errors.push(`${label} threshold zone "${page.zoneId}" must be the origin or the destination`);
    }
  }
}

function validateHumanCast(
  members: RecurringHumanCastMember[],
  pageNumbers: Set<number>,
  castIdsByPage: Map<number, Set<string>>,
  errors: string[],
): void {
  const seen = new Set<string>();
  members.forEach((m, i) => {
    const label = isStr(m?.id) ? `humanCast "${m.id}"` : `humanCast[${i}]`;
    if (!isStr(m?.id)) {
      errors.push(`humanCast[${i}].id missing`);
      return;
    }
    if (seen.has(m.id)) errors.push(`duplicate humanCast id "${m.id}"`);
    seen.add(m.id);
    if (!isStr(m.role)) errors.push(`${label}.role missing`);
    if (!HUMAN_GENDERS.has(m.gender)) errors.push(`${label}.gender invalid ("${String(m.gender)}")`);
    if (!isStr(m.textEvidence)) errors.push(`${label}.textEvidence missing (identity must bind to a story phrase)`);
    if (!m.wardrobe || !isStr(m.wardrobe.description)) errors.push(`${label}.wardrobe.description missing`);
    if (!Array.isArray(m.aliases)) errors.push(`${label}.aliases must be an array`);
    if (!Array.isArray(m.forbiddenAppearance)) errors.push(`${label}.forbiddenAppearance must be an array`);
    if (!Array.isArray(m.pagesPresent)) {
      errors.push(`${label}.pagesPresent must be an array`);
    } else {
      for (const pn of m.pagesPresent) {
        if (typeof pn !== 'number' || !pageNumbers.has(pn)) {
          errors.push(`${label}.pagesPresent references unknown page ${String(pn)}`);
          continue;
        }
        // Bidirectional binding (fail-closed): a page this person is "present" on MUST declare the person in
        // its castIds — otherwise a recurring human could be silently dropped from a page it belongs on.
        if (!castIdsByPage.get(pn)?.has(m.id)) {
          errors.push(`${label} claims page ${pn} but ${m.id} is not in that page's castIds`);
        }
      }
    }
  });
}

/**
 * Validate a contract against the vNext (WS0) rules. Runs the base validator first (so base problems are
 * surfaced unchanged), then layers the stricter coverage/cast/transition checks. PURE — no I/O, no clock.
 */
export function validateVNextVisualContract(input: unknown): VNextContractValidationResult {
  const base = validateBookVisualContract(input);
  if (!base.ok) return base;
  const contract = base.contract;
  const errors: string[] = [];

  const zoneIds = new Set<string>((contract.zones ?? []).map((z) => z.id).filter(isStr));
  const castIds = collectCastIds(contract);
  const childId = isStr(contract.cast?.child?.id) ? contract.cast.child.id : undefined;
  const companionId = isStr(contract.cast?.companion?.id) ? contract.cast.companion!.id : undefined;
  const humanIds = new Set<string>(
    (contract.humanCast ?? []).map((m) => m?.id).filter(isStr),
  );
  const humanPagesById = new Map<string, Set<number>>();
  for (const m of contract.humanCast ?? []) {
    if (!isStr(m?.id)) continue;
    humanPagesById.set(
      m.id,
      new Set<number>((Array.isArray(m.pagesPresent) ? m.pagesPresent : []).filter((n): n is number => typeof n === 'number')),
    );
  }
  const pageNumbers = new Set<number>(
    (contract.pageContracts ?? [])
      .map((p) => p.pageNumber)
      .filter((n): n is number => typeof n === 'number'),
  );
  const castIdsByPage = new Map<number, Set<string>>();

  for (const page of contract.pageContracts ?? []) {
    const label = typeof page.pageNumber === 'number' ? `page ${page.pageNumber}` : 'page (?)';

    // (1) exact per-page coverage — a zone is REQUIRED in vNext (base already verified the location and that a
    // present zoneId belongs to the page's location).
    if (!isStr(page.zoneId)) {
      errors.push(`${label} has no zoneId (vNext requires every page to resolve to a location + zone)`);
    }

    // (2) cast resolution — castIds is REQUIRED (fail-closed): every page must declare its cast, and every
    // entry must resolve to a defined member. A missing/omitted castIds is a hole, not a pass.
    const pageCastIds = new Set<string>();
    if (!Array.isArray(page.castIds)) {
      errors.push(`${label}.castIds must be an array (vNext requires every page to declare its cast)`);
    } else {
      for (const id of page.castIds) {
        if (!isStr(id) || !castIds.has(id)) {
          errors.push(`${label}.castIds entry "${String(id)}" does not resolve to a defined cast member`);
        } else {
          pageCastIds.add(id);
        }
      }
    }
    if (typeof page.pageNumber === 'number') castIdsByPage.set(page.pageNumber, pageCastIds);

    // (2b) characterPresence MUST be backed by castIds, both directions (fail-closed): a page cannot claim a
    // character is present without declaring it, nor list one it claims is absent.
    const presence = page.characterPresence;
    if (presence?.child === true) {
      if (!childId) errors.push(`${label} marks the child present but cast.child.id is missing`);
      else if (!pageCastIds.has(childId)) errors.push(`${label} marks the child present but "${childId}" is not in castIds`);
    }
    if (childId && pageCastIds.has(childId) && presence?.child !== true) {
      errors.push(`${label} lists the child "${childId}" in castIds but characterPresence.child is not true`);
    }
    if (presence?.companion === true) {
      if (!companionId) errors.push(`${label} marks the companion present but no companion is defined`);
      else if (!pageCastIds.has(companionId)) errors.push(`${label} marks the companion present but "${companionId}" is not in castIds`);
    }
    if (companionId && pageCastIds.has(companionId) && presence?.companion !== true) {
      errors.push(`${label} lists the companion "${companionId}" in castIds but characterPresence.companion is not true`);
    }

    // (2c) a recurring human listed on a page MUST record that page in its pagesPresent (reverse binding).
    if (typeof page.pageNumber === 'number') {
      for (const id of pageCastIds) {
        if (humanIds.has(id) && !humanPagesById.get(id)?.has(page.pageNumber)) {
          errors.push(`${label} lists human "${id}" in castIds but page ${page.pageNumber} is not in its pagesPresent`);
        }
      }
    }

    // (3) transitions well-formed.
    validateTransition(label, page, zoneIds, errors);
  }

  // (4) recurring human cast well-formed (+ forward castIds binding).
  if (contract.humanCast !== undefined) {
    if (!Array.isArray(contract.humanCast)) {
      errors.push('humanCast must be an array');
    } else {
      validateHumanCast(contract.humanCast, pageNumbers, castIdsByPage, errors);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, contract };
}

/** Fail-closed assertion for the vNext production/import path: throws on any structural problem. */
export function assertValidVNextVisualContract(
  input: unknown,
): asserts input is BookVisualContract {
  const result = validateVNextVisualContract(input);
  if (!result.ok) throw new InvalidVNextVisualContractError(result.errors);
}
