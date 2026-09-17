'use strict';
// One-use execution harness, not a production entrypoint or an authority grant.
// Writes are generated execution logs/snapshots only. Never persists credentials.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '../../../../..');
const logs = path.join(repo, 'outputs/panda-contract-execution-20260918-01');
const out = 'outputs/panda-contract-authoring-20260918-01';
const source = 'story-pipeline/04_approved_story_sources/accepted/panda_anat_adventure/revisions/407c34c88fd6c5a851ed253c0534f01332a599222a2d6a6ecff967e65b81d160';
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
function snapshot() {
  return fs.readdirSync(path.join(repo,source)).sort().map(name => {
    const p=path.join(repo,source,name),s=fs.statSync(p);
    if(!s.isFile()) throw Error('unexpected_source_directory');
    return {path:source+'/'+name,bytes:s.size,sha256:hash(fs.readFileSync(p)),mtimeMs:s.mtimeMs};
  });
}
function write(name, value) {
  fs.writeFileSync(path.join(logs,name), typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
}
function main() {
  if(process.argv.length!==3) throw Error('credential_file_argument_required');
  if(!fs.existsSync(path.join(repo,'scripts/visual-contract-authoring.cjs'))) throw Error('repo_anchor_invalid');
  if(fs.existsSync(logs)||fs.existsSync(path.join(repo,out))) throw Error('execution_root_already_exists_no_retry');
  const before=snapshot();
  // dotenv.parse does not modify the current process environment.
  const key=require('dotenv').parse(fs.readFileSync(process.argv[2])).OPENAI_API_KEY;
  if(!key || !key.trim()) throw Error('existing_credential_unavailable');
  fs.mkdirSync(logs,{recursive:true});
  write('source-before.json',before);
  const args=['scripts/visual-contract-authoring.cjs','live','--repo-root',repo,
    '--source-authority-request','story-pipeline/06_editorial_refresh/2026-09-16/book-proof/visual-acceptance/source-authority-request.json',
    '--snapshot','outputs/panda-contract-source-20260917/source-snapshots/36230817452cdbfd56896bd445c07a39b3b526cfe11475f3533235f2d0cb2143.json',
    '--request','story-pipeline/06_editorial_refresh/2026-09-16/book-proof/contract-authoring/request.json',
    '--out',out];
  const startedAt=new Date().toISOString();
  write('invocation.json',{startedAt,executable:process.execPath,args,credential:'existing key injected in memory; value omitted'});
  console.log('Canonical authoring dispatched; no images; bounded existing policy.');
  const result=spawnSync(process.execPath,args,{cwd:repo,env:{...process.env,OPENAI_API_KEY:key},encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true});
  const sanitize=value=>(value||'').split(key).join('[REDACTED]');
  write('stdout.json',sanitize(result.stdout));
  write('stderr.txt',sanitize(result.stderr));
  const after=snapshot();write('source-after.json',after);
  const summary={startedAt,completedAt:new Date().toISOString(),nativeExit:result.status,signal:result.signal,
    processError:result.error?'child_process_error':null,sourcePreserved:JSON.stringify(before)===JSON.stringify(after)};
  write('execution.json',summary);console.log(JSON.stringify(summary));
  process.exitCode=result.status===0&&summary.sourcePreserved?0:1;
}
try { main(); } catch { console.error('panda_contract_execution_harness_failed');process.exitCode=1; }
