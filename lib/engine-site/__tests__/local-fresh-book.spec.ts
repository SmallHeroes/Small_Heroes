import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {localEngineGrantSchema,prepareLocalEngineTrial,localEngineMasterClaimFile,localEngineBookCLI,type LocalEngineGrant} from '@/scripts/engine-local-book';
import {ENGINE_IMAGE26_POLICY} from '../image-model-policy';
import {syntheticEngineOrderInput} from './synthetic-order';
import {engineRecipeSteps} from '../platform-policy';
import {ENGINE_RESPONSE_SCHEMA_POLICY} from '../response-schema';
import {ENGINE_BOUND_REVIEW_STEP,ENGINE_STORYBOARD_BINDING} from '../storyboard-binding-policy';
import {LOCATION_SHEET_PROJECTION,LOCATION_SHEET_PROJECTION_V2} from '@/lib/personal-wizard/location-sheet-projection';
import {PREPARATION_SLOTS} from '@/lib/personal-wizard/source-preparation-policy';
import {canonicalHash} from '@/lib/canonical-json';
import {syntheticLocationV2Repair} from './local-location-repair-v2-fixture';

const roots:string[]=[],fixtureRoots:string[]=[],FRESH='fresh-current-policies/v1' as const,sha=(b:string)=>createHash('sha256').update(b).digest('hex');
afterEach(()=>{vi.restoreAllMocks();for(const [list,prefix] of [[roots,'sh_fresh_book_'],[fixtureRoots,'sh_plan_recovery_']] as const)for(const root of list.splice(0)){if(path.dirname(realpathSync(root))!==realpathSync(tmpdir())||!path.basename(root).startsWith(prefix))throw Error('owned_test_only');rmSync(root,{recursive:true,force:true});}});
function setup(){const dir=mkdtempSync(path.join(realpathSync(tmpdir()),'sh_fresh_book_'));roots.push(dir);const profile=path.join(dir,'profile.json'),body=JSON.stringify({fictional:true,input:syntheticEngineOrderInput()});writeFileSync(profile,body);
 const g:LocalEngineGrant={version:'engine-local-book-grant/v1',fictional:true,source:{root:process.cwd(),head:'a'.repeat(40),pins:[{path:'lib/engine-site/contract.ts',bytes:1,sha256:'a'.repeat(64)}]},profile:{file:profile,sha256:sha(body)},ownerApproval:{file:path.join(dir,'activation.json'),sha256:'b'.repeat(64)},credentials:{file:path.join(dir,'synthetic-never-read.txt'),sha256:'c'.repeat(64)},directory:path.join(dir,'book'),readerId:'new-synthetic-fresh-book',approvalReference:'new_fresh_synthetic',approvedBy:'synthetic_owner',approvedAt:'2026-11-09T10:00:00.000Z',maximumMicroUsd:10000000,maximumCalls:121,independentQA:'pending_owner_authorized_internal_trial',publicDelivery:false,realPayment:false};
 const fresh={...g,freshBookPolicy:FRESH,responseSchemaPolicy:ENGINE_RESPONSE_SCHEMA_POLICY,storyboardBindingPolicy:ENGINE_STORYBOARD_BINDING,locationSheetPolicy:LOCATION_SHEET_PROJECTION_V2};return{dir,g,fresh};}
