/** SYNTHETIC PAID ANSWERS ONLY. Real R17 request/text/adoption/images are read-only; no provider, real grant or expense authority. */
import path from 'node:path';
import {readFileSync,mkdtempSync,mkdirSync,copyFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {previewSha} from '../../local-story-preview';
import {canonicalJson} from '../request-acceptance';
import {resolvePersonalWizardOptions} from '../options';
import {compilePersonalStoryboard} from '../storyboard';
import {decodePersonalBookProviderOutput} from '../book-openai';
import {planSourcePreparation,type PreparationTransport} from '../../../scripts/personal-source-preparation';
import {preparationPin} from '../source-preparation-policy';

export const REAL_R17=process.env.SMALL_HEROES_R17_READONLY_BOOK??'';
const read=(file:string)=>JSON.parse(readFileSync(file,'utf8'));
export const put=(file:string,data:unknown)=>writeFileSync(file,JSON.stringify(data,null,2)+'\n');
export const h=(x:unknown)=>previewSha(canonicalJson(x));
const receipt=(step:string)=>read(path.join(REAL_R17,'paid-stages',step+'.receipt.json'));
export const fixtureGit=(workspace:string,...args:string[])=>execFileSync('git',['-C',workspace,...args],{encoding:'utf8'}).trim();
export async function preparationFixtureWorkspace(sourceWorkspace:string){
  const root=mkdtempSync(path.join(tmpdir(),'SYNTHETIC-source-prep-')),workspace=path.join(root,'source'),host=path.join(root,'authority');mkdirSync(workspace);mkdirSync(host);
  const options=resolvePersonalWizardOptions(sourceWorkspace);
  const copy=(from:string,to:string)=>{mkdirSync(path.dirname(to),{recursive:true});copyFileSync(from,to);};
  for(const card of options.companions){
    copy(path.join(sourceWorkspace,'public',card.image.replace(/^\//,'')),path.join(workspace,'public',card.image.replace(/^\//,'')));
    for(const n of ['manifest.json','front.png','3-4.png','side.png','back.png','happy.png','theme.png'])copy(path.join(sourceWorkspace,'public','companions',card.id,'style01-sheets',n),path.join(workspace,'public','companions',card.id,'style01-sheets',n));
  }
  fixtureGit(workspace,'init','-q');fixtureGit(workspace,'config','user.name','Synthetic Offline Test');fixtureGit(workspace,'config','user.email','synthetic@example.invalid');
  writeFileSync(path.join(workspace,'.gitignore'),'public/\n');writeFileSync(path.join(workspace,'code-marker.txt'),'SYNTHETIC Git guard address, not deployed implementation\n');
  fixtureGit(workspace,'add','--','.gitignore','code-marker.txt');fixtureGit(workspace,'commit','-qm','synthetic guard fixture only');
  if(resolvePersonalWizardOptions(workspace).fingerprint!==options.fingerprint)throw Error('SYNTHETIC_OPTIONS_COPY_DRIFT');
  return{root,workspace,host,png:await sharp({create:{width:1024,height:1024,channels:3,background:{r:30,g:100,b:160}}}).png().toBuffer()};
}
export function syntheticPreparationBoard(plan:ReturnType<typeof planSourcePreparation>){
  const raw=JSON.parse(receipt('momentum_s1_storyboard').raw.output_text);
  raw.plan.continuity.companionStandingHeightInChildHeights=.7;
  for(const location of raw.plan.locations)location.population=[];
  for(const entity of raw.plan.continuity.entities){entity.builtFrom=null;if(!entity.invariants.some((x:any)=>x.attribute==='kind'))entity.invariants.push({attribute:'kind',value:entity.id.replaceAll('_',' ')});}
  for(const design of raw.selfCheck.designs)if(!design.attributes.some((x:any)=>x.attribute==='kind'))design.attributes.push({attribute:'kind',designPhrase:null,agrees:true});
  const decoded=decodePersonalBookProviderOutput(plan.firstCall,raw),book=compilePersonalStoryboard(plan.source,decoded,{selfCheckNames:true,selfCheckSourceSpans:true,stagingFields:true});
  return{raw,decoded,book};
}
export function rawSol(output:unknown){return{synthetic:true,id:'synthetic-response',status:'completed',model:'gpt-6.1-sol',service_tier:'default',output_text:JSON.stringify(output),
  usage:{input_tokens:100,output_tokens:100,input_tokens_details:{cached_tokens:0,cache_write_tokens:100}}};}
let sequence=0;
export function preparationExecutionFixture(shared:Awaited<ReturnType<typeof preparationFixtureWorkspace>>){
  const id=++sequence,dir=path.join(shared.root,'case-'+id);mkdirSync(dir);const layoutFile=path.join(dir,'original-layout.json');copyFileSync(path.join(REAL_R17,'book-layout.json'),layoutFile);
  const plan=planSourcePreparation({bookDir:REAL_R17,layoutFile,workspace:shared.workspace}),board=syntheticPreparationBoard(plan);
  const ownerFile=path.join(dir,'synthetic-owner.json');put(ownerFile,{version:'source-preparation-owner-approval/v1',owner:'Guy',approvalId:h('SYNTHETIC consent '+id),
    approvalReference:'SYNTHETIC TEST DATA ONLY. NOT A REAL OWNER EXECUTION APPROVAL.',capMicroUsd:5000000,maxCalls:6,maxNewLowReferenceImages:2,paidRetries:false,pages:false,narration:false,allReviewsAndFullUnknownReserves:true});
  const operatorFile=path.join(dir,'synthetic-operator.cjs');writeFileSync(operatorFile,'// SYNTHETIC operator input only; no provider implementation.\n');
  const grant={version:'native-source-preparation/v1',workspace:shared.workspace,sourceHead:fixtureGit(shared.workspace,'rev-parse','HEAD'),originalBookDir:REAL_R17,out:path.join(dir,'synthetic-preparation'),
    originalSourceDigest:plan.original.book.sourceDigest,originalStoryboardDigest:plan.original.book.storyboardDigest,layoutSha256:h(plan.layout),firstWireSha256:plan.firstWire.digest,
    ownerApproval:preparationPin(ownerFile),operator:preparationPin(operatorFile),executionMode:'synchronous-or-durable-detached/v1',inputs:[...plan.inputs,preparationPin(ownerFile),preparationPin(operatorFile)],capMicroUsd:5000000,maxCalls:6};
  const grantFile=path.join(dir,'synthetic-grant.json');put(grantFile,grant);const grantSha256=preparationPin(grantFile).sha256;
  const report=path.join(dir,'synthetic-report.txt');writeFileSync(report,'DISPOSITION: PASS\nSCOPE: SOURCE_PREPARATION_EXECUTION\nSOURCE_HEAD: '+grant.sourceHead+'\nGRANT_SHA256: '+grantSha256+'\n\nSYNTHETIC TEST ONLY, no independent or paid authority.\n');
  const ready=path.join(dir,'synthetic-ready.json');put(ready,{complete:true,disposition:'PASS',scope:'SOURCE_PREPARATION_EXECUTION',sourceHead:grant.sourceHead,grantSha256,report:{file:report,sha256:preparationPin(report).sha256}});
  const calls:string[]=[],controller=new AbortController();
  const transport:PreparationTransport=async(step,wire:any)=>{
    // Real provider IO yields a macrotask. Synthetic immediate answers otherwise starve the test runner RPC across stages.
    await new Promise<void>(resolve=>setImmediate(resolve));
    calls.push(step);
    if(step==='prep_storyboard_0')return rawSol(board.raw);
    if(step==='prep_storyboard_0_review'){
      const raw=JSON.parse(receipt('momentum_s1_storyboard_review').raw.output_text);
      for(const item of [...Object.values(raw.bookChecks),...raw.frames.flatMap((x:any)=>Object.values(x))] as any[]){item.verdict='supported';item.issues=[];item.observation='SYNTHETIC semantic acceptance for admission wiring only.';}
      return rawSol(raw);
    }
    if(step.endsWith('_qa')){
      const data=JSON.parse(wire.input[0].content[0].text),raw=JSON.parse(receipt('sheet_entities_0_qa').raw.output_text);
      raw.candidateSha=data.candidateSha;raw.contextSha=data.contextSha;
      for(const c of raw.checks){c.verdict='pass';c.issues=[];c.observation='SYNTHETIC sheet acceptance, not visual evidence.';}
      return rawSol(raw);
    }
    return{synthetic:true,data:[{b64_json:shared.png.toString('base64')}],usage:receipt('sheet_entities_0').raw.usage};
  };
  const args={grantFile,layoutFile,review:{file:ready,sha256:preparationPin(ready).sha256},signal:controller.signal,transport};
  const choice=(waiting:any)=>{
    const packets=read(path.join(waiting.bookDir,'storyboard_cde_0','visual_simple_book_result.json')).storyboard.framePackets;
    const file=path.join(dir,'synthetic-owner-page-choice.json');put(file,{version:'source-preparation-page-choice/v1',owner:'Guy',approvalId:read(ownerFile).approvalId,
      grantSha256,storyboardDigest:waiting.storyboardDigest,pages:[1,7],standingPage:1,continuityPage:7,standingPacketSha256:packets[1].packetDigest,continuityPacketSha256:packets[7].packetDigest,
      naturalSamePlaneStandingConfirmed:true,canonicalContinuityConfirmed:true,noStoryboardEdits:true});return file;
  };
  return{...shared,dir,plan,board,grant,grantFile,grantSha256,ownerFile,report,ready,args,calls,controller,choice};
}
