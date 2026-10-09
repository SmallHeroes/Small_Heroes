import { z } from 'zod';
import { BOOK_SEQUENCE_ROLES, bookSequenceSchema } from '../local-book-sequence';
import { wholeBookDraftSchema, ownedWholeBookDraftSchema } from '../local-book-planning';
import type { PreviewPlan } from '../local-story-preview';

/**
 * Opt-in storyboard contract: WHICH instant each picture shows, separately from the continuity ledger.
 * The sequence keeps recording END-of-page state for later pages. A frame may instead depict an earlier or
 * in-between instant of the same page (a joke, a failure, a reveal) when the page text says so, quoted
 * exactly. Frames may also carry a few source-quoted "show"/"avoid" requirements that carry the page's meaning.
 * Absent `moments`, every existing storyboard, digest and packet is unchanged.
 */
export const STORYBOARD_MOMENTS_VERSION = 'storyboard-moments/v1';
const id = z.string().regex(/^[a-z][a-z0-9_]{0,49}$/);
const quote = z.string().trim().min(1).max(400);
const relation = bookSequenceSchema.shape.pages.element.shape.states.element.shape.value;
export const momentRequirementSchema = z.object({
  kind: z.enum(['show', 'avoid']), subject: z.string().trim().min(3).max(240), evidence: quote,
}).strict();
export const depictedInstantSchema = z.object({
  evidence: quote,
  relations: z.array(z.object({ entityId: id, value: relation, evidence: quote }).strict()).max(12),
  attributes: z.array(z.object({ entityId: id, attribute: z.string().trim().min(1).max(400),
    value: z.string().trim().min(1).max(1800), evidence: quote }).strict()).max(8),
}).strict();
export const storyboardMomentsSchema = z.object({
  version: z.literal(STORYBOARD_MOMENTS_VERSION),
  frames: z.array(z.object({ requirements: z.array(momentRequirementSchema).max(6), depicted: depictedInstantSchema.nullable() }).strict()).min(3).max(25),
}).strict();
export type StoryboardMoments = z.infer<typeof storyboardMomentsSchema>;
/** Authoring schemas for the opt-in contract only; the existing draft schemas are untouched. */
export const momentWholeBookDraftSchema = wholeBookDraftSchema.extend({ moments: storyboardMomentsSchema });
export const ownedMomentWholeBookDraftSchema = ownedWholeBookDraftSchema.extend({ moments: storyboardMomentsSchema });
type Sequence = z.infer<typeof bookSequenceSchema>;
type State = Sequence['pages'][number]['states'][number];
const fail = (code: string): never => { throw Error(`storyboard_moments_${code}`); };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const MOMENT_STORYBOARD_ADDENDUM = `DRAWN INSTANT AND PAGE MEANING (moments contract):
sequence states/transitions stay the END-of-page continuity ledger used by later pages. A picture is not obliged to show the end of its page.
For each frame decide the page's role (clue, discovery, complication, failed attempt, joke, solution, quiet emotion or ending) and what changes on it,
then choose the single coherent instant that conveys that best. It may be a failure, a reveal, an action, a joke, a connection or a quiet moment;
a calm ending is valid when it is the page's meaning. Do not default to the aftermath when it drops the page's key event.
If the chosen instant differs from the end-of-page ledger, declare it in moments.frames[n].depicted: each entity relation or declared mutable
attribute value that differs AT THAT INSTANT, each with an exact same-page quote. Entities not present yet at that instant are unestablished and
must not be listed as visible. The cover's depicted is null. Describe the SAME instant in composition, actions, scene and prop states.
requirements: at most six items the picture must show or avoid to carry this page's meaning, each with an exact quote from this page
(cover: the title or page 1). Use them for: a story-significant absence (give it a positive visual sign), a clue that must not appear before
its reveal or point at the wrong maker, a magical or changed object that must keep a readable identifying form, and an expression, gaze or
key action that the text states. No generic ban lists and no quota of jokes or magic per page.`;

export const MOMENT_REVIEW_ADDENDUM = `MOMENTS CONTRACT: sequence is the END-of-page ledger; moments.frames[n].depicted declares the instant actually drawn.
For moment: judge whether the drawn instant conveys this page's distinctive meaning (event, failure, joke, reveal, magic or emotion). An aftermath
chosen only for convenience that drops the page's key event is a contradiction; a quiet instant that is the page's meaning is supported.
For physical_state: every depicted override and requirement must be supported by its own quote and must not contradict the ledger before or after
this page. A requirement that bans something the data requires, or demands something the data forbids, is a contradiction.`;

