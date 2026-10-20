import 'server-only';
import { z } from 'zod';
import type { PreviewPlan } from '../local-story-preview';
import { BOOK_SEQUENCE_ROLES, type bookSequenceSchema } from '../local-book-sequence';
import { storyboardReviewIssueSchema, STORYBOARD_REVIEW_IMPACTS } from './storyboard-review-impact';
import { findingKey } from './storyboard-diagnosis';
import { SELF_CHECK_STORYBOARD_ADDENDUM, SELF_CHECK_REVIEW_ADDENDUM, selfCheckSchema, selfCheckWireSchema } from './storyboard-self-check';
import { CLAIM_BASIS_REVIEW_ADDENDUM, frameVisible } from './storyboard-claim-basis';

/**
 * Opt-in CALIBRATION contract (storyboard-calibration/v1; needs the claim basis and so every contract it needs). Owner-approved 2026-10-20
 * (OWNER-APPROVAL-CORRECTED-B-ATTEMPT5-20261020.txt). It bundles four general, versioned components shared by the planner and the review:
 * - storyboard-review-severity/v1: the owner's product rule. A reasonable visual completion is allowed when it does not contradict the text or
 *   canon and changes no event, identity, age, safety or material relation (who can reach, see or affect whom); a meaningful contradiction
 *   still blocks; strong evidence stays required for causal actions, reveals, consequential topology and state changes. Every review issue
 *   carries the reviewer's own `basis` (contradiction | unsupported | inference | setting): safety, story and identity always block, a
 *   contradiction blocks, an unsupported consequential element blocks unless a verified citation supports it, and an inference or a setting
 *   completion is a note only with the reviewer's positive reason. The engine reads the basis; it never infers or lowers one.
 * - storyboard-claim-basis-multispan/v1: a citation may name one to three stable source spans of ONE of the claim's own pages, in text order
 *   (`p3:s2+p3:s4`), whose conjunction the reviewer asserts states the whole claim. Structure only is verified.
 * - storyboard-relation-lifetime/v1: a ledger relation lasts until a transition changes it. A relation beside, on or held by a cast actor is
 *   refused when that actor changes place while the entity is never visible again (it would travel unseen); a contact of one picture belongs
 *   in that frame's drawn instant, the ledger keeping the entity at a place.
 * - storyboard-state-source/v1: one source for changing state. The planner's self-check lists each state or colour change the visual language
 *   states with the continuity change refs that carry it; the compiler verifies the phrase is the visual language's own words and each ref is a
 *   change of a mutable attribute (structure); the review judges agreement (meaning).
 * Its repair input also groups the parent review's issues by the reference they concern (one group is one cause). Absent, nothing changes: no
 * source, digest, instruction, schema, review input or packet byte differs.
 */
export const STORYBOARD_CALIBRATION_VERSION = 'storyboard-calibration/v1' as const;
export const STORYBOARD_REVIEW_SEVERITY_VERSION = 'storyboard-review-severity/v1' as const;
export const CLAIM_BASIS_MULTISPAN_VERSION = 'storyboard-claim-basis-multispan/v1' as const;
export const RELATION_LIFETIME_VERSION = 'storyboard-relation-lifetime/v1' as const;
export const STATE_SOURCE_VERSION = 'storyboard-state-source/v1' as const;
export const CALIBRATION_COMPONENTS = Object.freeze([STORYBOARD_REVIEW_SEVERITY_VERSION, CLAIM_BASIS_MULTISPAN_VERSION, RELATION_LIFETIME_VERSION,
  STATE_SOURCE_VERSION] as const);
export const STORYBOARD_REVIEW_BASES = ['contradiction', 'unsupported', 'inference', 'setting'] as const;
type Sequence = z.infer<typeof bookSequenceSchema>;
const fail = (code: string): never => { throw Error(`storyboard_calibration_${code}`); };

