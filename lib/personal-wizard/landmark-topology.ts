import 'server-only';
import { z } from 'zod';

/** Prospective pixel evidence only. No legacy response, prose parser, source-name ontology or spend authority. */
export const LANDMARK_TOPOLOGY_VERSION = 'landmark-topology/v1' as const;
const objectId = z.string().regex(/^o[1-9][0-9]?$/);
const relationFields = { from: objectId, to: objectId, evidence: z.string().trim().min(8).max(300) };
// Discriminated branches encode basis/type parity in the actual provider JSON schema, not only a post-response refinement.
const relationSchema = z.discriminatedUnion('relation', [
  z.object({ ...relationFields, relation: z.literal('same_object'), basis: z.literal('shared_visible_body') }).strict(),
  z.object({ ...relationFields, relation: z.literal('component_of'), basis: z.enum(['visible_attachment', 'visible_membership_boundary']) }).strict(),
  z.object({ ...relationFields, relation: z.literal('separate_objects'), basis: z.literal('visible_separation') }).strict(),
  z.object({ ...relationFields, relation: z.literal('uncertain'), basis: z.literal('not_readable') }).strict(),
]);
export const landmarkTopologySchema = z.object({ version: z.literal(LANDMARK_TOPOLOGY_VERSION),
  relations: z.array(relationSchema).max(276),
  bindings: z.array(z.object({ landmarkId: z.string().trim().min(1).max(60), objectId,
    sourceKind: z.string().trim().min(1).max(100),
    extent: z.enum(['whole_instance', 'component_only', 'containing_aggregate', 'not_instance', 'uncertain']),
    evidence: z.string().trim().min(8).max(300),
  }).strict()).max(160),
}).strict();
export type LandmarkTopology = z.infer<typeof landmarkTopologySchema>;
type Feature = { id: string; text: string; aspect: string; decisive: boolean };
type Landmark = { id: string; features: readonly Feature[]; plannedVisible?: boolean };
type Inventory = { objects: { objectId: string }[]; landmarks: { landmarkId: string; candidates: {
  objectId: string; association: string; featureChecks: { featureId: string; observed: string }[];
}[] }[] };
export class LandmarkTopologyError extends Error { readonly code = 'audition_review_landmark_topology'; }
const bad = (): never => { throw new LandmarkTopologyError('Unusable typed landmark topology'); };
const key = (landmarkId: string, id: string) => `${landmarkId}/${id}`;