function activate(g:LocalEngineGrant,dir:string,consent='owner.json'){
 const file=path.join(dir,consent);if(!existsSync(file))writeFileSync(file,JSON.stringify({version:'engine-one-local-book-owner-authority/v1',maximumMicroUsd:10000000,maximumLogicalCalls:121,additionalBudgetAllowed:false,newPublicLaunchAllowed:false,realPaymeChargeAllowed:false,distinctConsent:consent}));
 const value={version:'engine-local-one-book-activation/v1',ownerAuthority:{file,sha256:sha(readFileSync(file,'utf8'))},approvalReference:g.approvalReference,approvedBy:g.approvedBy,approvedAt:g.approvedAt,approvalTimeKind:'local_record_of_received_owner_authority',maximumMicroUsd:g.maximumMicroUsd,maximumCalls:g.maximumCalls,sourceRoot:g.source.root,sourceHead:g.source.head,profileSha256:g.profile.sha256,directory:g.directory,readerId:g.readerId,fictional:true,publicDelivery:false,realPayment:false,
  ...('freshBookPolicy' in g?{freshBookPolicy:g.freshBookPolicy}:{}),...(g.imageModelPolicy?{imageModelPolicy:g.imageModelPolicy}:{}),...(g.responseSchemaPolicy?{responseSchemaPolicy:g.responseSchemaPolicy}:{}),...(g.storyboardBindingPolicy?{storyboardBindingPolicy:g.storyboardBindingPolicy}:{}),...(g.locationSheetPolicy?{locationSheetPolicy:g.locationSheetPolicy}:{})};
 const out=path.join(dir,'activation-'+g.approvalReference+'.json'),text=JSON.stringify(value);writeFileSync(out,text);return{...g,ownerApproval:{file:out,sha256:sha(text)}};
}
describe('one explicit fresh book uses the current reviewed policies without reopening old consent',()=>{
 function extended(){
  const s=setup(),old=activate(s.fresh,s.dir),rootAuthority=JSON.parse(readFileSync(old.ownerApproval.file,'utf8')).ownerAuthority;
  const imageModelPolicy={version:ENGINE_IMAGE26_POLICY,model:'gpt-image-2.6-sunburst' as const,complexity:'high' as const};
  const file=path.join(s.dir,'owner-v2.json');writeFileSync(file,JSON.stringify({version:'engine-one-local-book-owner-authority/v2',maximumMicroUsd:12000000,maximumLogicalCalls:121,additionalBudgetAllowed:false,newPublicLaunchAllowed:false,realPaymeChargeAllowed:false,rootAuthority,imageModelPolicy}));
  const g=activate({...s.fresh,approvalReference:'fresh_image26',maximumMicroUsd:12000000,imageModelPolicy},s.dir,'owner-v2.json');return{...s,g,old,file,rootAuthority};
 }
 it('extends only the same unexecuted book campaign to 12USD and binds model into authority/activation',()=>{
  const s=extended(),r=prepareLocalEngineTrial(s.g);expect(localEngineGrantSchema.safeParse(s.g).success).toBe(true);
  expect(r.authority).toMatchObject({imageModelPolicy:s.g.imageModelPolicy,budget:{maximumMicroUsd:12000000,maximumCalls:121}});
  expect(localEngineMasterClaimFile(s.g)).toBe(localEngineMasterClaimFile(s.old));expect(existsSync(s.g.directory)).toBe(false);expect(existsSync(s.g.credentials.file)).toBe(false);
 });
 it('cannot authorize Image2.6 through a legacy owner or increase the legacy cap',()=>{
  const s=setup(),g=activate({...s.fresh,imageModelPolicy:{version:ENGINE_IMAGE26_POLICY,model:'gpt-image-2.6-sunburst',complexity:'high'}},s.dir);
  expect(()=>localEngineMasterClaimFile(g)).toThrow('extended_owner_required');expect(localEngineGrantSchema.safeParse({...s.fresh,maximumMicroUsd:12000000}).success).toBe(false);
 });
 it('refuses a swapped model, changed root pin and over-12USD grant',()=>{
  const s=extended();expect(()=>localEngineMasterClaimFile({...s.g,imageModelPolicy:{...s.g.imageModelPolicy!,model:'gpt-image-2.6-flare'}})).toThrow('extended_owner_invalid');
  expect(localEngineGrantSchema.safeParse({...s.g,maximumMicroUsd:12000001}).success).toBe(false);
  const owner=JSON.parse(readFileSync(s.file,'utf8'));owner.rootAuthority.sha256='0'.repeat(64);writeFileSync(s.file,JSON.stringify(owner));
  expect(()=>localEngineMasterClaimFile(s.g)).toThrow();
 });
 it('refuses Image2.6 resume before source/credential/claim/provider activation, including lost journals',async()=>{
  const s=extended(),file=path.join(s.dir,'grant.json'),text=JSON.stringify(s.g);writeFileSync(file,text);
  await expect(localEngineBookCLI(['--grant',file,'--grant-sha',sha(text),'--execute','--resume'])).rejects.toThrow('local_image26_no_resume');
  expect(existsSync(s.g.directory)).toBe(false);expect(existsSync(s.g.credentials.file)).toBe(false);
 });
 it('admits a fresh grant with the complete opt-in policy set',()=>{const s=setup();expect(localEngineGrantSchema.safeParse(s.fresh).success).toBe(true);});
 it.each(['freshBookPolicy','responseSchemaPolicy','storyboardBindingPolicy','locationSheetPolicy'] as const)('refuses missing %s before any state, credential or provider use',key=>{const s=setup();expect(localEngineGrantSchema.safeParse({...s.fresh,[key]:undefined}).success).toBe(false);expect(existsSync(s.g.directory)).toBe(false);expect(existsSync(s.g.credentials.file)).toBe(false);});
 it.each([{freshBookPolicy:'other'},{locationSheetPolicy:LOCATION_SHEET_PROJECTION},{responseSchemaPolicy:'other'},{storyboardBindingPolicy:'other'},{maximumMicroUsd:10000001},{maximumCalls:122},{fictional:false},{publicDelivery:true},{realPayment:true}])('refuses policy/scope/cap drift %j',patch=>{expect(localEngineGrantSchema.safeParse({...setup().fresh,...patch}).success).toBe(false);});
 it('uses one bound review, no second world sampling, and keeps all ordinary source/media budgets',()=>{const s=setup(),g=activate(s.fresh,s.dir),r=prepareLocalEngineTrial(g),old=engineRecipeSteps(),steps=r.authority.budget.steps;
  expect(r.authority).toMatchObject({purpose:'test',responseSchemaPolicy:ENGINE_RESPONSE_SCHEMA_POLICY,storyboardBindingPolicy:ENGINE_STORYBOARD_BINDING,locationSheetPolicy:LOCATION_SHEET_PROJECTION_V2,imageQuality:'low',narrativePages:8,entitlements:{narration:true,pdf:true},budget:{maximumMicroUsd:10000000,maximumCalls:121}});
  expect(steps.filter(x=>x.id===ENGINE_BOUND_REVIEW_STEP)).toEqual([{id:ENGINE_BOUND_REVIEW_STEP,maximumMicroUsd:PREPARATION_SLOTS[1]}]);
  expect(steps.some(x=>x.id.startsWith('prep_storyboard_'))).toBe(false);expect(steps.filter(x=>x.id!==ENGINE_BOUND_REVIEW_STEP)).toEqual(old.filter(x=>!x.id.startsWith('prep_storyboard_')));
  expect(steps.some(x=>x.id==='initial_storyboard')).toBe(true);expect(steps.some(x=>x.id==='story_author')).toBe(true);expect(steps.filter(x=>/^narration_/.test(x.id))).toHaveLength(9);expect(steps.filter(x=>/^page_[0-8]_[0-2]$/.test(x.id))).toHaveLength(27);
  expect(r.parent??r.recovery??r.media??r.childBinding??r.locationsRepair??r.locationsV2Repair).toBeUndefined();expect(existsSync(s.g.directory)).toBe(false);expect(existsSync(s.g.credentials.file)).toBe(false);
 });
 it('refuses every old continuation together with a fresh policy',()=>{const s=setup();for(const key of ['continuation','planningRecovery','mediaContinuation','childBindingContinuation','locationsRepairContinuation','locationsV2RepairContinuation'])expect(localEngineGrantSchema.safeParse({...s.fresh,[key]:{version:'synthetic_invalid'}}).success).toBe(false);});
 it('refuses a structurally valid old repair with fresh authority, not merely an invalid fixture',()=>{const old=syntheticLocationV2Repair();fixtureRoots.push(old.dir);const parsed=localEngineGrantSchema.safeParse(old.grant);expect(parsed.success).toBe(true);const mixed=localEngineGrantSchema.safeParse({...old.grant,freshBookPolicy:FRESH});expect(mixed.success).toBe(false);if(!mixed.success)expect(mixed.error.issues.some(x=>x.message==='local_book_recovery_modes_conflict')).toBe(true);});
 it('binds policy selection into activation and authority without changing the request or old default authority',()=>{const s=setup(),legacy=activate(s.g,s.dir),before=prepareLocalEngineTrial(legacy),beforeHash=canonicalHash(before.authority),selected=activate({...s.fresh,approvalReference:'fresh_selected'},s.dir),after=prepareLocalEngineTrial(selected);
  expect(before.authority.budget.steps).toEqual(engineRecipeSteps());expect(before.authority.storyboardBindingPolicy).toBeUndefined();expect(after.authority.requestSha256).toBe(before.authority.requestSha256);expect(after.authority.policySha256).not.toBe(before.authority.policySha256);expect(canonicalHash(prepareLocalEngineTrial(legacy).authority)).toBe(beforeHash);
  expect(()=>localEngineMasterClaimFile({...selected,storyboardBindingPolicy:undefined})).toThrow('local_book_approval_changed');expect(()=>localEngineMasterClaimFile({...selected,freshBookPolicy:undefined} as LocalEngineGrant)).toThrow('local_book_approval_changed');
  expect(localEngineMasterClaimFile(selected)).toBe(localEngineMasterClaimFile(legacy));const separate=activate({...s.fresh,approvalReference:'separate_new_book'},s.dir,'separate-new-owner.json');expect(localEngineMasterClaimFile(separate)).not.toBe(localEngineMasterClaimFile(legacy));
 });
});
