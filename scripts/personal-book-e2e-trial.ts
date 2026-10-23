/** ONE newly approved full-book trial. Reuses engine stages; never reopens a historical book authority. Dry by default. */
import 'server-only';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import OpenAI from 'openai';
import { previewSha } from '../lib/local-story-preview';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import { resolvePersonalWizardOptions } from '../lib/personal-wizard/options';
import { prepareSimpleStory } from '../lib/personal-wizard/simple-story-engine';
import { runSimpleWizardBook } from '../lib/personal-wizard/simple-book-flow';
import { runSimpleStoryboardDiagnostic, type SimpleStoryboardDiagnosticCall } from '../lib/personal-wizard/simple-storyboard-diagnostic';
import type { StoryboardRepair } from '../lib/personal-wizard/storyboard-repair';
import { prepareSourceCitationCorrection, applySourceCitationCorrection } from '../lib/personal-wizard/story-source-citations';
import { currentPersonalStoryboardFrame } from '../lib/personal-wizard/storyboard';
import { CHILD_ANCHOR_MATERIALITY_VERSION, CHILD_ANCHOR_POSE_V2, CHILD_ANCHOR_TECHNIQUE_MANIFEST, resolveChildAnchorTechnique } from '../lib/personal-wizard/child-anchor-style';
import { SimpleBookBudget } from '../lib/personal-wizard/simple-book-budget';
import { illustrateReviewedAudition, AUDITION_FRESH_COHORT_VERSION, LANDMARK_COVERAGE_TOPOLOGY_VERSION,
  auditionPageContext, referenceStatus, repairReviewedAuditionPage, selectAuditionAttempt, attemptStatus,
  type SavedPage, type SavedSheet } from '../lib/personal-wizard/simple-book-reviewed-audition';
import { AuditionMeter, auditionAdapters, auditionMeterRules, keyReader, loadReviewedBook, loadReviewedStoryboard,
  reviewedBookLayoutSchema, type MeterRules } from './personal-simple-book-reviewed-audition';
import { readAuditionImage } from './personal-simple-book-illustrator';
import { childAnchorJudges } from './personal-child-anchor-judges';
import { anchorAuthority, inspectedAnchor, FRESH_BOOK_STORYBOARD_PRESENCE_PINNED, flooredReviewRule } from './personal-fresh-book-driver';
import { stageRules, replaySettlement } from './personal-new-book-experiment';
import { prepareCausalWire, createOpusCausalTransport, createAstraCausalTransport, type WirePolicy, type TransportReply } from './personal-causal-trial-adapters';
import { prepareOpusStoryboardWire, createOpusStoryboardTransport, plannerRequest } from './personal-opus-storyboard-transport';
import { simpleWizardVisualPayload } from './personal-simple-wizard-worker';
import { exclusiveJson, exclusiveText, realDirectory } from './personal-causal-trial-journal';
import { longCallFetch } from './personal-long-call-fetch';
import { admitCurrentSimpleStorySource, simpleStoryReadingPackets } from '../lib/personal-wizard/simple-story-source';
import { compileCausalSourceReading } from '../lib/personal-wizard/story-causal-experiment';
import { SOURCE_REVIEW_IMPACT, prepareSourceImpactReview, compileSourceImpactReview,sourceImpactSchema,
  prepareSourceImpactCompletion,compileSourceImpactCompletion } from '../lib/personal-wizard/source-review-impact';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard, storyboardInstructions, storyboardDraftSchema } from '../lib/personal-wizard/storyboard';
import { personalBookOutputLimits } from '../lib/personal-wizard/book-config';
import { decodePersonalBookProviderOutput } from '../lib/personal-wizard/book-openai';
import { STORYBOARD_SELF_CHECK_SOURCE_SPANS_VERSION } from '../lib/personal-wizard/storyboard-self-check';
import { READER_SAFE_FRAMING_VERSION } from '../lib/storybook-scene-framing';

export const BOOK_E2E_TRIAL = Object.freeze({ id:'owner-new-book-e2e-20261023/v1', pages:8, apiCapMicroUsd:7_000_000,
  maxResourceMicroUsd:6_000_000, maxApiCalls:98, sourceRepairs:1, storyboardAttempts:3, citationCorrections:1, pageAttempts:3,
  authorityRoot:'C:/GNart/Work/book-authority', claim:'owner-new-book-e2e-20261023.claim.json', outcome:'owner-new-book-e2e-20261023.outcome.json',
  priorBook:'C:/GNart/Work/book-renders/fresh-book-usd7-20261018',
  routes:{writing:'claude-opus-5-5/claude-max',quality:'gpt-6.1-sol',images:'gpt-image-2/low',numericIdentity:'gpt-4o',identityThreshold:.70} });
/** A second explicit owner decision, not an arbitrary label or reuse of the consumed first book. */
export const READER_SAFE_BOOK_TRIAL = Object.freeze({ ...BOOK_E2E_TRIAL,id:'owner-reader-safe-book-20261023/v1',
  claim:'owner-reader-safe-book-20261023.claim.json',outcome:'owner-reader-safe-book-20261023.outcome.json',
  priorBook:'C:/Users/guyna/.codex/visualizations/2026/09/04/01a06c5c-a233-76c0-ac8e-618c02ce6246/new-book-fresh-fox-20261023',
  readerFraming:READER_SAFE_FRAMING_VERSION,sourceImpactReviews:1,sourceImpactCompletions:1,selfCheckSourceSpans:STORYBOARD_SELF_CHECK_SOURCE_SPANS_VERSION });
const hash=z.string().regex(/^[a-f0-9]{64}$/), absolute=z.string().refine(path.isAbsolute);
const fail=(code:string):never=>{throw Object.assign(new Error(code),{code});};
const read=(file:string):any=>{const s=lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.size>32_000_000)fail('trial_data_file');return JSON.parse(readFileSync(file,'utf8'));};
const shaFile=(file:string)=>previewSha(readFileSync(file));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const source=path.resolve(__dirname,'..');
const git=(...args:string[])=>execFileSync('git',args,{cwd:source,encoding:'utf8'}).trim();
export const trialConfigSchema=z.object({version:z.literal('book-e2e-trial-config/v1'),cycle:z.enum([BOOK_E2E_TRIAL.id,READER_SAFE_BOOK_TRIAL.id]),
  ownerFile:absolute,ownerSha:hash,bookDir:absolute,profileFile:absolute,profileSha:hash,
  executable:absolute,executableSha256:hash,keyFile:absolute}).strict();
export type TrialConfig=z.infer<typeof trialConfigSchema>;
export function bookTrialPolicy(cycle:TrialConfig['cycle']) {
  if(cycle===BOOK_E2E_TRIAL.id)return BOOK_E2E_TRIAL;
  if(cycle===READER_SAFE_BOOK_TRIAL.id)return READER_SAFE_BOOK_TRIAL;
  return fail('trial_cycle');
}
export const trialProfileSchema=z.object({version:z.literal('book-e2e-trial-profile/v1'),seed:z.string().min(8).max(120),
  child:z.object({name:z.string().min(2),age:z.number().int().min(3).max(8),gender:z.enum(['boy','girl']),
    design:z.string().min(40).max(1500),wardrobe:z.string().min(5),fictional:z.literal(true)}).strict(),
  companionId:z.string().min(3),request:z.unknown(),childAnchor:z.literal(CHILD_ANCHOR_MATERIALITY_VERSION)}).strict();
export type TrialProfile=z.infer<typeof trialProfileSchema>;
const CONTRACTS=Object.freeze({actorOwnedAppearance:true,momentContract:true,landmarkKindContract:true,sceneLocationContract:true,
  compilerRulesContract:true,drawnInstantContract:true,visibleMomentContract:true,selfCheckContract:true,reviewImpactPolicy:true,
  selfCheckNames:true,claimBasisContract:true,stagingFields:true,calibrationContract:true,presenceContract:true} as const);
