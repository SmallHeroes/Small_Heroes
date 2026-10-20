import 'server-only';
import { canonicalJson } from './request-acceptance';

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
/** Opt-in contracts a repair may add on top of its parent's (the parent is then recompiled without them). */
export const REPAIR_ADDABLE_CONTRACTS = ['drawnInstantContract', 'visibleMomentContract', 'selfCheckContract', 'reviewImpactPolicy', 'claimBasisContract',
  'calibrationContract'] as const;
/**
 * An owner's explicit, bounded extension of the storyboard stage's attempt ceiling (storyboard-attempt-extension/v1): exactly one attempt
 * above the base ceiling, only once the base ceiling is spent, bound to the owner's approval record by digest. Never a reset.
 */
export const STORYBOARD_ATTEMPT_EXTENSION_VERSION = 'storyboard-attempt-extension/v1' as const;
/**
 * A further owner extension (storyboard-attempt-extension/v2): exactly one attempt above the previous extension, only once that extension is
 * spent, bound to its own owner record by digest and naming the previous extension exactly (the one the parent attempt used). A chain of
 * owner decisions, each +1; never a reset, never implied by an earlier one.
 */
export const STORYBOARD_ATTEMPT_EXTENSION_V2 = 'storyboard-attempt-extension/v2' as const;
export type StoryboardAttemptExtension = { version: typeof STORYBOARD_ATTEMPT_EXTENSION_VERSION; maxAttempts: number; approvalSha256: string }
  | { version: typeof STORYBOARD_ATTEMPT_EXTENSION_V2; maxAttempts: number; approvalSha256: string; previous: StoryboardAttemptExtension };
/**
 * A repair of a held parent. When the parent is itself a repaired storyboard, `parentRepair` is the parent's own repair input (recompiled
 * with it to the parent's digest); `addedContracts` names the opt-in contracts this repair adds; `parentCompile` the parent's own opt-in
 * compile options (a parent compiled under storyboard-self-check-names/v1, and also storyboard-claim-basis-staging-fields/v1, recompiles under
 * them); `extension` an owner's bounded attempt extension. All absent: exactly the original shape.
 */
export type StoryboardRepair = { parentStoryboardDigest: string; draft: unknown; review: unknown; parentRepair?: StoryboardRepair;
  addedContracts?: (typeof REPAIR_ADDABLE_CONTRACTS)[number][]; parentCompile?: { selfCheckNames: true; stagingFields?: true };
  extension?: StoryboardAttemptExtension };
/** At most this many repairs above the first held storyboard. */
const MAX_REPAIR_DEPTH = 3;

export const REPAIR_STORYBOARD_ADDENDUM = `REPAIR CONTRACT (one focused repair of a reviewed storyboard): priorReviewedStoryboard.storyboard is your previous storyboard for this exact final manuscript, and priorReviewedStoryboard.reviewFindings lists every check an independent review did not support: a book-level finding, or a page finding with its pageNumber (0 is the cover), each with the reviewer's category, verdict and observation.
Return the complete storyboard again. Keep every part that no finding implicates exactly as it was: the same ids, designs, invariants, clothing, locations, props, page plans, cameras, compositions, cast, states, transitions, moments and sequence entries, with the same wording, values and order.
Change only what each finding needs so that it no longer applies, within the final manuscript and every rule above: depict only what the text establishes by the drawn instant, never add a state or transformation the text does not state, and cite as evidence only text that supports the depicted state itself. Where resolving a finding changes a state that later pages inherit, make exactly the matching change on those pages too.`;

const HASH = /^[a-f0-9]{64}$/;
const fail = (code: string): never => { throw Error(`personal_storyboard_${code}`); };

/** An extension's own shape: v1 exactly its three fields; v2 also the previous extension it names, exactly one attempt above it. */
function extensionShape(value: unknown): value is StoryboardAttemptExtension {
  const e = value as Partial<StoryboardAttemptExtension> & { previous?: unknown } | null | undefined;
  if (!e || typeof e !== 'object' || Array.isArray(e) || !Number.isSafeInteger(e.maxAttempts) || typeof e.approvalSha256 !== 'string' ||
      !HASH.test(e.approvalSha256)) return false;
  const keys = Object.keys(e).sort().join(',');
  if (e.version === STORYBOARD_ATTEMPT_EXTENSION_VERSION) return keys === 'approvalSha256,maxAttempts,version';
  return e.version === STORYBOARD_ATTEMPT_EXTENSION_V2 && keys === 'approvalSha256,maxAttempts,previous,version' && extensionShape(e.previous) &&
    e.maxAttempts === (e.previous as StoryboardAttemptExtension).maxAttempts + 1;
}

/**
 * Shape check only (nested repairs included); the storyboard engine binds the draft and the review to the parent digest. `ancestorExtension`:
 * the extension a v2 extension above names as its previous, which this ancestor must carry exactly (otherwise an ancestor carries none).
 */
export function assertStoryboardRepair(repair: unknown, depth = 0, ancestorExtension?: StoryboardAttemptExtension): asserts repair is StoryboardRepair {
  const r = repair as Partial<StoryboardRepair> | null;
  const keys = r && typeof r === 'object' && !Array.isArray(r) ? Object.keys(r).sort() : [];
  const optional: string[] = keys.filter(k => k === 'parentRepair' || k === 'addedContracts' || k === 'parentCompile' || k === 'extension');
  if (!r || typeof r !== 'object' || Array.isArray(r) || depth > MAX_REPAIR_DEPTH ||
      keys.filter(k => !optional.includes(k)).join(',') !== 'draft,parentStoryboardDigest,review' ||
      typeof r.parentStoryboardDigest !== 'string' || !HASH.test(r.parentStoryboardDigest) ||
      !r.draft || typeof r.draft !== 'object' || Array.isArray(r.draft) || !r.review || typeof r.review !== 'object' || Array.isArray(r.review)) fail('repair_policy');
  if ('addedContracts' in r! && (!Array.isArray(r!.addedContracts) || !r!.addedContracts.length ||
      new Set(r!.addedContracts).size !== r!.addedContracts.length || r!.addedContracts.some(c => !(REPAIR_ADDABLE_CONTRACTS as readonly string[]).includes(c)))) fail('repair_policy');
  if ('parentCompile' in r! && JSON.stringify(r!.parentCompile) !== JSON.stringify({ selfCheckNames: true }) &&
      JSON.stringify(r!.parentCompile) !== JSON.stringify({ selfCheckNames: true, stagingFields: true })) fail('repair_policy');
  // The extension is the outermost repair's; an ancestor carries one only as the previous extension a v2 extension above names (exactly that
  // one), and a v2 extension's parent is itself a repair carrying it.
  const extension = 'extension' in r! ? r!.extension : undefined;
  if ('extension' in r! && !extensionShape(extension)) fail('repair_policy');
  if (depth !== 0 && canonicalJson(extension ?? null) !== canonicalJson(ancestorExtension ?? null)) fail('repair_policy');
  const named = extension?.version === STORYBOARD_ATTEMPT_EXTENSION_V2 ? extension.previous : undefined;
  if ('parentRepair' in r!) assertStoryboardRepair(r!.parentRepair, depth + 1, named);
  else if (named) fail('repair_policy');
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
