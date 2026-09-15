import { describe,it,expect } from 'vitest';
import { parseSevereAnatomyReview,SEVERE_ANATOMY_INSTRUCTION } from '../illustrated-anatomy-severity';
import { comparisonInput,COMPARISON_INSTRUCTION } from '../visual-qa-comparison';

const note={location:'hand',evidence:'Simplified grip, minor concern only.'};
const good={anatomy:{verdict:'pass',explanation:'No clear severe defect.',findings:[]},nonBlockingObservations:[note]};
describe('severe-only illustrated anatomy policy',()=>{
  it('allows minor observations without failing',()=>{expect(parseSevereAnatomyReview(JSON.stringify(good)).anatomy.verdict).toBe('pass');});
  it('requires explicit severe classification for a defect',()=>{
    const defect={...good,anatomy:{...good.anatomy,verdict:'defect',findings:[{location:'behind shoulder',evidence:'Disconnected exposed limb with no body attachment.',severity:'severe',kind:'extra_or_disconnected_body_part'}]}};
    expect(parseSevereAnatomyReview(JSON.stringify(defect)).anatomy.verdict).toBe('defect');
    for(const severity of ['minor','medium','']) expect(()=>parseSevereAnatomyReview(JSON.stringify({...defect,anatomy:{...defect.anatomy,findings:[{...defect.anatomy.findings[0],severity}]}}))).toThrow();
  });
  it('does not promote notes to defects or ignore contradictory severe findings',()=>{
    expect(()=>parseSevereAnatomyReview(JSON.stringify({...good,anatomy:{...good.anatomy,verdict:'defect'}}))).toThrow('severe_anatomy_verdict_conflict');
    expect(()=>parseSevereAnatomyReview(JSON.stringify({...good,anatomy:{...good.anatomy,findings:[{...note,severity:'severe',kind:'impossible_joint'}]}}))).toThrow('severe_anatomy_verdict_conflict');
  });
  it('preserves uncertainty and rejects malformed or legacy unclassified output',()=>{
    expect(parseSevereAnatomyReview(JSON.stringify({...good,anatomy:{...good.anatomy,verdict:'uncertain',explanation:'Target unreadable.'}})).anatomy.verdict).toBe('uncertain');
    expect(()=>parseSevereAnatomyReview('not json')).toThrow();
    expect(()=>parseSevereAnatomyReview(JSON.stringify({anatomy:good.anatomy,otherFindings:[]}))).toThrow();
  });
  it('makes the policy opt-in, keeps old baseline unchanged, and prohibits labelled examples',()=>{
    const image='data:image/png;base64,target';
    expect(comparisonInput('qwen',image).system_prompt).toBe(COMPARISON_INSTRUCTION);
    const severe=comparisonInput('qwen',image,{mode:'severe-only',examples:[]});
    expect(severe.system_prompt).toBe(SEVERE_ANATOMY_INSTRUCTION);expect(severe.image).toEqual([image]);
    expect(()=>comparisonInput('qwen',image,{mode:'severe-only',examples:[{image:'data:image/png;base64,ex',verdict:'pass',explanation:'Label.'}]})).toThrow('invalid_style_calibration');
  });
});
