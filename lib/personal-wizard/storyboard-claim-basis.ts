import 'server-only';
import { z } from 'zod';
import type { PreviewPlan } from '../local-story-preview';
import { BOOK_SEQUENCE_ROLES, type bookSequenceSchema } from '../local-book-sequence';
import { wholeBookDraftSchema, ownedWholeBookDraftSchema } from '../local-book-planning';
import { momentRequirementSchema, drawnInstantDepictedSchema, STORYBOARD_MOMENTS_VERSION, type MomentsPolicy, type StoryboardMoments } from './storyboard-moments';
import { storyboardReviewIssueSchema } from './storyboard-review-impact';

/**
 * Opt-in CLAIM BASIS (storyboard-claim-basis/v1; needs the moments, drawn-instant, self-check and typed-review contracts). It separates,
 * in the representation and in the review policy, what earlier contracts treated alike:
 * - STATED claims (requirements, the drawn instant, overrides, temporary looks, changes, transitions, scene cuts) say what the text states
 *   and still need their own bound evidence; a consequential fact whose support is uncertain still holds.
 * - STAGING: a claim the planner marks as visual direction (a gesture, gaze, expression, posture, arrangement or placement the text does not
 *   state, chosen because it fits the text). The review judges it only for contradiction with the text, the drawn instant, the ledger or canon
 *   and for identity, age, style and safety; it needs no literal quote. The drawn instant, scene cuts and withholds can never be staged.
 * - WITHHELD until a reveal: a requirement that keeps an entity (a declared entity or a cast member) out of the picture until the first later
 *   frame whose structured visible ids include it, bound to an exact quote of that page (the review judges that it is the reveal event, not
 *   an earlier mention), never to the first occurrence of a name.
 * - CITATION: a stated claim whose own quote does not establish it while ONE stable source span of its page states the whole claim. The
 *   reviewer names the span; the engine verifies only that it is a span of that page (no entailment is inferred) and keeps the claim, with
 *   the citation, as a binding note. Partial, ambiguous, other-page or contradicted support stays a blocking evidence issue.
 * - VISIBLE STATE: the frame's visible ids (sequence visibleCastIds and continuity visibleEntityIds) are the one authority on what the picture
 *   shows. Drawn-instant completeness applies to visible entities only, and an override of an entity that is not visible is dropped by the
 *   compiler (recorded in the book), so it is never a claim, never reviewed and never sent to the renderer.
 * Absent, nothing changes: no source, digest, instruction, schema, review input or packet byte differs.
 */
export const CLAIM_BASIS_CONTRACT_VERSION = 'storyboard-claim-basis/v1' as const;
type Sequence = z.infer<typeof bookSequenceSchema>;
const id = z.string().regex(/^[a-z][a-z0-9_]{0,49}$/);
const quote = z.string().trim().min(1).max(400);

/** A requirement under the contract: show/avoid as before (entityId and revealPage null), or withhold until a reveal page. One flat shape. */
export const claimBasisRequirementSchema = momentRequirementSchema.extend({ kind: z.enum(['show', 'avoid', 'withhold']), evidence: quote,
  entityId: id.nullable(), revealPage: z.number().int().min(1).max(16).nullable() }).strict();
export const stagingSchema = z.object({ ref: z.string().trim().min(1).max(160), reason: z.string().trim().min(1).max(300) }).strict();
export const claimBasisFrameSchema = z.object({ requirements: z.array(claimBasisRequirementSchema).max(6), depicted: drawnInstantDepictedSchema.nullable(),
  staging: z.array(stagingSchema).max(12) }).strict();
export type ClaimBasisRequirement = z.infer<typeof claimBasisRequirementSchema>;
export type HiddenOverride = { pageNumber: number; kind: 'relation' | 'attribute'; entityId: string; attribute?: string };
export const claimBasisMomentsSchema = z.object({ version: z.literal(STORYBOARD_MOMENTS_VERSION),
  frames: z.array(claimBasisFrameSchema).min(3).max(25) }).strict();
