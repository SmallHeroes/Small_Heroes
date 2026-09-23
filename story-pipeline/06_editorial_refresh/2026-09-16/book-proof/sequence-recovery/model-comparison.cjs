'use strict';
// Evidence harness only. Paid work goes through the existing owner CLI and shared QA.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
require('../../../../../scripts/shims/register-server-only.cjs');require('tsx/cjs');
const {previewSha,previewAccountedUsd,previewStory}=require('../../../../../lib/local-story-preview.ts');
const {loadOwnerDraft,ownerDraftPagePrompt}=require('../../../../../scripts/run-owner-book-draft.ts');
const {sequencePagePacket,sequenceRenderPrompt}=require('../../../../../lib/local-book-sequence.ts');
const {qualityDisposition}=require('../../../../../lib/local-preview-quality.ts');
const repo=path.resolve(__dirname,'../../../../..');
const input='outputs/panda-sunburst-comparison-input-20260923';
const output='outputs/panda-sunburst-comparison-sample-20260923';
const logs='outputs/panda-sunburst-comparison-execution-20260923';
const baseline='outputs/panda-sequence-pair-sample-20260923';
const previous=['outputs/panda-five-page-sample-20260919','outputs/panda-five-page-selected-sample-20260919',
  baseline,'outputs/panda-sequence-pair-repair-sample-20260923'];
