import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';
import { z } from 'zod';
import { bindPreviewRun, previewSha, previewAccountedUsd, writePreviewJson } from '../lib/local-story-preview';
import { draftOutputRoot } from './run-owner-book-draft';
import { buildPilotRequest, decidePilot, paidPilot, PILOT_VERSION, PILOT_BUDGET_USD } from './lib/anatomy-vision-pilot';

export const pilotConfigSchema = z.object({ intent: z.literal('owner_approved_targeted_anatomy_pilot'), outputDir: z.string(),
  cases: z.array(z.object({ id: z.string().regex(/^[a-z][a-z0-9-]{0,20}$/), file: z.string(),
    sha: z.string().regex(/^[a-f0-9]{64}$/), targetDescription: z.string().min(5).max(240),
    expected: z.enum(['defect', 'pass']) }).strict()).length(4) }).strict();
function read(repo: string, file: string) {
  const full = path.resolve(repo, file), relative = path.relative(repo, full);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || fs.realpathSync(full) !== full) throw Error('pilot_input_scope');
  return fs.readFileSync(full);
}
function save(file: string, value: unknown) {
  if (!fs.existsSync(file)) writePreviewJson(file, value);
  else if (JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))) !== JSON.stringify(value)) throw Error('pilot_evidence_changed');
}
export function pilotMetrics(rows: { expected: string; disposition: string; defectCount: number }[]) {
  return { inspected: rows.length,
    positiveReportsWithDefect: rows.filter(r => r.expected === 'defect' && r.defectCount > 0).length,
    positiveReportsWithoutDefect: rows.filter(r => r.expected === 'defect' && r.defectCount === 0).length,
    positiveFalsePasses: rows.filter(r => r.expected === 'defect' && r.disposition === 'observed_pass').length,
    negativeReportsWithDefect: rows.filter(r => r.expected === 'pass' && r.defectCount > 0).length,
    negativeHolds: rows.filter(r => r.expected === 'pass' && r.disposition === 'held_uncertain').length,
    negativePasses: rows.filter(r => r.expected === 'pass' && r.disposition === 'observed_pass').length };
}
export async function runPilot(configFile: string, mode: 'preflight' | 'live' | 'replay' = 'preflight', keyFile?: string) {
  const repo = path.resolve(__dirname, '..');
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.VERCEL_ENV) throw Error('pilot_local_only');
  const config = pilotConfigSchema.parse(JSON.parse(read(repo, configFile).toString('utf8')));
  if (new Set(config.cases.map(c => c.id)).size !== 4 || config.cases.filter(c => c.expected === 'defect').length !== 2) throw Error('pilot_case_inventory');
  const root = draftOutputRoot(repo, config.outputDir);
  if (!path.basename(root).startsWith('anatomy-vision-pilot-')) throw Error('pilot_output_scope');
  const cases = await Promise.all(config.cases.map(async c => {
    const bytes = read(repo, c.file);
    // The builder receives neither labels, filenames, case IDs nor expected counts.
    return { ...c, built: await buildPilotRequest(bytes, c.sha, c.targetDescription) };
  }));
  const identity = { version: PILOT_VERSION, config, budgetUsd: PILOT_BUDGET_USD, maxCalls: 8,
    codeShas: ['scripts/run-anatomy-vision-pilot.ts', 'scripts/lib/anatomy-vision-pilot.ts', 'lib/anatomy-evidence-policy.ts',
      'scripts/lib/qa-cost-experiment.ts', 'lib/local-story-preview.ts'].map(file => ({ file, sha: previewSha(read(repo, file)) })),
    requests: cases.map(c => ({ id: c.id, requestSha: previewSha(JSON.stringify(c.built.request)) })), productionReady: false };
  if (mode === 'replay') {
    if (JSON.stringify(JSON.parse(read(repo, path.join(root, 'identity.json')).toString('utf8'))) !== JSON.stringify(identity)) throw Error('pilot_identity_changed');
  } else bindPreviewRun(root, identity);
  if (mode === 'preflight') { console.log(JSON.stringify({ stage: 'preflight', targets: 4, uniqueImages: new Set(cases.map(c => c.sha)).size, maxCalls: 8, budgetUsd: PILOT_BUDGET_USD, providerCalls: 0 })); return; }
  const lock = path.join(root, 'run.lock'), fd = mode === 'live' ? fs.openSync(lock, 'wx') : null;
  const results: { id: string; round: number; expected: string; disposition: string; defectCount: number }[] = [];
  let stopped: string | null = null;
  try {
    const key = mode === 'replay' ? 'offline-replay-no-key' : keyFile ? parse(fs.readFileSync(keyFile)).OPENAI_API_KEY?.trim() : process.env.OPENAI_API_KEY?.trim();
    if (!key) throw Error('pilot_key_missing');
    for (let round = 1; round <= 2; round++) {
      for (const c of round === 1 ? cases : [...cases].reverse()) {
        const step = `r${round}-${c.id}`;
        const record = await paidPilot(root, step, c.built.request, key, mode === 'replay');
        const decision = decidePilot(JSON.parse(record.value.text), c.built.candidateSha, c.built.contextSha);
        const row = { id: c.id, round, expected: c.expected, disposition: decision.disposition, defectCount: decision.defects.length };
        if (mode === 'live') save(path.join(root, `${step}.decision.json`), { ...row, decision });
        results.push(row); console.log(JSON.stringify({ stage: 'inspected', ...row }));
      }
      if (round === 1 && !results.some(r => r.expected === 'defect' && r.defectCount > 0)) { stopped = 'no_positive_defect_evidence_after_first_round'; break; }
    }
  } catch (error) {
    stopped = error instanceof Error && /^[a-z][a-z0-9_]{1,100}$/.test(error.message) ? error.message : 'pilot_transport_or_schema_stopped';
  } finally { if (fd !== null) { fs.closeSync(fd); fs.unlinkSync(lock); } }
  const steps = path.join(root, 'steps');
  const claims = fs.existsSync(steps) ? fs.readdirSync(steps).filter(n => n.endsWith('.claim.json')) : [];
  let knownResponses = 0, unknownOutcomes = 0, pricedResponses = 0, nominalUsd = 0;
  for (const name of claims) {
    const resultFile = path.join(steps, name.replace('.claim.json', '.result.json'));
    if (!fs.existsSync(resultFile)) { unknownOutcomes++; continue; }
    knownResponses++; const r = JSON.parse(fs.readFileSync(resultFile, 'utf8')), u = r.usage;
    const cached = u?.input_tokens_details?.cached_tokens ?? 0;
    if (r.value.serviceTier === 'flex' && /^gpt-5\.5(?:-|$)/.test(r.value.model) &&
      [u?.input_tokens, u?.output_tokens, cached].every(n => Number.isSafeInteger(n) && n >= 0) && u.input_tokens + u.output_tokens > 0 && cached <= u.input_tokens && u.input_tokens < 272000) {
      pricedResponses++; nominalUsd += ((u.input_tokens - cached) * 2.5 + cached * 0.25 + u.output_tokens * 15) / 1e6;
    }
  }
  const report = { version: PILOT_VERSION, results, metrics: pilotMetrics(results), stopped, knownResponses, unknownOutcomes,
    pricedResponses, knownListEstimateUsd: nominalUsd, allCostsKnown: unknownOutcomes === 0 && pricedResponses === knownResponses,
    conservativeAccountedUsd: previewAccountedUsd(steps), invoiceVerified: false, productionReady: false,
    visualAccuracyProven: false, uniqueImages: new Set(cases.map(c => c.sha)).size };
  if (mode === 'live') save(path.join(root, 'report.json'), report);
  else if (JSON.stringify(JSON.parse(read(repo, path.join(root, 'report.json')).toString('utf8'))) !== JSON.stringify(report)) throw Error('pilot_replay_report_changed');
  console.log(JSON.stringify({ stage: 'report', ...report }));
  return report;
}
if (require.main === module) {
  const k = process.argv.indexOf('--key-env-file');
  runPilot(process.argv[2], process.argv.includes('--replay') ? 'replay' : process.argv.includes('--live') ? 'live' : 'preflight', k < 0 ? undefined : process.argv[k + 1])
    .then(report => { if (report?.stopped) process.exitCode = 2; })
    .catch(() => { console.error('anatomy_vision_pilot_failed'); process.exitCode = 1; });
}
