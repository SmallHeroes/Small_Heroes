import { z } from 'zod';
import { referenceOwnershipSchema } from './simple-reference-designs';

/** Explicit generator projection only. Does not rewrite source designs or weaken pixel review. */
export const LOCATION_SHEET_PROJECTION = 'location-ownership-and-views/v1' as const;

export function locationSheetProjection(design: unknown, policy: typeof LOCATION_SHEET_PROJECTION) {
  if (policy !== LOCATION_SHEET_PROJECTION) throw Error('location_sheet_projection_policy');
  const d = z.object({ locations: z.array(z.object({ id: z.string().regex(/^[a-z][a-z0-9_]{0,49}$/) }).passthrough()).min(1).max(24),
    referenceOwnership: referenceOwnershipSchema }).passthrough().parse(design);
  const ids = d.locations.map(l => l.id);
  if (new Set(ids).size !== ids.length) throw Error('location_sheet_projection_locations');
  const excluded = d.referenceOwnership.assignments.filter(a => a.role === 'entities');
  return `LOCATION OWNERSHIP AND VIEW PROJECTION (${policy}): exactly ${ids.length} SEPARATE, clearly divided, roomy establishing views, one for EACH of these location IDs: ${ids.join(', ')}. Label each view with ONLY its exact short Latin location ID. Do not merge locations into one scene, omit a view, or replace a location view with an object tile.
ENTITY-OWNED EXCLUSIONS: ${excluded.length ? excluded.map(a => `${a.entityId} (${a.kind})`).join(', ') : 'none'}. These IDs are owned by the ENTITIES reference, never this sheet. If location prose names them, it names them ONLY FOR PLACEMENT CONTEXT: do NOT draw those objects or characters, copies, substitutes or their story effects here. Keep their surrounding fixed geography and empty placement space. No child or companion. This ownership rule takes precedence over an incidental object mention in location prose; it does not remove any listed location or location-owned landmark.
Draw every location-owned landmark with its complete fixed design/counts in its proper view. The canonical data below is unchanged. Approved child/companion references provide watercolour technique only; do not draw their characters.`;
}
