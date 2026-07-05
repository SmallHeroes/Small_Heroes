/**
 * Deterministic materializer (P0) — `materialize(template, family, palette) → ResolvedBookVisualContract`.
 *
 * Resolves each recurring human's appearance ONCE (`castIds` are page PLACEMENT, not appearance), then projects the
 * vNext prose (`coarseAppearance` / `wardrobe.description`) DETERMINISTICALLY from the resolved structured traits — so
 * the prose the model sees is GENERATED from the concrete colours/styles, never a parallel editable source (this is
 * what permanently kills the vague-prose drift).
 *
 * PURE + canonically serializable: NO clock, NO randomness, NO orderId, NO `derivedAt`/metadata in the output. Same
 * (template, family, palette) → byte-identical Resolved → identical `computeVisualContractHash`. Fail-CLOSED: a family
 * gap (a `family_profile` trait the profile does not provide) or an unsupported binding throws `MaterializationError`
 * — never a silent neutral default. No live-path imports (no chunk-runner / family-coherence / prisma / render).
 */
import {
  MATERIALIZER_VERSION,
  VISUAL_CONTRACT_SCHEMA_VERSION,
  type BookVisualContractTemplate,
  type Garment,
  type ResolvedBookVisualContract,
  type ResolvedFamilyAppearanceProfile,
  type ResolvedHumanCastMember,
  type ResolvedTrait,
  type TemplateHumanCastMember,
  type TemplateTraitBinding,
} from './contractTemplateTypes';
import { DEFAULT_APPEARANCE_PALETTE, paletteEntryFor, type AppearancePalette } from './appearancePalette';
import {
  projectResolvedCoarseAppearance,
  projectResolvedWardrobeDescription,
} from './projectResolvedHumanProse';

export class MaterializationError extends Error {
  readonly isMaterializationError = true as const;
  constructor(message: string) {
    super(`materialize: ${message}`);
    this.name = 'MaterializationError';
  }
}

type HumanTrait = 'skinTone' | 'hairColour' | 'hairTexture' | 'hairStyle';

function isStr(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Resolve ONE structured human trait to a concrete value, from its binding mode. Fail-closed on any gap. */
function resolveTrait(
  member: TemplateHumanCastMember,
  trait: HumanTrait,
  binding: TemplateTraitBinding,
  storyKey: string,
  family: ResolvedFamilyAppearanceProfile,
  palette: AppearancePalette,
): ResolvedTrait {
  const label = `${member.id}.${trait}`;
  switch (binding.mode) {
    case 'explicit':
      if (!isStr(binding.value)) throw new MaterializationError(`${label} explicit binding has no value`);
      return { value: binding.value, mode: 'explicit', origin: binding.origin };
    case 'family_profile': {
      // Family provides skin tone + hair COLOUR + hair TEXTURE (ethnicity band); hair STYLE is a styling choice → explicit.
      const v =
        trait === 'skinTone' ? family.skinTone
        : trait === 'hairColour' ? family.hairColour
        : trait === 'hairTexture' ? family.hairTexture
        : undefined;
      if (!isStr(v)) throw new MaterializationError(`${label} family_profile: the family profile provides no ${trait} (no silent default)`);
      return { value: v, mode: 'family_profile', origin: binding.origin };
    }
    case 'deterministic_palette': {
      const entry = paletteEntryFor(palette, storyKey, member.id);
      const v =
        trait === 'skinTone' ? entry.skin
        : trait === 'hairColour' ? entry.hairColour
        : trait === 'hairTexture' ? entry.hairTexture
        : undefined;
      if (!isStr(v)) throw new MaterializationError(`${label} deterministic_palette: the palette provides skin + hair colour + hair texture only, not ${trait} (author hair style as explicit)`);
      return { value: v, mode: 'deterministic_palette', origin: binding.origin };
    }
    default:
      throw new MaterializationError(`${label} unknown binding mode "${String((binding as { mode?: unknown }).mode)}"`);
  }
}

/** Garment colours are authored — only `explicit` resolves (family/palette carry no garment colour). */
function resolveGarment(
  member: TemplateHumanCastMember,
  garment: Garment<TemplateTraitBinding>,
  index: number,
): Garment<ResolvedTrait> {
  const b = garment.colour;
  if (!b || b.mode !== 'explicit') {
    throw new MaterializationError(`${member.id}.garments[${garment.id || index}].colour must be an explicit binding (garment colours are authored)`);
  }
  if (!isStr(b.value)) throw new MaterializationError(`${member.id}.garments[${garment.id || index}].colour explicit binding has no value`);
  return {
    id: garment.id,
    ...(garment.label ? { label: garment.label } : {}),
    colour: { value: b.value, mode: 'explicit', origin: b.origin },
  };
}

function resolveMember(
  m: TemplateHumanCastMember,
  storyKey: string,
  family: ResolvedFamilyAppearanceProfile,
  palette: AppearancePalette,
): ResolvedHumanCastMember {
  const appearance = {
    skinTone: resolveTrait(m, 'skinTone', m.appearance.skinTone, storyKey, family, palette),
    hairColour: resolveTrait(m, 'hairColour', m.appearance.hairColour, storyKey, family, palette),
    hairTexture: resolveTrait(m, 'hairTexture', m.appearance.hairTexture, storyKey, family, palette),
    hairStyle: resolveTrait(m, 'hairStyle', m.appearance.hairStyle, storyKey, family, palette),
  };
  const garments = m.garments.map((g, i) => resolveGarment(m, g, i));
  const resolved: ResolvedHumanCastMember = {
    id: m.id,
    role: m.role,
    gender: m.gender,
    aliases: [...m.aliases],
    textEvidence: m.textEvidence,
    forbiddenAppearance: [...m.forbiddenAppearance],
    pagesPresent: [...m.pagesPresent],
    appearance,
    garments,
    // Deterministic projections — generated FROM the structured traits above.
    coarseAppearance: '',
    wardrobe: { description: '' },
  };
  resolved.coarseAppearance = projectResolvedCoarseAppearance(resolved);
  resolved.wardrobe = { description: projectResolvedWardrobeDescription(garments) };
  return resolved;
}

/**
 * Materialize a Template into a per-order Resolved contract. Pure + deterministic; the Resolved is a SUPERSET of vNext
 * `BookVisualContract` (flows through steering/freeze/QA unchanged) and is the ONLY thing hashed/frozen/rendered.
 */
export function materialize(
  template: BookVisualContractTemplate,
  family: ResolvedFamilyAppearanceProfile,
  palette: AppearancePalette = DEFAULT_APPEARANCE_PALETTE,
): ResolvedBookVisualContract {
  if (template.contractKind !== 'template') {
    throw new MaterializationError('input is not a Template (contractKind !== "template")');
  }
  const storyKey = template.storyKey ?? '';
  const humanCast = template.humanCast.map((m) => resolveMember(m, storyKey, family, palette));

  return {
    contractKind: 'resolved',
    schemaVersion: VISUAL_CONTRACT_SCHEMA_VERSION,
    materializerVersion: MATERIALIZER_VERSION,
    paletteVersion: palette.version,
    version: template.version,
    ...(template.storyKey ? { storyKey: template.storyKey } : {}),
    worldType: template.worldType,
    locations: template.locations,
    zones: template.zones,
    cast: template.cast,
    humanCast,
    recurringProps: template.recurringProps,
    forbiddenGlobalElements: template.forbiddenGlobalElements,
    coverContract: template.coverContract,
    pageContracts: template.pageContracts,
    ...(template.provenance ? { provenance: template.provenance } : {}),
  };
}
