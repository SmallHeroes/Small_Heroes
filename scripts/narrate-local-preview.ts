import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { parse as parseEnv } from 'dotenv';
import { bindPreviewRun, previewImageDigest, previewSha, writePreviewJson } from '../lib/local-story-preview';
import { narratePreviewPage } from './lib/local-preview-narration';

const schema = z.object({ sourceSha: z.string().regex(/^[a-f0-9]{64}$/), pages: z.array(z.object({
  pageNumber: z.number().int().min(0).max(24), imageName: z.string().regex(/^page-\d{2}\.png$/),
  imageSha: z.string().regex(/^[a-f0-9]{64}$/), text: z.string().min(1), automatedPassed: z.boolean(),
  reason: z.string(), score: z.number().nullable(),
})).min(3).max(25) }).passthrough();

async function main() {
  if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === 'production') throw Error('local_preview_only');
  const [sourceArg, outputArg, keyFile, voiceId = 'mom'] = process.argv.slice(2);
  const outputs = fs.realpathSync(path.resolve(__dirname, '../outputs'));
  const source = fs.realpathSync(sourceArg), root = path.resolve(outputArg);
  const relative = path.relative(outputs, source);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || path.dirname(root) !== outputs ||
    (fs.existsSync(root) && fs.lstatSync(root).isSymbolicLink())) throw Error('narration_directory_scope');
  const contained = (file: string) => {
    const p = fs.realpathSync(path.join(source, file)); if (path.dirname(p) !== source) throw Error('narration_source_link'); return p;
  };
  const raw = fs.readFileSync(contained('manifest.json'));
  const manifest = schema.parse(JSON.parse(raw.toString('utf8')));
  manifest.pages.forEach((p, i) => {
    if (p.pageNumber !== i || p.imageName !== `page-${String(i).padStart(2, '0')}.png` ||
      previewImageDigest(contained(p.imageName)) !== p.imageSha) throw Error('narration_input_binding');
  });
  const budgetUsd = 7;
  if ((manifest.pages.length - 1) * 0.5 > budgetUsd) throw Error('narration_reservation_limit');
  const key = process.env.ELEVENLABS_API_KEY?.trim() || parseEnv(fs.readFileSync(keyFile)).ELEVENLABS_API_KEY?.trim();
  if (!key) throw Error('existing_narration_key_missing');
  bindPreviewRun(root, { version: 'local-preview-narration/v1', source, manifestSha: previewSha(raw), sourceSha: manifest.sourceSha, voiceId, budgetUsd });
  const lock = path.join(root, 'run.lock'), fd = fs.openSync(lock, 'wx');
  try {
    const pages = [];
    for (const page of manifest.pages) {
      const target = path.join(root, page.imageName);
      if (!fs.existsSync(target)) fs.copyFileSync(contained(page.imageName), target, fs.constants.COPYFILE_EXCL);
      if (previewImageDigest(target) !== page.imageSha) throw Error('narration_image_changed');
      const audio = page.pageNumber === 0 ? undefined : await narratePreviewPage({ root, pageNumber: page.pageNumber,
        text: page.text, voiceId, apiKey: key, budgetUsd });
      pages.push({ ...page, ...(audio ? { audio } : {}) });
      console.log(JSON.stringify({ page: page.pageNumber, audioReady: Boolean(audio) }));
    }
    const result = { ...manifest, productionReady: false, narrationStatus: 'local_audition_pending_owner_listening', pages };
    const file = path.join(root, 'manifest.json');
    if (!fs.existsSync(file)) writePreviewJson(file, result);
    else if (JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))) !== JSON.stringify(result)) throw Error('narration_manifest_changed');
    // No owner verdict is created or inferred by an audio audition.
    console.log(JSON.stringify({ status: 'local_narration_ready', readerDirectory: root, independentQa: 'pending' }));
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
main().catch(() => { console.error('local_narration_failed_see_checkpoints'); process.exitCode = 1; });
