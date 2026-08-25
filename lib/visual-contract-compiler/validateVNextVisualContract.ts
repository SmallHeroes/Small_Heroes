/**
 * vNext (WS0) fail-closed validation — the STRICTER contract layer on top of the base validator.
 *
 * The base `validateBookVisualContract` guarantees structural soundness for 1A/1B (locations, zones,
 * cast, cover, page location/zone references). vNext adds the WS0 authority rules ON TOP, without changing
 * base behavior (so every existing contract/consumer/test stays green):
 *
 *   1. EXACT page coverage — the page set is exactly pages 1..N (N = the authoritative compiled page count),
 *      each present ONCE. Gaps, duplicates, and out-of-range page numbers fail closed. Every page also
 *      resolves to BOTH a location AND a zone (zoneId required).
 *   2. Cast resolution — every per-page `castIds[]` entry resolves to a defined cast member
 *      (cast.child.id | cast.companion?.id | humanCast[].id), and castIds is REQUIRED per page.
 *   3. Transitions well-formed (per-page) — for a non-`steady` transition, from/to zones exist and differ, and
 *      the page's own zone aligns with the kind (before → origin, after → destination, threshold → either).
 *      A `before_transition`/`steady` page can therefore NEVER sit in the destination zone.
 *   3b. CONTINUITY (cross-page) — every scene move must be DECLARED by a transition. A `steady`/`before_transition`
 *      page must stay in the previous page's zone (no move); a `threshold`/`after_transition` page must depart
 *      from an established zone, with a matching after_transition allowed to follow a threshold rendered at the
 *      destination. Catches undeclared scene moves (a `steady` page silently teleporting to a different
 *      zone/location) and, by induction, any page sitting in a zone the story never transitioned into.
 *   4. Human cast well-formed — stable id, coarse gender bound to text evidence, coarseAppearance lock,
 *      pagesPresent reference real pages (+ bidirectional castIds binding).
 *   5. environmentClass validated against the allowed set at runtime (unknown value → fail closed).
 *
 * Enforcement of the *content* checks (does the render actually match?) lands in WS1/WS2; this validator is
 * the STRUCTURAL gate only. Malformed → fail closed (never silently pass).
 */
import { validateBookVisualContract } from './validateBookVisualContract';
import { mustShowAbsenceContradictions } from './castPresenceContradiction';
import {
  draftValidationLocatorForUntrustedPage,
  draftValidationIssueIsValid,
  type DraftValidationIssue,
  type PageFinalStructuralCause,
} from './draftValidationDiagnostics';
import type {
  BookVisualContract,
  EnvironmentClass,
  PageTransition,
  PageVisualContract,
  RecurringHumanCastMember,
} from './types';

export type VNextContractValidationResult =
  | { ok: true; contract: BookVisualContract }
  | {
      ok: false;
      errors: string[];
      diagnosticIssues: readonly DraftValidationIssue[];
    };

export class InvalidVNextVisualContractError extends Error {
  readonly isInvalidVNextVisualContract = true as const;
  readonly diagnosticIssues: readonly DraftValidationIssue[];

