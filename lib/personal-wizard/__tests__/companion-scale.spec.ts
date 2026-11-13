import { describe,expect,it,vi } from 'vitest';
import { companionScaleAuthority } from '../companion-scale-authority';
import { COMPANION_SCALE_VERSION,assessCompanionScale,scaleEvidenceSchema,scaleCoverage,scaleRenderAppendix } from '../companion-scale';
import { getPersonalAddedCompanion } from '../personal-companions';
import { getCompanionById } from '../../companions';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { preparePersonalStoryboard,compilePersonalStoryboard,personalStoryboardReviewInput } from '../storyboard';
import { runSimpleWizardBook } from '../simple-book-flow';
import { assessAuditionReview,auditionPageReviewSchemaForContext,auditionJudgeInstruction } from '../simple-book-reviewed-audition';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import { PICTURE_BOOK_REVIEW, PICTURE_BOOK_SCALE_REVIEW } from '../picture-book-direction';
import { storyboardReviewInstructions } from '../simple-storyboard-diagnostic';
import { zodTextFormat } from 'openai/helpers/zod';

const measured=(ratio:number)=>({comparable:true,reason:'same_plane_standing' as const,estimatedRatio:ratio});
const abstain=(reason:'different_depth'|'not_standing'|'airborne'|'occluded')=>({comparable:false,reason,estimatedRatio:null});
const raw=(evidence:unknown,identityDefect=false)=>({candidateSha:'a'.repeat(64),contextSha:'b'.repeat(64),scaleEvidence:evidence,
  checks:QUALITY_CATEGORIES.map(category=>({category,verdict:identityDefect&&category==='identity'?'defect':'pass',
    observation:'Synthetic bound review, not pixels.',correction:identityDefect&&category==='identity'?'Restore companion identity.':'',
    issues:identityDefect&&category==='identity'?[{impact:'identity',requirement:'identity:companion',note:'Action pose has the wrong identity.'}]:[]}))});

describe('companion-scale/v1 approved authority and honest measurements',()=>{
  it('typed ranges match both approved prose sentences; unknown ranges are never inferred',()=>{
    expect(companionScaleAuthority('elephant_momo').scale.standingHeightInChildHeights).toEqual({min:.6,max:.75});
    expect(getPersonalAddedCompanion('elephant_momo')!.visualDescription).toContain('60–75%');
    expect(companionScaleAuthority('bunny_ometz').scale.standingHeightInChildHeights).toEqual({min:.25,max:.35});
    expect(getCompanionById('bunny_ometz')!.visualDescription).toContain('25–35%');
    expect(()=>companionScaleAuthority('dragon_dini')).toThrow('companion_scale_unavailable');
  });
  it.each(['elephant_momo','bunny_ometz'])('%s has its own inclusive range, never a universal ratio',id=>{
    const a=companionScaleAuthority(id),r=a.scale.standingHeightInChildHeights;
    for(const n of [r.min,(r.min+r.max)/2,r.max])expect(assessCompanionScale(measured(n),a).disposition).toBe('pass');
    for(const n of [r.min-.01,r.max+.01])expect(assessCompanionScale(measured(n),a).disposition).toBe('defect');
  });
  it.each(['different_depth','not_standing','airborne','occluded'] as const)('%s abstains for both companions without inventing a ratio',reason=>{
    for(const id of ['elephant_momo','bunny_ometz'])expect(assessCompanionScale(abstain(reason),companionScaleAuthority(id)).disposition).toBe('abstain');
  });
  it('refuses internally contradictory, absent, zero or non-finite measurements',()=>{
    for(const e of [{...measured(.7),comparable:false},{...abstain('airborne'),estimatedRatio:.7},{...measured(.7),estimatedRatio:null},
      {...abstain('airborne'),reason:'same_plane_standing'},measured(0),measured(Infinity),{}]) expect(scaleEvidenceSchema.safeParse(e).success).toBe(false);
  });
  it('an entire set of abstentions, including no observations, stays unverified',()=>{
    const a=companionScaleAuthority('elephant_momo'),e=assessCompanionScale(abstain('different_depth'),a);
    expect(scaleCoverage([])).toBe('unverified');expect(scaleCoverage(Array(9).fill(e))).toBe('unverified');
    expect(scaleCoverage([e,assessCompanionScale(measured(.7),a)])).toBe('observed_within_range');
    expect(scaleCoverage([assessCompanionScale(measured(.9),a)])).toBe('defect');
  });
  it('out-of-range and abstained reviews cannot be laundered by all-pass category labels; action identity remains enforced',()=>{
    const a=companionScaleAuthority('elephant_momo');
    const assess=(e:unknown,identity=false)=>assessAuditionReview(raw(e,identity),'a'.repeat(64),'b'.repeat(64),
      ['companion_scale','identity:companion'],undefined,undefined,undefined,undefined,a).assessment;
    expect(assess(measured(.7)).counts.continuity).toBe(0);
    expect(assess(measured(.9)).findings.some(f=>f.requirement==='companion_scale'&&f.verdict==='defect')).toBe(true);
    const airborne=assess(abstain('airborne'),true);
    expect(airborne.companionScale?.disposition).toBe('abstain');expect(airborne.counts.identity).toBe(1);expect(airborne.counts.continuity).toBe(0);
  });
  it('separates an abstention without an actionable correction from a visual scale finding',()=>{
    const authority=companionScaleAuthority('elephant_momo');
    const answer=raw(abstain('not_standing'));
    const scale=answer.checks.find(check=>check.category==='relative_scale')!;
    scale.verdict='uncertain';
    const assess=(policy?:typeof PICTURE_BOOK_REVIEW|typeof PICTURE_BOOK_SCALE_REVIEW)=>
      assessAuditionReview(answer,'a'.repeat(64),'b'.repeat(64),
        ['companion_scale'],undefined,undefined,undefined,undefined,authority,policy);
    expect(()=>assess()).toThrow('audition_review_issue_coverage');
    expect(()=>assess(PICTURE_BOOK_REVIEW)).toThrow('audition_review_issue_coverage');
    const before=structuredClone(answer);
    const admitted=assess(PICTURE_BOOK_SCALE_REVIEW);
    expect(admitted.review).toEqual(before);
    expect(answer).toEqual(before);
    expect(admitted.assessment.findings).toEqual([]);
    expect(admitted.assessment.companionScale?.disposition).toBe('abstain');

    scale.correction='Change the visible scale of the companion.';
    expect(()=>assess(PICTURE_BOOK_SCALE_REVIEW)).toThrow('audition_review_issue_coverage');
    scale.correction='';
    answer.scaleEvidence=measured(.7);
    expect(()=>assess(PICTURE_BOOK_SCALE_REVIEW)).toThrow('audition_review_issue_coverage');
    answer.scaleEvidence=abstain('not_standing');
    scale.verdict='defect';
    expect(()=>assess(PICTURE_BOOK_SCALE_REVIEW)).toThrow('audition_review_issue_coverage');
    scale.verdict='uncertain';
    scale.issues=[{impact:'continuity',requirement:'companion_scale',note:'The action pose scale is unclear.'}];
    expect(assess(PICTURE_BOOK_SCALE_REVIEW).assessment.counts.continuity).toBe(1);
    scale.issues=[];
    answer.checks.find(check=>check.category==='safety')!.verdict='uncertain';
    expect(()=>assess(PICTURE_BOOK_SCALE_REVIEW)).toThrow('audition_review_issue_coverage');
  });
  it('CE-R2 storyboard scale review verifies the proposed plan rather than issuing planner commands',()=>{
    const instruction=storyboardReviewInstructions({engineContinuity:{companionScale:true}});
    expect(instruction).toContain('Verify the supplied companionScale');
    expect(instruction).not.toContain('Choose\ncompanionStandingHeightInChildHeights');
  });
  it('the actual native review schema requires evidence only on marked contexts; legacy answers cannot smuggle it in',()=>{
    const context={version:'audition-page-context/v2',companionScale:companionScaleAuthority('elephant_momo')};
    const schema=auditionPageReviewSchemaForContext(context),answer={...raw(measured(.7)),landmarkInventory:{objects:[],landmarks:[]}};
    expect(schema.safeParse(answer).success).toBe(true);
    const {scaleEvidence:_e,...missing}=answer;
    expect(schema.safeParse(missing).success).toBe(false);
    expect(auditionPageReviewSchemaForContext({version:'audition-page-context/v2'}).safeParse(answer).success).toBe(false);
    const format=zodTextFormat(schema,'synthetic_scale_wire');
    expect((format.schema as any).required).toContain('scaleEvidence');
    expect(auditionJudgeInstruction('page',context)).toContain('ABSTENTION, never a scale');
    expect(scaleRenderAppendix(context)).not.toContain('return scaleEvidence');
    expect(()=>auditionPageReviewSchemaForContext({...context,companionScale:{...context.companionScale,version:'wrong'}})).toThrow();
  });
});

