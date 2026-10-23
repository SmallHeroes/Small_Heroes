import { describe,it,expect } from 'vitest';
import { keyEventSourceOverlap,STORYBOARD_SELF_CHECK_SOURCE_SPANS_VERSION as VERSION } from '../storyboard-self-check';
import { compilePersonalStoryboard,preparePersonalStoryboard,personalStoryboardReviewInput,personalStoryboardFrame,storyboardReviewDisposition } from '../storyboard';
import { resolvePersonalWizardOptions } from '../options';
import { previewStoryEvidence } from '../../local-story-preview';
import { STORYBOARD_MOMENTS_VERSION } from '../storyboard-moments';
import { fullSelfCheck } from './storyboard-self-check-fixture';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { savedSelfCheckSourceSpans } from '../../../scripts/personal-simple-book-reviewed-audition';
import { storyboardReviewInstructions } from '../simple-storyboard-diagnostic';

describe('prospective key-event source intervals, not string similarity',()=>{
  it('accepts genuinely intersecting exact unique quotations, in both directions',()=>{
    const text='מיה מצאה עלה בכף היד ואז חייכה.';
    expect(keyEventSourceOverlap(text,'מיה מצאה עלה בכף היד','בכף היד ואז חייכה')).toBe(true);
    expect(keyEventSourceOverlap(text,'בכף היד ואז חייכה','מיה מצאה עלה בכף היד')).toBe(true);
  });
  it.each([
    ['מיה עמדה. ואז הלכה.','מיה עמדה','ואז הלכה'],
    ['מיה חייכה. אחר כך מיה חייכה שוב.','מיה חייכה','חייכה שוב'],
    ['מיה עמדה. ואז הלכה.','מיה עמדה.','. ואז הלכה'],
    ['מיה עמדה ואז הלכה','מיה עמדה ',' ואז הלכה'],
    ['מיה משחקת בחוץ','מיה משח','חקת בחוץ'],
    ['מיה חייכה. רות חייכה שוב.','מיה חייכה','רות חייכה שוב'],
    ['מיה חייכה','מיה','רות חייכה'],
    ['מיה חייכה','','מיה'],
  ])('rejects disjoint, ambiguous, punctuation, whitespace, partial-word or missing source binding %s',(text,a,b)=>expect(keyEventSourceOverlap(text,a,b)).toBe(false));
  it('retains already accepted exact containment, including legacy repeated phrases',()=>{
    expect(keyEventSourceOverlap('מיה חייכה ואז מיה חייכה','מיה חייכה','חייכה')).toBe(true);
  });
  it('saved version is exact, not a CLI/environment/default opt-in',()=>{
    expect(savedSelfCheckSourceSpans(undefined)).toBeUndefined();expect(savedSelfCheckSourceSpans({})).toBeUndefined();
    expect(savedSelfCheckSourceSpans({selfCheckSourceSpans:VERSION})).toEqual({selfCheckSourceSpans:true});
    for(const v of [null,true,'storyboard-self-check-source-spans/v2'])expect(()=>savedSelfCheckSourceSpans({selfCheckSourceSpans:v})).toThrow('audition_board_binding');
    expect(storyboardReviewInstructions({selfCheckContract:true})).not.toContain(VERSION);
    expect(storyboardReviewInstructions({selfCheckContract:true,selfCheckSourceSpans:true})).toContain(VERSION);
  });
  it('full compiler: absent v1 still refuses; opt-in changes book/review/frame digests, not source; semantic HOLD remains HOLD',async()=>{
    const f=await personalStoryboardFixture(),options=resolvePersonalWizardOptions(),source=preparePersonalStoryboard(f.request,f.result,options,
      undefined,true,undefined,undefined,undefined,undefined,undefined,undefined,undefined,true,true);
    const texts=previewStoryEvidence(source.story).texts,draft:any={...structuredClone(f.draft),moments:{version:STORYBOARD_MOMENTS_VERSION,
      frames:f.draft.plan.pages.map((_:unknown,n:number)=>({requirements:[],depicted:n===6?{evidence:'inside the hut again, and the ribbon',
        relations:['child','companion'].map(entityId=>({entityId,value:{relation:'beside',targetId:'hut'},evidence:'inside the hut again, and the ribbon'})),attributes:[]}:null}))}};
    draft.selfCheck=fullSelfCheck(draft,texts);
    draft.selfCheck.frames[6].events=[{quote:'They climb inside the hut again',kind:'action',consequential:true}];
    // The direct compiler still refuses in v1; no raw quote, event index or moment is rewritten by the new policy.
    const before=JSON.stringify(draft);expect(()=>compilePersonalStoryboard(source,draft)).toThrow('storyboard_self_check_key_event_instant');
    const book=compilePersonalStoryboard(source,draft,{selfCheckSourceSpans:true});expect(JSON.stringify(draft)).toBe(before);
    expect(book.selfCheckSourceSpans).toBe(VERSION);expect(book.sourceDigest).toBe(source.sourceDigest);
    const contained=structuredClone(draft);contained.selfCheck.frames[6].events[0].quote=contained.moments.frames[6].depicted.evidence;
    expect(compilePersonalStoryboard(source,contained).storyboardDigest).not.toBe(compilePersonalStoryboard(source,contained,{selfCheckSourceSpans:true}).storyboardDigest);
    expect(personalStoryboardReviewInput(book).selfCheckSourceSpans).toBe(VERSION);
    const r:any={...structuredClone(f.review),sourceDigest:book.sourceDigest,storyboardDigest:book.storyboardDigest};
    for(const c of [...r.bookChecks,...r.frames.flatMap((x:any)=>x.checks)])c.issues=[];
    const packet=personalStoryboardFrame(book,r,6,{request:f.request,writerResult:f.result,options});expect(packet.context.selfCheckSourceSpans).toBe(VERSION);
    r.frames[6].checks[0]={...r.frames[6].checks[0],verdict:'uncertain',observation:'required event evidence remains uncertain',issues:[{impact:'evidence',ref:'p6:instant',note:'Uncertain consequential event',whyNotMaterial:''}]};
    expect(storyboardReviewDisposition(book,r).disposition).toBe('held_uncertain');
    expect(()=>compilePersonalStoryboard(source,draft,{selfCheckSourceSpans:false} as never)).toThrow('personal_storyboard_self_check_source_spans_policy');
  },120000);
});
