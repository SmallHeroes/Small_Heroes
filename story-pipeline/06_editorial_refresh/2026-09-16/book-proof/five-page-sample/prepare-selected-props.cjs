'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {previewSha,previewAccountedUsd}=require('../../../../../lib/local-story-preview.ts');
const {loadOwnerDraft,projectDraftPropReferences,selectedDraftQaContext}=require('../../../../../scripts/run-owner-book-draft.ts');
const repo=path.resolve(__dirname,'../../../../..');
const first='outputs/panda-five-page-sample-20260919',inputs='outputs/panda-five-page-selected-input-20260919';
const prior=JSON.parse(fs.readFileSync(path.join(repo,'outputs/panda-five-page-input-20260919/config.json'),'utf8'));
const plan=JSON.parse(fs.readFileSync(path.join(repo,prior.plan.file),'utf8'));
assert.equal(previewSha(fs.readFileSync(path.join(repo,prior.plan.file))),prior.plan.sha);
const originalActions=plan.pages.map(p=>({scene:p.scene,childAction:p.childAction,companionAction:p.companionAction}));
const rule='Front gable wall has ONLY the doorway, no window. Square window belongs ONLY on the LEFT SIDE wall beneath a roof slope, never in either gable wall. An unseen side window stays unseen; do not relocate hidden features into view.';
plan.recurringProps.find(p=>p.id==='station').design+=' '+rule;
plan.continuity.entities.find(e=>e.id==='station').invariants[0].value+=' '+rule;
for(const pageNumber of [1,2]) plan.pages[pageNumber].composition+=' Camera is on the FRONT-LEFT of the station, showing the left side wall with its square window and the separate front gable wall with its single doorway. The two openings must be on different wall planes meeting at a blue-taped corner, as in the prop reference. No extra background people, extra boxes or telescope before their introduction.';
assert.deepEqual(plan.pages.map(p=>({scene:p.scene,childAction:p.childAction,companionAction:p.companionAction})),originalActions);
const boardFile=first+'/prop-board.png';
const spentImage=previewAccountedUsd(path.join(repo,first,'steps')),spentQa=previewAccountedUsd(path.join(repo,first,'qa/steps'));
assert.equal(spentImage,0.5265);assert.equal(spentQa,2.57386); // includes the interrupted contextual call's full $1 reserve.
const bytes=JSON.stringify(plan,null,2)+'\n';
const config={...prior,plan:{file:inputs+'/plan.json',sha:previewSha(bytes)},
  propBoard:{file:boardFile,sha:previewSha(fs.readFileSync(path.join(repo,boardFile)))},
  propBoardRegions:{station:{left:0,top:65,width:585,height:705},wheel:{left:602,top:249,width:380,height:370},
    telescope:{left:583,top:620,width:402,height:168},rover:{left:0,top:767,width:585,height:445},rug:{left:400,top:888,width:624,height:552}},
  outputDir:'outputs/panda-five-page-selected-sample-20260919',imageBudgetUsd:2.5,
  qaBudgetUsd:Math.floor((9.5-spentImage-spentQa-2.5)*1e5)/1e5};
delete config.sampleRepairOnce; // Do not reset the already consumed automatic-repair allowance.
const evidence={predecessor:first,predecessorAccountedUpperUsd:spentImage+spentQa,unknownContextualOutcomeRetainedUsd:1,
  aggregateFenceUsd:9.5,newImageFenceUsd:config.imageBudgetUsd,newQaFenceUsd:config.qaBudgetUsd,
  retryOfUnknownCall:false,newPlanSha:config.plan.sha,newPixelGenerationsMaximum:5,newAutomaticRepairs:0,
  purpose:'New source-consistent perspective and prop-reference projection experiment; prior images remain held, not reused as initial candidates',
  invariants:'Approved source, selected main actions, identities, scales and intended prop topology unchanged; no judge/threshold edits'};
async function main(){
  const contexts=config.samplePages.map(p=>({page:p,characters:JSON.stringify(selectedDraftQaContext(plan,p)).length,props:plan.pages[p].props.map(p=>p.id)}));
  assert(contexts.every(c=>c.characters<12000));
  const projection=await projectDraftPropReferences(fs.readFileSync(path.join(repo,boardFile)),config.propBoardRegions,plan.pages.filter(p=>config.samplePages.includes(p.pageNumber)));
  const root=path.join(repo,inputs);
  if(process.argv.includes('--write'))fs.mkdirSync(root,{recursive:true});
  const files={'plan.json':bytes,'config.json':JSON.stringify(config,null,2)+'\n','allocation.json':JSON.stringify(evidence,null,2)+'\n'};
  for(const [name,value] of Object.entries(files)){
    const file=path.join(root,name);
    if(fs.existsSync(file))assert.equal(fs.readFileSync(file,'utf8'),value);
    else if(process.argv.includes('--write'))fs.writeFileSync(file,value,{flag:'wx'});
  }
  for(const [page,b] of projection){
    const file=path.join(root,`prop-reference-${page}.png`);
    if(fs.existsSync(file))assert.equal(previewSha(fs.readFileSync(file)),previewSha(b));
    else if(process.argv.includes('--write'))fs.writeFileSync(file,b,{flag:'wx'});
  }
  if(fs.existsSync(path.join(root,'config.json')))loadOwnerDraft(repo,config);
  console.log(JSON.stringify({...evidence,contexts,providerCalls:0},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
