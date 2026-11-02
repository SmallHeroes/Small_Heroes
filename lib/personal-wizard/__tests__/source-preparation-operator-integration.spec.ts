/** Real R17 inputs READ-ONLY; every approval and paid answer below is SYNTHETIC in TEMP. */
import {beforeAll,beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import path from 'node:path';
import {existsSync,readFileSync,writeFileSync,mkdirSync,copyFileSync,readdirSync} from 'node:fs';
import {inspectPreparationLaunch,runPreparationOperator,preparationOperatorTransport,type PreparationRawClient} from '../../../scripts/personal-source-preparation-operator';
import {preparationPin,preparationGrantSchema,PREPARATION_STEPS} from '../source-preparation-policy';
import {auditionRenderPlan} from '../../../scripts/personal-simple-book-reviewed-audition';
import {preparationFixtureWorkspace,preparationExecutionFixture,fixtureGit,put,h} from './source-preparation-fixture';
const address=vi.hoisted(()=>({root:''}));
vi.mock('../native-page-proof-authority-host',()=>({get NATIVE_PAGE_PROOF_AUTHORITY_ROOT(){if(!address.root)throw Error('SYNTHETIC_HOST_UNSET');return address.root;}}));
const sourceWorkspace=process.cwd(),read=(f:string)=>JSON.parse(readFileSync(f,'utf8'));
let shared:Awaited<ReturnType<typeof preparationFixtureWorkspace>>;
beforeAll(async()=>{
 if(!process.env.SMALL_HEROES_R17_READONLY_BOOK)return;shared=await preparationFixtureWorkspace(sourceWorkspace);address.root=shared.host;
 mkdirSync(path.join(shared.workspace,'scripts'));copyFileSync(path.join(sourceWorkspace,'scripts/supervise-source-preparation.ps1'),path.join(shared.workspace,'scripts/supervise-source-preparation.ps1'));
 fixtureGit(shared.workspace,'add','--','scripts/supervise-source-preparation.ps1');fixtureGit(shared.workspace,'commit','-qm','SYNTHETIC supervisor pin only');
},60000);
// Yield real macrotasks between CPU-heavy real-input cases so Vitest can deliver task-update RPCs.
beforeEach(async()=>{if(shared)vi.spyOn(process,'cwd').mockReturnValue(shared.workspace);await new Promise<void>(r=>setImmediate(r));});
afterEach(async()=>{vi.restoreAllMocks();if(shared)writeFileSync(path.join(shared.workspace,'code-marker.txt'),'SYNTHETIC Git guard address, not deployed implementation\n');await new Promise<void>(r=>setImmediate(r));});
function fixture(){
 const f=preparationExecutionFixture(shared);vi.spyOn(process,'cwd').mockReturnValue(shared.workspace);
 const terms=read(f.ownerFile);terms.approvalReference='PROPOSED TERMS ONLY. SYNTHETIC TEST DATA, NEVER AN ACTUAL OWNER APPROVAL.';put(f.ownerFile,terms);
 f.grant.ownerApproval=preparationPin(f.ownerFile);f.grant.operator=preparationPin(path.join(sourceWorkspace,'scripts/personal-source-preparation-operator.ts'));
 f.grant.inputs=[...f.plan.inputs,f.grant.ownerApproval,f.grant.operator];put(f.grantFile,f.grant);const grantSha256=preparationPin(f.grantFile).sha256;
 writeFileSync(f.report,'DISPOSITION: PASS\nSCOPE: SOURCE_PREPARATION_EXECUTION\nSOURCE_HEAD: '+f.grant.sourceHead+'\nGRANT_SHA256: '+grantSha256+'\n\nSYNTHETIC ONLY.\n');
 put(f.ready,{complete:true,disposition:'PASS',scope:'SOURCE_PREPARATION_EXECUTION',sourceHead:f.grant.sourceHead,grantSha256,report:preparationPin(f.report)});
 const qaReport=path.join(f.dir,'synthetic-engine-report.txt'),qaReady=path.join(f.dir,'synthetic-engine-ready.json');
 writeFileSync(qaReport,'DISPOSITION: PASS\nSCOPE: SOURCE_PREPARATION_CORRECTIONS_R2\nSOURCE_HEAD: '+f.grant.sourceHead+'\nBASE_HEAD: '+f.grant.sourceHead+'\n\nSYNTHETIC ONLY.\n');
 put(qaReady,{complete:true,disposition:'PASS',scope:'SOURCE_PREPARATION_CORRECTIONS_R2',head:f.grant.sourceHead,base:f.grant.sourceHead,report:preparationPin(qaReport)});
 const activationFile=path.join(f.dir,'SYNTHETIC-activation.json'),envelopeFile=path.join(f.dir,'synthetic-envelope.json'),traceRoot=path.join(f.dir,'traces');
 const envelope={version:'source-preparation-operator/v1',state:'PROSPECTIVE_REQUIRES_GUY_ACTIVATION',grant:preparationPin(f.grantFile),layout:preparationPin(f.args.layoutFile),
  supervisor:preparationPin(path.join(shared.workspace,'scripts/supervise-source-preparation.ps1')),activationFile,traceRoot,engineQa:{head:f.grant.sourceHead,ready:preparationPin(qaReady)},
  sourceServerPort:3482,credential:'inherited_OPENAI_API_KEY_after_activation_only',phaseCapMs:5400000};put(envelopeFile,envelope);
 const activation={version:'source-preparation-owner-activation/v1',owner:'Guy',approvalReference:'SYNTHETIC TEST DATA ONLY, not a real owner approval.',envelopeSha256:preparationPin(envelopeFile).sha256,
  grantSha256,ownerTermsSha256:f.grant.ownerApproval.sha256,sourceHead:f.grant.sourceHead,capMicroUsd:5000000,maxCalls:6,maxNewLowReferenceImages:2,noPaidRetries:true,
  phases:['start','continue'],reuseExistingCredential:true,executionReview:preparationPin(f.ready),approvedAt:new Date(Date.now()-60000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()};
 const activate=()=>put(activationFile,activation);
 const client:PreparationRawClient={responses:async(payload,signal)=>{
   const step=PREPARATION_STEPS[f.calls.length];if(step==='prep_storyboard_0')expect(payload).toEqual(f.plan.firstWire.payload);
   return f.args.transport(step,step==='prep_storyboard_0'?f.plan.firstWire:payload,signal);
  },images:async(body,refs,signal,guard)=>{await new Promise<void>(r=>setImmediate(r));guard();expect(body.model).toBe('gpt-image-2');expect(refs.length).toBeGreaterThan(0);
   for(const ref of refs)expect(ref.bytes).toEqual(readFileSync(path.join(f.grant.out,'sourceRun','illustrations',ref.name)));
   return f.args.transport(PREPARATION_STEPS[f.calls.length],{},signal);
  }};
 const factory=vi.fn(()=>client),deps={clientFactory:factory,assertNoSourceServer:vi.fn()},args={envelopeFile,phase:'start' as const,signal:f.controller.signal};
 const choice=(waiting:any)=>{const file=f.choice(waiting),v=read(file);v.grantSha256=grantSha256;put(file,v);return file;};
 return{...f,grantSha256,envelope,envelopeFile,activation,activationFile,activate,traceRoot,args,deps,factory,client,choice,qaReady,qaReport};
}
describe.runIf(!!process.env.SMALL_HEROES_R17_READONLY_BOOK)('operator over actual preparation core, fake SDK and fixed scratch authority',()=>{
 it('preflights real inputs without activation, factory, claim or output',()=>{const f=fixture();const r=inspectPreparationLaunch(f.envelopeFile);expect(r.summary.paidAuthority).toBe(false);expect(r.summary.activationPresent).toBe(false);expect(r.summary.firstWireBytes).toBeGreaterThan(0);expect(f.factory).not.toHaveBeenCalled();expect(existsSync(f.grant.out)).toBe(false);expect(existsSync(f.traceRoot)).toBe(false);});
 it.each(['missing','expired','wrongGrant','wrongTerms','wrongHead','wrongEnvelope','reviewHold','reviewIncomplete','listener','cancelled','sourceChanged'])('refuses %s before client factory, claim or output',async mode=>{
  const f=fixture();if(mode!=='missing')f.activate();
  if(mode==='expired'){f.activation.expiresAt=new Date(Date.now()-1000).toISOString();f.activate();}
  if(mode==='wrongGrant')f.activation.grantSha256='a'.repeat(64);if(mode==='wrongTerms')f.activation.ownerTermsSha256='a'.repeat(64);
  if(mode==='wrongHead')f.activation.sourceHead='a'.repeat(40);if(mode==='wrongEnvelope')f.activation.envelopeSha256='a'.repeat(64);
  if(mode.startsWith('wrong'))f.activate();
  if(mode==='reviewHold'||mode==='reviewIncomplete'){const v=read(f.ready);if(mode==='reviewHold')v.disposition='HOLD';else v.complete=false;put(f.ready,v);f.activation.executionReview=preparationPin(f.ready);f.activate();}
  if(mode==='listener')f.deps.assertNoSourceServer.mockImplementation(()=>{throw Error('SYNTHETIC listener present');});
  if(mode==='cancelled')f.controller.abort();if(mode==='sourceChanged')writeFileSync(path.join(f.workspace,'code-marker.txt'),'SYNTHETIC changed');
  await expect(runPreparationOperator(f.args,f.deps)).rejects.toThrow();expect(f.factory).not.toHaveBeenCalled();expect(f.calls).toHaveLength(0);expect(existsSync(f.grant.out)).toBe(false);
 });
 describe('one ordered forward-only journey, same scratch grant and output',()=>{
  let f:ReturnType<typeof fixture>,waiting:any,choiceFile:string;
  beforeAll(async()=>{f=fixture();f.activate();waiting=await runPreparationOperator(f.args,f.deps);choiceFile=f.choice(waiting);},60000);
  it('starts only two text calls and waits; duplicate start is denied',async()=>{
   expect(f.calls).toEqual(PREPARATION_STEPS.slice(0,2));expect(waiting.status).toBe('WAITING_FOR_OWNER_PAGE_SELECTION');
   await expect(runPreparationOperator(f.args,f.deps)).rejects.toThrow('consumed');
  });
  it('continues with exactly four reference calls after the exact owner choice',async()=>{
   const done=await runPreparationOperator({...f.args,phase:'continue',choiceFile},f.deps);
   expect(f.calls).toEqual([...PREPARATION_STEPS]);expect(done.spend.calls).toBe(6);expect(done.spend.unknownCost+done.spend.unknownOutcome).toBe(0);
   expect(read(path.join(f.traceRoot,'continue.operator-outcome.json')).paidRetryAllowed).toBe(false);
   const names=readdirSync(path.join(f.grant.out,'sourceRun','illustrations'));expect(names.some(n=>/^(cover|page)[_-]/.test(n))).toBe(false);
  });
  it('refuses the already-entered continuation without a seventh call',async()=>{
   await expect(runPreparationOperator({...f.args,phase:'continue',choiceFile},f.deps)).rejects.toThrow();expect(f.calls).toHaveLength(6);
  });
 });
 it.each(['activation','source'])('retains a raw known-cost answer when %s changes during the awaited call and makes no next call',async mode=>{
  const f=fixture();f.activate();const normal=f.client.responses;f.client.responses=async(...a)=>{const raw=await normal(...a);
   if(mode==='activation')writeFileSync(f.activationFile,readFileSync(f.activationFile,'utf8')+' ');else writeFileSync(path.join(f.workspace,'code-marker.txt'),'SYNTHETIC during call');return raw;};
  await expect(runPreparationOperator(f.args,f.deps)).rejects.toThrow();expect(f.calls).toEqual(['prep_storyboard_0']);
  const ledger=path.join(f.grant.out,'sourceRun','paid-stages'),result=read(path.join(ledger,'prep_storyboard_0.result.json'));
  expect(result.estimatedMicroUsd).toBeGreaterThan(0);expect(read(path.join(f.grant.out,'PREPARATION-STOP.json')).spend.unknownCost).toBe(0);
  expect(read(path.join(f.traceRoot,'start.operator-outcome.json')).status).toBe('HELD');
 });
 it('returns the exact raw response object and does not reconstruct usage',async()=>{const f=fixture(),raw={synthetic:true,usage:{unrecognized_counter:13}},responses=vi.fn(async(..._args:Parameters<PreparationRawClient['responses']>)=>raw);
  const transport=preparationOperatorTransport({grant:preparationGrantSchema.parse(f.grant),client:{...f.client,responses},guard:()=>{}});
  expect(await transport('prep_storyboard_0',f.plan.firstWire,f.controller.signal)).toBe(raw);expect(responses.mock.calls[0][0]).toEqual(f.plan.firstWire.payload);
 });
 it('rejects changed reference bytes before image IO',async()=>{const f=fixture(),dir=path.join(f.grant.out,'sourceRun','illustrations');mkdirSync(dir,{recursive:true});
  const refs=['synthetic_child.png','synthetic_companion.png'].map(imageName=>{const file=path.join(dir,imageName);writeFileSync(file,shared.png);return{imageName,imageSha:preparationPin(file).sha256};});
  const wire=auditionRenderPlan(dir,'SYNTHETIC design',refs,'book_design',['child_design_authority','companion_design_authority']).wire;writeFileSync(path.join(dir,refs[0].imageName),'SYNTHETIC changed');
  const images=vi.fn(f.client.images),transport=preparationOperatorTransport({grant:preparationGrantSchema.parse(f.grant),client:{...f.client,images},guard:()=>{}});
  await expect(transport('sheet_entities_0',wire,f.controller.signal)).rejects.toThrow('operator_reference_changed');expect(images).not.toHaveBeenCalled();expect(f.calls).toHaveLength(0);
 });
});