/** The review issue under the contract: the claim basis's typed issue with a one-to-three-span citation, plus the reviewer's basis. */
export const calibrationIssueSchema = storyboardReviewIssueSchema.extend({
  citation: z.string().trim().max(80).regex(/^(p\d{1,2}:s\d{1,3}(\+p\d{1,2}:s\d{1,3}){0,2})?$/), basis: z.enum(STORYBOARD_REVIEW_BASES) }).strict();
export type CalibrationIssue = z.infer<typeof calibrationIssueSchema>;

/** Severity: whether an issue blocks. `cited`: the issue carries a verified citation (a supported claim). */
const ALWAYS_MATERIAL: ReadonlySet<string> = new Set(['safety', 'story', 'identity']);
export const severityMaterial = (issue: { impact: string; basis: string }, cited: boolean) =>
  ALWAYS_MATERIAL.has(issue.impact) || issue.basis === 'contradiction' || (issue.basis === 'unsupported' && !cited);

/**
 * A citation of one to three spans, verified: an evidence issue with its reason, whose ids are spans of ONE of the claim's own evidence pages
 * (the cover: the title or page 1; a withhold requirement: its reveal page), in strictly increasing text order (so distinct), and whose joined
 * text is not just the claim's own quote. One span is exactly the claim basis's single-span check. Meaning is the reviewer's.
 */
export function multispanCitationBinds(issue: { impact: string; ref: string; citation: string; whyNotMaterial: string },
  claims: ReadonlyMap<string, { evidence: string; pages: readonly number[] }>, spans: Record<string, { id: string; text: string }[]>) {
  if (issue.impact !== 'evidence' || !issue.citation || !issue.whyNotMaterial) return false;
  const claim = claims.get(issue.ref);
  if (!claim) return false;
  const ids = issue.citation.split('+'), page = /^p(\d{1,2}):s\d{1,3}$/.exec(ids[0])?.[1];
  if (page === undefined || ids.length > 3 || !claim.pages.includes(Number(page)) || ids.some(id => !id.startsWith(`p${page}:s`))) return false;
  const list = spans[`p${page}`] ?? [], at = ids.map(id => list.findIndex(s => s.id === id));
  if (at.some(i => i < 0) || at.some((v, k) => k > 0 && v <= at[k - 1])) return false;
  return at.map(i => list[i].text).join(' ') !== claim.evidence.trim();
}
/** The cited text of a verified citation (its spans joined in order), for the frame's judge and render lines. */
export const citationText = (spans: Record<string, { id: string; text: string }[]>, citation: string) => {
  const all = Object.values(spans).flat(), parts = citation.split('+').map(id => all.find(s => s.id === id)?.text);
  return parts.every((t): t is string => typeof t === 'string') ? parts.join(' … ') : undefined;
};

/** The place an entity is at on a page: a location, or through what it is beside, on, held by, attached to or inside, that target's place. */
function placeOf(states: ReadonlyMap<string, { relation: string; targetId: string | null }>, entityId: string, locations: ReadonlySet<string>,
  seen = new Set<string>()): string | null {
  const v = states.get(entityId);
  if (seen.has(entityId) || !v || v.relation === 'unestablished' || !v.targetId) return null;
  seen.add(entityId);
  return locations.has(v.targetId) ? v.targetId : placeOf(states, v.targetId, locations, seen);
}
const CARRIED: ReadonlySet<string> = new Set(['beside', 'on', 'held_by']);
/**
 * storyboard-relation-lifetime/v1: every ledger relation of a non-role entity beside, on or held by a cast actor that is carried unchanged into
 * a page where that actor's place differs from the page before, while the entity is visible on no page from there to the end. Deterministic;
 * places resolve through the ledger (a cycle or an unestablished link is unknown and never refused).
 */
