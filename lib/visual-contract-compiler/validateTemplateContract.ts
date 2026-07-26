/**
 * Fail-closed validation of a `BookVisualContractTemplate` (P0). PURE — no I/O, no clock, no live-path imports.
 *
 * Reuses the vNext structural validator (locations/zones/cast/cover/coverage/transitions/castIds/humanCast
 * pagesPresent bindings) via a placeholder-prose SHADOW, then layers the Template-specific rules on the REAL
 * structured human cast:
 *   - binding-mode legality: `family_profile` is relatives-ONLY (the clinic-doctor fix);
 *   - a typed evidence origin is present + well-formed AND coherent with the mode (no fabricated story phrase);
 *   - structured appearance slots (skinTone/hairColour/hairStyle) + every garment colour are populated bindings;
 *   - `explicit` carries a concrete value; `family_profile`/`deterministic_palette` carry NO value (resolved later).
 * This REPLACES the vNext humanCast prose checks (validateVNextVisualContract.ts:157-159) for templates.
 */
import { validateVNextVisualContract } from './validateVNextVisualContract';
import { bindingCoherenceError } from './appearanceBindingCoherence';
import type { BookVisualContract, RecurringHumanCastMember } from './types';
import {
  RELATIVE_ROLES,
  VISUAL_CONTRACT_SCHEMA_VERSION,
  type AppearanceBindingMode,
  type BookVisualContractTemplate,
  type TemplateHumanCastMember,
} from './contractTemplateTypes';

const BINDING_MODES = new Set<AppearanceBindingMode>(['explicit', 'family_profile', 'deterministic_palette']);
const RELATIVE = new Set<string>(RELATIVE_ROLES);

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isStr(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function safeObjectArray(
  value: unknown,
  field: string,
  errors: string[],
  options: { optional?: boolean } = {},
): Record<string, unknown>[] | undefined {
  if (value === undefined && options.optional) return undefined;
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return [];
  }
  const safe: Record<string, unknown>[] = [];
  value.forEach((entry, index) => {
    if (!isObj(entry)) {
      errors.push(`${field}[${index}] must be an object`);
      // Preserve the durable source index for subsequent field-level validation
      // while ensuring typed projectors only receive object-shaped elements.
      safe.push({});
      return;
    }
    safe.push(entry);
  });
  return safe;
}

function safeStringArray(
  value: unknown,
  field: string,
  errors: string[],
): string[] {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return [];
  }
  const safe: string[] = [];
  value.forEach((entry, index) => {
    if (typeof entry !== 'string') {
      errors.push(`${field}[${index}] must be a string`);
      return;
    }
    safe.push(entry);
  });
  return safe;
}

function safeNumberArray(
  value: unknown,
  field: string,
  errors: string[],
): number[] {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return [];
  }
  const safe: number[] = [];
  value.forEach((entry, index) => {
    if (typeof entry !== 'number' || !Number.isFinite(entry)) {
      errors.push(`${field}[${index}] must be a finite number`);
      return;
    }
    safe.push(entry);
  });
  return safe;
}

/**
 * Placeholder / deferral text that must NOT survive into a concrete `explicit` value (Template) or a Resolved
 * contract's concrete values / projected prose (Resolved). The AUTHORITATIVE single source — imported by
 * `validateResolvedContract.ts` so the two validators can't drift (dependency direction: resolved → template).
 */
export const DEFERRAL_MARKERS =
  /deferred|not\s+(?:set|fixed)\s+here|per-order\s+family|family\s+(?:appearance\s+)?lock|free-pick|unresolved|template-unresolved/i;

export type TemplateValidationResult =
  | { ok: true; template: BookVisualContractTemplate }
  | { ok: false; errors: string[] };

export class InvalidTemplateContractError extends Error {
  readonly isInvalidTemplateContract = true as const;
  constructor(readonly errors: string[]) {
    super(`Invalid BookVisualContractTemplate: ${errors.join('; ')}`);
    this.name = 'InvalidTemplateContractError';
  }
}

/**
 * Validate a typed evidence origin's PAYLOAD (not just its kind) and return the kind, or `undefined` when it is
 * missing/malformed. EXPORTED as the single source of origin-payload validation — `validateResolvedContract.ts`
 * reuses it so Template and Resolved can't drift on what a complete origin looks like.
 */
