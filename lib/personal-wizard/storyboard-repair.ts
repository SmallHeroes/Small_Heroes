import 'server-only';

/**
 * Opt-in REPAIR contract: one focused repair of a storyboard that its semantic review held, for the SAME final source and contracts.
 *
 * The held parent draft (bound by recompiling it to the parent's storyboard digest) and the parent's own raw review (bound to that digest,
 * and required to hold it) are supplied. The engine derives the findings from that review itself (every check it did not support), so a
 * finding can never be edited or chosen, and the planner returns the complete storyboard again with only what the findings implicate
 * changed. The same compiler and the same review then judge it as a new storyboard: nothing from the parent's review is carried over.
 * Absent, nothing changes: no source/digest/instruction/input byte differs.
 */
export const STORYBOARD_REPAIR_VERSION = 'storyboard-repair/v1' as const;
export type StoryboardRepair = { parentStoryboardDigest: string; draft: unknown; review: unknown };

export const REPAIR_STORYBOARD_ADDENDUM = `REPAIR CONTRACT (one focused repair of a reviewed storyboard): priorReviewedStoryboard.storyboard is your previous storyboard for this exact final manuscript, and priorReviewedStoryboard.reviewFindings lists every check an independent review did not support: a book-level finding, or a page finding with its pageNumber (0 is the cover), each with the reviewer's category, verdict and observation.
Return the complete storyboard again. Keep every part that no finding implicates exactly as it was: the same ids, designs, invariants, clothing, locations, props, page plans, cameras, compositions, cast, states, transitions, moments and sequence entries, with the same wording, values and order.
Change only what each finding needs so that it no longer applies, within the final manuscript and every rule above: depict only what the text establishes by the drawn instant, never add a state or transformation the text does not state, and cite as evidence only text that supports the depicted state itself. Where resolving a finding changes a state that later pages inherit, make exactly the matching change on those pages too.`;

const HASH = /^[a-f0-9]{64}$/;
const fail = (code: string): never => { throw Error(`personal_storyboard_${code}`); };

/** Shape check only; the storyboard engine binds the draft and the review to the parent digest. */
export function assertStoryboardRepair(repair: unknown): asserts repair is StoryboardRepair {
  const r = repair as Partial<StoryboardRepair> | null;
  if (!r || typeof r !== 'object' || Array.isArray(r) || Object.keys(r).sort().join(',') !== 'draft,parentStoryboardDigest,review' ||
      typeof r.parentStoryboardDigest !== 'string' || !HASH.test(r.parentStoryboardDigest) ||
      !r.draft || typeof r.draft !== 'object' || Array.isArray(r.draft) || !r.review || typeof r.review !== 'object' || Array.isArray(r.review)) fail('repair_policy');
}

type Check = { category: string; verdict: 'supported' | 'contradiction' | 'uncertain'; observation: string };
export type StoryboardRepairFinding = { scope: 'book'; category: string; verdict: Check['verdict']; observation: string }
  | { scope: 'page'; pageNumber: number; category: string; verdict: Check['verdict']; observation: string };
/** Every check the (already validated) review did not support, in the review's own order: book checks, then pages. */
export function storyboardRepairFindings(review: { bookChecks: Check[]; frames: { pageNumber: number; checks: Check[] }[] }): StoryboardRepairFinding[] {
  return [
    ...review.bookChecks.filter(c => c.verdict !== 'supported')
      .map(c => ({ scope: 'book' as const, category: c.category, verdict: c.verdict, observation: c.observation })),
    ...review.frames.flatMap(f => f.checks.filter(c => c.verdict !== 'supported')
      .map(c => ({ scope: 'page' as const, pageNumber: f.pageNumber, category: c.category, verdict: c.verdict, observation: c.observation }))),
  ];
}

/** What a repair changed, for review only (never a gate): every leaf path of the draft whose value differs from the parent's. */
export function storyboardRepairChanges(parentDraft: unknown, repairedDraft: unknown): string[] {
  const changed: string[] = [];
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const walk = (before: unknown, after: unknown, at: string) => {
    if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) { before.forEach((v, i) => walk(v, after[i], `${at}[${i}]`)); return; }
    if (object(before) && object(after)) {
      for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) walk(before[key], after[key], at ? `${at}.${key}` : key);
      return;
    }
    if (JSON.stringify(before) !== JSON.stringify(after)) changed.push(at || '(whole draft)');
  };
  walk(JSON.parse(JSON.stringify(parentDraft ?? null)), JSON.parse(JSON.stringify(repairedDraft ?? null)), '');
  return changed;
}
