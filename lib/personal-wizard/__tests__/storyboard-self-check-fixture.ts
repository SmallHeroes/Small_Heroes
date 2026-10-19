import { storyboardFrameClaims } from '../storyboard-review-impact';
import { STORYBOARD_SELF_CHECK_VERSION } from '../storyboard-self-check';
import { changedSections } from '../storyboard-diagnosis';

/**
 * A full-coverage, structurally valid planner self-check for a moments draft (synthetic structure only, never semantic proof): every claim
 * of every frame with its own declared quote as its one part; one consequential event per body page (the drawn instant's quote when the
 * frame declares one, else the page text); no grounding entries; every dual-authority design agreeing; and, for a diagnosed repair, one
 * resolution per diagnosed finding naming the sections this draft changed on that page (book findings: the first changed section).
 */
export function fullSelfCheck(draft: any, texts: readonly string[], repair?: { diagnosis: any; parentDraft: unknown }, edit?: (s: any) => void) {
  const frames = draft.plan.pages.map((_: unknown, n: number) => {
    const claims = storyboardFrameClaims(draft, n).map(c => ({ ref: c.ref, parts: [{ assertion: 'the fact this claim states', quote: c.evidence }] }));
    if (n === 0) return { events: [], keyEvent: null, claims, grounding: [] };
    const depicted = draft.moments.frames[n].depicted;
    return { events: [{ quote: depicted ? depicted.evidence : texts[n], kind: 'action', consequential: true }], keyEvent: 0, claims, grounding: [] };
  });
  const props = new Map<string, string>(draft.plan.recurringProps.map((p: any) => [p.id, p.design]));
  const designs = (draft.plan.continuity?.entities ?? []).filter((e: any) => props.has(e.id)).map((e: any) => ({ id: e.id,
    attributes: e.invariants.map((i: any) => ({ attribute: i.attribute, designPhrase: props.get(e.id)!.includes(i.value) ? i.value : null, agrees: true })) }));
  const moved = repair ? changedSections(repair.parentDraft, draft) : [];
  const onPage = (key: string) => key.startsWith('page:') ? moved.filter(s => s.startsWith(`p${key.split(':')[1]}:`)) : moved.slice(0, 1);
  const resolutions = repair?.diagnosis ? repair.diagnosis.findings.map((f: any) => ({ finding: f.key, cause: 'evidence_binding',
    confirmed: 'what the saved review and the parent draft confirm', hypothesis: '', impact: 'story', remedy: 'the general change this plan made',
    changed: onPage(f.key), quotes: [], check: 'the next review supports this check' })) : [];
  const selfCheck = { version: STORYBOARD_SELF_CHECK_VERSION, frames, designs, resolutions };
  edit?.(selfCheck);
  return selfCheck;
}