const PINNED=[...new Set([...FRESH_BOOK_STORYBOARD_PRESENCE_PINNED,'scripts/personal-book-e2e-trial.ts',
  'lib/personal-wizard/audition-anatomy.ts','lib/personal-wizard/landmark-topology.ts','lib/personal-wizard/storyboard-presence.ts',
  'lib/personal-wizard/storyboard-calibration.ts','lib/companions.ts','lib/style01-prompt-core.ts','lib/personal-wizard/options.ts',
  'lib/personal-wizard/source-review-impact.ts'])];
function inside(root:string,file:string){const rel=path.relative(path.resolve(root),path.resolve(file));return rel!==''&&!rel.startsWith('..')&&!path.isAbsolute(rel);}
export function validateTrialProfile(raw:unknown,root=source){
  const p=trialProfileSchema.parse(raw),options=resolvePersonalWizardOptions(root),prepared=prepareSimpleStory(p.request,options,p.seed),c=prepared.accepted.canonical;
  if(prepared.book.pages!==8||prepared.accepted.containsFixtureData||c.appearance.photo!=='none'||c.companion.id!==p.companionId||
    c.child.name!==p.child.name||c.child.age!==p.child.age||c.child.address!==p.child.gender||p.companionId==='lion_shaket')fail('trial_profile_scope');
  return {profile:p,options,prepared};
}
/** Pure admission checks. No folder/meter/client/key is created by the dry plan. */
function planTrialInputs(config:TrialConfig,existing=false){
  trialConfigSchema.parse(config);
  const trial=bookTrialPolicy(config.cycle),readerSafe=config.cycle===READER_SAFE_BOOK_TRIAL.id;
  if(readerSafe&&existing)fail('trial_reader_safe_no_legacy_continuation');
  if(shaFile(config.ownerFile)!==config.ownerSha||shaFile(config.profileFile)!==config.profileSha)fail('trial_input_changed');
  const owner=readFileSync(config.ownerFile,'utf8');
  if(!owner.includes('2026-10-23')||!owner.includes('ONE NEW')||!(readerSafe
    ?owner.includes('אוקי בוא נבדוק בספר חדש?')&&owner.includes(READER_SAFE_FRAMING_VERSION)
    :owner.includes('יש אישור לתשלום')))fail('trial_owner_record');
  const context=validateTrialProfile(read(config.profileFile));
  if(path.resolve(config.keyFile)!==path.resolve('C:/GNart/Work/Small_Heroes/.env.local'))fail('trial_existing_key_scope');
  if(git('status','--porcelain')||git('branch','--show-current')!=='claude/book-render-20261009')fail('trial_source_changed');
  realDirectory(path.dirname(config.bookDir));realDirectory(trial.authorityRoot);
  if(inside(source,config.bookDir)||[BOOK_E2E_TRIAL.priorBook,trial.priorBook].some(prior=>inside(prior,config.bookDir)||path.resolve(config.bookDir)===path.resolve(prior))||
    existsSync(config.bookDir)!==existing)fail('trial_output_scope');
  if(!existing&&(existsSync(path.join(trial.authorityRoot,trial.claim))||existsSync(path.join(trial.authorityRoot,trial.outcome))))fail('trial_consumed');
  const exe=lstatSync(config.executable);if(!exe.isFile()||exe.isSymbolicLink()||shaFile(config.executable)!==config.executableSha256)fail('trial_executable_pin');
  const companion=context.options.companions.find(c=>c.id===context.profile.companionId)!;
  const companionPath=path.join(source,'public',companion.image.slice(1));
  const technique=resolveChildAnchorTechnique(source);
  return {version:readerSafe?'reader-safe-book-trial-grant/v1':'book-e2e-trial-grant/v1',cycle:trial.id,configSha:previewSha(canonicalJson(config)),ownerSha:config.ownerSha,
    profileSha:config.profileSha,engine:{head:git('rev-parse','HEAD'),branch:git('branch','--show-current')},
    pins:Object.fromEntries([...PINNED,...(readerSafe?['lib/storybook-scene-framing.ts','lib/local-story-preview.ts']:[]),...CHILD_ANCHOR_TECHNIQUE_MANIFEST.map(t=>t.file)].map(f=>[f,shaFile(path.join(source,f))])),
    companion:{id:companion.id,file:companionPath,sha:shaFile(companionPath)},bookDir:path.resolve(config.bookDir),
    requestId:context.prepared.accepted.requestId,limits:{...trial},contracts:{...CONTRACTS,...(readerSafe?{selfCheckSourceSpans:true}: {})},
    visual:{freshCohort:AUDITION_FRESH_COHORT_VERSION,landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION,structuralAnatomy:true,
      materialSceneRepair:true,detailNonblocking:true,productionQualified:false,...(readerSafe?{readerFraming:READER_SAFE_FRAMING_VERSION,sourceReviewImpact:SOURCE_REVIEW_IMPACT}: {})}};
}
export function planBookTrial(config:TrialConfig){return planTrialInputs(config);}
export type TrialGrant=ReturnType<typeof planBookTrial>;
const SOURCE_SUCCESSOR={claim:'owner-new-book-e2e-20261023-source-impact.claim.json',outcome:'owner-new-book-e2e-20261023-source-impact.outcome.json'} as const;
const SOURCE_COMPLETION={claim:'owner-new-book-e2e-20261023-source-impact-completion.claim.json',outcome:'owner-new-book-e2e-20261023-source-impact-completion.outcome.json'} as const;
const STORYBOARD_SPANS={claim:'owner-new-book-e2e-20261023-storyboard-source-spans.claim.json',outcome:'owner-new-book-e2e-20261023-storyboard-source-spans.outcome.json'} as const;
/** Fixed consumed-parent continuation; no arbitrary source/output/ledger, no replay of author/editor or old execute. */
export function planBookSourceContinuation(config:TrialConfig,completion=false){
  const base=planTrialInputs(config,true),parentGrantFile=completion?
    path.join(path.dirname(path.dirname(config.ownerFile)),'r2-new-book-source-impact-20261023','grant-STAGED.json'):path.join(path.dirname(config.ownerFile),'grant-STAGED.json'),oldGrant=read(parentGrantFile),
    parentClaimFile=path.join(BOOK_E2E_TRIAL.authorityRoot,completion?SOURCE_SUCCESSOR.claim:BOOK_E2E_TRIAL.claim),
    parentOutcomeFile=path.join(BOOK_E2E_TRIAL.authorityRoot,completion?SOURCE_SUCCESSOR.outcome:BOOK_E2E_TRIAL.outcome),
    claim=read(parentClaimFile),outcome=read(parentOutcomeFile),sourceFile=path.join(config.bookDir,'text_1','simple-book-result.json'),held=read(sourceFile);
  if(outcome.status!==(completion?'failed_trial':'held_source')||held.status!=='story_held'||held.storyboard!==null||oldGrant.cycle!==base.cycle||claim.cycle!==base.cycle||outcome.cycle!==base.cycle||
    shaFile(parentGrantFile)!==claim.grantSha||claim.grantSha!==outcome.grantSha||shaFile(parentClaimFile)!==outcome.claimSha||
    claim.configSha!==previewSha(canonicalJson(config))||oldGrant.configSha!==claim.configSha||
    path.resolve(oldGrant.bookDir)!==path.resolve(config.bookDir)||!same(oldGrant.limits,BOOK_E2E_TRIAL)||
    oldGrant.ownerSha!==base.ownerSha||oldGrant.profileSha!==base.profileSha||!same(oldGrant.companion,base.companion)||
    readdirSync(path.join(config.bookDir,'illustrations')).length||existsSync(path.join(config.bookDir,'child')))fail('trial_source_parent');
  for(const name of Object.values(completion?SOURCE_COMPLETION:SOURCE_SUCCESSOR))if(existsSync(path.join(BOOK_E2E_TRIAL.authorityRoot,name)))fail('trial_source_continuation_consumed');
  const sourceResult=admitCurrentSimpleStorySource(baseRequest(config),held.source,resolvePersonalWizardOptions(source));
  const packets=simpleStoryReadingPackets(baseRequest(config),sourceResult,resolvePersonalWizardOptions(source));
  if(held.readings.length!==2)fail('trial_source_readings');
  [packets.final,packets.comparison].forEach((packet,n)=>{
    if(!same(compileCausalSourceReading(packet,held.readings[n].sourceEvidence.output),held.readings[n]))fail('trial_source_readings');
  });
  const api=new TrialApiMeter(path.join(config.bookDir,'paid-stages')).snapshot(),max=new TrialMaxBudget(path.join(config.bookDir,'claude-max-stages'),'').snapshot();
  if(api.unknownCost||api.unknownOutcome||api.reservedUnsettledMicroUsd||max.unknownAttemptCosts||max.stopped||
    !same(api,outcome.accounting.api)||!same(max,outcome.accounting.claudeMax)||api.calls!==(completion?6:5)||max.logicalAttempts!==3)fail('trial_source_accounting');
  const impactReceiptFile=completion?path.join(config.bookDir,'paid-stages','source_impact_review.receipt.json'):null;
  if(impactReceiptFile){
    const r=read(impactReceiptFile),raw=sourceImpactSchema.parse(JSON.parse(r.raw.output_text));
    if(oldGrant.version!=='book-e2e-source-impact-continuation/v1'||oldGrant.sourceImpact!==SOURCE_REVIEW_IMPACT||!same(raw,r.output)||
      existsSync(path.join(config.bookDir,'source-impact-admission.json')))fail('trial_source_completion_parent');
    const p=prepareSourceImpactReview({finalPacket:packets.final,readings:held.readings,sourceSha:shaFile(sourceFile),age:validateTrialProfile(read(config.profileFile)).profile.child.age});
    prepareSourceImpactCompletion(p,raw); // Existing typed guards/rows/evidence must pass before a completion claim.
  }
  const ancestorFiles:Record<string,string>=completion?{[oldGrant.parent.grantFile]:oldGrant.parent.grantSha,
    [oldGrant.parent.claimFile]:oldGrant.parent.claimSha,[oldGrant.parent.outcomeFile]:oldGrant.parent.outcomeSha}:{};
  for(const [file,sha]of Object.entries(ancestorFiles))if(shaFile(file)!==sha)fail('trial_source_ancestor_changed');
  const files:Record<string,string>={};
  const walk=(directory:string)=>{for(const name of readdirSync(directory)){const f=path.join(directory,name),s=lstatSync(f);
    if(s.isSymbolicLink())fail('trial_source_file');if(s.isDirectory())walk(f);else if(s.isFile())files[path.relative(config.bookDir,f)]=shaFile(f);else fail('trial_source_file');}};
  walk(config.bookDir);
  return {...base,version:completion?'book-e2e-source-impact-completion/v1':'book-e2e-source-impact-continuation/v1',sourceImpact:SOURCE_REVIEW_IMPACT,
    parent:{grantFile:parentGrantFile,grantSha:shaFile(parentGrantFile),claimFile:parentClaimFile,claimSha:shaFile(parentClaimFile),
      outcomeFile:parentOutcomeFile,outcomeSha:shaFile(parentOutcomeFile),sourceFile,sourceSha:shaFile(sourceFile),files,
      impactReceiptFile,impactReceiptSha:impactReceiptFile?shaFile(impactReceiptFile):null,ancestorFiles},
    remaining:{newSourceImpactReviews:completion?0:1,newSourceImpactCompletions:completion?1:0,sourceWriting:0,sourceRepairs:0,citationCorrections:0,storyboardAttempts:3,childAttempts:2,pageAttempts:3}};
}
const baseRequest=(config:TrialConfig)=>validateTrialProfile(read(config.profileFile)).prepared.accepted.canonical;
export type SourceContinuationGrant=ReturnType<typeof planBookSourceContinuation>;

