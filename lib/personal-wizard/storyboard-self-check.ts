import 'server-only';
import { z } from 'zod';
import type { PreviewPlan } from '../local-story-preview';
import type { bookSequenceSchema } from '../local-book-sequence';
import type { StoryboardMoments } from './storyboard-moments';
import { STORYBOARD_REVIEW_IMPACTS, storyboardFrameClaims } from './storyboard-review-impact';
import { DIAGNOSIS_CAUSES, changedSections, draftSections, type StoryboardDiagnosis } from './storyboard-diagnosis';

/**
 * Opt-in PLANNER SELF-CHECK (storyboard-self-check/v1): structure the planner fills for its own plan, bound to the exact page texts and
 * validated by the compiler, so the planning rules the prose already states become checkable state:
 * - claims: every evidence-bearing claim of a frame (requirement, drawn instant, override, temporary look, change, transition, scene cut)
 *   split into its parts, each part with its OWN exact same-page quote, at least one of them overlapping the claim's declared quote (a part of
 *   it, or covering it). A part that no quote of its own establishes cannot be bound (the review judges each part's entailment; a substring
 *   is not semantic proof).
 * - events: the page's events (each an exact quote, a kind, consequential or not) and the key event the picture draws. The key event is the
 *   drawn instant (its quote overlaps depicted.evidence; with no depicted instant, the page's last event), and when any event is
 *   consequential the key event is a consequential one: an aftermath never silently replaces the page's causal action, while a page whose
 *   meaning is a quiet ending, a reveal or a joke marks that event consequential and draws it.
 * - grounding: every place, route, direction, viewpoint or spatial relation the frame's plan states, with its exact same-page quote, or null
 *   when the text does not state it (the frame then shows it generically, never as a specific invented route).
 * - designs: every id that is both a continuity entity and a recurring prop (two design authorities) lists each invariant attribute with the
 *   prop design's own phrase for it (exact, or null) and agrees=true; a declared disagreement refuses the plan.
 * - resolutions (only for a diagnosed repair): one per diagnosed finding, with a cause class, confirmed facts vs hypothesis, impact, remedy,
 *   the sections it actually changed (verified against the parent) and the expected success check; resolved pages stay unchanged unless a
 *   resolution names the section it changes there.
 * Absent, nothing changes: no source, digest, schema, instruction or packet byte differs.
 */
export const STORYBOARD_SELF_CHECK_VERSION = 'storyboard-self-check/v1' as const;
export const SELF_CHECK_EVENT_KINDS = ['action', 'discovery', 'joke', 'emotion', 'dialogue', 'aftermath'] as const;
const quote = z.string().trim().min(1).max(400);
const short = (n: number) => z.string().trim().min(1).max(n);
export const selfCheckSchema = z.object({
  version: z.literal(STORYBOARD_SELF_CHECK_VERSION),
  frames: z.array(z.object({
    events: z.array(z.object({ quote, kind: z.enum(SELF_CHECK_EVENT_KINDS), consequential: z.boolean() }).strict()).max(8),
    keyEvent: z.number().int().min(0).max(7).nullable(),
    claims: z.array(z.object({ ref: short(160), parts: z.array(z.object({ assertion: short(200), quote }).strict()).min(1).max(4) }).strict()).max(48),
    grounding: z.array(z.object({ assertion: short(200), quote: quote.nullable() }).strict()).max(8),
  }).strict()).min(3).max(25),
  designs: z.array(z.object({ id: short(60), attributes: z.array(z.object({ attribute: short(400), designPhrase: z.string().trim().max(400).nullable(),
    agrees: z.boolean() }).strict()).min(1).max(12) }).strict()).max(16),
  resolutions: z.array(z.object({ finding: short(160), cause: z.enum(DIAGNOSIS_CAUSES), confirmed: short(400), hypothesis: z.string().trim().max(400),
    impact: z.enum(STORYBOARD_REVIEW_IMPACTS), remedy: short(400), changed: z.array(short(80)).max(16), quotes: z.array(quote).max(3),
    check: short(300) }).strict()).max(24),
}).strict();
export type StoryboardSelfCheck = z.infer<typeof selfCheckSchema>;
/**
 * The provider WIRE shape of the self-check: the same fields, order, types and enums with the frame count fixed, without length or count
 * bounds (the planner's JSON schema travels on its command line, where the generated schema carries every part twice). The bounds are
 * stated in the instruction and enforced by the compiler, which validates the decoded self-check with the bounded selfCheckSchema above.
 */