const model='gpt-image-2.5-sunburst';
const read=f=>JSON.parse(fs.readFileSync(path.join(repo,f),'utf8'));
const write=(f,value)=>fs.writeFileSync(path.join(repo,f),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8',windowsHide:true}).trim();
const accounted=root=>previewAccountedUsd(path.join(repo,root,'steps'))+previewAccountedUsd(path.join(repo,root,'qa/steps'));
function cost(){const rows=previous.map(root=>({root,accountedUpperUsd:accounted(root)}));
  const prior=rows.reduce((s,r)=>s+r.accountedUpperUsd,0);assert(prior+2.8<=9.5+1e-8,'aggregate_fence');
  return {rows,priorAccountedUpperUsd:prior,imageCapUsd:1,qaCapUsd:1.8,aggregateFenceUsd:9.5,maximumWithNewCapsUsd:prior+2.8};}
function expected(){return {...read('outputs/panda-sequence-pair-input-20260923/config.json'),
  imageModel:model,outputDir:output,imageBudgetUsd:1,qaBudgetUsd:1.8};}
function verifyInput(){const config=read(input+'/config.json');assert.deepEqual(config,expected());
  const loaded=loadOwnerDraft(repo,config);assert.equal(loaded.imageModel,model);
  const packet=sequencePagePacket(loaded.sequence,loaded.plan,1,[]);
  const prompt=sequenceRenderPrompt(ownerDraftPagePrompt(loaded.plan,1,loaded.story.pages[0].text,
    config.childAge,config.gender,config.companionDescription),packet,null);
  assert.equal(prompt,read(baseline+'/page-01.request.json').prompt,'baseline_prompt_changed');
  return loaded;}
function snapshot(){
  const files=new Set(require('./measure-pair.cjs').observe().map(r=>r.file));
  function walk(rel){for(const e of fs.readdirSync(path.join(repo,rel),{withFileTypes:true})){
    const f=rel+'/'+e.name;if(e.isDirectory())walk(f);else {assert(e.isFile(),'preservation_alias');files.add(f);}}}
  for(const stem of ['panda-sequence-pair','panda-sequence-pair-repair'])
    for(const kind of ['input','sample','execution'])walk('outputs/'+stem+'-'+kind+'-20260923');
  return [...files].sort().map(file=>{const s=fs.statSync(path.join(repo,file));return {file,
    sha256:previewSha(fs.readFileSync(path.join(repo,file))),bytes:s.size,mtimeMs:s.mtimeMs};});
}
async function command(executable,args,stem,env=process.env){
  const child=spawn(executable,args,{cwd:repo,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',launchError=false;child.stdout.on('data',b=>stdout+=b.toString());child.stderr.on('data',b=>stderr+=b.toString());
  child.on('error',()=>{launchError=true;});
  return new Promise(resolve=>child.on('close',(nativeExit,signal)=>{
    const redact=s=>s.replace(/sk-[A-Za-z0-9_-]+/g,'[REDACTED]');
    write(stem+'.stdout.txt',redact(stdout));write(stem+'.stderr.txt',redact(stderr));
    const r={nativeExit,signal,launchError,completedAt:new Date().toISOString()};write(stem+'.json',r);resolve(r);
  }));
}
async function main(){
  const mode=process.argv[2];
  if(mode==='--prepare'){
    globalThis.fetch=()=>{throw Error('offline_provider_forbidden');};
    assert(!fs.existsSync(path.join(repo,output))&&!fs.existsSync(path.join(repo,logs)),'new_roots_required');
    if(!fs.existsSync(path.join(repo,input))){fs.mkdirSync(path.join(repo,input));write(input+'/config.json',expected());}
    verifyInput();console.log(JSON.stringify({status:'prepared',model,baselinePromptIdentical:true,cost:cost(),preservedFiles:snapshot().length,providerCalls:0}));return;
  }
  if(mode==='--check'){
    const result=await command('cmd.exe',['/d','/s','/c','npm run check'],input+'/full-check');
    console.log(JSON.stringify(result));process.exitCode=result.nativeExit===0?0:1;return;
  }
  if(mode==='--run'){
    assert(process.argv.length===4&&process.argv[3],'key_file_required');
    assert(!git('status','--porcelain'),'clean_commit_required');
    assert(!fs.existsSync(path.join(repo,output))&&!fs.existsSync(path.join(repo,logs)),'no_automatic_retry');
    verifyInput();const before=snapshot(),budget=cost();
    const keyFile=process.argv[3];assert(require('dotenv').parse(fs.readFileSync(keyFile)).OPENAI_API_KEY?.trim(),'existing_key_missing');
    fs.mkdirSync(path.join(repo,logs));write(logs+'/before.json',before);
    const args=['--import','tsx','--require','./scripts/shims/register-server-only.cjs','scripts/run-owner-book-draft.ts',input+'/config.json','--sample','--key-env-file',keyFile];
    write(logs+'/invocation.json',{head:git('rev-parse','HEAD'),args,startedAt:new Date().toISOString(),budget,
      configSha:previewSha(fs.readFileSync(path.join(repo,input,'config.json'))),model,scope:'one model-only diagnostic pair; no repair or acceptance'});
    const env={...process.env};delete env.OPENAI_API_KEY;
    const execution=await command(process.execPath,args,logs+'/native',env);
    const after=snapshot();write(logs+'/after.json',after);
    const result={...execution,preserved:JSON.stringify(before)===JSON.stringify(after),preservedFiles:before.length,
      newAccountedUpperUsd:accounted(output),aggregateAccountedUpperUsd:budget.priorAccountedUpperUsd+accounted(output),invoiceVerified:false};
    write(logs+'/execution.json',result);console.log(JSON.stringify(result));
    process.exitCode=result.preserved&&result.aggregateAccountedUpperUsd<=9.5?(execution.nativeExit===0?0:execution.nativeExit===2?2:1):1;return;
  }
  if(mode==='--report'){
    globalThis.fetch=()=>{throw Error('offline_provider_forbidden');};
    const {config,story,plan,sequence}=verifyInput(),execution=read(logs+'/execution.json');
    assert(execution.preserved);assert.deepEqual(snapshot(),read(logs+'/before.json'));assert(!fs.existsSync(path.join(repo,output,'run.lock')));
    assert.deepEqual(read(output+'/identity.json').config,config);assert.equal(read(output+'/identity.json').imageModel,model);
    const manifest=read(output+'/sample-manifest.json');assert.deepEqual(manifest.samplePages,[1,2]);
    // Verify actual request bytes even when provider/QA failure left no review history.
    const firstRequest=read(output+'/page-01.request.json'),baselineRequest=read(baseline+'/page-01.request.json');
    assert.equal(firstRequest.prompt,baselineRequest.prompt);assert.deepEqual(firstRequest.references,baselineRequest.references);
    for(const [i,name] of ['reference-1.png','reference-2.png','prop-reference-01.png'].entries())
      assert.equal(previewSha(fs.readFileSync(path.join(repo,output,name))),firstRequest.references[i]);
    const completed=[];
    for(const row of manifest.results){
      if(row.history?.length){assert.equal(row.history.length,1);const {candidate,review}=row.history[0];
        assert.equal(previewSha(fs.readFileSync(path.join(repo,output,candidate.imageName))),candidate.imageSha);
        const decision=qualityDisposition(review,candidate.imageSha,row.contextSha);
        assert.equal(row.status,decision.disposition==='repair'?'held_repair_limit':decision.disposition);
        const stem=candidate.imageName.replace('.png',''),request=read(output+'/'+stem+'.request.json');
        const packet=sequencePagePacket(sequence,plan,row.pageNumber,completed);assert.deepEqual(request.sequence,packet);
        const prompt=sequenceRenderPrompt(ownerDraftPagePrompt(plan,row.pageNumber,story.pages[row.pageNumber-1].text,
          config.childAge,config.gender,config.companionDescription),packet,packet.predecessor?4:null);
        assert.equal(request.prompt,prompt);
        const refs=['reference-1.png','reference-2.png','prop-reference-0'+row.pageNumber+'.png',...(packet.predecessor?[packet.predecessor.imageName]:[])];
        assert.deepEqual(request.references,refs.map(f=>previewSha(fs.readFileSync(path.join(repo,output,f)))));
        if(row.pageNumber===1)assert.deepEqual(request.references,read(baseline+'/page-01.request.json').references);
        const record=read(output+'/steps/'+stem+'.result.json');assert.equal(record.value.model,model);assert.equal(record.value.fallbackUsed,false);
        assert.equal(record.fingerprint,previewSha(JSON.stringify({version:'owner-book-draft/v1',model,quality:'low',size:'1024x1536',prompt,refs:request.references})));
        const raw=JSON.parse(read(output+'/qa/steps/'+stem.replace('page-','qa-')+'.result.json').value.text);
        const anatomy=JSON.parse(read(output+'/qa/steps/'+stem.replace('page-','qa-')+'-anatomy.result.json').value.text);
        if(anatomy.verdict!=='pass')Object.assign(raw.checks.find(c=>c.category==='anatomy'),{verdict:anatomy.verdict,observation:anatomy.observation,correction:anatomy.correction});
        assert.deepEqual(review,raw);
      }completed.push(row);
    }
    const steps=[];
    for(const kind of ['image','qa']){const rel=output+(kind==='image'?'/steps':'/qa/steps');if(!fs.existsSync(path.join(repo,rel)))continue;
      for(const f of fs.readdirSync(path.join(repo,rel)).filter(f=>f.endsWith('.claim.json'))){
        const claim=read(rel+'/'+f),rf=rel+'/'+f.replace('.claim.json','.result.json');
        const result=fs.existsSync(path.join(repo,rf))?read(rf):null;let estimate=null;
        if(result){assert.equal(result.fingerprint,claim.fingerprint);const u=result.usage;
          const valid=xs=>xs.every(x=>Number.isSafeInteger(x)&&x>=0);
          if(kind==='image'&&result.value.model===model){const t=u?.input_tokens_details?.text_tokens,i=u?.input_tokens_details?.image_tokens,o=u?.output_tokens;
            if(valid([t,i,o])&&t+i===u.input_tokens)estimate=(t*5+i*8+o*30)/1e6;
          }else if(kind==='qa'&&/^gpt-5\.5(?:-|$)/.test(result.value.model)&&result.value.serviceTier==='flex'){
            const i=u?.input_tokens,c=u?.input_tokens_details?.cached_tokens,o=u?.output_tokens;
            if(valid([i,c,o])&&c<=i&&i<272000)estimate=((i-c)*2.5+c*.25+o*15)/1e6;
          }
        }
        steps.push({kind,step:f.replace('.claim.json',''),model:result?.value?.model??null,known:Boolean(result),usage:result?.usage??null,
          nominalUsageEstimateUsd:estimate,unknownReservationUsd:result?0:claim.reserveUsd});
      }
    }
    const report={model,quality:'low',status:manifest.status,baselinePromptAndReferencesIdentical:true,execution,
      pages:manifest.results,unassessed:manifest.unassessed,steps,knownUsageEstimateUsd:steps.reduce((s,r)=>s+(r.nominalUsageEstimateUsd??0),0),
      unpricedSteps:steps.filter(r=>r.nominalUsageEstimateUsd===null).map(r=>r.step),invoiceVerified:false,
      pricing:{checkedDate:'2026-09-23',source:'https://developers.openai.com/api/docs/pricing',imageInputCacheDiscountNotApplied:true},productionReady:false,productAcceptance:'pending'};
    if(process.argv.includes('--write')){
      write(output+'/comparison.json',report);
      const panels=[{label:'Image 2 LOW · previous HELD baseline',src:'../panda-sequence-pair-sample-20260923/page-01.png'},
        ...manifest.results.filter(r=>r.candidate).map(r=>({label:`Sunburst LOW · page ${r.pageNumber} · ${r.status}`,src:r.candidate.imageName}))];
      const html=panels.map(p=>`<figure><figcaption>${p.label}</figcaption><img src="${p.src}" alt="${p.label}"></figure>`).join('');
      write(output+'/index.html',`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>השוואת מודל איור</title><style>body{margin:24px;background:#f4f0e8;color:#24372f;font:18px Arial}main{display:flex;flex-wrap:wrap;gap:20px}figure{margin:0;flex:1 1 420px}img{width:100%;max-height:85vh;object-fit:contain}figcaption{padding:12px;direction:ltr}pre{direction:ltr;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>השוואת מודל איור · הפנדה</h1><p>אותם פרומפטים, עוגנים ואיכות LOW. בדיקה מקומית, לא אישור מוצר. מצב: ${report.status}.</p><p>אומדן שימוש בסבב $${report.knownUsageEstimateUsd.toFixed(4)}; לא חשבונית. עמודים שלא הושלמו: ${report.unassessed.join(', ')||'אין'}.</p><main>${html}</main><details><summary>ראיות QA ועלות</summary><pre>${JSON.stringify(report,null,2).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre></details></html>`);
    }
    console.log(JSON.stringify({status:report.status,pages:manifest.results.map(r=>({page:r.pageNumber,status:r.status,error:r.error})),
      costUsd:report.knownUsageEstimateUsd,unpricedSteps:report.unpricedSteps,execution,providerCallsThisReport:0}));return;
  }
  throw Error('explicit_mode_required');
}
if(require.main===module)main().catch(()=>{console.error('model_comparison_failed_inspect_saved_evidence');process.exitCode=1;});
