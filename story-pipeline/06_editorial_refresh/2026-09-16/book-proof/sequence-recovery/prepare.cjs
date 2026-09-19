'use strict';
// Offline sidecar authoring/proof. Exact historical source/plan, no provider or key.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {previewSha,previewStory}=require('../../../../../lib/local-story-preview.ts');
const {validateBookSequence,validateSequenceSelection}=require('../../../../../lib/local-book-sequence.ts');
const {loadOwnerDraft}=require('../../../../../scripts/run-owner-book-draft.ts');
const repo=path.resolve(__dirname,'../../../../..');
globalThis.fetch=()=>{throw Error('offline_provider_forbidden');};
const prior=JSON.parse(fs.readFileSync(path.join(repo,'outputs/panda-five-page-selected-input-20260919/config.json'),'utf8'));
assert.equal(prior.plan.sha,'53463fe7552398b67d4cea66ed83cf0171341244dada8a498ace3b59a192261c');
const read=a=>{const b=fs.readFileSync(path.join(repo,a.file));assert.equal(previewSha(b),a.sha);return b;};
const source=read(prior.story),planBytes=read(prior.plan),plan=JSON.parse(planBytes),story=previewStory(source.toString('utf8'),prior.childName,prior.gender);
const value=(relation,targetId)=>({relation,targetId});
const states=Object.fromEntries(['child','companion',...plan.continuity.entities.map(e=>e.id)].map(id=>[id,value('unestablished',null)]));
Object.assign(states,{child:value('beside','station'),companion:value('beside','child'),station:value('at','playground'),wheel:value('held_by','child'),
  station_driver:value('inside','station'),ticket_child:value('at','station'),playground_map:value('at','playground')});
const changes={
  3:{child:value('at','playground'),wheel:value('at','playground'),adam:value('at','playground'),telescope:value('held_by','child')},
  4:{child:value('inside','rover'),adam:value('inside','rover'),companion:value('beside','rover'),wheel:value('attached_to','rover'),telescope:value('held_by','adam'),rover:value('at','playground')},
  6:{child:value('at','station'),adam:value('at','station'),companion:value('beside','station')},
  7:{child:value('beside','rug'),adam:value('beside','rug'),companion:value('beside','rug'),rug:value('at','playground'),teacher:value('at','playground')},
  8:{child:value('on','rug'),telescope:value('at','playground')},
  9:{child:value('inside','rover'),adam:value('inside','rover'),companion:value('beside','rover'),station_driver:value('beside','rover'),telescope:value('held_by','child')},
  11:{child:value('beside','rover'),adam:value('beside','rover'),telescope:value('held_by','adam'),station_friends:value('beside','rover')},
  12:{child:value('beside','station'),adam:value('at','station'),companion:value('beside','child'),station_driver:value('at','station'),station_friends:value('at','station'),wheel:value('at','playground')},
};
const evidence={
  3:'ליד השביל ישב ילד עם צינור קרטון ארוך.',
  4:'הם נכנסו פנימה, הרימו יחד את הארגז הקל והתחילו ללכת.',
  6:'הם הניחו את הרכב על הדשא וחזרו אל התחנה.',
  7:'ליד הגדר נח שטיח משחק מגולגל. הגננת הסכימה שיפרשו אותו על הקרקע הפנויה.',
  8:'אדם החזיק קצה אחד; ענת, לאחר שקמה, החזיקה את השני.',
  9:'אדם נכנס לרכב ותפס את ההגה.',
  11:'״הגענו לשמש!״ קראה הילדה.',
  12:'ההגה חזר אל התיק, והטלסקופ אל אדם.',
};
const visits=['station_arrival','station_arrival','tube_encounter','rover_sandbox','rover_sandbox','station_return','rug_help','rug_help','bench_detour','bench_detour','flower_arrival','station_cleanup'];
const pages=plan.pages.slice(1).map((p,i)=>{
  const transitions=[];
  for(const [entityId,to] of Object.entries(changes[p.pageNumber]??{})){
    transitions.push({entityId,from:states[entityId],to,evidence:evidence[p.pageNumber]});states[entityId]=to;
  }
  return {pageNumber:p.pageNumber,sceneId:visits[i],beat:p.childAction+'; '+p.companionAction,
    sceneChangeEvidence:i&&visits[i]!==visits[i-1]?evidence[p.pageNumber]:null,
    visibleCastIds:['child','companion',...plan.continuity.pages[p.pageNumber].visibleEntityIds.filter(id=>plan.continuity.entities.find(e=>e.id===id)?.kind==='supporting_character')],
    states:Object.entries(states).map(([entityId,value])=>({entityId,value})),transitions};
});
const sequence={version:'local-book-sequence/v1',sourceSha:prior.story.sha,planSha:prior.plan.sha,
  premise:'A child wants to belong to a pretend moon-station game. Instead of staying excluded, the child creates a shared journey with another child and the panda companion, invites the others, negotiates roles and learns to explore together. The playground is real; space travel is pretend.',mutableAttributes:[],pages};
const input={sourceSha:prior.story.sha,planSha:prior.plan.sha,plan,texts:[story.title,...story.pages.map(p=>p.text)]};
const validated=validateBookSequence(sequence,input);validateSequenceSelection(validated,[1,2,3,4,5]);
const bad=structuredClone(sequence);bad.pages[1].states.find(x=>x.entityId==='station_driver').value=value('beside','station');
assert.throws(()=>validateBookSequence(bad,input),/unexplained_change/);
assert.deepEqual(pages[0].states,pages[1].states);
const root='outputs/panda-book-sequence-input-20260919',seqBytes=JSON.stringify(sequence,null,2)+'\n';
const config={...prior,sequence:{file:root+'/sequence.json',sha:previewSha(seqBytes)},outputDir:'outputs/panda-book-sequence-unexecuted-20260919'};
const proof={status:'offline_structural_proof_only',sourceSha:prior.story.sha,planSha:prior.plan.sha,sequenceSha:config.sequence.sha,
  pages:12,sourceAndPlanUnchanged:true,unexplainedDriverRelocationRejected:true,firstTwoSituationsIdentical:true,
  providerCalls:0,costUsd:0,canonicalCandidateHeld:true,runtimeEligible:false,
  limits:['Exact quotes bind bytes but do not prove semantic entailment; secondary custody/parking choices remain authored staging, not new approved source.',
    'This ledger tracks one principal physical relation per entity, not contact geometry, limb anatomy or every incidental item (e.g. final tote).',
    'No independent creative/technical acceptance, no pixel verification, no automatic paid-run authority or reset of the prior aggregate spend fence.']};
if(process.argv.includes('--write')){
  fs.mkdirSync(path.join(repo,root),{recursive:true});
  for(const [name,bytes] of Object.entries({'sequence.json':seqBytes,'config.json':JSON.stringify(config,null,2)+'\n','verification.json':JSON.stringify(proof,null,2)+'\n'})){
    const file=path.join(repo,root,name);if(fs.existsSync(file))assert.equal(fs.readFileSync(file,'utf8'),bytes);else fs.writeFileSync(file,bytes,{flag:'wx'});
  }
}
if(fs.existsSync(path.join(repo,config.sequence.file)))loadOwnerDraft(repo,config);
assert.equal(fs.existsSync(path.join(repo,config.outputDir)),false);
assert.equal(previewSha(read(prior.story)),prior.story.sha);assert.equal(previewSha(read(prior.plan)),prior.plan.sha);
console.log(JSON.stringify(proof,null,2));
