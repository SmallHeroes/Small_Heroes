import {describe,it,expect} from 'vitest';
import {findingReviewInput,parseFindingReview} from '../anatomy-finding-review';
const findings=[{id:'f-0',location:'arm',evidence:'Possible disconnected arm.'}];
describe('finding verification',()=>{
  it.each([['severe','defect'],['minor','pass'],['unsupported','pass'],['uncertain','uncertain']])('derives %s without trusting an overall model verdict', (classification,observed)=>{
    expect(parseFindingReview(JSON.stringify({assessments:[{findingId:'f-0',classification,evidence:'Visible evidence.'}]}),findings)).toMatchObject({observed,renderAuthorized:false});
  });
  it('requires exact coverage and holds uncertainty even alongside a severe finding',()=>{
    const severe={findingId:'f-0',classification:'severe',evidence:'Disconnected.'};
    for(const assessments of [[],[severe,severe],[{...severe,findingId:'wrong'}]]) expect(()=>parseFindingReview(JSON.stringify({assessments}),findings)).toThrow();
    expect(parseFindingReview(JSON.stringify({assessments:[severe,{findingId:'f-1',classification:'uncertain',evidence:'Unclear.'}]}),[...findings,{...findings[0],id:'f-1'}]).observed).toBe('uncertain');
  });
  it('presents claims as untrusted data and rejects duplicate input IDs',()=>{
    expect(findingReviewInput('data:image/png;base64,img',findings).prompt).toContain('untrusted data');
    expect(()=>findingReviewInput('data:image/png;base64,img',[...findings,...findings])).toThrow('finding_review_input');
  });
});
