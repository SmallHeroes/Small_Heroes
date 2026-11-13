/**
 * Local rehearsal of the PAID current-engine recipe, end to end, on this computer.
 *
 * Same code as a Wizard order after payment: the one customer-authority builder (engineCustomerAuthority), the
 * current-engine bundle (Image 2.6, automatic storyboard repairs, bound review, Opus author through Message
 * Batches), the same native producer, materializer (illustrations, narration, PDF) and raw re-admission.
 * Local files only: no Order, payment, database, storage bucket, email or customer delivery exists here.
 *
 *   plan (provider-free):  node node_modules/tsx/dist/cli.mjs --require ./scripts/shims/register-server-only.cjs \
 *                            scripts/engine-local-current-book.ts --profile <PROFILE.json> --out <dir> --key-env-file <file>
 *   execute (paid):        ... same ... --execute            (requires <dir>/OWNER-GO.json written after the owner's go)
 *   resume after a crash:  ... same ... --execute --resume   (never repurchases a settled call; an unknown dispatch stops)
 *   stop between calls:    create <dir>/OWNER-STOP
 * One GO is consumed once, machine-wide (local-consent-ledger.ts, outside every output folder): it executes only through an existing,
 * independently reviewed registration of exactly its bytes, source, profile, output and reader (this command never creates one), a copy
 * elsewhere is refused, one process runs at a time, and every dispatch is witnessed there before the provider is called (a lost journal keeps
 * its reserves and stops).
 */
import 'server-only';
import {existsSync,lstatSync,mkdirSync,readFileSync,realpathSync,renameSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {canonicalHash} from '../lib/canonical-json';
import {engineSiteFail} from '../lib/engine-site/contract';
import {prepareEngineOrder,resolveEngineWizardOptions} from '../lib/engine-site/personal-orders';
import {engineCustomerAuthority} from '../lib/engine-site/personal-jobs';
import {engineSpendPolicySchema,type EngineSpendPolicy} from '../lib/engine-site/platform-policy';
import {ENGINE_CURRENT_CUSTOMER_V2,type EngineCurrentVersion} from '../lib/engine-site/current-engine-policy';
import {ENGINE_IMAGE26_POLICY} from '../lib/engine-site/image-model-policy';
import {engineQaRequired} from '../lib/engine-site/qa-order-policy';
import {LocalEngineTrialRuntime,validateLocalTrialAuthority,LOCAL_CURRENT_ENGINE_MAX_CALLS} from '../lib/engine-site/local-trial-runtime';
import {runLocalEngineTrialBook,localTrialReaderBundle} from '../lib/engine-site/local-trial-book';
import {LOCAL_CONSENT_LEDGER_ROOT,localConsentLedger,admitLocalCurrentRegistration,claimLocalConsent,acquireLocalLease,localConsentDispatchWitness} from '../lib/engine-site/local-consent-ledger';
import {admitLocalEntitiesContinuation,claimLocalEntitiesContinuation,localCurrentBoundaries,localCurrentBoundary,localCurrentEntitiesSchema,localCurrentLocationsSchema,localCurrentPictureBookSchema,localCurrentSpatialSchema,localCurrentSpatialCorrectionSchema,localCurrentScaleContinuationSchema,localCurrentLandmarkContinuationSchema,localCurrentMediaRecoverySchema,localCurrentMediaRecoverySlots,localCurrentTransition,localCurrentLocationAttempt,localCurrentLocationRepairSlots,localEntitiesAllowedStep,previewLocalEntitiesContinuation,readLocalEntityParentGo,type LocalEntitiesPreparation} from '../lib/engine-site/local-current-entities';
import {localReaderId} from '../lib/local-reader-preview';

const KEYS=['OPENAI_API_KEY','ANTHROPIC_API_KEY','ELEVENLABS_API_KEY'] as const;
type KeyName=typeof KEYS[number];
const absolute=z.string().refine(path.isAbsolute,'absolute path required');
const digest=z.string().regex(/^[a-f0-9]{64}$/);
export const LOCAL_CURRENT_IMAGE_MODEL={version:ENGINE_IMAGE26_POLICY,model:'gpt-image-2.6-sunburst',complexity:'high'} as const;
export const localCurrentProfileSchema=z.object({version:z.literal('local-fictional-book-profile/v1'),fictional:z.literal(true),provenance:z.string().min(1),
 input:z.object({appearance:z.object({kind:z.literal('description')}).passthrough()}).passthrough()}).strict();
/** Written only after the owner's explicit go in chat; it names the exact source, profile and ceiling it approves. */
export const localCurrentGoSchema=z.object({version:z.literal('engine-local-current-book-go/v1'),approvedBy:z.literal('Guy'),approvedAt:z.string().datetime({precision:3}),
 approvalReference:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/),ownerWords:z.string().min(1),sourceRevision:z.string().regex(/^[a-f0-9]{40}$/),
 profileSha256:digest,maximumMicroUsd:z.literal(12_000_000),maximumCalls:z.literal(LOCAL_CURRENT_ENGINE_MAX_CALLS),readerId:z.string(),
 fictional:z.literal(true),realPayment:z.literal(false),publicDelivery:z.literal(false),
 entitiesContinuation:z.object({parent:z.discriminatedUnion('version',[localCurrentEntitiesSchema,localCurrentLocationsSchema,localCurrentPictureBookSchema,localCurrentSpatialSchema,localCurrentSpatialCorrectionSchema,localCurrentScaleContinuationSchema,localCurrentLandmarkContinuationSchema,localCurrentMediaRecoverySchema]),firstWireSha256:digest}).strict().optional()}).strict();