export function validateEvidenceOrigin(label: string, origin: unknown, errors: string[]): string | undefined {
  if (!isObj(origin) || !isStr(origin.kind)) {
    errors.push(`${label}.origin missing/invalid (a typed evidence origin is required)`);
    return undefined;
  }
  switch (origin.kind) {
    case 'story_evidence':
      if (typeof origin.page !== 'number') errors.push(`${label}.origin(story_evidence).page must be a number`);
      if (!isStr(origin.phrase)) errors.push(`${label}.origin(story_evidence).phrase missing`);
      break;
    case 'family_profile':
      break;
    case 'policy_default':
      if (!isStr(origin.policyId)) errors.push(`${label}.origin(policy_default).policyId missing`);
      if (!isStr(origin.version)) errors.push(`${label}.origin(policy_default).version missing`);
      break;
    case 'deterministic_palette':
      if (!isStr(origin.paletteId)) errors.push(`${label}.origin(deterministic_palette).paletteId missing`);
      if (!isStr(origin.version)) errors.push(`${label}.origin(deterministic_palette).version missing`);
      break;
    default:
      errors.push(`${label}.origin.kind unknown "${String(origin.kind)}"`);
  }
  return origin.kind;
}

/** A trait binding: valid mode + relatives-only family_profile + a mode-coherent typed origin + value rules. */
function validateBinding(label: string, role: string, binding: unknown, errors: string[]): void {
  if (!isObj(binding) || !isStr(binding.mode)) {
    errors.push(`${label} is missing or not a binding object`);
    return;
  }
  const mode = binding.mode as AppearanceBindingMode;
  if (!BINDING_MODES.has(mode)) {
    errors.push(`${label}.mode invalid "${String(binding.mode)}"`);
    return;
  }
  if (mode === 'family_profile' && !RELATIVE.has(role)) {
    errors.push(
      `${label}.mode=family_profile is illegal for non-relative role "${role}" (relatives only: ${[...RELATIVE].join('|')})`,
    );
  }
  const originKind = validateEvidenceOrigin(label, binding.origin, errors);
  // The origin must be COHERENT with the mode — never a fabricated story phrase for a compiler pick (shared rule).
  const coherenceError = bindingCoherenceError(label, mode, originKind);
  if (coherenceError) errors.push(coherenceError);
  if (mode === 'explicit') {
    if (!isStr(binding.value)) {
      errors.push(`${label} explicit binding must carry a concrete value`);
    } else if (DEFERRAL_MARKERS.test(binding.value)) {
      // An `explicit` value is authored + concrete; deferral/placeholder prose smuggled in here would materialize
      // verbatim into the Resolved. Reject it at authoring time (belt; the Resolved validator is the money-path gate).
      errors.push(`${label} explicit binding value looks like deferral/placeholder text (${JSON.stringify(binding.value)}) — author a concrete value`);
    }
  } else if (binding.value !== undefined) {
    errors.push(`${label} ${mode} binding must NOT carry a value in a Template (it is resolved per order)`);
  }
}

/** Project a Template human to a vNext-shaped shadow (placeholder prose) so the vNext structural checks can run. */
function toShadowHuman(m: TemplateHumanCastMember): RecurringHumanCastMember {
  return {
    id: m.id,
    role: m.role,
    gender: m.gender,
    aliases: Array.isArray(m.aliases)
      ? m.aliases.filter((entry): entry is string => typeof entry === 'string')
      : [],
    coarseAppearance: 'template-unresolved',
    wardrobe: { description: 'template-unresolved' },
    textEvidence: 'template-unresolved',
    forbiddenAppearance: Array.isArray(m.forbiddenAppearance)
      ? m.forbiddenAppearance.filter((entry): entry is string => typeof entry === 'string')
      : [],
    pagesPresent: Array.isArray(m.pagesPresent)
      ? m.pagesPresent.filter((entry): entry is number => typeof entry === 'number')
      : [],
  };
}