export function relationLifetimeViolations(plan: PreviewPlan, sequence: Sequence) {
  const roles: ReadonlySet<string> = new Set(Object.values(BOOK_SEQUENCE_ROLES)), locations = new Set(plan.locations.map(l => l.id));
  const cast = new Set([...roles, ...(plan.continuity?.entities ?? []).filter(e => e.kind === 'supporting_character').map(e => e.id)]);
  const stateMap = (n: number) => new Map(sequence.pages[n - 1].states.map(s => [s.entityId, s.value]));
  const out: { pageNumber: number; entityId: string; relation: string; targetId: string; from: string; to: string }[] = [];
  for (let m = 2; m <= sequence.pages.length; m++) {
    const now = stateMap(m), before = stateMap(m - 1);
    for (const [entityId, v] of now) {
      const prev = before.get(entityId);
      if (roles.has(entityId) || !CARRIED.has(v.relation) || !v.targetId || !cast.has(v.targetId) || prev?.relation !== v.relation || prev.targetId !== v.targetId) continue;
      const from = placeOf(before, v.targetId, locations), to = placeOf(now, v.targetId, locations);
      if (!from || !to || from === to) continue;
      let seenAgain = false;
      for (let k = m; k <= sequence.pages.length && !seenAgain; k++) seenAgain = frameVisible(plan, sequence, k).has(entityId);
      if (!seenAgain) out.push({ pageNumber: m, entityId, relation: v.relation, targetId: v.targetId, from, to });
    }
  }
  return out;
}

/** storyboard-state-source/v1: the planner's map of the visual language's state statements to the ledger changes that carry them. */
export const visualStatesSchema = z.array(z.object({ phrase: z.string().trim().min(1).max(300),
  refs: z.array(z.string().trim().min(1).max(160)).min(1).max(4) }).strict()).max(8);
export type VisualStates = z.infer<typeof visualStatesSchema>;
/** The self-check under the contract (the compiler splits visualStates off before the v1 self-check validator), and its provider wire shape. */
export const calibrationSelfCheckSchema = selfCheckSchema.extend({ visualStates: visualStatesSchema });
export const calibrationSelfCheckWireSchema = (frames: number) =>
  selfCheckWireSchema(frames).extend({ visualStates: z.array(z.object({ phrase: z.string(), refs: z.array(z.string()) }).strict()) });
/**
 * Validates the map (structure only): each phrase is an exact part of plan.visualLanguage; each ref, once per entry, is a continuity change
 * claim (`p{n}:change:{entityId}:{attribute}`, with the claim vocabulary's suffix) of a mutable attribute. `changeClaims(n)` lists frame n's
 * change claim refs in continuity change order.
 */
export function validateVisualStates(raw: unknown, plan: PreviewPlan, sequence: Sequence, changeClaims: (n: number) => readonly string[]) {
  const parsed = visualStatesSchema.safeParse(raw);
  if (!parsed.success) return fail('visual_state_shape');
  const mutable = new Set(sequence.mutableAttributes.map(a => `${a.entityId}:${a.attribute}`));
  const changes = new Map(plan.pages.flatMap((_, n) => {
    const own = plan.continuity?.pages[n]?.changes ?? [], refs = changeClaims(n);
    if (refs.length !== own.length) fail('visual_state_claims');
    return own.map((c, i) => [refs[i], `${c.entityId}:${c.attribute}`] as const);
  }));
  for (const entry of parsed.data) {
    if (!plan.visualLanguage.includes(entry.phrase)) fail('visual_state_phrase');
    if (new Set(entry.refs).size !== entry.refs.length) fail('visual_state_ref');
    for (const ref of entry.refs) {
      const attribute = changes.get(ref);
      if (attribute === undefined) fail('visual_state_ref');
      if (!mutable.has(attribute!)) fail('visual_state_not_mutable');
    }
  }
  return parsed.data;
}

/** The parent review's typed issues grouped by the reference they concern, in first-occurrence order: one group is one cause. */
export const findingGroups = (findings: readonly { scope: 'book' | 'page'; pageNumber?: number; category: string; issues: readonly { ref: string }[] }[]) => {
  const groups = new Map<string, string[]>();
  for (const f of findings) for (const i of f.issues) {
    const checks = groups.get(i.ref) ?? [], key = findingKey(f);
    if (!checks.includes(key)) checks.push(key);
    groups.set(i.ref, checks);
  }
  return [...groups].map(([ref, checks]) => ({ ref, checks }));
};

