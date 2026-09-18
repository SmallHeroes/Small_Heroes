'use strict';
// Evidence wrapper around the existing CLI, not an image API implementation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn,execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../../../../..');
const selected=process.argv[3]==='--selected-props';
const output=selected?'outputs/panda-five-page-selected-sample-20260919':'outputs/panda-five-page-sample-20260919';
const logs=path.join(repo,selected?'outputs/panda-five-page-selected-execution-20260919':'outputs/panda-five-page-execution-20260919');
const revision='story-pipeline/04_approved_story_sources/accepted/panda_anat_adventure/revisions/407c34c88fd6c5a851ed253c0534f01332a599222a2d6a6ecff967e65b81d160';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const write=(name,value)=>fs.writeFileSync(path.join(logs,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
function observe(){
  const paid=JSON.parse(fs.readFileSync(path.join(repo,'outputs/panda-contract-execution-20260918-01/stdout.json'),'utf8'));
  const files=[...fs.readdirSync(path.join(repo,revision)).map(n=>revision+'/'+n),
    ...Object.values(paid.persistence).filter(v=>v&&typeof v.path==='string').map(v=>v.path)];
  if(selected){
    const walk=rel=>{for(const entry of fs.readdirSync(path.join(repo,rel),{withFileTypes:true})){
      const file=rel+'/'+entry.name;if(entry.isDirectory())walk(file);else if(entry.isFile())files.push(file);
    }};
    walk('outputs/panda-five-page-sample-20260919');
    walk('outputs/panda-five-page-execution-20260919');
  }
  return files.sort().map(file=>{const b=fs.readFileSync(path.join(repo,file)),s=fs.statSync(path.join(repo,file));
    return {file,sha256:sha(b),bytes:b.length,mtimeMs:s.mtimeMs};});
}
function main(){
  if(process.argv.length!==(selected?4:3))throw Error('credential_file_argument_required');
  if(fs.existsSync(logs)||fs.existsSync(path.join(repo,output)))throw Error('execution_exists_no_automatic_retry');
  const state=execFileSync('git',['status','--porcelain'],{cwd:repo,encoding:'utf8',windowsHide:true});
  if(state.trim())throw Error('clean_committed_implementation_required');
  const before=observe(),head=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8',windowsHide:true}).trim();
  const configFile=selected?'outputs/panda-five-page-selected-input-20260919/config.json':'outputs/panda-five-page-input-20260919/config.json';
  const config=JSON.parse(fs.readFileSync(path.join(repo,configFile),'utf8'));
  if(selected){
    require('../../../../../scripts/shims/register-server-only.cjs');require('tsx/cjs');
    const {previewAccountedUsd}=require('../../../../../lib/local-story-preview.ts');
    const old=path.join(repo,'outputs/panda-five-page-sample-20260919');
    const spent=previewAccountedUsd(path.join(old,'steps'))+previewAccountedUsd(path.join(old,'qa/steps'));
    if(spent+config.imageBudgetUsd+config.qaBudgetUsd>9.5+1e-8||config.sampleRepairOnce||config.sampleInitialImages)throw Error('aggregate_spend_or_retry_fence');
  }
  const args=['--import','tsx','--require','./scripts/shims/register-server-only.cjs','scripts/run-owner-book-draft.ts',
    configFile,'--sample','--key-env-file',process.argv[2]];
  fs.mkdirSync(logs,{recursive:false});
  write('before.json',before);write('invocation.json',{head,executable:process.execPath,args,startedAt:new Date().toISOString(),
    scope:'owner-requested local unaccepted sample; not canonical candidate promotion',pages:[1,2,3,4,5],
    imageBudgetUsd:config.imageBudgetUsd,qaBudgetUsd:config.qaBudgetUsd,aggregateFenceUsd:9.5});
  const child=spawn(process.execPath,args,{cwd:repo,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';
  const sanitize=s=>s.replace(/sk-[A-Za-z0-9_-]+/g,'[REDACTED]');
  child.stdout.on('data',b=>{const s=sanitize(b.toString());stdout+=s;process.stdout.write(s);});
  child.stderr.on('data',b=>{const s=sanitize(b.toString());stderr+=s;process.stderr.write(s);});
  let launchError=false;
  child.on('error',()=>{launchError=true;});
  child.on('close',(nativeExit,signal)=>{
    write('stdout.txt',stdout);write('stderr.txt',stderr);
    const after=observe();write('after.json',after);
    const summary={nativeExit,signal,launchError,completedAt:new Date().toISOString(),
      originalSourceAndPaidArtifactsPreserved:JSON.stringify(before)===JSON.stringify(after)};
    write('execution.json',summary);console.log(JSON.stringify(summary));
    process.exitCode=nativeExit===0&&summary.originalSourceAndPaidArtifactsPreserved?0:nativeExit===2?2:1;
  });
}
try{main();}catch(error){console.error(/^[a-z_]+$/.test(error.message)?error.message:'sample_execution_wrapper_failed');process.exitCode=1;}
