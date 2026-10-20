import { z } from 'zod';
import { BOOK_SEQUENCE_ROLES, bookSequenceSchema } from '../local-book-sequence';
import { wholeBookDraftSchema, ownedWholeBookDraftSchema } from '../local-book-planning';
import type { PreviewPlan } from '../local-story-preview';
import { drawnInstantGaps } from './storyboard-drawn-instant';

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
/** The drawn-instant contract's temporary look of the child or the companion at the drawn instant (storyboard-drawn-instant.ts). */
export const actorStateSchema = z.object({ actorId: z.enum([BOOK_SEQUENCE_ROLES.child, BOOK_SEQUENCE_ROLES.companion]),
  state: z.string().trim().min(3).max(240), evidence: quote }).strict();
/** With the drawn-instant contract only: every depicted instant also lists actorStates (empty when none). */
export const drawnInstantDepictedSchema = depictedInstantSchema.extend({ actorStates: z.array(actorStateSchema).max(2) }).strict();
export const drawnInstantMomentsSchema = storyboardMomentsSchema.extend({
  frames: z.array(z.object({ requirements: z.array(momentRequirementSchema).max(6), depicted: drawnInstantDepictedSchema.nullable() }).strict()).min(3).max(25),
}).strict();
export const drawnInstantWholeBookDraftSchema = wholeBookDraftSchema.extend({ moments: drawnInstantMomentsSchema });
export const ownedDrawnInstantWholeBookDraftSchema = ownedWholeBookDraftSchema.extend({ moments: drawnInstantMomentsSchema });
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

/**
 * Opt-in policy hooks a later contract supplies (storyboard-claim-basis/v1, which needs the drawn-instant contract): its frame schema, the
 * page(s) whose text holds a requirement's evidence, and visible-only drawn-instant completeness (a depicted instant may then keep no override
 * once the compiler dropped the overrides of entities its frame does not show). Absent, exactly the existing validation.
 */
export type MomentsPolicy = { schema: z.ZodTypeAny; requirementPages: (requirement: { kind: string; revealPage?: number | null }, n: number) => number[];
  visibleOnly: true; presence?: true };
/**
 * Deterministic validation against the compiled plan/sequence and the exact page texts. With the opt-in drawn-instant contract, every depicted
 * instant also lists actorStates (a temporary look of a visible child or companion, quoted on its page), an instant may consist of those alone,
 * and every change its page makes after the drawn instant must be overridden (drawnInstantGaps).
 */
