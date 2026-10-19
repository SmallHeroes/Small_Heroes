import 'server-only';
import { z } from 'zod';
import type { PreviewPlan } from '../local-story-preview';
import type { bookSequenceSchema } from '../local-book-sequence';
import type { StoryboardMoments } from './storyboard-moments';
import { REVIEW_IMPACT_ORDER, impactIsMaterial } from './review-impact';

/**
 * Opt-in TYPED REVIEW MATERIALITY for storyboards (storyboard-review-impact/v1). The review keeps every raw verdict and observation;
 * in addition, each check that is not supported lists its issues, each with an impact, the bound reference it concerns and a note.
 * The impact order is the reviewed audition's shared one (review-impact.ts: safety > story > identity > continuity > detail) plus the
 * storyboard's required-evidence gate (evidence) before detail, so the two QA stages speak one vocabulary. Only a DETAIL issue that cites a
 * known reference and states positively why it is not material is a non-blocking note; every other impact, an unbound reference, a check
 * without issues (materiality unknown) or an unjustified detail holds. The engine never assigns, infers or lowers an impact: it reads the
 * reviewer's typed answer and refuses what does not bind. Absent, nothing changes: the existing all-or-nothing disposition, schema,
 * instruction and review input are byte-identical.
 */
export const STORYBOARD_REVIEW_IMPACT_VERSION = 'storyboard-review-impact/v1' as const;
const [SAFETY, STORY, IDENTITY, CONTINUITY, DETAIL] = REVIEW_IMPACT_ORDER;
export const STORYBOARD_REVIEW_IMPACTS = [SAFETY, STORY, IDENTITY, CONTINUITY, 'evidence', DETAIL] as const;
export type StoryboardReviewImpact = typeof STORYBOARD_REVIEW_IMPACTS[number];

export const storyboardReviewIssueSchema = z.object({ impact: z.enum(STORYBOARD_REVIEW_IMPACTS), ref: z.string().trim().min(1).max(160),
  note: z.string().trim().min(1).max(600), whyNotMaterial: z.string().trim().max(400) }).strict();
export type StoryboardReviewIssue = z.infer<typeof storyboardReviewIssueSchema>;

export const STORYBOARD_REVIEW_IMPACT_ADDENDUM = `TYPED IMPACT (storyboard-review-impact/v1). Keep every verdict and observation as before. A supported check has no issues.
For EVERY check that is not supported, list its issues (1 to 4). Each issue:
- ref: the exact id from reviewRefs that the issue concerns (a claim, frame, entity, prop or location). An issue without a known ref is not a defect.
- impact: safety (unsafe or anatomically harmful planned content) | story (a reader would misread or lose this page's meaning: the drawn instant
  omits, reverses or contradicts the page's consequential action, reveal or joke; an invented event; the wrong order) | identity (a character's
  planned identity, age, species, design or clothing conflicts with its canon) | continuity (the planned world is inconsistent: an object's design,
  invariant or state contradicts itself or the ledger; a landmark duplicated or moved; an unsupported change) | evidence (a declared claim asserts
  something its own quotes do not establish, in whole or in part, or a place, route or viewpoint the text does not ground) | detail (positively not
  material: what a reader understands and what the picture must show are unchanged).
- note: what is wrong and where, from the data.
- whyNotMaterial: for detail only, the positive reason it is not material; empty for every other impact.
An issue you cannot positively justify as detail is not detail. Do not inflate detail into story, or the reverse. Uncertain stays uncertain.`;

type Sequence = z.infer<typeof bookSequenceSchema>;
type Storyboardish = { plan: PreviewPlan; sequence: Sequence; moments?: StoryboardMoments };
/** A claim and its declared quote; `page` only when that quote lives on another page (a claim-basis withhold requirement: its reveal page). */
export type StoryboardClaim = { ref: string; evidence: string; page?: number };

/**
 * Every evidence-bearing claim of frame n, with its declared quote, under one reference vocabulary shared by the planner's self-check and the
 * review's issues: the frame's requirements, its drawn instant and the instant's overrides and temporary looks, its continuity changes, and
 * (body pages) its transitions and scene cut. A repeated reference gets an ordinal suffix, so references stay unique.
 */
