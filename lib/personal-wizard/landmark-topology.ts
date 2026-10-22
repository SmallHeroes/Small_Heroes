import 'server-only';
import { z } from 'zod';

/** Prospective pixel evidence only. No legacy response, prose parser, source-name ontology or spend authority. */
export const LANDMARK_TOPOLOGY_VERSION = 'landmark-topology/v1' as const;
export const LANDMARK_COVERAGE_TOPOLOGY_VERSION = 'landmark-topology/v2' as const;
export type LandmarkTopologyVersion = typeof LANDMARK_TOPOLOGY_VERSION | typeof LANDMARK_COVERAGE_TOPOLOGY_VERSION;
export const LANDMARK_SCAN_REGIONS = ['top_left', 'top_right', 'bottom_left', 'bottom_right'] as const;
export const landmarkQuadrantsSchema = z.array(z.enum(LANDMARK_SCAN_REGIONS)).min(1).max(4);
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
const negativeCheck = z.object({ landmarkId: z.string().trim().min(1).max(60), featureId: z.string().trim().min(1).max(8),
  observed: z.enum(['contradicted', 'not_visible']),
  basis: z.enum(['visible_kind', 'visible_material', 'visible_colour', 'visible_shape', 'grounded_size', 'not_readable']),
  allMembersReadable: z.boolean(), evidence: z.string().trim().min(8).max(180),
  grounding: z.object({ referenceObjectId: objectId.nullable(), relation: z.enum(['same_ground_plane', 'anchored_depth_geometry', 'not_readable']),
    evidence: z.string().trim().min(8).max(180) }).strict().nullable(),
}).strict();
export const landmarkCoverageTopologySchema = landmarkTopologySchema.extend({ version: z.literal(LANDMARK_COVERAGE_TOPOLOGY_VERSION),
  coverage: z.object({ version: z.literal('landmark-candidate-coverage/v1'),
    populations: z.array(z.object({ populationId: z.string().regex(/^p[1-9][0-9]?$/), quadrants: landmarkQuadrantsSchema,
      description: z.string().trim().min(8).max(180),
      membership: z.enum(['uniform_noninstances', 'mixed_possible_instance', 'unreadable']),
      witnessObjectIds: z.array(objectId).min(1).max(10), negativeChecks: z.array(negativeCheck).max(16),
    }).strict()).max(6),
    scans: z.array(z.object({ quadrant: z.enum(LANDMARK_SCAN_REGIONS), status: z.enum(['complete', 'uncertain']),
      unresolvedReason: z.enum(['none', 'unreadable', 'mixed_candidates', 'capacity_exceeded']),
      objectIds: z.array(objectId).max(10), populationIds: z.array(z.string().regex(/^p[1-9][0-9]?$/)).max(6),
      uncertainLandmarkIds: z.array(z.string().trim().min(1).max(60)).max(16), evidence: z.string().trim().min(8).max(180),
    }).strict()).length(4),
  }).strict(),
}).strict();
export type LandmarkTopology = z.infer<typeof landmarkTopologySchema> | z.infer<typeof landmarkCoverageTopologySchema>;
type Feature = { id: string; text: string; aspect: string; decisive: boolean };
type Landmark = { id: string; features: readonly Feature[]; plannedVisible?: boolean };
type Inventory = { objects: { objectId: string; quadrants?: string[] }[]; landmarks: { landmarkId: string; candidates: {
  objectId: string; association: string; featureChecks: { featureId: string; observed: string }[];
}[] }[] };
export class LandmarkTopologyError extends Error { readonly code = 'audition_review_landmark_topology'; }
const bad = (): never => { throw new LandmarkTopologyError('Unusable typed landmark topology'); };
const key = (landmarkId: string, id: string) => `${landmarkId}/${id}`;