  constructor(
    readonly errors: string[],
    diagnosticIssues: readonly DraftValidationIssue[],
  ) {
    super(`Invalid vNext BookVisualContract: ${errors.join('; ')}`);
    this.name = 'InvalidVNextVisualContractError';
    if (
      !Array.isArray(diagnosticIssues) ||
      diagnosticIssues.length === 0 ||
      !diagnosticIssues.every(draftValidationIssueIsValid)
    ) {
      throw new Error('draft validation diagnostic contract invalid');
    }
    this.diagnosticIssues = diagnosticIssues.map((issue) => structuredClone(issue));
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
const ENVIRONMENT_CLASSES = new Set<EnvironmentClass>(['indoor', 'outdoor', 'neutral']);

function isStr(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function repeatIssueForNewErrors(
  errors: readonly string[],
  priorErrorCount: number,
  diagnosticIssues: DraftValidationIssue[],
  issue: DraftValidationIssue,
): void {
  for (let index = priorErrorCount; index < errors.length; index += 1) {
    diagnosticIssues.push(issue);
  }
}

function pageFinalStructuralIssue(
  page: PageVisualContract,
  pageIndex: number,
  cause: PageFinalStructuralCause,
): DraftValidationIssue {
  return typeof page.pageNumber === 'number' &&
    Number.isSafeInteger(page.pageNumber) &&
    page.pageNumber > 0
    ? {
        family: 'draft_contract',
        code: 'final_structural_invariant_invalid',
        locator: {
          kind: 'page',
          fieldRole: 'final_structure',
          pageNumber: page.pageNumber,
        },
        causes: [cause],
      }
    : {
        family: 'draft_contract',
        code: 'final_structural_invariant_invalid',
        locator: {
          kind: 'collection_item',
          collectionRole: 'page_contracts',
          fieldRole: 'final_structure',
          itemIndex: pageIndex,
        },
      };
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
    if (!isStr(m.coarseAppearance)) errors.push(`${label}.coarseAppearance missing (the stable appearance lock)`);
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
  if (!base.ok) {
    return {
      ok: false,
      errors: base.errors,
      diagnosticIssues: base.diagnosticIssues,
    };
  }
  const contract = base.contract;
  const errors: string[] = [];
  const diagnosticIssues: DraftValidationIssue[] = [];

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

  // (5) environmentClass — validate at RUNTIME against the allowed set (the TS type is not enforced on JSON
  // parsed from an artifact). It is REQUIRED (it is the style-ref lock); an unknown/absent value fails closed.
  for (const [locationIndex, loc] of (contract.locations ?? []).entries()) {
    const errorCountBeforeLocation = errors.length;
    if (!isStr(loc?.id)) continue; // base validator already reported a missing location id
    if (loc.environmentClass === undefined) {
      errors.push(`location "${loc.id}" is missing environmentClass (the style-ref lock)`);
    } else if (!ENVIRONMENT_CLASSES.has(loc.environmentClass)) {
      errors.push(`location "${loc.id}" has unknown environmentClass "${String(loc.environmentClass)}"`);
    }
    repeatIssueForNewErrors(
      errors,
      errorCountBeforeLocation,
      diagnosticIssues,
      {
        family: 'draft_schema',
        code: 'value_domain_invalid',
        locator: {
          kind: 'collection_item',
          collectionRole: 'locations',
          fieldRole: 'value',
          itemIndex: locationIndex,
        },
      },
    );
  }

  // (1) EXACT page coverage — pages must be exactly 1..N, each present once (N = the authoritative compiled
  // count when available, else the max declared page). Gaps, duplicates, and out-of-range numbers fail closed.
  {
    const errorCountBeforeCoverage = errors.length;
    const rawPageNumbers = (contract.pageContracts ?? []).map((p) => p.pageNumber);
    const provenanceCount = contract.provenance?.compiledFromPages;
    const expectedCount =
      typeof provenanceCount === 'number' && Number.isInteger(provenanceCount) && provenanceCount > 0
        ? provenanceCount
        : rawPageNumbers.reduce((max, n) => (typeof n === 'number' && n > max ? n : max), 0);
    const seen = new Set<number>();
    for (const n of rawPageNumbers) {
      if (typeof n !== 'number' || !Number.isInteger(n)) {
        errors.push(`pageContracts has a non-integer pageNumber (${String(n)})`);
        continue;
      }
      if (n < 1 || n > expectedCount) {
        errors.push(`page ${n} is out of range (expected pages 1..${expectedCount})`);
      }
      if (seen.has(n)) errors.push(`duplicate pageContract for page ${n}`);
      seen.add(n);
    }
    for (let i = 1; i <= expectedCount; i++) {
      if (!seen.has(i)) errors.push(`missing pageContract for page ${i} (expected exactly pages 1..${expectedCount})`);
    }
    repeatIssueForNewErrors(
      errors,
      errorCountBeforeCoverage,
      diagnosticIssues,
      {
        family: 'draft_contract',
        code: 'coverage_invalid',
        locator: {
          kind: 'collection',
          collectionRole: 'page_contracts',
          fieldRole: 'coverage',
        },
      },
    );
  }

  for (const [pageIndex, page] of (contract.pageContracts ?? []).entries()) {
    const label = typeof page.pageNumber === 'number' ? `page ${page.pageNumber}` : 'page (?)';

    // (1) exact per-page coverage — a zone is REQUIRED in vNext (base already verified the location and that a
    // present zoneId belongs to the page's location).
    const errorCountBeforeSpatialBinding = errors.length;
    if (!isStr(page.zoneId)) {
      errors.push(`${label} has no zoneId (vNext requires every page to resolve to a location + zone)`);
    }
    repeatIssueForNewErrors(
      errors,
      errorCountBeforeSpatialBinding,
      diagnosticIssues,
      pageFinalStructuralIssue(
        page,
        pageIndex,
        'page_spatial_binding_invalid',
      ),
    );

    // (2) cast resolution — castIds is REQUIRED (fail-closed): every page must declare its cast, and every
    // entry must resolve to a defined member. A missing/omitted castIds is a hole, not a pass.
    const errorCountBeforeCastBinding = errors.length;
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
    repeatIssueForNewErrors(
      errors,
      errorCountBeforeCastBinding,
      diagnosticIssues,
      pageFinalStructuralIssue(page, pageIndex, 'page_cast_binding_invalid'),
    );

    // (2b) characterPresence MUST be backed by castIds, both directions (fail-closed): a page cannot claim a
    // character is present without declaring it, nor list one it claims is absent.
    const errorCountBeforeCharacterPresence = errors.length;
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
    repeatIssueForNewErrors(
      errors,
      errorCountBeforeCharacterPresence,
      diagnosticIssues,
      pageFinalStructuralIssue(
        page,
        pageIndex,
        'page_character_presence_invalid',
      ),
    );

    // (2c) a recurring human listed on a page MUST record that page in its pagesPresent (reverse binding).
    const errorCountBeforeHumanPresence = errors.length;
    if (typeof page.pageNumber === 'number') {
      for (const id of pageCastIds) {
        if (humanIds.has(id) && !humanPagesById.get(id)?.has(page.pageNumber)) {
          errors.push(`${label} lists human "${id}" in castIds but page ${page.pageNumber} is not in its pagesPresent`);
        }
      }
    }
    repeatIssueForNewErrors(
      errors,
      errorCountBeforeHumanPresence,
      diagnosticIssues,
      pageFinalStructuralIssue(
        page,
        pageIndex,
        'page_human_presence_binding_invalid',
      ),
    );

    // (3) transitions well-formed.
    const errorCountBeforeTransition = errors.length;
    validateTransition(label, page, zoneIds, errors);
    repeatIssueForNewErrors(
      errors,
      errorCountBeforeTransition,
      diagnosticIssues,
      pageFinalStructuralIssue(page, pageIndex, 'page_transition_invalid'),
    );
  }

  // (2d) CROSS-FIELD fail-closed: a page whose `mustShow` POSITIVELY references a cast member declared ABSENT (its
  // id is NOT in that page's castIds) is a semantic contradiction that survives every structural check and would
  // reach the image prompt (the fox_uri "MUST SHOW: Uri…" while castIds:[child] bug). Reject it. Only `mustShow`
  // (positive) is checked — `mustNotShow`/camera negative references are legitimate — and possessive/genitive
  // references ("the doctor's door", "דלת הרופא") are excluded by the present-mention matcher.
  for (const c of mustShowAbsenceContradictions(contract)) {
    const pageIndex = contract.pageContracts.findIndex(
      (page) => page.pageNumber === c.page,
    );
    errors.push(
      `page ${c.page}.mustShow positively references ${c.role} "${c.id}" but that cast member is ABSENT on this page (not in castIds) — cross-field contradiction`,
    );
    diagnosticIssues.push({
      family: 'draft_contract',
      code: 'cast_authority_mismatch',
      locator: draftValidationLocatorForUntrustedPage({
        positiveKind: 'page',
        pageNumber: c.page,
        fieldRole: 'cast_presence',
        fallbackCollectionRole: 'page_contracts',
        itemIndex: pageIndex,
      }),
    });
  }

  // (4) recurring human cast well-formed (+ forward castIds binding).
  if (contract.humanCast !== undefined) {
    const errorCountBeforeHumanCast = errors.length;
    if (!Array.isArray(contract.humanCast)) {
      errors.push('humanCast must be an array');
    } else {
      validateHumanCast(contract.humanCast, pageNumbers, castIdsByPage, errors);
    }
    repeatIssueForNewErrors(
      errors,
      errorCountBeforeHumanCast,
      diagnosticIssues,
      {
        family: 'draft_contract',
        code: 'final_structural_invariant_invalid',
        locator: { kind: 'collection', collectionRole: 'human_cast', fieldRole: 'final_structure' },
      },
    );
  }

  // (3b) cross-page CONTINUITY — consecutive pages must be connected by a DECLARED move (a forward state
  // machine over pages in ascending order). Per-page alignment alone is insufficient: a `steady` page can be
  // legal on its own yet silently change zone/location from the page before it. So every scene move MUST be
  // carried by a transition:
  //   • `steady` / `before_transition` declare NO move — the page's zone must EQUAL the previous page's zone
  //     (a before_transition is still standing in the ORIGIN, about to leave).
  //   • `threshold` / `after_transition` declare a move — they must depart from an established zone. A
  //     threshold may be rendered at the origin OR destination, so the matching after_transition may follow
  //     even when the immediately previous visible zone is already the destination.
  // This closes the "undeclared scene move" hole (a steady page teleporting to another zone/location without a
  // transition) and, by induction from the first page, guarantees a page can never sit in a zone the story has
  // not transitioned into. The first page establishes the opening zone (nothing precedes it).
  {
    const pagesSorted = [...(contract.pageContracts ?? []).entries()]
      .filter(([, page]) => typeof page.pageNumber === 'number')
      .sort(([, left], [, right]) => left.pageNumber - right.pageNumber);
    const establishedZones = new Set<string>();
    let previousZone: string | undefined;
    let previousPage: number | undefined;
    let lastThresholdEdge: { fromZoneId: string; toZoneId: string } | undefined;
    for (const [pageIndex, p] of pagesSorted) {
      const errorCountBeforePageContinuity = errors.length;
      const kind: PageTransition['kind'] = p.transition?.kind ?? 'steady';
      // (C2) The opening page establishes the origin — nothing precedes it — so it CANNOT declare a DEPARTING move.
      // A threshold/after_transition first page would depart from an origin no prior page established (the per-page
      // "departs from an established zone" check below is SKIPPED while previousZone is undefined). steady and
      // before_transition (which declare no move and stand in the origin) remain valid on page 1.
      if (previousZone === undefined && (kind === 'threshold' || kind === 'after_transition')) {
        errors.push(
          `page ${p.pageNumber} declares a ${kind} transition with no established origin — the opening page must be steady or before_transition (nothing precedes it to depart from)`,
        );
      }
      if (previousZone !== undefined && isStr(p.zoneId)) {
        if (kind === 'steady' || kind === 'before_transition') {
          if (p.zoneId !== previousZone) {
            errors.push(
              `page ${p.pageNumber} moves to zone "${p.zoneId}" from "${previousZone}" (page ${previousPage}) without a transition — a ${kind} page declares no move (undeclared scene move)`,
            );
          }
          lastThresholdEdge = undefined;
        } else {
          const from = p.transition?.fromZoneId;
          const to = p.transition?.toZoneId;
          if (isStr(from) && !establishedZones.has(from)) {
            errors.push(
              `page ${p.pageNumber} (${kind}) departs from "${from}" but that zone has not been established yet`,
            );
          }
          const continuesThreshold =
            kind === 'after_transition' &&
            isStr(from) &&
            isStr(to) &&
            lastThresholdEdge?.fromZoneId === from &&
            lastThresholdEdge.toZoneId === to;
          if (isStr(from) && from !== previousZone && !continuesThreshold) {
            errors.push(
              `page ${p.pageNumber} (${kind}) departs from "${from}" but the previous page (${previousPage}) was in "${previousZone}" — the move is not continuous (undeclared scene move)`,
            );
          }
          if (kind === 'threshold' && isStr(from) && isStr(to)) {
            lastThresholdEdge = { fromZoneId: from, toZoneId: to };
          } else {
            lastThresholdEdge = undefined;
          }
          if (isStr(to)) establishedZones.add(to);
        }
      }
      if (isStr(p.zoneId)) {
        establishedZones.add(p.zoneId);
        previousZone = p.zoneId;
        previousPage = p.pageNumber;
      }
      repeatIssueForNewErrors(
        errors,
        errorCountBeforePageContinuity,
        diagnosticIssues,
        pageFinalStructuralIssue(
          p,
          pageIndex,
          'page_transition_invalid',
        ),
      );
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      diagnosticIssues,
    };
  }
  return { ok: true, contract };
}

/** Fail-closed assertion for the vNext production/import path: throws on any structural problem. */
export function assertValidVNextVisualContract(
  input: unknown,
): asserts input is BookVisualContract {
  const result = validateVNextVisualContract(input);
  if (!result.ok) {
    throw new InvalidVNextVisualContractError(
      result.errors,
      result.diagnosticIssues,
    );
  }
}