const wirePolicy=(config:TrialConfig,workspace:string):WirePolicy=>({executable:config.executable,executableSha256:config.executableSha256,workspace,maxWireBytes:104000,
  rates:{opus:replaySettlement.rates.opus,astra:replaySettlement.rates.sol},openAIReviewModel:'gpt-6.1-sol',astraInlineReferences:true,plannerSchema:'definition-names/v1'});

/** Recompile the known untouched planner output through ALL current contracts, with exact old wire/raw provenance and a new compile marker. */
export function prepareTrialSavedStoryboard(config:TrialConfig){
  const held=read(path.join(config.bookDir,'text_1/simple-book-result.json')),request=baseRequest(config),options=resolvePersonalWizardOptions(source),
    dir=path.join(config.bookDir,'text_4'),repairFile=path.join(dir,'storyboard_repair_input.json'),repair=read(repairFile),
    draftReceiptFile=path.join(config.bookDir,'claude-max-stages/s4_storyboard.receipt.json'),receipt=read(draftReceiptFile),draft=receipt.output;
  const input=prepareCurrentPersonalStoryboard(request,held.source,options,true,true,true,undefined,true,true,repair,true,true,true,true,true,true,true);
  const call:SimpleStoryboardDiagnosticCall={stage:'storyboard',instructions:storyboardInstructions(input),input:canonicalJson(input.planningInput),schema:storyboardDraftSchema(input),
    maxOutputTokens:personalBookOutputLimits(input.story.pages.length,{selfCheck:true}).storyboardOutputTokens,
    context:{narrativeSpreads:input.story.pages.length,sourceDigest:input.sourceDigest,actorOwnedAppearance:true,momentContract:true,landmarkKindContract:true,
      drawnInstantContract:true,selfCheckContract:true,claimBasisContract:true,calibrationContract:true,presenceContract:true}};
  const wire=prepareOpusStoryboardWire(call,wirePolicy(config,path.join(dir,'cli-workspace')),path.join(dir,'storyboard-instructions.txt'));
  if(!same(wire,read(path.join(config.bookDir,'claude-max-stages/s4_storyboard.wire.json')))||
    !same(decodePersonalBookProviderOutput(call,JSON.parse(receipt.raw.stdout).structured_output),draft))fail('trial_saved_planner_binding');
  let oldError='';try{compilePersonalStoryboard(input,draft,{selfCheckNames:true,stagingFields:true});}catch(e){oldError=(e as Error).message;}
  if(oldError!=='storyboard_self_check_key_event_instant')fail('trial_saved_planner_not_diagnosed');
  const book=compilePersonalStoryboard(input,draft,{selfCheckNames:true,stagingFields:true,selfCheckSourceSpans:true});
  return{held,repair,repairFile,draftReceiptFile,draft,book,call,wire};
}