export const selfCheckWireSchema = (frames: number) => {
  const s = () => z.string();
  return z.object({ version: z.literal(STORYBOARD_SELF_CHECK_VERSION),
    frames: z.array(z.object({ events: z.array(z.object({ quote: s(), kind: z.enum(SELF_CHECK_EVENT_KINDS), consequential: z.boolean() }).strict()),
      keyEvent: z.number().int().nullable(), claims: z.array(z.object({ ref: s(), parts: z.array(z.object({ assertion: s(), quote: s() }).strict()) }).strict()),
      grounding: z.array(z.object({ assertion: s(), quote: s().nullable() }).strict()) }).strict()).length(frames),
    designs: z.array(z.object({ id: s(), attributes: z.array(z.object({ attribute: s(), designPhrase: s().nullable(), agrees: z.boolean() }).strict()) }).strict()),
    resolutions: z.array(z.object({ finding: s(), cause: z.enum(DIAGNOSIS_CAUSES), confirmed: s(), hypothesis: s(), impact: z.enum(STORYBOARD_REVIEW_IMPACTS),
      remedy: s(), changed: z.array(s()), quotes: z.array(s()), check: s() }).strict()) }).strict();
};

export const SELF_CHECK_STORYBOARD_ADDENDUM = `PLANNER SELF-CHECK (storyboard-self-check/v1; the compiler validates it, the reviewer reads it). Return selfCheck with one frame per page, cover first:
- claims: one entry per evidence-bearing claim of that frame, using these refs: p{n}:requirement:{index}, p{n}:instant (depicted.evidence),
  p{n}:relation:{entityId}, p{n}:attribute:{entityId}:{attribute}, p{n}:actor:{actorId}, p{n}:change:{entityId}:{attribute}, p{n}:transition:{entityId},
  p{n}:scene (sceneChangeEvidence); a ref that repeats on the same frame takes #2, #3... in plan order. Split each claim into its parts (one fact
  each: an action, a state, a colour, a place, a route); give every part its own exact quote from that page (cover: the title or the first page), and let at
  least one part's quote be the claim's own quote or a piece of it. A part that no quote of the page establishes is not supported by the rest of the
  page's prose: narrow the claim (or its evidence span) to what the quotes establish, or drop that part from the plan. Short exact quotes are best.
- events: the page's events in order, each an exact quote with a kind (action, discovery, joke, emotion, dialogue, aftermath) and whether it is
  consequential for the story (what the page is for). keyEvent is the index of the event the picture draws: the drawn instant (its quote overlaps
  depicted.evidence; with depicted null, the last event). When any event is consequential, the key event must be consequential: draw the causal
  action, reveal or joke, and keep an aftermath for later pages or as background. A quiet ending that IS the page's meaning is consequential.
  The cover has no events and keyEvent null.
- grounding: every place, route, direction, viewpoint or spatial relation the frame's composition, scene or actions state, each with its exact
  same-page quote, or quote null when the text does not state it; a null one is shown generically in the plan, never as a specific route or viewpoint.
- designs: for each id that is BOTH a continuity entity and a recurring prop, list every invariant attribute with the prop design's own phrase for
  that attribute (exact, or null when the design does not mention it) and agrees. The two descriptions must agree; reconcile them before answering.
- resolutions: only when priorReviewedStoryboard.diagnosis is present (otherwise empty): one per diagnosis finding, naming its key, the cause class
  (diagnosis.causes), what the saved evidence confirms and what is only a hypothesis, the impact, the remedy, the sections you changed for it
  (p{n}:plan, p{n}:moment, p{n}:continuity, p{n}:sequence or book:...), up to three exact supporting quotes, and the check that shows it is fixed.
  Use cause not_a_defect only with quotes that show the finding is wrong. Keep every page in diagnosis.protectedPages unchanged unless a resolution
  names the section it changes there.
- Limits (the compiler refuses beyond them): every quote at most 400 characters and every assertion at most 200; per frame at most 8 events, 8
  grounding entries and 48 claims, each claim 1 to 4 parts; designs at most 16, each 1 to 12 attributes; per resolution at most 16 changed sections and
  3 quotes, confirmed, hypothesis and remedy at most 400 characters each and check at most 300.`;