/** The owner's product rule, stated once for both sides. */
export const VISUAL_COMPLETION_RULE = 'A reasonable visual completion is allowed when it does not contradict the text or canon and changes no event, identity, age, safety or material relation (who can reach, see or affect whom). A meaningful contradiction still blocks, and strong evidence stays required for causal actions, reveals, consequential topology and state changes.';

/** Replaces exactly one addendum entry (its first line and its indented continuation lines) with `entry`; a missing entry refuses. */
function replaceEntry(addendum: string, prefix: string, entry: string) {
  const lines = addendum.split('\n'), at = lines.findIndex(l => l.startsWith(prefix));
  if (at < 0) return fail('addendum_entry');
  let end = at + 1;
  while (end < lines.length && lines[end].startsWith('  ')) end++;
  return [...lines.slice(0, at), entry, ...lines.slice(end)].join('\n');
}

const PLANNER_GROUNDING = `- grounding: every place, route, direction, viewpoint or spatial relation the frame's composition, scene or actions state, each with its exact
  same-page quote, or quote null when the text does not state it. A null one is a visual completion (CALIBRATION below): it may be specific only when it
  changes no event, access, distance or relation.`;
/** The planner's self-check addendum under the contract: its grounding entry restated under the owner's rule (replaced, never contradicted). */
export const calibrationSelfCheckStoryboardAddendum = () => replaceEntry(SELF_CHECK_STORYBOARD_ADDENDUM, '- grounding:', PLANNER_GROUNDING);

export const CALIBRATION_STORYBOARD_ADDENDUM = `CALIBRATION (storyboard-calibration/v1; the compiler and the review apply it; it refines every rule above):
- Visual completion (the owner's rule): ${VISUAL_COMPLETION_RULE} Terrain, scenery, light, background and exact arrangement may complete a picture as direction. A causal action, a reveal, a state change, and every place, route or viewpoint that changes who can reach, see or affect whom stay stated by the text; where the text does not settle where two groups are relative to each other, keep them in one shared place.
- Evidence: a stated claim may need two or three sentences of its page; give one self-check part per sentence, each with its own exact quote.
- Relations: a ledger relation lasts until a transition changes it. A contact that holds only in one picture (beside, on or held by an actor) belongs in that frame's depicted.relations, while the ledger keeps the entity at a place. The compiler refuses a ledger relation beside, on or held by an actor who changes place while the entity is never visible again.
- One source for changing state: a state or colour change that plan.visualLanguage states must be a mutable attribute (sequence.mutableAttributes) with its continuity change on the page where it happens; never keep an attribute invariant that the visual language or the text changes. List each such statement in selfCheck.visualStates as {phrase: its exact words in plan.visualLanguage, refs: the change refs p{n}:change:{entityId}:{attribute} that carry it}; empty when it states none. At most 8 entries, each phrase at most 300 characters, 1 to 4 refs.
- priorReviewedStoryboard.findingGroups (a repair) groups the review's issues by the reference they concern: one group is one cause. Fix it once, where it lives (a location design, a relation, a state, a quote binding), and on every page that inherits it.`;

