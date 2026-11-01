/** ONE newly approved full-book trial. Reuses engine stages; never reopens a historical book authority. Dry by default. */
import 'server-only';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { nativeBookContinuitySchema, nativeBookContinuityContracts, type NativeBookContinuity } from '../lib/personal-wizard/engine-continuity-contracts';
import { COMPANION_SCALE_VERSION, COMPANION_SCALE_SAMPLE_GATE } from '../lib/personal-wizard/companion-scale';
import { companionScaleAuthority } from '../lib/personal-wizard/companion-scale-authority';
import { INSTANCE_DISTINCTION_VERSION } from '../lib/personal-wizard/storyboard-instance-distinction';
import { ENTITY_MATERIAL_FUNCTION_VERSION } from '../lib/personal-wizard/storyboard-material-function';
import OpenAI from 'openai';
import { previewSha } from '../lib/local-story-preview';
import { momentumVoiceAccounting } from '../lib/personal-wizard/local-voice-intake';
import { MOMENTUM_WIZARD_SLOT, momentumIntakeSchema, momentumWizardConfigSchema } from '../lib/personal-wizard/momentum-book-bridge';
import { reviewedTextDigest } from '../lib/personal-wizard/reviewed-text-authorization';
import { companionIdentityReference } from '../lib/personal-wizard/companion-identity';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import { resolvePersonalWizardOptions } from '../lib/personal-wizard/options';
import { prepareSimpleStory, type SimpleStoryCall } from '../lib/personal-wizard/simple-story-engine';
import { runSimpleWizardBook, type SimpleBookReadingCall } from '../lib/personal-wizard/simple-book-flow';
import { runSimpleStoryboardDiagnostic, type SimpleStoryboardDiagnosticCall } from '../lib/personal-wizard/simple-storyboard-diagnostic';
import type { StoryboardRepair } from '../lib/personal-wizard/storyboard-repair';
import { prepareSourceCitationCorrection, applySourceCitationCorrection, SOURCE_CITATION_CORRECTION_VERSION } from '../lib/personal-wizard/story-source-citations';
import { currentPersonalStoryboardFrame } from '../lib/personal-wizard/storyboard';
import { CHILD_ANCHOR_MATERIALITY_VERSION, CHILD_ANCHOR_POSE_V2, CHILD_ANCHOR_TECHNIQUE_MANIFEST, resolveChildAnchorTechnique } from '../lib/personal-wizard/child-anchor-style';
import { SimpleBookBudget } from '../lib/personal-wizard/simple-book-budget';
import { illustrateReviewedAudition, AUDITION_FRESH_COHORT_VERSION, LANDMARK_COVERAGE_TOPOLOGY_VERSION, REFERENCE_QUALIFICATION_VERSION,
  auditionPageContext, referenceStatus, repairReviewedAuditionPage, selectAuditionAttempt, attemptStatus,
  type SavedPage, type SavedSheet } from '../lib/personal-wizard/simple-book-reviewed-audition';
import { AuditionMeter, auditionAdapters, auditionMeterRules, keyReader, loadReviewedBook, loadReviewedStoryboard, admitReviewedStoryboardBundle,
  reviewedBookLayoutSchema, AUDITION_REVIEW_CAPACITY_VERSION, type MeterRules } from './personal-simple-book-reviewed-audition';
import { readAuditionImage } from './personal-simple-book-illustrator';
import { childAnchorJudges } from './personal-child-anchor-judges';
import { anchorAuthority, inspectedAnchor, FRESH_BOOK_STORYBOARD_PRESENCE_PINNED, flooredReviewRule } from './personal-fresh-book-driver';
import { stageRules, replaySettlement } from './personal-new-book-experiment';
import { prepareCausalWire, createOpusCausalTransport, createAstraCausalTransport, type WirePolicy, type TransportReply } from './personal-causal-trial-adapters';
import { prepareOpusStoryboardWire, createOpusStoryboardTransport, plannerRequest } from './personal-opus-storyboard-transport';
import { simpleWizardVisualPayload } from './personal-simple-wizard-worker';
import { exclusiveJson, exclusiveText, realDirectory } from './personal-causal-trial-journal';
import { longCallFetch } from './personal-long-call-fetch';
import { admitCurrentSimpleStorySource, simpleStoryReadingPackets, simpleStoryFindingIsMaterial } from '../lib/personal-wizard/simple-story-source';
import { compileCausalSourceReading, type CitationCorrectionCall } from '../lib/personal-wizard/story-causal-experiment';
import { SIMPLE_CHILD_MOMENTUM_EXPERIENCE } from '../lib/personal-wizard/simple-story-experience';
import { SIMPLE_WRITING_ROLES } from '../lib/personal-wizard/simple-writing-roles';
import { BOOK_NARRATION, narrationVoice, narrationMeterRule, planBookNarration, narrateBook, createNarrationTransport, elevenLabsKeyReader,
  probeNarrationAudio, writeLocalReaderBundle, type BookNarrationPlan } from './personal-book-narration';
import { SOURCE_REVIEW_IMPACT, prepareSourceImpactReview, compileSourceImpactReview,sourceImpactSchema,
  prepareSourceImpactCompletion,compileSourceImpactCompletion } from '../lib/personal-wizard/source-review-impact';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard, storyboardInstructions, storyboardDraftSchema } from '../lib/personal-wizard/storyboard';
import { personalBookOutputLimits } from '../lib/personal-wizard/book-config';
import { decodePersonalBookProviderOutput } from '../lib/personal-wizard/book-openai';
import { STORYBOARD_SELF_CHECK_SOURCE_SPANS_VERSION } from '../lib/personal-wizard/storyboard-self-check';
import { READER_SAFE_FRAMING_VERSION, READER_PORTRAIT_FRAMING_VERSION } from '../lib/storybook-scene-framing';
import { observeClaudeQuotaStop, trialFailureDetails, claudeQuotaStop, type ClaudeQuotaStop } from '../lib/personal-wizard/claude-resource-stop';
import { SOL_WRITING, prepareSolWritingWire, createSolWritingTransport, solWritingMeterRule, solWritingRuleFor } from './personal-sol-writing-transport';
import { SOL_CACHE_BUDGET, solCacheWriteAdjustment, solCacheReserveMargin } from './personal-sol-cache-budget';
import { STORYBOARD_REVIEW_CAPACITY } from '../lib/personal-wizard/storyboard-review-capacity';
import { replaySavedInitialSolSource } from './personal-saved-sol-source';

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
/** ONE newly requested story/companion, not another label for either consumed cycle. */
export const PORTRAIT_BOOK_TRIAL = Object.freeze({ ...READER_SAFE_BOOK_TRIAL, id:'owner-portrait-book-20261024/v1',
  claim:'owner-portrait-book-20261024.claim.json',outcome:'owner-portrait-book-20261024.outcome.json',
  priorBook:'C:/Users/guyna/.codex/visualizations/2026/09/04/01a06c5c-a233-76c0-ac8e-618c02ce6246/new-book-reader-safe-20261023',
  maxResourceMicroUsd:0,readerFraming:READER_PORTRAIT_FRAMING_VERSION,reviewCapacity:AUDITION_REVIEW_CAPACITY_VERSION,
  routes:{...BOOK_E2E_TRIAL.routes,writing:'gpt-6.1-sol/openai_responses'} });
/**
 * ONE new momentum book (2026-10-25): the portrait book line, with a child-first/v4 story written by the role split (Opus 5.5 author on
 * Claude Max, Sol editor) and bounded citation recovery (at most one per reading). The API ledger continues from its known prior (never a
 * reset); Max has one explicit author-session allowance, reported separately; API plus this cycle's Max stay under the cycle cap.
 */
export const MOMENTUM_BOOK_TRIAL = Object.freeze({ ...PORTRAIT_BOOK_TRIAL, id:'owner-momentum-book-20261025/v1',
  claim:'owner-momentum-book-20261025.claim.json',outcome:'owner-momentum-book-20261025.outcome.json',
  priorBook:'C:/Users/guyna/.codex/visualizations/2026/09/04/01a06c5c-a233-76c0-ac8e-618c02ce6246/new-book-portrait-panda-20261024',
  priorApiMicroUsd:3_185_794,cycleCapMicroUsd:8_000_000,maxResourceMicroUsd:2_000_000,sourceRepairs:0,citationCorrections:2,
  storyExperience:SIMPLE_CHILD_MOMENTUM_EXPERIENCE,usedCompanions:['fox_uri','lion_shaket','dragon_dini','chameleon_koko','panda_anat'],
  // Owner scope 2026-10-26: the same book through the Wizard, narrated by the Wizard-selected Dad voice, inside the SAME caps.
  narration:{version:BOOK_NARRATION.version,voiceIds:['dad_v2'],maximumMicroUsd:1_000_000,calls:9},
  routes:{...BOOK_E2E_TRIAL.routes,writing:SIMPLE_WRITING_ROLES.label} });
const MOMENTUM_OWNER_TERMS=['2026-10-25','ONE NEW','חבר מלווה חדש','סיפור חדש','עם המנוע המעודכן כמובן','קדימה',MOMENTUM_BOOK_TRIAL.id,
  READER_PORTRAIT_FRAMING_VERSION,SIMPLE_CHILD_MOMENTUM_EXPERIENCE,SIMPLE_WRITING_ROLES.label,'2026-10-26','קריינות של אבא','דרך הוויזארד','dad_v2'];
/** The local reader bundle id of a momentum book: derived from its accepted request, never chosen by hand. */
export const momentumReaderId=(requestId:string)=>`trial-${requestId.slice(0,16)}`;
const localReaderRoot=()=>path.join(source,'outputs','local-reader-previews');
const hash=z.string().regex(/^[a-f0-9]{64}$/), absolute=z.string().refine(path.isAbsolute);
const fail=(code:string):never=>{throw Object.assign(new Error(code),{code});};
const read=(file:string):any=>{const s=lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.size>32_000_000)fail('trial_data_file');return JSON.parse(readFileSync(file,'utf8'));};
const shaFile=(file:string)=>previewSha(readFileSync(file));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const source=path.resolve(__dirname,'..');
const git=(...args:string[])=>execFileSync('git',args,{cwd:source,encoding:'utf8'}).trim();
const trialConfigFields={version:z.literal('book-e2e-trial-config/v1'),
  ownerFile:absolute,ownerSha:hash,bookDir:absolute,profileFile:absolute,profileSha:hash,
  executable:absolute,executableSha256:hash,keyFile:absolute,engineContinuity:nativeBookContinuitySchema.optional()};
/**
 * A Wizard-sourced momentum request's exact receipt, sealed by its grant-bound config (2026-10-29, R17 R4 F1): the intake the route
 * recorded, the operator's binding of it and the Wizard config. Their expected hashes live here, never in a replaceable file.
 */
export const requestBindingSchema=z.object({version:z.literal('wizard-request-binding/v1'),intakeFile:absolute,intakeSha256:hash,
  bindingFile:absolute,bindingSha256:hash,wizardConfigFile:absolute,wizardConfigSha256:hash}).strict();
const intakeBindingSchema=z.object({intakeFile:absolute,intakeSha256:hash,requestId:hash,voiceId:z.string(),wizardConfigSha256:hash,profileSha256:hash}).strict();
export const trialConfigSchema=z.union([z.object({...trialConfigFields,cycle:z.enum([BOOK_E2E_TRIAL.id,READER_SAFE_BOOK_TRIAL.id])}).strict(),
  z.object({...trialConfigFields,cycle:z.literal(PORTRAIT_BOOK_TRIAL.id),operatorFile:absolute,operatorSha:hash}).strict(),
  z.object({...trialConfigFields,cycle:z.literal(MOMENTUM_BOOK_TRIAL.id),operatorFile:absolute,operatorSha:hash,requestBinding:requestBindingSchema}).strict()]);
