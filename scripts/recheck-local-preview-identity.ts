import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { parse as parseEnv } from 'dotenv';
import { bindPreviewRun, previewSha, writePreviewJson } from '../lib/local-story-preview';
import { PREVIEW_JUDGE_MODEL, PREVIEW_JUDGE_EFFORT, PREVIEW_QUALITY_VERSION } from '../lib/local-preview-quality';
import { judgePreviewIdentity } from './lib/local-preview-identity';

const configSchema = z.object({ sourceRoot: z.string(), readerRoot: z.string(), outputRoot: z.string(),
  budgetUsd: z.number().positive().max(5) }).strict();
const manifestSchema = z.object({ sourceSha: z.string(), pages: z.array(z.object({ pageNumber: z.number().int().nonnegative(),
  imageName: z.string().regex(/^page-\d{2}\.png$/), imageSha: z.string().regex(/^[a-f0-9]{64}$/), text: z.string() })).min(1).max(25) });

async function main() {
  if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === 'production') throw Error('local_preview_only');
  const config = configSchema.parse(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
  const outputs = fs.realpathSync(path.resolve(__dirname, '../outputs'));
  const contained = (file: string) => {
    const real = fs.realpathSync(file), rel = path.relative(outputs, real);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw Error('identity_path_outside_outputs');
    return real;
  };
  const source = contained(config.sourceRoot), reader = contained(config.readerRoot), root = path.resolve(config.outputRoot);
  if (path.dirname(root) !== outputs || (fs.existsSync(root) && fs.lstatSync(root).isSymbolicLink())) throw Error('identity_output_root');
  const identity = JSON.parse(fs.readFileSync(contained(path.join(source, 'identity.json')), 'utf8'));
  const original = manifestSchema.parse(JSON.parse(fs.readFileSync(contained(path.join(source, 'manifest.json')), 'utf8')));
  const readerBytes = fs.readFileSync(contained(path.join(reader, 'manifest.json')));
  const manifest = manifestSchema.parse(JSON.parse(readerBytes.toString('utf8')));
  if (manifest.sourceSha !== identity.sourceSha || manifest.sourceSha !== original.sourceSha || manifest.pages.length !== original.pages.length) throw Error('identity_source_binding');
  const anchorPath = contained(path.join(source, 'reference-1.png')), anchorSha = identity.refs[0].sha;
  if (previewSha(fs.readFileSync(anchorPath)) !== anchorSha) throw Error('identity_anchor_binding');
  const pages = manifest.pages.map((p, i) => {
    if (p.pageNumber !== i || p.text !== original.pages[i].text || p.imageName !== `page-${String(i).padStart(2, '0')}.png`) throw Error('identity_page_binding');
    const candidatePath = contained(path.join(reader, p.imageName));
    if (previewSha(fs.readFileSync(candidatePath)) !== p.imageSha) throw Error('identity_candidate_binding');
    return { pageNumber: i, candidatePath, candidateSha: p.imageSha };
  });
  bindPreviewRun(root, { version: PREVIEW_QUALITY_VERSION, model: PREVIEW_JUDGE_MODEL, effort: PREVIEW_JUDGE_EFFORT,
    config, anchorSha, readerManifestSha: previewSha(readerBytes), pages });
  const key = process.env.OPENAI_API_KEY?.trim() || parseEnv(fs.readFileSync(process.argv[3])).OPENAI_API_KEY?.trim();
  if (!key) throw Error('existing_key_missing');
  const lock = path.join(root, 'run.lock'), fd = fs.openSync(lock, 'wx');
  try {
    const results = [];
    for (const page of pages) {
      const record = await judgePreviewIdentity({ ...page, anchorPath, anchorSha, root, apiKey: key,
        budgetUsd: config.budgetUsd, step: `identity-${String(page.pageNumber).padStart(2, '0')}` });
      const result = { ...page, ...record.value.result }; results.push(result);
      console.log(JSON.stringify({ page: page.pageNumber, status: result.status, score: result.resemblanceScore, reason: result.reasonCode }));
      // Transport/malformed evidence is not a failed face or authority to retry.
      if (result.reasonCode === 'transport_error' || result.reasonCode === 'malformed') throw Error('identity_transport_or_schema_hold');
    }
    const report = { version: PREVIEW_QUALITY_VERSION, model: PREVIEW_JUDGE_MODEL, effort: PREVIEW_JUDGE_EFFORT,
      threshold: 0.70, readerManifestSha: previewSha(readerBytes), independentQa: 'pending', productionReady: false, results };
    const file = path.join(root, 'identity-review.json');
    if (!fs.existsSync(file)) writePreviewJson(file, report);
    else if (JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))) !== JSON.stringify(report)) throw Error('identity_evidence_changed');
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
main().catch(() => { console.error('identity_recheck_failed_see_checkpoint_state'); process.exitCode = 1; });
