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
import { bindingCoherenceError } from './appearanceBindingCoherence';
import { DEFERRAL_MARKERS, validateEvidenceOrigin } from './validateTemplateContract';
import {
  projectResolvedCoarseAppearance,
  projectResolvedWardrobeDescription,
} from './projectResolvedHumanProse';
import {
  MATERIALIZER_VERSION,
  PALETTE_VERSION,
  APPROVED_RUNTIME_AUTHORITY_VERSION,
  RELATIVE_ROLES,
  VISUAL_CONTRACT_SCHEMA_VERSION,
  type ResolvedBookVisualContract,
  type ResolvedHumanCastMember,
} from './contractTemplateTypes';

const WORLD_MODES = new Set(['grounded', 'grounded_with_visual_metaphor', 'fantastical']);

/** Roles for which a `family_profile` binding is legal (relatives share the hero's appearance band; a doctor is NOT). */
const RELATIVE = new Set<string>(RELATIVE_ROLES);

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isStr(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isConcreteTrait(t: unknown): boolean {
  return isObj(t) && isStr((t as { value?: unknown }).value) && !DEFERRAL_MARKERS.test((t as { value: string }).value);
}

/**
 * FULL typed-binding validation for a resolved appearance/garment binding (Fix 3): validates the origin PAYLOAD (via
 * the shared Template checker), mode↔origin coherence, `family_profile` relatives-only, and — for a
 * `deterministic_palette` origin — that its recorded `version` matches the actual palette version the contract was
 * materialized under. Preserves, on the RESOLVED, the same invariants the Template validator enforces at authoring.
 */
function validateResolvedBinding(
  label: string,
  role: string,
  binding: unknown,
  paletteVersion: unknown,
  errors: string[],
): void {
  const origin = isObj(binding) ? (binding as { origin?: unknown }).origin : undefined;
  const mode = isObj(binding) ? (binding as { mode?: unknown }).mode : undefined;
  const originKind = validateEvidenceOrigin(label, origin, errors);
  const coherenceError = bindingCoherenceError(label, mode, originKind);
  if (coherenceError) errors.push(coherenceError);
  if (mode === 'family_profile' && !RELATIVE.has(role)) {
    errors.push(
      `${label}.mode=family_profile is illegal for non-relative role "${role}" (relatives only: ${[...RELATIVE].join('|')})`,
    );
  }
  // A deterministic_palette pick must have been drawn from the SAME palette version the Resolved records at top level
  // — otherwise the recorded provenance does not match the appearance that was actually frozen (a stale-version drift).
  if (originKind === 'deterministic_palette') {
    const version = isObj(origin) ? (origin as { version?: unknown }).version : undefined;
    if (version !== paletteVersion) {
      errors.push(
        `${label}.origin(deterministic_palette).version ${JSON.stringify(version)} != contract paletteVersion ${JSON.stringify(paletteVersion)}`,
      );
    }
  }
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

  // (Fix 3a) Supported versions — the frozen hash is only meaningful under the versions this build materializes/renders.
  if (input.schemaVersion !== VISUAL_CONTRACT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must equal the supported "${VISUAL_CONTRACT_SCHEMA_VERSION}" (got ${JSON.stringify(input.schemaVersion)})`);
  }
  if (input.materializerVersion !== MATERIALIZER_VERSION) {
    errors.push(`materializerVersion must equal the supported "${MATERIALIZER_VERSION}" (got ${JSON.stringify(input.materializerVersion)})`);
  }
  if (input.paletteVersion !== PALETTE_VERSION) {
    errors.push(`paletteVersion must equal the supported "${PALETTE_VERSION}" (got ${JSON.stringify(input.paletteVersion)})`);
  }

  // Optional for legacy resolved contracts, but when present this source-bound package identity is all-or-nothing.
  // The enforced Style01 runtime layer separately requires it and compares it to the current approved manifest.
  if (input.approvedRuntimeAuthority !== undefined) {
    const authority = input.approvedRuntimeAuthority;
    if (!isObj(authority)) {
      errors.push('approvedRuntimeAuthority must be an object when present');
    } else {
      if (authority.version !== APPROVED_RUNTIME_AUTHORITY_VERSION) {
        errors.push(`approvedRuntimeAuthority.version must equal "${APPROVED_RUNTIME_AUTHORITY_VERSION}"`);
      }
      if (authority.manifestVersion !== 'visual-package/v2') {
        errors.push('approvedRuntimeAuthority.manifestVersion must equal "visual-package/v2"');
      }
      for (const field of [
        'storyKey',
        'styleId',
        'sourcePath',
        'sourceDigest',
        'templatePath',
        'templateDigest',
        'coverageDigest',
        'requiredBoardsDigest',
        'requiredPropReferencesDigest',
      ] as const) {
        if (!isStr(authority[field])) errors.push(`approvedRuntimeAuthority.${field} missing`);
      }
      if (!isStr(authority.worldMode) || !WORLD_MODES.has(authority.worldMode)) {
        errors.push('approvedRuntimeAuthority.worldMode must be grounded|grounded_with_visual_metaphor|fantastical');
      }
      if (isStr(input.storyKey) && authority.storyKey !== input.storyKey) {
        errors.push('approvedRuntimeAuthority.storyKey must equal the frozen contract storyKey');
      }
    }
  }

  // Superset of vNext: it must be structurally renderable (locations/zones/cast/cover/coverage/transitions/castIds).
  const base = validateVNextVisualContract(input);
  if (!base.ok) errors.push(...base.errors.map((e) => `structure: ${e}`));

  const humanCast: ResolvedHumanCastMember[] = Array.isArray(input.humanCast)
    ? (input.humanCast as ResolvedHumanCastMember[])
    : [];
  humanCast.forEach((m, i) => {
    const label = isStr(m?.id) ? `humanCast "${m.id}"` : `humanCast[${i}]`;
    const role = isStr(m?.role) ? m.role : '';
    const appearance = isObj((m as unknown as Record<string, unknown>)?.appearance)
      ? ((m as unknown as Record<string, unknown>).appearance as Record<string, unknown>)
      : null;
    let appearanceConcrete = true;
    if (!appearance) {
      errors.push(`${label}.appearance missing concrete skin/hair/style traits`);
      appearanceConcrete = false;
    } else {
      for (const trait of ['skinTone', 'hairColour', 'hairTexture', 'hairStyle'] as const) {
        const binding = appearance[trait];
        if (!isConcreteTrait(binding)) {
          errors.push(`${label}.appearance.${trait} is not a concrete resolved value (still deferred/unresolved)`);
          appearanceConcrete = false;
          continue;
        }
        // (Fix 3) FULL typed-binding validation — origin payload completeness, mode/origin coherence,
        // family_profile relatives-only, and palette-version provenance. Preserves the Template invariants here so a
        // Resolved that never round-tripped through the Template validator (resume cache, alt producer) is still gated.
        validateResolvedBinding(`${label}.appearance.${trait}`, role, binding, input.paletteVersion, errors);
      }
    }
    let garmentsConcrete = true;
    if (!Array.isArray(m?.garments)) {
      errors.push(`${label}.garments must be an array of concrete-coloured garments`);
      garmentsConcrete = false;
    } else {
      m.garments.forEach((g, gi) => {
        const glabel = `${label}.garments[${isStr(g?.id) ? g.id : gi}]`;
        const colour = (g as { colour?: unknown })?.colour;
        if (!isConcreteTrait(colour)) {
          errors.push(`${glabel}.colour is not a concrete resolved colour`);
          garmentsConcrete = false;
          return;
        }
        // (Fix 3) A garment colour is AUTHORED — it must be an `explicit` binding, never family/palette (a garment
        // colour is not ethnicity). This preserves, on the Resolved, the Template's garment-explicit rule.
        if (isObj(colour) && (colour as { mode?: unknown }).mode !== 'explicit') {
          errors.push(`${glabel}.colour must be an explicit binding (garment colours are authored, not family/palette)`);
        }
        validateResolvedBinding(glabel + '.colour', role, colour, input.paletteVersion, errors);
      });
    }
    // The projected prose must not smuggle deferral text back in.
    if (isStr(m?.coarseAppearance) && DEFERRAL_MARKERS.test(m.coarseAppearance)) {
      errors.push(`${label}.coarseAppearance still contains deferral/placeholder prose`);
    }
    // (Fix 3c) Deterministic projection EQUALITY — the stored prose must EQUAL the shared projection of the structured
    // traits, so the human-readable prose can never diverge from the authoritative source. Only when fully concrete
    // (otherwise the concreteness errors above already fired and the projection inputs are unsafe to read).
    if (appearanceConcrete && garmentsConcrete) {
      const expectedCoarse = projectResolvedCoarseAppearance(m);
      if (m.coarseAppearance !== expectedCoarse) {
        errors.push(`${label}.coarseAppearance does not EQUAL the deterministic projection of its structured traits`);
      }
      const wardrobe = isObj((m as unknown as Record<string, unknown>)?.wardrobe)
        ? ((m as unknown as Record<string, unknown>).wardrobe as { description?: unknown })
        : null;
      const expectedWardrobe = projectResolvedWardrobeDescription(m.garments);
      if (!wardrobe || wardrobe.description !== expectedWardrobe) {
        errors.push(`${label}.wardrobe.description does not EQUAL the deterministic projection of its garments`);
      }
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