/** The typed review instruction under the contract: the impact vocabulary of storyboard-review-impact/v1 with the reviewer's basis and the owner's rule. */
export const CALIBRATION_REVIEW_IMPACT_ADDENDUM = `TYPED IMPACT AND SEVERITY (storyboard-review-impact/v1 with ${STORYBOARD_REVIEW_SEVERITY_VERSION}). Keep every verdict and observation as before. A supported check has no issues.
For EVERY check that is not supported, list its issues (1 to 4). Each issue:
- ref: the exact id from reviewRefs that the issue concerns (a claim, frame, entity, prop or location). An issue without a known ref is not a defect.
- impact: ${STORYBOARD_REVIEW_IMPACTS.join(' | ')}. safety: unsafe or anatomically harmful planned content. story: a reader would misread or lose this page's
  meaning (the drawn instant omits, reverses or contradicts the page's consequential action, reveal or joke; an invented event; the wrong order). identity: a
  character's planned identity, age, species, design or clothing conflicts with its canon. continuity: the planned world is inconsistent (an object's
  design, invariant or state contradicts itself, the ledger or the visual language; a landmark duplicated or moved; an unsupported change). evidence: a
  declared claim asserts something its own quotes, or its cited spans, do not establish, in whole or in part. detail: positively not material (what a
  reader understands and what the picture must show are unchanged).
- basis: ${STORYBOARD_REVIEW_BASES.join(' | ')}. contradiction: the plan contradicts the text, canon, the ledger or itself. unsupported: a consequential element the
  text does not establish (a causal action, a reveal, a state change, or a place, route, viewpoint or arrangement that changes who can reach, see or
  affect whom). inference: not stated, but reasonably inferred from the text. setting: a visual completion the text leaves open (terrain, scenery, light,
  background or arrangement that changes no event, identity, age, safety or material relation).
- note: what is wrong and where, from the data.
- whyNotMaterial: for detail, inference and setting, the positive reason it changes no event, identity, age, safety or material relation; for a citation,
  why the cited spans state the whole claim; empty otherwise.
SEVERITY (the owner's product rule): ${VISUAL_COMPLETION_RULE} safety, story and identity always block; a contradiction or an unsupported consequential
element blocks; inference and setting with a positive reason are notes. An unstated place, route or viewpoint is setting when it changes no event,
access, distance or relation, and unsupported when it does. Do not inflate setting into evidence, or the reverse. Uncertain stays uncertain.`;

const REVIEW_CITATION = `- Citation: claimBasis.sourceSpans lists every page's sentences with ids. When a stated claim's own quote does not establish it but one to three spans of ONE of the claim's own pages (the cover: the title or page 1; a withhold requirement: its reveal page), read together in text order, state the WHOLE claim with its negation, order and time, give that issue impact evidence, citation = those span ids joined with + in text order (for example p3:s2+p3:s4) and whyNotMaterial = why they state the whole claim; the claim then stands with that citation. When support is partial, ambiguous, on another page or contradicted, citation stays empty. Every issue gives citation, empty when there is none.`;
/** The claim basis's review addendum under the contract: its citation entry for one to three spans (replaced, never contradicted). */
export const calibrationClaimBasisReviewAddendum = () => replaceEntry(CLAIM_BASIS_REVIEW_ADDENDUM, '- Citation:', REVIEW_CITATION);
const REVIEW_CLAIMS = `- claims: under this contract a stated claim's evidence is its parts' quotes. Judge every part against its own quote: a part its quote does not establish is unsupported unless one to three spans of its page together state it (then give that citation). For a claim listed in its frame's staging, the parts' quotes are the sentences it interprets, not proof.`;
const REVIEW_GROUNDING = `- grounding: judge whether each quoted place, route or viewpoint is established by its quote. An unquoted one (quote null, or missing here) is setting when it changes no event, access, distance or relation and contradicts nothing; it is unsupported when it does.`;
/** The self-check review addendum under the contract: its claims entry for cited spans and its grounding entry under the owner's rule. */
export const calibrationSelfCheckReviewAddendum = () => replaceEntry(replaceEntry(SELF_CHECK_REVIEW_ADDENDUM, '- claims:', REVIEW_CLAIMS), '- grounding:', REVIEW_GROUNDING);

export const CALIBRATION_REVIEW_ADDENDUM = `CALIBRATION (storyboard-calibration/v1; it refines the rules above):
- Relations: the ledger keeps a relation until a transition changes it. The compiler already refused any relation beside, on or held by an actor who changes place while the entity is never shown again; a contact of one picture is in that frame's drawn instant.
- calibration.visualStates maps each state or colour change plan.visualLanguage states to the ledger changes that carry it (the engine verified only that each phrase is the visual language's own words and each ref a change of a mutable attribute). Judge whether the visual language and the ledger agree; a change the visual language states that no change carries, or that an invariant forbids, is continuity with basis contradiction.`;
