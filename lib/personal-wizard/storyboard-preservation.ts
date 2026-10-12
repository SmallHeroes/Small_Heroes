import 'server-only';

/**
 * Opt-in PRESERVATION contract for re-planning an already approved storyboard of the SAME final source.
 *
 * The approved parent draft is supplied (bound by its storyboard digest) as planning input, with one instruction: reproduce it
 * exactly, adding only what the active landmark-kind contract requires. A planner may still drift; that is never repaired or
 * relabelled here. `storyboardPreservationDiff` reports every difference by category, and anything other than the added kinds
 * (or a pure camera change on a page outside the compared pair) makes the re-plan NOT_COMPARABLE with images drawn from the parent.
 * Absent, nothing changes: no source/digest/instruction/input byte differs.
 */
export const STORYBOARD_PRESERVATION_VERSION = 'storyboard-preservation/v1' as const;
export type StoryboardPreservation = { parentStoryboardDigest: string; draft: unknown };

export const PRESERVATION_STORYBOARD_ADDENDUM = `PRESERVATION CONTRACT (re-plan of an approved storyboard): priorApprovedStoryboard.storyboard is the storyboard already approved for this exact final manuscript, and existing pictures were drawn from it.
Reproduce it exactly: every id, design, invariant, clothing item, location, prop, page plan, camera, composition, cast, state, transition and sequence entry, with the same wording, values and order.
The ONLY change allowed is the one the LANDMARK KIND CONTRACT requires: add each landmark's single "kind" invariant. Do not improve, correct, reword, reorder, add or drop anything else, even where you would plan it differently.`;

const HASH = /^[a-f0-9]{64}$/;
const fail = (code: string): never => { throw Error(`personal_storyboard_${code}`); };

/** Shape check only; the caller (storyboard engine) binds the draft to the parent digest by recompiling it. */
export function assertStoryboardPreservation(preservation: unknown): asserts preservation is StoryboardPreservation {
  const p = preservation as Partial<StoryboardPreservation> | null;
  if (!p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).sort().join(',') !== 'draft,parentStoryboardDigest' ||
      typeof p.parentStoryboardDigest !== 'string' || !HASH.test(p.parentStoryboardDigest) ||
      !p.draft || typeof p.draft !== 'object' || Array.isArray(p.draft)) fail('preservation_policy');
}

// ---------------------------------------------------------------------------------------------------------------
// Comparability: parent draft versus re-planned draft.
// ---------------------------------------------------------------------------------------------------------------
export type PreservationDriftCategory = 'kind_missing' | 'kind_duplicate' | 'kind_not_added' | 'entity_design' | 'scale' | 'child_wardrobe' |
  'companion_authority' | 'location_design' | 'prop_design' | 'visual_language' | 'pair_camera' | 'pair_page_plan' | 'pair_page_state' |
  'page_plan' | 'page_state' | 'sequence' | 'other';
export type PreservationDiff = {
  version: typeof STORYBOARD_PRESERVATION_VERSION;
  verdict: 'COMPARABLE' | 'NOT_COMPARABLE';
  pairPages: number[];
  kindAdded: { entityId: string; kind: string }[];
  /** Pure camera (shot/angle) changes OUTSIDE the compared pages: permitted and reported; a page's prompt and checks use only its own camera. */
  viewpointOutsidePair: { path: string; before: unknown; after: unknown }[];
  drift: { path: string; category: PreservationDriftCategory; before?: unknown; after?: unknown }[];
};
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
const CAMERA = new Set(['shot', 'angle']);
const brief = (value: unknown) => {
  const text = JSON.stringify(value);
  return text === undefined ? undefined : text.length > 300 ? `${text.slice(0, 297)}...` : JSON.parse(text);
};

function category(path: (string | number)[], pairPages: ReadonlySet<number>): PreservationDriftCategory {
  const [root, branch, index, field] = path;
  if (root === 'sequence') return 'sequence';
  if (root !== 'plan') return 'other';
  if (branch === 'continuity') {
    if (index === 'entities') return 'entity_design';
    if (index === 'companionStandingHeightInChildHeights') return 'scale';
    if (index === 'pages') return typeof field === 'number' && pairPages.has(field) ? 'pair_page_state' : 'page_state';
    return 'other';
  }
  if (branch === 'actorAppearance') return index === 'companion' ? 'companion_authority' : 'child_wardrobe';
  if (branch === 'wardrobe') return 'child_wardrobe';
  if (branch === 'locations') return 'location_design';
  if (branch === 'recurringProps') return 'prop_design';
  if (branch === 'visualLanguage') return 'visual_language';
  if (branch === 'pages') {
    const pair = typeof index === 'number' && pairPages.has(index);
    if (!pair) return 'page_plan';
    return typeof field === 'string' && (CAMERA.has(field) || field === 'composition') ? 'pair_camera' : 'pair_page_plan';
  }
  return 'other';
}

