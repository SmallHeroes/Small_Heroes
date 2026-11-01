import { z } from 'zod';
import { LANDMARK_KIND_ATTRIBUTE, isKindPhrase } from './storyboard-landmark-kind';

/**
 * Opt-in instance-distinction contract (engine continuity stage C): a story's landmarks and props must stay tellable apart from the
 * same-sort set dressing around them. Every landmark and prop declares its kind (one shared broad key, the landmark-kind syntax), every
 * location declares the kinds of its repeated set dressing (`population` on each plan.locations entry, split off before the unchanged compiler), and
 * an entity whose kind is dressing anywhere in the book, or shared with another landmark or prop, carries one fixed `distinction`
 * invariant. Bound into the source and the compiled book only when enabled (it needs the landmark-kind contract): without it every
 * existing source, book, digest, instruction, schema and packet stays byte-identical.
 * The checks here are STRUCTURE only: the annotations are internally consistent. Whether a population is complete, a key is the broad
 * shared category and a distinction is visible and true to the manuscript is the independent storyboard review's (INSTANCE_REVIEW_ADDENDUM).
 */
export const INSTANCE_DISTINCTION_VERSION = 'instance-distinction/v1' as const;
export const DISTINCTION_ATTRIBUTE = 'distinction';

export const INSTANCE_STORYBOARD_ADDENDUM = `INSTANCE DISTINCTION CONTRACT: every story object must stay tellable apart from look-alike set dressing.
- Give EVERY continuity entity whose kind is "landmark" or "prop" exactly one invariant with attribute "kind": 1-3 plain words naming the
  broad sort of object, the shared category and never a sub-type (an old oak in a forest is "tree"; a toy sailboat in a harbour is "boat").
- In EACH plan.locations entry, declare population: an array of the broad kinds of repeated same-sort set dressing that location
  shows ([] when it shows none). The field is required on every location; do not add a top-level populations field. Use the SAME key as
  any entity of that sort.
- When an entity's kind appears in any population, or two landmarks or props share a kind, give that entity exactly one invariant with
  attribute "distinction": one short visible cue that only it bears, from its first visible page on (for example "split by lightning down
  its trunk", "a red sail with a white star"). Take it from the manuscript or from fixed design the manuscript does not contradict; never
  change the story to create one. Kind and distinction are fixed: never list them in mutableAttributes or change them on a page.`;

export const INSTANCE_REVIEW_ADDENDUM = `INSTANCE DISTINCTION CONTRACT (active): instanceDistinctionContract lists each location's population (the
kinds of repeated set dressing it shows) and each landmark's and prop's kind and distinction. In the continuity check confirm that:
(a) every location's population lists each sort of repeated same-sort dressing that its design text or the manuscript makes visible (a
design with "colourful block towers" and an empty population is incomplete); (b) an entity and same-sort dressing share ONE broad key, the
category, never a sub-type (an oak among trees is "tree", not "oak"); (c) each distinction is visible from the entity's first visible page,
is not contradicted by the prose and is not shared by the dressing or by another entity of that kind; (d) no distinction was created by
changing the story. A failure is a continuity contradiction; if you cannot tell, it is uncertain. If the story itself leaves such an entity
no stable visible cue (it changes every visible property, or is by design indistinguishable from its dressing), write
instance_distinction_unsupported in the continuity observation: that is a contradiction, never a reason to invent a cue.`;

const populationKinds = z.array(z.string().trim().min(1).max(40)).max(8);
export const populationsSchema = z.array(z.object({ locationId: z.string().trim().min(1).max(80), kinds: populationKinds }).strict()).max(24);

/** A draft schema whose plan locations also carry their population (only under the contract; the static shape is unchanged). */
export function withLocationPopulations<T extends z.AnyZodObject>(draft: T): T {
  const plan = draft.shape.plan as z.AnyZodObject, locations = plan.shape.locations as z.ZodArray<z.AnyZodObject>;
  return draft.extend({ plan: plan.extend({ locations: z.array(locations.element.extend({ population: populationKinds })) }) }) as unknown as T;
}

