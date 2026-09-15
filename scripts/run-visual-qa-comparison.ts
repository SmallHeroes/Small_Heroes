import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { parse as parseEnv } from 'dotenv';
import { previewSha, bindPreviewRun, writePreviewJson } from '../lib/local-story-preview';
import { comparisonModels, comparisonSummary, COMPARISON_VERSION } from '../lib/visual-qa-comparison';
import { inspectComparison } from './lib/visual-qa-comparison';

async function main() {
  if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === 'production') throw Error('comparison_local_only');
  const outputs = fs.realpathSync(path.resolve(__dirname, '../outputs')), root = path.join(outputs, 'visual-qa-cross-family-20260915');
  const model = z.enum(['sonnet','qwen']).parse(process.argv[2]);
  const reconcileOnly = process.argv[4] === '--reconcile-only';
  const continueUnresolved = process.argv[4] === '--continue-unresolved';
  if (process.argv[4] !== undefined && !reconcileOnly && !continueUnresolved) throw Error('comparison_invalid_mode');
  const dataset = JSON.parse(fs.readFileSync(path.join(root, 'dataset.json'), 'utf8'));
  if (dataset.version !== COMPARISON_VERSION || JSON.stringify(dataset.models) !== JSON.stringify(comparisonModels)) throw Error('comparison_dataset_policy');
  const rowSchema = z.object({ id: z.string().regex(/^image-\d{2}$/), path: z.string(), sha: z.string().regex(/^[a-f0-9]{64}$/), split: z.enum(['smoke','development','reserved_unlabelled']),
    label: z.object({ expected: z.enum(['pass','defect']).nullable(), authority: z.enum(['owner','provisional','unlabelled']) }) });
  const rows = z.array(rowSchema).parse(dataset.rows).filter(r => r.split === 'smoke');
  if (rows.length !== 6 || new Set(rows.map(r => r.sha)).size !== 6 || new Set(rows.map(r => r.id)).size !== 6) throw Error('comparison_case_limit');
  const inputs = rows.map(row => { const file = fs.realpathSync(path.resolve(outputs, row.path)), relative = path.relative(outputs, file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('comparison_path_escape');
    const bytes = fs.readFileSync(file); if (previewSha(bytes) !== row.sha) throw Error('comparison_image_binding'); return { row, bytes }; });
  const run = path.join(root, model);
  if (fs.existsSync(root) && fs.lstatSync(root).isSymbolicLink() || fs.existsSync(run) && fs.lstatSync(run).isSymbolicLink()) throw Error('comparison_root_link');
  bindPreviewRun(run, { datasetSha: previewSha(JSON.stringify(dataset)), model: comparisonModels[model] });
  const key = process.env.REPLICATE_API_TOKEN || parseEnv(fs.readFileSync(process.argv[3])).REPLICATE_API_TOKEN;
  if (!key?.trim()) throw Error('comparison_existing_key_missing');
  const lock = path.join(run, 'run.lock'), fd = fs.openSync(lock, 'wx');
  try {
    const results = [];
    for (const { row, bytes } of inputs) {
      if (reconcileOnly && !fs.existsSync(path.join(run, 'steps', `${row.id}.claim.json`))) continue;
      let result;
      try { result = await inspectComparison({ root: run, step: row.id, model, bytes, sha: row.sha, key, reconcileOnly }); }
      catch (error) {
        if (!continueUnresolved) throw error;
        // Separate independent cases may proceed; an existing unresolved claim
        // still refuses POST inside previewCheckpoint. Never infer a free retry.
        result = { observed: 'unknown' as const, reason: 'transport_or_binding_unresolved', renderAuthorized: false as const };
      }
      results.push({ id: row.id, sha: row.sha, label: row.label, ...result });
      console.log(JSON.stringify({ model, id: row.id, observed: result.observed }));
    }
    if (reconcileOnly) return;
    const report = { model: comparisonModels[model], scope: 'exploratory; no independent QA or release authority', ...comparisonSummary(results.map(({ label, observed }) => ({ label, observed }))), results };
    const file = path.join(run, 'report.json');
    if (!fs.existsSync(file)) writePreviewJson(file, report);
    else if (JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))) !== JSON.stringify(report)) throw Error('comparison_report_changed');
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
main().catch(() => { console.error('visual_qa_comparison_held_see_receipts'); process.exitCode = 1; });
