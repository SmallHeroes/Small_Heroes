import {describe,it,expect} from 'vitest';
import path from 'node:path';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {preparationGrantSchema,preparationOwnerSchema,preparationPin,preparationFile,verifyPreparationReview} from '../source-preparation-policy';
import {planSourcePreparation,preparationMeterRules} from '../../../scripts/personal-source-preparation';

const sha='a'.repeat(64),head='b'.repeat(40);
const owner=()=>({version:'source-preparation-owner-approval/v1',owner:'Guy',approvalId:sha,approvalReference:'Synthetic consent event for portable schema tests only',capMicroUsd:5000000,maxCalls:6,maxNewLowReferenceImages:2,
  paidRetries:false,pages:false,narration:false,allReviewsAndFullUnknownReserves:true});
const grant=()=>({version:'native-source-preparation/v1',workspace:path.resolve('synthetic-workspace'),sourceHead:head,originalBookDir:path.resolve('synthetic-book'),out:path.resolve('synthetic-out'),
  originalSourceDigest:sha,originalStoryboardDigest:sha,layoutSha256:sha,firstWireSha256:sha,ownerApproval:{file:path.resolve('synthetic-owner.json'),bytes:20,sha256:sha},
  operator:{file:path.resolve('synthetic-operator.cjs'),bytes:10,sha256:sha},executionMode:'synchronous-or-durable-detached/v1',
  inputs:[{file:path.resolve('synthetic-input.json'),bytes:10,sha256:sha}],capMicroUsd:5000000,maxCalls:6});
function review(text:string,over:Record<string,unknown>={}){
  const root=mkdtempSync(path.join(tmpdir(),'synthetic-prep-review-')),report=path.join(root,'report.txt'),ready=path.join(root,'ready.json');writeFileSync(report,text);
  writeFileSync(ready,JSON.stringify({complete:true,disposition:'PASS',scope:'SOURCE_PREPARATION_EXECUTION',sourceHead:head,grantSha256:sha,report:{file:report,sha256:preparationPin(report).sha256},...over}));
  return{file:ready,sha256:preparationPin(ready).sha256};
}
const header='DISPOSITION: PASS\nSCOPE: SOURCE_PREPARATION_EXECUTION\nSOURCE_HEAD: '+head+'\nGRANT_SHA256: '+sha+'\n';
describe('portable preparation schema, review authority and cost narrowing',()=>{
  it('only exact bounded owner and grant declarations parse',()=>{expect(preparationOwnerSchema.parse(owner()).capMicroUsd).toBe(5000000);expect(preparationGrantSchema.parse(grant()).maxCalls).toBe(6);});
  it.each(['cap','calls','images','retry','pages','narration','unknown'])('owner refuses %s widening',kind=>{
    const x:any=owner();if(kind==='cap')x.capMicroUsd++;if(kind==='calls')x.maxCalls++;if(kind==='images')x.maxNewLowReferenceImages++;if(kind==='retry')x.paidRetries=true;
    if(kind==='pages')x.pages=true;if(kind==='narration')x.narration=true;if(kind==='unknown')x.allReviewsAndFullUnknownReserves=false;
    expect(preparationOwnerSchema.safeParse(x).success).toBe(false);
  });
  it.each(['cap','calls','step','extra-key'])('grant refuses %s drift',kind=>{
    const x:any=grant();if(kind==='cap')x.capMicroUsd++;if(kind==='calls')x.maxCalls++;if(kind==='step')x.firstWireSha256='invalid';if(kind==='extra-key')x.pages=[6,7];
    expect(preparationGrantSchema.safeParse(x).success).toBe(false);
  });
  it.each(['hold-first','hold-valid-header','quoted-pass','duplicate-head','duplicate-disposition','wrong-head','wrong-grant','wrong-scope'])('review refuses %s before authority',kind=>{
    let text=header;if(kind==='hold-valid-header')text=header.replace('DISPOSITION: PASS','DISPOSITION: HOLD')+'\n'+header;if(kind==='hold-first')text='DISPOSITION: HOLD\n\n'+header;if(kind==='quoted-pass')text='Review text\n'+header;
    if(kind==='duplicate-head')text+='SOURCE_HEAD: '+head+'\n';if(kind==='duplicate-disposition')text+='DISPOSITION: PASS\n';
    if(kind==='wrong-head')text=text.replace(head,'c'.repeat(40));if(kind==='wrong-grant')text=text.replace(sha,'c'.repeat(64));if(kind==='wrong-scope')text=text.replace('SOURCE_PREPARATION_EXECUTION','SOME_OTHER_SCOPE');
    expect(()=>verifyPreparationReview(review(text),sha,head)).toThrow();
  });
  it('genuine leading metadata and bound report ignore body examples',()=>{verifyPreparationReview(review(header+'\nDISPOSITION: HOLD\nbody example'),sha,head);});
  it('incomplete READY or changed report refuses',()=>{expect(()=>verifyPreparationReview(review(header,{complete:false}),sha,head)).toThrow();const r=review(header);writeFileSync(r.file,'{}');expect(()=>verifyPreparationReview(r,sha,head)).toThrow();});
  it('secret paths are refused before opening even nonexistent files',()=>{
    const env=path.resolve('does-not-exist','.env.local');expect(()=>preparationFile(env)).toThrow('source_prep_input_path');
    expect(()=>planSourcePreparation({bookDir:path.resolve('missing-book'),layoutFile:env})).toThrow('source_prep_input_path');
  });
  it('only exact LOW two-reference image and twelve-thousand sheet review requests reserve',()=>{
    const image:any={body:{model:'gpt-image-2',quality:'low',size:'1024x1024',n:1,prompt:'synthetic prompt'},references:[{},{}],retries:0,pricing:'image_input_8_output_30_conservative_no_cache',outputReservationTokens:8192};
    const imageRule=preparationMeterRules('sheet_entities_0')!;expect(imageRule.reserve(image)).toBeGreaterThan(0);expect(imageRule.reserve({...image,references:[{},{},{}]})).toBe(null);
    expect(imageRule.reserve({...image,body:{...image.body,quality:'high'}})).toBe(null);expect(imageRule.reserve({...image,body:{...image.body,prompt:'x'.repeat(32769)}})).toBe(null);
    const review:any={model:'gpt-6.1-sol',service_tier:'default',max_output_tokens:12000,instructions:'synthetic',input:[{content:[{type:'input_text',text:'{}'},...Array.from({length:7},()=>({type:'input_image'}))]}]};
    const rule=preparationMeterRules('sheet_entities_0_qa')!;expect(rule.reserve(review)).toBe(750000);expect(rule.reserve({...review,max_output_tokens:24000})).toBe(null);
    expect(preparationMeterRules('narration_p0')).toBeUndefined();expect(preparationMeterRules('sheet_locations_1')).toBeUndefined();
  });
});