function validateBookVisualContractTemplateInternal(input: unknown): TemplateValidationResult {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ['template is not an object'] };

  if (input.contractKind !== 'template') errors.push('contractKind must be "template"');
  if (input.schemaVersion !== VISUAL_CONTRACT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must equal the supported "${VISUAL_CONTRACT_SCHEMA_VERSION}" (got ${JSON.stringify(input.schemaVersion)})`);
  }
  // storyKey is REQUIRED + non-empty: it seeds the deterministic palette; an empty key collapses the seed across stories.
  if (!isStr(input.storyKey)) errors.push('storyKey missing (required — it seeds the deterministic appearance palette)');

  // Durable arrays remain invalid when malformed, but only safe local elements reach typed projectors and the
  // vNext shadow. Sanitizing here is solely for deterministic continued error collection; `errors` preserves the
  // rejection of the original artifact.
  const humanCast = (safeObjectArray(input.humanCast, 'humanCast', errors) ??
    []) as unknown as TemplateHumanCastMember[];
  const recurringProps = (safeObjectArray(input.recurringProps, 'recurringProps', errors) ??
    []) as unknown as BookVisualContract['recurringProps'];
  const locations = (safeObjectArray(input.locations, 'locations', errors) ??
    []) as unknown as BookVisualContract['locations'];
  const zones = (safeObjectArray(input.zones, 'zones', errors) ??
    []) as unknown as BookVisualContract['zones'];
  const pageContracts = (safeObjectArray(input.pageContracts, 'pageContracts', errors) ??
    []) as unknown as BookVisualContract['pageContracts'];
  const setBoardAuthorities = safeObjectArray(
    input.setBoardAuthorities,
    'setBoardAuthorities',
    errors,
    { optional: true },
  ) as BookVisualContract['setBoardAuthorities'] | undefined;
  const forbiddenGlobalElements = safeStringArray(
    input.forbiddenGlobalElements,
    'forbiddenGlobalElements',
    errors,
  );

  // Structural reuse: a vNext shadow with placeholder prose exercises the exact coverage/transition/castIds/
  // humanCast pagesPresent binding rules; Template-specific structured checks layer on the REAL humanCast below.
  const shadow: BookVisualContract = {
    version: (typeof input.version === 'number' ? input.version : 1) as BookVisualContract['version'],
    ...(isStr(input.storyKey) ? { storyKey: input.storyKey } : {}),
    worldType: input.worldType as string,
    locations,
    zones,
    ...(setBoardAuthorities !== undefined ? { setBoardAuthorities } : {}),
    cast: input.cast as BookVisualContract['cast'],
    humanCast: humanCast.map(toShadowHuman),
    recurringProps,
    forbiddenGlobalElements,
    coverContract: input.coverContract as BookVisualContract['coverContract'],
    pageContracts,
    ...(input.provenance ? { provenance: input.provenance as BookVisualContract['provenance'] } : {}),
  };
  const base = validateVNextVisualContract(shadow);
  if (!base.ok) errors.push(...base.errors.map((e) => `structure: ${e}`));

  recurringProps.forEach((prop, index) => {
    if (!isStr(prop.name)) errors.push(`recurringProps[${index}].name missing`);
    if (!isStr(prop.description)) errors.push(`recurringProps[${index}].description missing`);
  });

  humanCast.forEach((m, i) => {
    const label = isStr(m?.id) ? `humanCast "${m.id}"` : `humanCast[${i}]`;
    const role = isStr(m?.role) ? m.role : '';
    if (!isStr(m?.textEvidence)) errors.push(`${label}.textEvidence missing (identity must bind to a story phrase)`);
    safeStringArray(m.aliases, `${label}.aliases`, errors);
    safeStringArray(m.forbiddenAppearance, `${label}.forbiddenAppearance`, errors);
    safeNumberArray(m.pagesPresent, `${label}.pagesPresent`, errors);
    const appearance = isObj((m as unknown as Record<string, unknown>)?.appearance)
      ? ((m as unknown as Record<string, unknown>).appearance as Record<string, unknown>)
      : null;
    if (!appearance) {
      errors.push(`${label}.appearance missing (structured skinTone/hairColour/hairStyle bindings)`);
    } else {
      for (const trait of ['skinTone', 'hairColour', 'hairTexture', 'hairStyle'] as const) {
        if (appearance[trait] === undefined) errors.push(`${label}.appearance.${trait} missing`);
        else validateBinding(`${label}.appearance.${trait}`, role, appearance[trait], errors);
      }
    }
    if (!Array.isArray(m.garments)) {
      errors.push(`${label}.garments must be an array`);
    } else {
      m.garments.forEach((g, gi) => {
        const path = `${label}.garments[${gi}]`;
        if (!isObj(g)) {
          errors.push(`${path} must be an object`);
          return;
        }
        const glabel = isStr(g.id) ? `${label}.garments[${g.id}]` : path;
        if (!isStr(g.id)) errors.push(`${glabel}.id missing`);
        const colour = g.colour;
        if (colour === undefined) {
          errors.push(`${glabel}.colour missing`);
        } else {
          validateBinding(`${glabel}.colour`, role, colour, errors);
          // Garment colours are AUTHORED — never family/palette (a garment colour is not ethnicity).
          if (isObj(colour) && colour.mode !== 'explicit') {
            errors.push(`${glabel}.colour must be an explicit binding (garment colours are authored, not family/palette)`);
          }
        }
      });
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, template: input as unknown as BookVisualContractTemplate };
}

/**
 * Total public durable-input boundary. Root guards above own precise diagnostics; this deterministic containment
 * is defense in depth for an unforeseen malformed nested shape and can only fail closed.
 */
export function validateBookVisualContractTemplate(input: unknown): TemplateValidationResult {
  try {
    return validateBookVisualContractTemplateInternal(input);
  } catch {
    return {
      ok: false,
      errors: ['template validation could not safely inspect malformed nested input'],
    };
  }
}

/** Fail-closed assertion — throws InvalidTemplateContractError on any problem. */
export function assertValidBookVisualContractTemplate(
  input: unknown,
): asserts input is BookVisualContractTemplate {
  const result = validateBookVisualContractTemplate(input);
  if (!result.ok) throw new InvalidTemplateContractError(result.errors);
}
