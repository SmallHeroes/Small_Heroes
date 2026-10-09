import type { PersonalStoryboard } from './storyboard';
import { z } from 'zod';

const id = z.string().regex(/^[a-z][a-z0-9_]{0,49}$/), text = z.string().min(1).max(400);
export const simpleReferenceStateSchema = z.object({
  version: z.literal('source-bound-reference-state/v1'),
  presentation: z.literal('one_known_source_form_per_design_view'),
  mutableAttributes: z.array(z.object({ entityId: id, attribute: text, initialValue: text,
    knownValues: z.array(z.union([
      z.object({ value: text, pageNumber: z.literal(0), evidence: z.null() }).strict(),
      z.object({ value: text, pageNumber: z.number().int().min(1).max(24), evidence: text }).strict(),
    ])).min(1).max(25) }).strict()).max(48),
  stableAttachments: z.array(z.object({ entityId: id, relation: z.literal('attached_to'), targetId: id }).strict()).max(26),
}).strict();

/** Data projection only; current storyboard admission remains the authority. */
export function simpleReferenceEntityDesign(book: Pick<PersonalStoryboard, 'plan' | 'sequence'>, roleScoped?: true,
  stateAware?: true, texts: readonly string[] = []) {
  const base = { props: book.plan.recurringProps, entities: book.plan.continuity!.entities,
    ...(roleScoped ? { childClothingAuthority: book.plan.actorAppearance?.child.clothing ?? book.plan.wardrobe } : {}) };
  if (!stateAware) return base;
  if (!roleScoped) throw Error('simple_reference_state_scope');
  const keys = new Set<string>();
  const mutableAttributes = book.sequence.mutableAttributes.map(m => {
    const key = `${m.entityId}:${m.attribute}`, entity = base.entities.find(e => e.id === m.entityId),
      initial = entity?.invariants.find(a => a.attribute === m.attribute);
    if (!initial || keys.has(key)) throw Error('simple_reference_state_binding'); keys.add(key);
    const knownValues = [{ value: initial.value, pageNumber: 0, evidence: null as string | null }];
    for (const p of book.plan.continuity!.pages) for (const c of p.changes) {
      if (c.entityId !== m.entityId || c.attribute !== m.attribute) continue;
      if (p.pageNumber < 1 || !c.storyEvidence || !texts[p.pageNumber - 1]?.includes(c.storyEvidence)) throw Error('simple_reference_state_evidence');
      knownValues.push({ value: c.value, pageNumber: p.pageNumber, evidence: c.storyEvidence });
    }
    return { ...m, initialValue: initial.value, knownValues };
  });
  for (const p of book.plan.continuity!.pages) for (const c of p.changes)
    if (!keys.has(`${c.entityId}:${c.attribute}`)) throw Error('simple_reference_state_undeclared');
  const stableAttachments = base.entities.flatMap(e => {
    const first = book.sequence.pages[0]?.states.find(s => s.entityId === e.id)?.value;
    return first?.relation === 'attached_to' && first.targetId && book.sequence.pages.every(p => p.states.some(s =>
      s.entityId === e.id && s.value.relation === first.relation && s.value.targetId === first.targetId))
      ? [{ entityId: e.id, relation: 'attached_to' as const, targetId: first.targetId }] : [];
  });
  return { ...base, referenceState: simpleReferenceStateSchema.parse({ version: 'source-bound-reference-state/v1',
    presentation: 'one_known_source_form_per_design_view', mutableAttributes, stableAttachments }) };
}

export const REFERENCE_STATE_RENDER_INSTRUCTION = `REFERENCE STATE POLICY: original invariants contain initial values. Only attributes explicitly listed in referenceState.mutableAttributes may use another exact source-supported knownValue. All other identity, color, material, structure and counted parts remain fixed.
Show one coherent known source form per design view; do not try to depict mutually exclusive chronological states simultaneously. If a detail view is needed, identify it within the same ID tile and preserve all fixed features. These are design references, not a timeline or permission to change a page state.
Do not introduce live primary actors. Required actor-derived shapes (such as a silhouette) ARE part of their listed prop: retain the exact characteristic head, features, proportions and appendages of the accepted actor reference, not a generic animal or person.
For a source-declared stable attachment, a clothing/object detail may show its design; keep its connection to the declared owner consistent with the accepted owner reference. No new biography, prop, costume, or invented state.`;

export const REFERENCE_STATE_JUDGE_ADDITION = `SOURCE-BOUND REFERENCE STATE POLICY:
The original invariants are initial values, with only the explicitly listed mutableAttributes exceptions. Inspect every fixed identity/color/material/structure/count. A visible mutable state must match one of its exact knownValues; name the form you observed. Do not demand mutually exclusive source states at once, and do not treat an omitted future variant as a missing required entity. Unlisted changes remain defects.
This predefined policy permits one known source form per design view, not arbitrary reviewer discretion. A detail/inset must retain the same fixed design. Missing fixed anatomy/identity/structure is still defect or uncertain, never pass by state exception.
Required actor-derived forms must preserve the actual accepted actor silhouette/features, including characteristic head and appendages; a generic dragon/person is not the same identity. Do not demand extra live actors.
For stableAttachments to a canonical actor, inspect the attachment in the accepted actor authority where readable and compare the candidate design detail. An isolated detail is not proof that the story object detached. If its required attachment cannot be verified in either authority or detail, report uncertain. Do not invent a new attachment or excuse actual mismatched clothing. Page-specific physical state remains a separate mandatory page check.`;
