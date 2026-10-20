import 'server-only';
import { z } from 'zod';
import type { PreviewPlan } from '../local-story-preview';
import { BOOK_SEQUENCE_ROLES, type bookSequenceSchema } from '../local-book-sequence';
import { wholeBookDraftSchema, ownedWholeBookDraftSchema } from '../local-book-planning';
import { drawnInstantDepictedSchema, STORYBOARD_MOMENTS_VERSION, type MomentsPolicy } from './storyboard-moments';
import { claimBasisFrameSchema, claimBasisMomentsPolicy, frameVisible } from './storyboard-claim-basis';
import { findingKey } from './storyboard-diagnosis';
import { calibrationSelfCheckStoryboardAddendum } from './storyboard-calibration';

/**
 * Opt-in PRESENCE contract (storyboard-presence/v1; needs the calibration and so every contract it needs). Owner-directed 2026-10-20
 * (OWNER-SAME-BOOK-CONTINUATION-AFTER-ATTEMPT5-20261020.txt). Two general, versioned components:
 * - storyboard-unplaced-presence/v1: the drawn-instant contract must declare, at an instant earlier than its page's end, the state of every
 *   visible entity a later transition of that page changes; its only forms were a precise relation (stated or staged), so a cast member the
 *   text includes in the scene without placing them had to be given an invented position, contact or move. A visible cast member whose
 *   relation the drawn instant must declare may instead be listed in depicted.presence {actorId, evidence}: present in the drawn scene, with
 *   no position, move, contact, custody or action claimed. Its quote is a same-page sentence that begins no later than the drawn instant and
 *   puts them in the scene; the compiler verifies the structure (a visible cast member with a later transition on that page, no relation
 *   override and no temporary look there, never staged); the engine draws them at the scene's own place (the frame's location), touching
 *   nothing, and the review judges whether the text puts them in that scene. It asserts no relation to any entity, so it cannot create
 *   access, custody, contact or distance: a material relation still needs a stated claim and its evidence, and an action its own look.
 * - storyboard-repeated-reference/v1: a repair's planner input lists every reference held for the same impact in each of the last two
 *   reviews (a drawn-instant relation slot p{n}:relation:{id} also with the values the two held drafts gave it). Another quote is not a
 *   remedy for it: such a finding's resolution may not name the cause evidence_binding, a listed relation slot may be declared again only
 *   as a stated relation whose relation or target differs from every value it was held with (never staged), and its entity may not be
 *   hidden from that frame. A genuinely changed relation goes to the unchanged review; the review's findings, their impacts and reasons
 *   are never changed or reinterpreted by the engine.
 * Absent, nothing changes: no source, digest, instruction, schema, review input or packet byte differs.
 */
export const STORYBOARD_PRESENCE_VERSION = 'storyboard-presence/v1' as const;
export const UNPLACED_PRESENCE_VERSION = 'storyboard-unplaced-presence/v1' as const;
export const REPEATED_REFERENCE_VERSION = 'storyboard-repeated-reference/v1' as const;
export const PRESENCE_COMPONENTS = Object.freeze([UNPLACED_PRESENCE_VERSION, REPEATED_REFERENCE_VERSION] as const);
type Sequence = z.infer<typeof bookSequenceSchema>;
const fail = (code: string): never => { throw Error(`storyboard_presence_${code}`); };
const id = z.string().regex(/^[a-z][a-z0-9_]{0,49}$/);
const quote = z.string().trim().min(1).max(400);

