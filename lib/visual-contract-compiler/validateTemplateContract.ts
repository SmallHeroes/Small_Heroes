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
import type { BookVisualContract, RecurringHumanCastMember } from './types';
import {
  RELATIVE_ROLES,
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

function validateEvidenceOrigin(label: string, origin: unknown, errors: string[]): string | undefined {
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
  // The origin must be COHERENT with the mode — never a fabricated story phrase for a compiler pick.
  if (mode === 'family_profile' && originKind && originKind !== 'family_profile') {
    errors.push(`${label} family_profile mode requires a family_profile origin (got ${originKind})`);
  }
  if (mode === 'deterministic_palette' && originKind && originKind !== 'deterministic_palette') {
    errors.push(`${label} deterministic_palette mode requires a deterministic_palette origin (got ${originKind})`);
  }
  if (mode === 'explicit') {
    if (originKind && originKind !== 'story_evidence' && originKind !== 'policy_default') {
      errors.push(`${label} explicit mode requires a story_evidence or policy_default origin (got ${originKind})`);
    }
    if (!isStr(binding.value)) errors.push(`${label} explicit binding must carry a concrete value`);
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
    aliases: Array.isArray(m.aliases) ? m.aliases : [],
    coarseAppearance: 'template-unresolved',
    wardrobe: { description: 'template-unresolved' },
    textEvidence: 'template-unresolved',
    forbiddenAppearance: Array.isArray(m.forbiddenAppearance) ? m.forbiddenAppearance : [],
    pagesPresent: Array.isArray(m.pagesPresent) ? m.pagesPresent : [],
  };
}

export function validateBookVisualContractTemplate(input: unknown): TemplateValidationResult {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ['template is not an object'] };

  if (input.contractKind !== 'template') errors.push('contractKind must be "template"');
  if (!isStr(input.schemaVersion)) errors.push('schemaVersion missing');

  const humanCast: TemplateHumanCastMember[] = Array.isArray(input.humanCast)
    ? (input.humanCast as TemplateHumanCastMember[])
    : [];
  if (!Array.isArray(input.humanCast)) errors.push('humanCast must be an array');

  // Structural reuse: a vNext shadow with placeholder prose exercises the exact coverage/transition/castIds/
  // humanCast pagesPresent binding rules; Template-specific structured checks layer on the REAL humanCast below.
  const shadow: BookVisualContract = {
    version: (typeof input.version === 'number' ? input.version : 1) as BookVisualContract['version'],
    ...(isStr(input.storyKey) ? { storyKey: input.storyKey } : {}),
    worldType: input.worldType as string,
    locations: (Array.isArray(input.locations) ? input.locations : []) as BookVisualContract['locations'],
    zones: (Array.isArray(input.zones) ? input.zones : []) as BookVisualContract['zones'],
    cast: input.cast as BookVisualContract['cast'],
    humanCast: humanCast.map(toShadowHuman),
    recurringProps: (Array.isArray(input.recurringProps) ? input.recurringProps : []) as BookVisualContract['recurringProps'],
    forbiddenGlobalElements: (Array.isArray(input.forbiddenGlobalElements) ? input.forbiddenGlobalElements : []) as string[],
    coverContract: input.coverContract as BookVisualContract['coverContract'],
    pageContracts: (Array.isArray(input.pageContracts) ? input.pageContracts : []) as BookVisualContract['pageContracts'],
    ...(input.provenance ? { provenance: input.provenance as BookVisualContract['provenance'] } : {}),
  };
  const base = validateVNextVisualContract(shadow);
  if (!base.ok) errors.push(...base.errors.map((e) => `structure: ${e}`));

  humanCast.forEach((m, i) => {
    const label = isStr(m?.id) ? `humanCast "${m.id}"` : `humanCast[${i}]`;
    const role = isStr(m?.role) ? m.role : '';
    if (!isStr(m?.textEvidence)) errors.push(`${label}.textEvidence missing (identity must bind to a story phrase)`);
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
    if (!Array.isArray(m?.garments)) {
      errors.push(`${label}.garments must be an array`);
    } else {
      m.garments.forEach((g, gi) => {
        const glabel = `${label}.garments[${isStr(g?.id) ? g.id : gi}]`;
        if (!isStr(g?.id)) errors.push(`${glabel}.id missing`);
        const colour = (g as { colour?: unknown })?.colour;
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

/** Fail-closed assertion — throws InvalidTemplateContractError on any problem. */
export function assertValidBookVisualContractTemplate(
  input: unknown,
): asserts input is BookVisualContractTemplate {
  const result = validateBookVisualContractTemplate(input);
  if (!result.ok) throw new InvalidTemplateContractError(result.errors);
}
