/**
 * Shared, PURE deterministic projection of a resolved human's structured traits → the vNext prose fields
 * `coarseAppearance` + `wardrobe.description` (P0 Fix 3c).
 *
 * ONE implementation, used by BOTH the materializer (to GENERATE the prose) and the Resolved validator (to VERIFY the
 * stored prose EQUALS this projection). The structured traits are authoritative; the human-readable prose is never a
 * parallel editable source — so they can never diverge (this permanently kills the vague-prose drift). No I/O, no
 * clock, no randomness.
 */
import type { Garment, ResolvedTrait } from './contractTemplateTypes';

/** The minimal structured shape the projection reads — a `ResolvedHumanCastMember` satisfies it. */
export interface ResolvedHumanProseSource {
  role: string;
  gender: string;
  appearance: {
    skinTone: { value: string };
    hairColour: { value: string };
    hairTexture: { value: string };
    hairStyle: { value: string };
  };
}

function genderPrefix(gender: string): string {
  return gender && gender !== 'unspecified' ? `${gender} ` : '';
}

/** Deterministic prose PROJECTION of the resolved structured appearance (never a parallel editable source). */
export function projectResolvedCoarseAppearance(m: ResolvedHumanProseSource): string {
  const a = m.appearance;
  return (
    `${genderPrefix(m.gender)}${m.role}; ${a.skinTone.value} skin tone; ` +
    `${a.hairStyle.value}, ${a.hairTexture.value} ${a.hairColour.value} hair — the SAME appearance on every page`
  );
}

/** Deterministic wardrobe prose PROJECTION from the resolved garment colours. */
export function projectResolvedWardrobeDescription(garments: Garment<ResolvedTrait>[]): string {
  const parts = garments.map((g) => `${g.colour.value} ${g.label ?? g.id}`);
  return parts.length
    ? `${parts.join(', ')} — the SAME garments and colours on every page`
    : 'no fixed garments';
}
