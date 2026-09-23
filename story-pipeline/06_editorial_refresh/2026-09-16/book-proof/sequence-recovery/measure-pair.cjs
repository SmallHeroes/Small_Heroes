'use strict';
// One bounded evidence harness around the existing owner CLI; no provider implementation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
require('../../../../../scripts/shims/register-server-only.cjs');require('tsx/cjs');
const {previewAccountedUsd,previewSha}=require('../../../../../lib/local-story-preview.ts');
const {loadOwnerDraft}=require('../../../../../scripts/run-owner-book-draft.ts');
const repo=path.resolve(__dirname,'../../../../..');
const input='outputs/panda-sequence-pair-input-20260923';
const output='outputs/panda-sequence-pair-sample-20260923';
const logs='outputs/panda-sequence-pair-execution-20260923';
const predecessors=['outputs/panda-five-page-sample-20260919','outputs/panda-five-page-selected-sample-20260919'];
const baselineFile='outputs/panda-book-sequence-input-20260919/config.json';
const read=rel=>JSON.parse(fs.readFileSync(path.join(repo,rel),'utf8'));
const write=(rel,value)=>fs.writeFileSync(path.join(repo,rel),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8',windowsHide:true}).trim();
function accounting(){
  const roots=predecessors.map(root=>({root,accountedUpperUsd:previewAccountedUsd(path.join(repo,root,'steps'))+previewAccountedUsd(path.join(repo,root,'qa/steps'))}));
  const prior=roots.reduce((sum,row)=>sum+row.accountedUpperUsd,0);
  assert(prior+4<=9.5+1e-8,'aggregate_fence');
  return {roots,priorAccountedUpperUsd:prior,newImageCapUsd:1,newQaCapUsd:3,aggregateFenceUsd:9.5,
    priorPlusNewCapsUsd:prior+4,invoiceVerified:false,unknownReservationsRetained:true};
}
function expectedConfig(){return {...read(baselineFile),outputDir:output,samplePages:[1,2],imageBudgetUsd:1,qaBudgetUsd:3};}
function observe(){
  const files=new Set();
  for(const root of ['outputs/panda-five-page-execution-20260919','outputs/panda-five-page-selected-execution-20260919'])
    for(const row of read(root+'/after.json'))files.add(row.file);
  function walk(rel){for(const entry of fs.readdirSync(path.join(repo,rel),{withFileTypes:true})){
    const file=rel+'/'+entry.name;if(entry.isDirectory())walk(file);else if(entry.isFile())files.add(file);else throw Error('preservation_alias');
  }}
  for(const root of [...predecessors,'outputs/panda-five-page-input-20260919','outputs/panda-five-page-selected-input-20260919',
    'outputs/panda-book-sequence-input-20260919','outputs/panda-five-page-execution-20260919','outputs/panda-five-page-selected-execution-20260919'])walk(root);
  for(const asset of ['story','plan','childAnchor','companionAnchor','propBoard','sequence'])files.add(expectedConfig()[asset].file);
  return [...files].sort().map(file=>{const b=fs.readFileSync(path.join(repo,file)),s=fs.statSync(path.join(repo,file));return {file,sha256:previewSha(b),bytes:b.length,mtimeMs:s.mtimeMs};});
}
function prepare(){
  globalThis.fetch=()=>{throw Error('offline_provider_forbidden');};
  const config=expectedConfig();loadOwnerDraft(repo,config);const cost=accounting();
  assert(!fs.existsSync(path.join(repo,output)));assert(!fs.existsSync(path.join(repo,logs)));
  if(!fs.existsSync(path.join(repo,input))){fs.mkdirSync(path.join(repo,input));write(input+'/config.json',config);}
  assert.deepEqual(read(input+'/config.json'),config);
  console.log(JSON.stringify({status:'prepared_offline',configSha:previewSha(fs.readFileSync(path.join(repo,input,'config.json'))),cost,providerCalls:0}));
}
function run(keyFile){
  assert(keyFile&&process.argv.length===4,'key_file_argument_required');
  assert(!git('status','--porcelain'),'clean_commit_required');
  assert(!fs.existsSync(path.join(repo,output))&&!fs.existsSync(path.join(repo,logs)),'no_automatic_retry');
  const config=read(input+'/config.json');assert.deepEqual(config,expectedConfig());loadOwnerDraft(repo,config);
  const cost=accounting(),before=observe(),head=git('rev-parse','HEAD');
  // Validate presence only; never print or persist credentials. Existing CLI reads the same file.
  assert(require('dotenv').parse(fs.readFileSync(keyFile)).OPENAI_API_KEY?.trim(),'existing_key_missing');
  const args=['--import','tsx','--require','./scripts/shims/register-server-only.cjs','scripts/run-owner-book-draft.ts',input+'/config.json','--sample','--key-env-file',keyFile];
  fs.mkdirSync(path.join(repo,logs));write(logs+'/before.json',before);
  write(logs+'/invocation.json',{head,args,startedAt:new Date().toISOString(),configSha:previewSha(fs.readFileSync(path.join(repo,input,'config.json'))),cost,
    scope:'two-page owner-authorized diagnostic; not release or product acceptance; no repairs'});
  // Force the specifically supplied existing file, not an ambient credential override.
  const env={...process.env};delete env.OPENAI_API_KEY;
  const child=spawn(process.execPath,args,{cwd:repo,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',launchError=false;
  child.stdout.on('data',b=>{stdout+=b.toString();});child.stderr.on('data',b=>{stderr+=b.toString();});
  child.on('error',()=>{launchError=true;});
  child.on('close',(nativeExit,signal)=>{
    const sanitize=s=>s.replace(/sk-[A-Za-z0-9_-]+/g,'[REDACTED]');
    write(logs+'/stdout.txt',sanitize(stdout));write(logs+'/stderr.txt',sanitize(stderr));
    const after=observe();write(logs+'/after.json',after);
    const own=previewAccountedUsd(path.join(repo,output,'steps'))+previewAccountedUsd(path.join(repo,output,'qa/steps'));
    const summary={nativeExit,signal,launchError,completedAt:new Date().toISOString(),preserved:JSON.stringify(before)===JSON.stringify(after),
      newAccountedUpperUsd:own,aggregateAccountedUpperUsd:cost.priorAccountedUpperUsd+own,invoiceVerified:false};
    write(logs+'/execution.json',summary);console.log(JSON.stringify(summary));
    process.exitCode=summary.preserved&&summary.aggregateAccountedUpperUsd<=9.5?(nativeExit===0?0:nativeExit===2?2:1):1;
  });
}
if(require.main===module){try{if(process.argv[2]==='--prepare')prepare();else if(process.argv[2]==='--run')run(process.argv[3]);else throw Error('explicit_mode_required');}
catch(error){console.error(/^[a-z_]+$/.test(error.message)?error.message:'pair_harness_validation_failed');process.exitCode=1;}}
module.exports={accounting,expectedConfig,observe};
