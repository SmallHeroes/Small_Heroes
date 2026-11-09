import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,realpathSync,existsSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {comparisonEnvelopeSchema,verifyComparisonEnvelope,verifyComparisonGo,verifyComparisonReady,comparisonAuthority,claimComparison,comparisonMasterFile,type ComparisonEnvelope} from '../image-comparison-journal';
import {engineOrderAuthoritySchema} from '../contract';
import {COMPARISON_MODELS,comparisonSchedule} from '../image-comparison';
const host=vi.hoisted(()=>({root:''}));
vi.mock('@/lib/personal-wizard/native-page-proof-authority-host',()=>({get NATIVE_PAGE_PROOF_AUTHORITY_ROOT(){return host.root;}}));
const roots:string[]=[],hash=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex'),S=(s:string)=>s.repeat(64);
const write=(file:string,x:unknown)=>writeFileSync(file,JSON.stringify(x,null,2)+'\n');
const pin=(file:string)=>{const b=readFileSync(file);return{file,bytes:b.length,sha256:hash(b)};};
afterEach(()=>{vi.restoreAllMocks();for(const r of roots.splice(0)){if(path.dirname(realpathSync(r))!==realpathSync(tmpdir())||!path.basename(r).startsWith('sh_compare_gate_'))throw Error('owned_test_only');rmSync(r,{recursive:true,force:true});}});
function fixture(){
 const root=mkdtempSync(path.join(realpathSync(tmpdir()),'sh_compare_gate_'));roots.push(root);host.root=path.join(root,'authority');mkdirSync(host.root);
 const source=path.join(root,'source'),inputs=path.join(root,'inputs'),qa=path.join(root,'qa');for(const d of [source,inputs,qa])mkdirSync(d);
 writeFileSync(path.join(source,'source.txt'),'synthetic source');const git=(...args:string[])=>execFileSync('git',args,{cwd:source,encoding:'utf8',stdio:'pipe'}).trim();
 git('init','-q');git('add','--','source.txt');git('-c','user.name=Synthetic Test','-c','user.email=synthetic@example.invalid','commit','-qm','synthetic only');const head=git('rev-parse','HEAD');
 const sourceIndex=path.join(root,'source-pins.json');write(sourceIndex,{rows:[{path:'source.txt',...pin(path.join(source,'source.txt'))}]});
 write(path.join(inputs,'INPUT-PINS.json'),{sourceFiles:[],references:[]});const inputIndex=path.join(root,'input-index.json');write(inputIndex,{files:[{path:'INPUT-PINS.json',...pin(path.join(inputs,'INPUT-PINS.json'))}]});
 const owner=path.join(root,'owner.json');write(owner,{recordedAt:'2026-11-09T12:00:00.000Z',maximumMicroUsd:10000000,maximumLogicalCalls:121,SYNTHETIC_NOT_REAL_AUTHORITY:true});
 const reserve=path.join(root,'reserve-evidence.json');write(reserve,{SYNTHETIC_NOT_A_RESERVE_PROOF:true});
 const raw={version:'image-comparison-envelope/v1',scope:'diagnostic_four_low_images_only',fictional:true,source:{root:source,head,pins:pin(sourceIndex)},supervisor:pin(reserve),ownerAuthority:pin(owner),inputRoot:inputs,inputIndex:pin(inputIndex),outputDirectory:path.join(root,'run'),
 credentials:{file:path.join(root,'NEVER-READ.env'),sha256:S('a')},policy:'image-model-comparison/v1',maximumMicroUsd:2500000,maximumCalls:14,parentMaximumMicroUsd:10000000,parentMaximumCalls:121,models:[...COMPARISON_MODELS],executionWindowMs:7200000,settlementGraceMs:3645000,
 reserveQualification:{kind:'conservative_allowance_not_provider_invoice_cap',requiresIndependentApproval:true,evidence:pin(reserve)},publicDelivery:false,realPayment:false,bookGeneration:false};
 const g=comparisonEnvelopeSchema.parse(raw),envelope=path.join(root,'ENVELOPE.json');write(envelope,g);const envelopeSha=hash(readFileSync(envelope));
 const go=path.join(root,'GO.json'),goData={version:'image-comparison-owner-go/v1',owner:'Guy',envelopeSha256:envelopeSha,ownerAuthoritySha256:g.ownerAuthority.sha256,maximumMicroUsd:2500000,maximumCalls:14,includedInExisting10000000And121:true,approvedAt:new Date().toISOString()};write(go,goData);
 const report=path.join(qa,'REPORT.txt'),reportText='DISPOSITION: PASS\nENVELOPE_SHA256: '+envelopeSha+'\nSOURCE_HEAD: '+head+'\n\nSYNTHETIC QA ONLY.\n';writeFileSync(report,reportText);
 const evidence=path.join(qa,'synthetic.txt');writeFileSync(evidence,'SYNTHETIC ONLY');const index=path.join(qa,'INDEX.json');write(index,{files:[{path:'synthetic.txt',...pin(evidence)}]});
 const ready=path.join(qa,'READY.json'),readyData={complete:true,disposition:'PASS',scope:'IMAGE_COMPARISON_CODE_AND_EXACT_ENVELOPE',envelopeSha256:envelopeSha,sourceHead:head,providerCalls:0,allProcessesExited:true,reserveQualified:true,report:pin(report),index:pin(index),processIds:[]};write(ready,readyData);
 return{root,source,inputs,qa,g,envelope,envelopeSha,go,goData,report,reportText,index,ready,readyData,evidence,repinReport:()=>{readyData.report=pin(report);write(ready,readyData);}};
}
describe('exact comparison approval, scope and global one-use host',()=>{
 it('preflight is source/credential/provider/global-claim free',()=>{const s=fixture();verifyComparisonEnvelope(s.g);expect(existsSync(s.g.credentials.file)).toBe(false);expect(existsSync(s.g.outputDirectory)).toBe(false);expect(existsSync(comparisonMasterFile(s.g.ownerAuthority.sha256))).toBe(false);});
 it.each([{maximumMicroUsd:2500001},{maximumCalls:15},{parentMaximumCalls:122},{parentMaximumMicroUsd:20000000},{models:['gpt-image-2','gpt-image-2.6-flare']},{fictional:false},{bookGeneration:true},{settlementGraceMs:120000}])('refuses authority enlargement or wrong model%j',change=>{const s=fixture();expect(comparisonEnvelopeSchema.safeParse({...s.g,...change}).success).toBe(false);});
 it('source drift refuses before claim or credential access',()=>{const s=fixture();writeFileSync(path.join(s.source,'source.txt'),'changed');expect(()=>verifyComparisonEnvelope(s.g)).toThrow('comparison_source_changed');expect(existsSync(comparisonMasterFile(s.g.ownerAuthority.sha256))).toBe(false);});
 it('metadata changed outside source is refused by its exact pin',()=>{const s=fixture();writeFileSync(s.g.reserveQualification.evidence.file,'{}');expect(()=>verifyComparisonEnvelope(s.g)).toThrow('comparison_pin_changed');});
 it('rejects existing output and permits own already-created output only after startup',()=>{const s=fixture();mkdirSync(s.g.outputDirectory);expect(()=>verifyComparisonEnvelope(s.g)).toThrow('comparison_output_not_fresh');expect(()=>verifyComparisonEnvelope(s.g,false)).not.toThrow();});
 it('fresh exact GO passes; missing, old, future or mismatched money/calls refuses',()=>{const s=fixture();expect(()=>verifyComparisonGo(s.go,s.envelopeSha,s.g.ownerAuthority.sha256)).not.toThrow();for(const change of [{approvedAt:new Date(Date.now()-21*60000).toISOString()},{approvedAt:new Date(Date.now()+100000).toISOString()},{maximumMicroUsd:5000000},{maximumCalls:15},{envelopeSha256:S('f')},{ownerAuthoritySha256:S('a')},{includedInExisting10000000And121:false}]){write(s.go,{...s.goData,...change});expect(()=>verifyComparisonGo(s.go,s.envelopeSha,s.g.ownerAuthority.sha256)).toThrow('comparison_go_missing_or_stale');}});
 it('complete exact independent READY required, including explicit reserve qualification',()=>{const s=fixture();expect(()=>verifyComparisonReady(s.ready,s.envelopeSha,s.g.source.head)).not.toThrow();for(const change of [{complete:false},{disposition:'HOLD'},{scope:'PLAN_AND_DATA_ONLY'},{reserveQualified:false},{allProcessesExited:false},{providerCalls:1},{sourceHead:'b'.repeat(40)},{envelopeSha256:S('e')}]){write(s.ready,{...s.readyData,...change});expect(()=>verifyComparisonReady(s.ready,s.envelopeSha,s.g.source.head)).toThrow('comparison_qa_not_complete');}});
 it.each(['hold-then-pass','quoted-envelope','duplicate-envelope','duplicate-head'])('report%s cannot launder a verdict or binding',kind=>{const s=fixture();let text=s.reportText;if(kind==='hold-then-pass')text=text.replace('DISPOSITION: PASS','DISPOSITION: HOLD')+'\nDISPOSITION: PASS\n';if(kind==='quoted-envelope')text='DISPOSITION: PASS\nSOURCE_HEAD: '+s.g.source.head+'\n\nENVELOPE_SHA256: '+s.envelopeSha+'\n';if(kind==='duplicate-envelope')text=text.replace('\n\n','\nENVELOPE_SHA256: '+S('f')+'\n\n');if(kind==='duplicate-head')text=text.replace('\n\n','\nSOURCE_HEAD: '+'b'.repeat(40)+'\n\n');writeFileSync(s.report,text);s.repinReport();expect(()=>verifyComparisonReady(s.ready,s.envelopeSha,s.g.source.head)).toThrow('comparison_qa_report');});
 it('changed indexed QA evidence cannot activate',()=>{const s=fixture();writeFileSync(s.evidence,'changed');expect(()=>verifyComparisonReady(s.ready,s.envelopeSha,s.g.source.head)).toThrow();});
 it('the SAME original-owner namespace blocks a copied comparison and old full book grant',()=>{const s=fixture(),base=engineOrderAuthoritySchema.parse({version:'engine-site/v1',orderId:'synthetic',requestSha256:S('a'),optionsSha256:S('b'),offer:{id:'synthetic',revisionSha256:S('c')},engine:'native-cde-book/v1',sourceRevision:s.g.source.head,policySha256:S('d'),purpose:'test',imageQuality:'low',narrativePages:8,entitlements:{narration:false,pdf:false},budget:{maximumMicroUsd:2500000,maximumCalls:14,approvalReference:'synthetic',approvedBy:'SYNTHETIC',approvedAt:'2026-11-09T00:00:00.000Z',steps:comparisonSchedule([0,7]).map(s=>({id:s.id,maximumMicroUsd:s.maximumMicroUsd}))}});
  const a=comparisonAuthority(s.g,base,S('e'),[0,7]),first=claimComparison(s.g,s.envelopeSha,a);expect(first.master).toBe(path.join(host.root,s.g.ownerAuthority.sha256+'.local-engine.claim.json'));
  expect(()=>claimComparison({...s.g,outputDirectory:path.join(s.root,'copy')},S('f'),a)).toThrow('comparison_consent_consumed');expect(a.budget.maximumMicroUsd).toBe(2500000);expect(a.budget.approvedAt).toBe('2026-11-09T12:00:00.000Z');expect(a.entitlements).toEqual({narration:false,pdf:false});
 });
});