const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
function readFile(file:string){if(lstatSync(file).isSymbolicLink()||realpathSync(file)!==path.resolve(file))engineSiteFail('local_current_file_path');return readFileSync(file);}
const git=(root:string,...args:string[])=>execFileSync('git',['-c','safe.directory='+root,'-C',root,...args],{encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
function frozenHead(root:string){
 if(git(root,'status','--porcelain','--untracked-files=no')||git(root,'ls-files','--others','--exclude-standard','--','app','lib','backend','scripts','config'))engineSiteFail('local_current_source_not_frozen');
 return git(root,'rev-parse','HEAD');
}
const safeError=(error:unknown)=>{const x=error&&typeof error==='object'?error as {code?:unknown;message?:unknown}:{};
 return typeof x.code==='string'&&/^[a-z][a-z0-9_]{1,100}$/.test(x.code)?x.code:typeof x.message==='string'&&/^[a-z][a-z0-9_]{1,100}$/.test(x.message)?x.message:'local_current_book_stopped';};
/** Reads only the three provider names from the owner's local env file. Values are never printed, hashed or copied. */
function keyReader(file:string){
 const cache=new Map<KeyName,string>();
 const value=(name:KeyName)=>{const hit=cache.get(name);if(hit)return hit;
  const line=readFile(file).toString('utf8').replace(/^\uFEFF/,'').split(/\r?\n/).find(l=>new RegExp('^\\s*(?:export\\s+)?'+name+'\\s*=').test(l));
  let v=line?.replace(new RegExp('^\\s*(?:export\\s+)?'+name+'\\s*=\\s*'),'').trim();if(v&&/^(['"])(.*)\1$/.test(v))v=v.slice(1,-1);
  if(!v||/\s/.test(v))engineSiteFail('local_current_credential_unavailable');cache.set(name,v);return v;};
 const present=()=>Object.fromEntries(KEYS.map(k=>{try{value(k);return [k,true];}catch{return [k,false];}}));
 return {value,present,secrets:()=>[...cache.values()]};
}
function exclusive(file:string,value:unknown){writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});}
function writeOnceOrSame(file:string,value:unknown){
 if(!existsSync(file)){exclusive(file,value);return;}
 if(canonicalHash(JSON.parse(readFile(file).toString('utf8')))!==canonicalHash(value))engineSiteFail('local_current_record_changed');
}

export function localCurrentPolicy(head:string,go:{approvalReference:string;approvedAt:string},version:EngineCurrentVersion=ENGINE_CURRENT_CUSTOMER_V2):EngineSpendPolicy{
 return engineSpendPolicySchema.parse({version:'engine-site-spend-policy/v1',sourceRevision:head,maximumMicroUsd:12_000_000,maximumCalls:LOCAL_CURRENT_ENGINE_MAX_CALLS,
  approvalReference:go.approvalReference,approvedBy:'Guy',approvedAt:go.approvedAt,paidProviderActivation:'owner_approved_live_personal_orders',
  engineProfile:{version,imageModelPolicy:{...LOCAL_CURRENT_IMAGE_MODEL}}});
}
/** Provider-free: the exact customer authority this profile would get on the current source. */
export function prepareLocalCurrentBook(root:string,profileFile:string,go:{approvalReference:string;approvedAt:string},
 continuation?:{parentOrderId:string;locationsRepair?:true|2|3|4|5|6|7;mediaRecoveryPage?:number}){
 if(engineQaRequired())engineSiteFail('local_current_qa_environment_present');
 const head=frozenHead(root),profileBytes=readFile(profileFile),profile=localCurrentProfileSchema.parse(JSON.parse(profileBytes.toString('utf8')));
 const options=resolveEngineWizardOptions(root);
 const input={...profile.input,optionsFingerprint:options.fingerprint};
 const prepared=prepareEngineOrder(input,{id:'local_owner_guy',email:'fictional-local@example.invalid',name:'Local rehearsal'},options);
 const attempt=continuation?.locationsRepair===true?1:continuation?.locationsRepair??0;
 const policy=localCurrentPolicy(head,go,continuation?localCurrentTransition(localCurrentBoundaries[attempt]).to:ENGINE_CURRENT_CUSTOMER_V2);
 const authority=currentAuthority(prepared,policy,continuation?.parentOrderId??go.approvalReference,localCurrentLocationAttempt(attempt),continuation?.mediaRecoveryPage);
 return {head,profile,profileSha256:sha(profileBytes),options,prepared,policy,authority};
}

function currentAuthority(prepared:ReturnType<typeof prepareEngineOrder>,policy:EngineSpendPolicy,orderId:string,locationAttempt:0|1|2|3|4,mediaRecoveryPage?:number){
 const full=engineCustomerAuthority(orderId,prepared.snapshot,prepared.inputSha256,policy);
 const steps=locationAttempt?localCurrentLocationRepairSlots(full.budget.steps,locationAttempt):full.budget.steps;
 return validateLocalTrialAuthority({...full,budget:{...full.budget,steps:mediaRecoveryPage===undefined?steps:localCurrentMediaRecoverySlots(steps,mediaRecoveryPage)}});
}

/** No output or credential access; also used to construct the exact review package before registration. */
export async function prepareLocalCurrentEntities(root:string,profileFile:string,out:string,go:z.infer<typeof localCurrentGoSchema>,ledgerRoot=LOCAL_CONSENT_LEDGER_ROOT,terminalTargetForReplay?:true){
 const request=go.entitiesContinuation??engineSiteFail('local_entities_spec_required');
 const stage=localCurrentTransition(localCurrentBoundary(request.parent)).index;
 const chain=[{go,out}];
 for(let i=stage;i>=0;i--){
  const spec=chain[0].go.entitiesContinuation?.parent;
  if(!spec||localCurrentBoundary(spec)!==localCurrentBoundaries[i])engineSiteFail('local_entities_parent_recursive');
  chain.unshift({go:localCurrentGoSchema.parse(readLocalEntityParentGo(spec)),out:path.dirname(spec.parentGo.file)});
 }
 const original=chain[0].go;
 if(original.entitiesContinuation||new Set(chain.map(x=>x.go.approvalReference)).size!==chain.length)engineSiteFail('local_entities_parent_recursive');
 const p=prepareLocalCurrentBook(root,profileFile,go,{parentOrderId:original.approvalReference,
  ...(stage?{locationsRepair:stage===1?true as const:stage}:{}),
  ...(request.parent.version==='engine-local-current-media-recovery/v1'?{mediaRecoveryPage:request.parent.edit.page}:{})});
 if(go.sourceRevision!==p.head||go.profileSha256!==p.profileSha256)engineSiteFail('local_current_go_scope');
 const base={snapshot:p.prepared.snapshot,profileSha256:p.profileSha256,readerId:go.readerId,ledgerRoot};
 let upstream:LocalEntitiesPreparation|undefined;
 let parentAuthority=currentAuthority(p.prepared,localCurrentPolicy(original.sourceRevision,original),original.approvalReference,0);
 for(let i=1;i<chain.length;i++){
  const item=chain[i],prior=chain[i-1],step=item.go.entitiesContinuation!,last=i===chain.length-1;
  const transition=localCurrentTransition(localCurrentBoundary(step.parent));
  const authority=last?p.authority:currentAuthority(p.prepared,
   localCurrentPolicy(item.go.sourceRevision,item.go,transition.to),original.approvalReference,localCurrentLocationAttempt(transition.index));
  const cap=await admitLocalEntitiesContinuation({...base,spec:step.parent,parentGo:prior.go,parentAuthority,authority,
   out:item.out,upstream,terminalTargetForReplay:last?terminalTargetForReplay:true});
  const first=await previewLocalEntitiesContinuation(cap,p.prepared.snapshot,authority);
  if(last)return {p,cap,first};
  if(first.call.wireSha256!==step.firstWireSha256)engineSiteFail('local_locations_current_parent_wire');
  upstream=cap;
  parentAuthority=authority;
 }
 return engineSiteFail('local_entities_parent_recursive');
}

/** `options.consentRoot`: tests only (a scratch ledger); the command line always uses LOCAL_CONSENT_LEDGER_ROOT. */
export async function localCurrentBookCLI(argv:string[],options:{consentRoot?:string}={}){
 const flag=(name:string)=>{const i=argv.indexOf(name);if(i<0||!argv[i+1])engineSiteFail('local_current_arguments');return path.resolve(absolute.parse(argv[i+1]));};
 const execute=argv.includes('--execute'),resume=argv.includes('--resume');
 if(argv.length!==6+Number(execute)+Number(resume)||resume&&!execute)engineSiteFail('local_current_arguments');
 const root=realpathSync(process.cwd()),profileFile=flag('--profile'),out=flag('--out'),keyFile=flag('--key-env-file');
 if(out.toLowerCase()===root.toLowerCase()||out.toLowerCase().startsWith(root.toLowerCase()+path.sep))engineSiteFail('local_current_output_inside_source');
 const keys=keyReader(keyFile),goFile=path.join(out,'OWNER-GO.json');
 if(!execute){
  const provisional={approvalReference:'local_current_book_plan',approvedAt:new Date().toISOString().replace(/\.\d{3}Z$/,'.000Z')};
  const go=existsSync(goFile)?localCurrentGoSchema.parse(JSON.parse(readFile(goFile).toString('utf8'))):null;
  if(go?.entitiesContinuation){
   const {p,cap,first}=await prepareLocalCurrentEntities(root,profileFile,out,go,options.consentRoot);
   if(first.call.wireSha256!==go.entitiesContinuation.firstWireSha256)engineSiteFail('local_entities_first_wire_changed');
   console.log(JSON.stringify({status:'local_entities_continuation_plan',head:p.head,authoritySha256:canonicalHash(p.authority),carried:cap.carried,
    firstCall:first.call,preparedSha256:cap.preparedSha256,providerCalls:0}));return 0;
  }
  const p=prepareLocalCurrentBook(root,profileFile,go??provisional);
  console.log(JSON.stringify({status:'local_current_book_plan',sourceRevision:p.head,profileSha256:p.profileSha256,optionsFingerprint:p.options.fingerprint,
   authoritySha256:canonicalHash(p.authority),purpose:p.authority.purpose,currentEngine:p.authority.currentEngine,authorTransport:p.authority.authorTransport,
   imageModelPolicy:p.authority.imageModelPolicy,imageQuality:p.authority.imageQuality,voiceId:(p.prepared.snapshot.request as any).bookOptions?.voiceId,
   maximumMicroUsd:p.authority.budget.maximumMicroUsd,maximumCalls:p.authority.budget.maximumCalls,declaredSlots:p.authority.budget.steps.length,
   ownerGo:existsSync(goFile),credentialsPresent:keys.present(),providerCalls:0}));
  return 0;
 }
 // One captured read of the approval: the bytes that are parsed are the bytes that are hashed and bound.
 const goBytes=readFile(goFile),go=localCurrentGoSchema.parse(JSON.parse(goBytes.toString('utf8')));
 if(go.entitiesContinuation&&resume)engineSiteFail('local_entities_resume_forbidden');
 const continuation=go.entitiesContinuation?await prepareLocalCurrentEntities(root,profileFile,out,go,options.consentRoot):null;
 if(continuation&&continuation.first.call.wireSha256!==go.entitiesContinuation!.firstWireSha256)engineSiteFail('local_entities_first_wire_changed');
 const p=continuation?.p??prepareLocalCurrentBook(root,profileFile,go);
 if(go.sourceRevision!==p.head||go.profileSha256!==p.profileSha256)engineSiteFail('local_current_go_scope');
 localReaderId(go.readerId);
 if(realpathSync(out)!==out)engineSiteFail('local_current_output_path');
 const journal=path.join(out,'journal'),authoritySha256=canonicalHash(p.authority),goSha256=sha(goBytes);
 const readerRoot=path.join(root,'outputs','local-reader-previews'),destination=path.join(readerRoot,go.readerId);
 // The consent is consumed ONCE, machine-wide, outside every output and journal tree (a copied GO or another folder is not a new approval).
 const ledger=localConsentLedger(options.consentRoot??LOCAL_CONSENT_LEDGER_ROOT,go.approvalReference);
 if(ledger.root===out||ledger.root.startsWith(out+path.sep)||out.startsWith(ledger.root+path.sep))engineSiteFail('local_current_ledger_path');
 if(!resume&&existsSync(destination))engineSiteFail('local_current_reader_exists');
 if(continuation&&(existsSync(path.join(out,'OWNER-STOP'))||frozenHead(root)!==p.head||sha(readFile(goFile))!==goSha256))
  engineSiteFail('local_entities_launch_changed');
 // The GO's own reference is not authority: only an existing registration of exactly these bytes and this activation admits it.
 const registration=admitLocalCurrentRegistration(ledger,go,{goSha256,sourceRevision:p.head,profileSha256:p.profileSha256,out,readerId:go.readerId});
 const consent=claimLocalConsent(ledger,{approvalReference:go.approvalReference,registrationSha256:registration.registrationSha256,goSha256,
  goCanonicalSha256:canonicalHash(go),sourceRevision:p.head,profileSha256:p.profileSha256,authoritySha256,out,journal},resume);
 const checkParent=continuation?claimLocalEntitiesContinuation(continuation.cap,{consentSha256:consent.consentSha256,goSha256,authoritySha256,out}):null;
 const claim={version:'engine-local-current-book-claim/v1',authoritySha256,sourceRevision:p.head,profileSha256:p.profileSha256,goSha256,out};
 const claimFile=path.join(out,'CLAIM.json');
 if(resume)writeOnceOrSame(claimFile,claim);else{if(existsSync(claimFile))engineSiteFail('local_current_already_claimed');exclusive(claimFile,claim);}
 writeOnceOrSame(path.join(out,'POLICY.json'),p.policy);writeOnceOrSame(path.join(out,'AUTHORITY.json'),p.authority);
 const terminal=path.join(out,'OUTCOME.json');if(existsSync(terminal)){console.log(JSON.stringify({status:'already_terminal',outcomeSha256:sha(readFile(terminal))}));return 0;}
 const lease=acquireLocalLease(ledger,consent.consentSha256,resume);
 try{
 const liveFile=path.join(out,'RUNNING.json');
 if(existsSync(liveFile))renameSync(liveFile,path.join(out,'RUNNING-previous-'+Date.now()+'.json'));
 exclusive(liveFile,{pid:process.pid,startedAt:new Date().toISOString(),authoritySha256});
 const assertCurrent=()=>{lease.assert();registration.check();if(existsSync(path.join(out,'OWNER-STOP')))engineSiteFail('local_current_owner_stop');if(frozenHead(root)!==p.head)engineSiteFail('local_current_source_changed');
  if(checkParent){if(sha(readFile(goFile))!==goSha256||sha(readFile(profileFile))!==p.profileSha256)engineSiteFail('local_entities_launch_changed');checkParent();}};
 const runtime=new LocalEngineTrialRuntime({root:journal,authority:p.authority,ownerId:p.prepared.snapshot.ownerId,
  draftId:p.prepared.snapshot.request.draftId,snapshotSha256:p.prepared.inputSha256,assertCurrent,
  ...(continuation?{carried:continuation.cap.carried,allowedStep:(step:string,wireSha256:string)=>
   localEntitiesAllowedStep(continuation.cap,step)&&
   (step!==continuation.first.call.step||wireSha256===continuation.first.call.wireSha256)}:{}),
  dispatchWitness:localConsentDispatchWitness(ledger,consent.consentSha256,p.authority)});
 // Missing or ambiguous local evidence of a witnessed dispatch keeps every reserve and stops here, before any credential or provider.
 if((await runtime.meter()).blocked)engineSiteFail('local_current_journal_blocked');
 // Only logs are scrubbed; the raw provider evidence stays unchanged in the private local journal.
 const original={log:console.log,warn:console.warn,error:console.error};
 for(const name of ['log','warn','error'] as const)console[name]=(...args:unknown[])=>{let text=args.map(a=>typeof a==='string'?a:a instanceof Error?safeError(a):JSON.stringify(a)).join(' ');
  for(const secret of keys.secrets())text=text.split(secret).join('[REDACTED]');original[name](text);};
 let beating=false;const beat=setInterval(()=>{if(beating)return;beating=true;void runtime.meter().then(m=>{
  const value={at:new Date().toISOString(),pid:process.pid,phase:runtime.checkpoint.phase,calls:Object.keys(runtime.checkpoint.calls),meter:m},temp=path.join(out,'live.tmp');
  writeFileSync(temp,JSON.stringify(value,null,2));renameSync(temp,path.join(out,'live.json'));}).catch(()=>{}).finally(()=>{beating=false;});},15000);beat.unref();
 try{
  const provider={fetch,openAIKey:()=>keys.value('OPENAI_API_KEY'),anthropicKey:()=>keys.value('ANTHROPIC_API_KEY')};
  const result=await runLocalEngineTrialBook({runtime,directory:out,snapshot:p.prepared.snapshot,provider,narration:{fetch,key:()=>keys.value('ELEVENLABS_API_KEY')},
   ...(continuation?{entitiesContinuation:continuation.cap}:{})});
  assertCurrent();
  const staging=path.join(out,'reader-staging'),bundle=localTrialReaderBundle(staging,go.readerId,result);
  mkdirSync(readerRoot,{recursive:true});if(path.dirname(path.resolve(bundle.directory))!==path.resolve(staging)||existsSync(destination))engineSiteFail('local_current_reader_destination');
  renameSync(bundle.directory,destination);
  const outcome={version:'engine-local-current-book-outcome/v1',completedAt:new Date().toISOString(),status:'automated_supported_owner_review_pending',fictional:true,
   authoritySha256:claim.authoritySha256,sourceRevision:p.head,book:result.book,admittedFrames:result.admittedFrames,meter:result.meter,pdfFile:result.pdfFile,
   reader:{directory:destination,path:bundle.url},productAccepted:false,productionQualified:false};
  exclusive(terminal,outcome);console.log(JSON.stringify({status:outcome.status,admittedFrames:result.admittedFrames,meter:result.meter,reader:bundle.url}));return 0;
 }catch(error){
  const stop={version:'engine-local-current-book-stop/v1',at:new Date().toISOString(),reason:safeError(error),phase:runtime.checkpoint.phase,
   calls:Object.keys(runtime.checkpoint.calls),meter:await runtime.meter().catch(()=>null),productAccepted:false};
  exclusive(path.join(out,'STOP-'+Date.now()+'.json'),stop);console.error(JSON.stringify(stop));return 1;
 }finally{clearInterval(beat);Object.assign(console,original);}
 }finally{lease.release();}
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(__filename))
 localCurrentBookCLI(process.argv.slice(2)).then(code=>{process.exitCode=code;},error=>{console.error(JSON.stringify({status:'local_current_refused',reason:safeError(error)}));process.exitCode=2;});
