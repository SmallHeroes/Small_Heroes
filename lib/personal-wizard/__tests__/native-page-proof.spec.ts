import {describe,it,expect,vi} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,symlinkSync,renameSync,openSync,closeSync,fsyncSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {previewSha} from '../../local-story-preview';
import {canonicalJson} from '../request-acceptance';
import {nativePageProofSchema,nativePageProofOwnerApprovalSchema,nativePageProofGrantValid,nativePageProofSteps,nativeProofSteps,
  verifyNativePageProofPins,verifyNativePageProofReview,nativePageProofAuthority,snapshotNativePageProofArgs} from '../native-page-proof';
import {auditionGrantSchema,runReviewedAudition,dryNativePageProof,readAuditionGrant,AuditionMeter,auditionMeterRules,auditionRenderPlan,auditionRenderRule,auditionReviewRule,REVIEW_MODEL} from '../../../scripts/personal-simple-book-reviewed-audition';
import {realDirectory} from '../../../scripts/personal-causal-trial-journal';
// This mock changes only the physical host address; claims, pins, Git and file guards remain real.
const host=vi.hoisted(()=>({root:''}));
vi.mock('../native-page-proof-authority-host',()=>({get NATIVE_PAGE_PROOF_AUTHORITY_ROOT(){if(!host.root)throw Error('SYNTHETIC_HOST_NOT_SET');return host.root;}}));
const pin=(file:string)=>{const b=readFileSync(file);return{file,bytes:b.length,sha256:previewSha(b)};};
const owner=()=>({version:'native-page-proof-owner-approval/v1',owner:'Guy',approvalId:previewSha('synthetic-owner-consent-event'),approvalReference:'SYNTHETIC TEST ONLY: not a real owner execution approval; fixed proof allowance',capMicroUsd:1000000,maxLowImages:2,allReviewsAndFullUnknownReserves:true,fullBook:false,narration:false,paidRetries:false});
function fixture(git=false){
  const root=mkdtempSync(path.join(tmpdir(),'native-page-proof-unit-')),workspace=path.join(root,'source');mkdirSync(workspace);host.root=path.join(root,'book-authority');mkdirSync(host.root);
  let head='a'.repeat(40);
  if(git){const run=(...a:string[])=>execFileSync('git',['-C',workspace,...a],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    run('init','-q');run('config','user.name','Synthetic Test');run('config','user.email','synthetic@example.invalid');writeFileSync(path.join(workspace,'source.txt'),'Synthetic code pin\n');
    run('add','--','source.txt');run('commit','-qm','synthetic fixture, no product authority');head=run('rev-parse','HEAD');}
  const ownerFile=path.join(root,'owner-approval.json'),inputFile=path.join(root,'existing-source.json');writeFileSync(ownerFile,JSON.stringify(owner()));writeFileSync(inputFile,'{"synthetic":true}');
  const proof=nativePageProofSchema.parse({version:'native-cde-page-proof/v1',workspace,sourceHead:head,sourceDigest:'b'.repeat(64),reviewSha256:'c'.repeat(64),layoutSha256:'d'.repeat(64),ownerApproval:pin(ownerFile),inputs:[pin(ownerFile),pin(inputFile)]});
  const grant={version:'audition-spend-grant/v1',approvalReference:'SYNTHETIC grant for provider-denied unit controls only',book:{requestId:'e'.repeat(64),storyboardDigest:'f'.repeat(64)},
    ledger:{priorKnownApiMicroUsd:0,evidence:[{file:ownerFile,sha256:proof.ownerApproval.sha256}],note:'Fresh synthetic visual allowance; no old meter reset'},capMicroUsd:1000000,maxCalls:6,
    scope:{mode:'render',pages:[1,2],sample:[1,2],pageAttempts:1,reuseSheets:{sourceRun:path.join(root,'saved-references'),roles:['entities','locations']},pageProof:proof},
    claudeMax:'Claude Max usage is separate: not an API invoice, not $0 and not included in this ledger'};
  const grantFile=path.join(root,'grant.json');writeFileSync(grantFile,JSON.stringify(grant));const grantSha=pin(grantFile).sha256;
  const report=path.join(root,'execution-review.txt');writeFileSync(report,'DISPOSITION: PASS\nGRANT_SHA256: '+grantSha+'\nSOURCE_HEAD: '+head+'\nSYNTHETIC TEST ONLY\n');
  const readyFile=path.join(root,'execution-ready.json');writeFileSync(readyFile,JSON.stringify({complete:true,disposition:'PASS',scope:'NATIVE_CDE_PAGE_PROOF_EXECUTION',sourceHead:head,grantSha256:grantSha,report:{file:path.basename(report),sha256:pin(report).sha256}}));
  const authorityArgs={workspace,out:path.join(root,'proof-output'),protectedRoots:[workspace,path.join(root,'protected-book')],grantFile,grantSha256:grantSha,grant:auditionGrantSchema.parse(grant),requiredInputs:[ownerFile,inputFile],review:{file:readyFile,sha256:pin(readyFile).sha256}};
  return{root,workspace,head,ownerFile,inputFile,proof,grant,grantFile,grantSha,report,readyFile,authorityArgs};
}
describe('native page-proof strict grant and evidence fences',()=>{
  it('accepts only the explicit bounded marker and leaves legacy grant policy untouched',()=>{
    const f=fixture();expect(auditionGrantSchema.parse(f.grant).scope.mode).toBe('render');expect(nativePageProofGrantValid(f.grant)).toBe(true);
    const old:any=structuredClone(f.grant);delete old.scope.pageProof;delete old.scope.sample;delete old.scope.pageAttempts;delete old.scope.reuseSheets;
    old.scope.pages=Array.from({length:9},(_,i)=>i);old.capMicroUsd=3000000;old.maxCalls=30;
    expect(auditionGrantSchema.safeParse(old).success).toBe(true);expect(nativePageProofSteps([3,5])).toEqual(['page_3_0','page_3_0_qa','page_3_0_identity','page_5_0','page_5_0_qa','page_5_0_identity']);
  });
  it.each(['cap','calls','third-page','cover','duplicate','unordered','sample','retry','new-sheet','recovery','lineup','carry','unknown-carry','experiment','high-quality','owner-evidence','foreign-ledger-evidence','secret-owner'])(
    'R5 refuses %s widening or reset',kind=>{
    const f=fixture(),g:any=structuredClone(f.grant),s=g.scope;
    if(kind==='cap')g.capMicroUsd=1000001;if(kind==='calls')g.maxCalls=7;if(kind==='third-page')s.pages=[1,2,3];if(kind==='cover')s.pages=[0,1];
    if(kind==='duplicate')s.pages=[1,1];if(kind==='unordered')s.pages=[2,1];if(kind==='sample')s.sample=[1];if(kind==='retry')s.pageAttempts=2;
    if(kind==='new-sheet')s.reuseSheets.roles=['entities'];if(kind==='recovery')s.recovery='stage-recovery/v1';if(kind==='lineup')s.scaleLineup='audition-scale-lineup/v1';
    if(kind==='carry')g.ledger.priorKnownApiMicroUsd=1;if(kind==='unknown-carry')g.ledger.carriedUnresolvedMicroUsd=1;
    if(kind==='experiment')g.experiment={slot:'old-native-cycle',claimSha256:'0'.repeat(64)};if(kind==='high-quality')s.quality='high';if(kind==='owner-evidence')g.ledger.evidence[0].sha256='0'.repeat(64);
    if(kind==='foreign-ledger-evidence')g.ledger.evidence.push({file:path.join(f.root,'.env.local'),sha256:'0'.repeat(64)});
    if(kind==='secret-owner'){s.pageProof.ownerApproval.file=path.join(f.root,'.env.local');g.ledger.evidence[0].file=s.pageProof.ownerApproval.file;}
    expect(auditionGrantSchema.safeParse(g).success).toBe(false);
  });
  it('requires exact input set/bytes and declines secret paths without opening them',()=>{
    const f=fixture();verifyNativePageProofPins(f.proof,f.authorityArgs.requiredInputs);
    expect(()=>verifyNativePageProofPins({...f.proof,inputs:f.proof.inputs.slice(1)},f.authorityArgs.requiredInputs)).toThrow('page_proof_input_set');
    writeFileSync(f.inputFile,'{"changed":true}');expect(()=>verifyNativePageProofPins(f.proof,f.authorityArgs.requiredInputs)).toThrow('page_proof_input_changed');
    const secret=path.join(f.root,'.env.local');expect(()=>verifyNativePageProofPins({...f.proof,inputs:[{file:secret,bytes:0,sha256:'a'.repeat(64)}]},[secret])).toThrow('page_proof_input_path');expect(existsSync(secret)).toBe(false);
  });
  it('code PASS, first PASS line, incomplete READY or wrong grant cannot authorize a paid proof',()=>{
    const f=fixture();expect(()=>verifyNativePageProofReview(undefined,f.grantSha,f.head)).toThrow('page_proof_execution_review_required');
    verifyNativePageProofReview(f.authorityArgs.review,f.grantSha,f.head);
    expect(()=>verifyNativePageProofReview(f.authorityArgs.review,'0'.repeat(64),f.head)).toThrow('page_proof_execution_review_binding');
    const raw=JSON.parse(readFileSync(f.readyFile,'utf8'));raw.complete=false;writeFileSync(f.readyFile,JSON.stringify(raw));
    expect(()=>verifyNativePageProofReview({file:f.readyFile,sha256:pin(f.readyFile).sha256},f.grantSha,f.head)).toThrow();
    raw.complete=true;writeFileSync(f.report,'DISPOSITION: PASS\n');raw.report.sha256=pin(f.report).sha256;writeFileSync(f.readyFile,JSON.stringify(raw));
    expect(()=>verifyNativePageProofReview({file:f.readyFile,sha256:pin(f.readyFile).sha256},f.grantSha,f.head)).toThrow('page_proof_execution_review_binding');
  });
  it.each(['grantSha256','sourceHead'] as const)('READY envelope binds its own %s independently of the report lines',field=>{
    const f=fixture(),ready=JSON.parse(readFileSync(f.readyFile,'utf8'));ready[field]='0'.repeat(field==='sourceHead'?40:64);writeFileSync(f.readyFile,JSON.stringify(ready));
    expect(()=>verifyNativePageProofReview({file:f.readyFile,sha256:pin(f.readyFile).sha256},f.grantSha,f.head)).toThrow('page_proof_execution_review_binding');
  });
  it.each(['hold-first-quoted-pass','hold-first-pass','duplicate-disposition','duplicate-grant','duplicate-head','grant-only-in-body','head-only-in-body'])(
    'R6 refuses ambiguous execution report %s even when READY says PASS',kind=>{
    const f=fixture(),header=['DISPOSITION: PASS','GRANT_SHA256: '+f.grantSha,'SOURCE_HEAD: '+f.head];let report=header.join('\n')+'\n\nReviewed body\n';
    if(kind==='hold-first-quoted-pass')report='DISPOSITION: HOLD\nGRANT_SHA256: '+f.grantSha+'\nSOURCE_HEAD: '+f.head+'\n\n  DISPOSITION: PASS\n';
    if(kind==='hold-first-pass')report=report.replace('DISPOSITION: PASS','DISPOSITION: HOLD')+'DISPOSITION: PASS\n';
    if(kind==='duplicate-disposition')report='DISPOSITION: HOLD\n'+report;
    if(kind==='duplicate-grant')report=header[0]+'\nGRANT_SHA256: '+'0'.repeat(64)+'\n'+header.slice(1).join('\n')+'\n';
    if(kind==='duplicate-head')report=header.join('\n')+'\nSOURCE_HEAD: '+'0'.repeat(40)+'\n';
    if(kind==='grant-only-in-body')report=header[0]+'\n'+header[2]+'\n\n'+header[1]+'\n';
    if(kind==='head-only-in-body')report=header.slice(0,2).join('\n')+'\n\n'+header[2]+'\n';
    writeFileSync(f.report,report);const ready=JSON.parse(readFileSync(f.readyFile,'utf8'));ready.report.sha256=pin(f.report).sha256;writeFileSync(f.readyFile,JSON.stringify(ready));
    expect(()=>verifyNativePageProofReview({file:f.readyFile,sha256:pin(f.readyFile).sha256},f.grantSha,f.head)).toThrow('page_proof_execution_review_binding');
  });
  it('R6 a clean copy under another parent cannot restart the same consent event with a new grant and review',()=>{
    const f=fixture(true),first=nativePageProofAuthority(f.authorityArgs);first.activate();
    const otherParent=path.join(f.root,'other-parent'),copy=path.join(otherParent,'copy');mkdirSync(otherParent);
    execFileSync('git',['clone','--quiet','--local','--no-hardlinks',f.workspace,copy],{stdio:'pipe'});
    const g:any=structuredClone(f.grant);g.scope.pageProof.workspace=copy;const grantFile=path.join(f.root,'copy-grant.json');writeFileSync(grantFile,JSON.stringify(g));const grantSha=pin(grantFile).sha256;
    const report=path.join(f.root,'copy-review.txt');writeFileSync(report,'DISPOSITION: PASS\nGRANT_SHA256: '+grantSha+'\nSOURCE_HEAD: '+f.head+'\nSYNTHETIC ONLY\n');
    const readyFile=path.join(f.root,'copy-ready.json');writeFileSync(readyFile,JSON.stringify({complete:true,disposition:'PASS',scope:'NATIVE_CDE_PAGE_PROOF_EXECUTION',sourceHead:f.head,grantSha256:grantSha,report:{file:report,sha256:pin(report).sha256}}));
    const second=nativePageProofAuthority({...f.authorityArgs,workspace:copy,out:path.join(f.root,'copy-output'),grant:auditionGrantSchema.parse(g),grantFile,grantSha256:grantSha,review:{file:readyFile,sha256:pin(readyFile).sha256}});
    expect(()=>second.beforeClaim()).toThrow('page_proof_consumed');expect(second.claimFile).toBe(first.claimFile);expect(existsSync(path.join(otherParent,'book-authority'))).toBe(false);
  });
  it('one owner approval cannot be restarted through another output; authority is rechecked after await',async()=>{
    const f=fixture(true),a=nativePageProofAuthority(f.authorityArgs);a.beforeClaim();expect(existsSync(a.claimFile)).toBe(false);a.activate();a.guard();
    const second=nativePageProofAuthority({...f.authorityArgs,out:path.join(f.root,'other-output')});expect(()=>second.beforeClaim()).toThrow('page_proof_consumed');
    await Promise.resolve();writeFileSync(f.inputFile,'changed while async work ran');expect(()=>a.guard()).toThrow('page_proof_input_changed');expect(existsSync(a.claimFile)).toBe(true);
  });
  it('the same approval ID cannot restart its allowance through re-formatted approval bytes and a new grant',()=>{
    const f=fixture(true),first=nativePageProofAuthority(f.authorityArgs);first.activate();
    const alias=path.join(f.root,'owner-alias.json');writeFileSync(alias,JSON.stringify(owner(),null,2));
    const grant:any=structuredClone(f.grant);grant.scope.pageProof.ownerApproval=pin(alias);grant.scope.pageProof.inputs=[pin(alias),pin(f.inputFile)];grant.ledger.evidence=[{file:alias,sha256:pin(alias).sha256}];
    const grantFile=path.join(f.root,'new-grant.json');writeFileSync(grantFile,JSON.stringify(grant));const grantSha=pin(grantFile).sha256;
    const report=path.join(f.root,'new-review.txt');writeFileSync(report,'DISPOSITION: PASS\nGRANT_SHA256: '+grantSha+'\nSOURCE_HEAD: '+f.head+'\nSYNTHETIC ONLY\n');
    const readyFile=path.join(f.root,'new-ready.json');writeFileSync(readyFile,JSON.stringify({complete:true,disposition:'PASS',scope:'NATIVE_CDE_PAGE_PROOF_EXECUTION',sourceHead:f.head,grantSha256:grantSha,report:{file:report,sha256:pin(report).sha256}}));
    const second=nativePageProofAuthority({...f.authorityArgs,out:path.join(f.root,'another-output'),grant:auditionGrantSchema.parse(grant),grantFile,grantSha256:grantSha,requiredInputs:[alias,f.inputFile],review:{file:readyFile,sha256:pin(readyFile).sha256}});
    expect(second.claimFile).toBe(first.claimFile);expect(()=>second.beforeClaim()).toThrow('page_proof_consumed');
    expect(()=>nativePageProofAuthority({...f.authorityArgs,workspace:path.join(f.root,'relocated-source')})).toThrow('page_proof_workspace');
  });
  it('code change or output overlap cannot evade its source and protected-book fence',()=>{
    const f=fixture(true);expect(()=>nativePageProofAuthority({...f.authorityArgs,out:path.join(f.workspace.toUpperCase(),'nested')})).toThrow('page_proof_output_fence');
    const a=nativePageProofAuthority(f.authorityArgs);a.beforeClaim();writeFileSync(path.join(f.workspace,'source.txt'),'changed');expect(()=>a.beforeClaim()).toThrow('page_proof_source_changed');expect(existsSync(a.claimFile)).toBe(false);
  });
  it('an aliased output parent cannot create a directory inside the protected book before claim or after await',async()=>{
    const f=fixture(true),protectedBook=path.join(f.root,'protected-book'),alias=path.join(f.root,'linked-parent');mkdirSync(protectedBook);symlinkSync(protectedBook,alias,'junction');
    const out=path.join(alias,'new-output');expect(()=>nativePageProofAuthority({...f.authorityArgs,out})).toThrow('page_proof_output_fence');expect(existsSync(path.join(protectedBook,'new-output'))).toBe(false);
    const late=path.join(f.root,'late-parent');mkdirSync(late);const authority=nativePageProofAuthority({...f.authorityArgs,out:path.join(late,'output')});authority.beforeClaim();
    const absent=path.join(f.root,'absent-parent','output');expect(()=>nativePageProofAuthority({...f.authorityArgs,out:absent})).toThrow('page_proof_output_fence');
    await Promise.resolve();const preserved=path.join(f.root,'late-parent-preserved');expect(path.dirname(late)).toBe(f.root);expect(path.dirname(preserved)).toBe(f.root);
    renameSync(late,preserved);symlinkSync(protectedBook,late,'junction');expect(()=>authority.beforeClaim()).toThrow('page_proof_output_fence');
    expect(existsSync(authority.claimFile)).toBe(false);expect(existsSync(path.join(protectedBook,'output'))).toBe(false);
  });
  it('R6 valid leading authority header ignores quoted body decisions and supports UTF8 BOM',()=>{
    const f=fixture();writeFileSync(f.report,'\uFEFFDISPOSITION: PASS\nGRANT_SHA256: '+f.grantSha+'\nSOURCE_HEAD: '+f.head+'\n\n  DISPOSITION: HOLD\nGRANT_SHA256: body example\n');
    const ready=JSON.parse(readFileSync(f.readyFile,'utf8'));ready.report.sha256=pin(f.report).sha256;writeFileSync(f.readyFile,JSON.stringify(ready));
    verifyNativePageProofReview({file:f.readyFile,sha256:pin(f.readyFile).sha256},f.grantSha,f.head);
  });
  it.each(['missing','aliased'])('R6 the canonical authority host must already exist as a real directory (%s)',kind=>{
    const f=fixture(true),existing=host.root;host.root=path.join(f.root,'unprovisioned-host');if(kind==='aliased')symlinkSync(existing,host.root,'junction');
    expect(()=>nativePageProofAuthority(f.authorityArgs)).toThrow('page_proof_authority_root');expect(existsSync(path.join(existing,'native-page-proof-'+owner().approvalId+'.claim.json'))).toBe(false);
    if(kind==='missing')expect(existsSync(host.root)).toBe(false);
  });
  it.each([true,false])('R6 actual image-write boundary rechecks a mid-await parent alias only for proof mode (%s)',async fenced=>{
    const f=fixture(),parent=path.join(f.root,'out-parent'),directory=path.join(parent,'illustrations'),protectedRoot=path.join(f.root,'synthetic-protected');mkdirSync(parent);mkdirSync(directory);mkdirSync(protectedRoot);mkdirSync(path.join(protectedRoot,'illustrations'));
    const source=readFileSync(path.resolve(__dirname,'../../../scripts/personal-simple-book-reviewed-audition.ts'),'utf8'),from=source.indexOf('  const writeImage = async '),to=source.indexOf('  const bytesOf = ',from);expect(from).toBeGreaterThan(0);expect(to).toBeGreaterThan(from);
    const c:any={args:{directory,...(fenced?{fencedImageWrites:true}:{})},path,openSync,writeFileSync,fsyncSync,closeSync,previewSha,realDirectory,fail:(code:string)=>{throw Error(code);},
      sharp:()=>({metadata:async()=>{await Promise.resolve();const old=path.join(f.root,'out-parent-preserved');expect(path.dirname(parent)).toBe(f.root);expect(path.dirname(old)).toBe(f.root);renameSync(parent,old);symlinkSync(protectedRoot,parent,'junction');return{format:'png',width:1,height:1};}})};
    vm.createContext(c);vm.runInContext(transformSync(source.slice(from,to)+'globalThis.writeImage=writeImage;',{loader:'ts',format:'cjs'}).code,c);
    const bytes=Buffer.from('SYNTHETIC local write-boundary bytes; metadata is explicitly stubbed'),work=c.writeImage('synthetic.png',bytes);
    if(fenced){await expect(work).rejects.toThrow('causal_host_directory');expect(existsSync(path.join(protectedRoot,'illustrations','synthetic.png'))).toBe(false);}
    else{await expect(work).resolves.toMatchObject({imageName:'synthetic.png',imageSha:previewSha(bytes)});expect(readFileSync(path.join(protectedRoot,'illustrations','synthetic.png'))).toEqual(bytes);}
  });
  it.each(['resume','storyboardDir','calibration','topologyContinuation','coverageContinuation','anatomyRecovery','fullBookDiagnostic','rereview','debits','experiment'])(
    'actual runner rejects foreign %s before source/key/output',async kind=>{
    const f=fixture(),args:any={bookDir:path.join(f.root,'missing-book'),out:path.join(f.root,'output'),keyFile:path.join(f.root,'NEVER-READ'),grantFile:f.grantFile,signal:new AbortController().signal,log:()=>{}};
    args[kind]=kind==='rereview'||kind==='debits'?[{}]:kind==='resume'?true:{};
    const expected:Record<string,string>={calibration:'audition_calibration_binding',topologyContinuation:'audition_topology_parent',coverageContinuation:'audition_coverage_parent',anatomyRecovery:'audition_anatomy_parent',fullBookDiagnostic:'audition_diagnostic_parent',rereview:'audition_rereview_binding',debits:'audition_meter_debit'};
    await expect(runReviewedAudition(args)).rejects.toThrow(expected[kind]??'page_proof_scope');expect(existsSync(args.out)).toBe(false);expect(existsSync(args.keyFile)).toBe(false);
  });
  it('routing/layout/review arguments cannot drift during the asynchronous reference preflight',async()=>{
    const f=fixture(),args={bookDir:path.join(f.root,'book'),out:path.join(f.root,'out'),keyFile:path.join(f.root,'key-placeholder'),grantFile:f.grantFile,layout:{seed:'existing-source'},proofReview:{...f.authorityArgs.review}};
    const frozen=snapshotNativePageProofArgs(args);await Promise.resolve();args.out=args.bookDir;args.layout.seed='changed';args.proofReview.file='C:/elsewhere';
    expect(frozen.out).toBe(path.join(f.root,'out'));expect(frozen.layout.seed).toBe('existing-source');expect(frozen.proofReview!.file).toBe(f.authorityArgs.review.file);
    expect(()=>snapshotNativePageProofArgs({...args,out:'relative-output'})).toThrow('page_proof_scope');
  });
  it('actual page-proof runner refuses missing independent execution review before source/output/key access',async()=>{
    const f=fixture(),out=path.join(f.root,'not-created'),key=path.join(f.root,'NEVER-READ');
    await expect(runReviewedAudition({bookDir:path.join(f.root,'missing-book'),out,keyFile:key,grantFile:f.grantFile,signal:new AbortController().signal,log:()=>{}})).rejects.toThrow('page_proof_execution_review_required');
    expect(existsSync(out)).toBe(false);expect(existsSync(key)).toBe(false);
  });
  it('a cancelled owner cannot consume proof authority while preflight is still pending',async()=>{
    const f=fixture(),c=new AbortController();c.abort();const out=path.join(f.root,'not-created');
    await expect(runReviewedAudition({bookDir:path.join(f.root,'missing-book'),out,keyFile:path.join(f.root,'NEVER-READ'),grantFile:f.grantFile,signal:c.signal,log:()=>{}})).rejects.toThrow('audition_cancelled');expect(existsSync(out)).toBe(false);
  });
  it('dry preflight refuses a legacy marker or cancellation without creating any authority/output',async()=>{
    const f=fixture(),legacy:any=structuredClone(f.grant);delete legacy.scope.pageProof;writeFileSync(f.grantFile,JSON.stringify(legacy));
    const args={bookDir:path.join(f.root,'missing-book'),out:path.join(f.root,'out'),grantFile:f.grantFile};
    await expect(dryNativePageProof(args)).rejects.toThrow('page_proof_scope');const c=new AbortController();c.abort();
    await expect(dryNativePageProof({...args,signal:c.signal})).rejects.toThrow('audition_cancelled');expect(existsSync(args.out)).toBe(false);expect(existsSync(path.join(f.root,'book-authority'))).toBe(true);expect(existsSync(path.join(f.root,'book-authority','native-page-proof-'+owner().approvalId+'.claim.json'))).toBe(false);
  });
  it('grant parsing and its digest refer to the same actual UTF8 snapshot, and reject foreign secret evidence before reading it',()=>{
    const f=fixture(),bound=readAuditionGrant(f.grantFile,f.grant.book);expect(bound.sha256).toBe(pin(f.grantFile).sha256);expect(bound.grant.book).toEqual(f.grant.book);
    const bad:any=structuredClone(f.grant);bad.ledger.evidence.push({file:path.join(f.root,'.env.local'),sha256:'0'.repeat(64)});writeFileSync(f.grantFile,JSON.stringify(bad));
    expect(()=>readAuditionGrant(f.grantFile,f.grant.book)).toThrow('page_proof_scope');
  });
  it('the actual runner constructs its real meter with the bound cap and exact proof step rules',()=>{
    const f=fixture(),source=readFileSync(path.resolve(__dirname,'../../../scripts/personal-simple-book-reviewed-audition.ts'),'utf8'),from=source.indexOf('  const meter = new AuditionMeter('),to=source.indexOf('  if (args.coverageOrphanRecovery) meter.snapshot();',from);
    expect(from).toBeGreaterThan(0);expect(to).toBeGreaterThan(from);let captured:any[]=[];
    const c:any={AuditionMeter:class{constructor(...a:any[]){captured=a;}},path,args:{out:path.join(f.root,'output')},grant:auditionGrantSchema.parse(f.grant),proofSteps:nativePageProofSteps([1,2]),auditionMeterRules,diagnostic:undefined};
    vm.createContext(c);vm.runInContext(transformSync(source.slice(from,to),{loader:'ts',format:'cjs'}).code,c);
    expect(captured.slice(1,5)).toEqual([1000000,6,0,0]);expect(captured[5]('page_1_0')).toBe(auditionRenderRule);expect(captured[5]('page_1_0_qa')).toBe(auditionReviewRule);
    for(const step of ['page_3_0','sheet_entities_0','page_1_1','page_1_0_narration'])expect(captured[5](step)).toBeUndefined();
  });
  it('the actual runner gives the LOW adapters the exact allowlist and private source/claim guard',()=>{
    const source=readFileSync(path.resolve(__dirname,'../../../scripts/personal-simple-book-reviewed-audition.ts'),'utf8'),from=source.indexOf('  const io = auditionAdapters('),to=source.indexOf('  const save = (name: string',from);let captured:any;
    expect(from).toBeGreaterThan(0);expect(to).toBeGreaterThan(from);
    const guard=vi.fn(),key=vi.fn(),c:any={auditionAdapters:(a:unknown)=>{captured=a;return{};},directory:'VIRTUAL',meter:{},keyReader:()=>key,
      args:{keyFile:'SYNTHETIC-NEVER-READ',signal:new AbortController().signal},proofAuthority:{guard},loaded:{current:{}},expectedWire:{},proofSteps:nativePageProofSteps([1,2]),diagnosticSteps:undefined,diagnostic:undefined};
    vm.createContext(c);vm.runInContext(transformSync(source.slice(from,to),{loader:'ts',format:'cjs'}).code,c);
    expect(captured.allowedSteps).toEqual(nativePageProofSteps([1,2]));expect(captured.guard).toBe(guard);expect(captured.key).toBe(key);expect(key).not.toHaveBeenCalled();
  });
  it('the actual planner fixes LOW/model/one-image/no-retry and the actual meter denies non-page steps',async()=>{
    const f=fixture(),plan=auditionRenderPlan(f.root,'Synthetic bounded page',[],'book_identity');
    expect(plan.wire.body).toMatchObject({model:'gpt-image-2',quality:'low',n:1});expect(plan.wire.retries).toBe(0);expect(auditionRenderRule.reserve(plan.wire)).toBe(plan.maximumMicroUsd);
    const allowed=nativePageProofSteps([1,2]),m=new AuditionMeter(path.join(f.root,'meter'),1000000,6,0,0,step=>allowed.includes(step)?auditionMeterRules(step):undefined),dispatch=vi.fn();
    await expect(m.run('sheet_entities_0',plan.wire,plan.maximumMicroUsd,dispatch)).rejects.toThrow('audition_meter_rule');
    await expect(m.run('page_3_0',plan.wire,plan.maximumMicroUsd,dispatch)).rejects.toThrow('audition_meter_rule');expect(dispatch).not.toHaveBeenCalled();
  });
  it('full UNKNOWN review reserve remains inside the cap and stops every subsequent dispatch',async()=>{
    const f=fixture(),steps=nativePageProofSteps([1,2]),m=new AuditionMeter(path.join(f.root,'meter'),1000000,6,0,0,s=>steps.includes(s)?auditionMeterRules(s):undefined),wire={model:REVIEW_MODEL,service_tier:'default',max_output_tokens:12000};
    const reserve=auditionReviewRule.reserve(wire)!;expect(reserve).toBeGreaterThan(0);expect(reserve).toBeLessThanOrEqual(1000000);
    const failure=Error('SYNTHETIC_NETWORK_LOSS');await expect(m.run('page_1_0_qa',wire,reserve,async()=>{throw failure;})).rejects.toBe(failure);
    const state=m.snapshot();expect(state.unknownCost).toBe(1);expect(state.reservedUnsettledMicroUsd).toBe(reserve);expect(state.cumulativeAccountedMicroUsd).toBe(reserve);
    const dispatch=vi.fn();await expect(m.run('page_2_0_qa',wire,reserve,dispatch)).rejects.toThrow('audition_unknown_cost');expect(dispatch).not.toHaveBeenCalled();
  });
  const bookOwner=()=>({...owner(),version:'native-book-owner-approval/v1',approvalReference:'SYNTHETIC TEST ONLY: not a real owner execution approval; fixed whole-book allowance',
    capMicroUsd:7000000,maxLowImages:27,pageAttempts:3,maxReviewReasks:9,fullBook:true});
  function bookFixture(){
    const f=fixture(),g:any=structuredClone(f.grant);writeFileSync(f.ownerFile,JSON.stringify(bookOwner()));
    g.scope.pageProof={...g.scope.pageProof,version:'native-cde-book/v1',ownerApproval:pin(f.ownerFile),inputs:[pin(f.ownerFile),pin(f.inputFile)]};
    g.ledger.evidence=[{file:f.ownerFile,sha256:g.scope.pageProof.ownerApproval.sha256}];
    g.scope.pages=[0,1,2,3,4,5,6,7,8];delete g.scope.sample;g.scope.pageAttempts=3;g.capMicroUsd=7000000;g.maxCalls=90;
    return{...f,grant:g,proof:nativePageProofSchema.parse(g.scope.pageProof)};
  }
  it('native book: only the whole fixed book with its correction ceiling, never a sample, cap or call widening',()=>{
    const f=bookFixture();expect(auditionGrantSchema.safeParse(f.grant).success).toBe(true);
    const steps=nativeProofSteps(f.proof,f.grant.scope.pages);expect(steps).toHaveLength(108);expect(steps).toContain('page_0_2_identity');expect(steps).toContain('page_8_2_qa2');
    expect(steps).not.toContain('page_1_3');expect(nativeProofSteps({...f.proof,version:'native-cde-page-proof/v1'},[3,7])).toEqual(nativePageProofSteps([3,7]));
    for(const kind of ['sample','no-cover','attempts','cap','calls','more-calls','prior','proof-cap-on-book'] as const){
      const g:any=structuredClone(f.grant),s=g.scope;if(kind==='sample')s.sample=[3,7];if(kind==='no-cover')s.pages=[1,2,3,4,5,6,7,8];if(kind==='attempts')s.pageAttempts=2;
      if(kind==='cap')g.capMicroUsd=7000001;if(kind==='calls')g.maxCalls=81;if(kind==='more-calls')g.maxCalls=91;if(kind==='prior')g.ledger.priorKnownApiMicroUsd=1;
      if(kind==='proof-cap-on-book'){s.pageProof.version='native-cde-page-proof/v1';}
      expect(auditionGrantSchema.safeParse(g).success,kind).toBe(false);
    }
  });
  it('native book: the owner approval version must match the grant mode, both ways',()=>{
    const f=bookFixture();verifyNativePageProofPins(f.proof,[f.ownerFile,f.inputFile]);
    writeFileSync(f.ownerFile,JSON.stringify(owner()));const proofApproval={...f.proof,ownerApproval:pin(f.ownerFile),inputs:[pin(f.ownerFile),pin(f.inputFile)]};
    expect(()=>verifyNativePageProofPins(proofApproval,[f.ownerFile,f.inputFile])).toThrow();
    const p=fixture();writeFileSync(p.ownerFile,JSON.stringify(bookOwner()));const bookApproval={...p.proof,ownerApproval:pin(p.ownerFile),inputs:[pin(p.ownerFile),pin(p.inputFile)]};
    expect(()=>verifyNativePageProofPins(bookApproval,[p.ownerFile,p.inputFile])).toThrow();
  });
  it('native book: the actual meter rules admit exactly the book allowlist',async()=>{
    const f=bookFixture(),allowed=nativeProofSteps(f.proof,f.grant.scope.pages),m=new AuditionMeter(path.join(f.root,'meter'),7000000,90,0,0,s=>allowed.includes(s)?auditionMeterRules(s):undefined);
    const plan=auditionRenderPlan(f.root,'Synthetic bounded page',[],'book_identity'),dispatch=vi.fn();
    for(const step of ['page_1_3','sheet_entities_0','page_9_0'])await expect(m.run(step,plan.wire,plan.maximumMicroUsd,dispatch)).rejects.toThrow('audition_meter_rule');
    expect(dispatch).not.toHaveBeenCalled();
    // The re-ask is a page review under the review rule; a sheet re-ask is no rule at all.
    expect(auditionMeterRules('page_4_1_qa2')).toBe(auditionReviewRule);expect(auditionMeterRules('sheet_entities_0_qa2')).toBeUndefined();
  });
  it('native book frames refuse any frame set other than the whole fixed book before any callback',async()=>{
    const {runNativeBookFrames}=await import('../native-page-proof-frames'),render=vi.fn();
    await expect(runNativeBookFrames({pages:[1,2,3,4,5,6,7,8],render} as any)).rejects.toThrow('page_proof_scope');expect(render).not.toHaveBeenCalled();
  });
  it('cumulative known cost plus the next full reserve is checked before any paid dispatch',async()=>{
    const f=fixture(),m=new AuditionMeter(path.join(f.root,'meter'),1000000,6,500001),dispatch=vi.fn();
    await expect(m.run('page_1_0_qa',{},500000,dispatch)).rejects.toThrow('audition_budget_exhausted');expect(dispatch).not.toHaveBeenCalled();expect(m.snapshot().calls).toBe(0);
  });
});
