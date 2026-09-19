'use strict';
// Read-only input coverage, not an18-book semantic/visual acceptance report.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {previewStory,previewSha}=require('../../../../../lib/local-story-preview.ts');
const {wholeBookPlanningInput}=require('../../../../../lib/local-book-planning.ts');
const repo=path.resolve(__dirname,'../../../../..');
globalThis.fetch=()=>{throw Error('offline_provider_forbidden');};
const relative='story-pipeline/06_editorial_refresh/2026-09-16/intake/manifest.json';
const manifestBytes=fs.readFileSync(path.join(repo,relative));
const manifest=JSON.parse(manifestBytes);assert.equal(manifest.records.length,18);
const records=manifest.records.map(record=>{
  const raw=fs.readFileSync(path.join(repo,record.path),'utf8');assert.equal(previewSha(raw),record.sha256);
  const variants=['boy','girl'].map(gender=>{
    const story=previewStory(raw,gender==='boy'?'בר':'נועה',gender);
    const input=wholeBookPlanningInput(story,5,gender,'identity-bound companion design supplied separately');
    assert.deepEqual(input.story,story);assert.equal(input.story.pages.length,record.pages);
    assert.deepEqual(input.story.pages.map(p=>p.pageNumber),Array.from({length:record.pages},(_,i)=>i+1));
    assert(!/\{\{|\{[^{}]+\|[^{}]+\}/.test(JSON.stringify(input.story)));
    return {gender,pages:story.pages.length,inputDigest:previewSha(JSON.stringify(input))};
  });
  assert.equal(previewSha(fs.readFileSync(path.join(repo,record.path))),record.sha256);
  return {key:record.key,sourceSha:record.sha256,pages:record.pages,variants};
});
assert.equal(records.reduce((sum,r)=>sum+r.pages,0),216);
assert.equal(previewSha(fs.readFileSync(path.join(repo,relative))),previewSha(manifestBytes));
console.log(JSON.stringify({status:'input_coverage_only',manifestSha:previewSha(manifestBytes),stories:18,pages:216,
  personalizedPagesChecked:432,providerCalls:0,writes:0,costUsd:0,generatedPlans:0,runtimeQualificationClaimed:false,
  sourceScope:'hash-bound editorial intake, not a replacement for accepted-source lifecycle validation',records},null,2));
