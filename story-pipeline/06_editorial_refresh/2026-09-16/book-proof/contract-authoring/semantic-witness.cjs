'use strict';
// Reproduce selected observed defects in this immutable candidate.
// This is a regression witness, NOT a general-purpose visual/semantic judge.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(repo,p),'utf8'));
const s=read('outputs/panda-contract-execution-20260918-01/stdout.json');
const c=read(s.persistence.candidate.path),snapshot=read(s.persistence.sourceSnapshot.path);
const e=read(s.persistence.structuredDraftReplayEvidence.path),draft=JSON.parse(e.attempts[0].responseJson);
const {storySourceSnapshotToTemplateInput}=require(path.join(repo,'lib/visual-package/storySourceAuthority.ts'));
const {extractDeterministicFacts}=require(path.join(repo,'lib/visual-contract-compiler/extractDeterministicFacts.ts'));
const {canonicalHash}=require(path.join(repo,'lib/canonical-json.ts'));
assert.equal(c.digest,'41d400698df1aa452b326a050b5f1a316ea4679ffb80e093fa16c6466c7ff2ba');
const input=storySourceSnapshotToTemplateInput(snapshot),facts=extractDeterministicFacts(input),t=c.template;
const p=n=>t.pageContracts.find(p=>p.pageNumber===n);
const dir=n=>snapshot.content.pageImageDirections.find(p=>p.pageNumber===n).imageDirection;
const a=(n,pred)=>p(n).actionRequirements.some(a=>a.predicate===pred&&a.polarity==='must');
assert.equal(facts.humans.length,0);assert.equal(t.humanCast.length,0);
assert.ok(p(9).mustShow.includes("Adam positioned at the rover's mounted steering wheel"));
assert.ok(p(9).propState.some(s=>s.propId==='prop_wheel'&&s.state==='front-mounted and held by Adam'));
assert.ok(t.coverContract.mustShow.some(x=>x.includes('handmade cardboard steering wheel')));
assert.ok(t.coverContract.mustNotShow.some(x=>x.includes('Handmade steering wheel')&&x.includes('no spoiler')));
assert.ok(!draft.coverContract.mustNotShow.some(x=>x.includes('no spoiler')));
assert.ok(dir(8).includes('not the earlier helping-hand moment'));
assert.ok(a(8,'reaches_toward')&&a(8,'pushes'));
assert.ok(dir(12).includes('not a simultaneous return journey'));
assert.ok(a(12,'walks')&&a(12,'pushes')&&a(12,'places'));
assert.ok(dir(7).includes('on the grass beside'));
assert.ok(a(7,'sits_on')&&p(7).actionRequirements.some(a=>a.object?.id==='prop_rug'));
const telescopeState=n=>p(n).propState.find(s=>s.propId==='prop_telescope')?.state??null;
assert.equal(telescopeState(6),'with the parked rover or Adam');
assert.equal(telescopeState(11),'available but secondary');
assert.ok(dir(4).includes('child and Adam walk inside'));
assert.ok(t.recurringProps.find(p=>p.id==='prop_rover').scale.includes('several children'));
assert.ok(dir(10).includes('points toward the side path'));
assert.ok(!p(10).actionRequirements.some(a=>a.predicate==='points_at'));
assert.equal(canonicalHash(t),c.templateDigest);
const report={
 status:'semantic_hold_codex_observation_not_independent_QA',candidateDigest:c.digest,templateDigest:c.templateDigest,
 sourceSnapshotDigest:snapshot.digest,providerCalls:0,
 findings:[
  {id:'CAST',severity:'blocking',observation:'Extractor humans=[], compiled humanCast=[]; all12 cast lists omit supporting identities despite Adam/station children/teacher in approved directions and contract prose.',cause:'Compiler overlays legacy deterministic humans; canonical live request does not carry source-bound supporting-cast review. Existing offline semantic-correction mechanism must be used, not manual mutation of paid candidate.'},
  {id:'MOMENT',severity:'blocking',pages:[5,8,12],observation:'Draft already merges narrative beats into simultaneous must actions. On8 reaches_toward and rug flattening coexist; on12 walks, rug pushing, wheel placing conflict with selected final conversation. On5 telescope viewing intrudes on selected rear-turn moment.',cause:'Typed coverage validity does not establish fidelity to selected illustration moment. Compiler projects those actions into mustShow; no schema validation error was emitted.'},
  {id:'COVER',severity:'blocking',observation:'Cover mustShow requests wheel/station while compiler-generated mustNotShow forbids both before firstRevealPage1.',cause:'Draft asks for them; deterministic page0 lifecycle projection appends prohibitions. Existing explicit cover-visible-prop correction is the intended route; do not drop no-spoiler policy globally.'},
  {id:'CUSTODY',severity:'blocking',pages:[3,4,5,6,11],observation:'Not one unequivocal telescope holder/resting place:6 says rover OR Adam;11 says available but secondary;4 tube inside a floorless moving box has no support.3 asks Adam with tube plus child viewing it. Prior P2 not closed.'},
  {id:'STAGING',severity:'blocking',pages:[7,10],observation:'7 requires sitting on rug instead of approved grass beside it.10 omits the child pointing out the detour and asks turns instead.'},
  {id:'CAPACITY',severity:'follow_up',observation:'Rover scale says several children instead of making the approved two-child occupancy legible; final scene must not add the station driver inside.'}
 ],
 partialSuccess:'Page9 propState explicitly names Adam holding wheel, and child tube remains at eye level. Not complete closure because Adam is not an authoritative cast identity.',
 boundaries:'No candidate/source mutation, no reconciliation approval, no Blueprint/render/narration/pixel acceptance.'
};
if(process.argv.includes('--record'))fs.writeFileSync(path.join(__dirname,'semantic-observations.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report,null,2));
