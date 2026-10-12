/**
 * Opt-in landmark KIND contract: every landmark declares what sort of object it is (one "kind" invariant), so an image checker can be asked
 * "is this the same sort of object?" without inferring ownership from wording. Like the moments contract it is bound into the source and the
 * compiled book only when enabled: without it every existing source, book, digest, instruction and packet stays byte-identical, and an
 * invariant that happens to be named "kind" stays ordinary design data.
 * The checks here are SYNTAX only (one short plain phrase per landmark, never mutable). Whether the phrase names the landmark itself is the
 * existing independent storyboard review's responsibility (KIND_REVIEW_ADDENDUM), not this code's.
 */
export const LANDMARK_KIND_CONTRACT_VERSION = 'storyboard-landmark-kind/v1' as const;
export const LANDMARK_KIND_ATTRIBUTE = 'kind';

export const KIND_STORYBOARD_ADDENDUM = `LANDMARK KIND CONTRACT: give EVERY continuity entity whose kind is "landmark" exactly one invariant with attribute "kind":
1-3 plain words naming what sort of object that landmark itself is (for example: tree, gate, fountain, well). Name the object itself, never
its place, its neighbours, one of its parts, its colour, material, size or state, and never use negation. The kind is fixed: never list it in
mutableAttributes or change it on a page. The landmark's other invariants keep describing its design as before.`;

export const KIND_REVIEW_ADDENDUM = `LANDMARK KIND CONTRACT (active): landmarkKindContract lists each landmark's declared kind. In the continuity check,
confirm that every declared kind names what sort of object that landmark itself is and fits its own design: not a place, a neighbour, a part,
a colour, a material, a size or a state. A wrong, misleading or merely vague kind is a continuity contradiction; if you cannot tell, it is
uncertain. Two landmarks may share a kind only if their other fixed design still tells them apart.`;

/** Words that turn a kind into a place, a relation or a negation rather than a sort of object. */
const NOT_A_KIND = /\b(no|not|never|none|without|non|beside|behind|near|next|before|after|at|around|against|along|across|between|from|to|into|onto|on|in|under|beneath|below|above|over|inside|with|and|of)\b/i;

/** The declared kind of every landmark; any syntax violation fails closed. */
export function landmarkKinds(continuity: {
  entities: readonly { id: string; kind: string; invariants: readonly { attribute: string; value: string }[] }[];
  pages: readonly { changes: readonly { entityId: string; attribute: string }[] }[];
}, mutableAttributes: readonly { entityId: string; attribute: string }[]) {
  const bad = (): never => { throw Error('personal_storyboard_landmark_kind'); };
  const isKind = (attribute: string) => attribute.trim().toLowerCase() === LANDMARK_KIND_ATTRIBUTE;
  return continuity.entities.filter(e => e.kind === 'landmark').map(e => {
    const declared = e.invariants.filter(i => isKind(i.attribute));
    if (declared.length !== 1 || declared[0].attribute !== LANDMARK_KIND_ATTRIBUTE) bad();
    const value = declared[0].value.trim();
    if (!/^[a-z]+(?:[ -][a-z]+){0,2}$/i.test(value) || NOT_A_KIND.test(value)) bad();
    if (mutableAttributes.some(m => m.entityId === e.id && isKind(m.attribute)) ||
      continuity.pages.some(p => p.changes.some(c => c.entityId === e.id && isKind(c.attribute)))) bad();
    return { id: e.id, kind: value.toLowerCase() };
  });
}
