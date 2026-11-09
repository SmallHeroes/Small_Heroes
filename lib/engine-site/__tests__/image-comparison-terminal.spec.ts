import{describe,expect,it}from'vitest';
import{createRequire}from'node:module';
const{classify}=createRequire(import.meta.url)('../../../scripts/shims/engine-image-comparison-terminal.cjs');
const models=['gpt-image-2.6-sunburst','gpt-image-2.6-flare'],sha='a'.repeat(64);
function fixture(){const imageRecords=['C01','C02','C03','C04'].map((cell,i)=>({cell,imageSha:String(i+1).repeat(64),requestedModel:models[[0,1,1,0][i]],reportedModel:null})),assets=Object.fromEntries(imageRecords.map(r=>[r.cell,r.imageSha]));
 const outcome={version:'image-comparison-outcome/v1',complete:true,envelopeSha256:sha,bookCreated:false,productAccepted:false,automaticBookAuthority:false,frames:[0,7],imageRecords,
  scores:models.map(model=>({model,supported:true,settled:true,knownMicroUsd:100})),
  meter:{logicalCalls:14,pendingCalls:0,unknownCalls:0,failedCalls:0,overReservedCalls:0,lostLocalCalls:0,blocked:false,knownEstimateMicroUsd:200,accountedMicroUsd:200}};
 return{outcome,assets,check:()=>classify({code:0,signal:null},sha,outcome,null,assets)};}
describe('comparison terminal never promotes a missing diagnostic outcome or book',()=>{
 it('complete exact fourteen receipts and actual PNG hashes classify diagnostic completion only',()=>{expect(fixture().check()).toMatchObject({diagnosticComplete:true,bookAccepted:false,supervisorExitCode:0});});
 it('native0 without OUTCOME is a nonzero supervisor result',()=>expect(classify({code:0,signal:null},sha,null,null,{})).toMatchObject({diagnosticComplete:false,supervisorExitCode:70}));
 it.each(['pendingCalls','unknownCalls','failedCalls','overReservedCalls','lostLocalCalls'])('%s cannot complete',key=>{const f=fixture();(f.outcome.meter as any)[key]=1;expect(f.check().diagnosticComplete).toBe(false);});
 it('lost or changed actual pixel bytes cannot complete',()=>{const f=fixture();delete f.assets.C01;expect(f.check().diagnosticComplete).toBe(false);});
 it('cost/call/source envelope drift cannot complete',()=>{for(const change of[(f:any)=>f.outcome.meter.logicalCalls=13,(f:any)=>f.outcome.meter.accountedMicroUsd=0,(f:any)=>f.outcome.envelopeSha256='b'.repeat(64),(f:any)=>f.outcome.scores[0].knownMicroUsd=999]){const f=fixture();change(f);expect(f.check().diagnosticComplete).toBe(false);}});
 it('complete diagnostic with no qualifying model is still not book acceptance',()=>{const f=fixture();for(const s of f.outcome.scores)s.supported=false;expect(f.check()).toMatchObject({diagnosticComplete:true,bookAccepted:false});});
});
