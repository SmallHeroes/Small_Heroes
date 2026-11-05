/** Explicit ONE local fictional-book operator. No web activation, PayMe, remote DB, public delivery or automatic loop. */
import 'server-only';
import {existsSync,lstatSync,mkdirSync,readFileSync,realpathSync,renameSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {canonicalHash} from '../lib/canonical-json';
import {engineOrderAuthoritySchema,identifierSchema,engineSiteFail} from '../lib/engine-site/contract';
import {engineRecipeSteps,ENGINE_RECIPE_VERSION} from '../lib/engine-site/platform-policy';
import {resolveEngineWizardOptions,prepareEngineOrder} from '../lib/engine-site/personal-orders';
import {LocalEngineTrialRuntime} from '../lib/engine-site/local-trial-runtime';
import {runLocalEngineTrialBook,localTrialReaderBundle} from '../lib/engine-site/local-trial-book';
import {ENGINE_SITE_LAUNCH_OFFER} from '../lib/engine-site/offer-definition';
import {localReaderId} from '../lib/local-reader-preview';

const digest=z.string().regex(/^[a-f0-9]{64}$/),absolute=z.string().refine(path.isAbsolute);
export const localEngineGrantSchema=z.object({version:z.literal('engine-local-book-grant/v1'),fictional:z.literal(true),
 source:z.object({root:absolute,head:z.string().regex(/^[a-f0-9]{40}$/),pins:z.array(z.object({path:z.string(),bytes:z.number().int().positive(),sha256:digest}).strict()).min(1)}).strict(),
 profile:z.object({file:absolute,sha256:digest}).strict(),ownerApproval:z.object({file:absolute,sha256:digest}).strict(),
 credentials:z.object({file:absolute,sha256:digest}).strict(),directory:absolute,readerId:z.string(),
 approvalReference:identifierSchema,approvedBy:identifierSchema,approvedAt:z.string().datetime({precision:3}),
 maximumMicroUsd:z.number().int().positive().max(10_000_000),maximumCalls:z.number().int().positive().max(121),
 independentQA:z.literal('pending_owner_authorized_internal_trial'),publicDelivery:z.literal(false),realPayment:z.literal(false),
}).strict();
export type LocalEngineGrant=z.infer<typeof localEngineGrantSchema>;
const activationSchema=z.object({version:z.literal('engine-local-one-book-activation/v1'),ownerAuthority:z.object({file:absolute,sha256:digest}).strict(),
 approvalReference:identifierSchema,approvedBy:identifierSchema,approvedAt:z.string().datetime({precision:3}),approvalTimeKind:z.literal('local_record_of_received_owner_authority'),
 maximumMicroUsd:z.number().int().positive().max(10_000_000),maximumCalls:z.number().int().positive().max(121),sourceRoot:absolute,sourceHead:z.string().regex(/^[a-f0-9]{40}$/),
 profileSha256:digest,directory:absolute,readerId:z.string(),fictional:z.literal(true),publicDelivery:z.literal(false),realPayment:z.literal(false)}).strict();
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
function readFile(file:string){if(lstatSync(file).isSymbolicLink()||realpathSync(file)!==file)engineSiteFail('local_book_file_path');return readFileSync(file);}
const safeError=(error:unknown)=>{const x=error&&typeof error==='object'?error as {code?:unknown;message?:unknown}:{};return typeof x.code==='string'&&/^[a-z][a-z0-9_]{1,100}$/.test(x.code)?x.code:typeof x.message==='string'&&/^[a-z][a-z0-9_]{1,100}$/.test(x.message)?x.message:'local_book_stopped';};
const git=(root:string,...args:string[])=>execFileSync('git',['-c','safe.directory='+root,'-C',root,...args],{encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
function activation(g:LocalEngineGrant){
 if(sha(readFile(g.ownerApproval.file))!==g.ownerApproval.sha256)engineSiteFail('local_book_approval_changed');
 const record=activationSchema.parse(JSON.parse(readFile(g.ownerApproval.file).toString('utf8')));
 const owner=z.object({version:z.literal('engine-one-local-book-owner-authority/v1'),maximumMicroUsd:z.literal(10_000_000),maximumLogicalCalls:z.literal(121),additionalBudgetAllowed:z.literal(false),newPublicLaunchAllowed:z.literal(false),realPaymeChargeAllowed:z.literal(false)}).passthrough().parse(JSON.parse(readFile(record.ownerAuthority.file).toString('utf8')));
 if(sha(readFile(record.ownerAuthority.file))!==record.ownerAuthority.sha256||record.maximumMicroUsd!==g.maximumMicroUsd||record.maximumCalls!==g.maximumCalls||
  record.approvalReference!==g.approvalReference||record.approvedBy!==g.approvedBy||record.approvedAt!==g.approvedAt||record.sourceRoot!==g.source.root||record.sourceHead!==g.source.head||
  record.profileSha256!==g.profile.sha256||record.directory!==g.directory||record.readerId!==g.readerId||owner.maximumMicroUsd<g.maximumMicroUsd)engineSiteFail('local_book_approval_changed');
 return record;
}
/** All copied grants/source parents from the SAME owner consent share ONE global consumption key. */
export function localEngineMasterClaimFile(g:LocalEngineGrant){return path.join('C:\\GNart\\Work\\book-authority',activation(g).ownerAuthority.sha256+'.local-engine.claim.json');}
export function prepareLocalEngineTrial(grant:LocalEngineGrant){
 const g=localEngineGrantSchema.parse(grant),profile=JSON.parse(readFile(g.profile.file).toString('utf8'));
 if(profile.fictional!==true||profile.input?.appearance?.kind!=='description')engineSiteFail('local_book_fictional_description_required');
 const options=resolveEngineWizardOptions(g.source.root),owner={id:'local_owner_guy',email:'fictional-local@example.invalid',name:'Local internal trial'};
 const prepared=prepareEngineOrder(profile.input,owner,options),orderId=g.approvalReference;
 const authority=engineOrderAuthoritySchema.parse({version:'engine-site/v1',orderId,requestSha256:prepared.inputSha256,optionsSha256:options.fingerprint,
  offer:{id:ENGINE_SITE_LAUNCH_OFFER.id,revisionSha256:canonicalHash(ENGINE_SITE_LAUNCH_OFFER)},engine:'native-cde-book/v1',sourceRevision:g.source.head,
  policySha256:canonicalHash({version:'engine-local-trial-policy/v1',recipe:ENGINE_RECIPE_VERSION,ownerApproval:g.ownerApproval,maximumMicroUsd:g.maximumMicroUsd,maximumCalls:g.maximumCalls,steps:engineRecipeSteps()}),
  purpose:'test',imageQuality:'low',narrativePages:8,entitlements:{narration:true,pdf:true},budget:{maximumMicroUsd:g.maximumMicroUsd,maximumCalls:g.maximumCalls,approvalReference:g.approvalReference,approvedBy:g.approvedBy,approvedAt:g.approvedAt,steps:engineRecipeSteps()}});
 return {grant:g,prepared,authority};
}
export function assertLocalEngineGrant(g:LocalEngineGrant,grantFile:string,grantSha:string){
 if(path.resolve(process.cwd())!==g.source.root||realpathSync(g.source.root)!==g.source.root||sha(readFile(grantFile))!==grantSha)engineSiteFail('local_book_grant_changed');
 if(path.dirname(g.directory)!==path.dirname(grantFile)||path.basename(g.directory)!=='book')engineSiteFail('local_book_output_path');
 if(existsSync(path.join(g.directory,'OWNER-STOP')))engineSiteFail('local_book_owner_stop');
 localReaderId(g.readerId);
 for(const row of [g.profile,g.ownerApproval,g.credentials])if(sha(readFile(row.file))!==row.sha256)engineSiteFail('local_book_input_changed');
 activation(g);
 if(git(g.source.root,'rev-parse','HEAD')!==g.source.head||git(g.source.root,'status','--porcelain','--untracked-files=no')||
  git(g.source.root,'ls-files','--others','--exclude-standard','--','app','lib','backend','scripts','config'))engineSiteFail('local_book_source_not_frozen');
 for(const row of g.source.pins){const file=path.resolve(g.source.root,row.path);if(!file.startsWith(g.source.root+path.sep)||/(^|[\\/])(?:\.env(?:\.|$)|\.git(?:[\\/]|$)|node_modules(?:[\\/]|$))/.test(row.path))engineSiteFail('local_book_pin_path');const bytes=readFile(file);if(bytes.length!==row.bytes||sha(bytes)!==row.sha256)engineSiteFail('local_book_source_changed');}
}
export function localEngineSecret(g:LocalEngineGrant,name:'OPENAI_API_KEY'|'ANTHROPIC_API_KEY'|'ELEVENLABS_API_KEY'){
 const bytes=readFile(g.credentials.file);if(sha(bytes)!==g.credentials.sha256)engineSiteFail('local_book_credentials_changed');
 const line=bytes.toString('utf8').replace(/^\uFEFF/,'').split(/\r?\n/).find(l=>new RegExp('^\\s*(?:export\\s+)?'+name+'\\s*=').test(l));
 let value=line?.replace(new RegExp('^\\s*(?:export\\s+)?'+name+'\\s*=\\s*'),'').trim();if(value&&/^(['"])(.*)\1$/.test(value))value=value.slice(1,-1);
 if(!value||/\s/.test(value))engineSiteFail('local_book_credential_unavailable');return value;
}
function exclusive(file:string,value:unknown){writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});}
export async function localEngineBookCLI(argv:string[]){
 const parsed=z.tuple([z.literal('--grant'),absolute,z.literal('--grant-sha'),digest]).parse(argv.slice(0,4));
 const execute=argv.includes('--execute'),resume=argv.includes('--resume');if(argv.length!==4+Number(execute)+Number(resume)||resume&&!execute)engineSiteFail('local_book_arguments');
 const grantFile=path.resolve(parsed[1]),grantSha=parsed[3],{grant:g,prepared,authority}=prepareLocalEngineTrial(localEngineGrantSchema.parse(JSON.parse(readFile(grantFile).toString('utf8'))));
 assertLocalEngineGrant(g,grantFile,grantSha);
 if(!execute){console.log(JSON.stringify({status:'local_book_plan',authoritySha256:canonicalHash(authority),maximumMicroUsd:g.maximumMicroUsd,maximumCalls:g.maximumCalls,fictional:true,providerCalls:0}));return 0;}
 const masterFile=localEngineMasterClaimFile(g),masterDirectory=path.dirname(masterFile);mkdirSync(masterDirectory,{recursive:true});
 const binding={version:'engine-local-book-claim/v1',grantFile,grantSha256:grantSha,authoritySha256:canonicalHash(authority),directory:g.directory,sourceRoot:g.source.root};
 if(existsSync(masterFile)){if(!resume||canonicalHash(JSON.parse(readFile(masterFile).toString('utf8')))!==canonicalHash(binding))engineSiteFail('local_book_already_claimed');}
 else {if(resume)engineSiteFail('local_book_resume_without_claim');exclusive(masterFile,binding);}
 mkdirSync(g.directory,{recursive:true,mode:0o700});
 const terminal=path.join(g.directory,'OUTCOME.json');if(existsSync(terminal)){console.log(JSON.stringify({status:'already_terminal',outcomeSha256:sha(readFile(terminal))}));return 0;}
 const liveFile=path.join(g.directory,'RUNNING.json');
 if(existsSync(liveFile)){const old=JSON.parse(readFile(liveFile).toString('utf8'));let alive=true;try{process.kill(old.pid,0);}catch{alive=false;}if(alive)engineSiteFail('local_book_running');if(!resume)engineSiteFail('local_book_resume_required');renameSync(liveFile,path.join(g.directory,'RUNNING-previous-'+Date.now()+'.json'));}
 exclusive(liveFile,{pid:process.pid,startedAt:new Date().toISOString(),grantSha256:grantSha});
 const keys=new Map<string,string>();const key=(name:'OPENAI_API_KEY'|'ANTHROPIC_API_KEY'|'ELEVENLABS_API_KEY')=>{const value=keys.get(name)??localEngineSecret(g,name);keys.set(name,value);return value;};
 // Only scrub logs; raw successful provider evidence is preserved unchanged in the private local journal.
 const original={log:console.log,warn:console.warn,error:console.error};for(const name of ['log','warn','error'] as const)console[name]=(...args:unknown[])=>{
  let text=args.map(a=>typeof a==='string'?a:a instanceof Error?safeError(a):JSON.stringify(a)).join(' ');for(const secret of keys.values())text=text.split(secret).join('[REDACTED]');original[name](text);};
 const assertCurrent=()=>assertLocalEngineGrant(g,grantFile,grantSha);
 const runtime=new LocalEngineTrialRuntime({root:path.join(g.directory,'journal'),authority,ownerId:prepared.snapshot.ownerId,draftId:prepared.snapshot.request.draftId,snapshotSha256:prepared.inputSha256,assertCurrent});
 let beating=false;const beat=setInterval(()=>{if(beating)return;beating=true;void runtime.meter().then(m=>{
  const value={at:new Date().toISOString(),pid:process.pid,phase:runtime.checkpoint.phase,calls:Object.keys(runtime.checkpoint.calls),meter:m},temp=path.join(g.directory,'live.tmp');writeFileSync(temp,JSON.stringify(value,null,2));renameSync(temp,path.join(g.directory,'live.json'));
 }).catch(()=>{}).finally(()=>{beating=false;});},15000);beat.unref();
 try{
  const result=await runLocalEngineTrialBook({runtime,directory:g.directory,snapshot:prepared.snapshot,provider:{fetch,openAIKey:()=>key('OPENAI_API_KEY'),anthropicKey:()=>key('ANTHROPIC_API_KEY')},narration:{fetch,key:()=>key('ELEVENLABS_API_KEY')}});
  assertCurrent();const staging=path.join(g.directory,'reader-staging'),bundle=localTrialReaderBundle(staging,g.readerId,result),root=path.join(g.source.root,'outputs','local-reader-previews'),destination=path.join(root,g.readerId);
  mkdirSync(root,{recursive:true});if(path.dirname(path.resolve(bundle.directory))!==path.resolve(staging)||path.dirname(path.resolve(destination))!==path.resolve(root)||existsSync(destination))engineSiteFail('local_book_reader_destination');
  renameSync(bundle.directory,destination);
  const outcome={version:'engine-local-book-outcome/v1',completedAt:new Date().toISOString(),status:'automated_supported_internal_review_pending',fictional:true,grantSha256:grantSha,authoritySha256:canonicalHash(authority),sourceRevision:g.source.head,book:result.book,admittedFrames:result.admittedFrames,meter:result.meter,pdfFile:result.pdfFile,reader:{directory:destination,url:'http://127.0.0.1:3482'+bundle.url},independentQA:'pending',productAccepted:false,productionQualified:false};
  exclusive(terminal,outcome);console.log(JSON.stringify({status:outcome.status,admittedFrames:result.admittedFrames,meter:result.meter,reader:outcome.reader.url}));return 0;
 }catch(error){const stop={version:'engine-local-book-stop/v1',at:new Date().toISOString(),reason:safeError(error),phase:runtime.checkpoint.phase,meter:await runtime.meter().catch(()=>null),grantSha256:grantSha,productAccepted:false};
  const file=path.join(g.directory,'STOP-'+Date.now()+'.json');exclusive(file,stop);console.error(JSON.stringify(stop));return 1;
 }finally{clearInterval(beat);Object.assign(console,original);}
}
