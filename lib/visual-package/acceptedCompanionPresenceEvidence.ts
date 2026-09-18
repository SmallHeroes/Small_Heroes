/** Snapshot-bound evidence check. Validates integrity here, not at the caller's
 * discretion. Current consumers must still reload accepted authority from disk. */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { assertValidStorySourceAuthoritySnapshot, type StorySourceAuthoritySnapshot } from './storySourceAuthority';

export function assertAcceptedCompanionPresenceEvidence(args: {
  rawJson: string; snapshot: StorySourceAuthoritySnapshot; pageNumber: number;
}): void {
  const fail = (code: string): never => { throw new Error(`semantic_correction_companion_direction_${code}`); };
  assertValidStorySourceAuthoritySnapshot(args.snapshot);
  const authority = args.snapshot.content.acceptedRevisionAuthority;
  if (!authority) return fail('accepted_authority_required');
  const expectedSha256 = authority.fileSha256['visual-directions.json'];
  const storyKey = args.snapshot.content.storyKey;
  const pageCount = args.snapshot.content.pages.length;
  if (Buffer.byteLength(args.rawJson, 'utf8') > 250_000) fail('too_large');
  if (createHash('sha256').update(args.rawJson, 'utf8').digest('hex') !== expectedSha256) fail('source_mismatch');
  const directions = z.object({
    version: z.literal('small-heroes-story-visual-direction-record/v1'),
    storyKey: z.literal(storyKey),
    pages: z.array(z.object({ pageNumber: z.number().int().min(1).max(80), companionPresence: z.string() }).passthrough()).min(1).max(80),
  }).strict().parse(JSON.parse(args.rawJson));
  if (directions.pages.length !== pageCount || directions.pages.some((p, i) => p.pageNumber !== i + 1)) fail('coverage_mismatch');
  // Only an explicit typed present authorizes this additive operation. Free prose,
  // offscreen, absence and unknown/missing values cannot create presence.
  if (directions.pages[args.pageNumber - 1]?.companionPresence !== 'present') fail('not_present');
}
