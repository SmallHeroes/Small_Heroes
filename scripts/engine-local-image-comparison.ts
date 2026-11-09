import 'server-only';
import { existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalHash } from '@/lib/canonical-json';
import { LocalEngineTrialRuntime } from '@/lib/engine-site/local-trial-runtime';
import { comparisonEnvelopeSchema,comparisonJson,verifyComparisonEnvelope,comparisonAuthority,claimComparison,verifyComparisonReady,verifyComparisonGo } from '@/lib/engine-site/image-comparison-journal';
import { loadComparisonBundle,runImageComparison } from '@/lib/engine-site/image-comparison-runner';
import { comparisonCarry,comparisonSchedule } from '@/lib/engine-site/image-comparison';
import { localEngineSecret,type LocalEngineGrant } from './engine-local-book';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const write=(f:string,v:unknown)=>writeFileSync(f,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600});
function argumentsOf(argv:string[]){
 if(argv.length<3||argv[0]!=='--envelope'||!path.isAbsolute(argv[1])||!['--plan','--execute'].includes(argv[2]))throw Error('comparison_cli_scope');
 if(argv[2]==='--plan'&&argv.length!==3||argv[2]==='--execute'&&(argv.length!==7||argv[3]!=='--qa-ready'||argv[5]!=='--go'))throw Error('comparison_cli_scope');
 if(argv[2]==='--execute'&&(!path.isAbsolute(argv[4])||!path.isAbsolute(argv[6])))throw Error('comparison_cli_scope');
 return{file:argv[1],execute:argv[2]==='--execute',ready:argv[4],go:argv[6]};
}
export async function imageComparisonCLI(argv:string[]){
 const args=argumentsOf(argv),envelopeBytes=readFileSync(args.file),envelopeSha=sha(envelopeBytes),g=comparisonEnvelopeSchema.parse(comparisonJson(args.file));
 verifyComparisonEnvelope(g);
 const bundle=loadComparisonBundle(g.inputRoot),inputs=comparisonJson(path.join(g.inputRoot,'INPUT-PINS.json'));
 const cp=comparisonJson(inputs.sourceFiles[0].file),authority=comparisonAuthority(g,cp.authority,bundle.bundleSha256,bundle.frames.map(f=>f.pageNumber));
 const projection={scope:'diagnostic_four_low_images_only',envelopeSha256:envelopeSha,authoritySha256:canonicalHash(authority),bundleSha256:bundle.bundleSha256,
  maximumMicroUsd:g.maximumMicroUsd,maximumCalls:g.maximumCalls,steps:comparisonSchedule(bundle.frames.map(f=>f.pageNumber)),bookGeneration:false,providerCalls:0};
 if(!args.execute){console.log(JSON.stringify({status:'comparison_plan_only',...projection,paidExecutionReady:false}));return 0;}
 verifyComparisonReady(args.ready,envelopeSha,g.source.head);verifyComparisonGo(args.go,envelopeSha,g.ownerAuthority.sha256,Date.now(),sha(readFileSync(args.ready)));
 const supervisor=comparisonJson(path.join(path.dirname(args.file),'SUPERVISOR-START.json'));
 if(supervisor.envelopeSha256!==envelopeSha||supervisor.supervisorPid!==process.ppid||supervisor.supervisorSha256!==g.supervisor.sha256||
  path.resolve(g.outputDirectory)!==path.resolve(path.dirname(args.file),'comparison-run'))throw Error('comparison_supervisor_binding');
 const goSha=sha(readFileSync(args.go)),readySha=sha(readFileSync(args.ready));
 // Only after exact paid GO + complete independent QA; key failure is before consuming any execution or slot claim.
 const key=localEngineSecret({credentials:g.credentials} as LocalEngineGrant,'OPENAI_API_KEY');
 // Before any output/global claim or provider access, all source/input/GO/reviewer and credential fences have passed.
 const execution=claimComparison(g,envelopeSha,authority);
 mkdirSync(g.outputDirectory,{mode:0o700});mkdirSync(path.join(g.outputDirectory,'images'),{mode:0o700});
 const startedAt=Date.now(),stopFile=path.join(g.outputDirectory,'OWNER-STOP.json');
 write(path.join(g.outputDirectory,'START.json'),{...projection,startedAt:new Date(startedAt).toISOString(),pid:process.pid,executionClaim:execution.master});
 const assertCurrent=()=>{
  if(sha(readFileSync(args.file))!==envelopeSha||sha(readFileSync(args.go))!==goSha||sha(readFileSync(args.ready))!==readySha)throw Error('comparison_execution_binding_changed');
  execution.check();verifyComparisonEnvelope(g,false);
  if(existsSync(stopFile)||Date.now()-startedAt>=g.executionWindowMs)throw Error('comparison_stop_before_next_call');
 };
 const runtime=new LocalEngineTrialRuntime({root:path.join(g.outputDirectory,'journal'),authority,ownerId:'fictional_owner',draftId:'diagnostic_comparison',
  snapshotSha256:bundle.bundleSha256,assertCurrent,dispatchWitness:execution.witness});
 const ports={fetch:globalThis.fetch,openAIKey:()=>key,
  anthropicKey:()=>{throw Error('comparison_anthropic_forbidden');}};
 try{
  const outcome=await runImageComparison(runtime,bundle,ports,{assertCurrent,saveImage:(cell,b)=>writeFileSync(path.join(g.outputDirectory,'images',cell+'.png'),b,{flag:'wx',mode:0o600})});
  const meter=await runtime.meter(),carry=comparisonCarry(meter);
  await runtime.advance('done');
  write(path.join(g.outputDirectory,'OUTCOME.json'),{...outcome,meter,carry,envelopeSha256:envelopeSha,endedAt:new Date().toISOString(),claimFile:execution.master});
  console.log(JSON.stringify({status:'comparison_complete',winner:outcome.winner,knownEstimateMicroUsd:meter.knownEstimateMicroUsd,logicalCalls:meter.logicalCalls,bookCreated:false}));return 0;
 }catch(error){
  const meter=await runtime.meter(),code=error instanceof Error&&/^[A-Za-z0-9_:-]{1,120}$/.test(error.message)?error.message:'comparison_stopped';
  write(path.join(g.outputDirectory,'STOP.json'),{version:'image-comparison-stop/v1',code,meter,envelopeSha256:envelopeSha,endedAt:new Date().toISOString(),
   newRetryAuthority:false,bookCreated:false,fullUnknownReservesRetained:true,claimFile:execution.master});
  console.error(JSON.stringify({status:'comparison_stopped',code,knownEstimateMicroUsd:meter.knownEstimateMicroUsd,accountedMicroUsd:meter.accountedMicroUsd,bookCreated:false}));return 1;
 }
}