/** Under the contract every depicted instant also lists presence (empty when none); the frames are the claim basis's otherwise. */
export const presenceEntrySchema = z.object({ actorId: id, evidence: quote }).strict();
export const presenceDepictedSchema = drawnInstantDepictedSchema.extend({ presence: z.array(presenceEntrySchema).max(4) }).strict();
export const presenceFrameSchema = claimBasisFrameSchema.extend({ depicted: presenceDepictedSchema.nullable() }).strict();
export const presenceMomentsSchema = z.object({ version: z.literal(STORYBOARD_MOMENTS_VERSION), frames: z.array(presenceFrameSchema).min(3).max(25) }).strict();
export const presenceWholeBookDraftSchema = wholeBookDraftSchema.extend({ moments: presenceMomentsSchema });
export const ownedPresenceWholeBookDraftSchema = ownedWholeBookDraftSchema.extend({ moments: presenceMomentsSchema });
/** The moments validator's policy under the contract: the claim basis's, with these frames, a present actor drawn at the frame's location. */
export const presenceMomentsPolicy: MomentsPolicy = { ...claimBasisMomentsPolicy, schema: presenceMomentsSchema, presence: true };
export type PresenceEntry = z.infer<typeof presenceEntrySchema>;
type PresenceFrame = { depicted: { evidence: string; relations: { entityId: string }[]; actorStates?: { actorId: string }[]; presence: PresenceEntry[] } | null;
  staging: { ref: string }[] };

/**
 * The contract's presence entries, validated against the compiled plan and sequence and the exact page texts (structure only): on a body
 * page with a drawn instant, at most one per actor, each a cast member (the child, the companion or a supporting character) visible in that
 * frame with no relation override and no temporary look (actorStates: a pose or action) there, whose quote begins in that page's text no
 * later than the end of the drawn instant's quote, and who has a transition later on that page (presence only replaces a relation the drawn
 * instant must declare); a presence is never staged.
 */
export function validatePresence(frames: readonly PresenceFrame[], plan: PreviewPlan, sequence: Sequence, texts: readonly string[]) {
  const cast = new Set<string>([BOOK_SEQUENCE_ROLES.child, BOOK_SEQUENCE_ROLES.companion,
    ...(plan.continuity?.entities ?? []).filter(e => e.kind === 'supporting_character').map(e => e.id)]);
  frames.forEach((frame, n) => {
    const d = frame.depicted, presence = d?.presence ?? [];
    if (frame.staging.some(s => /^p\d+:presence:/.test(s.ref))) fail('staged');
    if (!d || !presence.length) return;
    const page = sequence.pages[n - 1], text = texts[n], end = text.indexOf(d.evidence) + d.evidence.length;
    const looks = new Set((d.actorStates ?? []).map(a => a.actorId));
    if (new Set(presence.map(p => p.actorId)).size !== presence.length) fail('duplicate');
    for (const p of presence) {
      if (!cast.has(p.actorId)) fail('not_cast');
      if (!page.visibleCastIds.includes(p.actorId)) fail('not_visible');
      if (d.relations.some(o => o.entityId === p.actorId)) fail('with_relation');
      if (looks.has(p.actorId)) fail('with_state');
      const at = text.indexOf(p.evidence);
      if (at < 0 || at >= end) fail('evidence');
      if (!page.transitions.some(t => t.entityId === p.actorId && text.indexOf(t.evidence) >= end)) fail('not_needed');
    }
  });
}

/** A typed finding of a held review as a repair's planner input carries it (claim basis): its check and its issues. */
type TypedFinding = { scope: 'book' | 'page'; pageNumber?: number; category: string; issues: readonly { impact: string; ref: string }[] };
/** A drawn-instant relation's structured content: the relation and its target (its quote is not part of it). */
export type RelationValue = { relation: string; targetId: string | null };
/**
 * A reference both last reviews held for the same impact. A drawn-instant relation reference (p{n}:relation:{id}) names a slot, not a claim,
 * so it also carries `heldValues`: the relation values the two held drafts themselves gave that slot (latest first, each once).
 */
export type RepeatedReference = { ref: string; impact: string; checks: string[]; previousChecks: string[]; heldValues?: RelationValue[] };
const RELATION_REF = /^p(\d{1,2}):relation:([a-z][a-z0-9_]{0,49})$/;
const sameRelation = (a: RelationValue, b: RelationValue) => a.relation === b.relation && a.targetId === b.targetId;
/**
 * Every reference that a blocking finding of the latest review and a blocking finding of the review before it both hold for the same impact,
 * with the checks that hold it in each (latest first), sorted by reference then impact. Derived from the two reviews' own typed findings.
 */