/** Bounded spatial accounting, not geometric pixel proof. Only fresh versioned judge evidence can assert coverage. */
function assessCoverage(topology: z.infer<typeof landmarkCoverageTopologySchema>, inventory: Inventory, landmarks: readonly Landmark[]) {
  const sources = new Map(landmarks.map(l => [l.id, l.features])), objects = new Map(inventory.objects.map(o => [o.objectId, o]));
  const unique = (xs: readonly string[]) => new Set(xs).size === xs.length;
  const equalSet = (a: readonly string[], b: readonly string[]) => unique(a) && a.length === b.length && a.every(x => b.includes(x));
  for (const o of inventory.objects) if (!o.quadrants?.length || !unique(o.quadrants) ||
    o.quadrants.some(q => !(LANDMARK_SCAN_REGIONS as readonly string[]).includes(q))) bad();
  const { populations, scans } = topology.coverage, ids = populations.map(p => p.populationId), uncertain = new Set<string>();
  if (!unique(ids) || !equalSet(scans.map(s => s.quadrant), LANDMARK_SCAN_REGIONS)) bad();
  for (const s of scans) {
    if (!equalSet(s.objectIds, inventory.objects.filter(o => o.quadrants!.includes(s.quadrant)).map(o => o.objectId)) ||
      !equalSet(s.populationIds, populations.filter(p => p.quadrants.includes(s.quadrant)).map(p => p.populationId)) ||
      !unique(s.uncertainLandmarkIds) || s.uncertainLandmarkIds.some(id => !sources.has(id)) ||
      (s.status === 'complete') !== (s.uncertainLandmarkIds.length === 0) ||
      (s.status === 'complete') !== (s.unresolvedReason === 'none')) bad();
    s.uncertainLandmarkIds.forEach(id => uncertain.add(id));
  }
  for (const p of populations) {
    if (!unique(p.quadrants) || !unique(p.witnessObjectIds) || p.witnessObjectIds.some(id => !objects.has(id)) ||
      !equalSet(p.negativeChecks.map(c => c.landmarkId), [...sources.keys()])) bad();
    if (p.witnessObjectIds.some(id => objects.get(id)!.quadrants!.some(q => !p.quadrants.includes(q as typeof LANDMARK_SCAN_REGIONS[number])))) bad();
    for (const c of p.negativeChecks) {
      const f = sources.get(c.landmarkId)!.find(f => f.id === c.featureId) ?? bad();
      if (!f.decisive) bad();
      const readable = c.observed === 'contradicted' && c.allMembersReadable && c.basis !== 'not_readable';
      if (!readable || p.membership !== 'uniform_noninstances') { uncertain.add(c.landmarkId); continue; }
      const basis = f.aspect === 'size' ? 'grounded_size' : `visible_${f.aspect}`;
      if (c.basis !== basis) bad();
      if (f.aspect === 'size') {
        const grounding = c.grounding ?? bad();
        if (grounding.relation === 'not_readable') uncertain.add(c.landmarkId);
        else {
          const reference = grounding.referenceObjectId ?? bad();
          if (!objects.has(reference) || p.witnessObjectIds.includes(reference)) bad();
        }
      } else if (c.grounding !== null) bad();
      // A population cannot hide a listed possible/positive whole or contradict its own visible witnesses.
      for (const id of p.witnessObjectIds) {
        const row = inventory.landmarks.find(l => l.landmarkId === c.landmarkId)?.candidates.find(x => x.objectId === id);
        const binding = topology.bindings.find(b => b.landmarkId === c.landmarkId && b.objectId === id);
        if (!row || row.association !== 'different_object' || binding?.extent !== 'not_instance' ||
          row.featureChecks.find(x => x.featureId === c.featureId)?.observed !== 'contradicted') bad();
      }
    }
  }
  return uncertain;
}

