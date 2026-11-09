import { z } from 'zod';
import { assertReferenceRoleOwnership, referenceOwnershipSchema } from './simple-reference-designs';
import { previewContinuitySchema } from '../local-preview-quality';
import { canonicalJson } from './request-acceptance';

/** Explicit generator projection only. Does not rewrite source designs or weaken pixel review. */
export const LOCATION_SHEET_PROJECTION = 'location-ownership-and-views/v1' as const;
export const LOCATION_SHEET_PROJECTION_V2 = 'location-ownership-and-views/v2' as const;
export const locationSheetPolicySchema = z.enum([LOCATION_SHEET_PROJECTION, LOCATION_SHEET_PROJECTION_V2]);
export type LocationSheetPolicy = z.infer<typeof locationSheetPolicySchema>;

const deferredSchema = z.array(z.object({ entityId: z.string(), requirement: z.string().min(1),
  reason: z.enum(['attached_to_actor', 'actor_owned_clothing', 'later_state']), source: z.unknown(), verifiedOn: z.string().min(1) }).strict());
const siblingSchema = z.object({ entities: previewContinuitySchema.shape.entities,
  props: z.array(z.object({ id: z.string(), design: z.string().min(1) }).strict()),
  referenceOwnership: referenceOwnershipSchema, pageDeferred: deferredSchema }).passthrough();

/** Recognition data only, derived from the admitted book's sibling sheet, never a new design authority. */
function excludedDescriptions(design: unknown, entityDesign: unknown) {
  const locations = z.object({ referenceOwnership: referenceOwnershipSchema, pageDeferred: deferredSchema }).passthrough().parse(design);
  const entities = siblingSchema.parse(entityDesign);
  assertReferenceRoleOwnership('locations', design);
  assertReferenceRoleOwnership('entities', entityDesign);
  if (canonicalJson(locations.referenceOwnership) !== canonicalJson(entities.referenceOwnership) ||
      canonicalJson(locations.pageDeferred) !== canonicalJson(entities.pageDeferred) ||
      new Set(entities.props.map(e => e.id)).size !== entities.props.length ||
      entities.entities.some(e => new Set(e.invariants.map(i => i.attribute)).size !== e.invariants.length) ||
      entities.props.some(e => !entities.entities.some(i => i.id === e.id && i.kind === 'prop')))
    throw Error('location_sheet_projection_sibling_binding');
  return locations.referenceOwnership.assignments.filter(a => a.role === 'entities').map(a => {
    // Role validation above requires exactly the sibling's assigned inventory, including entities with no later states.
    const entity = entities.entities.find(e => e.id === a.entityId)!;
    return { entityId: a.entityId, kind: a.kind, initialInvariants: entity.invariants,
      ...(entities.props.some(e => e.id === a.entityId) ? { propDesign: entities.props.find(e => e.id === a.entityId)!.design } : {}),
      deferredDescriptions: locations.pageDeferred.filter(d => d.entityId === a.entityId).map(d => ({ reason: d.reason, requirement: d.requirement })) };
  });
}

export function locationSheetProjection(design: unknown, policy: LocationSheetPolicy, entityDesign?: unknown) {
  if (!locationSheetPolicySchema.safeParse(policy).success) throw Error('location_sheet_projection_policy');
  const d = z.object({ locations: z.array(z.object({ id: z.string().regex(/^[a-z][a-z0-9_]{0,49}$/) }).passthrough()).min(1).max(24),
    referenceOwnership: referenceOwnershipSchema }).passthrough().parse(design);
  const ids = d.locations.map(l => l.id);
  if (new Set(ids).size !== ids.length) throw Error('location_sheet_projection_locations');
  const excluded = d.referenceOwnership.assignments.filter(a => a.role === 'entities');
  const base = `LOCATION OWNERSHIP AND VIEW PROJECTION (${policy}): exactly ${ids.length} SEPARATE, clearly divided, roomy establishing views, one for EACH of these location IDs: ${ids.join(', ')}. Label each view with ONLY its exact short Latin location ID. Do not merge locations into one scene, omit a view, or replace a location view with an object tile.
ENTITY-OWNED EXCLUSIONS: ${excluded.length ? excluded.map(a => `${a.entityId} (${a.kind})`).join(', ') : 'none'}. These IDs are owned by the ENTITIES reference, never this sheet. If location prose names them, it names them ONLY FOR PLACEMENT CONTEXT: do NOT draw those objects or characters, copies, substitutes or their story effects here. Keep their surrounding fixed geography and empty placement space. No child or companion. This ownership rule takes precedence over an incidental object mention in location prose; it does not remove any listed location or location-owned landmark.
Draw every location-owned landmark with its complete fixed design/counts in its proper view. The canonical data below is unchanged. Approved child/companion references provide watercolour technique only; do not draw their characters.`;
  if (policy === LOCATION_SHEET_PROJECTION) return base;
  const descriptions = excludedDescriptions(design, entityDesign);
  return `${base}
INITIAL LOCATION STATE ONLY: design.pageDeferred items are NOT drawn here; later states belong to their pages. A location-owned landmark keeps its complete initial fixed design and its page-0 attribute values, not a deferred later form. Never turn a later story event, object formation or effect into permanent geography.
EXCLUDED ENTITY DESCRIPTIONS (recognition only, NEVER drawing tasks): ${canonicalJson(descriptions)}
Use these source-bound descriptions to recognise entity-owned content even when location prose uses its visual description instead of its ID. Matching objects, characters, formations and later effects in location prose are ONLY FOR PLACEMENT CONTEXT: do NOT draw them. Retain the surrounding fixed geography, empty placement space, every listed location and every location-owned landmark. These exclusions do not remove the landmark's initial geometry or its fixed materials/counts. All canonical design data and page-specific states remain unchanged.`;
}