/** Authoring schemas under the contract (drawn-instant frames plus staging and the flat requirement); the existing schemas are untouched. */
export const claimBasisWholeBookDraftSchema = wholeBookDraftSchema.extend({ moments: claimBasisMomentsSchema });
export const ownedClaimBasisWholeBookDraftSchema = ownedWholeBookDraftSchema.extend({ moments: claimBasisMomentsSchema });
/** The moments validator's policy under the contract: its frames, the requirement's evidence page(s), visible-only completeness. */
export const claimBasisMomentsPolicy: MomentsPolicy = { schema: claimBasisMomentsSchema, visibleOnly: true,
  requirementPages: (r, n) => r.kind === 'withhold' && typeof r.revealPage === 'number' ? [r.revealPage] : n === 0 ? [0, 1] : [n] };
/** The review issue under the contract: the typed issue plus its citation (a source span id, or empty). */
export const claimBasisIssueSchema = storyboardReviewIssueSchema.extend({ citation: z.string().trim().max(24).regex(/^(p\d{1,2}:s\d{1,3})?$/) }).strict();

const fail = (code: string): never => { throw Error(`storyboard_claim_basis_${code}`); };

/** A frame's visible ids: the one structured authority on what its picture shows (the cover has no sequence page: its continuity ids only). */
export const frameVisible = (plan: PreviewPlan, sequence: Sequence, n: number) => new Set(n === 0 ? [...(plan.continuity?.pages[0]?.visibleEntityIds ?? [])]
  : [...sequence.pages[n - 1].visibleCastIds, ...(plan.continuity?.pages[n]?.visibleEntityIds ?? [])]);

/**
 * Drops every drawn-instant override of an entity that its frame does not show (it cannot change the picture), recording each dropped one.
 * Deterministic and general: the frame's own visible ids decide, never a name or a page. Returns a new moments object; the raw draft is kept.
 */
export function dropHiddenOverrides(moments: StoryboardMoments, plan: PreviewPlan, sequence: Sequence) {
  const dropped: HiddenOverride[] = [];
  const frames = moments.frames.map((frame, n) => {
    const d = frame.depicted;
    if (n === 0 || !d) return frame;
    const visible = frameVisible(plan, sequence, n);
    const relations = d.relations.filter(o => visible.has(o.entityId) || (dropped.push({ pageNumber: n, kind: 'relation', entityId: o.entityId }), false));
    const attributes = d.attributes.filter(a => visible.has(a.entityId) || (dropped.push({ pageNumber: n, kind: 'attribute', entityId: a.entityId, attribute: a.attribute }), false));
    return { ...frame, depicted: { ...d, relations, attributes } };
  });
  return { moments: { ...moments, frames } as StoryboardMoments, dropped };
}

/**
 * The view of a draft (raw, under or before the contract) on which "what a candidate changed" is measured under the contract: a frame's
 * contract fields at their neutral values (no staging; a show/avoid requirement's null entityId and revealPage) are absent, and an override of
 * an entity its frame does not show (by the draft's own visible ids) is not part of it, so adopting the contract's shape or dropping an
 * irrelevant hidden annotation is never a change, while a real staging, withhold or visible override is. Deterministic; a deep copy.
 */
export function claimBasisSectionsView(raw: unknown) {
  const d = structuredClone(raw) as { plan?: { continuity?: { pages?: { visibleEntityIds?: string[] }[] } }; sequence?: { pages?: { visibleCastIds?: string[] }[] };
    moments?: { frames?: Record<string, unknown>[] } };
  d?.moments?.frames?.forEach((frame, n) => {
    if (Array.isArray(frame.staging) && !frame.staging.length) delete frame.staging;
    if (Array.isArray(frame.requirements)) for (const r of frame.requirements as Record<string, unknown>[])
      if (r.entityId === null && r.revealPage === null) { delete r.entityId; delete r.revealPage; }
    const depicted = frame.depicted as { relations?: { entityId: string }[]; attributes?: { entityId: string }[] } | null | undefined;
    if (n === 0 || !depicted) return;
    const shown = new Set([...(d.sequence?.pages?.[n - 1]?.visibleCastIds ?? []), ...(d.plan?.continuity?.pages?.[n]?.visibleEntityIds ?? [])]);
    if (Array.isArray(depicted.relations)) depicted.relations = depicted.relations.filter(o => shown.has(o.entityId));
    if (Array.isArray(depicted.attributes)) depicted.attributes = depicted.attributes.filter(a => shown.has(a.entityId));
  });
  return d;
}

/**
 * The self-check/review references of the overrides the compiler dropped (the planner's self-check may still list them; they are ignored),
 * with the claim vocabulary's ordinal suffixes: every override sharing a base reference is dropped together, so the k-th dropped one is the
 * k-th raw claim of that reference.
 */