describe('companion-scale/v1 compiler and pre-provider policy',()=>{
  async function world(id='elephant_momo',enabled=true){
    const f=await personalStoryboardFixture('short',id),options=resolvePersonalWizardOptions(),flags=Array(16).fill(undefined);
    const source=preparePersonalStoryboard(...([f.request,f.result,options,...flags,...(enabled?[{companionScale:true}]:[])] as unknown as Parameters<typeof preparePersonalStoryboard>));
    return {...f,source};
  }
  it.each(['elephant_momo','bunny_ometz'])('%s binds authority and refuses an out-of-range storyboard before images',async id=>{
    const w=await world(id),a=companionScaleAuthority(id),r=a.scale.standingHeightInChildHeights;
    for(const n of [r.min,r.max]){const d=structuredClone(w.draft);d.plan.continuity!.companionStandingHeightInChildHeights=n;
      const book=compilePersonalStoryboard(w.source,d);
      expect(book.companionScale).toEqual(a);expect(personalStoryboardReviewInput(book).companionScale).toEqual(a);
    }
    for(const n of [r.min-.01,r.max+.01]){const d=structuredClone(w.draft);d.plan.continuity!.companionStandingHeightInChildHeights=n;
      expect(()=>compilePersonalStoryboard(w.source,d)).toThrow('personal_storyboard_companion_scale');}
  });
  it('flag absent keeps legacy source/compiled records free of the new authority and allows the old design range',async()=>{
    const w=await world('bunny_ometz',false),book=compilePersonalStoryboard(w.source,w.draft);
    expect(book.companionScale).toBeUndefined();expect(personalStoryboardReviewInput(book)).not.toHaveProperty('companionScale');
    expect(book.plan.continuity!.companionStandingHeightInChildHeights).toBe(.75);
    expect(scaleRenderAppendix({})).toBe('');
  });
  it('a companion without typed scale authority refuses before planning and before outer-flow callbacks',async()=>{
    await expect(world('dragon_dini')).rejects.toThrow('companion_scale_unavailable');
    const f=await personalStoryboardFixture(),callback=vi.fn();
    await expect(runSimpleWizardBook({request:f.request,options:resolvePersonalWizardOptions(),seed:'scale-policy',signal:new AbortController().signal,
      opus:callback,reader:callback,visual:callback,publish:callback,reservedWritingUsd:2,engineContinuity:{companionScale:true}})).rejects.toThrow('companion_scale_unavailable');
    expect(callback).not.toHaveBeenCalled();
  });
});