/** Validate the physical graph separately from source ownership; never union component siblings. */
export function assessLandmarkTopology(raw: LandmarkTopology, inventory: Inventory, landmarks: readonly Landmark[]) {
  const topology = raw.version === LANDMARK_COVERAGE_TOPOLOGY_VERSION ? landmarkCoverageTopologySchema.parse(raw) : landmarkTopologySchema.parse(raw);
  const ids = inventory.objects.map(o => o.objectId), known = new Set(ids);
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
  // An alias is another observation of the SAME physical body, not a chance to select whichever row passes.
  // Check decisive evidence and extent parity over the whole physical group, including transitive aliases.
  for (const l of inventory.landmarks) for (const physical of groups) {
    const aliases = l.candidates.filter(c => root(c.objectId) === physical);
    const extents = new Set(aliases.map(c => bindings.get(key(l.landmarkId, c.objectId))!.extent));
    if (extents.has('not_instance') && extents.size > 1) bad();
    if (extents.has('whole_instance') && (extents.has('component_only') || extents.has('containing_aggregate'))) bad();
    for (const f of catalogue.get(l.landmarkId) ?? bad()) if (f.decisive) {
      const observations = new Set(aliases.flatMap(c => c.featureChecks.filter(x => x.featureId === f.id).map(x => x.observed)));
      if (observations.has('matches') && observations.has('contradicted')) bad();
    }
  }
  // A canonical owner is not a different physical kind. Identical declared-kind propositions must be
  // consistent across source IDs for this same body; distinct kinds/colours are NOT equated or inferred.
  for (const physical of groups) {
    const observedKinds = new Map<string, Set<string>>();
    for (const l of inventory.landmarks) {
      const kind = kinds.get(l.landmarkId)!;
      const observations = observedKinds.get(kind.text) ?? new Set<string>();
      for (const c of l.candidates.filter(c => root(c.objectId) === physical)) {
        const observed = c.featureChecks.find(x => x.featureId === kind.id)?.observed;
        if (observed) observations.add(observed);
      }
      observedKinds.set(kind.text, observations);
    }
    if ([...observedKinds.values()].some(s => s.has('matches') && s.has('contradicted'))) bad();
  }
  const uncertain = topology.version === LANDMARK_COVERAGE_TOPOLOGY_VERSION ? assessCoverage(topology, inventory, landmarks) : new Set<string>();
  const positive = new Set<string>(), owner = new Map<string, string>();
  for (const l of inventory.landmarks) for (const c of l.candidates) {
    const binding = bindings.get(key(l.landmarkId, c.objectId)) ?? bad();
    const features = catalogue.get(l.landmarkId) ?? bad(), kind = kinds.get(l.landmarkId) ?? bad();
    const matched = features.filter(f => f.decisive && c.featureChecks.some(x => x.featureId === f.id && x.observed === 'matches'));
    const kindObserved = c.featureChecks.find(x => x.featureId === kind.id)?.observed;
    if (binding.extent === 'not_instance') {
      if (c.association !== 'different_object' || !features.some(f => f.decisive &&
        c.featureChecks.some(x => x.featureId === f.id && x.observed === 'contradicted'))) bad();
    } else if (c.association === 'different_object') bad();
    const veto = c.featureChecks.some(x => x.observed === 'contradicted' &&
      (topology.version === LANDMARK_TOPOLOGY_VERSION || features.some(f => f.id === x.featureId && f.decisive)));
    const supported = kindObserved === 'matches' && !veto &&
      new Set(matched.map(f => f.aspect)).size >= 2;
    if (binding.extent === 'uncertain') uncertain.add(l.landmarkId);
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
    if (binding.extent === 'component_only' ? anchors.length === 1 : anchors.length > 0)
      exclusions.add(key(l.landmarkId, c.objectId));
    else uncertain.add(l.landmarkId);
  }
  // Decide relevance AFTER independently justified exclusions. A part's exclusion needs its KNOWN path to
  // its own positive whole, never the unreadable relation to another already-proved part/containing aggregate.
  // If the required path is unreadable it did not enter the DAG above, so the exclusion already failed/held.
  for (const l of inventory.landmarks) for (const r of topology.relations) if (r.relation === 'uncertain') {
    const canCount = (id: string) => bindings.get(key(l.landmarkId, id))!.extent !== 'not_instance' &&
      !exclusions.has(key(l.landmarkId, id));
    if (canCount(r.from) && canCount(r.to)) uncertain.add(l.landmarkId);
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