/** The planner draft without its location populations (the unchanged compiler's input) and the populations it declared, location by location. */
export function splitLocationPopulations(raw: unknown): { draft: unknown; populations: unknown } {
  const draft = structuredClone(raw) as { plan?: { locations?: unknown } } | null;
  const locations = draft && typeof draft === 'object' && draft.plan && typeof draft.plan === 'object' && Array.isArray(draft.plan.locations)
    ? draft.plan.locations as unknown[] : null;
  // A draft without locations is the compiler's own refusal; nothing is declared.
  if (!locations) return { draft: raw, populations: undefined };
  const populations = locations.map(location => {
    const l = location && typeof location === 'object' ? location as Record<string, unknown> : {};
    const kinds = l.population;
    delete l.population;
    return { locationId: l.id, kinds };
  });
  return { draft, populations };
}

export type InstanceDistinction = { version: typeof INSTANCE_DISTINCTION_VERSION;
  populations: { locationId: string; kinds: string[] }[]; entities: { id: string; kind: string; distinction: string | null }[] };

/** The bound instance record of a compiled plan; any structural violation fails closed. */
export function instanceDistinction(plan: { locations: readonly { id: string }[]; continuity?: {
  entities: readonly { id: string; kind: string; invariants: readonly { attribute: string; value: string }[] }[];
  pages: readonly { changes: readonly { entityId: string; attribute: string }[] }[] } }, mutableAttributes: readonly { entityId: string; attribute: string }[],
  rawPopulations: unknown): InstanceDistinction {
  const bad = (): never => { throw Error('personal_storyboard_instance_distinction'); };
  const parsed = populationsSchema.safeParse(rawPopulations);
  const continuity = plan.continuity;
  if (!parsed.success || !continuity) return bad();
  // Exactly one declaration per location: an absent one is not "no dressing" ([] is).
  const ids = plan.locations.map(l => l.id), given = parsed.data.map(p => p.locationId);
  if (new Set(given).size !== given.length || given.length !== ids.length || ids.some(id => !given.includes(id))) bad();
  const populations = ids.map(locationId => {
    const kinds = parsed.data.find(p => p.locationId === locationId)!.kinds;
    if (kinds.some(k => !isKindPhrase(k))) bad();
    const keys = kinds.map(k => k.toLowerCase());
    if (new Set(keys).size !== keys.length) bad();
    return { locationId, kinds: keys };
  });
  const named = (attribute: string, name: string) => attribute.trim().toLowerCase() === name;
  const mutable = (entityId: string, name: string) => mutableAttributes.some(m => m.entityId === entityId && named(m.attribute, name)) ||
    continuity.pages.some(p => p.changes.some(c => c.entityId === entityId && named(c.attribute, name)));
  const entities = continuity.entities.filter(e => e.kind === 'landmark' || e.kind === 'prop').map(e => {
    const kinds = e.invariants.filter(i => named(i.attribute, LANDMARK_KIND_ATTRIBUTE)), marks = e.invariants.filter(i => named(i.attribute, DISTINCTION_ATTRIBUTE));
    if (kinds.length !== 1 || kinds[0].attribute !== LANDMARK_KIND_ATTRIBUTE || !isKindPhrase(kinds[0].value.trim())) bad();
    if (marks.length > 1 || marks.some(m => m.attribute !== DISTINCTION_ATTRIBUTE || !m.value.trim())) bad();
    if (mutable(e.id, LANDMARK_KIND_ATTRIBUTE) || mutable(e.id, DISTINCTION_ATTRIBUTE)) bad();
    return { id: e.id, kind: kinds[0].value.trim().toLowerCase(), distinction: marks.length ? marks[0].value.trim() : null };
  });
  // Exact key equality only: no alias, stemming or sub-type classifier ("oak" never collides with "tree").
  const dressing = new Set(populations.flatMap(p => p.kinds));
  for (const e of entities) {
    const peers = entities.filter(o => o.id !== e.id && o.kind === e.kind);
    if ((dressing.has(e.kind) || peers.length) && e.distinction === null) bad();
    if (e.distinction !== null && peers.some(o => o.distinction?.toLowerCase() === e.distinction!.toLowerCase())) bad();
  }
  return { version: INSTANCE_DISTINCTION_VERSION, populations, entities };
}