export function validateStoryboardMoments(raw: unknown, plan: PreviewPlan, sequence: Sequence, texts: readonly string[], drawnInstant?: true,
  policy?: MomentsPolicy): StoryboardMoments {
  if (drawnInstant !== undefined && drawnInstant !== true) fail('drawn_instant_policy');
  if (policy !== undefined && (drawnInstant !== true || policy.visibleOnly !== true)) fail('moments_policy');
  const m: StoryboardMoments = (policy ? policy.schema : drawnInstant ? drawnInstantMomentsSchema : storyboardMomentsSchema).parse(raw);
  if (!plan.continuity || m.frames.length !== plan.pages.length || texts.length !== plan.pages.length) fail('coverage');
  const entities = [BOOK_SEQUENCE_ROLES.child, BOOK_SEQUENCE_ROLES.companion, ...plan.continuity!.entities.map(e => e.id)];
  const locations = plan.locations.map(l => l.id);
  const cast = [BOOK_SEQUENCE_ROLES.child, BOOK_SEQUENCE_ROLES.companion,
    ...plan.continuity!.entities.filter(e => e.kind === 'supporting_character').map(e => e.id)];
  const mutable = new Set(sequence.mutableAttributes.map(a => `${a.entityId}:${a.attribute}`));
  m.frames.forEach((frame, n) => {
    const quoted = (evidence: string) => n === 0 ? texts[0].includes(evidence) || texts[1].includes(evidence) : texts[n].includes(evidence);
    // Under a policy a requirement's evidence lives on the page(s) the policy names (for example a withheld entity's reveal page).
    const requirementQuoted = (r: StoryboardMoments['frames'][number]['requirements'][number]) => policy
      ? policy.requirementPages(r as { kind: string; revealPage?: number | null }, n).some(p => texts[p]?.includes(r.evidence)) : quoted(r.evidence);
    if (frame.requirements.some(r => !requirementQuoted(r))) fail('requirement_evidence');
    if (new Set(frame.requirements.map(r => `${r.kind}:${r.subject.toLowerCase()}`)).size !== frame.requirements.length) fail('duplicate_requirement');
    const d = frame.depicted;
    if (!d) return;
    if (n === 0) fail('cover_depicted');
    const actorStates = drawnInstant ? (d as z.infer<typeof drawnInstantDepictedSchema>).actorStates : [];
    if (!policy && !d.relations.length && !d.attributes.length && !actorStates.length) fail('depicted_empty');
    if (!texts[n].includes(d.evidence) || [...d.relations, ...d.attributes, ...actorStates].some(o => !texts[n].includes(o.evidence))) fail('depicted_evidence');
    const page = sequence.pages[n - 1], ledger = new Map(page.states.map(s => [s.entityId, s.value]));
    if (new Set(actorStates.map(a => a.actorId)).size !== actorStates.length) fail('duplicate_actor_state');
    if (actorStates.some(a => !page.visibleCastIds.includes(a.actorId))) fail('actor_state_not_visible');
    if (new Set(d.relations.map(o => o.entityId)).size !== d.relations.length) fail('duplicate_override');
    for (const o of d.relations) {
      if (!ledger.has(o.entityId)) fail('unknown_entity');
      if (equal(ledger.get(o.entityId), o.value)) fail('depicted_noop');
    }
    // Under a presence policy (storyboard-presence/v1) a present actor is drawn at the frame's own location.
    const drawn = drawnStates(page.states, d, policy?.presence ? plan.pages[n].locationId : undefined);
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
  // Drawn-instant contract: a change the page makes after its drawn instant must be overridden, offscreen or not (under a visible-only
  // policy: for the entities its frame shows).
  const gap = drawnInstant ? drawnInstantGaps(m, plan, sequence, texts, policy?.visibleOnly)[0] : undefined;
  if (gap) fail(gap.kind === 'relation' ? 'drawn_instant_relation' : 'drawn_instant_attribute');
  return m;
}

/**
 * The relations at a frame's drawn instant: the end-of-page states with the instant's overrides. `presenceAt` (storyboard-presence/v1 only):
 * the frame's location, where an actor the instant lists in depicted.presence is drawn (at the scene's place, related to no entity); absent,
 * exactly the existing derivation.
 */
export function drawnStates(states: readonly State[], depicted: StoryboardMoments['frames'][number]['depicted'], presenceAt?: string): State[] {
  if (!depicted) return states.map(s => structuredClone(s));
  const overrides = new Map(depicted.relations.map(o => [o.entityId, o.value]));
  const present = presenceAt !== undefined && 'presence' in depicted
    ? new Set((depicted as { presence: { actorId: string }[] }).presence.map(p => p.actorId)) : null;
  return states.map(s => ({ entityId: s.entityId, value: structuredClone(present?.has(s.entityId) ? { relation: 'at' as const, targetId: presenceAt! }
    : overrides.get(s.entityId) ?? s.value) }));
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

/**
 * The frame's moment lines for the render prompt. Under the claim-basis contract (its frames carry `staging`): a staged claim is illustration
 * direction, a withheld entity waits for its reveal page, and a verified citation (`citations`, by claim ref) replaces a claim's narrow quote.
 * A frame without `staging` renders exactly as before.
 */
export function momentRenderSection(moments: StoryboardMoments, pageNumber: number, citations?: ReadonlyMap<string, string>) {
  const frame = moments.frames[pageNumber];
  const lines: string[] = [];
  const basis = 'staging' in frame ? { staged: new Set((frame as unknown as { staging: { ref: string }[] }).staging.map(s => s.ref)) } : null;
  const cited = (ref: string, evidence: string) => basis && citations?.get(ref) ? citations.get(ref)! : evidence;
  if (frame.depicted) lines.push(`DRAWN INSTANT (this picture, not the end of the page): "${frame.depicted.evidence}". ` +
    'The sequence relations above already describe this instant; later pages still continue from the end-of-page ledger.');
  // Drawn-instant contract only: the temporary looks declared for this instant (absent field, absent line).
  const looks = frame.depicted && 'actorStates' in frame.depicted ? (frame.depicted as z.infer<typeof drawnInstantDepictedSchema>).actorStates : [];
  if (looks.length) lines.push('AT THIS INSTANT ONLY (temporary look, not the end of the page):', ...looks.map(a => `- ${a.actorId}: ${a.state} (text: "${
    cited(`p${pageNumber}:actor:${a.actorId}`, a.evidence)}")${basis?.staged.has(`p${pageNumber}:actor:${a.actorId}`) ? ' [visual direction]' : ''}`));
  // Presence contract only (storyboard-presence/v1): actors present in the drawn scene without a placement (absent field, absent line).
  const present = frame.depicted && 'presence' in frame.depicted ? (frame.depicted as { presence: { actorId: string; evidence: string }[] }).presence : [];
  if (present.length) lines.push('IN THE SCENE, NOT PLACED (the text has them in this scene but does not say where they are):', ...present.map(p =>
    `- ${p.actorId}: part of this scene at its place; not touching, holding, pushing, carrying or acting on anything (text: "${
      cited(`p${pageNumber}:presence:${p.actorId}`, p.evidence)}")`));
  if (!basis) {
    if (frame.requirements.length) lines.push('PAGE MEANING (source-quoted, story-critical):', ...frame.requirements.map(r =>
      `- ${r.kind === 'show' ? 'MUST SHOW' : 'MUST AVOID'}: ${r.subject} (text: "${r.evidence}")`));
    return lines.join('\n');
  }
  const all = frame.requirements.map((r, i) => ({ r: r as { kind: string; subject: string; evidence: string; revealPage?: number | null },
    ref: `p${pageNumber}:requirement:${i}` }));
  const stated = all.filter(x => x.r.kind !== 'withhold' && !basis.staged.has(x.ref)), withheld = all.filter(x => x.r.kind === 'withhold');
  const staged = all.filter(x => x.r.kind !== 'withhold' && basis.staged.has(x.ref));
  if (stated.length) lines.push('PAGE MEANING (source-quoted, story-critical):', ...stated.map(({ r, ref }) =>
    `- ${r.kind === 'show' ? 'MUST SHOW' : 'MUST AVOID'}: ${r.subject} (text: "${cited(ref, r.evidence)}")`));
  if (withheld.length) lines.push('NOT YET (revealed on a later page; keep it out of this picture):', ...withheld.map(({ r }) =>
    `- ${r.subject} (first shown on page ${r.revealPage})`));
  if (staged.length) lines.push('ILLUSTRATION DIRECTION (a visual choice that fits the text, not a story fact):', ...staged.map(({ r }) =>
    `- ${r.kind === 'show' ? 'SHOW' : 'AVOID'}: ${r.subject}`));
  return lines.join('\n');
}
