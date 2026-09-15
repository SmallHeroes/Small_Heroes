import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { parse } from 'dotenv';
import { bindPreviewRun, previewSha, writePreviewJson } from '../lib/local-story-preview';
import { anatomyInspectionSchema } from '../lib/local-preview-quality';
import { loadOwnerDraft, draftOutputRoot } from './run-owner-book-draft';
import { EXPERIMENT_VERSION, anatomyRequest, candidateViews, compactContext, contextualRequest, mergedDecision, paidFlex } from './lib/qa-cost-experiment';

const schema=z.object({intent:z.literal('owner_approved_qa_cost_experiment'),draftConfig:z.string(),outputDir:z.string(),
  cases:z.array(z.object({pageNumber:z.number().int().min(0).max(24),expectedAnatomy:z.enum(['pass','defect'])}).strict()).length(4)}).strict();
function read(repo:string,file:string){const p=path.resolve(repo,file),rel=path.relative(repo,p);if(!rel||rel.startsWith('..')||path.isAbsolute(rel)||fs.realpathSync(p)!==p)throw Error('experiment_input_scope');return fs.readFileSync(p);}
function save(file:string,value:unknown){if(!fs.existsSync(file))writePreviewJson(file,value);else if(JSON.stringify(JSON.parse(fs.readFileSync(file,'utf8')))!==JSON.stringify(value))throw Error('experiment_saved_changed');}
export async function run(configFile:string,live=false,keyFile?:string){
  const repo=path.resolve(__dirname,'..');
  if(process.env.NODE_ENV==='production'||process.env.VERCEL||process.env.VERCEL_ENV)throw Error('experiment_local_only');
  const config=schema.parse(JSON.parse(read(repo,configFile).toString('utf8')));
  if(new Set(config.cases.map(c=>c.pageNumber)).size!==4)throw Error('experiment_duplicate_case');
  const loaded=loadOwnerDraft(repo,JSON.parse(read(repo,config.draftConfig).toString('utf8'))),{plan,story,root}=loaded;
  const out=draftOutputRoot(repo,config.outputDir);if(!path.basename(out).startsWith('qa-cost-experiment-')||out===root)throw Error('experiment_output_scope');
  const manifestBytes=read(repo,path.join(root,'manifest.json')),manifest=JSON.parse(manifestBytes.toString('utf8'));
  if(manifest.sourceSha!==story.sourceSha||manifest.planSha!==loaded.config.plan.sha||manifest.productionReady!==false)throw Error('experiment_manifest_binding');
  const originalQaBytes=read(repo,path.join(root,'qa/report.json')),originalQa=JSON.parse(originalQaBytes.toString('utf8'));
  const candidates=config.cases.map(c=>{const p=manifest.pages[c.pageNumber];if(p?.pageNumber!==c.pageNumber||p.imageName!==`page-${String(c.pageNumber).padStart(2,'0')}.png`)throw Error('experiment_candidate_binding');
    const bytes=read(repo,path.join(root,p.imageName));if(previewSha(bytes)!==p.imageSha||p.text!==(c.pageNumber===0?story.title:story.pages[c.pageNumber-1].text))throw Error('experiment_candidate_changed');return {...c,page:p,bytes};});
  const refs=['reference-1.png','reference-2.png','prop-board-reference.png'].map((n,i)=>{const bytes=read(repo,path.join(root,n));return {role:['child identity','companion identity','prop design'][i],bytes,sha:previewSha(bytes)};});
  const identities={version:EXPERIMENT_VERSION,config,sourceSha:story.sourceSha,planSha:loaded.config.plan.sha,manifestSha:previewSha(manifestBytes),originalQaSha:previewSha(originalQaBytes),
    refs:refs.map(({role,sha})=>({role,sha})),candidates:candidates.map(c=>({page:c.pageNumber,sha:c.page.imageSha,expectedAnatomy:c.expectedAnatomy})),
    codeSha:previewSha(fs.readFileSync(__filename)),builderSha:previewSha(fs.readFileSync(path.join(__dirname,'lib/qa-cost-experiment.ts'))),
    qualitySha:previewSha(fs.readFileSync(path.join(repo,'lib/local-preview-quality.ts'))),budgetUsd:8,maxCalls:12,productionReady:false};
  bindPreviewRun(out,identities);
  if(!live){console.log(JSON.stringify({status:'preflight',cases:4,maxCalls:12,budgetUsd:8,providerCalls:0}));return;}
  const lock=path.join(out,'run.lock'),fd=fs.openSync(lock,'wx');
  const results:unknown[]=[];let stopped:string|null=null;
  try {
    const key=keyFile?parse(fs.readFileSync(keyFile)).OPENAI_API_KEY?.trim():process.env.OPENAI_API_KEY?.trim();if(!key)throw Error('experiment_key_missing');
    for(const [index,c] of candidates.entries()){
      const number=String(c.pageNumber).padStart(2,'0'),views=await candidateViews(c.bytes);
      const anatomyRecord=await paidFlex(out,`p${number}-anatomy`,anatomyRequest(views),key);
      if(anatomyRecord.value.status!=='completed')throw Error('experiment_anatomy_incomplete');
      const anatomy=anatomyInspectionSchema.parse(JSON.parse(anatomyRecord.value.text));
      if(anatomy.verdict==='defect'&&!anatomy.correction.trim())throw Error('experiment_anatomy_missing_correction');
      const prior=originalQa.results.filter((r:{pageNumber:number;disposition:string})=>r.pageNumber>0&&r.pageNumber<c.pageNumber&&r.disposition==='passed').slice(-3).map((r:{pageNumber:number})=>manifest.pages[r.pageNumber]);
      const references=[...refs,...prior.map((p:{pageNumber:number;imageName:string;imageSha:string})=>{const bytes=read(repo,path.join(root,p.imageName));if(previewSha(bytes)!==p.imageSha)throw Error('experiment_prior_changed');return {role:`previous diagnostically passed page ${p.pageNumber}; comparison only, not a new canonical design`,bytes,sha:p.imageSha};})];
      for(const arm of (index%2?['compact','control']:['control','compact']) as ('control'|'compact')[]){
        const context=arm==='control'?{plan,pageNumber:c.pageNumber,text:c.page.text,priorPages:prior,calibrationStatus:'not_established',purpose:'diagnostic_only'}:compactContext(plan,c.pageNumber,c.page.text,prior);
        const built=contextualRequest({arm,views,references,anatomy,candidateSha:c.page.imageSha,context});
        save(path.join(out,`p${number}-${arm}.input.json`),{arm,context,contextSha:built.contextSha,candidateSha:c.page.imageSha,referenceShas:references.map(r=>r.sha),requestSha:previewSha(JSON.stringify(built.request))});
        const response=await paidFlex(out,`p${number}-${arm}`,built.request,key);
        const result=response.value.status==='completed'?{pageNumber:c.pageNumber,arm,...mergedDecision(JSON.parse(response.value.text),anatomy,c.page.imageSha,built.contextSha),expectedAnatomy:c.expectedAnatomy}:
          {pageNumber:c.pageNumber,arm,disposition:'held_incomplete',expectedAnatomy:c.expectedAnatomy};
        save(path.join(out,`p${number}-${arm}.decision.json`),result);results.push(result);
        console.log(JSON.stringify({page:c.pageNumber,arm,disposition:result.disposition,blindAnatomy:anatomy.verdict}));
      }
    }
  }catch(error){stopped=error instanceof Error&&/^[a-z][a-z0-9_]{1,100}$/.test(error.message)?error.message:'experiment_transport_or_schema_stopped_no_retry';console.log(stopped);}
  finally{fs.closeSync(fd);fs.unlinkSync(lock);}
  save(path.join(out,'report.json'),{version:EXPERIMENT_VERSION,productionReady:false,results,stopped});
  if(stopped)process.exitCode=1;
}
if(require.main===module){const keyIndex=process.argv.indexOf('--key-env-file');run(process.argv[2],process.argv.includes('--live'),keyIndex<0?undefined:process.argv[keyIndex+1]).catch(()=>{console.error('qa_cost_experiment_failed');process.exitCode=1});}