export function repeatedReferences(latest: readonly TypedFinding[], previous: readonly TypedFinding[]): RepeatedReference[] {
  const held = (findings: readonly TypedFinding[]) => findings.flatMap(f => f.issues.map(i => ({ ref: i.ref, impact: i.impact, check: findingKey(f) })));
  const now = held(latest), before = held(previous), out = new Map<string, RepeatedReference>();
  for (const i of now) {
    const earlier = before.filter(b => b.ref === i.ref && b.impact === i.impact);
    if (!earlier.length) continue;
    const key = `${i.ref}\u0000${i.impact}`, entry = out.get(key) ?? { ref: i.ref, impact: i.impact, checks: [], previousChecks: [] };
    if (!entry.checks.includes(i.check)) entry.checks.push(i.check);
    for (const b of earlier) if (!entry.previousChecks.includes(b.check)) entry.previousChecks.push(b.check);
    out.set(key, entry);
  }
  return [...out.values()].sort((a, b) => a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : a.impact < b.impact ? -1 : a.impact > b.impact ? 1 : 0);
}
/** The typed findings a repair's planner input carries, or null when they are not typed (the rule then has nothing to compare). */
export const typedFindingsOf = (raw: unknown): TypedFinding[] | null => Array.isArray(raw) &&
  raw.every(f => f && typeof f === 'object' && Array.isArray((f as { issues?: unknown }).issues)) ? raw as TypedFinding[] : null;
/** A raw draft's drawn-instant relation value for one entity on frame n (its structured content only), if it declares one. */
export function draftRelationValue(raw: unknown, n: number, entityId: string): RelationValue | undefined {
  const frames = (raw as { moments?: { frames?: unknown[] } } | null)?.moments?.frames;
  const relations = (frames?.[n] as { depicted?: { relations?: { entityId?: unknown; value?: { relation?: unknown; targetId?: unknown } }[] } | null } | undefined)
    ?.depicted?.relations;
  const value = Array.isArray(relations) ? relations.find(o => o?.entityId === entityId)?.value : undefined;
  return value && typeof value.relation === 'string' && (typeof value.targetId === 'string' || value.targetId === null)
    ? { relation: value.relation, targetId: value.targetId } : undefined;
}
/** Each repeated relation reference with the values the two held drafts gave its slot (the latest held draft first); other references unchanged. */
export function withHeldValues(repeated: readonly RepeatedReference[], latestDraft: unknown, previousDraft: unknown): RepeatedReference[] {
  return repeated.map(r => {
    const m = RELATION_REF.exec(r.ref);
    if (!m) return r;
    const values = [latestDraft, previousDraft].flatMap(d => { const v = draftRelationValue(d, Number(m[1]), m[2]); return v ? [v] : []; });
    return { ...r, heldValues: values.filter((v, i) => values.findIndex(w => sameRelation(v, w)) === i) };
  });
}

/**
 * The repeated-reference rule on a candidate (structure only): a resolution of a check that holds a repeated reference does not name the cause
 * evidence_binding; a repeated drawn-instant relation slot is declared again only as a stated relation whose structured content (relation and
 * target) differs from every value it was held with, never staged and never without that provenance, so an identical failed relation with
 * only another quote or cause cannot be recycled while a genuinely changed one reaches the unchanged review; and the entity of such a
 * reference, visible in that frame of the parent draft, stays visible there.
 */
