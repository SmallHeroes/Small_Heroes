/** Offline source-bound preparation. No persistence, provider or acceptance operation. */
import { canonicalHash } from '@/lib/canonical-json';
import {
  buildSupportingCastReview,
  supportingCastCompilerInputDigest,
  assertSupportingCastReview,
  type SupportingCastReview,
} from '@/lib/visual-contract-compiler/supportingCastReview';
import {
  assertValidStorySourceAuthoritySnapshot,
  buildStorySourceAuthoritySnapshot,
  storySourceSnapshotToTemplateInput,
  type StorySourceAuthorityRequest,
} from './storySourceAuthority';

/** Reloads the complete accepted revision through the existing strict loader. */
export function prepareAcceptedSupportingCastReview(args: StorySourceAuthorityRequest & { entries: unknown }) {
  const snapshot = buildStorySourceAuthoritySnapshot(args);
  assertValidStorySourceAuthoritySnapshot(snapshot);
  const accepted = snapshot.content.acceptedRevisionAuthority;
  if (!accepted) throw new Error('supporting_cast_accepted_revision_required');
  const input = storySourceSnapshotToTemplateInput(snapshot);
  const review = buildSupportingCastReview({
    input,
    entries: args.entries,
    binding: {
      storyKey: input.storyKey,
      sourceSnapshotDigest: snapshot.digest,
      acceptedRevisionDigest: accepted.revisionDigest,
      acceptedAuthorityDigest: canonicalHash(accepted),
      sourceDigest: snapshot.content.sourceIdentity.digest,
      visualDirectionsSha256: accepted.fileSha256['visual-directions.json'],
      compilerInputDigest: supportingCastCompilerInputDigest(input),
    },
  });
  return { snapshot, input, review };
}

/** Serialized reviews must be rebound to disk authority, not trusted for their hash alone. */
export function loadAcceptedSupportingCastReview(args: StorySourceAuthorityRequest & { review: SupportingCastReview }) {
  const prepared = prepareAcceptedSupportingCastReview({ ...args, entries: args.review.entries });
  assertSupportingCastReview(args.review, prepared.input);
  if (prepared.review.digest !== args.review.digest) throw new Error('supporting_cast_accepted_binding_mismatch');
  return prepared;
}