/** Deterministic validation against the compiled plan/sequence and the exact page texts. */
export function validateStoryboardMoments(raw: unknown, plan: PreviewPlan, sequence: Sequence, texts: readonly string[]): StoryboardMoments {
  const m = storyboardMomentsSchema.parse(raw);
  if (!plan.continuity || m.frames.length !== plan.pages.length || texts.length !== plan.pages.length) fail('coverage');
  const entities = [BOOK_SEQUENCE_ROLES.child, BOOK_SEQUENCE_ROLES.companion, ...plan.continuity!.entities.map(e => e.id)];
  const locations = plan.locations.map(l => l.id);
  const cast = [BOOK_SEQUENCE_ROLES.child, BOOK_SEQUENCE_ROLES.companion,
    ...plan.continuity!.entities.filter(e => e.kind === 'supporting_character').map(e => e.id)];
  const mutable = new Set(sequence.mutableAttributes.map(a => `${a.entityId}:${a.attribute}`));
  m.frames.forEach((frame, n) => {
    const quoted = (evidence: string) => n === 0 ? texts[0].includes(evidence) || texts[1].includes(evidence) : texts[n].includes(evidence);
    if (frame.requirements.some(r => !quoted(r.evidence))) fail('requirement_evidence');
    if (new Set(frame.requirements.map(r => `${r.kind}:${r.subject.toLowerCase()}`)).size !== frame.requirements.length) fail('duplicate_requirement');
    const d = frame.depicted;
    if (!d) return;
    if (n === 0) fail('cover_depicted');
    if (!d.relations.length && !d.attributes.length) fail('depicted_empty');
    if (!texts[n].includes(d.evidence) || [...d.relations, ...d.attributes].some(o => !texts[n].includes(o.evidence))) fail('depicted_evidence');
    const page = sequence.pages[n - 1], ledger = new Map(page.states.map(s => [s.entityId, s.value]));
    if (new Set(d.relations.map(o => o.entityId)).size !== d.relations.length) fail('duplicate_override');
    for (const o of d.relations) {
      if (!ledger.has(o.entityId)) fail('unknown_entity');
      if (equal(ledger.get(o.entityId), o.value)) fail('depicted_noop');
    }
    const drawn = drawnStates(page.states, d);
    const visible = new Set([...plan.continuity!.pages[n].visibleEntityIds, ...page.visibleCastIds]);
    const at = new Map(drawn.map(s => [s.entityId, s.value]));
    for (const { entityId, value: v } of drawn) {
      if (v.relation === 'unestablished' ? v.targetId !== null || visible.has(entityId)
        : !v.targetId || v.targetId === entityId || ![...entities, ...locations].includes(v.targetId)) fail('drawn_relation_binding');
      if (v.relation === 'held_by' && !cast.includes(v.targetId!)) fail('drawn_custody_target');
      if (v.targetId && at.get(v.targetId)?.relation === 'unestablished') fail('drawn_unestablished_target');
    }
    const parents = new Map(drawn.filter(s => ['inside', 'on', 'held_by', 'attached_to'].includes(s.value.relation)).map(s => [s.entityId, s.value.targetId!]));
    for (const start of parents.keys()) {
      const seen = new Set<string>(); let next: string | undefined = start;
      while (next && parents.has(next)) { if (seen.has(next)) fail('drawn_relation_cycle'); seen.add(next); next = parents.get(next); }
    }
    if (new Set(d.attributes.map(a => `${a.entityId}:${a.attribute}`)).size !== d.attributes.length ||
      d.attributes.some(a => !mutable.has(`${a.entityId}:${a.attribute}`))) fail('depicted_attribute');
  });
  return m;
}

export function drawnStates(states: readonly State[], depicted: StoryboardMoments['frames'][number]['depicted']): State[] {
  if (!depicted) return states.map(s => structuredClone(s));
  const overrides = new Map(depicted.relations.map(o => [o.entityId, o.value]));
  return states.map(s => ({ entityId: s.entityId, value: structuredClone(overrides.get(s.entityId) ?? s.value) }));
}

/**
 * Plan copy whose page-n continuity reflects the drawn instant, so the existing prompt and QA projections describe
 * the picture actually requested. Render/QA only: never persisted and never fed back into the ledger.
 */
export function planAtDrawnInstant(plan: PreviewPlan, moments: StoryboardMoments, pageNumber: number): PreviewPlan {
  const d = moments.frames[pageNumber]?.depicted;
  if (!d || !d.attributes.length) return plan;
  const copy = structuredClone(plan), page = copy.continuity!.pages[pageNumber];
  for (const a of d.attributes) {
    page.changes = page.changes.filter(c => !(c.entityId === a.entityId && c.attribute === a.attribute));
    page.changes.push({ entityId: a.entityId, attribute: a.attribute, value: a.value, storyEvidence: a.evidence });
  }
  return copy;
}

export function momentRenderSection(moments: StoryboardMoments, pageNumber: number) {
  const frame = moments.frames[pageNumber];
  const lines: string[] = [];
  if (frame.depicted) lines.push(`DRAWN INSTANT (this picture, not the end of the page): "${frame.depicted.evidence}". ` +
    'The sequence relations above already describe this instant; later pages still continue from the end-of-page ledger.');
  if (frame.requirements.length) lines.push('PAGE MEANING (source-quoted, story-critical):', ...frame.requirements.map(r =>
    `- ${r.kind === 'show' ? 'MUST SHOW' : 'MUST AVOID'}: ${r.subject} (text: "${r.evidence}")`));
  return lines.join('\n');
}