export function storyboardFrameClaims(book: Storyboardish, n: number): StoryboardClaim[] {
  const claims: StoryboardClaim[] = [], frame = book.moments?.frames[n], d = frame?.depicted ?? null;
  frame?.requirements.forEach((r, i) => {
    const reveal = (r as { revealPage?: number | null }).revealPage;
    claims.push({ ref: `p${n}:requirement:${i}`, evidence: r.evidence, ...(typeof reveal === 'number' ? { page: reveal } : {}) });
  });
  if (d) {
    claims.push({ ref: `p${n}:instant`, evidence: d.evidence });
    d.relations.forEach(o => claims.push({ ref: `p${n}:relation:${o.entityId}`, evidence: o.evidence }));
    d.attributes.forEach(a => claims.push({ ref: `p${n}:attribute:${a.entityId}:${a.attribute}`, evidence: a.evidence }));
    const looks = 'actorStates' in d ? (d as { actorStates: { actorId: string; evidence: string }[] }).actorStates : [];
    looks.forEach(a => claims.push({ ref: `p${n}:actor:${a.actorId}`, evidence: a.evidence }));
  }
  (book.plan.continuity?.pages[n]?.changes ?? []).forEach(c => claims.push({ ref: `p${n}:change:${c.entityId}:${c.attribute}`, evidence: c.storyEvidence }));
  if (n >= 1) {
    const page = book.sequence.pages[n - 1];
    page.transitions.forEach(t => claims.push({ ref: `p${n}:transition:${t.entityId}`, evidence: t.evidence }));
    if (page.sceneChangeEvidence) claims.push({ ref: `p${n}:scene`, evidence: page.sceneChangeEvidence });
  }
  const seen = new Map<string, number>();
  return claims.map(c => { const k = (seen.get(c.ref) ?? 0) + 1; seen.set(c.ref, k); return k === 1 ? c : { ...c, ref: `${c.ref}#${k}` }; });
}

/** Every reference a review issue may cite: the book, its cast, entities, props and locations, each frame, its composition and every claim. */
export function storyboardReviewRefs(book: Storyboardish): string[] {
  const refs = ['book', 'cast:child', 'cast:companion',
    ...(book.plan.continuity?.entities ?? []).map(e => `entity:${e.id}`), ...book.plan.recurringProps.map(p => `prop:${p.id}`),
    ...book.plan.locations.map(l => `location:${l.id}`)];
  book.plan.pages.forEach((_, n) => refs.push(`p${n}`, `p${n}:composition`, ...storyboardFrameClaims(book, n).map(c => c.ref)));
  return [...new Set(refs)];
}

export type ImpactCheck = { category: string; verdict: 'supported' | 'contradiction' | 'uncertain'; observation: string; issues: StoryboardReviewIssue[] };
export type ImpactFinding = { scope: 'book' | 'page'; pageNumber?: number; category: string; verdict: ImpactCheck['verdict']; observation: string;
  issues: StoryboardReviewIssue[]; reason: 'blocking_impact' | 'unknown_materiality' | 'unbound_reference' | 'unjustified_detail' | 'issues_on_supported' };

/**
 * The typed disposition. A check is a NOTE only when it is not supported and every issue is a bound, positively justified detail; it is
 * BLOCKING otherwise (with the first reason that applies). Supported checks must carry no issues. Held when anything blocks: uncertain when
 * a blocking check is uncertain or the review does not bind (unknown materiality, unbound reference, issues on a supported check),
 * contradiction otherwise; supported with notes when only notes remain. `citation` (claim-basis contract only): an evidence issue the
 * reviewer bound to one verified source span of its claim's page is that reviewer's own binding note (its impact stays evidence; the claim
 * stands with the cited span), never an inferred or lowered impact.
 */
export function storyboardImpactDisposition(checks: { scope: 'book' | 'page'; pageNumber?: number; check: ImpactCheck }[], refs: readonly string[],
  citation?: (issue: StoryboardReviewIssue) => boolean) {
  const known = new Set(refs), blocking: ImpactFinding[] = [], notes: ImpactFinding[] = [];
  const material = (i: StoryboardReviewIssue) => impactIsMaterial(i.impact) && !(citation?.(i) ?? false);
  for (const { scope, pageNumber, check } of checks) {
    const base = { scope, ...(scope === 'page' ? { pageNumber } : {}), category: check.category, verdict: check.verdict, observation: check.observation, issues: check.issues };
    if (check.verdict === 'supported') { if (check.issues.length) blocking.push({ ...base, reason: 'issues_on_supported' }); continue; }
    const reason: ImpactFinding['reason'] | null = !check.issues.length ? 'unknown_materiality'
      : check.issues.some(i => !known.has(i.ref)) ? 'unbound_reference'
      : check.issues.some(material) ? 'blocking_impact'
      : check.issues.some(i => !i.whyNotMaterial) ? 'unjustified_detail' : null;
    (reason ? blocking : notes).push({ ...base, reason: reason ?? 'blocking_impact' });
  }
  const invalid = blocking.some(f => f.reason !== 'blocking_impact');
  const disposition = !blocking.length ? (notes.length ? 'review_supported_with_notes' as const : 'review_supported' as const)
    : invalid || blocking.some(f => f.verdict === 'uncertain') ? 'held_uncertain' as const : 'held_contradiction' as const;
  return { version: STORYBOARD_REVIEW_IMPACT_VERSION, disposition, blocking, notes: notes.map(({ reason: _r, ...n }) => n) };
}
