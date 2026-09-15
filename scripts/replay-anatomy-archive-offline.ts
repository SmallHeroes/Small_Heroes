import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { inventoryAnatomyDisposition, localizedAnatomyDisposition, localizedCropRect, validateAnatomyRegionGrounding } from '../lib/local-anatomy-experiment';

// Read-only archive audit, not a provider experiment or migration to the new schema.
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
export async function replayAnatomyArchiveOffline(repositoryRoot: string) {
  const rows = [];
  for (const version of ['v1', 'v2', 'v3', 'sol']) {
    const root = path.join(repositoryRoot, 'outputs', `localized-anatomy-${version}-20260915`);
    const identity = JSON.parse(fs.readFileSync(path.join(root, 'identity.json'), 'utf8'));
    for (const sample of ['a', 'b']) {
      const id = `sample-${sample}`;
      const bytes = fs.readFileSync(path.join(root, 'steps', `${id}-inspect.result.json`));
      const receipt = JSON.parse(bytes.toString('utf8'));
      const input = identity.inputs.find((i: { id: string }) => i.id === id);
      if (!input || hash(fs.readFileSync(input.candidatePath)) !== input.candidateSha) throw Error('archive_candidate_binding');
      const claim = JSON.parse(fs.readFileSync(path.join(root, 'steps', `${id}-inspect.claim.json`), 'utf8'));
      if (claim.fingerprint !== receipt.fingerprint) throw Error('archive_receipt_binding');
      const decoded = JSON.parse(receipt.value.text);
      let disposition: string;
      try {
        if (receipt.value.status !== 'completed') throw Error('archive_response_incomplete');
        if (version === 'v3' || version === 'sol') {
          const location = JSON.parse(JSON.parse(fs.readFileSync(path.join(root, 'steps', `${id}-locate.result.json`), 'utf8')).value.text);
          const meta = await sharp(input.candidatePath).metadata();
          if (!meta.width || !meta.height) throw Error('archive_image_dimensions');
          const rect = localizedCropRect(location.box, meta.width, meta.height);
          validateAnatomyRegionGrounding(decoded, rect, meta.width, meta.height);
        }
        disposition = (version === 'v1' ? localizedAnatomyDisposition(decoded) : inventoryAnatomyDisposition(decoded)).disposition;
      } catch (error) {
        disposition = error instanceof Error ? error.message.split('\n')[0] : 'archive_validation_error';
      }
      rows.push({ version, sample, candidateSha: input.candidateSha, receiptSha: hash(bytes),
        expected: input.expected, expectedSource: 'historical operator label, not revalidated here',
        rawVerdict: decoded.verdict, disposition,
        occludedParts: (decoded.limbInventory ?? []).filter((p: { connection: string }) => p.connection === 'ordinary_occlusion')
          .map((p: { limb: string; region: unknown }) => ({ limb: p.limb, regionPresent: p.region !== null })),
      });
    }
  }
  return { providerCalls: 0, writes: 0, uniqueImages: new Set(rows.map(r => r.candidateSha)).size,
    migratedToNewEvidence: false, accuracyClaim: false, rows };
}
if (require.main === module) replayAnatomyArchiveOffline(process.argv[2] ?? process.cwd())
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => { console.error(error instanceof Error ? error.message : 'archive_replay_failed'); process.exitCode = 1; });
