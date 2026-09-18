/** Pure evidence check. Expected identity/hash must come from a validated snapshot,
 * never from the operation. This does not itself establish source acceptance. */
import { createHash } from 'node:crypto';
import { z } from 'zod';

export function assertAcceptedCompanionPresenceEvidence(args: {
  rawJson: string; expectedSha256: string; storyKey: string; pageCount: number; pageNumber: number;
}): void {
  const fail = (code: string): never => { throw new Error(`semantic_correction_companion_direction_${code}`); };
  if (Buffer.byteLength(args.rawJson, 'utf8') > 250_000) fail('too_large');
  if (createHash('sha256').update(args.rawJson, 'utf8').digest('hex') !== args.expectedSha256) fail('source_mismatch');
  const directions = z.object({
    version: z.literal('small-heroes-story-visual-direction-record/v1'),
    storyKey: z.literal(args.storyKey),
    pages: z.array(z.object({ pageNumber: z.number().int().min(1).max(80), companionPresence: z.string() }).passthrough()).min(1).max(80),
  }).strict().parse(JSON.parse(args.rawJson));
  if (directions.pages.length !== args.pageCount || directions.pages.some((p, i) => p.pageNumber !== i + 1)) fail('coverage_mismatch');
  // Only an explicit typed present authorizes this additive operation. Free prose,
  // offscreen, absence and unknown/missing values cannot create presence.
  if (directions.pages[args.pageNumber - 1]?.companionPresence !== 'present') fail('not_present');
}
