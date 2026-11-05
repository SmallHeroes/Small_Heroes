import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {localEngineGrantSchema,prepareLocalEngineTrial,localEngineSecret,assertLocalEngineGrant,localEngineMasterClaimFile,type LocalEngineGrant} from '@/scripts/engine-local-book';
import {syntheticEngineOrderInput} from './synthetic-order';
import {engineRecipeSteps} from '../platform-policy';
const roots:string[]=[];
afterEach(()=>{vi.restoreAllMocks();for(const root of roots.splice(0)){if(path.dirname(root)!==path.resolve(tmpdir())||!path.basename(root).startsWith('sh_trial_entry_'))throw Error('owned_test_only');rmSync(root,{recursive:true,force:true});}});
const sha=(b:string)=>createHash('sha256').update(b).digest('hex');
function setup(){const dir=mkdtempSync(path.join(tmpdir(),'sh_trial_entry_'));roots.push(dir);
 const profile=path.join(dir,'profile.json'),contents=JSON.stringify({fictional:true,input:syntheticEngineOrderInput()});writeFileSync(profile,contents);
 const credentials=path.join(dir,'synthetic-credentials.txt'),secret='SYNTHETIC_NOT_A_REAL_KEY';writeFileSync(credentials,'OPENAI_API_KEY="'+secret+'"\n');
 const grant:LocalEngineGrant={version:'engine-local-book-grant/v1',fictional:true,source:{root:process.cwd(),head:'a'.repeat(40),pins:[{path:'lib/engine-site/contract.ts',bytes:1,sha256:'a'.repeat(64)}]},profile:{file:profile,sha256:sha(contents)},ownerApproval:{file:path.join(dir,'owner.json'),sha256:'b'.repeat(64)},credentials:{file:credentials,sha256:sha('OPENAI_API_KEY="'+secret+'"\n')},directory:path.join(dir,'book'),readerId:'local-synthetic-book',approvalReference:'synthetic_local_approval',approvedBy:'synthetic_owner',approvedAt:'2026-11-05T20:00:00.000Z',maximumMicroUsd:10_000_000,maximumCalls:121,independentQA:'pending_owner_authorized_internal_trial',publicDelivery:false,realPayment:false};
 return {dir,grant,profile,credentials,secret};}
function activate(g:LocalEngineGrant,dir:string,ownerFile?:string){
 const owner=ownerFile??path.join(dir,'owner-consent.json');if(!ownerFile)writeFileSync(owner,JSON.stringify({version:'engine-one-local-book-owner-authority/v1',maximumMicroUsd:10_000_000,maximumLogicalCalls:121,additionalBudgetAllowed:false,newPublicLaunchAllowed:false,realPaymeChargeAllowed:false}));
 const row={version:'engine-local-one-book-activation/v1',ownerAuthority:{file:owner,sha256:sha(requireRead(owner))},approvalReference:g.approvalReference,approvedBy:g.approvedBy,approvedAt:g.approvedAt,approvalTimeKind:'local_record_of_received_owner_authority',maximumMicroUsd:g.maximumMicroUsd,maximumCalls:g.maximumCalls,sourceRoot:g.source.root,sourceHead:g.source.head,profileSha256:g.profile.sha256,directory:g.directory,readerId:g.readerId,fictional:true,publicDelivery:false,realPayment:false};
 const file=path.join(dir,'activation-'+g.approvalReference+'.json'),bytes=JSON.stringify(row);writeFileSync(file,bytes);return {...g,ownerApproval:{file,sha256:sha(bytes)}};
}
import {readFileSync} from 'node:fs';
const requireRead=(f:string)=>readFileSync(f,'utf8');
describe('explicit local entry authority, no provider or fake payment',()=>{
 it('builds the real engine authority as test-only with the full unchanged recipe and all deliverables',()=>{const s=setup(),p=prepareLocalEngineTrial(s.grant);expect(p.authority).toMatchObject({purpose:'test',imageQuality:'low',narrativePages:8,entitlements:{narration:true,pdf:true},budget:{maximumMicroUsd:10_000_000,maximumCalls:121}});expect(p.authority.budget.steps).toEqual(engineRecipeSteps());expect(p.authority.requestSha256).toBe(p.prepared.inputSha256);});
 it.each([{maximumMicroUsd:10_000_001},{maximumCalls:122},{fictional:false},{realPayment:true},{publicDelivery:true},{independentQA:'PASS'}])('refuses cap/public/payment/fictional/QA promotions %j',change=>{expect(()=>localEngineGrantSchema.parse({...setup().grant,...change})).toThrow();});
 it('refuses a photo or a missing fictional label before producing trial authority',()=>{const s=setup();for(const raw of [{input:syntheticEngineOrderInput()},{fictional:true,input:{...syntheticEngineOrderInput(),appearance:{kind:'private_photo',assetId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'}}}]){writeFileSync(s.profile,JSON.stringify(raw));expect(()=>prepareLocalEngineTrial(s.grant)).toThrow('local_book_fictional_description_required');}});
 it('loads only an explicit named key from the bound synthetic file without logging it',()=>{const s=setup(),log=vi.spyOn(console,'log');expect(localEngineSecret(s.grant,'OPENAI_API_KEY')).toBe(s.secret);expect(log).not.toHaveBeenCalled();expect(()=>localEngineSecret({...s.grant,credentials:{...s.grant.credentials,sha256:'0'.repeat(64)}},'OPENAI_API_KEY')).toThrow('local_book_credentials_changed');expect(()=>localEngineSecret(s.grant,'ANTHROPIC_API_KEY')).toThrow('local_book_credential_unavailable');});
 it('refuses a copied-worktree grant before credential access or any Git/provider work',()=>{const s=setup(),grant={...s.grant,source:{...s.grant.source,root:s.dir}};expect(()=>assertLocalEngineGrant(grant,path.join(s.dir,'grant.json'),'a'.repeat(64))).toThrow('local_book_grant_changed');});
 it('binds run source/input/budget to the owner activation rather than any new grant/ref id',()=>{const s=setup(),g=activate(s.grant,s.dir);expect(localEngineMasterClaimFile(g)).toMatch(/[a-f0-9]{64}\.local-engine\.claim\.json$/);expect(()=>localEngineMasterClaimFile({...g,approvalReference:'another_grant'})).toThrow('local_book_approval_changed');expect(()=>localEngineMasterClaimFile({...g,profile:{...g.profile,sha256:'c'.repeat(64)}})).toThrow('local_book_approval_changed');});
 it('keeps the same global consumed key across a copied parent/new grant and activation with the same owner consent',()=>{const s=setup(),g=activate(s.grant,s.dir),copy=activate({...s.grant,approvalReference:'copied_grant',source:{...s.grant.source,root:s.dir}},s.dir,path.join(s.dir,'owner-consent.json'));expect(localEngineMasterClaimFile(copy)).toBe(localEngineMasterClaimFile(g));});
});
