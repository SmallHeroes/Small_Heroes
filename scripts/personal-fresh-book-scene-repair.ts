/** Fixed, single-use same-book successor. Dry by default. Never resumes or repins the consumed diagnostic. */
import {existsSync,lstatSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {canonicalJson} from '../lib/personal-wizard/request-acceptance';
import {previewSha} from '../lib/local-story-preview';
import {currentPersonalStoryboardFrame} from '../lib/personal-wizard/storyboard';
import {AUDITION_LOCAL_ANATOMY_REPAIR_VERSION} from '../lib/personal-wizard/audition-anatomy';
import {auditionPageContext,referenceStatus,assessAuditionReview,auditionAnatomyCast,auditionLocalAnatomyRepairPlan,
  repairReviewedAuditionPage,LANDMARK_DESIGN_HEAD_VERSION,LANDMARK_COVERAGE_TOPOLOGY_VERSION,ReviewedAuditionError,
  type AuditionAttempt,type SavedPage} from '../lib/personal-wizard/simple-book-reviewed-audition';
import type {AuditionImage} from '../lib/personal-wizard/simple-book-illustrations';
import {freshBookFullBookDiagnosticGrantSchema,FRESH_BOOK_FULL_BOOK_DIAGNOSTIC as PARENT} from './personal-fresh-book-diagnostic';
import {freshBookConfig,realFreshBookEnv,planFreshBook,freshBookLedger,type FreshBookConfig} from './personal-fresh-book-driver';
import {FRESH_BOOK_CYCLE,assertFreshBookAdmission,type FreshBookEnv} from './personal-fresh-book-authority';
import {AuditionMeter,auditionMeterRules,auditionGrantSchema,auditionAdapters,keyReader,loadReviewedBook,readReviewedBookLayout,
  auditionJudgePayload,durableReviewPayload,digestImages,auditionRenderPlan,conservativeDebitSchema,orphanProvisionSchema} from './personal-simple-book-reviewed-audition';
import {folderBaseline} from './personal-child-anchor-rereview';
import {exclusiveJson} from './personal-causal-trial-journal';
import {DURABLE_REVIEW_VERSION} from './personal-durable-review';

const hash=z.string().regex(/^[a-f0-9]{64}$/),abs=z.string().refine(path.isAbsolute),workspace=path.resolve(__dirname,'..');
const fail=(s:string):never=>{throw new ReviewedAuditionError(s);};
const bytes=(f:string)=>{const s=lstatSync(f);if(!s.isFile()||s.isSymbolicLink()||s.size>32000000)fail('scene_repair_file');return readFileSync(f);};
const json=(f:string)=>JSON.parse(bytes(f).toString('utf8'));
export const SCENE_REPAIR_AUTHORITY=Object.freeze({version:AUDITION_LOCAL_ANATOMY_REPAIR_VERSION,prefix:'r9_',
  claimName:'owner-cycle-20261017-fresh-book-usd7.audition-local-anatomy-repair.claim.json',
  outcomeName:'owner-cycle-20261017-fresh-book-usd7.audition-local-anatomy-repair.outcome.json'});
const A=SCENE_REPAIR_AUTHORITY;
export const sceneRepairGrantSchema=z.object({version:z.literal('fresh-book-local-anatomy-repair-grant/v1'),cycle:z.literal(FRESH_BOOK_CYCLE.id),
  contract:z.literal(A.version),engine:z.object({head:z.string().regex(/^[a-f0-9]{40}$/),branch:z.string().min(1)}).strict(),pins:z.record(hash),
  bookDir:abs,configurationSha256:hash,profileSha256:hash,ownerApproval:z.object({file:abs,sha256:hash}).strict(),
  parent:z.object({grantFile:abs,grantSha256:hash,claimSha256:hash,outcomeSha256:hash,admissionSha256:hash}).strict(),
  rootsSha256:hash,ledgerSha256:hash,debits:z.array(conservativeDebitSchema),provision:orphanProvisionSchema,
  transition:z.array(z.object({page:z.number().int().min(0).max(8),candidateSha256:hash,contextSha256:hash,consumedAttemptsBefore:z.literal(1),
    priorSha256:hash}).strict()).length(2),
  firstOperation:z.object({step:z.literal('r9_page_7_0_diagnosis_qa'),wireDigest:hash}).strict(),
  allowance:z.object({maxNewImages:z.literal(2),maxNewCalls:z.literal(7),maxNewAttemptsPerPage:z.literal(1),
    pageOrder:z.tuple([z.literal(7),z.literal(4)])}).strict(),nativePlanSha256:hash}).strict();

/** Invalid evidence is terminal; a valid visual HOLD remains an ordinary diagnostic result. Shared by the actual native loop and tests. */
export function sceneRepairStops(result:Awaited<ReturnType<typeof repairReviewedAuditionPage>>){
  return result.status==='stopped_unusable_or_unsafe_parent'||!!result.corrected&&
    ['review_unusable','identity_unusable','unavailable','ineligible_safety','review_invalid'].includes(result.corrected.status);
}

/** ONE exact pre-provider abort, never a general retry/reset or a route for unknown/provider failures. */
export const SCENE_REPAIR_PRECLAIM_RECOVERY=Object.freeze({version:'audition-local-anatomy-preclaim-recovery/v1',
  failedGrantSha256:'01ac003889acedca2030973cb9c69e5b4fe8450ca2171edf2f1042aa95dd9cdb',
  claimName:'owner-cycle-20261017-fresh-book-usd7.audition-local-anatomy-preclaim-recovery.claim.json',
  outcomeName:'owner-cycle-20261017-fresh-book-usd7.audition-local-anatomy-preclaim-recovery.outcome.json'});
export const sceneRepairRecoveryGrantSchema=sceneRepairGrantSchema.omit({version:true,parent:true,firstOperation:true}).extend({
  version:z.literal('fresh-book-local-anatomy-preclaim-recovery-grant/v1'),authority:z.literal(SCENE_REPAIR_PRECLAIM_RECOVERY.version),
  parent:z.object({grantFile:abs,grantSha256:z.literal(SCENE_REPAIR_PRECLAIM_RECOVERY.failedGrantSha256),claimSha256:hash,outcomeSha256:hash}).strict(),
  sourceParent:sceneRepairGrantSchema.shape.parent,
  firstOperation:z.object({step:z.literal('r9_page_7_0_qa'),wireDigest:hash}).strict(),meterFirstReservationMicroUsd:z.literal(600000),
}).strict();

export async function planSceneRepair(config:FreshBookConfig,env:FreshBookEnv,parentGrantFile:string,approvalFile:string){
  const refuse=():never=>fail('scene_repair_parent'),dir=path.join(config.bookDir,'audition'),paid=path.join(dir,'paid-stages'),images=path.join(dir,'illustrations');
  const parentSha=previewSha(bytes(parentGrantFile)),parent=freshBookFullBookDiagnosticGrantSchema.parse(json(parentGrantFile));
  const approvalText=bytes(approvalFile).toString('utf8');
  if(!path.isAbsolute(approvalFile)||!approvalText.includes('בעמוד 7 יש 5 רגליים')||!approvalText.includes('יש אישור'))fail('scene_repair_approval');
  const base=planFreshBook(config,env),engine=env.head(),at=(n:string)=>path.join(env.authorityRoot,n);
  const claim=json(at(PARENT.claimName)),outcome=json(at(PARENT.outcomeName)),admission=json(path.join(dir,'admission-full-book-diagnostic.json'));
  if(canonicalJson(claim)!==canonicalJson({cycle:FRESH_BOOK_CYCLE.id,version:PARENT.version,grantSha256:parentSha,parent:parent.parent,
      ownerApproval:parent.ownerApproval,engine:parent.engine,bookDir:parent.bookDir,transition:parent.transition,allowance:parent.allowance})||
    outcome.status!=='failed_full_book_diagnostic'||outcome.code!=='audition_review_unusable'||admission.grantSha256!==parentSha||
    parent.profileSha256!==base.plan.profileSha256||parent.engine.branch!==engine.branch||
    path.resolve(parent.bookDir).toLowerCase()!==path.resolve(config.bookDir).toLowerCase()||
    parent.configurationSha256!==previewSha(canonicalJson(config)))refuse();
  const pins=Object.fromEntries([...Object.keys(parent.pins),'scripts/personal-fresh-book-scene-repair.ts'].map(f=>[f,previewSha(bytes(path.join(workspace,f)))]));
  const roots={bookFiles:folderBaseline(config.bookDir),authorityFiles:folderBaseline(env.authorityRoot)};
  const ownerApproval={file:path.resolve(approvalFile),sha256:previewSha(bytes(approvalFile))};
  const unchanged=()=>{if(canonicalJson(folderBaseline(config.bookDir))!==canonicalJson(roots.bookFiles)||
    canonicalJson(folderBaseline(env.authorityRoot))!==canonicalJson(roots.authorityFiles)||previewSha(bytes(parentGrantFile))!==parentSha||
    previewSha(bytes(approvalFile))!==ownerApproval.sha256||env.head().head!==engine.head||env.head().branch!==engine.branch||
    Object.entries(pins).some(([f,sha])=>previewSha(bytes(path.join(workspace,f)))!==sha))refuse();};
  await assertFreshBookAdmission(base.rereview,env);unchanged();
  const loaded=loadReviewedBook(config.bookDir,workspace,undefined,readReviewedBookLayout(path.join(config.bookDir,'book-layout.json')));
  const original=auditionGrantSchema.parse(json(path.join(config.bookDir,'audition.grant.json')));
  if(original.scope.mode!=='render'||original.maxCalls!==89||original.capMicroUsd!==7000000||!original.experiment||
    original.book.requestId!==loaded.queued.requestId||original.book.storyboardDigest!==loaded.book.storyboardDigest)refuse();
  const meter=new AuditionMeter(paid,original.capMicroUsd,original.maxCalls,original.ledger.priorKnownApiMicroUsd,0,auditionMeterRules,parent.debits,[parent.provision]);
  const snapshot=meter.snapshot(),ledger=freshBookLedger(config,env,base.rereview,'child_fresh_anchor',parent.debits,[parent.provision]);
  if(snapshot.unknownCost||snapshot.unknownOutcome||snapshot.reservedUnsettledMicroUsd||snapshot.calls+7>89||
    snapshot.cumulativeAccountedMicroUsd+600000>7000000)refuse();
  const image=(name:string):AuditionImage=>({imageName:name,imageSha:previewSha(bytes(path.join(images,name)))});
  const imageBytes=(i:AuditionImage)=>{if(!/^[a-z0-9_]+\.png$/.test(i.imageName))refuse();
    const b=bytes(path.join(images,i.imageName));if(previewSha(b)!==i.imageSha)refuse();return b;};
  const sheets={entities:json(path.join(dir,'sheet_entities.json')),locations:json(path.join(dir,'sheet_locations.json'))};
  const refs=referenceStatus(sheets),canonical=[image('reference_child.png'),image('reference_companion.png'),refs.entities.image,refs.locations.image];
  canonical.forEach(imageBytes);
  // Count ACTUAL image claims across all prefixes; a saved page or a new folder never resets the count.
  const renderIndices=(page:number)=>readdirSync(paid).map(n=>new RegExp(`^(?:r[0-9]+_)?page_${page}_([0-9]+)\\.claim\\.json$`).exec(n))
    .filter((m):m is RegExpExecArray=>!!m).map(m=>Number(m[1])).sort((a,b)=>a-b);
  const allCounts=Array.from({length:9},(_,page)=>({page,indices:renderIndices(page)}));
  if(allCounts.some(({page,indices})=>indices.length!==(page===1?2:page===2?6:1)||indices.some((n,i)=>n!==i)))refuse();
  const pages=[];
  for(const page of [7,4]){
    const pending=json(path.join(dir,`diagnostic_render_${page}.json`)),candidate=image(`r8_page_${page}_0.png`);
    if(pending.status!=='pending_review'||canonicalJson(pending.candidate)!==canonicalJson(candidate))refuse();
    const rendered=json(path.join(paid,`r8_page_${page}_0.result.json`)),receipt=json(path.join(paid,`r8_page_${page}_0.receipt.json`));
    if(rendered.completed!==true||!Number.isSafeInteger(rendered.estimatedMicroUsd)||canonicalJson(receipt.candidate)!==canonicalJson(candidate))refuse();
    const packet='ownerAcceptance'in loaded?currentPersonalStoryboardFrame(loaded.book,loaded.rawReview,page,loaded.current,loaded.ownerAcceptance):
      currentPersonalStoryboardFrame(loaded.book,loaded.rawReview,page,loaded.current);
    const sameScene=page>=2&&loaded.book.sequence.pages[page-1].sceneId===loaded.book.sequence.pages[page-2].sceneId;
    const predecessor=sameScene?image(`r8_page_${page-1}_0.png`):null;
    const c=auditionPageContext(loaded.book,packet.context,page,loaded.companionDescription,canonical,refs,predecessor,
      LANDMARK_DESIGN_HEAD_VERSION,LANDMARK_COVERAGE_TOPOLOGY_VERSION,true);
    let prior:AuditionAttempt={attempt:0,candidate,review:null,assessment:null,status:'unavailable',error:'not_yet_reviewed'};
    if(page===4){
      const saved=json(path.join(dir,'page_4_diagnostic.json')) as SavedPage; prior=saved.chosen;
      const wire=json(path.join(paid,'r8_page_4_0_qa.wire.json')),raw=json(path.join(paid,'r8_page_4_0_qa.receipt.json')).raw;
      if(saved.contextSha!==c.contextSha||canonicalJson(JSON.parse(wire.input[0].content[0].text).context)!==canonicalJson(c.context)||
        canonicalJson(JSON.parse(raw.output_text))!==canonicalJson(prior.review)||canonicalJson(prior.candidate)!==canonicalJson(candidate))refuse();
      const expected=durableReviewPayload(await auditionJudgePayload({candidate,candidateBytes:imageBytes(candidate),context:c.context,contextSha:c.contextSha,
        refs:canonical.map(imageBytes),predecessor:predecessor?imageBytes(predecessor):null,kind:'page'}));unchanged();
      if(canonicalJson(digestImages(expected))!==canonicalJson(wire))refuse();
      const assessment=assessAuditionReview(prior.review,candidate.imageSha,c.contextSha,c.checks.requirementIds,c.checks.uniqueLandmarks,
        LANDMARK_COVERAGE_TOPOLOGY_VERSION,auditionAnatomyCast(c.context)).assessment;
      if(canonicalJson(assessment)!==canonicalJson(prior.assessment)||!auditionLocalAnatomyRepairPlan(prior,c.context,c.contextSha,canonical))refuse();
    } else if(existsSync(path.join(paid,'r8_page_7_0_qa.claim.json')))refuse();
    pages.push({page,candidate,prior,predecessor,...c});
  }
  const first=pages[0],firstWire=digestImages(durableReviewPayload(await auditionJudgePayload({candidate:first.candidate,
    candidateBytes:imageBytes(first.candidate),context:first.context,contextSha:first.contextSha,refs:canonical.map(imageBytes),
    predecessor:first.predecessor?imageBytes(first.predecessor):null,kind:'page'})));unchanged();
  const transition=pages.map(p=>({page:p.page,candidateSha256:p.candidate.imageSha,contextSha256:p.contextSha,
    consumedAttemptsBefore:1 as const,priorSha256:previewSha(canonicalJson(p.prior))}));
  const allowedSteps=['r9_page_7_0_diagnosis_qa',...['7','4'].flatMap(page=>[`r9_page_${page}_1`,`r9_page_${page}_1_qa`,`r9_page_${page}_1_identity`])];
  const plan={cycle:FRESH_BOOK_CYCLE.id,contract:A.version,bookDir:path.resolve(config.bookDir),configurationSha256:previewSha(canonicalJson(config)),
    profileSha256:base.plan.profileSha256,ownerApproval,parent:{grantFile:path.resolve(parentGrantFile),grantSha256:parentSha,
      claimSha256:previewSha(bytes(at(PARENT.claimName))),outcomeSha256:previewSha(bytes(at(PARENT.outcomeName))),admissionSha256:previewSha(bytes(path.join(dir,'admission-full-book-diagnostic.json')))},
    rootsSha256:previewSha(canonicalJson(roots)),ledgerSha256:previewSha(canonicalJson(ledger)),debits:parent.debits,provision:parent.provision,transition,
    firstOperation:{step:'r9_page_7_0_diagnosis_qa' as const,wireDigest:previewSha(canonicalJson(firstWire))},
    allowance:{maxNewImages:2 as const,maxNewCalls:7 as const,maxNewAttemptsPerPage:1 as const,pageOrder:[7,4] as [7,4]}};
  const grantDraft=sceneRepairGrantSchema.parse({...plan,version:'fresh-book-local-anatomy-repair-grant/v1',engine:{head:engine.head,branch:engine.branch},
    pins,nativePlanSha256:previewSha(canonicalJson(plan))});
  return {plan,grantDraft,roots,ledger,snapshot,allCounts,allowedSteps,pages,canonical,original,base,
    state:{claimExists:existsSync(at(A.claimName)),outcomeExists:existsSync(at(A.outcomeName))}};
}

export async function runSceneRepair(a:{config:FreshBookConfig;env:FreshBookEnv;grantFile:string;grantSha:string;signal:AbortSignal;log:(s:string)=>void}){
  if(previewSha(bytes(a.grantFile))!==a.grantSha)fail('scene_repair_grant');
  const raw=json(a.grantFile),recovery=raw.version==='fresh-book-local-anatomy-preclaim-recovery-grant/v1';
  const g=recovery?sceneRepairRecoveryGrantSchema.parse(raw):sceneRepairGrantSchema.parse(raw);
  const authority=recovery?SCENE_REPAIR_PRECLAIM_RECOVERY:A;
  const p=recovery?await planSceneRepairRecovery(a.config,a.env,g.parent.grantFile,g.ownerApproval.file):
    await planSceneRepair(a.config,a.env,g.parent.grantFile,g.ownerApproval.file);
  if(canonicalJson(g)!==canonicalJson(p.grantDraft)||p.state.claimExists||p.state.outcomeExists)fail('scene_repair_used_or_changed');
  const at=(n:string)=>path.join(a.env.authorityRoot,n),dir=path.join(a.config.bookDir,'audition');
  const same=()=>{const e=a.env.head();if(a.signal.aborted||!e.clean||e.head!==g.engine.head||e.branch!==g.engine.branch)fail('scene_repair_source_changed');
    for(const[f,sha]of Object.entries(g.pins))if(previewSha(bytes(path.join(workspace,f)))!==sha)fail('scene_repair_source_changed');
    for(const[f,sha]of [[a.grantFile,a.grantSha],[g.ownerApproval.file,g.ownerApproval.sha256],[g.parent.grantFile,g.parent.grantSha256]])if(previewSha(bytes(f))!==sha)fail('scene_repair_grant');
    if('sourceParent'in g&&previewSha(bytes(g.sourceParent.grantFile))!==g.sourceParent.grantSha256)fail('scene_repair_grant');
    for(const[f,sha]of Object.entries(p.roots.bookFiles))if(previewSha(bytes(path.join(a.config.bookDir,f)))!==sha)fail('scene_repair_parent');
    for(const[f,sha]of Object.entries(p.roots.authorityFiles))if(previewSha(bytes(at(f)))!==sha)fail('scene_repair_parent');};
  same();exclusiveJson(at(authority.claimName),{version:authority.version,cycle:FRESH_BOOK_CYCLE.id,grantSha256:a.grantSha,parent:g.parent,transition:g.transition,allowance:g.allowance});
  const claimSha=previewSha(bytes(at(authority.claimName))),guard=()=>{same();if(previewSha(bytes(at(authority.claimName)))!==claimSha||existsSync(at(authority.outcomeName)))fail('scene_repair_used');};
  const finish=(value:unknown)=>exclusiveJson(at(authority.outcomeName),value),meter=new AuditionMeter(path.join(dir,'paid-stages'),p.original.capMicroUsd,p.original.maxCalls,
    p.original.ledger.priorKnownApiMicroUsd,0,auditionMeterRules,g.debits,[g.provision]);
  const io=auditionAdapters({directory:path.join(dir,'illustrations'),meter,key:keyReader(a.config.keyEnvFile),signal:a.signal,guard,
    expectedWire:{[g.firstOperation.step]:g.firstOperation.wireDigest},allowedSteps:p.allowedSteps,durableReviews:{version:DURABLE_REVIEW_VERSION}});
  const results=[];
  try{for(const page of p.pages){guard();a.log(`SCENE_REPAIR page=${page.page} prior=${page.candidate.imageSha}`);
    const result=await repairReviewedAuditionPage({page:page.page,prefix:A.prefix,consumedAttemptsBefore:1,prior:page.prior,
      context:page.context,contextSha:page.contextSha,canonical:p.canonical,predecessor:page.predecessor,check:io.check,
      render:io.render,judge:io.judge,identity:io.identity,save:(n,v)=>exclusiveJson(path.join(dir,n+'.json'),v)});
    results.push({page:page.page,...result});
    if(sceneRepairStops(result))
      fail('scene_repair_unusable');
  }
    guard();const ledger=freshBookLedger(a.config,a.env,p.base.rereview,'child_fresh_anchor',g.debits,[g.provision]);
    const value={version:A.version,status:'diagnostic_repairs_finished',results,ledger,grantSha256:a.grantSha,
      runtimeEligible:false,productAccepted:false,finishedAt:new Date().toISOString()};finish(value);return value;
  }catch(e){if(!existsSync(at(authority.outcomeName)))finish({version:A.version,status:'failed_scene_repair',code:e instanceof Error?e.message:String(e),results,
    grantSha256:a.grantSha,finishedAt:new Date().toISOString()});throw e;}
}

/** Reconcile exactly the consumed zero-provider abort and bind the SAME unspent paid allowance to a NEW fixed one-use successor. */
export async function planSceneRepairRecovery(config:FreshBookConfig,env:FreshBookEnv,failedGrantFile:string,approvalFile:string){
  const R=SCENE_REPAIR_PRECLAIM_RECOVERY,failedSha=previewSha(bytes(failedGrantFile));
  if(failedSha!==R.failedGrantSha256)fail('scene_repair_recovery_parent');
  const failed=sceneRepairGrantSchema.parse(json(failedGrantFile)),at=(n:string)=>path.join(env.authorityRoot,n);
  const claim=json(at(A.claimName)),outcome=json(at(A.outcomeName));
  if(canonicalJson(claim)!==canonicalJson({version:A.version,cycle:FRESH_BOOK_CYCLE.id,grantSha256:failedSha,parent:failed.parent,
    transition:failed.transition,allowance:failed.allowance})||outcome.status!=='failed_scene_repair'||outcome.code!=='audition_meter_rule'||
    outcome.grantSha256!==failedSha||canonicalJson(outcome.results)!=='[]')fail('scene_repair_recovery_parent');
  const p=await planSceneRepair(config,env,failed.parent.grantFile,approvalFile);
  const originalRoots=structuredClone(p.roots);delete originalRoots.authorityFiles[A.claimName];delete originalRoots.authorityFiles[A.outcomeName];
  if(previewSha(canonicalJson(originalRoots))!==failed.rootsSha256||p.plan.profileSha256!==failed.profileSha256||
    p.plan.configurationSha256!==failed.configurationSha256||canonicalJson(p.plan.transition)!==canonicalJson(failed.transition)||
    canonicalJson(p.plan.allowance)!==canonicalJson(failed.allowance)||canonicalJson(p.plan.debits)!==canonicalJson(failed.debits)||
    canonicalJson(p.plan.provision)!==canonicalJson(failed.provision)||p.plan.bookDir!==failed.bookDir||
    readdirSync(path.join(config.bookDir,'audition/paid-stages')).some(n=>n.startsWith('r9_')))fail('scene_repair_recovery_paid_or_changed');
  const first=p.pages[0],imageDir=path.join(config.bookDir,'audition/illustrations');
  const imageBytes=(i:AuditionImage)=>{const b=bytes(path.join(imageDir,i.imageName));if(previewSha(b)!==i.imageSha)fail('scene_repair_recovery_binding');return b;};
  const wire=digestImages(durableReviewPayload(await auditionJudgePayload({candidate:first.candidate,candidateBytes:imageBytes(first.candidate),
    context:first.context,contextSha:first.contextSha,refs:p.canonical.map(imageBytes),predecessor:first.predecessor?imageBytes(first.predecessor):null,kind:'page'})));
  const step='r9_page_7_0_qa' as const,reserve=auditionMeterRules(step)?.reserve(wire);
  const allowedSteps=[step,...p.allowedSteps.slice(1)];
  if(reserve!==600000||allowedSteps.some(s=>!auditionMeterRules(s))||
    canonicalJson(folderBaseline(config.bookDir))!==canonicalJson(p.roots.bookFiles)||
    canonicalJson(folderBaseline(env.authorityRoot))!==canonicalJson(p.roots.authorityFiles)||
    Object.entries(p.grantDraft.pins).some(([f,sha])=>previewSha(bytes(path.join(workspace,f)))!==sha)||env.head().head!==p.grantDraft.engine.head||
    previewSha(bytes(failedGrantFile))!==failedSha||previewSha(bytes(approvalFile))!==p.plan.ownerApproval.sha256)fail('scene_repair_recovery_binding');
  const plan={...p.plan,authority:R.version,parent:{grantFile:path.resolve(failedGrantFile),grantSha256:R.failedGrantSha256,
    claimSha256:previewSha(bytes(at(A.claimName))),outcomeSha256:previewSha(bytes(at(A.outcomeName)))},sourceParent:p.plan.parent,
    firstOperation:{step,wireDigest:previewSha(canonicalJson(wire))},meterFirstReservationMicroUsd:600000 as const};
  const grantDraft=sceneRepairRecoveryGrantSchema.parse({...plan,version:'fresh-book-local-anatomy-preclaim-recovery-grant/v1',
    engine:p.grantDraft.engine,pins:p.grantDraft.pins,nativePlanSha256:previewSha(canonicalJson(plan))});
  return {...p,plan,grantDraft,allowedSteps,state:{claimExists:existsSync(at(R.claimName)),outcomeExists:existsSync(at(R.outcomeName))}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(__filename)){
  const arg=(n:string)=>{const i=process.argv.indexOf(n);return i>0?process.argv[i+1]:undefined;};
  const config=freshBookConfig(arg('--config')??fail('scene_repair_args')),env=realFreshBookEnv();
  if(process.argv.includes('--resume'))fail('scene_repair_args');
  const task=process.argv.includes('--execute')?runSceneRepair({config,env,grantFile:arg('--grant')??fail('scene_repair_args'),
    grantSha:arg('--grant-sha')??fail('scene_repair_args'),signal:new AbortController().signal,log:console.log}):
    (process.argv.includes('--preclaim-recovery')?planSceneRepairRecovery:planSceneRepair)(config,env,arg('--parent-grant')??fail('scene_repair_args'),arg('--owner-approval')??fail('scene_repair_args'))
      .then(({plan,grantDraft,state,snapshot,allCounts})=>({plan,grantDraft,state,snapshot,allCounts}));
  task.then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1;});
}
