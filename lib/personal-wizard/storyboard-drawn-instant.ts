/**
 * Opt-in DRAWN-INSTANT contract (extends the moments contract; needs it).
 *
 * A frame may show an earlier instant of its page (moments.frames[n].depicted). This contract makes that declaration complete, and the
 * compiler enforces it: a change the page makes AFTER the drawn instant (a sequence transition or a continuity attribute change whose own
 * quote first occurs in the page text after the end of the drawn instant's quote) has not happened yet, so the declaration must override it,
 * offscreen or not. A temporary look of the child or the companion that the ledger cannot track (the companion and the child are fixed roles,
 * not continuity entities) is declared in depicted.actorStates, each with its own same-page quote; an instant may consist of only such looks.
 * Absent, nothing changes: no source, digest, instruction, schema or packet byte differs.
 */
import type { PreviewPlan } from '../local-story-preview';
import type { StoryboardMoments } from './storyboard-moments';
import type { bookSequenceSchema } from '../local-book-sequence';
import type { z } from 'zod';

export const DRAWN_INSTANT_CONTRACT_VERSION = 'storyboard-drawn-instant/v1' as const;

export const DRAWN_INSTANT_STORYBOARD_ADDENDUM = `DRAWN INSTANT COMPLETENESS (drawn-instant contract; it extends the moments contract, and the compiler enforces it):
- A frame's drawn instant is where the first occurrence of its depicted.evidence ends in the page text. A change the same page makes later - a sequence transition whose evidence, or a continuity change whose storyEvidence, first occurs after that point - has not happened yet at the drawn instant: override that entity in depicted.relations (its relation at that instant) or that attribute in depicted.attributes (its value at that instant), with its own exact same-page quote. This holds for every entity, visible, offscreen or cropped out: a crop never removes a state.
- A temporary look of the child or the companion at the drawn instant that the continuity ledger does not track (for example a tail squashed flat, wet fur, a tangled scarf) is declared in depicted.actorStates as {actorId: "child" or "companion", state, evidence} with its own exact same-page quote, at most one per actor and only for an actor visible on that page. A drawn instant may then consist of actorStates alone; every depicted lists actorStates, empty when there is none.
- When a frame's requirements show anything that is not true at the end of its page (such a temporary look, or a state that changes later on that page), the frame must declare that instant in depicted; a null depicted is the end of the page.
- When priorReviewedStoryboard.contractFindings is present, it lists every frame of your previous storyboard that breaks the first rule, found by the compiler; resolve each one exactly like a review finding.`;

export const DRAWN_INSTANT_REVIEW_ADDENDUM = `DRAWN INSTANT (contract): moments.frames[n].depicted.actorStates declares a temporary look of the child or the companion at the drawn instant that the continuity ledger cannot track. Judge each like an override: supported by its own quote and consistent with that instant. A depicted instant may consist of actorStates alone.`;

type Sequence = z.infer<typeof bookSequenceSchema>;
export type DrawnInstantGap = { pageNumber: number; drawnEvidence: string; changeEvidence: string } & (
  { kind: 'relation'; entityId: string; to: Sequence['pages'][number]['transitions'][number]['to'] } |
  { kind: 'attribute'; entityId: string; attribute: string; value: string });

/**
 * Every change a page makes after its frame's declared drawn instant that the declaration does not override. Positions are the FIRST occurrence
 * of each quote in the page text (texts[n]; texts[0] is the cover); a change whose quote begins inside or before the drawn instant's quote has
 * happened by then. Pure: the moments, plan and sequence must already be validated against the same texts. `visibleOnly` (a later opt-in
 * contract): only the entities the frame shows (its visibleCastIds and visibleEntityIds) need an override.
 */
export function drawnInstantGaps(moments: StoryboardMoments, plan: PreviewPlan, sequence: Sequence, texts: readonly string[], visibleOnly?: true): DrawnInstantGap[] {
  const gaps: DrawnInstantGap[] = [];
  moments.frames.forEach((frame, n) => {
    const d = frame.depicted;
    if (n === 0 || !d) return;
    const text = texts[n], end = text.indexOf(d.evidence) + d.evidence.length, later = (quote: string) => text.indexOf(quote) >= end;
    const page = sequence.pages[n - 1];
    const shown = new Set([...page.visibleCastIds, ...plan.continuity!.pages[n].visibleEntityIds]), drawn = (entityId: string) => !visibleOnly || shown.has(entityId);
    const relations = new Set(d.relations.map(o => o.entityId)), attributes = new Set(d.attributes.map(a => `${a.entityId}:${a.attribute}`));
    for (const t of page.transitions) if (later(t.evidence) && !relations.has(t.entityId) && drawn(t.entityId))
      gaps.push({ pageNumber: n, drawnEvidence: d.evidence, changeEvidence: t.evidence, kind: 'relation', entityId: t.entityId, to: t.to });
    for (const c of plan.continuity!.pages[n].changes) if (later(c.storyEvidence) && !attributes.has(`${c.entityId}:${c.attribute}`) && drawn(c.entityId))
      gaps.push({ pageNumber: n, drawnEvidence: d.evidence, changeEvidence: c.storyEvidence, kind: 'attribute', entityId: c.entityId,
        attribute: c.attribute, value: c.value });
  });
  return gaps;
}

/** A gap as a repair finding of the previous storyboard (derived by the engine, never supplied), worded from the gap alone. */
export const drawnInstantFinding = (gap: DrawnInstantGap) => ({ scope: 'page' as const, pageNumber: gap.pageNumber, category: 'drawn_instant_completeness',
  verdict: 'contradiction' as const, observation: `The drawn instant ("${gap.drawnEvidence}") comes before this page's later change ("${gap.changeEvidence}"): ` +
    (gap.kind === 'relation' ? `${gap.entityId} is not yet ${gap.to.relation}${gap.to.targetId ? ` ${gap.to.targetId}` : ''}` : `${gap.entityId}.${gap.attribute} is not yet "${gap.value}"`) +
    ' at that instant, and depicted does not declare its state then.' });
