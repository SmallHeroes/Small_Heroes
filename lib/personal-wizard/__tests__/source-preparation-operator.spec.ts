import {describe,it,expect} from 'vitest';
import {preparationActivationSchema,preparationLaunchSchema,preparationOperatorMain} from '../../../scripts/personal-source-preparation-operator';
const H='a'.repeat(64),HEAD='b'.repeat(40),pin={file:'C:/SYNTHETIC/input.json',sha256:H,bytes:10};
const launch={version:'source-preparation-operator/v1',state:'PROSPECTIVE_REQUIRES_GUY_ACTIVATION',grant:pin,layout:pin,supervisor:pin,
 activationFile:'C:/SYNTHETIC/ABSENT-GO.json',traceRoot:'C:/SYNTHETIC/traces',engineQa:{head:HEAD,ready:pin},sourceServerPort:3482,
 credential:'inherited_OPENAI_API_KEY_after_activation_only',phaseCapMs:5400000};
const activation={version:'source-preparation-owner-activation/v1',owner:'Guy',approvalReference:'SYNTHETIC TEST DATA ONLY, not an owner instruction.',
 envelopeSha256:H,grantSha256:H,ownerTermsSha256:H,sourceHead:HEAD,capMicroUsd:5000000,maxCalls:6,maxNewLowReferenceImages:2,
 noPaidRetries:true,phases:['start','continue'],reuseExistingCredential:true,executionReview:pin,approvedAt:'2026-11-02T00:00:00Z',expiresAt:'2026-11-02T01:00:00Z'};
describe('operator authority shape and CLI defaults, no providers',()=>{
 it('keeps prospective terms separate from the absent owner activation',()=>{expect(preparationLaunchSchema.parse(launch)).toEqual(launch);expect(preparationActivationSchema.parse(activation)).toEqual(activation);});
 it.each([{capMicroUsd:5000001},{maxCalls:7},{maxNewLowReferenceImages:3},{noPaidRetries:false},{reuseExistingCredential:false},{phases:['continue']},{owner:'Codex'},{unexpected:true}])('refuses widened or incomplete activation %j',change=>{expect(preparationActivationSchema.safeParse({...activation,...change}).success).toBe(false);});
 it.each([{state:'ACTIVE'},{sourceServerPort:0},{phaseCapMs:5400001},{credential:'read-env-file'},{extra:true}])('refuses a widened launch contract %j',change=>{expect(preparationLaunchSchema.safeParse({...launch,...change}).success).toBe(false);});
 it.each([[],['--envelope'],['--other','x'],['--envelope','x','--envelope','y']].map(argv=>({argv})))('rejects malformed CLI without dispatch $argv',async({argv})=>{await expect(preparationOperatorMain(argv)).rejects.toThrow('operator_args');});
});
