/** Dry by default. Editorial readability follows a consumed diagnostic, never rewrites its valid judgment. */
import {existsSync,lstatSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';import {z} from 'zod';
import {canonicalJson} from '../lib/personal-wizard/request-acceptance';
import {previewSha} from '../lib/local-story-preview';
import {previewQualityContextSha} from '../lib/local-preview-quality';
import {anatomyClarityRequestSchema,auditionLocalAnatomyRepairPlan,repairReviewedAuditionPage,assessAuditionReview,auditionAnatomyCast,
  auditionLandmarkTopology,attemptStatus,ReviewedAuditionError,type AuditionAttempt} from '../lib/personal-wizard/simple-book-reviewed-audition';
import {sceneRepairRecoveryGrantSchema,SCENE_REPAIR_PRECLAIM_RECOVERY,sceneRepairStops} from './personal-fresh-book-scene-repair';
import {freshBookConfig,realFreshBookEnv,planFreshBook,freshBookLedger,type FreshBookConfig} from './personal-fresh-book-driver';
import {FRESH_BOOK_CYCLE,assertFreshBookAdmission,type FreshBookEnv} from './personal-fresh-book-authority';
import {AuditionMeter,auditionMeterRules,auditionGrantSchema,auditionAdapters,keyReader,auditionRenderPlan,conservativeDebitSchema,orphanProvisionSchema} from './personal-simple-book-reviewed-audition';
import {folderBaseline} from './personal-child-anchor-rereview';import {exclusiveJson} from './personal-causal-trial-journal';import {DURABLE_REVIEW_VERSION} from './personal-durable-review';
const hash=z.string().regex(/^[a-f0-9]{64}$/),abs=z.string().refine(path.isAbsolute),workspace=path.resolve(__dirname,'..');
const fail=(s:string):never=>{throw new ReviewedAuditionError(s);};
const bytes=(f:string)=>{const s=lstatSync(f);if(!s.isFile()||s.isSymbolicLink()||s.size>32000000)fail('anatomy_clarity_file');return readFileSync(f);};
const json=(f:string)=>JSON.parse(bytes(f).toString('utf8'));
export const ANATOMY_CLARITY_AUTHORITY=Object.freeze({version:'audition-anatomy-clarity/v1',
  parentSha:'1e7ff9476a962c511ccc77cae95b87249b24c3ce170cbaf75da08a1242c25c9d',
  claimName:'owner-cycle-20261017-fresh-book-usd7.audition-anatomy-clarity.claim.json',
  outcomeName:'owner-cycle-20261017-fresh-book-usd7.audition-anatomy-clarity.outcome.json'});
const A=ANATOMY_CLARITY_AUTHORITY;
export const anatomyClarityGrantSchema=z.object({version:z.literal('fresh-book-anatomy-clarity-grant/v1'),cycle:z.literal(FRESH_BOOK_CYCLE.id),contract:z.literal(A.version),
  engine:z.object({head:z.string().regex(/^[a-f0-9]{40}$/),branch:z.string().min(1)}).strict(),pins:z.record(hash),bookDir:abs,configurationSha256:hash,profileSha256:hash,
  ownerApproval:z.object({file:abs,sha256:hash}).strict(),parent:z.object({grantFile:abs,grantSha256:z.literal(A.parentSha),claimSha256:hash,outcomeSha256:hash}).strict(),
  rootsSha256:hash,ledgerSha256:hash,debits:z.array(conservativeDebitSchema),provision:orphanProvisionSchema,request:anatomyClarityRequestSchema,
  transition:z.object({page:z.literal(7),consumedAttemptsBefore:z.literal(1),priorSha256:hash,contextSha256:hash,candidateSha256:hash}).strict(),
  firstOperation:z.object({step:z.literal('r9_page_7_1'),wireDigest:hash,maximumMicroUsd:z.number().int().positive()}).strict(),
  allowance:z.object({maxNewImages:z.literal(1),maxNewCalls:z.literal(3),totalIncludingParentImages:z.literal(2),totalIncludingParentCalls:z.literal(7)}).strict(),nativePlanSha256:hash}).strict();

/** Raw provider answer is the source; agreement between derivative copies is not sufficient evidence. */
export function assertAnatomyClarityRawPrior(raw:unknown,prior:AuditionAttempt,context:any,contextSha:string){
  const candidate=prior.candidate??fail('anatomy_clarity_raw_binding');
  if(previewQualityContextSha(context)!==contextSha)fail('anatomy_clarity_raw_binding');
  const paidAssessment=assessAuditionReview(raw,candidate.imageSha,contextSha,context.requirementIds,
    context.checks.uniqueLandmarks,auditionLandmarkTopology(context),auditionAnatomyCast(context));
  if(canonicalJson(paidAssessment.review)!==canonicalJson(prior.review)||canonicalJson(paidAssessment.assessment)!==canonicalJson(prior.assessment)||
    attemptStatus('page',{...prior,assessment:paidAssessment.assessment})!==prior.status)fail('anatomy_clarity_raw_binding');
  return paidAssessment;
}

export async function planAnatomyClarity(config:FreshBookConfig,env:FreshBookEnv,parentFile:string,approvalFile:string){
  const engine=env.head(),at=(n:string)=>path.join(env.authorityRoot,n),dir=path.join(config.bookDir,'audition'),paid=path.join(dir,'paid-stages'),images=path.join(dir,'illustrations');
  if(!engine.clean||previewSha(bytes(parentFile))!==A.parentSha)fail('anatomy_clarity_parent');
  const parent=sceneRepairRecoveryGrantSchema.parse(json(parentFile)),claim=json(at(SCENE_REPAIR_PRECLAIM_RECOVERY.claimName)),outcome=json(at(SCENE_REPAIR_PRECLAIM_RECOVERY.outcomeName));
  if(parent.engine.branch!==engine.branch||path.resolve(parent.bookDir)!==path.resolve(config.bookDir)||parent.configurationSha256!==previewSha(canonicalJson(config))||
    canonicalJson(claim)!==canonicalJson({version:SCENE_REPAIR_PRECLAIM_RECOVERY.version,cycle:FRESH_BOOK_CYCLE.id,grantSha256:A.parentSha,parent:parent.parent,transition:parent.transition,allowance:parent.allowance})||outcome.grantSha256!==A.parentSha||outcome.status!=='diagnostic_repairs_finished'||
    outcome.results?.length!==2||outcome.results[0].page!==7||outcome.results[0].status!=='no_verified_structural_defect'||outcome.results[0].corrected!==null||outcome.results[1].page!==4)fail('anatomy_clarity_parent');
  const ownerText=bytes(approvalFile).toString('utf8');if(!path.isAbsolute(approvalFile)||!ownerText.includes('בעמוד 7 יש 5 רגליים')||!ownerText.includes('יש אישור'))fail('anatomy_clarity_owner');
  const roots={bookFiles:folderBaseline(config.bookDir),authorityFiles:folderBaseline(env.authorityRoot)},ownerApproval={file:path.resolve(approvalFile),sha256:previewSha(bytes(approvalFile))};
  const pins=Object.fromEntries([...Object.keys(parent.pins),'scripts/personal-fresh-book-anatomy-clarity.ts'].map(f=>[f,previewSha(bytes(path.join(workspace,f)))]));
  const same=()=>{if(canonicalJson(folderBaseline(config.bookDir))!==canonicalJson(roots.bookFiles)||canonicalJson(folderBaseline(env.authorityRoot))!==canonicalJson(roots.authorityFiles)||
    previewSha(bytes(parentFile))!==A.parentSha||previewSha(bytes(approvalFile))!==ownerApproval.sha256||canonicalJson(env.head())!==canonicalJson(engine)||
    Object.entries(pins).some(([f,h])=>previewSha(bytes(path.join(workspace,f)))!==h))fail('anatomy_clarity_changed');};
  const base=planFreshBook(config,env);await assertFreshBookAdmission(base.rereview,env);same();if(base.plan.profileSha256!==parent.profileSha256)fail('anatomy_clarity_parent');
  const original=auditionGrantSchema.parse(json(path.join(config.bookDir,'audition.grant.json'))),meter=new AuditionMeter(paid,original.capMicroUsd,original.maxCalls,original.ledger.priorKnownApiMicroUsd,0,auditionMeterRules,parent.debits,[parent.provision]);
  const snapshot=meter.snapshot(),ledger=freshBookLedger(config,env,base.rereview,'child_fresh_anchor',parent.debits,[parent.provision]);
  const allowedSteps=['r9_page_7_1','r9_page_7_1_qa','r9_page_7_1_identity'];
  const previousSteps=['r9_page_7_0_qa','r9_page_4_1','r9_page_4_1_qa','r9_page_4_1_identity'];
  if(snapshot.unknownCost||snapshot.unknownOutcome||snapshot.reservedUnsettledMicroUsd||snapshot.calls!==57||snapshot.cumulativeAccountedMicroUsd!==5967094||snapshot.maxCalls!==89||original.capMicroUsd!==7000000||
    ledger.cycleAccountedMicroUsd+600000>8000000||snapshot.cumulativeAccountedMicroUsd+600000>7000000)fail('anatomy_clarity_budget');
  if(readdirSync(paid).filter(n=>/^r9_.*\.claim\.json$/.test(n)).sort().join('|')!==previousSteps.map(s=>s+'.claim.json').sort().join('|')||
    allowedSteps.some(s=>readdirSync(paid).some(n=>n.startsWith(s+'.'))))fail('anatomy_clarity_used');
  for(const step of previousSteps){const r=json(path.join(paid,step+'.result.json'));if(!r.completed||!Number.isSafeInteger(r.estimatedMicroUsd)||!existsSync(path.join(paid,step+'.receipt.json')))fail('anatomy_clarity_parent');}
  const counts=Array.from({length:9},(_,page)=>({page,count:readdirSync(paid).filter(n=>new RegExp(`^(?:r[0-9]+_)?page_${page}_[0-9]+\\.claim\\.json$`).test(n)).length}));
  if(counts.some(({page,count})=>count!==(page===1||page===4?2:page===2?6:1)))fail('anatomy_clarity_counts');
  const wire=json(path.join(paid,'r9_page_7_0_qa.wire.json'));
  if(previewSha(canonicalJson(wire))!==parent.firstOperation.wireDigest)fail('anatomy_clarity_binding');
  const packet=JSON.parse(wire.input[0].content[0].text),context=packet.context,contextSha=packet.contextSha;
  const prior=json(path.join(dir,'scene_repair_7_diagnosis.json')) as AuditionAttempt;
  if(canonicalJson(prior)!==canonicalJson(outcome.results[0].parent)||!prior.candidate||prior.attempt!==0||prior.status!=='held'||!prior.review||!prior.assessment||
    packet.candidateSha!==prior.candidate.imageSha||previewQualityContextSha(context)!==contextSha||context.packet.pageNumber!==7)fail('anatomy_clarity_binding');
  const imageBytes=(i:{imageName:string;imageSha:string})=>{if(!/^[a-z0-9_]+\.png$/.test(i.imageName))fail('anatomy_clarity_binding');const b=bytes(path.join(images,i.imageName));if(previewSha(b)!==i.imageSha)fail('anatomy_clarity_binding');return b;};
  const candidate=prior.candidate??fail('anatomy_clarity_binding');
  const canonical=context.references;canonical.forEach(imageBytes);imageBytes(candidate);const predecessor=context.predecessor?{imageName:context.predecessor.imageName,imageSha:context.predecessor.imageSha}:null;if(predecessor)imageBytes(predecessor);
  const assessment=assessAuditionReview(prior.review,candidate.imageSha,contextSha,context.requirementIds,context.checks.uniqueLandmarks,auditionLandmarkTopology(context),auditionAnatomyCast(context)).assessment;
  if(canonicalJson(assessment)!==canonicalJson(prior.assessment)||attemptStatus('page',prior)!==prior.status)fail('anatomy_clarity_binding');
  // Derivative copies can agree while both contradict the paid answer. Rebind the actual RAW verdict, not merely its price or a duplicate.
  const paidReceipt=json(path.join(paid,'r9_page_7_0_qa.receipt.json'));
  assertAnatomyClarityRawPrior(JSON.parse(paidReceipt.raw.output_text),prior,context,contextSha);
  const request=anatomyClarityRequestSchema.parse({version:A.version,source:'owner_visual_feedback',candidateSha:candidate.imageSha,contextSha,actorId:'companion',ownerApprovalSha:ownerApproval.sha256,
    observation:'Owner reports five apparent legs. Saved reviewer counts four and interprets the central protrusion as a haunch. Clarify the canonical body paths without declaring either historical reading newly proved.'});
  const repair=auditionLocalAnatomyRepairPlan(prior,context,contextSha,canonical,'',request)??fail('anatomy_clarity_binding');
  const render=auditionRenderPlan(images,repair.prompt,repair.references,repair.mode,repair.roles),first='r9_page_7_1' as const;
  if(allowedSteps.some(s=>!auditionMeterRules(s))||auditionMeterRules(first)!.reserve(render.wire)!==render.maximumMicroUsd||
    snapshot.cumulativeAccountedMicroUsd+render.maximumMicroUsd>7000000||ledger.cycleAccountedMicroUsd+render.maximumMicroUsd>8000000)fail('anatomy_clarity_budget');same();
  const plan={cycle:FRESH_BOOK_CYCLE.id,contract:A.version,bookDir:path.resolve(config.bookDir),configurationSha256:parent.configurationSha256,profileSha256:parent.profileSha256,ownerApproval,
    parent:{grantFile:path.resolve(parentFile),grantSha256:A.parentSha,claimSha256:previewSha(bytes(at(SCENE_REPAIR_PRECLAIM_RECOVERY.claimName))),outcomeSha256:previewSha(bytes(at(SCENE_REPAIR_PRECLAIM_RECOVERY.outcomeName)))},
    rootsSha256:previewSha(canonicalJson(roots)),ledgerSha256:previewSha(canonicalJson(ledger)),debits:parent.debits,provision:parent.provision,request,
    transition:{page:7 as const,consumedAttemptsBefore:1 as const,priorSha256:previewSha(canonicalJson(prior)),contextSha256:contextSha,candidateSha256:candidate.imageSha},
    firstOperation:{step:first,wireDigest:previewSha(canonicalJson(render.wire)),maximumMicroUsd:render.maximumMicroUsd},
    allowance:{maxNewImages:1 as const,maxNewCalls:3 as const,totalIncludingParentImages:2 as const,totalIncludingParentCalls:7 as const}};
  const grantDraft=anatomyClarityGrantSchema.parse({...plan,version:'fresh-book-anatomy-clarity-grant/v1',engine:{head:engine.head,branch:engine.branch},pins,nativePlanSha256:previewSha(canonicalJson(plan))});
  return {plan,grantDraft,roots,ledger,snapshot,counts,prior,context,contextSha,canonical,predecessor,repair,render,original,base,allowedSteps,
    state:{claimExists:existsSync(at(A.claimName)),outcomeExists:existsSync(at(A.outcomeName))}};
}

export async function runAnatomyClarity(a:{config:FreshBookConfig;env:FreshBookEnv;grantFile:string;grantSha:string;signal:AbortSignal;log:(s:string)=>void}){
  if(previewSha(bytes(a.grantFile))!==a.grantSha)fail('anatomy_clarity_grant');const g=anatomyClarityGrantSchema.parse(json(a.grantFile));
  const p=await planAnatomyClarity(a.config,a.env,g.parent.grantFile,g.ownerApproval.file);
  if(canonicalJson(g)!==canonicalJson(p.grantDraft)||p.state.claimExists||p.state.outcomeExists)fail('anatomy_clarity_used_or_changed');
  const at=(n:string)=>path.join(a.env.authorityRoot,n),dir=path.join(a.config.bookDir,'audition');
  const same=()=>{const e=a.env.head();if(a.signal.aborted||!e.clean||e.head!==g.engine.head||e.branch!==g.engine.branch)fail('anatomy_clarity_changed');
    for(const[f,h]of Object.entries(g.pins))if(previewSha(bytes(path.join(workspace,f)))!==h)fail('anatomy_clarity_changed');
    for(const[f,h]of [[a.grantFile,a.grantSha],[g.parent.grantFile,g.parent.grantSha256],[g.ownerApproval.file,g.ownerApproval.sha256]])if(previewSha(bytes(f))!==h)fail('anatomy_clarity_changed');
    for(const[f,h]of Object.entries(p.roots.bookFiles))if(previewSha(bytes(path.join(a.config.bookDir,f)))!==h)fail('anatomy_clarity_parent');
    for(const[f,h]of Object.entries(p.roots.authorityFiles))if(previewSha(bytes(at(f)))!==h)fail('anatomy_clarity_parent');};
  same();exclusiveJson(at(A.claimName),{version:A.version,cycle:FRESH_BOOK_CYCLE.id,grantSha256:a.grantSha,parent:g.parent,transition:g.transition,allowance:g.allowance,request:g.request});
  const claimSha=previewSha(bytes(at(A.claimName))),guard=()=>{same();if(previewSha(bytes(at(A.claimName)))!==claimSha||existsSync(at(A.outcomeName)))fail('anatomy_clarity_used');};
  const meter=new AuditionMeter(path.join(dir,'paid-stages'),p.original.capMicroUsd,p.original.maxCalls,p.original.ledger.priorKnownApiMicroUsd,0,auditionMeterRules,g.debits,[g.provision]);
  const io=auditionAdapters({directory:path.join(dir,'illustrations'),meter,key:keyReader(a.config.keyEnvFile),signal:a.signal,guard,expectedWire:{[g.firstOperation.step]:g.firstOperation.wireDigest},allowedSteps:p.allowedSteps,durableReviews:{version:DURABLE_REVIEW_VERSION}});
  const results=[];try{guard();a.log('ANATOMY_CLARITY page=7 explicit owner feedback; old judgment unchanged');
    const r=await repairReviewedAuditionPage({page:7,prefix:'r9_',consumedAttemptsBefore:1,prior:p.prior,context:p.context,contextSha:p.contextSha,canonical:p.canonical,
      predecessor:p.predecessor,clarity:g.request,check:io.check,render:io.render,judge:io.judge,identity:io.identity,save:(n,v)=>exclusiveJson(path.join(dir,n+'.json'),v)});
    results.push(r);if(sceneRepairStops(r))fail('anatomy_clarity_unusable');guard();
    const value={version:A.version,status:'diagnostic_clarity_finished',results,ledger:freshBookLedger(a.config,a.env,p.base.rereview,'child_fresh_anchor',g.debits,[g.provision]),grantSha256:a.grantSha,runtimeEligible:false,productAccepted:false,finishedAt:new Date().toISOString()};exclusiveJson(at(A.outcomeName),value);return value;
  }catch(e){if(!existsSync(at(A.outcomeName)))exclusiveJson(at(A.outcomeName),{version:A.version,status:'failed_anatomy_clarity',code:e instanceof Error?e.message:String(e),results,grantSha256:a.grantSha,finishedAt:new Date().toISOString()});throw e;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(__filename)){
  const arg=(n:string)=>{const i=process.argv.indexOf(n);return i>0?process.argv[i+1]:undefined;},config=freshBookConfig(arg('--config')??fail('anatomy_clarity_args')),env=realFreshBookEnv();
  if(process.argv.includes('--resume'))fail('anatomy_clarity_args');
  const task=process.argv.includes('--execute')?runAnatomyClarity({config,env,grantFile:arg('--grant')??fail('anatomy_clarity_args'),grantSha:arg('--grant-sha')??fail('anatomy_clarity_args'),signal:new AbortController().signal,log:console.log}):
    planAnatomyClarity(config,env,arg('--parent-grant')??fail('anatomy_clarity_args'),arg('--owner-approval')??fail('anatomy_clarity_args')).then(({plan,grantDraft,state,snapshot,counts})=>({plan,grantDraft,state,snapshot,counts}));
  task.then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1;});
}
