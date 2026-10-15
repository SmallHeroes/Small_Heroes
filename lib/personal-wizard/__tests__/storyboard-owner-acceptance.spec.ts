import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { canonicalJson } from '../request-acceptance';
import { personalStoryboardFrame, currentPersonalStoryboardFrame, storyboardReviewDisposition, storyboardOwnerAcceptance } from '../storyboard';
import { STORYBOARD_OWNER_ACCEPTANCE_VERSION } from '../storyboard-owner-acceptance';
import { storyboardRepairFindings } from '../storyboard-repair';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
type Fixture = Awaited<ReturnType<typeof personalStoryboardFixture>>;
/** The fixture's supported review, held: one book check contradicted, page 3's first check contradicted, page 5's third check uncertain. */
const held = (review: Fixture['review']) => {
  const r = structuredClone(review) as any;
  r.bookChecks[1] = { ...r.bookChecks[1], verdict: 'contradiction', observation: 'book-level observation' };
  r.frames[3].checks[0] = { ...r.frames[3].checks[0], verdict: 'contradiction', observation: 'page 3 observation' };
  r.frames[5].checks[2] = { ...r.frames[5].checks[2], verdict: 'uncertain', observation: 'page 5 observation' };
  return r;
};
/** The owner's record for exactly this book and this (held) review: every unsupported check, verbatim, in the review's order. */
const recordFor = (f: Fixture, review: unknown) => {
  const decision = storyboardReviewDisposition(f.book, review);
  return { version: STORYBOARD_OWNER_ACCEPTANCE_VERSION, storyboardDigest: f.book.storyboardDigest, reviewDigest: decision.reviewDigest,
    acceptedFindings: storyboardRepairFindings(decision.review), acceptedBy: 'Owner (synthetic test)', approval: 'Synthetic recorded decision.' };
};

describe('owner acceptance of a held storyboard (opt-in; bound to the book, its review and every unsupported check)', () => {
  it('absent: a held storyboard still builds no frame, and a supported one keeps its exact packet', async () => {
    const f = await personalStoryboardFixture(), review = held(f.review);
    expect(() => personalStoryboardFrame(f.book, review, 1, f.current)).toThrow('personal_storyboard_held_uncertain');
    expect(personalStoryboardFrame(f.book, f.review, 1, f.current).packetDigest).toBe('d737d76dc01ff5f9311247ec78c78a79cdf09b4579802a0b3a7160e8454514a1');
    expect(personalStoryboardFrame(f.book, f.review, 1, f.current).context).not.toHaveProperty('ownerAcceptance');
  });

  it('bound: every frame builds under the record, and the packet names it', async () => {
    const f = await personalStoryboardFixture(), review = held(f.review), record = recordFor(f, review);
    expect(record.acceptedFindings.map(x => x.observation)).toEqual(['book-level observation', 'page 3 observation', 'page 5 observation']);
    for (let n = 0; n <= f.book.narrativeSpreads; n++) {
      const frame = personalStoryboardFrame(f.book, review, n, f.current, record);
      expect(frame.context.ownerAcceptance).toEqual({ version: STORYBOARD_OWNER_ACCEPTANCE_VERSION, acceptanceDigest: sha(canonicalJson(record)) });
      expect(frame.context.reviewDigest).toBe(record.reviewDigest);
      expect(canonicalJson(currentPersonalStoryboardFrame(f.book, review, n, f.current, record))).toBe(canonicalJson(frame));
    }
    // The exported binding derives the decision from the book and the raw review itself (no caller-supplied decision).
    expect(storyboardOwnerAcceptance(f.book, review, record)).toEqual({ version: STORYBOARD_OWNER_ACCEPTANCE_VERSION, acceptanceDigest: sha(canonicalJson(record)) });
    expect(() => storyboardOwnerAcceptance(f.book, f.review, record)).toThrow('personal_storyboard_owner_acceptance_not_needed');
    const reworded = held(f.review); reworded.frames[3].checks[0].observation = 'page 3 observation, reworded';
    expect(() => storyboardOwnerAcceptance(f.book, reworded, record)).toThrow('personal_storyboard_owner_acceptance_binding');
  });

  it('refuses a record for another book, another review, or anything but exactly every unsupported check; a supported book needs none', async () => {
    const f = await personalStoryboardFixture(), review = held(f.review), record = recordFor(f, review);
    const bad = (change: (r: any) => void) => { const r = structuredClone(record) as any; change(r); return r; };
    for (const change of [
      (r: any) => { r.storyboardDigest = 'f'.repeat(64); }, (r: any) => { r.reviewDigest = 'e'.repeat(64); },
      (r: any) => { r.acceptedFindings.pop(); }, (r: any) => { r.acceptedFindings.reverse(); },
      (r: any) => { r.acceptedFindings[1].observation = 'page 3 observation, reworded'; },
      (r: any) => { r.acceptedFindings.push({ ...r.acceptedFindings[0], observation: 'one more' }); }])
      expect(() => personalStoryboardFrame(f.book, review, 1, f.current, bad(change))).toThrow('personal_storyboard_owner_acceptance_binding');
    // Another holding review of the same book is another review (the record named the first).
    const other = held(f.review); other.frames[5].checks[2].observation = 'page 5 observation, reworded';
    expect(() => personalStoryboardFrame(f.book, other, 1, f.current, record)).toThrow('personal_storyboard_owner_acceptance_binding');
    // A supported review is the review's own authority: a record for it is refused.
    expect(() => personalStoryboardFrame(f.book, f.review, 1, f.current, { ...record, reviewDigest: storyboardReviewDisposition(f.book, f.review).reviewDigest,
      acceptedFindings: [record.acceptedFindings[0]] })).toThrow('personal_storyboard_owner_acceptance_not_needed');
    for (const shape of [null, 'accepted', [], { ...record, extra: 1 }, { ...record, version: 'storyboard-owner-acceptance/v2' }, { ...record, acceptedFindings: [] },
      { ...record, acceptedBy: ' ' }, { ...record, approval: '' }, { ...record, storyboardDigest: 'ABC' }])
      expect(() => personalStoryboardFrame(f.book, review, 1, f.current, shape)).toThrow('personal_storyboard_owner_acceptance_policy');
  });
});
