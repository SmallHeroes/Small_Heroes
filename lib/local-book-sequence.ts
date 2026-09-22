import { z } from 'zod';
import { createHash } from 'node:crypto';
import { previewStoryEvidence, type PreviewPlan, type PreviewStory } from './local-story-preview';
import { qualityDisposition, type QualityCandidate, type PreviewQualityReview } from './local-preview-quality';

// Local diagnostic authority only. Does not mint a production contract or source approval.
export const BOOK_SEQUENCE_VERSION = 'local-book-sequence/v1';
const id = z.string().regex(/^[a-z][a-z0-9_]{0,49}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const sentence = z.string().trim().min(1).max(400);
const relation = z.object({
  relation: z.enum(['unestablished', 'at', 'inside', 'beside', 'on', 'held_by', 'attached_to']),
  targetId: id.nullable(),
}).strict();
const state = z.object({ entityId: id, value: relation }).strict();
export const bookSequenceSchema = z.object({
  version: z.literal(BOOK_SEQUENCE_VERSION), sourceSha: hash, planSha: hash,
  premise: sentence,
  mutableAttributes: z.array(z.object({ entityId: id, attribute: sentence }).strict()).max(48),
  pages: z.array(z.object({
    pageNumber: z.number().int().min(1).max(24), sceneId: id, beat: sentence,
    // A scene is a contiguous visit, not a location alias. Returning means a new visit id.
    sceneChangeEvidence: sentence.nullable(),
    visibleCastIds: z.array(id).min(1).max(18),
    states: z.array(state).min(2).max(26),
    transitions: z.array(z.object({ entityId: id, from: relation, to: relation, evidence: sentence }).strict()).max(26),
  }).strict()).min(2).max(24),
}).strict();
type BookSequence = z.infer<typeof bookSequenceSchema>;
const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail = (code: string): never => { throw Error(`book_sequence_${code}`); };
const unique = (items: string[]) => new Set(items).size === items.length;
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function validateBookSequence(raw: unknown, input: {
  story: PreviewStory; planSha: string; plan: PreviewPlan;
}): BookSequence {
  // Reject the removed detached API even for untyped callers; do not silently ignore it.
  if ('texts' in input || 'sourceSha' in input) fail('source_binding');
  const { sourceSha, texts } = previewStoryEvidence(input.story);
  const s = bookSequenceSchema.parse(raw), { plan } = input;
  if (s.sourceSha !== sourceSha || s.planSha !== input.planSha) fail('source_binding');
  if (!plan.continuity || texts.length !== plan.pages.length || s.pages.length !== texts.length - 1) fail('coverage');
  const entities = ['child', 'companion', ...plan.continuity!.entities.map(e => e.id)];
  const locations = plan.locations.map(l => l.id);
  if (!unique([...entities, ...locations])) fail('ambiguous_inventory');
  const cast = ['child', 'companion', ...plan.continuity!.entities.filter(e => e.kind === 'supporting_character').map(e => e.id)];
  const mutable = s.mutableAttributes.map(a => `${a.entityId}:${a.attribute}`);
  if (!unique(mutable) || s.mutableAttributes.some(a => !plan.continuity!.entities.some(e => e.id === a.entityId && e.invariants.some(i => i.attribute === a.attribute)))) fail('mutable_attribute');
  // Appearance is fixed by default. Existing source-evidenced changes must opt in explicitly.
  if (plan.continuity!.pages.some(p => p.changes.some(c => !mutable.includes(`${c.entityId}:${c.attribute}`)))) fail('immutable_attribute_change');
  const visited = new Set<string>();
  s.pages.forEach((page, index) => {
    const n = index + 1, prior = s.pages[index - 1], planned = plan.pages[n];
    if (page.pageNumber !== n || !planned || planned.pageNumber !== n) fail('coverage');
    if (!unique(page.states.map(x => x.entityId)) || !equal(page.states.map(x => x.entityId).sort(), [...entities].sort())) fail('state_inventory');
    if (!unique(page.visibleCastIds) || page.visibleCastIds.some(x => !cast.includes(x)) || !page.visibleCastIds.includes('child')) fail('cast_inventory');
    const supporting = plan.continuity!.pages[n].visibleEntityIds.filter(x => cast.includes(x));
    if (!equal([...supporting].sort(), page.visibleCastIds.filter(x => x !== 'child' && x !== 'companion').sort())) fail('cast_binding');
    const visible = new Set([...plan.continuity!.pages[n].visibleEntityIds, ...page.visibleCastIds]);
    for (const item of page.states) {
      const v = item.value;
      if (v.relation === 'unestablished' ? v.targetId !== null || visible.has(item.entityId)
        : !v.targetId || v.targetId === item.entityId || ![...entities, ...locations].includes(v.targetId)) fail('relation_binding');
      if (v.relation === 'held_by' && (!v.targetId || !cast.includes(v.targetId))) fail('custody_target');
      if (v.targetId && page.states.find(x => x.entityId === v.targetId)?.value.relation === 'unestablished') fail('unestablished_target');
    }
    // Cyclic inside/on/custody chains are not physically meaningful. Beside is symmetric.
    const parents = new Map(page.states.filter(x => ['inside', 'on', 'held_by', 'attached_to'].includes(x.value.relation)).map(x => [x.entityId, x.value.targetId!]));
    for (const start of parents.keys()) {
      const seen = new Set<string>(); let next: string | undefined = start;
      while (next && parents.has(next)) { if (seen.has(next)) fail('relation_cycle'); seen.add(next); next = parents.get(next); }
    }
    if (!prior) {
      if (page.sceneChangeEvidence !== null || page.transitions.length) fail('initial_state');
      visited.add(page.sceneId); return;
    }
    if (page.sceneId === prior.sceneId) {
      if (page.sceneChangeEvidence !== null || planned.locationId !== plan.pages[n - 1].locationId) fail('scene_location_drift');
    } else {
      if (visited.has(page.sceneId) || !page.sceneChangeEvidence || !texts[n].includes(page.sceneChangeEvidence)) fail('scene_transition');
      visited.add(page.sceneId);
    }
    if (!unique(page.transitions.map(t => t.entityId))) fail('duplicate_transition');
    const changed = page.states.filter(x => !equal(x.value, prior.states.find(y => y.entityId === x.entityId)!.value));
    if (!equal(changed.map(x => x.entityId).sort(), page.transitions.map(t => t.entityId).sort())) fail('unexplained_change');
    for (const t of page.transitions) {
      if (!equal(t.from, prior.states.find(x => x.entityId === t.entityId)?.value) ||
        !equal(t.to, page.states.find(x => x.entityId === t.entityId)?.value) || !texts[n].includes(t.evidence)) fail('transition_evidence');
      if (t.to.relation === 'unestablished') fail('state_reset');
    }
  });
  return s;
}

export function validateSequenceSelection(s: BookSequence, pages: number[]) {
  if (!pages.length || pages.some((p, i) => p < 1 || p > s.pages.length || (i > 0 && p !== pages[i - 1] + 1))) fail('consecutive_body_pages_required');
  const first = pages[0];
  if (first > 1 && s.pages[first - 1].sceneId === s.pages[first - 2].sceneId) fail('scene_predecessor_required');
}

export type ReviewedSequencePage = { pageNumber: number; status: string; candidate?: QualityCandidate;
  contextSha?: string; history?: { candidate: QualityCandidate; review: PreviewQualityReview }[] };

export function sequencePredecessor(s: BookSequence, pageNumber: number, completed: readonly ReviewedSequencePage[]) {
  const page = s.pages[pageNumber - 1];
  if (!page) return fail('unknown_page');
  if (pageNumber === 1 || s.pages[pageNumber - 2].sceneId !== page.sceneId) return null;
  const previous = completed[completed.length - 1], last = previous?.history?.[previous.history.length - 1];
  const candidate = previous?.candidate;
  if (previous?.pageNumber !== pageNumber - 1 || previous.status !== 'passed' || !candidate || !last ||
    !equal(candidate, last.candidate) || !previous.contextSha ||
    qualityDisposition(last.review, candidate.imageSha, previous.contextSha).disposition !== 'passed') return fail('unreviewed_predecessor');
  return { pageNumber: previous.pageNumber, ...candidate, authority: 'comparison_only_not_canonical' as const };
}

export function sequencePageState(s: BookSequence, plan: PreviewPlan, pageNumber: number) {
  const page = s.pages[pageNumber - 1];
  if (!page) return fail('unknown_page');
  const visible = new Set([...page.visibleCastIds, ...plan.continuity!.pages[pageNumber].visibleEntityIds]);
  return { version: BOOK_SEQUENCE_VERSION, sequenceDigest: sha(s), bookPremise: s.premise,
    narrativeProgress: s.pages.slice(Math.max(0, pageNumber - 3), pageNumber).map(p => ({ pageNumber: p.pageNumber, beat: p.beat })),
    pageNumber, sceneId: page.sceneId, visibleCastIds: page.visibleCastIds,
    // State persists for invisible entities in the ledger, but visibility never forces them on screen.
    relations: page.states.filter(x => visible.has(x.entityId)), allowedTransitions: page.transitions,
    sceneChangeEvidence: page.sceneChangeEvidence };
}

export function sequencePagePacket(s: BookSequence, plan: PreviewPlan, pageNumber: number, completed: readonly ReviewedSequencePage[]) {
  return { ...sequencePageState(s, plan, pageNumber), predecessor: sequencePredecessor(s, pageNumber, completed) };
}

export function sequenceRenderPrompt(base: string, packet: ReturnType<typeof sequencePagePacket>, referenceIndex: number | null) {
  if (referenceIndex !== null && referenceIndex !== 3 && referenceIndex !== 4) fail('reference_role');
  if (referenceIndex === 3) base = base.replace('image 3, when attached = recurring PROP design board ONLY.', 'image 3 = prior same-scene comparison ONLY; no prop board attached.');
  return `${base}\n\nBOOK SEQUENCE STATE: ${JSON.stringify(packet)}\n` +
    'Keep entity identities and physical relationships from this state. Same scene means the same situation except listed, source-supported transitions. Camera movement, occlusion and expression do not move people or change objects. Narrative history explains motivation, not additional actions to paint. Do not draw offscreen or future entities.\n' +
    (referenceIndex === null ? '' : `Reference image ${referenceIndex} is the prior same-scene image: continuity comparison ONLY, not a new design authority or a pose/camera template. Preserve correct set geometry and unchanging cast positions; do NOT inherit errors or contradict canonical/current state. Apply only the current beat and allowed transitions.\n`);
}