export const droppedRefs = (dropped: readonly HiddenOverride[]) => {
  const seen = new Map<string, number>();
  return new Set(dropped.map(h => {
    const ref = h.kind === 'relation' ? `p${h.pageNumber}:relation:${h.entityId}` : `p${h.pageNumber}:attribute:${h.entityId}:${h.attribute}`;
    const k = (seen.get(ref) ?? 0) + 1;
    seen.set(ref, k);
    return k === 1 ? ref : `${ref}#${k}`;
  }));
};

/**
 * Validates the contract's own fields against the compiled plan, sequence and page texts (structure only; the review judges meaning):
 * show/avoid requirements keep entityId and revealPage null; a withhold requirement names a declared entity or a cast member that this frame
 * and every frame up to its reveal page do not show, whose reveal page is the FIRST later frame that shows it, with its evidence an exact
 * quote of that page; a staging entry names an existing claim of its own frame, never the drawn instant, a scene cut or a withhold, once.
 */
export function validateClaimBasis(frames: readonly { requirements: ClaimBasisRequirement[]; staging: z.infer<typeof stagingSchema>[] }[], plan: PreviewPlan,
  sequence: Sequence, texts: readonly string[], frameClaimRefs: (n: number) => readonly string[]) {
  const entities = new Set([...Object.values(BOOK_SEQUENCE_ROLES), ...(plan.continuity?.entities ?? []).map(e => e.id)]);
  frames.forEach((frame, n) => {
    for (const r of frame.requirements) {
      if (r.kind !== 'withhold') { if (r.entityId !== null || r.revealPage !== null) fail('requirement_shape'); continue; }
      if (r.entityId === null || r.revealPage === null || !entities.has(r.entityId) || r.revealPage <= n || r.revealPage >= texts.length) fail('withhold_binding');
      const first = texts.findIndex((_, k) => k > n && frameVisible(plan, sequence, k).has(r.entityId!));
      for (let k = n; k < r.revealPage!; k++) if (frameVisible(plan, sequence, k).has(r.entityId!)) fail('withhold_visible_before_reveal');
      if (first !== r.revealPage || !texts[r.revealPage!].includes(r.evidence)) fail('withhold_reveal');
    }
    const claims = new Set(frameClaimRefs(n)), withheld = new Set(frame.requirements.flatMap((r, i) => r.kind === 'withhold' ? [`p${n}:requirement:${i}`] : []));
    if (new Set(frame.staging.map(s => s.ref)).size !== frame.staging.length) fail('staging_duplicate');
    for (const s of frame.staging) if (!claims.has(s.ref) || withheld.has(s.ref) || /^p\d+:(instant|scene)(#\d+)?$/.test(s.ref)) fail('staging_ref');
  });
}

/**
 * Stable source spans of the frozen page texts (texts[0] is the cover title): each page split after sentence-ending punctuation (with any
 * closing quote or bracket) followed by whitespace, every span an exact substring of its page. Deterministic; ids `p{n}:s{k}` from 1.
 */
export function sourceSpans(texts: readonly string[]) {
  return Object.fromEntries(texts.map((text, n) => {
    const spans: { id: string; text: string }[] = [], ends = /([.!?…]+["'”’׳״)\]]*)\s+/g;
    let start = 0, m: RegExpExecArray | null;
    const push = (end: number) => { const s = text.slice(start, end).trim(); if (s) spans.push({ id: `p${n}:s${spans.length + 1}`, text: s }); };
    while ((m = ends.exec(text))) { push(m.index + m[1].length); start = m.index + m[0].length; }
    push(text.length);
    return [`p${n}`, spans];
  })) as Record<string, { id: string; text: string }[]>;
}

/**
 * A review issue's citation, verified: the cited id is a span of the claim's own evidence page(s) (the cover: the title or page 1; a withhold
 * requirement: its reveal page) and its text differs from the claim's own quote. Nothing about meaning is inferred: the reviewer asserts that
 * the span states the whole claim and justifies it; the engine checks only that the span exists where the claim lives.
 */
export function citationBinds(issue: { impact: string; ref: string; citation: string; whyNotMaterial: string },
  claims: ReadonlyMap<string, { evidence: string; pages: readonly number[] }>, spans: Record<string, { id: string; text: string }[]>) {
  if (issue.impact !== 'evidence' || !issue.citation || !issue.whyNotMaterial) return false;
  const claim = claims.get(issue.ref);
  if (!claim) return false;
  const span = claim.pages.flatMap(p => spans[`p${p}`] ?? []).find(s => s.id === issue.citation);
  return !!span && span.text !== claim.evidence.trim();
}

export const CLAIM_BASIS_STORYBOARD_ADDENDUM = `CLAIM BASIS (storyboard-claim-basis/v1; the compiler and the review apply it; it refines the rules above):
- Stated claims (requirements show/avoid, the drawn instant, overrides, temporary looks, changes, transitions, scene cuts) say what the text states. Bind each to the exact sentence that states it, not a neighbouring one; a claim that needs two sentences gets one self-check part per sentence.
- Visual direction: a gesture, gaze, expression, posture or exact arrangement or placement that the text does not state but that fits it. Never present it as a stated fact. When a claim of a frame carries such a choice, list its ref in that frame's staging as {ref, reason}, the reason saying why it fits the text without adding, removing or reversing an event, a meaning, an identity or a canon detail. Never stage the drawn instant, a scene cut, a consequential action, a reveal or a change the story depends on. Every frame lists staging, empty when there is none.
- Withheld until a reveal: when something must not appear before its reveal, use a requirement {kind: "withhold", entityId (an entity or cast id), revealPage, subject, evidence}: revealPage is the FIRST later frame whose visible ids include that entity, evidence the exact sentence of that page that reveals it; the entity stays out of every visible id list before it. Never write it as "avoid" with a quote that cannot establish an absence. show and avoid requirements give entityId and revealPage null.
- Visible state: a frame shows exactly the entities in its visibleCastIds and visibleEntityIds. Override and describe only those; an entity that is not visible needs no override, and the compiler drops any override of one. The composition never places a visible entity differently from its relation at the drawn instant: placement comes from the relations.
- Self-check resolutions name book-level sections exactly: book:plan.<key>, book:continuity.<key>, book:sequence.<key> or book:moments.<key>.`;

/** Under the contract the drawn-instant completeness rule is stated for visible entities (it replaces that contract's first rule). */
export const CLAIM_BASIS_DRAWN_INSTANT_RULE = `- A frame's drawn instant is where the first occurrence of its depicted.evidence ends in the page text. A change the same page makes later - a sequence transition whose evidence, or a continuity change whose storyEvidence, first occurs after that point - has not happened yet at the drawn instant: for every entity VISIBLE in that frame (its visibleCastIds and visibleEntityIds), override it in depicted.relations (its relation at that instant) or depicted.attributes (its value at that instant), with its own exact same-page quote. An entity that is not visible needs no override.`;

export const CLAIM_BASIS_REVIEW_ADDENDUM = `CLAIM BASIS (storyboard-claim-basis/v1; it refines the rules above):
- Stated claims need their own bound evidence as before; a consequential fact whose support is uncertain holds.
- moments.frames[n].staging lists claims of that frame that are visual direction (a gesture, gaze, expression, posture, arrangement or placement the text does not state). Do not require a quote to state them. Judge only whether each contradicts the text, the drawn instant, the ledger or canon, or changes identity, age, style or safety; one that fits is supported. A staged claim that is really a consequential action, a reveal, the drawn instant or a change the story depends on is a story or evidence issue.
- A requirement of kind withhold keeps its entity out of the picture until revealPage: judge whether its evidence on that page is the entity's visual reveal, not an earlier mention.
- Citation: claimBasis.sourceSpans lists every page's sentences with ids. When a stated claim's own quote does not establish it but ONE span of the claim's own page (the cover: the title or page 1; a withhold requirement: its reveal page) states the WHOLE claim, give that issue impact evidence, citation = that span id and whyNotMaterial = why that span states the whole claim; the claim then stands with that citation. When support is partial, ambiguous, on another page or contradicted, citation stays empty. Every issue gives citation, empty when there is none.
- A frame's picture shows only its visible entities; an entity that is not visible is not part of it.`;

/** Under the contract the self-check review rule for parts admits a cited span (it replaces that addendum's claims rule). */
export const CLAIM_BASIS_SELF_CHECK_REVIEW_RULE = `- claims: under this contract a stated claim's evidence is its parts' quotes. Judge every part against its own quote: a part its quote does not establish is unsupported unless one span of its page states it (then give that citation). For a claim listed in its frame's staging, the parts' quotes are the sentences it interprets, not proof.`;