/** Validate the physical graph separately from source ownership; never union component siblings. */
export function assessLandmarkTopology(raw: LandmarkTopology, inventory: Inventory, landmarks: readonly Landmark[]) {
  const topology = landmarkTopologySchema.parse(raw), ids = inventory.objects.map(o => o.objectId), known = new Set(ids);
  if (known.size !== ids.length) bad();
  const catalogue = new Map(landmarks.map(l => [l.id, l.features]));
  const kinds = new Map(landmarks.map(l => {
    const k = l.features.filter(f => f.decisive && f.aspect === 'kind');
    if (k.length !== 1) bad();
    return [l.id, k[0]] as const;
  }));
  const expected = new Set(inventory.landmarks.flatMap(l => l.candidates.map(c => key(l.landmarkId, c.objectId))));
  // The prospective contract checks the full object/source matrix: an omitted row cannot hide a second matching member.
  if (inventory.landmarks.some(l => l.candidates.length !== ids.length || ids.some(id => !l.candidates.some(c => c.objectId === id))) ||
      (ids.length > 0 && landmarks.length === 0)) bad();
  const bindings = new Map(topology.bindings.map(b => [key(b.landmarkId, b.objectId), b]));
  if (bindings.size !== topology.bindings.length || bindings.size !== expected.size ||
      [...expected].some(k => !bindings.has(k))) bad();
  for (const b of bindings.values()) if (!known.has(b.objectId) || b.sourceKind !== kinds.get(b.landmarkId)?.text) bad();
  const pairs = new Set<string>(), parent = new Map(ids.map(id => [id, id]));
  const root = (id: string): string => parent.get(id) === id ? id : root(parent.get(id)!);
  for (const r of topology.relations) {
    if (r.from === r.to || !known.has(r.from) || !known.has(r.to)) bad();
    const pair = [r.from, r.to].sort().join('/');
    if (pairs.has(pair)) bad();
    pairs.add(pair);
    if (r.relation === 'same_object') parent.set(root(r.from), root(r.to));
  }
  // Complete pair coverage: omission cannot imply that two matching observations are the same object.
  if (pairs.size !== ids.length * (ids.length - 1) / 2) bad();
  const groups = [...new Set(ids.map(root))], edges = new Map(groups.map(id => [id, new Set<string>()]));
  for (const r of topology.relations) {
    const a = root(r.from), b = root(r.to);
    if (r.relation !== 'same_object' && a === b) bad();
    if (r.relation === 'component_of') edges.get(a)!.add(b);
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) bad();
    if (visited.has(id)) return;
    visiting.add(id); edges.get(id)!.forEach(visit); visiting.delete(id); visited.add(id);
  };
  groups.forEach(visit);
  const closure = new Map<string, Set<string>>();
  const ancestors = (child: string): Set<string> => {
    if (!closure.has(child)) closure.set(child, new Set([...edges.get(child)!].flatMap(p => [p, ...ancestors(p)])));
    return closure.get(child)!;
  };
  const ancestor = (child: string, aggregate: string) => ancestors(child).has(aggregate);
  for (const r of topology.relations) {
    const a = root(r.from), b = root(r.to);
    if (r.relation === 'separate_objects' && (ancestor(a, b) || ancestor(b, a))) bad();
  }
  const uncertainObjects = new Set(topology.relations.filter(r => r.relation === 'uncertain').flatMap(r => [r.from, r.to]));
  const uncertain = new Set<string>(), positive = new Set<string>(), owner = new Map<string, string>();
  for (const l of inventory.landmarks) for (const c of l.candidates) {
    const binding = bindings.get(key(l.landmarkId, c.objectId)) ?? bad();
    const features = catalogue.get(l.landmarkId) ?? bad(), kind = kinds.get(l.landmarkId) ?? bad();
    const matched = features.filter(f => f.decisive && c.featureChecks.some(x => x.featureId === f.id && x.observed === 'matches'));
    const kindObserved = c.featureChecks.find(x => x.featureId === kind.id)?.observed;
    if (binding.extent === 'not_instance') {
      if (c.association !== 'different_object' || !features.some(f => f.decisive &&
        c.featureChecks.some(x => x.featureId === f.id && x.observed === 'contradicted'))) bad();
    } else if (c.association === 'different_object') bad();
    const supported = kindObserved === 'matches' && !c.featureChecks.some(x => x.observed === 'contradicted') &&
      new Set(matched.map(f => f.aspect)).size >= 2;
    if (binding.extent === 'uncertain' || uncertainObjects.has(c.objectId)) uncertain.add(l.landmarkId);
    if (binding.extent === 'whole_instance' && c.association !== 'different_object' && !supported) uncertain.add(l.landmarkId);
    if (c.association !== 'this_landmark') continue;
    if (binding.extent !== 'whole_instance' || kindObserved === 'contradicted') bad();
    const physical = root(c.objectId), previous = owner.get(physical);
    // One physical group cannot launder two distinct canonical identities, even with similar kinds/colours.
    if (previous !== undefined && previous !== l.landmarkId) bad();
    owner.set(physical, l.landmarkId);
    if (supported) positive.add(key(l.landmarkId, physical)); else uncertain.add(l.landmarkId);
  }
  const exclusions = new Set<string>();
  for (const l of landmarks) if (l.plannedVisible && !groups.some(g => positive.has(key(l.id, g)))) uncertain.add(l.id);
  for (const l of inventory.landmarks) for (const c of l.candidates) {
    const binding = bindings.get(key(l.landmarkId, c.objectId))!, physical = root(c.objectId);
    if (binding.extent === 'whole_instance' || binding.extent === 'not_instance' || binding.extent === 'uncertain') continue;
    if (c.association !== 'possible_copy') bad();
    const anchors = groups.filter(g => positive.has(key(l.landmarkId, g)) &&
      (binding.extent === 'component_only' ? ancestor(physical, g) : ancestor(g, physical)));
    // A containing aggregate may include multiple member instances; exclude ONLY the aggregate, never merge those members.
    if ((binding.extent === 'component_only' ? anchors.length === 1 : anchors.length > 0) && !uncertainObjects.has(c.objectId))
      exclusions.add(key(l.landmarkId, c.objectId));
    else uncertain.add(l.landmarkId);
  }
  return { topology, objectGroup: (id: string) => groups.indexOf(root(id)),
    knownDistinct: (a: number, b: number) => {
      const evidence = topology.relations.filter(r =>
        (root(r.from) === groups[a] && root(r.to) === groups[b]) || (root(r.from) === groups[b] && root(r.to) === groups[a]));
      return a !== b && evidence.length > 0 && evidence.every(r => r.relation !== 'uncertain');
    },
    binding: (landmarkId: string, id: string) => bindings.get(key(landmarkId, id))!,
    excluded: (landmarkId: string, id: string) => exclusions.has(key(landmarkId, id)),
    uncertain: (landmarkId: string) => uncertain.has(landmarkId),
    positive: (landmarkId: string, id: string) => positive.has(key(landmarkId, root(id))) };
}