function compare(before: Json | undefined, after: Json | undefined, path: (string | number)[], out: PreservationDiff['drift'], pairPages: ReadonlySet<number>) {
  const push = () => out.push({ path: path.join('.'), category: category(path, pairPages), before: brief(before), after: brief(after) });
  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.length !== after.length) return push();
    before.forEach((item, i) => compare(item, after[i], [...path, i], out, pairPages));
    return;
  }
  const isObject = (v: unknown): v is Record<string, Json> => !!v && typeof v === 'object' && !Array.isArray(v);
  if (isObject(before) && isObject(after)) {
    for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) compare(before[key], after[key], [...path, key], out, pairPages);
    return;
  }
  if (before !== after) push();
}

/**
 * Exact comparison. The added landmark kinds are removed from the re-planned draft first (exactly one per landmark, recorded), and a pure
 * camera change (shot/angle) on a page outside `pairPages` is recorded as permitted viewpoint variation. Every other difference is drift,
 * including composition text, clothing, design wording (one seam versus two, three slats versus six), cast, scale, topology and sequence.
 */
export function storyboardPreservationDiff(parentDraft: unknown, replannedDraft: unknown, pairPages: readonly number[]): PreservationDiff {
  if (!pairPages.length || pairPages.some(n => !Number.isInteger(n) || n < 0) || new Set(pairPages).size !== pairPages.length) fail('preservation_pair');
  const pair = new Set(pairPages);
  const prior = JSON.parse(JSON.stringify(parentDraft)) as Json, next = JSON.parse(JSON.stringify(replannedDraft)) as Json;
  const drift: PreservationDiff['drift'] = [], kindAdded: PreservationDiff['kindAdded'] = [], viewpointOutsidePair: PreservationDiff['viewpointOutsidePair'] = [];
  const at = (value: Json, ...keys: (string | number)[]) => keys.reduce<Json | undefined>((v, k) =>
    v && typeof v === 'object' ? (v as Record<string | number, Json>)[k] : undefined, value);
  const priorEntities = at(prior, 'plan', 'continuity', 'entities'), nextEntities = at(next, 'plan', 'continuity', 'entities');
  if (Array.isArray(nextEntities)) nextEntities.forEach((entity, index) => {
    const e = entity as { id?: Json; kind?: Json; invariants?: Json };
    if (e?.kind !== 'landmark' || !Array.isArray(e.invariants)) return;
    const path = `plan.continuity.entities.${index}.invariants`;
    const priorEntity = Array.isArray(priorEntities) ? priorEntities.find(p => (p as { id?: Json })?.id === e.id) as { invariants?: Json } | undefined : undefined;
    if (Array.isArray(priorEntity?.invariants) && priorEntity.invariants.some(i => (i as { attribute?: Json })?.attribute === 'kind')) {
      drift.push({ path, category: 'kind_not_added', before: brief(priorEntity.invariants) }); return;
    }
    const kinds = e.invariants.filter(i => (i as { attribute?: Json })?.attribute === 'kind');
    if (kinds.length !== 1) { drift.push({ path, category: kinds.length ? 'kind_duplicate' : 'kind_missing', after: brief(kinds) }); return; }
    kindAdded.push({ entityId: String(e.id), kind: String((kinds[0] as { value?: Json }).value) });
    e.invariants = e.invariants.filter(i => i !== kinds[0]);
  });
  const priorPages = at(prior, 'plan', 'pages'), nextPages = at(next, 'plan', 'pages');
  if (Array.isArray(priorPages) && Array.isArray(nextPages) && priorPages.length === nextPages.length) nextPages.forEach((page, index) => {
    if (pair.has(index) || !page || typeof page !== 'object' || Array.isArray(page)) return;
    const before = priorPages[index] as Record<string, Json> | null;
    if (!before || typeof before !== 'object') return;
    for (const field of CAMERA) if (field in page && field in before && page[field] !== before[field]) {
      viewpointOutsidePair.push({ path: `plan.pages.${index}.${field}`, before: before[field], after: page[field] });
      page[field] = before[field];
    }
  });
  compare(prior, next, [], drift, pair);
  return { version: STORYBOARD_PRESERVATION_VERSION, verdict: drift.length ? 'NOT_COMPARABLE' : 'COMPARABLE', pairPages: [...pairPages],
    kindAdded, viewpointOutsidePair, drift };
}
