'use strict';
// Read-only structural/preservation witness. Synthetic reviews below are size probes,
// NOT visual evidence, approvals, persisted receipts, or permission to render.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {previewSha}=require('../../../../../lib/local-story-preview.ts');
const {QUALITY_CATEGORIES}=require('../../../../../lib/local-preview-quality.ts');
const {sequencePagePacket,sequenceRenderPrompt}=require('../../../../../lib/local-book-sequence.ts');
const {loadOwnerDraft,ownerDraftPagePrompt,selectedDraftQaContext}=require('../../../../../scripts/run-owner-book-draft.ts');
const repo=path.resolve(__dirname,'../../../../..');
globalThis.fetch=()=>{throw Error('offline_provider_forbidden');};
const config=JSON.parse(fs.readFileSync(path.join(repo,'outputs/panda-book-sequence-input-20260919/config.json'),'utf8'));
const {sequence,plan,story}=loadOwnerDraft(repo,config);
assert(sequence);
const prior=[], sizes=[];
for(let n=1;n<=story.pages.length;n++){
  const packet=sequencePagePacket(sequence,plan,n,prior);
  const base=ownerDraftPagePrompt(plan,n,story.pages[n-1].text,config.childAge,config.gender,config.companionDescription);
  const prompt=sequenceRenderPrompt(base,packet,packet.predecessor?(plan.pages[n].props.length?4:3):null);
  const context={selectedPlan:selectedDraftQaContext(plan,n),sequence:packet,text:story.pages[n-1].text};
  const contextChars=JSON.stringify(context).length;
  assert(prompt.length<=24000);assert(contextChars<40000);
  sizes.push({pageNumber:n,promptChars:prompt.length,coreContextChars:contextChars});
  const candidate={imageName:`page-${String(n).padStart(2,'0')}.png`,imageSha:'a'.repeat(64)},contextSha='b'.repeat(64);
  prior.push({pageNumber:n,status:'passed',candidate,contextSha,history:[{candidate,review:{candidateSha:candidate.imageSha,contextSha,
    checks:QUALITY_CATEGORIES.map(category=>({category,verdict:'pass',observation:'synthetic size-probe only',correction:''}))}}]});
}
const snapshots=['outputs/panda-five-page-execution-20260919/after.json','outputs/panda-five-page-selected-execution-20260919/after.json'];
const seen=new Set();
for(const relative of snapshots){
  const rows=JSON.parse(fs.readFileSync(path.join(repo,relative),'utf8'));
  for(const row of rows){
    const file=path.join(repo,row.file),bytes=fs.readFileSync(file),stat=fs.statSync(file);
    assert.equal(previewSha(bytes),row.sha256);assert.equal(stat.size,row.bytes);assert.equal(stat.mtimeMs,row.mtimeMs);seen.add(row.file);
  }
}
const readerHashes={
  'sample-manifest.json':'953a436209417b79a8c8d07f4c3985dcc6577ccadd24f3853d77398919440322',
  'readout.json':'042290c5a3823fc81bddc71e84d1c95a12c7c4b6b83842674d92875a0f606a69',
  'index.html':'56d745895447e6b63acb5ecb188ae9a4e9aa3248a3b2ddd933a6e5c02370085a',
};
for(const [file,sha] of Object.entries(readerHashes))assert.equal(previewSha(fs.readFileSync(path.join(repo,'outputs/panda-five-page-selected-sample-20260919',file))),sha);
const manifest=JSON.parse(fs.readFileSync(path.join(repo,'outputs/panda-five-page-selected-sample-20260919/sample-manifest.json'),'utf8'));
let readerImages=0;
for(const row of manifest.results){
  const c=row.candidate;assert.match(c.imageName,/^page-\d{2}\.png$/);
  assert.equal(previewSha(fs.readFileSync(path.join(repo,'outputs/panda-five-page-selected-sample-20260919',c.imageName))),c.imageSha);readerImages++;
}
assert.equal(readerImages,2);
assert.equal(fs.existsSync(path.join(repo,config.outputDir)),false);
console.log(JSON.stringify({providerCalls:0,writes:0,costUsd:0,preservedSnapshotFiles:seen.size,readerHashesUnchanged:3,
  readerImagesUnchanged:readerImages,pageSizes:sizes,syntheticReviews:'in-memory size probes only; not visual evidence',liveOutputRootExists:false},null,2));