export function validateRepeatedReferences(repeated: readonly RepeatedReference[], resolutions: readonly { finding: string; cause: string }[],
  candidateClaims: (n: number) => readonly string[], parentVisible: (n: number) => ReadonlySet<string>, candidateVisible: (n: number) => ReadonlySet<string>,
  candidateRelation: (n: number, entityId: string) => RelationValue | undefined, candidateStaged: (n: number) => ReadonlySet<string>) {
  const keys = new Set(repeated.flatMap(r => r.checks));
  if (resolutions.some(r => keys.has(r.finding) && r.cause === 'evidence_binding')) fail('repeated_rebind');
  // A frame declares at most one relation per entity (duplicate_override), so a relation claim ref never carries an ordinal suffix.
  for (const r of repeated) {
    const m = RELATION_REF.exec(r.ref);
    if (!m) continue;
    const n = Number(m[1]), id = m[2];
    if (candidateClaims(n).includes(r.ref)) {
      const value = candidateRelation(n, id), held = r.heldValues ?? [];
      if (candidateStaged(n).has(r.ref) || !value || !held.length || held.some(h => sameRelation(h, value))) fail('repeated_claim');
    }
    if (parentVisible(n).has(id) && !candidateVisible(n).has(id)) fail('repeated_hidden');
  }
}
/** A raw draft's frame visible ids (its own sequence visibleCastIds and continuity visibleEntityIds), for the parent of a repair. */
export const draftFrameVisible = (raw: unknown, n: number) => {
  const d = raw as { plan?: PreviewPlan; sequence?: Sequence };
  return d?.plan && d.sequence ? frameVisible(d.plan, d.sequence, n) : new Set<string>();
};

export const PRESENCE_STORYBOARD_ADDENDUM = `PRESENCE (storyboard-presence/v1; the compiler and the review apply it; it refines the rules above):
- A visible cast member whose state the drawn instant must declare (a transition later on its page) but whose place at that instant the page does not state goes in depicted.presence as {actorId, evidence}, not in depicted.relations. evidence is an exact quote of that page, beginning no later than the drawn instant, that puts them in the scene (for example their own words). Presence is not a place, a move, a contact or an action: the picture shows them in the scene touching, holding, pushing and acting on nothing, so they have no depicted.relations or depicted.actorStates entry on that frame, and that frame's composition, actions and staging must not place them or give them any of those. Every depicted lists presence, empty when there is none. Its claim ref is p{n}:presence:{actorId}: one of that frame's selfCheck claims (quoted like every claim), never staged. The compiler refuses a presence for an actor that is not the child, the companion or a supporting character, is not visible on that frame, has no transition later on that page, or has a relation or temporary look on that frame, and an evidence quote that is not on that page or begins after the drawn instant.
- priorReviewedStoryboard.repeatedReferences lists references held for the same impact in each of the last two reviews; a relation reference p{n}:relation:{id} also lists heldValues, the relation values it was held with. Another quote is not a remedy: change the claim itself. Never declare a listed p{n}:relation:{id} again with a relation and target equal to one of its heldValues, and never stage it; a relation the page states with a different relation or target may be declared, and the review judges it; otherwise use presence, or a drawn instant that needs no such claim. Do not hide its entity, and never give such a finding the cause evidence_binding.`;

/**
 * The planner's self-check entry under the contract: the calibration's, with the presence claim named in its claims list (the compiler
 * requires every frame claim there exactly, so the instruction names every form it requires).
 */
export function presenceSelfCheckStoryboardAddendum() {
  const base = calibrationSelfCheckStoryboardAddendum(), anchor = 'p{n}:scene (sceneChangeEvidence);';
  if (base.split(anchor).length !== 2) fail('instruction');
  return base.replace(anchor, 'p{n}:scene (sceneChangeEvidence), p{n}:presence:{actorId} (depicted.presence);');
}

export const PRESENCE_REVIEW_ADDENDUM =`PRESENCE (storyboard-presence/v1): moments.frames[n].depicted.presence lists actors present in the drawn scene without a placement. It claims no position, move, contact, custody or action; they are drawn at the scene's own place, touching nothing. Judge only whether the text puts the actor in this scene by the drawn instant (its quote, claim ref p{n}:presence:{actorId}) and whether the frame elsewhere (composition, actions, requirements, staging) gives them a position, contact or action the text does not state. Never hold a presence for its position being unstated.`;
