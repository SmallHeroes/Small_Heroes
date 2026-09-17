'use strict';
// Offline integrity/cost/replay verification; no credentials or provider adapter.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(repo,p),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const {canonicalHash}=require(path.join(repo,'lib/canonical-json.ts'));
const {replayVisualContractAuthoringEvidence}=require(path.join(repo,'lib/visual-package/visualContractAuthoringReplayRunner.ts'));
const lifecycle=require(path.join(repo,'lib/visual-package/visualContractAuthoringLifecycle.ts'));
const output='outputs/panda-contract-authoring-20260918-01';
const logs='outputs/panda-contract-execution-20260918-01';
function inventory(root) {
  return fs.readdirSync(path.join(repo,root),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
    const p=root+'/'+e.name;
    if(e.isDirectory())return inventory(p);
    const b=fs.readFileSync(path.join(repo,p));
    return [{path:p,bytes:b.length,sha256:hash(b)}];
  });
}
async function main() {
  // If any dependency accidentally reaches a fetch boundary, fail, do not bill.
  globalThis.fetch=async()=>{throw Error('offline_verification_network_forbidden');};
  const summary=read(logs+'/stdout.json'),execution=read(logs+'/execution.json');
  const p=summary.persistence;
  const snapshot=read(p.sourceSnapshot.path),request=read(p.authoringRequest.path),receipt=read(p.authoringReceipt.path);
  assert.equal(request.digest,'1922c7d8a6bb8497e9a89f51eb6a261b30aa32703e912c7712ae680aaa4b0b62');
  assert.equal(receipt.requestDigest,request.digest);assert.equal(receipt.sourceSnapshotDigest,snapshot.digest);
  assert.equal(snapshot.digest,'36230817452cdbfd56896bd445c07a39b3b526cfe11475f3533235f2d0cb2143');
  assert.deepEqual(lifecycle.visualContractAuthoringRequestIssues({request,snapshot}),[]);
  const artifacts=inventory(output);
  for(const row of artifacts) {
    const data=read(row.path);const {digest,digestAlgorithm,...payload}=data;
    assert.equal(canonicalHash(payload),digest,row.path);
    assert.equal(path.basename(row.path),digest+'.json');
  }
  const before=read(logs+'/source-before.json'),after=read(logs+'/source-after.json');
  assert.equal(before.length,9);assert.deepEqual(after,before);assert.equal(execution.sourcePreserved,true);
  for(const row of before) {
    const file=path.join(repo,row.path),bytes=fs.readFileSync(file);
    assert.equal(hash(bytes),row.sha256);assert.equal(bytes.length,row.bytes);assert.equal(fs.statSync(file).mtimeMs,row.mtimeMs);
  }
  // Independent arithmetic, not the production cost helper.
  const round=n=>Math.round(n*1e6)/1e6,ceil=n=>Math.ceil(n*1e6)/1e6;
  let nominal=0,conservative=0;
  for(const attempt of receipt.attempts) {
    if(!attempt.usage)continue;
    const u=attempt.usage;
    const n=round(((u.inputTokens-u.cachedInputTokens-u.cacheWriteInputTokens)*4+u.cachedInputTokens*.4+u.cacheWriteInputTokens*5+u.outputTokens*20)/1e6);
    const c=ceil((u.inputTokens*5+u.outputTokens*20)/1e6*1.1);
    assert.equal(n,attempt.nominalEstimatedCostUsd);assert.equal(c,attempt.conservativeAccountedCostUsd);
    nominal+=n;conservative+=c;
  }
  assert.equal(round(nominal),receipt.nominalEstimatedCostUsd);
  assert.ok(Math.abs(conservative-receipt.conservativeAccountedCostUsd)<.000002);
  assert.ok(receipt.conservativeAccountedCostUsd<=request.costBudget.projectedMaxUsd);
  assert.ok(receipt.conservativeAccountedCostUsd<=request.costBudget.hardCeilingUsd);
  let replay=null;
  if(p.structuredDraftReplayEvidence) {
    const evidencePath=p.structuredDraftReplayEvidence.path;
    const r=await replayVisualContractAuthoringEvidence({repoRoot:repo,snapshot,request,receipt,evidence:read(evidencePath),evidencePath});
    const {harness,...checks}=r;
    assert.equal(r.providerCalls,0);assert.equal(r.exactCapturedCallSequence,true);assert.equal(r.receiptOutcomeCongruent,true);
    replay={...checks,harnessOutcome:harness.outcome};
  }
  assert.deepEqual(inventory(output),artifacts);
  const result={status:'integrity_and_cost_verified_not_product_acceptance',nativeExit:execution.nativeExit,
    authoringStatus:receipt.status,failure:receipt.failure,callCount:receipt.callCount,repairCount:receipt.repairCount,
    nominalEstimatedCostUsd:receipt.nominalEstimatedCostUsd,conservativeAccountedCostUsd:receipt.conservativeAccountedCostUsd,
    invoiceVerified:false,sourceFilesPreserved:9,artifacts,executionLogs:inventory(logs),replay,
    providerCallsThisVerification:0,candidate:p.candidate,doesNotAuthorize:receipt.doesNotAuthorize};
  if(process.argv.includes('--record')) fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
