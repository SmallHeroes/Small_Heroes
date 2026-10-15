/**
 * Opt-in OWNER ACCEPTANCE of a storyboard its semantic review held.
 *
 * The owner (product authority) may accept a held storyboard with the review's notes. The record binds exactly one compiled book (its
 * storyboard digest), that book's own review (its digest) and EVERY check that review did not support, verbatim and in the review's order
 * (derived by the engine, never chosen), with who accepted it and the owner's recorded decision. Frames of a held storyboard are built only
 * under such a record (personalStoryboardFrame); a supported storyboard needs none and refuses one. Absent, nothing changes.
 */
import type { StoryboardRepairFinding } from './storyboard-repair';

export const STORYBOARD_OWNER_ACCEPTANCE_VERSION = 'storyboard-owner-acceptance/v1' as const;
export type StoryboardOwnerAcceptance = { version: typeof STORYBOARD_OWNER_ACCEPTANCE_VERSION; storyboardDigest: string; reviewDigest: string;
  acceptedFindings: StoryboardRepairFinding[]; acceptedBy: string; approval: string };

const HASH = /^[a-f0-9]{64}$/;
const fail = (code: string): never => { throw Error(`personal_storyboard_${code}`); };
const text = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/** Shape check only; personalStoryboardFrame binds it to the book, its review and that review's findings. */
export function assertStoryboardOwnerAcceptance(value: unknown): asserts value is StoryboardOwnerAcceptance {
  const a = value as Partial<StoryboardOwnerAcceptance> | null;
  if (!a || typeof a !== 'object' || Array.isArray(a) ||
      Object.keys(a).sort().join(',') !== 'acceptedBy,acceptedFindings,approval,reviewDigest,storyboardDigest,version' ||
      a.version !== STORYBOARD_OWNER_ACCEPTANCE_VERSION || typeof a.storyboardDigest !== 'string' || !HASH.test(a.storyboardDigest) ||
      typeof a.reviewDigest !== 'string' || !HASH.test(a.reviewDigest) || !Array.isArray(a.acceptedFindings) || !a.acceptedFindings.length ||
      !text(a.acceptedBy, 200) || !text(a.approval, 4000)) fail('owner_acceptance_policy');
}
