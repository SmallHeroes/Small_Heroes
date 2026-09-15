import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { parse as parseEnv } from 'dotenv';
import { generateGPTImage } from '../lib/generate-image';
import { previewCheckpoint, previewImageDigest, previewSha, writePreviewJson } from '../lib/local-story-preview';

// Explicit, bounded visual correction requests; never overwrite paid predecessors.
const requestSchema = z.object({ pages: z.array(z.object({ pageNumber: z.number().int().min(0).max(24),
  predecessorSha: z.string().regex(/^[a-f0-9]{64}$/), correction: z.string().min(1).max(2000),
}).strict()).min(1).max(3) }).strict();
export function repairBinding(identity: { version?: string; sourceSha?: string; config: {
  intent?: string; story?: { sha: string }; plan?: { sha: string }; imageBudgetUsd?: number; budgetUsd?: number;
} }, manifest: { sourceSha: string; planSha?: string; productionReady?: boolean }) {
  const ownerDraft = identity.version === 'owner-book-draft/v1' && identity.config.intent === 'owner_requested_unaccepted_draft';
  const sourceSha = ownerDraft ? identity.config.story?.sha : identity.sourceSha;
  const budgetUsd = ownerDraft ? identity.config.imageBudgetUsd : identity.config.budgetUsd;
  if (sourceSha !== manifest.sourceSha || (ownerDraft && (manifest.productionReady !== false || manifest.planSha !== identity.config.plan?.sha))) throw Error('repair_source_mismatch');
  if (typeof budgetUsd !== 'number' || !Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > 10) throw Error('repair_budget_invalid');
  return { sourceSha, budgetUsd };
}
async function main() {
  if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === 'production') throw Error('local_preview_only');
  const root = fs.realpathSync(process.argv[2]);
  const allowed = fs.realpathSync(path.resolve(__dirname, '../outputs'));
  const relative = path.relative(allowed, root);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('invalid_preview_root');
  const request = requestSchema.parse(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')));
  if (new Set(request.pages.map(p => p.pageNumber)).size !== request.pages.length) throw Error('duplicate_repair_page');
  const identity = JSON.parse(fs.readFileSync(path.join(root, 'identity.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const { budgetUsd } = repairBinding(identity, manifest);
  for (const p of request.pages) {
    const original = manifest.pages[p.pageNumber];
    if (!original || original.pageNumber !== p.pageNumber || original.imageName !== `page-${String(p.pageNumber).padStart(2, '0')}.png` || original.imageSha !== p.predecessorSha || previewImageDigest(path.join(root, original.imageName)) !== p.predecessorSha) throw Error('repair_predecessor_mismatch');
  }
  const previousKey = process.env.OPENAI_API_KEY;
  const key = previousKey?.trim() || parseEnv(fs.readFileSync(process.argv[4])).OPENAI_API_KEY?.trim();
  if (!key) throw Error('existing_key_missing');
  const lock = path.join(root, 'run.lock'); const fd = fs.openSync(lock, 'wx');
  const nativeFetch = globalThis.fetch;
  let dispatched = false;
  globalThis.fetch = async (url, init) => {
    if (String(url) !== 'https://api.openai.com/v1/images/edits' || dispatched) throw Error('repair_dispatch_fence');
    dispatched = true; return nativeFetch(url, init);
  };
  process.env.OPENAI_API_KEY = key;
  try {
    const repaired = path.join(root, 'repair-01'); fs.mkdirSync(repaired, { recursive: true });
    for (const p of request.pages) {
      const name = manifest.pages[p.pageNumber].imageName;
      const refs = [path.join(root, name), path.join(root, 'prop-board-reference.png'), path.join(root, 'reference-1.png'), path.join(root, 'reference-2.png')];
      const prompt = `Make a precise correction to image 1, the existing full book page. Preserve its watercolor rendering, composition, background, child identity, pose, expression and all unaffected objects. Image 2 is the prop design authority. Image 3 is the child identity reference, image 4 the companion identity reference; do not copy their neutral poses. Return one full corrected image, no text, panels, labels or borders.\nCORRECTION: ${p.correction}`;
      const result = await previewCheckpoint({ root, step: `repair-${String(p.pageNumber).padStart(2, '0')}`, input: { prompt, refs: refs.map(previewImageDigest), sourceSha: manifest.sourceSha }, reserveUsd: 0.5, budgetUsd, produce: async () => {
        dispatched = false;
        const result = await generateGPTImage({ finalPrompt: prompt, referenceImages: refs, referenceMode: 'explicit_role_map', requireReferenceEdit: true,
          modelOverride: 'gpt-image-2', quality: 'low', size: '1024x1536', requestTimeoutMs: 600000 });
        fs.writeFileSync(path.join(repaired, name), result.buffer, { flag: 'wx' });
        return { value: { imageSha: previewImageDigest(path.join(repaired, name)), predecessorSha: p.predecessorSha, promptSha: previewSha(result.finalPrompt) }, usage: result.usage };
      } });
      if (previewImageDigest(path.join(repaired, name)) !== result.value.imageSha) throw Error('repair_image_changed');
      console.log(JSON.stringify({ page: p.pageNumber, repairedSha: result.value.imageSha }));
    }
    // A changed correction set produces a new reader view; never silently reuse
    // a previous manifest that does not include the new page.
    const reader = path.join(root, `reader-repair-${previewSha(JSON.stringify(request)).slice(0, 12)}`); fs.mkdirSync(reader, { recursive: true });
    const reviewedPath = path.join(root, 'reader/manifest.json');
    const base = fs.existsSync(reviewedPath) ? JSON.parse(fs.readFileSync(reviewedPath, 'utf8')) : manifest;
    const pages = base.pages.map((p: { pageNumber: number; imageName: string; imageSha: string }) => {
      const correction = request.pages.find(r => r.pageNumber === p.pageNumber);
      const from = path.join(correction ? repaired : root, p.imageName);
      const sha = previewImageDigest(from);
      if (!correction && sha !== p.imageSha) throw Error('untouched_reader_image_changed');
      const to = path.join(reader, p.imageName);
      if (!fs.existsSync(to)) fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
      if (previewImageDigest(to) !== sha) throw Error('repaired_reader_image_changed');
      return correction ? { ...p, imageSha: sha, automatedPassed: false, score: null, reason: 'corrected_candidate_pending_new_automated_review' } : p;
    });
    const value = { ...base, pages, productAcceptance: 'pending', productionReady: false };
    if (!fs.existsSync(path.join(reader, 'manifest.json'))) writePreviewJson(path.join(reader, 'manifest.json'), value);
    else if (JSON.stringify(JSON.parse(fs.readFileSync(path.join(reader, 'manifest.json'), 'utf8'))) !== JSON.stringify(value)) throw Error('repair_reader_manifest_changed');
    console.log(JSON.stringify({ readerDirectory: reader, repairedPages: request.pages.map(p => p.pageNumber), originalImagesPreserved: true }));
  } finally {
    globalThis.fetch = nativeFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
    fs.closeSync(fd); fs.unlinkSync(lock);
  }
}
if (require.main === module) main().catch(() => { console.error('local_preview_repair_failed_see_checkpoints'); process.exitCode = 1; });
