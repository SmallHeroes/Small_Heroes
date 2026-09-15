import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { bindPreviewRun, previewSha, writePreviewJson } from '../../lib/local-story-preview';
import { comparisonInput, comparisonModels, comparisonSummary } from '../../lib/visual-qa-comparison';
import { inspectComparison } from './visual-qa-comparison';
import { findingProposalsSchema,findingReviewInput } from '../../lib/anatomy-finding-review';

const token = z.string().regex(/^[a-z][a-z0-9-]{0,35}$/);
const sha = z.string().regex(/^[a-f0-9]{64}$/);
export const frozenBenchmarkSchema = z.object({
  version: z.literal('frozen-qa-benchmark/v1'), id: token, promptSha: sha,
  viewMode: z.literal('full-and-details').optional(),
  severityPolicy: z.enum(['severe-only','verify-findings']).optional(),
  cases: z.array(z.object({
    id: token, root: z.enum(['local','archive']), file: z.string().min(1).max(400), sha,
    cohort: z.enum(['replication','expansion']), family: token,
    detailBox: z.object({left:z.number().int().min(0),top:z.number().int().min(0),width:z.number().int().min(1),height:z.number().int().min(1)}).strict().optional(),
    findingReview:z.object({sourceReportFile:z.string().min(1).max(400),sourceReportSha:sha,findings:findingProposalsSchema}).strict().optional(),
    label: z.object({ expected: z.enum(['pass','defect']).nullable(), authority: z.enum(['owner','provisional','unlabelled']), basis: z.string().min(1).max(1000) }).strict(),
  }).strict()).min(1).max(12),
}).strict();
export function frozenPromptSha(details = false, severe: boolean|'verify-findings' = false) {
  // Bind all prompt/request settings, excluding only the target PNG payload.
  return previewSha(JSON.stringify(severe==='verify-findings' ? findingReviewInput('data:image/png;base64,',[{id:'f-0',location:'placeholder',evidence:'placeholder'}]) : comparisonInput('qwen','data:image/png;base64,', {mode:severe?'severe-only':'rubric',examples:[]}, details ? ['data:image/png;base64,detail-placeholder'] : [])));
}
export function loadFrozenBenchmark(raw: unknown, roots: Record<'local'|'archive',string>) {
  if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === 'production') throw Error('benchmark_local_only');
  const config = frozenBenchmarkSchema.parse(raw);
  if (config.promptSha !== frozenPromptSha(Boolean(config.viewMode),config.severityPolicy==='verify-findings'?'verify-findings':Boolean(config.severityPolicy))) throw Error('benchmark_prompt_changed');
  if (new Set(config.cases.map(c=>c.id)).size !== config.cases.length || new Set(config.cases.map(c=>c.sha)).size !== config.cases.length) throw Error('benchmark_duplicate_case');
  const targets = config.cases.map(c => {
    if((config.severityPolicy==='verify-findings')!==Boolean(c.findingReview) || (c.findingReview && c.detailBox)) throw Error('benchmark_finding_mode');
    if(c.findingReview) {
      const ref=c.findingReview, reportRoot=fs.realpathSync(roots.local);
      if(path.isAbsolute(ref.sourceReportFile) || ref.sourceReportFile.split(/[\\/]/).some(s=>!s || s==='.' || s==='..') || !ref.sourceReportFile.endsWith('.json')) throw Error('benchmark_report_path');
      const reportFile=fs.realpathSync(path.resolve(reportRoot,ref.sourceReportFile)), rel=path.relative(reportRoot,reportFile);
      if(rel.startsWith('..') || path.isAbsolute(rel)) throw Error('benchmark_report_path');
      const reportBytes=fs.readFileSync(reportFile);
      if(previewSha(reportBytes)!==ref.sourceReportSha) throw Error('benchmark_report_changed');
      const matches=JSON.parse(reportBytes.toString('utf8')).results?.filter((r:any)=>r.sha===c.sha);
      if(!Array.isArray(matches) || matches.length!==1 || matches[0].observed!=='defect' || !Array.isArray(matches[0].review?.anatomy?.findings) || JSON.stringify(matches[0].review.anatomy.findings.map((f:any,i:number)=>({id:'f-'+i,...f})))!==JSON.stringify(ref.findings)) throw Error('benchmark_finding_source_binding');
    }
    if (Boolean(config.viewMode)!==Boolean(c.detailBox)) throw Error('benchmark_detail_mode');
    if ((c.label.expected === null) !== (c.label.authority === 'unlabelled')) throw Error('benchmark_label_inconsistent');
    if (path.isAbsolute(c.file) || c.file.split(/[\\/]/).some(s=>!s || s==='.' || s==='..') || !c.file.endsWith('.png')) throw Error('benchmark_path_invalid');
    const root = fs.realpathSync(roots[c.root]), file = fs.realpathSync(path.resolve(root,c.file)), relative = path.relative(root,file);
    if (!relative || relative==='..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw Error('benchmark_path_escape');
    const bytes = fs.readFileSync(file);
    if (previewSha(bytes) !== c.sha || !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error('benchmark_image_changed');
    return {...c,bytes};
  });
  return {config,targets};
}
export async function runFrozenBenchmark(args: {raw:unknown; roots:Record<'local'|'archive',string>; outputParent:string; key:string; fetcher?:typeof fetch}) {
  const {config,targets} = loadFrozenBenchmark(args.raw,args.roots);
  // Extract every requested crop before admission of any paid step. No resizing or edits.
  const details = await Promise.all(targets.map(async t=>t.detailBox ? await sharp(t.bytes).extract(t.detailBox).png().toBuffer() : undefined));
  const parent = fs.realpathSync(args.outputParent), root = path.join(parent,`qa-validation-${config.id}`);
  if (fs.existsSync(root) && (fs.lstatSync(root).isSymbolicLink() || fs.realpathSync(root)!==root)) throw Error('benchmark_root_link');
  if (!args.key.trim()) throw Error('benchmark_key_missing');
  bindPreviewRun(root,{config,configuredModel:comparisonModels.qwen,transport:'official_async',maxCalls:12,budgetUsd:3,renderAuthorized:false,
    ...(config.viewMode ? {detailHashes:details.map(d=>previewSha(d!))} : {})});
  const lock = path.join(root,'run.lock'), fd=fs.openSync(lock,'wx');
  try {
    const results: Array<Omit<typeof targets[number],'bytes'> & Awaited<ReturnType<typeof inspectComparison>>> = [];
    for (const [index,target] of targets.entries()) {
      const detail=details[index];
      if (detail) {
        const file=path.join(root,`${target.id}-detail.png`);
        if (!fs.existsSync(file)) fs.writeFileSync(file,detail,{flag:'wx'});
        else if (previewSha(fs.readFileSync(file))!==previewSha(detail)) throw Error('benchmark_saved_detail_changed');
      }
      let result: Awaited<ReturnType<typeof inspectComparison>>;
      try { result = await inspectComparison({root,step:target.id,model:'qwen',bytes:target.bytes,sha:target.sha,key:args.key,fetcher:args.fetcher,transportMode:'official_async',calibration:config.severityPolicy==='verify-findings'?undefined:{mode:config.severityPolicy??'rubric',examples:[]},findings:target.findingReview?.findings,detailImages:detail?[{bytes:detail,sha:previewSha(detail)}]:undefined}); }
      catch { result={observed:'unknown',reason:'transport_or_binding_unresolved',renderAuthorized:false}; }
      const {bytes: _bytes,...metadata} = target;
      results.push({...metadata,...result});
      console.log(JSON.stringify({id:target.id,observed:result.observed}));
    }
    const report={version:config.version,renderAuthorized:false,generalAccuracyProven:false,independentQa:'pending',
      cohorts: (['replication','expansion'] as const).map(cohort=>({cohort,...comparisonSummary(results.filter(r=>r.cohort===cohort))})),results};
    const file=path.join(root,'report.json'), serialized=JSON.stringify(report);
    if (!fs.existsSync(file)) writePreviewJson(file,report);
    else if (JSON.stringify(JSON.parse(fs.readFileSync(file,'utf8')))!==serialized) throw Error('benchmark_report_changed');
    return report;
  } finally {fs.closeSync(fd);fs.unlinkSync(lock);}
}