/** The reviewer's side: the self-check is the planner's own account, validated for structure and exact quotes only. Read it, never trust it. */
export const SELF_CHECK_REVIEW_ADDENDUM = `PLANNER SELF-CHECK (storyboard-self-check/v1): selfCheck is the planner's own account of its plan; the engine validated only its structure and that every quote is exact. Use it to find what to check, never as evidence:
- claims: under this contract a claim's evidence is its parts' quotes. Judge every part against its own quote: a part its quote does not establish, in whole or in part, is unsupported even when other prose on the page states it; a claim whose stated content goes beyond its parts is unsupported too.
- events and keyEvent: the planner's reading of the page. Judge yourself whether the drawn instant is the page's consequential event (action, reveal, joke or a quiet ending that is the page's meaning) and whether an aftermath replaced it.
- grounding: judge whether each quoted place, route or viewpoint is established by its quote, and whether the frame's plan states any place, route or viewpoint that is missing here or marked unstated yet drawn as specific.
- designs: where one object has both a continuity design and a prop design, judge whether the two descriptions agree.
- resolutions (a diagnosed re-plan only): judge whether each diagnosed finding is resolved by what the storyboard now says, not by the resolution's wording.`;

type Sequence = z.infer<typeof bookSequenceSchema>;
const fail = (code: string): never => { throw Error(`storyboard_self_check_${code}`); };
const overlaps = (a: string, b: string) => a.includes(b) || b.includes(a);

/**
 * Opt-in, versioned SECTION-NAME RESOLUTION for a resolution's `changed` list (storyboard-self-check-names/v1). The v1 instruction names
 * book-level sections only as `book:...`, while the engine's names are `book:<group>.<key>`, so a planner can name a section it truly
 * changed in a form the strict v1 check refuses. Deterministic and narrow: an exact engine name stays; `book:<key>` becomes the ONE book
 * section with that own key; `book:<group>` (plan, continuity, sequence, moments) becomes that group's sections the candidate changed;
 * anything else stays as written (and is refused as before). Every resolved name must still be a section that actually changed, so no
 * substantive check is relaxed. Absent: the strict v1 check, byte-identical.
 */
export const STORYBOARD_SELF_CHECK_NAMES_VERSION = 'storyboard-self-check-names/v1' as const;
const BOOK_SECTION_GROUPS = ['plan', 'continuity', 'sequence', 'moments'] as const;
export function resolveSelfCheckSections(names: readonly string[], sections: ReadonlySet<string>, moved: readonly string[]) {
  const resolved = names.flatMap(name => {
    if (sections.has(name) || !name.startsWith('book:')) return [name];
    const key = name.slice('book:'.length);
    const byKey = [...sections].filter(s => s.startsWith('book:') && s.slice(s.indexOf('.') + 1) === key);
    if (byKey.length === 1) return byKey;
    const group = (BOOK_SECTION_GROUPS as readonly string[]).includes(key) ? moved.filter(s => s.startsWith(`book:${key}.`)) : [];
    return group.length ? group : [name];
  });
  return [...new Set(resolved)];
}

/**
 * Deterministic validation of the self-check against the compiled plan, sequence and moments, the exact page texts and (for a diagnosed
 * repair) the diagnosis and the parent draft. Structure and quotes only: whether a quote semantically establishes its part is the review's.
 */
