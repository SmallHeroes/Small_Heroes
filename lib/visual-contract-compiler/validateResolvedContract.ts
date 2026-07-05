/**
 * Fail-closed validation of a `ResolvedBookVisualContract` (P0). PURE — no I/O, no clock, no live-path imports.
 *
 * A Resolved contract is a SUPERSET of vNext `BookVisualContract`, so this runs the vNext validator first (it must
 * be structurally renderable), then asserts FULL concreteness:
 *   - NO unresolved/deferred trait — every recurring human's skin/hair/style + every garment colour is a concrete
 *     value with no `deferred` / `family lock` / `not fixed` placeholder text (the vague-prose drift is gone);
 *   - the projected `coarseAppearance` prose carries no deferral text either;
 *   - it is NOT a Template (unresolved bindings / `contractKind: 'template'`) — guarded, so a Template can never be
 *     frozen/rendered as a Resolved.
 * This is what P1's render guard will call before spend.
 */
import { validateVNextVisualContract } from './validateVNextVisualContract';
import type { ResolvedBookVisualContract, ResolvedHumanCastMember } from './contractTemplateTypes';

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isStr(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Placeholder / deferral text that must NOT survive into a Resolved contract's concrete values or projected prose. */
const DEFERRAL_MARKERS = /deferred|not\s+(?:set|fixed)\s+here|per-order\s+family|family\s+(?:appearance\s+)?lock|free-pick|unresolved|template-unresolved/i;

function isConcreteTrait(t: unknown): boolean {
  return isObj(t) && isStr((t as { value?: unknown }).value) && !DEFERRAL_MARKERS.test((t as { value: string }).value);
}

export type ResolvedValidationResult =
  | { ok: true; contract: ResolvedBookVisualContract }
  | { ok: false; errors: string[] };

export class InvalidResolvedContractError extends Error {
  readonly isInvalidResolvedContract = true as const;
  constructor(readonly errors: string[]) {
    super(`Invalid ResolvedBookVisualContract: ${errors.join('; ')}`);
    this.name = 'InvalidResolvedContractError';
  }
}

export function validateResolvedBookVisualContract(input: unknown): ResolvedValidationResult {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ['resolved contract is not an object'] };

  // A Template must NEVER be frozen/rendered as a Resolved.
  if (input.contractKind === 'template') {
    errors.push('a Template (contractKind="template") must not be validated/frozen as a Resolved contract');
  } else if (input.contractKind !== 'resolved') {
    errors.push('contractKind must be "resolved"');
  }

  // Superset of vNext: it must be structurally renderable (locations/zones/cast/cover/coverage/transitions/castIds).
  const base = validateVNextVisualContract(input);
  if (!base.ok) errors.push(...base.errors.map((e) => `structure: ${e}`));

  const humanCast: ResolvedHumanCastMember[] = Array.isArray(input.humanCast)
    ? (input.humanCast as ResolvedHumanCastMember[])
    : [];
  humanCast.forEach((m, i) => {
    const label = isStr(m?.id) ? `humanCast "${m.id}"` : `humanCast[${i}]`;
    const appearance = isObj((m as unknown as Record<string, unknown>)?.appearance)
      ? ((m as unknown as Record<string, unknown>).appearance as Record<string, unknown>)
      : null;
    if (!appearance) {
      errors.push(`${label}.appearance missing concrete skin/hair/style traits`);
    } else {
      for (const trait of ['skinTone', 'hairColour', 'hairStyle'] as const) {
        if (!isConcreteTrait(appearance[trait])) {
          errors.push(`${label}.appearance.${trait} is not a concrete resolved value (still deferred/unresolved)`);
        }
      }
    }
    if (!Array.isArray(m?.garments)) {
      errors.push(`${label}.garments must be an array of concrete-coloured garments`);
    } else {
      m.garments.forEach((g, gi) => {
        const glabel = `${label}.garments[${isStr(g?.id) ? g.id : gi}]`;
        if (!isConcreteTrait((g as { colour?: unknown })?.colour)) {
          errors.push(`${glabel}.colour is not a concrete resolved colour`);
        }
      });
    }
    // The projected prose must not smuggle deferral text back in.
    if (isStr(m?.coarseAppearance) && DEFERRAL_MARKERS.test(m.coarseAppearance)) {
      errors.push(`${label}.coarseAppearance still contains deferral/placeholder prose`);
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, contract: input as unknown as ResolvedBookVisualContract };
}

/** Fail-closed assertion — throws InvalidResolvedContractError on any problem. */
export function assertValidResolvedBookVisualContract(
  input: unknown,
): asserts input is ResolvedBookVisualContract {
  const result = validateResolvedBookVisualContract(input);
  if (!result.ok) throw new InvalidResolvedContractError(result.errors);
}
