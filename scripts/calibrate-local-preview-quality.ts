import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { parse as parseEnv } from 'dotenv';
import { bindPreviewRun, previewImageDigest, previewSha, writePreviewJson } from '../lib/local-story-preview';
import { ANATOMY_INSPECTION_INSTRUCTION, PREVIEW_QUALITY_VERSION, PREVIEW_JUDGE_INSTRUCTION, QUALITY_CATEGORIES, qualityDisposition } from '../lib/local-preview-quality';
import { judgePreviewCandidate } from './lib/local-preview-judge';

const configSchema = z.object({
  sourceRoot: z.string(), outputRoot: z.string(), budgetUsd: z.number().positive().max(3),
  cases: z.array(z.object({ id: z.string().regex(/^[a-z][a-z0-9-]{0,30}$/), pageNumber: z.number().int().min(0).max(24),
    image: z.string(), previousPages: z.array(z.number().int().min(0).max(24)).max(3),
    expected: z.array(z.object({ category: z.enum(QUALITY_CATEGORIES), verdict: z.enum(['pass', 'defect']) }).strict()).min(1),
  }).strict()).min(1).max(8),
}).strict();

async function main() {
  if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === 'production') throw Error('local_preview_only');
  const config = configSchema.parse(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
  const outputs = fs.realpathSync(path.resolve(__dirname, '../outputs'));
  const contained = (file: string) => {
    const result = fs.realpathSync(file); const rel = path.relative(outputs, result);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw Error('calibration_path_outside_outputs');
    return result;
  };
  const source = contained(config.sourceRoot);
  const root = path.resolve(config.outputRoot);
  if (path.dirname(root) !== outputs || (fs.existsSync(root) && fs.lstatSync(root).isSymbolicLink())) throw Error('calibration_output_root');
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
  const identity = JSON.parse(fs.readFileSync(path.join(source, 'identity.json'), 'utf8'));
  const plan = JSON.parse(JSON.parse(fs.readFileSync(path.join(source, 'steps/plan.result.json'), 'utf8')).value.outputText);
  if (previewSha(JSON.stringify(plan)) !== manifest.planSha || manifest.sourceSha !== identity.sourceSha) throw Error('calibration_source_binding');
  const inputs = config.cases.map(c => {
    const file = contained(path.resolve(source, c.image));
    const prior = c.previousPages.map(number => {
      const page = manifest.pages[number];
      if (!page || page.pageNumber !== number) throw Error('calibration_previous_page');
      const file = contained(path.join(source, page.imageName));
      if (previewImageDigest(file) !== page.imageSha) throw Error('calibration_prior_changed');
      return { file, sha: page.imageSha, role: `previous page ${number}, rendering can contain mistakes; canonical plan wins` };
    });
    if (!manifest.pages[c.pageNumber]) throw Error('calibration_unknown_page');
    const refs = [1, 2].map((n, i) => {
      const file = contained(path.join(source, `reference-${n}.png`));
      if (previewImageDigest(file) !== identity.refs[i].sha) throw Error('calibration_reference_changed');
      return { file, sha: identity.refs[i].sha, role: n === 1 ? 'canonical child identity' : 'canonical companion identity' };
    });
    return { ...c, file, sha: previewImageDigest(file), references: [...refs, ...prior] };
  });
  if (new Set(inputs.map(c => c.id)).size !== inputs.length) throw Error('duplicate_calibration_case');
  bindPreviewRun(root, { version: PREVIEW_QUALITY_VERSION, instructionSha: previewSha(PREVIEW_JUDGE_INSTRUCTION), config, inputs });
  const key = process.env.OPENAI_API_KEY?.trim() || parseEnv(fs.readFileSync(process.argv[3])).OPENAI_API_KEY?.trim();
  if (!key) throw Error('existing_key_missing');
  const lock = path.join(root, 'run.lock'); const fd = fs.openSync(lock, 'wx');
  try {
    const results = [];
    for (const c of inputs) {
      // Deliberately exclude case ID, expected verdict and operator diagnosis from judge input.
      const context = { plan, pageNumber: c.pageNumber, text: manifest.pages[c.pageNumber].text,
        sourceSha: manifest.sourceSha, companionDescription: identity.config.companionDescription,
        priorPages: c.previousPages };
      const contextSha = previewSha(JSON.stringify({ version: PREVIEW_QUALITY_VERSION, context }));
      const value = await judgePreviewCandidate({ root, step: `case-${c.id}`, budgetUsd: config.budgetUsd, apiKey: key,
        candidatePath: c.file, candidateSha: c.sha, context, contextSha, references: c.references });
      const decision = qualityDisposition(value, c.sha, contextSha);
      const matched = c.expected.every(e => value.checks.find(check => check.category === e.category)?.verdict === e.verdict);
      const result = { id: c.id, matched, expected: c.expected, ...decision };
      results.push(result); console.log(JSON.stringify(result));
    }
    const result = { version: PREVIEW_QUALITY_VERSION, instructionSha: previewSha(PREVIEW_JUDGE_INSTRUCTION),
      anatomyInstructionSha: previewSha(ANATOMY_INSPECTION_INSTRUCTION),
      status: results.every(r => r.matched) ? 'calibration_cases_matched' : 'calibration_hold',
      independentQa: 'pending', generalAccuracyProven: false, results };
    const file = path.join(root, 'calibration-policy.json');
    if (!fs.existsSync(file)) writePreviewJson(file, result);
    else if (JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))) !== JSON.stringify(result)) throw Error('calibration_evidence_changed');
    if (!results.every(r => r.matched)) process.exitCode = 2;
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
main().catch(() => { console.error('calibration_failed_see_checkpoint_state'); process.exitCode = 1; });