export function validateStoryboardSelfCheck(raw: unknown, book: { plan: PreviewPlan; sequence: Sequence; moments: StoryboardMoments }, texts: readonly string[],
  repair?: { diagnosis: StoryboardDiagnosis | null; parentDraft: unknown; candidateDraft: unknown },
  options?: { sectionNames?: true; ignoredRefs?: ReadonlySet<string>; alsoChanged?: readonly string[] }): StoryboardSelfCheck {
  if (options !== undefined && (Object.keys(options).some(k => k !== 'sectionNames' && k !== 'ignoredRefs' && k !== 'alsoChanged') ||
      (options.sectionNames !== undefined && options.sectionNames !== true) || (options.ignoredRefs !== undefined && !(options.ignoredRefs instanceof Set)) ||
      (options.alsoChanged !== undefined && !Array.isArray(options.alsoChanged))))
    fail('options');
  const s = selfCheckSchema.parse(raw);
  if (s.frames.length !== book.plan.pages.length || texts.length !== book.plan.pages.length) fail('coverage');
  // Opt-in (claim-basis contract): claims of overrides the compiler dropped (their entity is not visible) are ignored, never coverage.
  const ignored = options?.ignoredRefs;
  if (ignored) s.frames.forEach(frame => { frame.claims = frame.claims.filter(c => !ignored.has(c.ref)); });
  s.frames.forEach((frame, n) => {
    const quoted = (q: string) => n === 0 ? texts[0].includes(q) || texts[1].includes(q) : texts[n].includes(q);
    // Claims: exactly this frame's evidence-bearing claims, each split into quoted parts that include its own declared quote. A claim whose
    // quote lives on another page (a withheld entity's reveal page) is quoted from that page.
    const expected = new Map(storyboardFrameClaims(book, n).map(c => [c.ref, c]));
    if (frame.claims.length !== expected.size || new Set(frame.claims.map(c => c.ref)).size !== frame.claims.length ||
        frame.claims.some(c => !expected.has(c.ref))) fail('claim_coverage');
    for (const c of frame.claims) {
      const claim = expected.get(c.ref)!, on = (q: string) => claim.page === undefined ? quoted(q) : texts[claim.page].includes(q);
      if (c.parts.some(p => !on(p.quote))) fail('claim_quote');
      if (!c.parts.some(p => overlaps(p.quote, claim.evidence))) fail('claim_binding');
    }
    if (frame.grounding.some(g => g.quote !== null && !quoted(g.quote))) fail('grounding_quote');
    // Events and the key event the picture draws.
    if (n === 0) { if (frame.events.length || frame.keyEvent !== null) fail('cover_events'); return; }
    if (!frame.events.length || frame.keyEvent === null || frame.keyEvent >= frame.events.length) fail('events');
    if (frame.events.some(e => !quoted(e.quote)) || new Set(frame.events.map(e => e.quote)).size !== frame.events.length) fail('event_quote');
    const key = frame.events[frame.keyEvent!], depicted = book.moments.frames[n].depicted;
    const last = frame.events.reduce((x, e) => texts[n].indexOf(e.quote) > texts[n].indexOf(x.quote) ? e : x);
    if (depicted ? !overlaps(key.quote, depicted.evidence) : key !== last) fail('key_event_instant');
    if (frame.events.some(e => e.consequential) && !key.consequential) fail('key_event_not_consequential');
  });
  // Two design authorities for one id must be reconciled: every invariant attribute, the prop design's own phrase, agreement.
  const props = new Map(book.plan.recurringProps.map(p => [p.id, p.design]));
  const dual = (book.plan.continuity?.entities ?? []).filter(e => props.has(e.id));
  if (s.designs.length !== dual.length || new Set(s.designs.map(d => d.id)).size !== s.designs.length) fail('design_coverage');
  for (const d of s.designs) {
    const entity = dual.find(e => e.id === d.id) ?? fail('design_coverage');
    const attrs = entity.invariants.map(i => i.attribute);
    if (d.attributes.length !== attrs.length || d.attributes.some(a => !attrs.includes(a.attribute)) ||
        new Set(d.attributes.map(a => a.attribute)).size !== d.attributes.length) fail('design_attributes');
    if (d.attributes.some(a => a.designPhrase !== null && (!a.designPhrase || !props.get(d.id)!.includes(a.designPhrase)))) fail('design_phrase');
    if (d.attributes.some(a => !a.agrees)) fail('design_conflict');
  }
  // Resolutions: only for a diagnosed repair, one per diagnosed finding, each change verified against the parent; resolved pages protected.
  if (!repair?.diagnosis) { if (s.resolutions.length) fail('resolutions_without_diagnosis'); return s; }
  const diagnosis = repair.diagnosis, keys = diagnosis.findings.map(f => f.key);
  if (s.resolutions.length !== keys.length || new Set(s.resolutions.map(r => r.finding)).size !== keys.length || s.resolutions.some(r => !keys.includes(r.finding)))
    fail('resolution_coverage');
  const moved = changedSections(repair.parentDraft, repair.candidateDraft), sections = new Set(Object.keys(draftSections(repair.candidateDraft)));
  const anywhere = (q: string) => texts.some(t => t.includes(q));
  // Opt-in (storyboard-self-check-names/v1): book-level names resolve to the engine's own names first; the checks below are unchanged.
  if (options?.sectionNames) for (const r of s.resolutions) r.changed = resolveSelfCheckSections(r.changed, sections, moved);
  // Opt-in (claim basis): `moved` is measured on the contract's neutral view; a resolution may also name a section whose raw bytes changed
  // (adopting the contract's shape), while the protected-page rule below stays on the neutral view.
  const nameable = new Set([...moved, ...(options?.alsoChanged ?? [])]);
  for (const r of s.resolutions) {
    if (r.changed.some(c => !sections.has(c) || !nameable.has(c))) fail('resolution_changed');
    if (r.quotes.some(q => !anywhere(q))) fail('resolution_quote');
    if (r.cause === 'not_a_defect' ? !r.quotes.length : !r.changed.length) fail('resolution_basis');
  }
  const named = new Set(s.resolutions.flatMap(r => r.changed));
  if (moved.some(c => diagnosis.protectedPages.some(n => c.startsWith(`p${n}:`)) && !named.has(c))) fail('protected_page_changed');
  return s;
}