/** Fixed terminal-parent successor; the first review of the already-paid second plan, then ONLY the original third/last plan if held. */
export function planBookStoryboardSpanContinuation(config:TrialConfig){
  const base=planTrialInputs(config,true),parentGrantFile=path.join(path.dirname(path.dirname(config.ownerFile)),'r2-new-book-source-completion-20261023/grant-STAGED.json'),
    old=read(parentGrantFile),parentClaimFile=path.join(BOOK_E2E_TRIAL.authorityRoot,SOURCE_COMPLETION.claim),parentOutcomeFile=path.join(BOOK_E2E_TRIAL.authorityRoot,SOURCE_COMPLETION.outcome),
    claim=read(parentClaimFile),outcome=read(parentOutcomeFile),sourceFile=path.join(config.bookDir,'text_1/simple-book-result.json'),held=read(sourceFile);
  if(old.version!=='book-e2e-source-impact-completion/v1'||outcome.status!=='failed_trial'||held.status!=='story_held'||held.storyboard!==null||
    old.cycle!==base.cycle||claim.cycle!==base.cycle||outcome.cycle!==base.cycle||shaFile(parentGrantFile)!==claim.grantSha||claim.grantSha!==outcome.grantSha||
    shaFile(parentClaimFile)!==outcome.claimSha||claim.configSha!==base.configSha||old.configSha!==base.configSha||old.ownerSha!==base.ownerSha||old.profileSha!==base.profileSha||
    path.resolve(old.bookDir)!==path.resolve(base.bookDir)||!same(old.limits,BOOK_E2E_TRIAL)||!same(old.companion,base.companion)||old.parent.sourceSha!==shaFile(sourceFile)||
    readdirSync(path.join(config.bookDir,'illustrations')).length||existsSync(path.join(config.bookDir,'child'))||existsSync(path.join(config.bookDir,'text_4_source_spans'))||
    existsSync(path.join(config.bookDir,'paid-stages/s4_storyboard_review.claim.json'))||existsSync(path.join(config.bookDir,'claude-max-stages/s5_storyboard.claim.json')))fail('trial_span_parent');
  for(const name of Object.values(STORYBOARD_SPANS))if(existsSync(path.join(BOOK_E2E_TRIAL.authorityRoot,name)))fail('trial_span_consumed');
  const api=new TrialApiMeter(path.join(config.bookDir,'paid-stages')).snapshot(),max=new TrialMaxBudget(path.join(config.bookDir,'claude-max-stages'),'').snapshot();
  if(api.calls!==8||max.logicalAttempts!==5||api.unknownCost||api.unknownOutcome||api.reservedUnsettledMicroUsd||max.unknownAttemptCosts||max.stopped||
    !same(api,outcome.accounting.api)||!same(max,outcome.accounting.claudeMax))fail('trial_span_accounting');
  const planners=readdirSync(path.join(config.bookDir,'claude-max-stages')).filter(n=>/^s\d+_storyboard\.claim\.json$/.test(n)).sort();
  if(!same(planners,['s3_storyboard.claim.json','s4_storyboard.claim.json']))fail('trial_span_attempts');
  const packets=simpleStoryReadingPackets(baseRequest(config),held.source,resolvePersonalWizardOptions(source));
  if(held.readings.length!==2)fail('trial_span_source');
  [packets.final,packets.comparison].forEach((p,n)=>{if(!same(compileCausalSourceReading(p,held.readings[n].sourceEvidence.output),held.readings[n]))fail('trial_span_source');});
  const review=prepareSourceImpactReview({finalPacket:packets.final,readings:held.readings,sourceSha:shaFile(sourceFile),age:validateTrialProfile(read(config.profileFile)).profile.child.age}),
    partialReceipt=read(path.join(config.bookDir,'paid-stages/source_impact_review.receipt.json')),
    completedReceipt=read(path.join(config.bookDir,'paid-stages/source_impact_completion.receipt.json'));
  if(!same(sourceImpactSchema.parse(JSON.parse(partialReceipt.raw.output_text)),partialReceipt.output))fail('trial_span_admission');
  const completion=prepareSourceImpactCompletion(review,partialReceipt.output),completed=completion.schema.parse(JSON.parse(completedReceipt.raw.output_text)),
    admission=compileSourceImpactCompletion(completion,completed);
  if(!same(completed,completedReceipt.output)||admission.status!=='diagnostic_source_supported_with_notes'||
    !same(admission,read(path.join(config.bookDir,'source-impact-admission.json'))))fail('trial_span_admission');
  const replay=prepareTrialSavedStoryboard(config),ancestorFiles:Record<string,string>={...old.parent.ancestorFiles,
    [old.parent.grantFile]:old.parent.grantSha,[old.parent.claimFile]:old.parent.claimSha,[old.parent.outcomeFile]:old.parent.outcomeSha};
  for(const [file,sha]of Object.entries(ancestorFiles))if(shaFile(file)!==sha)fail('trial_span_ancestor_changed');
  const files:Record<string,string>={};const walk=(dir:string)=>{for(const name of readdirSync(dir)){const file=path.join(dir,name),s=lstatSync(file);
    if(s.isSymbolicLink())fail('trial_span_file');if(s.isDirectory())walk(file);else if(s.isFile())files[path.relative(config.bookDir,file)]=shaFile(file);else fail('trial_span_file');}};walk(config.bookDir);
  for(const [file,sha]of Object.entries(old.parent.files))if(files[file]!==sha)fail('trial_span_parent_changed');
  return{...base,version:'book-e2e-storyboard-source-spans/v1',selfCheckSourceSpans:STORYBOARD_SELF_CHECK_SOURCE_SPANS_VERSION,
    parent:{grantFile:parentGrantFile,grantSha:shaFile(parentGrantFile),claimFile:parentClaimFile,claimSha:shaFile(parentClaimFile),outcomeFile:parentOutcomeFile,outcomeSha:shaFile(parentOutcomeFile),
      sourceFile,sourceSha:shaFile(sourceFile),files,ancestorFiles,impactReceiptFile:null,impactReceiptSha:null,repairFile:replay.repairFile,draftReceiptFile:replay.draftReceiptFile,
      draftSha:previewSha(canonicalJson(replay.draft)),recompiledSourceDigest:replay.book.sourceDigest,recompiledStoryboardDigest:replay.book.storyboardDigest},
    remaining:{newSourceImpactReviews:0,newSourceImpactCompletions:0,sourceWriting:0,sourceRepairs:0,citationCorrections:0,
      replayKnownPlanner:true,firstReviewOfSecondPlanner:1,storyboardAttempts:1,storyboardAttemptsAlreadyConsumed:2,childAttempts:2,pageAttempts:3}};
}
export type StoryboardSpanGrant=ReturnType<typeof planBookStoryboardSpanContinuation>;
/** Reader and storyboard rules retain the ordinary reservation floor. Everything else uses the original adapters' exact rule. */
export const trialApiRules:MeterRules=step=>{
  if(step==='source_impact_review'||step==='source_impact_completion')return flooredReviewRule(stageRules.text.final_review);
  const text=/^s[0-3]_(final_review|comparison|storyboard_review|citation_correction)$/.exec(step);
  if(text)return flooredReviewRule(stageRules.text[text[1]==='citation_correction'?'comparison':text[1]]);
  if(/^s[2-5]_storyboard_review$/.test(step))return flooredReviewRule(stageRules.text.storyboard_review);
  if(Object.prototype.hasOwnProperty.call(stageRules.childAnchor,step))return stageRules.childAnchor[step];
  return auditionMeterRules(step);
};
/** Existing typed classifiers only: one fresh severity answer, at most one eligible missing-coverage completion. No blind retry. */
export async function runTrialSourceImpact(review:ReturnType<typeof prepareSourceImpactReview>,
  dispatch:(request:ReturnType<typeof prepareSourceImpactReview>|ReturnType<typeof prepareSourceImpactCompletion>,stage:'source_impact_review'|'source_impact_completion')=>Promise<unknown>) {
  const raw=await dispatch(review,'source_impact_review');
  try{return compileSourceImpactReview(review,raw);}
  catch{
    const completion=prepareSourceImpactCompletion(review,raw);
    return compileSourceImpactCompletion(completion,await dispatch(completion,'source_impact_completion'));
  }
}
export class TrialApiMeter extends AuditionMeter{
  constructor(root:string,readonly prefix=''){super(root,BOOK_E2E_TRIAL.apiCapMicroUsd,BOOK_E2E_TRIAL.maxApiCalls,0,0,trialApiRules);}
  override run<T>(step:string,wire:unknown,maximum:number,dispatch:()=>Promise<{value:T;estimatedMicroUsd:number|null;receipt:unknown}>){
    return super.run(this.prefix+step,wire,maximum,dispatch);
  }
}
/** Shared Max journal, with the tighter trial guard before every session. Reported resource cost is never called an API charge. */
export class TrialMaxBudget extends SimpleBookBudget{
  constructor(root:string,readonly prefix:string){super(root,0);}
  override snapshot(){
    const s=super.snapshot();
    for(const name of readdirSync(this.root).filter(n=>n.endsWith('.receipt.json'))){
      const r=read(path.join(this.root,name)),done=read(path.join(this.root,name.replace('.receipt.','.result.')));
      let raw:any;try{raw=JSON.parse(r.raw.stdout);}catch{if(done.completed===false&&r.estimatedMicroUsd===null&&done.estimatedMicroUsd===null)continue;fail('trial_max_raw');}
      const cost=typeof raw.total_cost_usd==='number'?Math.ceil(raw.total_cost_usd*1e6):null;
      if(cost!==r.estimatedMicroUsd||cost!==done.estimatedMicroUsd||done.completed===true&&(r.raw.termination?.code!==0||
        !same(Object.keys(raw.modelUsage??{}),['claude-opus-5-5'])))fail('trial_max_raw');
    }
    return s;
  }
  override run<T>(step:string,wire:unknown,maximum:number,dispatch:()=>Promise<{value:T;estimatedMicroUsd:number|null;receipt:unknown}>){
    if(maximum!==2_000_000)fail('trial_max_session_guard');
    const state=this.snapshot();
    if(state.stopped||state.accountedMicroUsd+maximum>BOOK_E2E_TRIAL.maxResourceMicroUsd)fail('trial_max_cap');
    return super.run(this.prefix+step,wire,maximum,dispatch);
  }
}
const admittedStatus=(s:string)=>s==='review_supported'||s==='review_supported_with_notes';
export async function executeBookTrial(config:TrialConfig,grantFile:string,grantSha:string,signal:AbortSignal,log:(s:string)=>void){
  const trial=bookTrialPolicy(config.cycle),readerSafe=config.cycle===READER_SAFE_BOOK_TRIAL.id,
    contracts={...CONTRACTS,...(readerSafe?{selfCheckSourceSpans:true as const}:{})};
  if(shaFile(grantFile)!==grantSha)fail('trial_grant_changed');
  const grant=read(grantFile) as TrialGrant|SourceContinuationGrant|StoryboardSpanGrant,spanning=grant.version==='book-e2e-storyboard-source-spans/v1',completing=grant.version==='book-e2e-source-impact-completion/v1',
    isSourceContinuation=completing||grant.version==='book-e2e-source-impact-continuation/v1',
    parent=spanning?(grant as StoryboardSpanGrant).parent:isSourceContinuation?(grant as SourceContinuationGrant).parent:null,
    plan=spanning?planBookStoryboardSpanContinuation(config):isSourceContinuation?planBookSourceContinuation(config,completing):planBookTrial(config);
  if(!same(grant,plan))fail('trial_plan_changed');
  const configDigest=previewSha(canonicalJson(config));
  const currentInputs=()=>{
    if(signal.aborted||shaFile(grantFile)!==grantSha||shaFile(config.ownerFile)!==grant.ownerSha||
      shaFile(config.profileFile)!==grant.profileSha||previewSha(canonicalJson(config))!==configDigest||
      git('rev-parse','HEAD')!==grant.engine.head||git('branch','--show-current')!==grant.engine.branch||git('status','--porcelain'))fail('trial_binding_changed');
    for(const [file,sha]of Object.entries(grant.pins))if(shaFile(path.join(source,file))!==sha)fail('trial_source_pin');
    if(shaFile(grant.companion.file)!==grant.companion.sha)fail('trial_companion_pin');
    if(parent){
      for(const [file,sha]of Object.entries(parent.files))if(shaFile(path.join(config.bookDir,file))!==sha)fail('trial_source_parent_changed');
      for(const [file,sha]of [[parent.grantFile,parent.grantSha],[parent.claimFile,parent.claimSha],[parent.outcomeFile,parent.outcomeSha]])if(shaFile(file)!==sha)fail('trial_source_parent_changed');
      for(const [file,sha]of Object.entries(parent.ancestorFiles))if(shaFile(file)!==sha)fail('trial_source_ancestor_changed');
    }
  };
  currentInputs();
  const claimFile=path.join(trial.authorityRoot,spanning?STORYBOARD_SPANS.claim:completing?SOURCE_COMPLETION.claim:parent?SOURCE_SUCCESSOR.claim:trial.claim),
    outcomeFile=path.join(trial.authorityRoot,spanning?STORYBOARD_SPANS.outcome:completing?SOURCE_COMPLETION.outcome:parent?SOURCE_SUCCESSOR.outcome:trial.outcome);
  exclusiveJson(claimFile,{cycle:trial.id,grantSha,configSha:configDigest,ownerSha:grant.ownerSha,bookDir:grant.bookDir,engine:grant.engine,
    ...(parent?{parentClaimSha:parent.claimSha,parentOutcomeSha:parent.outcomeSha,sourceSha:parent.sourceSha}:{} )});
  const claimSha=shaFile(claimFile);
  let sourceAdmissionSha:string|null=spanning?shaFile(path.join(config.bookDir,'source-impact-admission.json')):null;
  const guard=()=>{currentInputs();if(shaFile(claimFile)!==claimSha||existsSync(outcomeFile)||
    sourceAdmissionSha&&shaFile(path.join(config.bookDir,'source-impact-admission.json'))!==sourceAdmissionSha)fail('trial_claim_changed');};
  if(!parent)mkdirSync(config.bookDir);const imageDir=path.join(config.bookDir,'illustrations');if(!parent)mkdirSync(imageDir);
  const apiRoot=path.join(config.bookDir,'paid-stages'),maxRoot=path.join(config.bookDir,'claude-max-stages');
  const meter=new TrialApiMeter(apiRoot),max=new TrialMaxBudget(maxRoot,'');
  const {profile,options,prepared}=validateTrialProfile(read(config.profileFile));
  const key=keyReader(config.keyFile);
  const save=(name:string,value:unknown)=>exclusiveJson(path.join(config.bookDir,`${name}.json`),value);
  const policy=wirePolicy(config,config.bookDir),continuationTextIndex=completing||spanning?3:2;
  let citationUsed=parent?1:0,sourceRepairUsed=parent?1:0,boardAttempts=spanning?2:0,finalTextDir=spanning?'text_4_source_spans':parent?`text_${continuationTextIndex}`:'text';
  if(!parent)save('request',{version:'local-simple-wizard-request/v1',requestId:prepared.accepted.requestId,optionsFingerprint:prepared.accepted.optionsFingerprint,
    request:prepared.accepted.canonical,consent:'fictional_new_full_book_trial',cycle:trial.id});
  const baseCurrent={request:prepared.accepted.canonical,options};
  const stageIO=(index:number,replay=false)=>{
    const dir=path.join(config.bookDir,replay?'text_4_source_spans':index===0?'text':`text_${index}`);mkdirSync(dir);mkdirSync(path.join(dir,'cli-workspace'));
    const budget=new TrialMaxBudget(maxRoot,`s${index}_`),api=new TrialApiMeter(apiRoot,`s${index}_`),
      writingPolicy={...policy,workspace:path.join(dir,'cli-workspace')},opus=createOpusCausalTransport(writingPolicy),
      reader=createAstraCausalTransport({key,rates:replaySettlement.rates.sol,model:'gpt-6.1-sol',inlineReferences:true,fetch:longCallFetch(660000)});
    let draft:unknown=null;
    const dispatch=(call:any,role:'opus'|'astra')=>({...call,role,conversationKey:`trial:${grant.requestId}:${index}:${call.stage}`});
    const doRead=async(call:any,s:AbortSignal)=>{
      guard();const d=dispatch(call,'astra'),wire=prepareCausalWire(d,writingPolicy,2_000_000),rule=trialApiRules(`s${index}_${call.stage}`),reserve=rule?.reserve(wire)??fail('trial_reader_wire');
      return api.run(call.stage,wire,reserve,async()=>{const r=await reader(wire,d,s);return{value:r.output,estimatedMicroUsd:r.estimatedMicroUsd,receipt:r};});
    };
    const visual=async(call:SimpleStoryboardDiagnosticCall,s:AbortSignal)=>{
      guard();
      if(call.stage==='storyboard'){
        if(replay){
          const bound=prepareTrialSavedStoryboard(config);
          if(!same(plannerRequest(call),plannerRequest(bound.call)))fail('trial_saved_planner_changed');
          draft=bound.draft;log('phase known_storyboard_recompile');return structuredClone(bound.draft);
        }
        if(boardAttempts++>=BOOK_E2E_TRIAL.storyboardAttempts)fail('trial_storyboard_cap');
        log(`phase storyboard_plan_attempt_${boardAttempts}`);
        const file=path.join(dir,'storyboard-instructions.txt');exclusiveText(file,plannerRequest(call).instructions);
        const wire=prepareOpusStoryboardWire(call,writingPolicy,file);
        return budget.run('storyboard',wire,2_000_000,async()=>{
          const r=await createOpusStoryboardTransport(writingPolicy)(wire,call,s);draft=r.output;return{value:r.output,estimatedMicroUsd:r.estimatedMicroUsd,receipt:r};});
      }
      const payload=simpleWizardVisualPayload(call,'gpt-6.1-sol'),reserve=trialApiRules(`s${index}_storyboard_review`)?.reserve(payload)??fail('trial_review_wire');
      return api.run('storyboard_review',payload,reserve,async()=>{
        const raw=await new OpenAI({apiKey:key(),baseURL:'https://api.openai.com/v1',maxRetries:0,logLevel:'off',fetch:longCallFetch(660000)})
          .responses.create(payload,{signal:s,timeout:600000});
        const settled=replaySettlement.answer(replaySettlement.rates.sol,call.maxOutputTokens,'gpt-6.1-sol',raw),
          receipt={raw,usage:settled.usage,estimatedMicroUsd:settled.estimatedMicroUsd,model:raw.model,stage:'storyboard_review'};
        if(!settled.valid)throw Object.assign(new Error('trial_review_invalid'),{receipt});
        let value:unknown;try{const {decodePersonalBookProviderOutput}=await import('../lib/personal-wizard/book-openai');value=decodePersonalBookProviderOutput(call,JSON.parse(raw.output_text));}
        catch{throw Object.assign(new Error('trial_review_schema'),{receipt});}
        return{value,estimatedMicroUsd:settled.estimatedMicroUsd,receipt};
      });
    };
    return{dir,visual,draft:()=>draft,
      opus:async(call:any,s:AbortSignal)=>{guard();const d=dispatch(call,'opus'),file=path.join(dir,`${call.stage}-instructions.txt`);exclusiveText(file,call.instructions);
        const wire=prepareCausalWire(d,writingPolicy,2_000_000,file);
        return budget.run(call.stage,wire,2_000_000,async()=>{const r=await opus(wire,d,s);return{value:r,estimatedMicroUsd:r.estimatedMicroUsd,receipt:r};});},
      reader:doRead,
      correctReading:async(stage:any,numbered:any,raw:unknown,s:AbortSignal)=>{
        if(citationUsed++>=BOOK_E2E_TRIAL.citationCorrections)fail('trial_citation_used');
        const correction=prepareSourceCitationCorrection(numbered,raw);
        exclusiveJson(path.join(dir,'citation-correction-request.json'),{stage,failed:raw,correctionDigest:correction.correctionDigest,body:correction.body});
        const answer=await doRead({stage:'citation_correction',instructions:correction.instructions,input:correction.input,schema:correction.schema,maxOutputTokens:16000},s);
        const applied=applySourceCitationCorrection(numbered,raw,correction,answer);
        exclusiveJson(path.join(dir,'citation-correction.json'),applied);return applied.corrected;
      }};
  };
  let result:Awaited<ReturnType<typeof runSimpleWizardBook>>;
  const finish=(status:string,extra:Record<string,unknown>={})=>{
    const snapshot=(read:()=>unknown)=>{try{return read();}catch(error){return{status:'unreconciled',knownMicroUsd:null,error:(error as any)?.code??'accounting_replay_failed',furtherPaymentAllowed:false};}};
    const accounting={api:snapshot(()=>meter.snapshot()),claudeMax:snapshot(()=>max.snapshot()),claudeMaxNote:'reported resource, separate from API, not invoice'};
    save(spanning?'storyboard-source-spans-final-accounting':completing?'source-impact-completion-final-accounting':parent?'source-impact-final-accounting':'final-accounting',accounting);exclusiveJson(outcomeFile,{cycle:trial.id,claimSha,grantSha,status,accounting,...extra,
      ...(parent?{parentClaimSha:parent.claimSha,parentOutcomeSha:parent.outcomeSha,originalLiteraryHoldPreserved:true}:{}),
      runtimeEligible:false,productAccepted:false,productionQualified:false});return{status,accounting,...extra};
  };
  try{
    let io=stageIO(spanning?4:parent?continuationTextIndex:0,spanning);
    const runFlow=(io:ReturnType<typeof stageIO>,repair?:{prior:unknown;readings:unknown[]})=>runSimpleWizardBook({...baseCurrent,seed:profile.seed,signal,
      reservedWritingUsd:2,...contracts,...(repair?{repair}:{}),opus:io.opus,reader:io.reader,visual:io.visual,correctReading:io.correctReading,
      publish:view=>log(`phase ${view.phase}`)});
    let sourceAdmission:ReturnType<typeof compileSourceImpactReview>|undefined;
    if(spanning){
      const held=read(parent!.sourceFile);sourceAdmission=read(path.join(config.bookDir,'source-impact-admission.json'));
      const repair=read((parent as StoryboardSpanGrant['parent']).repairFile);exclusiveJson(path.join(io.dir,'storyboard_repair_input.json'),repair);
      const board=await runSimpleStoryboardDiagnostic({...baseCurrent,writerResult:held.source,signal,...CONTRACTS,selfCheckSourceSpans:true,repair,generate:io.visual});
      result={...held,status:board.status,storyboard:board};
    }else if(parent){
      const held=read(parent.sourceFile),packets=simpleStoryReadingPackets(prepared.accepted.canonical,held.source,options),
        review=prepareSourceImpactReview({finalPacket:packets.final,readings:held.readings,sourceSha:parent.sourceSha,age:profile.child.age});
      const completion=completing?prepareSourceImpactCompletion(review,read(parent.impactReceiptFile!).output):null,
        request=completion??review,stage=completing?'source_impact_completion':'source_impact_review',
        binding=completion?{completionDigest:completion.completionDigest}:{packetDigest:review.packetDigest};
      save(completing?'source-impact-completion-request':'source-impact-request',{...binding,instructions:request.instructions,body:request.body});
      const call:any={stage,role:'astra',conversationKey:`trial:${grant.requestId}:${stage}`,instructions:request.instructions,
        input:canonicalJson({...binding,packet:request.body}),schema:request.schema,maxOutputTokens:request.maxOutputTokens};
      const wire=prepareCausalWire(call,policy,2_000_000),rule=trialApiRules(stage)!,reader=createAstraCausalTransport({key,rates:replaySettlement.rates.sol,model:'gpt-6.1-sol',inlineReferences:true,fetch:longCallFetch(660000)});
      guard();log(`phase ${stage}`);
      const raw=await meter.run(stage,wire,rule.reserve(wire)!,async()=>{const r=await reader(wire,call,signal);return{value:r.output,estimatedMicroUsd:r.estimatedMicroUsd,receipt:r};});
      sourceAdmission=completion?compileSourceImpactCompletion(completion,raw):compileSourceImpactReview(review,raw);save('source-impact-admission',sourceAdmission);
      sourceAdmissionSha=shaFile(path.join(config.bookDir,'source-impact-admission.json'));
      if(sourceAdmission.status!=='diagnostic_source_supported_with_notes')return finish('held_source_impact',{sourceAdmission});
      log('phase storyboard');
      const board=await runSimpleStoryboardDiagnostic({...baseCurrent,writerResult:held.source,signal,...CONTRACTS,generate:io.visual});
      result={...held,status:board.status,storyboard:board};
    }else result=await runFlow(io);
    const saveText=()=>{exclusiveJson(path.join(io.dir,'simple-book-result.json'),result);
      if(result?.storyboard){exclusiveJson(path.join(io.dir,'visual_simple_book_result.json'),{...result,...(sourceAdmission?{sourceImpactAdmission:sourceAdmission}:{} )});exclusiveJson(path.join(io.dir,'owned_storyboard_draft.json'),io.draft());}};
    saveText();
    if(result!.status==='story_held'&&!parent){
      if(sourceRepairUsed++>=BOOK_E2E_TRIAL.sourceRepairs)fail('trial_source_repair_used');
      const prior=result;io=stageIO(1);finalTextDir='text_1';result=await runFlow(io,{prior:prior.source,readings:prior.readings});saveText();
    }
    if(result!.status==='story_held'&&readerSafe){
      // ONE fresh typed severity review after the bounded source repair. Old literary HOLD/raws remain unchanged.
      const held=result,sourceFile=path.join(io.dir,'simple-book-result.json'),packets=simpleStoryReadingPackets(prepared.accepted.canonical,held.source,options),
        review=prepareSourceImpactReview({finalPacket:packets.final,readings:held.readings,sourceSha:shaFile(sourceFile),age:profile.child.age});
      const readImpact=async(request:ReturnType<typeof prepareSourceImpactReview>|ReturnType<typeof prepareSourceImpactCompletion>,stage:'source_impact_review'|'source_impact_completion')=>{
        const binding='completionDigest' in request?{completionDigest:request.completionDigest}:{packetDigest:request.packetDigest};
        save(stage+'-request',{...binding,instructions:request.instructions,body:request.body});
        const call:any={stage,role:'astra',conversationKey:`trial:${grant.requestId}:${stage}`,instructions:request.instructions,
          input:canonicalJson({...binding,packet:request.body}),schema:request.schema,maxOutputTokens:request.maxOutputTokens};
        const wire=prepareCausalWire(call,policy,2_000_000),rule=trialApiRules(stage)!,reader=createAstraCausalTransport({key,rates:replaySettlement.rates.sol,model:'gpt-6.1-sol',inlineReferences:true,fetch:longCallFetch(660000)});
        guard();log(`phase ${stage}`);
        return meter.run(stage,wire,rule.reserve(wire)!,async()=>{const r=await reader(wire,call,signal);return{value:r.output,estimatedMicroUsd:r.estimatedMicroUsd,receipt:r};});
      };
      sourceAdmission=await runTrialSourceImpact(review,readImpact);
      save('source-impact-admission',sourceAdmission);sourceAdmissionSha=shaFile(path.join(config.bookDir,'source-impact-admission.json'));
      if(sourceAdmission.status!=='diagnostic_source_supported_with_notes')return finish('held_source_impact',{sourceAdmission});
      io=stageIO(2);finalTextDir='text_2';
      const board=await runSimpleStoryboardDiagnostic({...baseCurrent,writerResult:held.source,signal,...contracts,generate:io.visual});
      result={...held,status:board.status,storyboard:board};saveText();
    }
    if(result!.status==='story_held')return finish('held_source');
    let repair:StoryboardRepair|undefined=spanning?read((parent as StoryboardSpanGrant['parent']).repairFile):undefined;
    while(!admittedStatus(result.status)&&result.storyboard&&boardAttempts<BOOK_E2E_TRIAL.storyboardAttempts){
      const old=result.storyboard;
      repair={parentStoryboardDigest:old.storyboardDigest,draft:io.draft(),review:old.rawReview,...(repair?{parentRepair:repair}:{}),
        parentCompile:{selfCheckNames:true,stagingFields:true,...(spanning||readerSafe?{selfCheckSourceSpans:true as const}:{})}};
      const index=parent?boardAttempts+continuationTextIndex:(boardAttempts+(sourceRepairUsed?1:0)+(sourceAdmission?1:0));io=stageIO(index);finalTextDir=path.basename(io.dir);
      exclusiveJson(path.join(io.dir,'storyboard_repair_input.json'),repair);
      const board=await runSimpleStoryboardDiagnostic({...baseCurrent,writerResult:result.source,signal,...contracts,...(spanning?{selfCheckSourceSpans:true as const}:{}),repair,generate:io.visual});
      result={...result,status:board.status,storyboard:board};saveText();
    }
    if(!result.storyboard||!admittedStatus(result.status))return finish('held_storyboard',{storyboardAttempts:boardAttempts});
    guard();
    const layoutBase={version:'reviewed-book-layout/v1',seed:profile.seed,childDesign:profile.child.design,storyboardDir:finalTextDir,
      childDir:'child',childImage:'reference_child.png',savedCompanion:null,childAnchor:profile.childAnchor,childAnchorPose:CHILD_ANCHOR_POSE_V2,
      ...(readerSafe?{readerFraming:READER_SAFE_FRAMING_VERSION}:{})} as const;
    const board=loadReviewedStoryboard(config.bookDir,source,reviewedBookLayoutSchema.parse(layoutBase));
    const childDir=path.join(config.bookDir,'child'),childImages=path.join(childDir,'illustrations');mkdirSync(childDir);mkdirSync(childImages);
    const childIO=auditionAdapters({directory:childImages,meter,key,signal,guard}),judges=childAnchorJudges({bytesOf:i=>readAuditionImage(childImages,i),meter,key,signal,guard});
    const anchor=anchorAuthority(profile,board.book.plan.wardrobe,CHILD_ANCHOR_POSE_V2);
    const childSave=(name:string,v:unknown)=>exclusiveJson(path.join(childDir,`${name}.json`),v);
    childSave('context',anchor.context);
    const child=await inspectedAnchor({anchor,images:childImages,render:childIO.render,style:judges.inspectedStyle,design:judges.inspectedDesign,
      check:guard,save:childSave,log,visibilityRecovery:true});
    if(child.status!=='passed')return finish('held_child',{disposition:child.disposition});
    childSave('reference_child_adoption',{name:'child',context:anchor.context,candidate:child.candidate,authority:'new_book_trial_reviewed_passed',anchor:child.record});
    const layout=reviewedBookLayoutSchema.parse({...layoutBase,childImage:child.candidate.imageName});save('book-layout',layout);
    const loaded=loadReviewedBook(config.bookDir,source,undefined,layout);
    if(readerSafe&&loaded.current.readerFraming!==grant.visual.readerFraming)fail('trial_reader_framing_binding');
    const art=auditionAdapters({directory:imageDir,meter,key,signal,guard});
    const childRef=await art.writeImage('reference_child.png',loaded.childBytes),companionRef=await art.writeImage('reference_companion.png',loaded.companionBytes);
    const saved=new Map<string,any>();
    const saveArt=(name:string,v:unknown)=>{saved.set(name,v);save(name,v);};
    let manifest:Awaited<ReturnType<typeof illustrateReviewedAudition>>;
    try{
      manifest=await illustrateReviewedAudition({book:loaded.book,rawReview:loaded.rawReview,texts:loaded.texts,current:loaded.current,
        child:childRef,companion:companionRef,companionDescription:loaded.companionDescription,render:art.render,judge:art.judge,identity:art.identity,
        check:guard,save:saveArt,pageAttempts:1,freshCohort:AUDITION_FRESH_COHORT_VERSION,structuralAnatomy:true,
        landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION,
        progress:e=>{log(`${e.phase} ${e.name} attempt${e.attempt+1}: ${e.status}`);if(e.status==='ineligible_safety')fail('trial_safety_stop');}});
    }catch(error){
      save('diagnostic-review-stop',{code:(error as any)?.code??'review_failed',drawnFrames:[...saved.keys()].filter(n=>n.startsWith('diagnostic_render_'))});
      writeTrialReader(config.bookDir,result.source.manuscript,saved,[],meter.snapshot(),max.snapshot(),sourceAdmission);
      throw error;
    }
    const sheets={entities:saved.get('sheet_entities') as SavedSheet,locations:saved.get('sheet_locations') as SavedSheet},references=referenceStatus(sheets),
      canonical=[childRef,companionRef,references.entities.image,references.locations.image];
    const selected:SavedPage[]=Array.from({length:9},(_,n)=>saved.get(`page_${n}`) as SavedPage);
    for(const page of selected){
      let last=page.attempts[page.attempts.length-1];
      for(let attempt=page.attempts.length;attempt<BOOK_E2E_TRIAL.pageAttempts&&page.status==='held';attempt++){
        // Keep sufficient reservation for one edit, its full review and identity. A lack of headroom is not an unknown charge.
        if(meter.snapshot().cumulativeAccountedMicroUsd+1_400_000>BOOK_E2E_TRIAL.apiCapMicroUsd)break;
        const packet=currentPersonalStoryboardFrame(loaded.book,loaded.rawReview,page.pageNumber,loaded.current),
          prior=selected.find(p=>p.pageNumber===page.pageNumber-1),seq=loaded.book.sequence.pages,
          predecessor=page.pageNumber>=2&&prior&&seq[page.pageNumber-1].sceneId===seq[page.pageNumber-2].sceneId?prior.chosen.candidate:null,
          context=auditionPageContext(loaded.book,packet.context,page.pageNumber,loaded.companionDescription,canonical,references,predecessor,
            'landmark-design-head/v1',LANDMARK_COVERAGE_TOPOLOGY_VERSION,true);
        // The judged predecessor stays the first-pass candidate, even after that earlier page gets a new selected candidate.
        if(context.contextSha!==page.contextSha)break;
        const fixed=await repairReviewedAuditionPage({page:page.pageNumber,prefix:'r1_',consumedAttemptsBefore:attempt,prior:last,
          context:context.context,contextSha:context.contextSha,canonical,predecessor,check:guard,render:art.render,judge:art.judge,identity:art.identity,
          materialScene:true,save:(name,v)=>saveArt(`repair_${page.pageNumber}_${attempt}_${name}`,v)});
        if(!fixed.corrected)break;
        page.attempts.push(fixed.corrected);last=fixed.corrected;
        page.chosen=selectAuditionAttempt('page',page.attempts)!;page.status=attemptStatus('page',page.chosen);
        save(`page_${page.pageNumber}_selection_${attempt}`,page);
        log(`page ${page.pageNumber} repair${attempt}: ${fixed.corrected.status}`);
        if(['review_unusable','identity_unusable','review_invalid','ineligible_safety'].includes(fixed.corrected.status))fail('trial_unusable_repair_stop');
      }
    }
    save('final-selection',{manifestSha:previewSha(canonicalJson(manifest)),pages:selected,detailNonblocking:true,productAccepted:false});
    writeTrialReader(config.bookDir,result.source.manuscript,saved,selected,meter.snapshot(),max.snapshot(),sourceAdmission);
    return finish('full_book_diagnostic',{pages:selected.map(p=>({page:p.pageNumber,status:p.status,attempts:p.attempts.length,candidate:p.chosen.candidate})),
      supported:selected.filter(p=>p.status==='qa_supported').length,fullCoverage:selected.length===9,sourceRepairUsed,storyboardAttempts:boardAttempts,
      ...(sourceAdmission?{sourceAdmission}:{}),
      viewer:path.join(config.bookDir,'viewer','index.html')});
  }catch(error){
    if(!existsSync(outcomeFile))finish('failed_trial',{code:(error as any)?.code??'trial_failure'});
    throw error;
  }
}
/** Review UI only: exact source text and selected images; candidate-only frames never masquerade as QA-supported. */
export function writeTrialReader(dir:string,story:{title:string;pages:{pageNumber:number;text:string}[]},saved:Map<string,any>,selected:SavedPage[],api:unknown,max:unknown,sourceAdmission?:unknown){
  const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  const sourceNotice=sourceAdmission?`<header><h2>איכות הטקסט — הבחנה מפורשת לניסוי</h2><p>ביקורת ספרותית קודמת נשארה HOLD. הטקסט לא שונה שוב. המשך האיור נשען על ביקורת חומרה חדשה ומוצמדת; זה אינו אישור מוצר או אישור ייצור.</p><p><a href="../text_1/simple-book-result.json">הטקסט והביקורות הקודמות</a> · <a href="../source-impact-admission.json">הביקורת החדשה והנימוקים</a></p><details><summary>פירוט סיווג החומרה</summary><pre dir="ltr">${esc(JSON.stringify(sourceAdmission,null,2))}</pre></details></header>`:'';
  const frames=sourceNotice+Array.from({length:9},(_,n)=>{
    const p=selected.find(p=>p.pageNumber===n)??saved.get(`page_${n}`),candidate=p?.chosen?.candidate??saved.get(`diagnostic_render_${n}`)?.candidate;
    if(!candidate)return`<section><h2>${n===0?'כריכה':`עמוד ${n}`}</h2><p>לא נוצר איור. אין כאן השלמת ספר.</p></section>`;
    return`<section id="p${n}"><h2>${n===0?esc(story.title):`עמוד ${n}`}</h2><img src="../illustrations/${esc(candidate.imageName)}" alt="${n===0?'כריכה':`עמוד ${n}`}"/><article><p class="story">${n?esc(story.pages.find(p=>p.pageNumber===n)?.text):esc(story.title)}</p><p>QA: <b dir="ltr">${esc(p?.status??'not_reviewed')}</b> · ${p?.attempts?.length??1} ניסיונות</p><ul>${(p?.chosen?.assessment?.findings??[]).map((f:any)=>`<li><b dir="ltr">${esc(f.impact)}</b>: ${esc(f.note)}</li>`).join('')}</ul>${p?.attempts?.length>1?`<details><summary>כל הניסיונות שנשמרו</summary>${p.attempts.map((a:any)=>a.candidate?`<figure><img loading="lazy" src="../illustrations/${esc(a.candidate.imageName)}"/><figcaption>${a.attempt+1} — ${esc(a.status)}</figcaption></figure>`:'').join('')}</details>`:''}</article></section>`;
  }).join('');
  const viewer=path.join(dir,'viewer');if(!existsSync(viewer))mkdirSync(viewer);
  exclusiveText(path.join(viewer,'index.html'),`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(story.title)}</title><style>body{margin:0;background:#f6f2e8;color:#222;font:18px/1.7 system-ui}header,footer{padding:30px;max-width:1100px;margin:auto}section{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr);gap:25px;padding:30px;max-width:1200px;margin:20px auto;background:white;border-radius:16px}h2{grid-column:1/-1}img{width:100%;height:auto;border-radius:10px}.story{font-size:23px;white-space:pre-line}pre{white-space:pre-wrap;overflow-wrap:anywhere}figure{margin:15px 0}@media(max-width:750px){section{display:block;padding:16px}.story{font-size:21px}}</style><header><h1>${esc(story.title)}</h1><p>ספר ניסוי חדש — כריכה ושמונה עמודים. הערות detail אינן חוסמות; HOLD אינו אישור מוצר. כל הטיוטות, הרפרנסים, הביקורות והעלויות נשמרו בתיקיית הספר.</p></header>${frames}<footer><h2>חשבונאות אמיתית — API ו־Max בנפרד</h2><pre dir="ltr">${esc(JSON.stringify({api,claudeMaxResource:max,note:'Max reported resource, not API invoice'},null,2))}</pre></footer></html>`);
}
async function cli(){
  const args=process.argv.slice(2),at=(flag:string)=>args[args.indexOf(flag)+1];
  if(!args.includes('--config'))fail('trial_arguments');
  const config=trialConfigSchema.parse(read(at('--config')));
  const spanning=args.includes('--storyboard-source-spans'),completing=args.includes('--source-impact-completion'),continuing=completing||args.includes('--source-impact-continuation');
  if(spanning&&continuing)fail('trial_arguments');
  if(!args.includes('--execute'))return spanning?planBookStoryboardSpanContinuation(config):continuing?planBookSourceContinuation(config,completing):planBookTrial(config);
  if(!args.includes('--grant')||!args.includes('--grant-sha'))fail('trial_arguments');
  const grantVersion=read(at('--grant')).version;
  if((grantVersion==='book-e2e-storyboard-source-spans/v1')!==spanning||(grantVersion==='book-e2e-source-impact-continuation/v1'||grantVersion==='book-e2e-source-impact-completion/v1')!==continuing||
    (grantVersion==='book-e2e-source-impact-completion/v1')!==completing)fail('trial_arguments');
  return executeBookTrial(config,at('--grant'),at('--grant-sha'),new AbortController().signal,s=>console.log(JSON.stringify({at:new Date().toISOString(),event:s})));
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(__filename))cli().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(JSON.stringify({error:e?.code??e?.message??'trial_failed'}));process.exitCode=1;});