export type TrialConfig=z.infer<typeof trialConfigSchema>;
export function bookTrialPolicy(cycle:TrialConfig['cycle']) {
  if(cycle===BOOK_E2E_TRIAL.id)return BOOK_E2E_TRIAL;
  if(cycle===READER_SAFE_BOOK_TRIAL.id)return READER_SAFE_BOOK_TRIAL;
  if(cycle===PORTRAIT_BOOK_TRIAL.id)return PORTRAIT_BOOK_TRIAL;
  if(cycle===MOMENTUM_BOOK_TRIAL.id)return MOMENTUM_BOOK_TRIAL;
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
const PINNED=[...new Set([...FRESH_BOOK_STORYBOARD_PRESENCE_PINNED,'scripts/personal-book-e2e-trial.ts','lib/personal-wizard/claude-resource-stop.ts',
  'lib/personal-wizard/audition-anatomy.ts','lib/personal-wizard/landmark-topology.ts','lib/personal-wizard/storyboard-presence.ts',
  'lib/personal-wizard/storyboard-calibration.ts','lib/companions.ts','lib/style01-prompt-core.ts','lib/personal-wizard/options.ts',
  'lib/personal-wizard/source-review-impact.ts'])];
/**
 * The storyboard contracts of a run, shared by its plan and its execution: every board diagnostic of a fresh run (initial, held-source
 * successor, repairs) receives exactly these. Momentum opts in from the start to the existing storyboard review INPUT capacity (the
 * portrait book line needed it to reach review); that is distinct from the image audition review capacity. Others: exactly as before.
 */
export function trialRunContracts(cycle:TrialConfig['cycle'],portraitRecovery=false,continuity?:NativeBookContinuity){
  if(portraitRecovery&&continuity)fail('trial_continuity_fresh_scope');
  const momentum=cycle===MOMENTUM_BOOK_TRIAL.id,portrait=cycle===PORTRAIT_BOOK_TRIAL.id||momentum,readerSafe=cycle===READER_SAFE_BOOK_TRIAL.id||portrait;
  return{...CONTRACTS,...(readerSafe?{selfCheckSourceSpans:true as const}:{}),...(portrait?{stateParityContract:true as const}:{}),
    ...(portraitRecovery||momentum?{reviewCapacity:STORYBOARD_REVIEW_CAPACITY.version}:{}),...nativeBookContinuityContracts(continuity)};
}
/**
 * The image-stage contracts a grant's `visual` binding opts into (engine continuity, 2026-10-30), passed to illustrateReviewedAudition.
 * The grant equals its recomputed plan. Legacy cycles declare none by default; a prospective explicit CDE config binds its sample and stop.
 */
export function trialAuditionContracts(visual:object){
  const v=visual as {referenceQualification?:unknown;engineContinuity?:unknown;sampleScaleGate?:unknown;freshCohort?:unknown;
    pageAttempts?:unknown;structuralAnatomy?:unknown;landmarkTopology?:unknown;materialSceneRepair?:unknown};
  if(v.referenceQualification!==undefined&&v.referenceQualification!==REFERENCE_QUALIFICATION_VERSION)fail('trial_visual_contract');
  const reference=v.referenceQualification===undefined?{}:{referenceQualification:REFERENCE_QUALIFICATION_VERSION};
  if(v.engineContinuity===undefined){if(v.sampleScaleGate!==undefined)fail('trial_visual_contract');return reference;}
  const parsed=nativeBookContinuitySchema.safeParse(v.engineContinuity);
  if(!parsed.success)return fail('trial_visual_contract');
  if(v.sampleScaleGate!==COMPANION_SCALE_SAMPLE_GATE||v.freshCohort!==undefined||v.pageAttempts!==1||v.materialSceneRepair!==false||
    v.structuralAnatomy!==true||v.landmarkTopology!==LANDMARK_COVERAGE_TOPOLOGY_VERSION||v.referenceQualification!==REFERENCE_QUALIFICATION_VERSION)return fail('trial_visual_contract');
  return {...reference,sample:parsed.data.sample,sampleScaleGate:COMPANION_SCALE_SAMPLE_GATE};
}
/** The actual native illustration boundary, exercised provider-free with synthetic adapters. */
export async function runTrialAudition(args:Omit<Parameters<typeof illustrateReviewedAudition>[0],
  'freshCohort'|'sample'|'sampleScaleGate'|'pageAttempts'|'structuralAnatomy'|'landmarkTopology'|'referenceQualification'>&{visual:object}){
  const {visual,...input}=args,bound=trialAuditionContracts(visual),marked='sampleScaleGate' in bound;
  if(marked&&(input.book.instanceDistinction?.version!==INSTANCE_DISTINCTION_VERSION||input.book.materialFunction?.version!==ENTITY_MATERIAL_FUNCTION_VERSION||
      input.book.companionScale?.version!==COMPANION_SCALE_VERSION||input.resume||input.ownerAcceptance||input.calibration||input.fullBookDiagnostic||
      input.topologyContinuation||input.coverageContinuation||input.anatomyRecovery||input.pages||input.reuseSheets))fail('trial_continuity_book_binding');
  return illustrateReviewedAudition({...input,...(marked?{render:trialPageRenderEvidence(input.render,input.save)}:{}),pageAttempts:1,...(marked?{}:{freshCohort:AUDITION_FRESH_COHORT_VERSION}),structuralAnatomy:true,
    landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION,...bound});
}
/** A returned image is diagnostic evidence before any subsequent review/identity/guard await; it grants no selection authority. */
export const NATIVE_PAGE_RENDER_EVIDENCE_VERSION='native-page-render-evidence/v1' as const;
type TrialPageRender=Parameters<typeof illustrateReviewedAudition>[0]['render'];
export function trialPageRenderEvidence(render:TrialPageRender,save:Parameters<typeof illustrateReviewedAudition>[0]['save']):TrialPageRender {
  return async(...call)=>{
    const candidate=await render(...call),frame=/^page_([0-8])_0$/.exec(call[0]);
    if(frame)save('drawn_page_'+frame[1],{version:NATIVE_PAGE_RENDER_EVIDENCE_VERSION,pageNumber:Number(frame[1]),attempt:0,step:call[0],candidate:{...candidate}});
    return candidate;
  };
}
/** One record per actual drawn frame, in draw order. More complete records replace evidence without counting the page twice. */
export function trialDrawnFrames(saved:ReadonlyMap<string,any>):string[]{
  const frames=new Map<number,{name:string;rank:number}>();
  for(const [name,value]of saved){
    const m=/^(page|halted_page|drawn_page|diagnostic_render)_([0-8])$/.exec(name);if(!m)continue;
    const candidate=m[1]==='halted_page'?(Array.isArray(value?.attempts)?value.attempts.some((a:any)=>!!a?.candidate):false):!!(value?.chosen?.candidate??value?.candidate);
    if(!candidate)continue;
    const frame=Number(m[2]),rank=m[1]==='page'?4:m[1]==='halted_page'?3:m[1]==='drawn_page'?2:1;
    if(rank>(frames.get(frame)?.rank??0))frames.set(frame,{name,rank});
  }
  return [...frames.values()].map(v=>v.name);
}
/** Page counts are metrics, not book qualification. Only the returned engine manifest owns that label. */
export function trialBookVisualQualification(manifest:Awaited<ReturnType<typeof illustrateReviewedAudition>>){
  if(!manifest.scaleVerification)return fail('trial_continuity_manifest_binding');
  return {manifestStatus:manifest.status,scaleVerification:manifest.scaleVerification,
    qaSupported:manifest.status==='qa_supported_audition'&&manifest.scope.complete&&manifest.scaleVerification.status==='observed_within_range',
    complete:manifest.scope.complete,manifestSha256:previewSha(canonicalJson(manifest)),productAccepted:false as const,productionQualified:false as const};
}
export function trialSelectedPages(manifest:Awaited<ReturnType<typeof illustrateReviewedAudition>>,saved:Map<string,any>):SavedPage[]{
  return manifest.pages.map(p=>{const record=saved.get('page_'+p.pageNumber) as SavedPage|undefined;
    if(!record||record.pageNumber!==p.pageNumber||record.status!==p.status||!same(record.chosen.candidate,p.candidate)||!same(record.chosen.assessment.companionScale,p.companionScale))return fail('trial_continuity_selection_binding');
    return record;});
}
function inside(root:string,file:string){const rel=path.relative(path.resolve(root),path.resolve(file));return rel!==''&&!rel.startsWith('..')&&!path.isAbsolute(rel);}
export function validateTrialProfile(raw:unknown,root=source){
  const p=trialProfileSchema.parse(raw),options=resolvePersonalWizardOptions(root),prepared=prepareSimpleStory(p.request,options,p.seed),c=prepared.accepted.canonical;
  if(prepared.book.pages!==8||prepared.accepted.containsFixtureData||c.appearance.photo!=='none'||c.companion.id!==p.companionId||
    c.child.name!==p.child.name||c.child.age!==p.child.age||c.child.address!==p.child.gender||p.companionId==='lion_shaket')fail('trial_profile_scope');
  return {profile:p,options,prepared};
}
type RequestBinding=z.infer<typeof requestBindingSchema>;
const bindingOf=(config:TrialConfig):RequestBinding=>config.cycle===MOMENTUM_BOOK_TRIAL.id&&'requestBinding' in config?config.requestBinding:fail('trial_request_binding');
/** The sealed receipt files still have exactly the config's hashes (checked at planning and before every paid claim). */
export function requestBindingUnchanged(config:TrialConfig){
  const b=bindingOf(config);
  for(const [file,sha] of [[b.intakeFile,b.intakeSha256],[b.bindingFile,b.bindingSha256],[b.wizardConfigFile,b.wizardConfigSha256]])
    if(!existsSync(file)||shaFile(file)!==sha)fail('trial_request_binding');
}
/**
 * A momentum request is admitted only from its sealed Wizard receipt: the files match the config's hashes, and the intake, binding and
 * Wizard config link to exactly this accepted request (id, options fingerprint, voice, consent, canonical text), this profile and book.
 */
export function assertRequestBinding(config:TrialConfig,prepared:ReturnType<typeof prepareSimpleStory>){
  requestBindingUnchanged(config);
  const b=bindingOf(config);
  let intake:z.infer<typeof momentumIntakeSchema>,binding:z.infer<typeof intakeBindingSchema>,wizard:z.infer<typeof momentumWizardConfigSchema>;
  try{intake=momentumIntakeSchema.parse(read(b.intakeFile));binding=intakeBindingSchema.parse(read(b.bindingFile));wizard=momentumWizardConfigSchema.parse(read(b.wizardConfigFile));}
  catch{return fail('trial_request_binding');}
  const c=prepared.accepted.canonical;
  if(intake.requestId!==prepared.accepted.requestId||intake.optionsFingerprint!==prepared.accepted.optionsFingerprint||intake.voiceId!==c.bookOptions.voiceId||
    intake.consent!==MOMENTUM_WIZARD_SLOT.consent||intake.configDigest!==reviewedTextDigest(wizard)||reviewedTextDigest(intake.request)!==reviewedTextDigest(c)||
    path.resolve(wizard.intakeFile)!==path.resolve(b.intakeFile)||path.resolve(wizard.bookDir)!==path.resolve(config.bookDir)||
    path.resolve(binding.intakeFile)!==path.resolve(b.intakeFile)||binding.intakeSha256!==b.intakeSha256||binding.requestId!==intake.requestId||
    binding.voiceId!==intake.voiceId||binding.wizardConfigSha256!==b.wizardConfigSha256||binding.profileSha256!==config.profileSha)fail('trial_request_binding');
  return {...b,requestId:intake.requestId,optionsFingerprint:intake.optionsFingerprint};
}
/** Pure admission checks. No folder/meter/client/key is created by the dry plan. */
function planTrialInputs(config:TrialConfig,existing=false,solContinuation=false,portraitRecovery=false){
  trialConfigSchema.parse(config);
  if(config.engineContinuity&&(existing||solContinuation||portraitRecovery))fail('trial_continuity_fresh_scope');
  const trial=bookTrialPolicy(config.cycle),momentum=config.cycle===MOMENTUM_BOOK_TRIAL.id,
    portrait=config.cycle===PORTRAIT_BOOK_TRIAL.id||momentum,readerSafe=config.cycle===READER_SAFE_BOOK_TRIAL.id||portrait;
  if(momentum&&(existing||solContinuation||portraitRecovery))fail('trial_momentum_scope');
  if(portrait&&existing&&!portraitRecovery)fail('trial_portrait_no_legacy_continuation');
  if(portraitRecovery&&(!portrait||!existing||solContinuation))fail('trial_portrait_recovery_scope');
  if((config.cycle===PORTRAIT_BOOK_TRIAL.id||config.cycle===MOMENTUM_BOOK_TRIAL.id)&&shaFile(config.operatorFile)!==config.operatorSha)fail('trial_operator_pin');
  if(readerSafe&&existing&&!solContinuation&&!portraitRecovery)fail('trial_reader_safe_no_legacy_continuation');
  if(solContinuation&&(!readerSafe||!existing))fail('trial_sol_scope');
  if(shaFile(config.ownerFile)!==config.ownerSha||shaFile(config.profileFile)!==config.profileSha)fail('trial_input_changed');
  const owner=readFileSync(config.ownerFile,'utf8');
  if(momentum ? !MOMENTUM_OWNER_TERMS.every(term=>owner.includes(term)) : portrait ? !owner.includes('2026-10-24')||!owner.includes('ONE NEW')||!owner.includes('חבר מלווה אחר')||!owner.includes('קדימה יש איושור')||
    !owner.includes(PORTRAIT_BOOK_TRIAL.id)||!owner.includes(READER_PORTRAIT_FRAMING_VERSION) : !owner.includes('2026-10-23')||!owner.includes('ONE NEW')||!(readerSafe
    ?owner.includes('אוקי בוא נבדוק בספר חדש?')&&owner.includes(READER_SAFE_FRAMING_VERSION)
    :owner.includes('יש אישור לתשלום')))fail('trial_owner_record');
  const context=validateTrialProfile(read(config.profileFile));
  // Prospective CDE must be stageable before its one-shot claim: unavailable scale is an input refusal, not a consumed trial.
  if(config.engineContinuity)companionScaleAuthority(context.profile.companionId);
  if(portrait&&(momentum?MOMENTUM_BOOK_TRIAL.usedCompanions:['fox_uri','lion_shaket','dragon_dini','chameleon_koko']).includes(context.profile.companionId))fail('trial_new_companion_required');
  let narrationBinding:Record<string,unknown>|null=null;
  if(momentum){
    let voice:ReturnType<typeof narrationVoice>;
    try{voice=narrationVoice(context.prepared.accepted.canonical.bookOptions.voiceId,MOMENTUM_BOOK_TRIAL.narration.voiceIds);}catch{return fail('trial_narration_voice');}
    const readerId=momentumReaderId(context.prepared.accepted.requestId);
    if(existsSync(path.join(localReaderRoot(),readerId)))fail('trial_reader_bundle_exists');
    narrationBinding={...MOMENTUM_BOOK_TRIAL.narration,voice,readerPreviewId:readerId,accounting:{reserveMicroUsdPerCharacter:BOOK_NARRATION.reserveFactor*BOOK_NARRATION.accountingMicroUsdPerCharacter,
      settleBasis:'max(tts_input_characters,reported_character_cost)',accountingMicroUsdPerCharacter:BOOK_NARRATION.accountingMicroUsdPerCharacter}};
  }
  if(path.resolve(config.keyFile)!==path.resolve('C:/GNart/Work/Small_Heroes/.env.local'))fail('trial_existing_key_scope');
  if(git('status','--porcelain')||git('branch','--show-current')!=='claude/book-render-20261009')fail('trial_source_changed');
  realDirectory(path.dirname(config.bookDir));realDirectory(trial.authorityRoot);
  if(inside(source,config.bookDir)||[BOOK_E2E_TRIAL.priorBook,trial.priorBook].some(prior=>inside(prior,config.bookDir)||path.resolve(config.bookDir)===path.resolve(prior))||
    existsSync(config.bookDir)!==existing)fail('trial_output_scope');
  if(!existing&&(existsSync(path.join(trial.authorityRoot,trial.claim))||existsSync(path.join(trial.authorityRoot,trial.outcome))))fail('trial_consumed');
  const exe=lstatSync(config.executable);if(!exe.isFile()||exe.isSymbolicLink()||shaFile(config.executable)!==config.executableSha256)fail('trial_executable_pin');
  const voiceIntake=momentum?momentumVoiceAccounting(config.operatorFile,config.bookDir):null;
  if(voiceIntake&&voiceIntake.priorApiMicroUsd!==MOMENTUM_BOOK_TRIAL.priorApiMicroUsd)fail('trial_voice_prior');
  if(!context.options.companions.some(c=>c.id===context.profile.companionId))fail('trial_companion_unavailable');
  const requestBinding=momentum?assertRequestBinding(config,context.prepared):null;
  // Pin exactly the drawing reference loadReviewedBook will hand the renderer (the passed front sheet), never the card art.
  let identity:ReturnType<typeof companionIdentityReference>;
  try{identity=companionIdentityReference(context.profile.companionId,source);}catch{return fail('trial_companion_reference');}
  const companion={id:context.profile.companionId},companionPath=identity.file;
  const technique=resolveChildAnchorTechnique(source);
  return {version:momentum?'momentum-book-trial-grant/v1':portrait?'portrait-sol-book-trial-grant/v1':readerSafe?'reader-safe-book-trial-grant/v1':'book-e2e-trial-grant/v1',cycle:trial.id,configSha:previewSha(canonicalJson(config)),ownerSha:config.ownerSha,
    profileSha:config.profileSha,engine:{head:git('rev-parse','HEAD'),branch:git('branch','--show-current')},
    ...(config.cycle===PORTRAIT_BOOK_TRIAL.id||config.cycle===MOMENTUM_BOOK_TRIAL.id?{operator:{file:config.operatorFile,sha:config.operatorSha}}:{}),
    pins:Object.fromEntries([...PINNED,...(readerSafe?['lib/storybook-scene-framing.ts','lib/local-story-preview.ts']:[]),
      ...(portrait?['scripts/personal-sol-writing-transport.ts','scripts/personal-response-settlement.ts','scripts/personal-sol-cache-budget.ts','lib/personal-wizard/simple-book-flow.ts',
        'lib/personal-wizard/simple-story-source.ts','lib/personal-wizard/sol-writing-route.ts','lib/personal-wizard/storyboard-state-parity.ts']:[]),
      ...(momentum?['lib/personal-wizard/simple-story-experience.ts','lib/personal-wizard/simple-story-momentum-policy.ts','lib/personal-wizard/simple-writing-roles.ts',
        'lib/personal-wizard/simple-story-child-policy.ts','lib/personal-wizard/simple-story-shape-policy.ts','lib/personal-wizard/storyboard-review-capacity.ts',
        'scripts/personal-book-narration.ts','lib/personal-wizard/local-voice-intake.ts','lib/personal-wizard/local-voice-intake-evidence.ts',
        'lib/personal-wizard/momentum-book-bridge.ts','lib/personal-wizard/companion-identity.ts','lib/personal-wizard/personal-companions.ts','backend/providers/audio.ts','backend/config/voices.ts','lib/local-reader-preview.ts','lib/story-gen-v2/tts-ambiguity-niqqud.ts']:[]),
       ...(config.engineContinuity?['lib/personal-wizard/engine-continuity-contracts.ts','lib/personal-wizard/storyboard-instance-distinction.ts',
         'lib/personal-wizard/storyboard-material-function.ts','lib/personal-wizard/companion-scale.ts','lib/personal-wizard/companion-scale-authority.ts','lib/personal-wizard/personal-companions.ts',
         'scripts/personal-simple-book-reviewed-audition.ts']:[]),
       ...CHILD_ANCHOR_TECHNIQUE_MANIFEST.map(t=>t.file)].map(f=>[f,shaFile(path.join(source,f))])),
    companion:{id:companion.id,file:companionPath,sha:shaFile(companionPath)},bookDir:path.resolve(config.bookDir),
    requestId:context.prepared.accepted.requestId,...(requestBinding?{requestBinding}:{}),limits:{...trial,...(voiceIntake?{priorApiMicroUsd:voiceIntake.priorApiMicroUsd+voiceIntake.knownMicroUsd,
      maxApiCalls:trial.maxApiCalls-voiceIntake.calls}:{})},...(voiceIntake?{voiceIntake}:{}),contracts:trialRunContracts(config.cycle,false,config.engineContinuity),
    visual:{...(config.engineContinuity?{engineContinuity:nativeBookContinuitySchema.parse(config.engineContinuity),referenceQualification:REFERENCE_QUALIFICATION_VERSION,
      sampleScaleGate:COMPANION_SCALE_SAMPLE_GATE,pageAttempts:1 as const}:{freshCohort:AUDITION_FRESH_COHORT_VERSION}),
      landmarkTopology:LANDMARK_COVERAGE_TOPOLOGY_VERSION,structuralAnatomy:true,
      materialSceneRepair:config.engineContinuity?false:true,detailNonblocking:true,productionQualified:false,...(readerSafe?{readerFraming:portrait?READER_PORTRAIT_FRAMING_VERSION:READER_SAFE_FRAMING_VERSION,sourceReviewImpact:SOURCE_REVIEW_IMPACT}: {}),
      ...(portrait?{reviewCapacity:AUDITION_REVIEW_CAPACITY_VERSION,writing:SOL_WRITING,pricing:SOL_CACHE_BUDGET}:{}),
      ...(momentum?{writingRoles:SIMPLE_WRITING_ROLES,storyExperience:SIMPLE_CHILD_MOMENTUM_EXPERIENCE,storyboardReviewCapacity:STORYBOARD_REVIEW_CAPACITY,
        citationCorrection:{version:SOURCE_CITATION_CORRECTION_VERSION,instructions:'v2',perReading:1},narration:narrationBinding}:{})}};
}
export function planBookTrial(config:TrialConfig){return planTrialInputs(config);}
export type TrialGrant=ReturnType<typeof planBookTrial>;
export const PORTRAIT_REVIEW_INPUT_RECOVERY=Object.freeze({version:'portrait-sol-book-review-input/v1',
  claim:'owner-portrait-book-20261024-review-input.claim.json',outcome:'owner-portrait-book-20261024-review-input.outcome.json'});
export const portraitReviewInputApprovalSchema=z.object({ownerFile:absolute,ownerSha:hash,operatorFile:absolute,operatorSha:hash}).strict();
/** Reuse exact already-paid source/planner bytes; only the still-unused review has a prospective capacity contract. */
export async function replayPortraitReviewInput(config:TrialConfig){
  const {profile,options,prepared}=validateTrialProfile(read(config.profileFile));
  return replaySavedInitialSolSource({request:prepared.accepted.canonical,options,seed:profile.seed,bookDir:config.bookDir,
    policy:wirePolicy(config,path.join(config.bookDir,'text/cli-workspace')),
    contracts:{...CONTRACTS,selfCheckSourceSpans:true,stateParityContract:true},reviewCapacity:STORYBOARD_REVIEW_CAPACITY.version});
}
/** One fixed same-book checkpoint, within the original allowance. Original consumed grant/claim/failed outcome never change. */
export async function planPortraitReviewInputRecovery(config:TrialConfig,approvalRaw:z.infer<typeof portraitReviewInputApprovalSchema>){
  const approval=portraitReviewInputApprovalSchema.parse(approvalRaw),base=planTrialInputs(config,true,false,true),parentGrantFile=path.join(path.dirname(config.ownerFile),'grant-STAGED.json'),old=read(parentGrantFile),
    parentClaimFile=path.join(PORTRAIT_BOOK_TRIAL.authorityRoot,PORTRAIT_BOOK_TRIAL.claim),parentOutcomeFile=path.join(PORTRAIT_BOOK_TRIAL.authorityRoot,PORTRAIT_BOOK_TRIAL.outcome),claim=read(parentClaimFile),outcome=read(parentOutcomeFile);
  if(shaFile(approval.ownerFile)!==approval.ownerSha||shaFile(approval.operatorFile)!==approval.operatorSha||
    !readFileSync(approval.ownerFile,'utf8').includes('SAME BOOK')||!readFileSync(approval.ownerFile,'utf8').includes(base.ownerSha))fail('trial_portrait_recovery_approval');
  if(old.version!=='portrait-sol-book-trial-grant/v1'||old.cycle!==base.cycle||claim.cycle!==base.cycle||outcome.cycle!==base.cycle||outcome.status!=='failed_trial'||outcome.code!=='input_limit'||
    shaFile(parentGrantFile)!==claim.grantSha||claim.grantSha!==outcome.grantSha||shaFile(parentClaimFile)!==outcome.claimSha||!same(claim.engine,old.engine)||
    claim.configSha!==base.configSha||old.configSha!==base.configSha||old.ownerSha!==base.ownerSha||old.profileSha!==base.profileSha||old.bookDir!==base.bookDir||!same(old.companion,base.companion)||
    !same(old.limits,PORTRAIT_BOOK_TRIAL)||!same(old.contracts,{...CONTRACTS,selfCheckSourceSpans:true,stateParityContract:true})||
    existsSync(path.join(config.bookDir,'child'))||existsSync(path.join(config.bookDir,'book-layout.json'))||readdirSync(path.join(config.bookDir,'illustrations')).length||
    existsSync(path.join(config.bookDir,'text_review_input_recovered')))fail('trial_portrait_recovery_parent');
  git('merge-base','--is-ancestor',old.engine.head,'HEAD');
  for(const name of Object.values(PORTRAIT_REVIEW_INPUT_RECOVERY).filter(n=>n.endsWith('.json')))if(existsSync(path.join(PORTRAIT_BOOK_TRIAL.authorityRoot,name)))fail('trial_portrait_recovery_consumed');
  const api=new TrialApiMeter(path.join(config.bookDir,'paid-stages'),'',true).snapshot(),max=new TrialMaxBudget(path.join(config.bookDir,'claude-max-stages'),'').snapshot(),
    steps=readdirSync(path.join(config.bookDir,'paid-stages')).filter(n=>n.endsWith('.claim.json')).sort();
  if(!same(api,outcome.accounting.api)||!same(max,outcome.accounting.claudeMax)||api.calls!==6||api.failed||api.unknownCost||api.unknownOutcome||api.reservedUnsettledMicroUsd||max.logicalAttempts||
    !same(steps,['author','citation_correction','comparison','editor','final_review','storyboard'].map(n=>`portrait_s0_${n}.claim.json`).sort()))fail('trial_portrait_recovery_accounting');
  const replay=await replayPortraitReviewInput(config),payloadSha=previewSha(canonicalJson(replay.payload));if(replay.citationsUsed!==1)fail('trial_portrait_recovery_citations');
  const files:Record<string,string>={};const walk=(dir:string)=>{for(const n of readdirSync(dir)){const f=path.join(dir,n),s=lstatSync(f);if(s.isSymbolicLink())fail('trial_portrait_recovery_file');if(s.isDirectory())walk(f);else if(s.isFile())files[path.relative(config.bookDir,f)]=shaFile(f);else fail('trial_portrait_recovery_file');}};walk(config.bookDir);
  return{...base,version:PORTRAIT_REVIEW_INPUT_RECOVERY.version,approval,authority:{claim:PORTRAIT_REVIEW_INPUT_RECOVERY.claim,outcome:PORTRAIT_REVIEW_INPUT_RECOVERY.outcome},operator:{file:approval.operatorFile,sha:approval.operatorSha},reviewCapacity:STORYBOARD_REVIEW_CAPACITY,
    contracts:{...base.contracts,reviewCapacity:STORYBOARD_REVIEW_CAPACITY.version},
    pins:{...base.pins,...Object.fromEntries(['lib/personal-wizard/storyboard-review-capacity.ts','lib/personal-wizard/simple-storyboard-diagnostic.ts','lib/personal-wizard/book-openai.ts',
      'lib/personal-wizard/book-runner.ts','scripts/personal-saved-sol-source.ts','scripts/personal-new-book-experiment.ts'].map(f=>[f,shaFile(path.join(source,f))]))},
    replay:{sourceSha:previewSha(canonicalJson(replay.source)),draftSha:previewSha(canonicalJson(replay.draft)),readingsSha:previewSha(canonicalJson(replay.readings)),
      sourceDigest:replay.review.context.sourceDigest,storyboardDigest:replay.review.context.storyboardDigest,payloadSha,reviewMaximumMicroUsd:trialApiRules('portrait_s0_storyboard_review')!.reserve(replay.payload)!},
    parent:{grantFile:parentGrantFile,grantSha:shaFile(parentGrantFile),claimFile:parentClaimFile,claimSha:shaFile(parentClaimFile),outcomeFile:parentOutcomeFile,outcomeSha:shaFile(parentOutcomeFile),files,ancestorFiles:{},
      sourceFile:path.join(config.bookDir,'paid-stages/portrait_s0_editor.receipt.json'),sourceSha:shaFile(path.join(config.bookDir,'paid-stages/portrait_s0_editor.receipt.json'))},
    remaining:{sourceWriting:0,sourceRepairs:0,citationCorrections:0,storyboardAttemptsAlreadyConsumed:1,storyboardAttempts:2,newStoryboardReviews:3,childAttempts:2,pageAttempts:3,
      alreadyAccountedMicroUsd:api.cumulativeAccountedMicroUsd,apiCallsAlreadyConsumed:api.calls}};
}
export type PortraitReviewInputGrant=Awaited<ReturnType<typeof planPortraitReviewInputRecovery>>;
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
export const SOL_TRIAL_CONTINUATION=Object.freeze({version:'reader-safe-book-sol-continuation/v1',
  claim:'owner-reader-safe-book-sol-continuation-20261023.claim.json',outcome:'owner-reader-safe-book-sol-continuation-20261023.outcome.json'});
export const solContinuationApprovalSchema=z.object({version:z.literal('reader-safe-sol-continuation-approval/v1'),ownerFile:absolute,ownerSha:hash,
  operatorFile:absolute,operatorSha:hash,availabilityOutcomes:z.array(z.object({file:absolute,sha256:hash}).strict()).length(2)}).strict();
export type SolContinuationApproval=z.infer<typeof solContinuationApprovalSchema>;
/** Explicit model-change successor of a known quota stop. Old text, verdicts, journals and authority remain immutable. Dry/no key/provider. */
export function planBookSolContinuation(config:TrialConfig,approvalRaw:SolContinuationApproval){
  const approval=solContinuationApprovalSchema.parse(approvalRaw),base=planTrialInputs(config,true,true);
  if(shaFile(approval.ownerFile)!==approval.ownerSha||shaFile(approval.operatorFile)!==approval.operatorSha)fail('trial_sol_approval');
  const owner=readFileSync(approval.ownerFile,'utf8');if(!owner.includes('gpt-6.1-sol')||!owner.includes('תכניס אותו למסלול וצא לדרך'))fail('trial_sol_approval');
  const parentGrantFile=path.join(path.dirname(config.ownerFile),'grant-STAGED.json'),old=read(parentGrantFile),
    parentClaimFile=path.join(READER_SAFE_BOOK_TRIAL.authorityRoot,READER_SAFE_BOOK_TRIAL.claim),parentOutcomeFile=path.join(READER_SAFE_BOOK_TRIAL.authorityRoot,READER_SAFE_BOOK_TRIAL.outcome),
    claim=read(parentClaimFile),outcome=read(parentOutcomeFile),sourceFile=path.join(config.bookDir,'text/simple-book-result.json'),held=read(sourceFile),
    repairFile=path.join(config.bookDir,'text_1/storyboard_repair_input.json');
  if(old.version!=='reader-safe-book-trial-grant/v1'||outcome.status!=='failed_trial'||old.cycle!==base.cycle||claim.cycle!==base.cycle||outcome.cycle!==base.cycle||
    shaFile(parentGrantFile)!==claim.grantSha||claim.grantSha!==outcome.grantSha||shaFile(parentClaimFile)!==outcome.claimSha||
    claim.configSha!==base.configSha||old.configSha!==base.configSha||old.ownerSha!==base.ownerSha||old.profileSha!==base.profileSha||
    path.resolve(old.bookDir)!==base.bookDir||!same(old.limits,READER_SAFE_BOOK_TRIAL)||!same(old.companion,base.companion)||
    !held.storyboard||!held.source||readdirSync(path.join(config.bookDir,'illustrations')).length||existsSync(path.join(config.bookDir,'child'))||
    existsSync(path.join(config.bookDir,'text_sol')))fail('trial_sol_parent');
  for(const name of [SOL_TRIAL_CONTINUATION.claim,SOL_TRIAL_CONTINUATION.outcome])if(existsSync(path.join(READER_SAFE_BOOK_TRIAL.authorityRoot,name)))fail('trial_sol_consumed');
  const api=new TrialApiMeter(path.join(config.bookDir,'paid-stages')).snapshot(),max=new TrialMaxBudget(path.join(config.bookDir,'claude-max-stages'),'').snapshot(),
    maxClaims=readdirSync(path.join(config.bookDir,'claude-max-stages')).filter(n=>n.endsWith('.claim.json')).sort();
  if(!same(maxClaims,['s0_author.claim.json','s0_editor.claim.json','s0_storyboard.claim.json','s1_storyboard.claim.json'])||
    !same(api,outcome.accounting.api)||!same(max,outcome.accounting.claudeMax)||api.calls!==3||max.logicalAttempts!==4||!max.stopped||
    api.unknownCost||api.unknownOutcome||api.reservedUnsettledMicroUsd||api.repeatedFailure||max.unknownAttemptCosts||
    !claudeQuotaStop(read(path.join(config.bookDir,'claude-max-stages/s1_storyboard.failure.json')).receipt))fail('trial_sol_accounting');
  const sourceResult=admitCurrentSimpleStorySource(baseRequest(config),held.source,resolvePersonalWizardOptions(source)),
    packets=simpleStoryReadingPackets(baseRequest(config),sourceResult,resolvePersonalWizardOptions(source));
  if(held.readings.length!==2)fail('trial_sol_source');
  [packets.final,packets.comparison].forEach((packet,n)=>{const r=compileCausalSourceReading(packet,held.readings[n].sourceEvidence.output);
    if(!same(r,held.readings[n])||r.findings.some(simpleStoryFindingIsMaterial))fail('trial_sol_source');});
  const ancestorFiles:Record<string,string>={},expectedProbeNames=['owner-reader-safe-book-max-availability-20261023.outcome.json','owner-reader-safe-book-max-availability-recheck-20261023-2.outcome.json'];
  let logical=max.logicalAttempts,reported=max.accountedMicroUsd,previousSha:string|null=null;
  approval.availabilityOutcomes.forEach((p,n)=>{
    if(path.resolve(p.file)!==path.resolve(path.dirname(config.bookDir),expectedProbeNames[n])||shaFile(p.file)!==p.sha256)fail('trial_sol_probe_binding');
    const r=read(p.file);if(r.cycle!==base.cycle||r.parentOutcomeSha!==shaFile(parentOutcomeFile)||r.disposition!=='unavailable_quota'||r.cliDispatches!==1||
      !claudeQuotaStop(r.failure?.receipt)||r.accounting.max.unknownAttemptCosts||r.accounting.max.accountedMicroUsd!==reported||
      r.accounting.max.priorLogicalAttempts!==logical||r.accounting.max.cumulativeLogicalAttempts!==logical+1||!same(r.accounting.api,api)||
      n>0&&r.previousAvailabilityOutcomeSha!==previousSha)fail('trial_sol_probe_accounting');
    const proofFile=p.file.replace(/\.outcome\.json$/,'.claim.json');if(shaFile(proofFile)!==r.claimSha)fail('trial_sol_probe_binding');
    ancestorFiles[p.file]=p.sha256;ancestorFiles[proofFile]=shaFile(proofFile);previousSha=p.sha256;logical++;reported=r.accounting.max.accountedMicroUsd;
  });
  const files:Record<string,string>={},walk=(dir:string)=>{for(const name of readdirSync(dir)){const f=path.join(dir,name),s=lstatSync(f);
    if(s.isSymbolicLink())fail('trial_sol_file');if(s.isDirectory())walk(f);else if(s.isFile())files[path.relative(config.bookDir,f)]=shaFile(f);else fail('trial_sol_file');}};walk(config.bookDir);
  return{...base,version:SOL_TRIAL_CONTINUATION.version,approval,writing:SOL_WRITING,
    contracts:{...base.contracts,stateParityContract:true as const},limits:{...base.limits,routes:{...base.limits.routes,writing:'gpt-6.1-sol/openai_responses'}},
    pins:{...base.pins,'scripts/personal-sol-writing-transport.ts':shaFile(path.join(source,'scripts/personal-sol-writing-transport.ts')),
      'lib/personal-wizard/storyboard-state-parity.ts':shaFile(path.join(source,'lib/personal-wizard/storyboard-state-parity.ts'))},
    parent:{grantFile:parentGrantFile,grantSha:shaFile(parentGrantFile),claimFile:parentClaimFile,claimSha:shaFile(parentClaimFile),
      outcomeFile:parentOutcomeFile,outcomeSha:shaFile(parentOutcomeFile),sourceFile,sourceSha:shaFile(sourceFile),files,ancestorFiles,repairFile,repairSha:shaFile(repairFile),impactReceiptFile:null,impactReceiptSha:null,
      availabilityAccounting:{accountedMicroUsd:reported,cumulativeLogicalAttempts:logical,originalBookLogicalAttempts:max.logicalAttempts}},
    remaining:{sourceWriting:0,sourceRepairs:0,citationCorrections:0,storyboardAttemptsAlreadyConsumed:2,storyboardAttempts:1,childAttempts:2,pageAttempts:3}};
}
export type SolContinuationGrant=ReturnType<typeof planBookSolContinuation>;
export const SOL_RECEIPT_RECOVERY=Object.freeze({version:'reader-safe-sol-receipt-recovery/v1',
  claim:'owner-reader-safe-book-sol-receipt-recovery-20261023.claim.json',outcome:'owner-reader-safe-book-sol-receipt-recovery-20261023.outcome.json'});
export const SOL_BUNDLE_CHECKPOINT=Object.freeze({version:'reader-safe-sol-bundle-checkpoint/v1',
  claim:'owner-reader-safe-book-sol-bundle-checkpoint-20261024.claim.json',outcome:'owner-reader-safe-book-sol-bundle-checkpoint-20261024.outcome.json'});
export const trialStoryboardLayout=(profile:TrialProfile,storyboardDir:string,readerSafe:boolean,
  framing:typeof READER_SAFE_FRAMING_VERSION|typeof READER_PORTRAIT_FRAMING_VERSION=READER_SAFE_FRAMING_VERSION)=>reviewedBookLayoutSchema.parse({
  version:'reviewed-book-layout/v1',seed:profile.seed,childDesign:profile.child.design,storyboardDir,
  childDir:'child',childImage:'reference_child.png',savedCompanion:null,childAnchor:profile.childAnchor,childAnchorPose:CHILD_ANCHOR_POSE_V2,
  ...(readerSafe?{readerFraming:framing}:{})});
/** Same shared decoder in CJS and ESM launchers. A loader failure is never relabelled as model/schema evidence. */
export function decodeTrialStoryboardReview(call:SimpleStoryboardDiagnosticCall,raw:any){
  const settled=replaySettlement.answer(replaySettlement.rates.sol,call.maxOutputTokens,'gpt-6.1-sol',raw),
    receipt={raw,usage:settled.usage,estimatedMicroUsd:settled.estimatedMicroUsd,model:raw?.model,stage:'storyboard_review'};
  if(!settled.valid)throw Object.assign(new Error('trial_review_invalid'),{receipt});
  try{return{value:decodePersonalBookProviderOutput(call,JSON.parse(raw.output_text)),estimatedMicroUsd:settled.estimatedMicroUsd!,receipt};}
  catch(error){throw Object.assign(new Error('trial_review_schema'),{receipt,decodeCause:error instanceof SyntaxError?'malformed_json':(error as any)?.code??'decoder_failed'});}
}
/** Provider-free exact-wire recovery. The same prospectively reviewed contract, not a new verdict or a model retry. */
export async function replayTrialSolStoryboard(config:TrialConfig,old:SolContinuationGrant){
  const contracts={...CONTRACTS,selfCheckSourceSpans:true as const,stateParityContract:true as const};
  if(!same(old.contracts,contracts))fail('trial_receipt_contract');
  const held=read(old.parent.sourceFile),{profile,options,prepared}=validateTrialProfile(read(config.profileFile)),root=path.join(config.bookDir,'paid-stages'),
    planner=read(path.join(root,'sol_storyboard.receipt.json')),failed=read(path.join(root,'sol_storyboard_review.failure.json'));
  if(failed.code!=='audition_stage_failed'||failed.message!=='trial_review_schema')fail('trial_receipt_failure_kind');
  const repair={...read(old.parent.repairFile),addedContracts:['stateParityContract']} as StoryboardRepair;
  let draft:unknown=null,calls=0;
  const board=await runSimpleStoryboardDiagnostic({request:prepared.accepted.canonical,writerResult:held.source,options,signal:new AbortController().signal,
    ...contracts,repair,generate:async call=>{
      calls++;
      if(call.stage==='storyboard'){
        if(!same(prepareSolWritingWire(call),read(path.join(root,'sol_storyboard.wire.json'))))fail('trial_receipt_planner_wire');
        draft=decodePersonalBookProviderOutput(call,JSON.parse(planner.raw.output_text));
        if(!same(draft,planner.output))fail('trial_receipt_planner_output');return draft;
      }
      if(!same(simpleWizardVisualPayload(call,'gpt-6.1-sol'),read(path.join(root,'sol_storyboard_review.wire.json'))))fail('trial_receipt_review_wire');
      return decodeTrialStoryboardReview(call,failed.receipt.raw).value;
    }});
  if(calls!==2||!admittedStatus(board.status))fail('trial_receipt_not_admitted');
  const result={...held,status:board.status,storyboard:board};
  admitReviewedStoryboardBundle({queued:read(path.join(config.bookDir,'request.json')),result,draft,repair},source,
    trialStoryboardLayout(profile,'text_sol_recovered',true));
  return{result,draft,repair,replayedCalls:calls,providerCalls:0 as const};
}
/** A single fixed downstream successor of a fully priced local decode failure. No new text/planner/review calls are allowed. */
export async function planBookSolReceiptRecovery(config:TrialConfig,approvalRaw:SolContinuationApproval){
  const approval=solContinuationApprovalSchema.parse(approvalRaw),base=planTrialInputs(config,true,true);
  if(shaFile(approval.ownerFile)!==approval.ownerSha||shaFile(approval.operatorFile)!==approval.operatorSha||
    !readFileSync(approval.ownerFile,'utf8').includes('תכניס אותו למסלול וצא לדרך'))fail('trial_receipt_approval');
  const parentGrantFile=path.join(path.dirname(config.ownerFile),'../r3-sol-writing-continuation-20261023/grant-STAGED.json'),old=read(parentGrantFile) as SolContinuationGrant,
    parentClaimFile=path.join(READER_SAFE_BOOK_TRIAL.authorityRoot,SOL_TRIAL_CONTINUATION.claim),parentOutcomeFile=path.join(READER_SAFE_BOOK_TRIAL.authorityRoot,SOL_TRIAL_CONTINUATION.outcome),
    claim=read(parentClaimFile),outcome=read(parentOutcomeFile);
  if(old.version!==SOL_TRIAL_CONTINUATION.version||old.cycle!==base.cycle||claim.cycle!==base.cycle||outcome.cycle!==base.cycle||
    shaFile(parentGrantFile)!==claim.grantSha||claim.grantSha!==outcome.grantSha||shaFile(parentClaimFile)!==outcome.claimSha||
    old.configSha!==base.configSha||claim.configSha!==base.configSha||old.profileSha!==base.profileSha||old.ownerSha!==base.ownerSha||old.bookDir!==base.bookDir||
    !same(old.companion,base.companion)||!same(old.approval.availabilityOutcomes,approval.availabilityOutcomes)||
    !same(old.contracts,{...base.contracts,stateParityContract:true})||!same(old.limits,{...base.limits,routes:{...base.limits.routes,writing:'gpt-6.1-sol/openai_responses'}})||
    outcome.status!=='failed_trial'||outcome.code!=='review_callback_failed'||!outcome.originalTerminalOutcomePreserved||
    old.remaining.storyboardAttemptsAlreadyConsumed!==2||old.remaining.storyboardAttempts!==1||
    existsSync(path.join(config.bookDir,'child'))||readdirSync(path.join(config.bookDir,'illustrations')).length||existsSync(path.join(config.bookDir,'text_sol_recovered')))fail('trial_receipt_parent');
  for(const name of[SOL_RECEIPT_RECOVERY.claim,SOL_RECEIPT_RECOVERY.outcome])if(existsSync(path.join(READER_SAFE_BOOK_TRIAL.authorityRoot,name)))fail('trial_receipt_consumed');
  const api=new TrialApiMeter(path.join(config.bookDir,'paid-stages')).snapshot(),max=new TrialMaxBudget(path.join(config.bookDir,'claude-max-stages'),'').snapshot();
  if(!same(api,outcome.accounting.api)||!same(max,outcome.accounting.claudeMax)||api.calls!==5||api.failed!==1||api.unknownCost||api.unknownOutcome||
    api.reservedUnsettledMicroUsd||api.repeatedFailure||max.unknownAttemptCosts||!same(outcome.accounting.claudeMaxAvailability,old.parent.availabilityAccounting))fail('trial_receipt_accounting');
  const ancestorFiles={...old.parent.ancestorFiles,[old.parent.grantFile]:old.parent.grantSha,[old.parent.claimFile]:old.parent.claimSha,[old.parent.outcomeFile]:old.parent.outcomeSha};
  for(const[file,sha]of Object.entries(ancestorFiles))if(shaFile(file)!==sha)fail('trial_receipt_ancestor');
  for(const[file,sha]of Object.entries(old.parent.files))if(shaFile(path.join(config.bookDir,file))!==sha)fail('trial_receipt_history');
  const replay=await replayTrialSolStoryboard(config,old),files:Record<string,string>={},walk=(dir:string)=>{for(const n of readdirSync(dir)){const f=path.join(dir,n),s=lstatSync(f);
    if(s.isSymbolicLink())fail('trial_receipt_file');if(s.isDirectory())walk(f);else if(s.isFile())files[path.relative(config.bookDir,f)]=shaFile(f);else fail('trial_receipt_file');}};walk(config.bookDir);
  const adjustedApi=new TrialApiMeter(path.join(config.bookDir,'paid-stages'),'',true).snapshot();
  return{...base,version:SOL_RECEIPT_RECOVERY.version,approval,writing:SOL_WRITING,contracts:old.contracts,limits:old.limits,
    pins:{...base.pins,'scripts/personal-sol-writing-transport.ts':shaFile(path.join(source,'scripts/personal-sol-writing-transport.ts')),
      'lib/personal-wizard/storyboard-state-parity.ts':shaFile(path.join(source,'lib/personal-wizard/storyboard-state-parity.ts')),
      'scripts/personal-sol-cache-budget.ts':shaFile(path.join(source,'scripts/personal-sol-cache-budget.ts'))},
    pricing:{version:SOL_CACHE_BUDGET,inheritedBaseMicroUsd:api.cumulativeAccountedMicroUsd,inheritedAdjustedApi:adjustedApi},
    parent:{...old.parent,grantFile:parentGrantFile,grantSha:shaFile(parentGrantFile),claimFile:parentClaimFile,claimSha:shaFile(parentClaimFile),outcomeFile:parentOutcomeFile,outcomeSha:shaFile(parentOutcomeFile),files,ancestorFiles},
    receiptRecovery:{version:'known-output-decode-recovery/v1',resultSha:previewSha(canonicalJson(replay.result)),draftSha:previewSha(canonicalJson(replay.draft)),providerCalls:0},
    remaining:{sourceWriting:0,sourceRepairs:0,citationCorrections:0,newStoryboardReviews:0,storyboardAttemptsAlreadyConsumed:3,storyboardAttempts:0,childAttempts:2,pageAttempts:3}};
}
export type SolReceiptRecoveryGrant=Awaited<ReturnType<typeof planBookSolReceiptRecovery>>;
/** Only the known zero-provider bundle-loading failure; never a semantic hold, unknown cost, or an arbitrary retry. */
export function assertSolBundleCheckpoint(old:SolReceiptRecoveryGrant,claim:any,outcome:any,api:unknown,max:unknown){
  if(old.version!==SOL_RECEIPT_RECOVERY.version||old.cycle!==READER_SAFE_BOOK_TRIAL.id||claim.cycle!==old.cycle||outcome.cycle!==old.cycle||
    !same(claim.engine,old.engine)||outcome.status!=='failed_trial'||outcome.code!=='audition_repair_binding'||outcome.runtimeEligible!==false||
    outcome.parentClaimSha!==old.parent.claimSha||outcome.parentOutcomeSha!==old.parent.outcomeSha||
    !same(outcome.receiptRecovery,old.receiptRecovery)||old.receiptRecovery.providerCalls!==0||
    !same(old.remaining,{sourceWriting:0,sourceRepairs:0,citationCorrections:0,newStoryboardReviews:0,storyboardAttemptsAlreadyConsumed:3,storyboardAttempts:0,childAttempts:2,pageAttempts:3})||
    !same(api,outcome.accounting?.api)||!same(api,old.pricing.inheritedAdjustedApi)||!same(max,outcome.accounting?.claudeMax)||
    !same(outcome.accounting?.claudeMaxAvailability,old.parent.availabilityAccounting))fail('trial_bundle_checkpoint');
  const a=api as ReturnType<TrialApiMeter['snapshot']>,m=max as ReturnType<TrialMaxBudget['snapshot']>;
  if(a.calls!==5||a.failed!==1||a.unknownCost||a.unknownOutcome||a.reservedUnsettledMicroUsd||a.repeatedFailure||
    a.cumulativeAccountedMicroUsd>a.capMicroUsd||m.unknownAttemptCosts)fail('trial_bundle_checkpoint_accounting');
}
/** One fixed continuation after complete local bundle loading failed without a new provider. Consumed predecessor stays immutable. */
export async function planBookSolBundleContinuation(config:TrialConfig,approvalRaw:SolContinuationApproval,parentGrantFile:string){
  absolute.parse(parentGrantFile);
  const approval=solContinuationApprovalSchema.parse(approvalRaw),base=planTrialInputs(config,true,true),old=read(parentGrantFile) as SolReceiptRecoveryGrant,
    parentClaimFile=path.join(READER_SAFE_BOOK_TRIAL.authorityRoot,SOL_RECEIPT_RECOVERY.claim),parentOutcomeFile=path.join(READER_SAFE_BOOK_TRIAL.authorityRoot,SOL_RECEIPT_RECOVERY.outcome),
    claim=read(parentClaimFile),outcome=read(parentOutcomeFile);
  if(shaFile(approval.ownerFile)!==approval.ownerSha||shaFile(approval.operatorFile)!==approval.operatorSha||
    !readFileSync(approval.ownerFile,'utf8').includes('תכניס אותו למסלול וצא לדרך'))fail('trial_bundle_approval');
  if(shaFile(parentGrantFile)!==claim.grantSha||claim.grantSha!==outcome.grantSha||shaFile(parentClaimFile)!==outcome.claimSha||
    old.configSha!==base.configSha||claim.configSha!==base.configSha||old.profileSha!==base.profileSha||old.ownerSha!==base.ownerSha||old.bookDir!==base.bookDir||
    !same(old.companion,base.companion)||!same(old.approval.availabilityOutcomes,approval.availabilityOutcomes)||
    !same(old.contracts,{...base.contracts,stateParityContract:true})||!same(old.limits,{...base.limits,routes:{...base.limits.routes,writing:'gpt-6.1-sol/openai_responses'}})||
    existsSync(path.join(config.bookDir,'child'))||readdirSync(path.join(config.bookDir,'illustrations')).length||existsSync(path.join(config.bookDir,'text_sol_bundle')))fail('trial_bundle_parent');
  for(const name of[SOL_BUNDLE_CHECKPOINT.claim,SOL_BUNDLE_CHECKPOINT.outcome])if(existsSync(path.join(READER_SAFE_BOOK_TRIAL.authorityRoot,name)))fail('trial_bundle_consumed');
  const api=new TrialApiMeter(path.join(config.bookDir,'paid-stages'),'',true).snapshot(),max=new TrialMaxBudget(path.join(config.bookDir,'claude-max-stages'),'').snapshot();
  assertSolBundleCheckpoint(old,claim,outcome,api,max);
  const ancestorFiles={...old.parent.ancestorFiles,[old.parent.grantFile]:old.parent.grantSha,[old.parent.claimFile]:old.parent.claimSha,[old.parent.outcomeFile]:old.parent.outcomeSha};
  for(const[file,sha]of Object.entries(ancestorFiles))if(shaFile(file)!==sha)fail('trial_bundle_ancestor');
  for(const[file,sha]of Object.entries(old.parent.files))if(shaFile(path.join(config.bookDir,file))!==sha)fail('trial_bundle_history');
  const replay=await replayTrialSolStoryboard(config,read(old.parent.grantFile)),failedDir=path.join(config.bookDir,'text_sol_recovered');
  if(previewSha(canonicalJson(replay.result))!==old.receiptRecovery.resultSha||previewSha(canonicalJson(replay.draft))!==old.receiptRecovery.draftSha||
    !same(read(path.join(failedDir,'simple-book-result.json')),replay.result)||!same(read(path.join(failedDir,'visual_simple_book_result.json')),replay.result)||
    !same(read(path.join(failedDir,'owned_storyboard_draft.json')),replay.draft)||existsSync(path.join(failedDir,'storyboard_repair_input.json'))||
    readdirSync(path.join(failedDir,'cli-workspace')).length)fail('trial_bundle_failed_artifacts');
  const files:Record<string,string>={},walk=(dir:string)=>{for(const n of readdirSync(dir)){const f=path.join(dir,n),s=lstatSync(f);
    if(s.isSymbolicLink())fail('trial_bundle_file');if(s.isDirectory())walk(f);else if(s.isFile())files[path.relative(config.bookDir,f)]=shaFile(f);else fail('trial_bundle_file');}};walk(config.bookDir);
  return{...base,version:SOL_BUNDLE_CHECKPOINT.version,approval,writing:SOL_WRITING,contracts:old.contracts,limits:old.limits,
    pins:{...base.pins,'scripts/personal-sol-writing-transport.ts':shaFile(path.join(source,'scripts/personal-sol-writing-transport.ts')),
      'lib/personal-wizard/storyboard-state-parity.ts':shaFile(path.join(source,'lib/personal-wizard/storyboard-state-parity.ts')),
      'scripts/personal-sol-cache-budget.ts':shaFile(path.join(source,'scripts/personal-sol-cache-budget.ts'))},pricing:old.pricing,
    parent:{...old.parent,grantFile:parentGrantFile,grantSha:shaFile(parentGrantFile),claimFile:parentClaimFile,claimSha:shaFile(parentClaimFile),outcomeFile:parentOutcomeFile,outcomeSha:shaFile(parentOutcomeFile),files,ancestorFiles},
    receiptRecovery:{version:'known-output-bundle-checkpoint/v1',resultSha:old.receiptRecovery.resultSha,draftSha:old.receiptRecovery.draftSha,
      repairSha:previewSha(canonicalJson(replay.repair)),replayGrantFile:old.parent.grantFile,replayGrantSha:old.parent.grantSha,providerCalls:0 as const},remaining:old.remaining};
}
export type SolBundleContinuationGrant=Awaited<ReturnType<typeof planBookSolBundleContinuation>>;
/** Reader and storyboard rules retain the ordinary reservation floor. Everything else uses the original adapters' exact rule. */
export const trialApiRules:MeterRules=step=>{
  const portraitWriting=/^portrait_s[0-5]_(author|editor|storyboard)$/.exec(step);
  if(portraitWriting)return solWritingRuleFor(portraitWriting[1] as 'author'|'editor'|'storyboard');
  const portraitReview=/^portrait_s[0-5]_(final_review|comparison|storyboard_review|citation_correction)$/.exec(step);
  if(portraitReview)return flooredReviewRule(stageRules.text[portraitReview[1]==='citation_correction'?'comparison':portraitReview[1]]);
  // Momentum: the author is never an API step (it runs on Claude Max). Each reading has its own correction step, so at most one each.
  const momentumWriting=/^momentum_s[0-5]_(editor|storyboard)$/.exec(step);
  if(momentumWriting)return solWritingRuleFor(momentumWriting[1] as 'editor'|'storyboard');
  const momentumReview=/^momentum_s[0-5]_(final_review|comparison|storyboard_review|citation_correction_(?:final_review|comparison))$/.exec(step);
  if(momentumReview)return flooredReviewRule(stageRules.text[momentumReview[1].startsWith('citation_correction')?'comparison':momentumReview[1]]);
  if(/^narration_p[0-8]$/.test(step))return narrationMeterRule;
  if(['sol_author','sol_editor','sol_storyboard'].includes(step))return solWritingRuleFor(step.slice(4) as 'author'|'editor'|'storyboard');
  if(step==='sol_storyboard_review')return flooredReviewRule(stageRules.text.storyboard_review);
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
/** Opt-in shared cycle ceiling: this meter's own total plus `outside()` (the other resource's accounted total) plus the next reservation. */
export type TrialCycleCap={capMicroUsd:number;outside:()=>number};
const assertCycleRoom=(cycle:TrialCycleCap|undefined,own:number,next:number)=>{if(cycle&&own+cycle.outside()+next>cycle.capMicroUsd)fail('trial_cycle_cap');};
export class TrialApiMeter extends AuditionMeter{
  /** `prior` continues an existing cumulative API ledger (its known spend counts against the same cap; never a reset). Defaults keep every older cycle exact. */
  constructor(root:string,readonly prefix='',readonly cacheWritePricing=false,prior=0,readonly cycle?:TrialCycleCap,maxCalls:number=BOOK_E2E_TRIAL.maxApiCalls){if(maxCalls>BOOK_E2E_TRIAL.maxApiCalls)fail('trial_call_limit');super(root,BOOK_E2E_TRIAL.apiCapMicroUsd,maxCalls,prior,0,trialApiRules);}
  override snapshot(){
    const base=super.snapshot();if(!this.cacheWritePricing)return base;
    let cacheWriteAdjustmentMicroUsd=0,pendingCacheWriteReserveMicroUsd=0;
    for(const name of readdirSync(this.root).filter(n=>n.endsWith('.claim.json'))){
      const at=(kind:string)=>path.join(this.root,name.replace('.claim.',`.${kind}.`)),claim=read(at('claim')),wire=read(at('wire'));
      if(!existsSync(at('result'))){pendingCacheWriteReserveMicroUsd+=solCacheReserveMargin(wire,claim.maximumMicroUsd);continue;}
      const result=read(at('result'));if(result.estimatedMicroUsd===null){pendingCacheWriteReserveMicroUsd+=solCacheReserveMargin(wire,claim.maximumMicroUsd);continue;} // Unknown keeps BOTH reservation and original blocking flag.
      const receipt=existsSync(at('receipt'))?read(at('receipt')):read(at('failure')).receipt;
      cacheWriteAdjustmentMicroUsd+=solCacheWriteAdjustment(wire,receipt?.raw);
    }
    const total=base.cumulativeAccountedMicroUsd+cacheWriteAdjustmentMicroUsd+pendingCacheWriteReserveMicroUsd;
    if(!Number.isSafeInteger(total))fail('trial_sol_cache_pricing');
    return{...base,cumulativeAccountedMicroUsd:total,cacheWritePricing:SOL_CACHE_BUDGET,cacheWriteAdjustmentMicroUsd,pendingCacheWriteReserveMicroUsd,
      baseLedgerAccountedMicroUsd:base.cumulativeAccountedMicroUsd,pricingNote:'raw tariff upper-bound estimate; no cached-read discount; not invoice'};
  }
  override async run<T>(step:string,wire:unknown,maximum:number,dispatch:()=>Promise<{value:T;estimatedMicroUsd:number|null;receipt:unknown}>){
    if(this.cacheWritePricing&&this.snapshot().cumulativeAccountedMicroUsd+maximum+solCacheReserveMargin(wire,maximum)>this.capMicroUsd)fail('audition_budget_exhausted');
    if(this.cycle)assertCycleRoom(this.cycle,this.snapshot().cumulativeAccountedMicroUsd,maximum+(this.cacheWritePricing?solCacheReserveMargin(wire,maximum):0));
    return super.run(this.prefix+step,wire,maximum,dispatch);
  }
}
/** Shared Max journal, with the tighter trial guard before every session. Reported resource cost is never called an API charge. */
export class TrialMaxBudget extends SimpleBookBudget{
  /** `allowanceMicroUsd`: this cycle's explicit Max ceiling (reservations count until settled). Defaults keep every older cycle exact. */
  constructor(root:string,readonly prefix:string,readonly allowanceMicroUsd:number=BOOK_E2E_TRIAL.maxResourceMicroUsd,readonly cycle?:TrialCycleCap){super(root,0);}
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
    if(state.stopped||state.accountedMicroUsd+maximum>this.allowanceMicroUsd)fail('trial_max_cap');
    assertCycleRoom(this.cycle,state.accountedMicroUsd,maximum);
    return super.run(this.prefix+step,wire,maximum,dispatch);
  }
}
/**
 * Momentum cycle text routes: the Opus author is ONE Claude Max CLI session on its own journal; the Sol editor, both readings and each
 * reading's at most one citation correction go on the API meter. Every dispatch re-checks the live fence after its claim is journaled and
 * before its provider. Transports are injected (the real ones in executeBookTrial), so the routing itself is testable without a provider.
 */
export function momentumTextRoutes(o:{guard:()=>void;max:TrialMaxBudget;api:TrialApiMeter;policy:WirePolicy;dir:string;conversation:(step:string)=>string;
  author:ReturnType<typeof createOpusCausalTransport>;editor:ReturnType<typeof createSolWritingTransport>;reader:ReturnType<typeof createAstraCausalTransport>;
  observe:<T>(dispatch:()=>Promise<T>)=>Promise<T>}){
  let corrections=0;
  const read=async(step:string,call:any,s:AbortSignal)=>{
    o.guard();const d={...call,role:'astra',conversationKey:o.conversation(step)},wire=prepareCausalWire(d,o.policy,2_000_000),
      reserve=trialApiRules(o.api.prefix+step)?.reserve(wire)??fail('trial_reader_wire');
    return o.api.run(step,wire,reserve,async()=>{o.guard();const r=await o.reader(wire,d,s);return{value:r.output,estimatedMicroUsd:r.estimatedMicroUsd,receipt:r};});
  };
  return{
    opus:async(call:SimpleStoryCall,s:AbortSignal):Promise<TransportReply>=>{
      o.guard();
      if(call.stage==='editor'){
        const wire=prepareSolWritingWire(call),reserve=trialApiRules(o.api.prefix+'editor')?.reserve(wire)??fail('trial_sol_wire');
        return o.api.run('editor',wire,reserve,async()=>{o.guard();const r=await o.editor(wire,call,s);return{value:r,estimatedMicroUsd:r.estimatedMicroUsd,receipt:r};});
      }
      if(call.stage!=='author')fail('trial_momentum_stage');
      const d:any={...call,role:'opus',conversationKey:o.conversation('author')},file=path.join(o.dir,'author-instructions.txt');exclusiveText(file,call.instructions);
      const wire=prepareCausalWire(d,o.policy,2_000_000,file);
      return o.max.run('author',wire,2_000_000,async()=>{o.guard();const r=await o.observe(()=>o.author(wire,d,s));return{value:r,estimatedMicroUsd:r.estimatedMicroUsd,receipt:r};});
    },
    reader:(call:SimpleBookReadingCall,s:AbortSignal)=>read(call.stage,call,s),
    citationCorrector:async(stage:SimpleBookReadingCall['stage'],call:CitationCorrectionCall,s:AbortSignal)=>{
      if(corrections++>=MOMENTUM_BOOK_TRIAL.citationCorrections)fail('trial_citation_used');
      return read(`citation_correction_${stage}`,call,s);
    }};
}
const admittedStatus=(s:string)=>s==='review_supported'||s==='review_supported_with_notes';
export async function executeBookTrial(config:TrialConfig,grantFile:string,grantSha:string,signal:AbortSignal,log:(s:string)=>void,runtimeGuard?:()=>void){
  const trial=bookTrialPolicy(config.cycle),momentum=config.cycle===MOMENTUM_BOOK_TRIAL.id,
    portrait=config.cycle===PORTRAIT_BOOK_TRIAL.id||momentum,readerSafe=config.cycle===READER_SAFE_BOOK_TRIAL.id||portrait;
  if(shaFile(grantFile)!==grantSha)fail('trial_grant_changed');
  const grant=read(grantFile) as TrialGrant|SourceContinuationGrant|StoryboardSpanGrant|SolContinuationGrant|SolReceiptRecoveryGrant|SolBundleContinuationGrant|PortraitReviewInputGrant,
    portraitRecovery=grant.version===PORTRAIT_REVIEW_INPUT_RECOVERY.version?grant as PortraitReviewInputGrant:null,
    bundleRecovery=grant.version===SOL_BUNDLE_CHECKPOINT.version?grant as SolBundleContinuationGrant:null,
    receiptRecovery=bundleRecovery??(grant.version===SOL_RECEIPT_RECOVERY.version?grant as SolReceiptRecoveryGrant:null),
    sol=grant.version===SOL_TRIAL_CONTINUATION.version?grant as SolContinuationGrant:null,
    solFamily=sol??receiptRecovery,
    spanning=grant.version==='book-e2e-storyboard-source-spans/v1',completing=grant.version==='book-e2e-source-impact-completion/v1',
    isSourceContinuation=completing||grant.version==='book-e2e-source-impact-continuation/v1',
    parent=portraitRecovery?portraitRecovery.parent:solFamily?solFamily.parent:spanning?(grant as StoryboardSpanGrant).parent:isSourceContinuation?(grant as SourceContinuationGrant).parent:null,
    plan=portraitRecovery?await planPortraitReviewInputRecovery(config,portraitRecovery.approval):bundleRecovery?await planBookSolBundleContinuation(config,bundleRecovery.approval,bundleRecovery.parent.grantFile):receiptRecovery?await planBookSolReceiptRecovery(config,receiptRecovery.approval):sol?planBookSolContinuation(config,sol.approval):spanning?planBookStoryboardSpanContinuation(config):isSourceContinuation?planBookSourceContinuation(config,completing):planBookTrial(config);
  const contracts=trialRunContracts(config.cycle,!!portraitRecovery,config.engineContinuity);
  if((solFamily||portrait)&&!runtimeGuard)fail('trial_sol_runtime_lease');
  if(!same(grant,plan))fail('trial_plan_changed');
  if(momentum&&!same(grant.contracts,contracts))fail('trial_contracts_binding');
  const configDigest=previewSha(canonicalJson(config));
  const currentInputs=()=>{
    runtimeGuard?.();
    if(signal.aborted||shaFile(grantFile)!==grantSha||shaFile(config.ownerFile)!==grant.ownerSha||
      shaFile(config.profileFile)!==grant.profileSha||previewSha(canonicalJson(config))!==configDigest||
      git('rev-parse','HEAD')!==grant.engine.head||git('branch','--show-current')!==grant.engine.branch||git('status','--porcelain'))fail('trial_binding_changed');
    for(const [file,sha]of Object.entries(grant.pins))if(shaFile(path.join(source,file))!==sha)fail('trial_source_pin');
    if(shaFile(grant.companion.file)!==grant.companion.sha)fail('trial_companion_pin');
    if(portrait&&(!grant.operator||shaFile(grant.operator.file)!==grant.operator.sha))fail('trial_operator_pin');
    if(momentum&&!same(momentumVoiceAccounting(config.operatorFile,config.bookDir),plan.voiceIntake??null))fail('trial_voice_changed');
    if(momentum)requestBindingUnchanged(config);
    if(portraitRecovery&&shaFile(portraitRecovery.approval.ownerFile)!==portraitRecovery.approval.ownerSha)fail('trial_portrait_recovery_approval');
    if(solFamily&&(shaFile(solFamily.approval.ownerFile)!==solFamily.approval.ownerSha||shaFile(solFamily.approval.operatorFile)!==solFamily.approval.operatorSha))fail('trial_sol_approval');
    if(parent){
      for(const [file,sha]of Object.entries(parent.files))if(shaFile(path.join(config.bookDir,file))!==sha)fail('trial_source_parent_changed');
      for(const [file,sha]of [[parent.grantFile,parent.grantSha],[parent.claimFile,parent.claimSha],[parent.outcomeFile,parent.outcomeSha]])if(shaFile(file)!==sha)fail('trial_source_parent_changed');
      for(const [file,sha]of Object.entries(parent.ancestorFiles))if(shaFile(file)!==sha)fail('trial_source_ancestor_changed');
    }
  };
  currentInputs();
  const claimFile=path.join(trial.authorityRoot,portraitRecovery?PORTRAIT_REVIEW_INPUT_RECOVERY.claim:bundleRecovery?SOL_BUNDLE_CHECKPOINT.claim:receiptRecovery?SOL_RECEIPT_RECOVERY.claim:sol?SOL_TRIAL_CONTINUATION.claim:spanning?STORYBOARD_SPANS.claim:completing?SOURCE_COMPLETION.claim:parent?SOURCE_SUCCESSOR.claim:trial.claim),
    outcomeFile=path.join(trial.authorityRoot,portraitRecovery?PORTRAIT_REVIEW_INPUT_RECOVERY.outcome:bundleRecovery?SOL_BUNDLE_CHECKPOINT.outcome:receiptRecovery?SOL_RECEIPT_RECOVERY.outcome:sol?SOL_TRIAL_CONTINUATION.outcome:spanning?STORYBOARD_SPANS.outcome:completing?SOURCE_COMPLETION.outcome:parent?SOURCE_SUCCESSOR.outcome:trial.outcome);
  exclusiveJson(claimFile,{cycle:trial.id,grantSha,configSha:configDigest,ownerSha:grant.ownerSha,bookDir:grant.bookDir,engine:grant.engine,
    ...(parent?{parentClaimSha:parent.claimSha,parentOutcomeSha:parent.outcomeSha,sourceSha:parent.sourceSha}:{} )});
  const claimSha=shaFile(claimFile);
  let sourceAdmissionSha:string|null=spanning?shaFile(path.join(config.bookDir,'source-impact-admission.json')):null;
  const guard=()=>{currentInputs();if(shaFile(claimFile)!==claimSha||existsSync(outcomeFile)||
    sourceAdmissionSha&&shaFile(path.join(config.bookDir,'source-impact-admission.json'))!==sourceAdmissionSha)fail('trial_claim_changed');};
  if(!parent)mkdirSync(config.bookDir);const imageDir=path.join(config.bookDir,'illustrations');if(!parent)mkdirSync(imageDir);
  const apiRoot=path.join(config.bookDir,'paid-stages'),maxRoot=path.join(config.bookDir,'claude-max-stages');
  // Momentum only: the API ledger continues from its prior, Max has its own allowance, and both share one cycle ceiling. Others: unchanged.
  const momentumCycle=(outside:()=>number):TrialCycleCap|undefined=>momentum?{capMicroUsd:MOMENTUM_BOOK_TRIAL.cycleCapMicroUsd,outside}:undefined;
  const apiMeter=(prefix:string,cacheWritePricing:boolean)=>new TrialApiMeter(apiRoot,prefix,cacheWritePricing,momentum?MOMENTUM_BOOK_TRIAL.priorApiMicroUsd+(plan.voiceIntake?.knownMicroUsd??0):0,
    momentumCycle(()=>new TrialMaxBudget(maxRoot,'').snapshot().accountedMicroUsd),trial.maxApiCalls-(plan.voiceIntake?.calls??0));
  const maxBudget=(prefix:string)=>new TrialMaxBudget(maxRoot,prefix,momentum?MOMENTUM_BOOK_TRIAL.maxResourceMicroUsd:BOOK_E2E_TRIAL.maxResourceMicroUsd,
    momentumCycle(()=>apiMeter('',true).snapshot().cumulativeAccountedMicroUsd));
  const meter=apiMeter('',!!receiptRecovery||portrait),max=maxBudget('');
  const {profile,options,prepared}=validateTrialProfile(read(config.profileFile));
  const key=keyReader(config.keyFile);
  const save=(name:string,value:unknown)=>exclusiveJson(path.join(config.bookDir,`${name}.json`),value);
  const policy=wirePolicy(config,config.bookDir),continuationTextIndex=portraitRecovery?0:completing||spanning?3:2;
  let citationUsed=portraitRecovery?1:solFamily?0:parent?1:0,sourceRepairUsed=portraitRecovery?0:solFamily?0:parent?1:0,boardAttempts=portraitRecovery?1:solFamily?solFamily.remaining.storyboardAttemptsAlreadyConsumed:spanning?2:0,
    finalTextDir=portraitRecovery?'text_review_input_recovered':bundleRecovery?'text_sol_bundle':receiptRecovery?'text_sol_recovered':sol?'text_sol':spanning?'text_4_source_spans':parent?`text_${continuationTextIndex}`:'text';
  if(!parent)save('request',{version:'local-simple-wizard-request/v1',requestId:prepared.accepted.requestId,optionsFingerprint:prepared.accepted.optionsFingerprint,
    request:prepared.accepted.canonical,consent:'fictional_new_full_book_trial',cycle:trial.id});
  const baseCurrent={request:prepared.accepted.canonical,options};
  const providerState:{stop:ClaudeQuotaStop|null}={stop:null};
  const observeProviderStop=<T>(dispatch:()=>Promise<T>)=>observeClaudeQuotaStop(dispatch,stop=>{providerState.stop=stop;log('phase provider_quota_exhausted');});
  const stageIO=(index:number,replay=false)=>{
    const dir=path.join(config.bookDir,portraitRecovery&&index===0?'text_review_input_recovered':bundleRecovery?'text_sol_bundle':receiptRecovery?'text_sol_recovered':sol?'text_sol':replay?'text_4_source_spans':index===0?'text':`text_${index}`);mkdirSync(dir);mkdirSync(path.join(dir,'cli-workspace'));
    const budget=maxBudget(momentum?`momentum_s${index}_`:`s${index}_`),apiPrefix=momentum?`momentum_s${index}_`:portrait?`portrait_s${index}_`:sol?'sol_':`s${index}_`,api=apiMeter(apiPrefix,portrait),
      writingPolicy={...policy,workspace:path.join(dir,'cli-workspace')},opus=createOpusCausalTransport(writingPolicy),
      reader=createAstraCausalTransport({key,rates:replaySettlement.rates.sol,model:'gpt-6.1-sol',inlineReferences:true,fetch:longCallFetch(660000)});
    const routes=momentum?momentumTextRoutes({guard,max:budget,api,policy:writingPolicy,dir,conversation:step=>`trial:${grant.requestId}:${index}:${step}`,
      author:opus,editor:createSolWritingTransport({key,fetch:longCallFetch(660000)}),reader,observe:observeProviderStop}):null;
    let draft:unknown=null;
    const dispatch=(call:any,role:'opus'|'astra')=>({...call,role,conversationKey:`trial:${grant.requestId}:${index}:${call.stage}`});
    const doRead=async(call:any,s:AbortSignal)=>{
      if(receiptRecovery)fail('trial_receipt_no_text_dispatch');
      if(portraitRecovery)fail('trial_portrait_no_source_dispatch');
      guard();const d=dispatch(call,'astra'),wire=prepareCausalWire(d,writingPolicy,2_000_000),rule=trialApiRules(`s${index}_${call.stage}`),reserve=rule?.reserve(wire)??fail('trial_reader_wire');
      return api.run(call.stage,wire,reserve,async()=>{const r=await reader(wire,d,s);return{value:r.output,estimatedMicroUsd:r.estimatedMicroUsd,receipt:r};});
    };
    const visual=async(call:SimpleStoryboardDiagnosticCall,s:AbortSignal)=>{
      if(receiptRecovery)fail('trial_receipt_no_text_dispatch');
      guard();
      if(call.stage==='storyboard'){
        if(portraitRecovery&&index===0){const known=await replayPortraitReviewInput(config);if(!same(prepareSolWritingWire(call),prepareSolWritingWire(known.planner)))fail('trial_portrait_saved_planner');
          draft=known.draft;log('phase saved_planner_reused_no_provider');return structuredClone(known.draft);}
        if(replay){
          const bound=prepareTrialSavedStoryboard(config);
          if(!same(plannerRequest(call),plannerRequest(bound.call)))fail('trial_saved_planner_changed');
          draft=bound.draft;log('phase known_storyboard_recompile');return structuredClone(bound.draft);
        }
        if(boardAttempts++>=BOOK_E2E_TRIAL.storyboardAttempts)fail('trial_storyboard_cap');
        log(`phase storyboard_plan_attempt_${boardAttempts}`);
        if(sol||portrait){
          const wire=prepareSolWritingWire(call),reserve=solWritingMeterRule.reserve(wire)??fail('trial_sol_wire');
          return api.run('storyboard',wire,reserve,async()=>{guard();const r=await createSolWritingTransport({key,fetch:longCallFetch(660000)})(wire,call,s);
            draft=r.output;return{value:r.output,estimatedMicroUsd:r.estimatedMicroUsd,receipt:r};});
        }
        const file=path.join(dir,'storyboard-instructions.txt');exclusiveText(file,plannerRequest(call).instructions);
        const wire=prepareOpusStoryboardWire(call,writingPolicy,file);
        return budget.run('storyboard',wire,2_000_000,async()=>{
          const r=await observeProviderStop(()=>createOpusStoryboardTransport(writingPolicy)(wire,call,s));draft=r.output;return{value:r.output,estimatedMicroUsd:r.estimatedMicroUsd,receipt:r};});
      }
      const payload=simpleWizardVisualPayload(call,'gpt-6.1-sol'),reserve=trialApiRules(apiPrefix+'storyboard_review')?.reserve(payload)??fail('trial_review_wire');
      if(portraitRecovery&&index===0&&previewSha(canonicalJson(payload))!==portraitRecovery.replay.payloadSha)fail('trial_portrait_review_wire');
      return api.run('storyboard_review',payload,reserve,async()=>{
        guard();
        const raw=await new OpenAI({apiKey:key(),baseURL:'https://api.openai.com/v1',maxRetries:0,logLevel:'off',fetch:longCallFetch(660000)})
          .responses.create(payload,{signal:s,timeout:600000});
        return decodeTrialStoryboardReview(call,raw);
      });
    };
    return{dir,visual,draft:()=>draft,citationCorrector:routes?.citationCorrector,
      opus:routes?routes.opus:async(call:any,s:AbortSignal)=>{if(receiptRecovery)fail('trial_receipt_no_text_dispatch');guard();
        if(portraitRecovery)fail('trial_portrait_no_source_dispatch');
        if(portrait){
          const wire=prepareSolWritingWire(call),reserve=solWritingMeterRule.reserve(wire)??fail('trial_sol_wire');
          return api.run(call.stage,wire,reserve,async()=>{guard();const r=await createSolWritingTransport({key,fetch:longCallFetch(660000)})(wire,call,s);
            return{value:r,estimatedMicroUsd:r.estimatedMicroUsd,receipt:r};});
        }
        const d=dispatch(call,'opus'),file=path.join(dir,`${call.stage}-instructions.txt`);exclusiveText(file,call.instructions);
        const wire=prepareCausalWire(d,writingPolicy,2_000_000,file);
        return budget.run(call.stage,wire,2_000_000,async()=>{const r=await observeProviderStop(()=>opus(wire,d,s));return{value:r,estimatedMicroUsd:r.estimatedMicroUsd,receipt:r};});},
      reader:routes?routes.reader:doRead,
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
    const accounting={api:snapshot(()=>meter.snapshot()),claudeMax:snapshot(()=>max.snapshot()),claudeMaxNote:'reported resource, separate from API, not invoice',
      ...(solFamily?{claudeMaxAvailability:solFamily.parent.availabilityAccounting,writingRoute:SOL_WRITING}: {}),
      ...(momentum?{writingRoute:SIMPLE_WRITING_ROLES,solWriting:SOL_WRITING,priorApiMicroUsd:MOMENTUM_BOOK_TRIAL.priorApiMicroUsd+(plan.voiceIntake?.knownMicroUsd??0),
        ...(plan.voiceIntake?{voiceIntake:plan.voiceIntake,originalPriorApiMicroUsd:MOMENTUM_BOOK_TRIAL.priorApiMicroUsd}:{}),
        claudeMaxAllowanceMicroUsd:MOMENTUM_BOOK_TRIAL.maxResourceMicroUsd,cycleCapMicroUsd:MOMENTUM_BOOK_TRIAL.cycleCapMicroUsd,
        claudeMaxNote:'Opus author on Claude Max: CLI-reported list estimate, separate from API, not invoice'}
        :portrait?{writingRoute:SOL_WRITING,claudeMaxNote:'not invoked in this Sol-only book; historical Max unchanged'}:{})};
    save(portraitRecovery?'review-input-final-accounting':bundleRecovery?'sol-bundle-checkpoint-final-accounting':receiptRecovery?'sol-receipt-recovery-final-accounting':sol?'sol-continuation-final-accounting':spanning?'storyboard-source-spans-final-accounting':completing?'source-impact-completion-final-accounting':parent?'source-impact-final-accounting':'final-accounting',accounting);exclusiveJson(outcomeFile,{cycle:trial.id,claimSha,grantSha,status,accounting,...extra,
      ...(parent?{parentClaimSha:parent.claimSha,parentOutcomeSha:parent.outcomeSha,
        ...(portraitRecovery?{originalTerminalOutcomePreserved:true,savedPlannerReused:true}:solFamily?{originalTerminalOutcomePreserved:true,originalStoryboardHoldPreserved:true,...(receiptRecovery?{receiptRecovery:receiptRecovery.receiptRecovery}:{})}:{originalLiteraryHoldPreserved:true})}:{}),
      runtimeEligible:false,productAccepted:false,productionQualified:false});return{status,accounting,...extra};
  };
  try{
    let io=stageIO(portraitRecovery?0:sol?2:spanning?4:parent?continuationTextIndex:0,spanning);
    const runFlow=(io:ReturnType<typeof stageIO>,repair?:{prior:unknown;readings:unknown[]})=>runSimpleWizardBook({...baseCurrent,seed:profile.seed,signal,
      reservedWritingUsd:2,...contracts,...(momentum?{writingModel:SIMPLE_WRITING_ROLES.label,storyExperience:MOMENTUM_BOOK_TRIAL.storyExperience}:portrait?{writingModel:SOL_WRITING.model}:{}),
      ...(repair?{repair}:{}),opus:io.opus,reader:io.reader,visual:io.visual,...(io.citationCorrector?{citationCorrector:io.citationCorrector}:{correctReading:io.correctReading}),
      publish:view=>log(`phase ${view.phase}`)});
    let sourceAdmission:ReturnType<typeof compileSourceImpactReview>|undefined;
    if(portraitRecovery){
      const known=await replayPortraitReviewInput(config);if(previewSha(canonicalJson(known.source))!==portraitRecovery.replay.sourceSha||previewSha(canonicalJson(known.draft))!==portraitRecovery.replay.draftSha||previewSha(canonicalJson(known.readings))!==portraitRecovery.replay.readingsSha)fail('trial_portrait_replay_changed');
      exclusiveJson(path.join(io.dir,'saved-source-replay-provenance.json'),{version:PORTRAIT_REVIEW_INPUT_RECOVERY.version,parentGrantSha:portraitRecovery.parent.grantSha,
        parentClaimSha:portraitRecovery.parent.claimSha,parentOutcomeSha:portraitRecovery.parent.outcomeSha,replay:portraitRecovery.replay,newSourceCalls:0,newPlannerCalls:0,
        originalFailedOutcomePreserved:true,priorApiCalls:portraitRecovery.remaining.apiCallsAlreadyConsumed,priorAccountedMicroUsd:portraitRecovery.remaining.alreadyAccountedMicroUsd});
      const board=await runSimpleStoryboardDiagnostic({...baseCurrent,writerResult:known.source,signal,...contracts,generate:io.visual});
      result={status:board.status,source:known.source,generated:known.generated,readings:known.readings,storyboard:board,runtimeEligible:false};
    }else if(receiptRecovery){
      const recovered=await replayTrialSolStoryboard(config,read(bundleRecovery?bundleRecovery.receiptRecovery.replayGrantFile:receiptRecovery.parent.grantFile));
      if(previewSha(canonicalJson(recovered.result))!==receiptRecovery.receiptRecovery.resultSha||previewSha(canonicalJson(recovered.draft))!==receiptRecovery.receiptRecovery.draftSha)fail('trial_receipt_replay_changed');
      if(bundleRecovery&&previewSha(canonicalJson(recovered.repair))!==bundleRecovery.receiptRecovery.repairSha)fail('trial_receipt_replay_changed');
      result=recovered.result;io.draft=()=>recovered.draft;
      exclusiveJson(path.join(io.dir,'storyboard_repair_input.json'),recovered.repair);
      exclusiveJson(path.join(io.dir,'receipt-recovery-provenance.json'),{...receiptRecovery.receiptRecovery,parentOutcomeSha:receiptRecovery.parent.outcomeSha,originalFailedOutcomePreserved:true,newProviderCalls:0});
      log('phase saved_sol_review_recovered_without_provider');
    }else if(sol){
      const held=read(sol.parent.sourceFile),repair={...read(sol.parent.repairFile),addedContracts:['stateParityContract']} as StoryboardRepair;
      exclusiveJson(path.join(io.dir,'storyboard_repair_input.json'),repair);
      const board=await runSimpleStoryboardDiagnostic({...baseCurrent,writerResult:held.source,signal,...CONTRACTS,selfCheckSourceSpans:true,stateParityContract:true,repair,generate:io.visual});
      result={...held,status:board.status,storyboard:board};
    }else if(spanning){
      const held=read(parent!.sourceFile);sourceAdmission=read(path.join(config.bookDir,'source-impact-admission.json'));
      const repair=read((parent as StoryboardSpanGrant['parent']).repairFile);exclusiveJson(path.join(io.dir,'storyboard_repair_input.json'),repair);
      const board=await runSimpleStoryboardDiagnostic({...baseCurrent,writerResult:held.source,signal,...CONTRACTS,selfCheckSourceSpans:true,repair,generate:io.visual});
      result={...held,status:board.status,storyboard:board};
    }else if(parent){
      const held=read(parent.sourceFile),packets=simpleStoryReadingPackets(prepared.accepted.canonical,held.source,options),
        review=prepareSourceImpactReview({finalPacket:packets.final,readings:held.readings,sourceSha:parent.sourceSha,age:profile.child.age});
      const completion=completing?prepareSourceImpactCompletion(review,read((parent as SourceContinuationGrant['parent']).impactReceiptFile!).output):null,
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
    if(portraitRecovery&&result!.status==='story_held')fail('trial_portrait_no_source_dispatch');
    // A cycle whose source is not repairable (momentum: roles-v1) goes straight to the one typed severity review below.
    if(result!.status==='story_held'&&!parent&&trial.sourceRepairs>0){
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
      const next=sourceRepairUsed?2:1;io=stageIO(next);finalTextDir=`text_${next}`;
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
    const layoutBase=trialStoryboardLayout(profile,finalTextDir,readerSafe,portrait?READER_PORTRAIT_FRAMING_VERSION:READER_SAFE_FRAMING_VERSION);
    // Momentum: narration is planned from the frozen final text BEFORE any image, so page repairs keep room for its whole reservation.
    // A text the TTS guard refuses (e.g. a critical homograph) gives an image-only book with that reason, never altered display text.
    let narrationPlan:BookNarrationPlan|null=null,narrationPlanError:string|null=null;
    if(momentum){
      try{narrationPlan=planBookNarration([{pageNumber:0,text:result.source.manuscript.title},...result.source.manuscript.pages.map(p=>({pageNumber:p.pageNumber,text:p.text}))],
        narrationVoice(prepared.accepted.canonical.bookOptions.voiceId,MOMENTUM_BOOK_TRIAL.narration.voiceIds),MOMENTUM_BOOK_TRIAL.narration.maximumMicroUsd);save('narration-plan',narrationPlan);}
      catch(error){narrationPlanError=(error as any)?.code??'narration_plan_failed';save('narration-plan-refused',{code:narrationPlanError});}
    }
    const narrationReserve=narrationPlan?.reserveMicroUsd??0;
    const continuity=nativeBookContinuityContracts(config.engineContinuity);
    const board=loadReviewedStoryboard(config.bookDir,source,reviewedBookLayoutSchema.parse(layoutBase),continuity);
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
    const loaded=loadReviewedBook(config.bookDir,source,undefined,layout,continuity);
    if(readerSafe&&loaded.current.readerFraming!==grant.visual.readerFraming)fail('trial_reader_framing_binding');
    const art=auditionAdapters({directory:imageDir,meter,key,signal,guard,readerFraming:loaded.current.readerFraming,
      ...(portrait?{reviewCapacity:AUDITION_REVIEW_CAPACITY_VERSION}:{})});
    const childRef=await art.writeImage('reference_child.png',loaded.childBytes),companionRef=await art.writeImage('reference_companion.png',loaded.companionBytes);
    const saved=new Map<string,any>();
    const saveArt=(name:string,v:unknown)=>{saved.set(name,v);save(name,v);};
    let manifest:Awaited<ReturnType<typeof illustrateReviewedAudition>>;
    try{
      manifest=await runTrialAudition({visual:grant.visual,book:loaded.book,rawReview:loaded.rawReview,texts:loaded.texts,current:loaded.current,
        child:childRef,companion:companionRef,companionDescription:loaded.companionDescription,render:art.render,judge:art.judge,identity:art.identity,
        check:guard,save:saveArt,
        progress:e=>{log(`${e.phase} ${e.name} attempt${e.attempt+1}: ${e.status}`);if(e.status==='ineligible_safety')fail('trial_safety_stop');}});
    }catch(error){
      save('diagnostic-review-stop',{code:(error as any)?.code??'review_failed',drawnFrames:config.engineContinuity?trialDrawnFrames(saved):[...saved.keys()].filter(n=>n.startsWith('diagnostic_render_'))});
      writeTrialReader(config.bookDir,result.source.manuscript,saved,[],meter.snapshot(),max.snapshot(),sourceAdmission,sourceRepairUsed?'text_1':'text',config.engineContinuity?{status:'review_stopped'}:undefined);
      throw error;
    }
    const sheets={entities:saved.get('sheet_entities') as SavedSheet,locations:saved.get('sheet_locations') as SavedSheet},references=referenceStatus(sheets),
      canonical=[childRef,companionRef,references.entities.image,references.locations.image];
    const selected:SavedPage[]=continuity?trialSelectedPages(manifest,saved):Array.from({length:9},(_,n)=>saved.get('page_'+n) as SavedPage);
    const bookQa=continuity?trialBookVisualQualification(manifest):undefined;
    const readerVisualStatus:TrialReaderVisualStatus|undefined=bookQa?{status:manifest.scope.complete?'full_book_diagnostic':'held_visual_sample',bookQa,scope:manifest.scope}:undefined;
    if(continuity&&!manifest.scope.complete){
      save('final-selection',{manifestSha:previewSha(canonicalJson(manifest)),pages:selected,bookQa,detailNonblocking:true,productAccepted:false});
      writeTrialReader(config.bookDir,result.source.manuscript,saved,selected,meter.snapshot(),max.snapshot(),sourceAdmission,sourceRepairUsed?'text_1':'text',readerVisualStatus);
      return finish('held_visual_sample',{bookQa,pages:selected.map(p=>({page:p.pageNumber,status:p.status,attempts:p.attempts.length,candidate:p.chosen.candidate})),
        supported:selected.filter(p=>p.status==='qa_supported').length,fullCoverage:false,scope:manifest.scope,sourceRepairUsed,storyboardAttempts:boardAttempts,
        viewer:path.join(config.bookDir,'viewer','index.html')});
    }
    // The prospective CDE mode is one attempt/frame with a sample stop. Legacy post-hoc repair authority never upgrades into it.
    for(const page of continuity?[]:selected){
      let last=page.attempts[page.attempts.length-1];
      for(let attempt=page.attempts.length;attempt<BOOK_E2E_TRIAL.pageAttempts&&page.status==='held';attempt++){
        // Keep sufficient reservation for one edit, its full review and identity. A lack of headroom is not an unknown charge.
        // Momentum also keeps the narration reservation and the shared API+Max ceiling (zero/absent for every other cycle).
        const apiSpent=meter.snapshot().cumulativeAccountedMicroUsd;
        if(apiSpent+1_400_000+narrationReserve>BOOK_E2E_TRIAL.apiCapMicroUsd||
          momentum&&apiSpent+max.snapshot().accountedMicroUsd+1_400_000+narrationReserve>MOMENTUM_BOOK_TRIAL.cycleCapMicroUsd)break;
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
    save('final-selection',{manifestSha:previewSha(canonicalJson(manifest)),pages:selected,...(bookQa?{bookQa}:{}),detailNonblocking:true,productAccepted:false});
    writeTrialReader(config.bookDir,result.source.manuscript,saved,selected,meter.snapshot(),max.snapshot(),sourceAdmission,sourceRepairUsed?'text_1':'text',readerVisualStatus);
    // Momentum: narrate the frozen text (one claimed call per page, no retry), then the local Reader bundle. A narration stop keeps its
    // evidence and gives an image-only Reader; it never retries, re-prices or presents partial audio as narration.
    let narration:Record<string,unknown>|null=null,readerPreview:ReturnType<typeof writeLocalReaderBundle>|null=null;
    if(momentum){
      let made:Awaited<ReturnType<typeof narrateBook>>|null=null;
      if(narrationPlan){
        try{made=await narrateBook({plan:narrationPlan,meter,transport:createNarrationTransport({key:elevenLabsKeyReader(config.keyFile)}),guard,
          outDir:path.join(config.bookDir,'narration'),signal,probe:probeNarrationAudio,log});narration={status:'narrated',voice:narrationPlan.voice,characters:narrationPlan.characters,
          reserveMicroUsd:narrationPlan.reserveMicroUsd,accountedMicroUsd:made.accountedMicroUsd,pages:made.pages.map(({audioFile:_f,...p})=>p)};}
        catch(error){narration={status:'narration_stopped',code:(error as any)?.code??'narration_failed',voice:narrationPlan.voice};}
      }else narration={status:'narration_unavailable',code:narrationPlanError};
      save('narration-outcome',narration);guard();
      readerPreview=writeLocalReaderBundle({root:localReaderRoot(),id:momentumReaderId(grant.requestId),title:result.source.manuscript.title,childName:profile.child.name,
        sourceSha256:shaFile(path.join(config.bookDir,'final-selection.json')),
        pages:selected.map(p=>({pageNumber:p.pageNumber,text:p.pageNumber?result.source.manuscript.pages.find(x=>x.pageNumber===p.pageNumber)!.text:result.source.manuscript.title,
          imageFile:path.join(imageDir,p.chosen.candidate.imageName)})),
        narration:made&&narrationPlan?{voice:narrationPlan.voice,pages:made.pages}:null});
      log(`phase reader_ready ${readerPreview.url}`);
    }
    return finish('full_book_diagnostic',{...(bookQa?{bookQa}:{}),...(momentum?{narration,readerPreview}:{}),pages:selected.map(p=>({page:p.pageNumber,status:p.status,attempts:p.attempts.length,candidate:p.chosen.candidate})),
      supported:selected.filter(p=>p.status==='qa_supported').length,fullCoverage:selected.length===9,sourceRepairUsed,storyboardAttempts:boardAttempts,
      ...(sourceAdmission?{sourceAdmission}:{}),
      viewer:path.join(config.bookDir,'viewer','index.html')});
  }catch(error){
    if(!existsSync(outcomeFile))finish('failed_trial',trialFailureDetails(error,providerState.stop));
    throw error;
  }
}
/**
 * Review UI only: exact source text and selected images; candidate-only frames never masquerade as QA-supported. `heldTextDir` is where
 * the held text and its readings live ('text_1' after a source repair; 'text' when the source is not repairable).
 */
export type TrialReaderVisualStatus={status:'held_visual_sample'|'full_book_diagnostic';bookQa:ReturnType<typeof trialBookVisualQualification>;
  scope:Awaited<ReturnType<typeof illustrateReviewedAudition>>['scope']}|{status:'review_stopped'};
export function writeTrialReader(dir:string,story:{title:string;pages:{pageNumber:number;text:string}[]},saved:Map<string,any>,selected:SavedPage[],api:unknown,max:unknown,sourceAdmission?:unknown,heldTextDir:'text'|'text_1'='text_1',visualStatus?:TrialReaderVisualStatus){
  const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  let visualNotice='<p>ספר ניסוי חדש — כריכה ושמונה עמודים. הערות detail אינן חוסמות; HOLD אינו אישור מוצר. כל הטיוטות, הרפרנסים, הביקורות והעלויות נשמרו בתיקיית הספר.</p>';
  if(visualStatus){
    if(visualStatus.status==='review_stopped'){
      visualNotice='<aside role="status" data-book-status="review_stopped"><h2>היצירה נעצרה לפני השלמת בדיקת האיורים</h2><p>אין אישור לספר או להשלמתו. פרטי העצירה והאיורים שהספיקו להישמר זמינים לבדיקה.</p><p><a href="../diagnostic-review-stop.json">פרטי עצירת הבדיקה</a></p></aside>';
    }else{
      const qa=visualStatus.bookQa,partial=!qa.complete;
      const heading=partial?'הספר נעצר בשלב הדוגמה':qa.qaSupported?'בדיקות האיור האוטומטיות עברו':'הספר טרם אושר בביקורת האיורים';
      const reason=qa.scaleVerification.status==='defect'?'נמדד גודל מלווה מחוץ לטווח המאושר.'
        :qa.scaleVerification.status==='unverified'?'אין מדידת גודל תקפה של המלווה.'
        :!qa.qaSupported?'חלק מבדיקות האיור עדיין מחזיקות את הספר לבדיקה.':'הבדיקות האוטומטיות תומכות באיורים שנוצרו.';
      visualNotice=`<aside role="status" data-book-status="${esc(visualStatus.status)}" data-manifest-status="${esc(qa.manifestStatus)}" data-scale-gate="${esc(visualStatus.scope.sampleScaleGate?.status??'not_present')}"><h2>${heading}</h2><p>נוצרו ${selected.length} מתוך ${story.pages.length+1} איורים.</p><p>${reason}</p>${partial?'<p>לא נוצרו יתר האיורים ולא הופעלה קריינות.</p>':''}<p>אישור של עמודים בודדים אינו אישור לספר. עדיין נדרש אישור מוצר.</p><p><a href="../reviewed_audition_manifest.json">פרטי ביקורת האיורים</a></p></aside>`;
    }
  }
  const sourceNotice=sourceAdmission?`<header><h2>איכות הטקסט — הבחנה מפורשת לניסוי</h2><p>ביקורת ספרותית קודמת נשארה HOLD. ${heldTextDir==='text_1'?'הטקסט לא שונה שוב.':'הטקסט לא שונה (מקור זה אינו עובר תיקון).'} המשך האיור נשען על ביקורת חומרה חדשה ומוצמדת; זה אינו אישור מוצר או אישור ייצור.</p><p><a href="../${heldTextDir}/simple-book-result.json">הטקסט והביקורות הקודמות</a> · <a href="../source-impact-admission.json">הביקורת החדשה והנימוקים</a></p><details><summary>פירוט סיווג החומרה</summary><pre dir="ltr">${esc(JSON.stringify(sourceAdmission,null,2))}</pre></details></header>`:'';
  const frames=sourceNotice+Array.from({length:9},(_,n)=>{
    const ready=selected.find(p=>p.pageNumber===n)??saved.get(`page_${n}`),halted=visualStatus?.status==='review_stopped'&&!ready?saved.get(`halted_page_${n}`):undefined;
    const drawn=visualStatus?.status==='review_stopped'&&!ready?saved.get(`drawn_page_${n}`):undefined;
    const last=Array.isArray(halted?.attempts)?[...halted.attempts].reverse().find(a=>!!a?.candidate):undefined;
    const unreviewed=drawn?.candidate?{attempt:drawn.attempt,candidate:drawn.candidate,status:'review_incomplete'}:undefined;
    const pending=last??unreviewed,p=ready??(pending?{chosen:pending,attempts:last?halted.attempts:[pending],status:pending.status}:undefined),candidate=p?.chosen?.candidate??saved.get(`diagnostic_render_${n}`)?.candidate;
    if(!candidate)return`<section><h2>${n===0?'כריכה':`עמוד ${n}`}</h2><p>לא נוצר איור. אין כאן השלמת ספר.</p></section>`;
    return`<section id="p${n}"><h2>${n===0?esc(story.title):`עמוד ${n}`}</h2><img src="../illustrations/${esc(candidate.imageName)}" alt="${n===0?'כריכה':`עמוד ${n}`}"/><article><p class="story">${n?esc(story.pages.find(p=>p.pageNumber===n)?.text):esc(story.title)}</p>${!ready&&pending?'<p data-illustration-state="drawn_review_incomplete">האיור נוצר, אך הביקורת לא הושלמה. האיור אינו מאושר.</p>':''}<p>QA: <b dir="ltr">${esc(p?.status??'not_reviewed')}</b> · ${p?.attempts?.length??1} ניסיונות</p><ul>${(p?.chosen?.assessment?.findings??[]).map((f:any)=>`<li><b dir="ltr">${esc(f.impact)}</b>: ${esc(f.note)}</li>`).join('')}</ul>${p?.attempts?.length>1?`<details><summary>כל הניסיונות שנשמרו</summary>${p.attempts.map((a:any)=>a.candidate?`<figure><img loading="lazy" src="../illustrations/${esc(a.candidate.imageName)}"/><figcaption>${a.attempt+1} — ${esc(a.status)}</figcaption></figure>`:'').join('')}</details>`:''}</article></section>`;
  }).join('');
  const viewer=path.join(dir,'viewer');if(!existsSync(viewer))mkdirSync(viewer);
  exclusiveText(path.join(viewer,'index.html'),`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(story.title)}</title><style>body{margin:0;background:#f6f2e8;color:#222;font:18px/1.7 system-ui}header,footer{padding:30px;max-width:1100px;margin:auto}section{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr);gap:25px;padding:30px;max-width:1200px;margin:20px auto;background:white;border-radius:16px}h2{grid-column:1/-1}img{width:100%;height:auto;border-radius:10px}.story{font-size:23px;white-space:pre-line}pre{white-space:pre-wrap;overflow-wrap:anywhere}figure{margin:15px 0}@media(max-width:750px){section{display:block;padding:16px}.story{font-size:21px}}</style><header><h1>${esc(story.title)}</h1>${visualNotice}</header>${frames}<footer><h2>חשבונאות אמיתית — API ו־Max בנפרד</h2><pre dir="ltr">${esc(JSON.stringify({api,claudeMaxResource:max,note:'Max reported resource, not API invoice'},null,2))}</pre></footer></html>`);
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
