import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { parse as parseEnv } from 'dotenv';
import { bindPreviewRun, previewImageDigest, previewSha, writePreviewJson } from '../lib/local-story-preview';
import { LOCAL_ANATOMY_VERSION, LOCAL_ANATOMY_INVENTORY_VERSION, INVENTORY_ANATOMY_INSTRUCTION, CHILD_LOCALIZATION_INSTRUCTION, LOCALIZED_ANATOMY_INSTRUCTION } from '../lib/local-anatomy-experiment';
import { LOCAL_ANATOMY_GROUNDED_VERSION, GROUNDED_INVENTORY_INSTRUCTION } from '../lib/local-anatomy-experiment';
import { PREVIEW_JUDGE_MODEL, PREVIEW_JUDGE_EFFORT } from '../lib/local-preview-quality';
import { inspectLocalizedAnatomy } from './lib/local-anatomy-experiment';

const configSchema = z.object({ sourceRoot: z.string(), outputRoot: z.string(), budgetUsd: z.number().positive().max(5),
  inspectionMode: z.enum(['inventory', 'grounded_inventory']).optional(),
  cases: z.array(z.object({ id: z.string().regex(/^[a-z][a-z0-9-]{0,30}$/), image: z.string(), expected: z.enum(['pass', 'defect']) }).strict()).min(2).max(8) }).strict();
async function main() {
  if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === 'production') throw Error('local_preview_only');
  const config = configSchema.parse(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
  const outputs = fs.realpathSync(path.resolve(__dirname, '../outputs'));
  const contained = (file: string) => {
    const real = fs.realpathSync(file), rel = path.relative(outputs, real);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw Error('experiment_outside_outputs');
    return real;
  };
  const source = contained(config.sourceRoot), root = path.resolve(config.outputRoot);
  if (path.dirname(root) !== outputs || (fs.existsSync(root) && fs.lstatSync(root).isSymbolicLink())) throw Error('experiment_output_root');
  const identity = JSON.parse(fs.readFileSync(contained(path.join(source, 'identity.json')), 'utf8'));
  const anchorPath = contained(path.join(source, 'reference-1.png')), anchorSha = previewImageDigest(anchorPath);
  if (anchorSha !== identity.refs[0].sha) throw Error('experiment_anchor_binding');
  const inputs = config.cases.map(c => { const candidatePath = contained(path.resolve(source, c.image));
    return { ...c, candidatePath, candidateSha: previewImageDigest(candidatePath) }; });
  if (new Set(inputs.map(c => c.id)).size !== inputs.length) throw Error('experiment_duplicate_case');
  const grounded = config.inspectionMode === 'grounded_inventory';
  const policy = { version: grounded ? LOCAL_ANATOMY_GROUNDED_VERSION : config.inspectionMode ? LOCAL_ANATOMY_INVENTORY_VERSION : LOCAL_ANATOMY_VERSION, model: PREVIEW_JUDGE_MODEL, effort: PREVIEW_JUDGE_EFFORT,
    localizationInstructionSha: previewSha(CHILD_LOCALIZATION_INSTRUCTION), inspectionInstructionSha: previewSha(grounded ? GROUNDED_INVENTORY_INSTRUCTION : config.inspectionMode ? INVENTORY_ANATOMY_INSTRUCTION : LOCALIZED_ANATOMY_INSTRUCTION) };
  bindPreviewRun(root, { ...policy, config, inputs, anchorSha });
  const key = process.env.OPENAI_API_KEY?.trim() || parseEnv(fs.readFileSync(process.argv[3])).OPENAI_API_KEY?.trim();
  if (!key) throw Error('existing_key_missing');
  const lock = path.join(root, 'run.lock'), fd = fs.openSync(lock, 'wx');
  try {
    const results = [];
    for (const c of inputs) {
      // Neither case ID, expected label, filename, source story nor prior verdict enters model input.
      const result = await inspectLocalizedAnatomy({ root, step: c.id, budgetUsd: config.budgetUsd, apiKey: key,
        anchorPath, anchorSha, candidatePath: c.candidatePath, candidateSha: c.candidateSha, inspectionMode: config.inspectionMode });
      const matched = result.status === 'inspected' && result.review.verdict === c.expected;
      results.push({ id: c.id, candidateSha: c.candidateSha, expected: c.expected, matched, ...result });
      console.log(JSON.stringify({ case: c.id, matched, ...result }));
    }
    const report = { ...policy, status: results.every(r => r.matched) ? 'experimental_cases_matched' : 'experiment_hold',
      renderAuthorized: false, independentQa: 'pending', generalAccuracyProven: false, results };
    const file = path.join(root, 'experiment-report.json');
    if (!fs.existsSync(file)) writePreviewJson(file, report);
    else if (JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))) !== JSON.stringify(report)) throw Error('experiment_report_changed');
    if (!results.every(r => r.matched)) process.exitCode = 2;
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
main().catch(() => { console.error('localized_anatomy_experiment_failed_see_receipts'); process.exitCode = 1; });
