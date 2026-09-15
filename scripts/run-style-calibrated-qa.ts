import fs from 'node:fs';
import path from 'node:path';
import { parse as parseEnv } from 'dotenv';
import { bindPreviewRun, previewSha, writePreviewJson } from '../lib/local-story-preview';
import { comparisonModels, comparisonSummary, COMPARISON_INSTRUCTION, STYLE_TOLERANCE, type ComparisonLabel } from '../lib/visual-qa-comparison';
import { inspectComparison } from './lib/visual-qa-comparison';

// A small preregistered diagnostic, not a new source of product acceptance.
const refs = [
  { file:'r3b1b-dini-low-book-20260912/page-04.png', family:4, verdict:'pass' as const,
    explanation:'The child has simplified rounded fingers on naturally hanging hands. Lack of nail detail is normal watercolor simplification; the hands attach coherently to the forearms.' },
  { file:'local-story-preview-dini-20260915/page-06.png', family:6, verdict:'pass' as const,
    explanation:'The child is viewed from behind with a hand around the cart bar. Several fingers overlap or are hidden by the grip; shoes hide toes. These are ordinary occlusion and stylization, not missing anatomy.' },
];
const cases = [
  { id:'target-a', file:'local-story-preview-dini-20260915/page-01.png', family:1, expected:'defect' as const, authority:'owner' as const },
  { id:'target-b', file:'local-story-preview-dini-20260915/repair-01/page-01.png', family:1, expected:'pass' as const, authority:'provisional' as const },
  { id:'target-c', file:'local-story-preview-dini-20260915/page-08.png', family:8, expected:'pass' as const, authority:'provisional' as const },
  { id:'target-d', file:'local-story-preview-dini-20260915/page-12.png', family:12, expected:'pass' as const, authority:'provisional' as const },
];
async function main() {
  if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === 'production') throw Error('calibration_local_only');
  const mode = process.argv[3]; if (mode !== undefined && mode !== '--reconcile-only') throw Error('calibration_invalid_mode');
  const outputs = fs.realpathSync(path.resolve(__dirname,'../outputs')), root = path.join(outputs,'visual-qa-style-calibration-20260915');
  if (fs.existsSync(root) && fs.lstatSync(root).isSymbolicLink()) throw Error('calibration_root_link');
  const load = (file:string) => { const real = fs.realpathSync(path.join(outputs,file)), rel=path.relative(outputs,real);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw Error('calibration_path_escape');
    const bytes=fs.readFileSync(real); return { bytes, sha:previewSha(bytes) }; };
  const examples=refs.map(r=>({...r,...load(r.file)})), targets=cases.map(c=>({...c,...load(c.file)}));
  if (targets.some(t=>examples.some(e=>e.sha===t.sha || e.family===t.family))) throw Error('calibration_example_leakage');
  const arms=['baseline','rubric','examples'] as const;
  bindPreviewRun(root,{version:'style-calibration/v1',requestedModel:comparisonModels.qwen,transport:'official_async',maxCalls:12,budgetUsd:3,
    instructions:{baseline:previewSha(COMPARISON_INSTRUCTION),rubric:previewSha(STYLE_TOLERANCE)},
    examples:examples.map(({bytes,...e})=>e),targets:targets.map(({bytes,...t})=>t),arms,
    limitations:'Only one known anatomy defect, related target-a/b pair. All normal labels and exemplar explanations are implementer-provisional, not independently validated. No general accuracy or release authority.'});
  const key=process.env.REPLICATE_API_TOKEN || parseEnv(fs.readFileSync(process.argv[2])).REPLICATE_API_TOKEN;
  if(!key?.trim()) throw Error('calibration_existing_key_missing');
  const lock=path.join(root,'run.lock'),fd=fs.openSync(lock,'wx');
  try {
    const results: Array<{ arm: typeof arms[number]; id: string; sha: string; label: ComparisonLabel; observed: 'pass'|'defect'|'uncertain'|'unknown'; renderAuthorized: false }> = [];
    for(const arm of arms) for(const t of targets) {
      const step=`${arm}-${t.id}`;
      if(mode && !fs.existsSync(path.join(root,'steps',`${step}.claim.json`))) continue;
      const calibration=arm==='baseline'?undefined:{mode:arm,examples:arm==='examples'?examples:[]};
      let result;
      try { result=await inspectComparison({root,step,model:'qwen',bytes:t.bytes,sha:t.sha,key,transportMode:'official_async',calibration,reconcileOnly:Boolean(mode)}); }
      catch { result={observed:'unknown' as const,reason:'transport_or_binding_unresolved',renderAuthorized:false as const}; }
      results.push({arm,id:t.id,sha:t.sha,label:{expected:t.expected,authority:t.authority},...result});
      console.log(JSON.stringify({arm,id:t.id,observed:result.observed}));
    }
    if(mode) return;
    const report={version:'style-calibration/v1',renderAuthorized:false,generalAccuracyProven:false,independentQa:'pending',
      summaries:arms.map(arm=>({arm,...comparisonSummary(results.filter(r=>r.arm===arm).map(({label,observed})=>({label,observed})))})),results};
    const file=path.join(root,'report.json');
    if(!fs.existsSync(file)) writePreviewJson(file,report);
    else if(JSON.stringify(JSON.parse(fs.readFileSync(file,'utf8')))!==JSON.stringify(report)) throw Error('calibration_report_changed');
  } finally {fs.closeSync(fd);fs.unlinkSync(lock);}
}
main().catch(()=>{console.error('style_calibration_held_see_receipts');process.exitCode=1;});
