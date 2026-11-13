import { describe, expect, it } from 'vitest';
import { exhaustedFrameEditParent, localEvaluationEligible, type AuditionAttempt, type SavedPage } from '@/lib/personal-wizard/simple-book-reviewed-audition';
import { localCurrentMediaRecoverySchema, localCurrentMediaRecoverySlots } from '../local-current-entities';
import { selectLocalEvaluationPages, selectSupportedNativePages } from '../native-recipe';
import { localReaderPreviewSchema } from '@/lib/local-reader-preview';

const image = 'a'.repeat(64);
const spec = { page: 4, afterPage: 5, parentImageSha256: image };
const defect = { bound: true, derived: false, verdict: 'defect', impact: 'story', requirement: 'scene_plan' };

function frame() {
  const attempts = [0, 1, 2].map(attempt => ({
    attempt, status: 'held', candidate: { imageSha: attempt === 2 ? image : String(attempt).repeat(64) },
    review: {}, assessment: { safetyBlocked: false, invalidCitations: 0, findings: [defect] },
    identity: { status: 'passed', subjectVisible: true, sameChild: true, reasonCode: 'same_child', threshold: .7, resemblanceScore: .94 },
  })) as unknown as AuditionAttempt[];
  return { pageNumber: 4, status: 'held', attempts } as SavedPage;
}

describe('one bounded material frame edit', () => {
  it('uses the pinned rejected attempt even if it is not the comparison predecessor', () => {
    const page = frame();
    expect(exhaustedFrameEditParent(page, spec)).toBe(page.attempts[2]);
  });

  it.each([
    ['different page', (p: SavedPage) => { p.pageNumber = 3; }],
    ['already supported', (p: SavedPage) => { p.status = 'qa_supported'; }],
    ['unexhausted', (p: SavedPage) => { p.attempts.shift(); }],
    ['safety', (p: SavedPage) => { p.attempts[0].assessment!.safetyBlocked = true; }],
    ['invalid citation', (p: SavedPage) => { p.attempts[2].assessment!.invalidCitations = 1; }],
    ['unmeasured identity', (p: SavedPage) => { p.attempts[1].identity = null; }],
    ['subthreshold identity', (p: SavedPage) => { p.attempts[2].identity!.resemblanceScore = .69; }],
    ['wrong candidate', (p: SavedPage) => { p.attempts[2].candidate!.imageSha = 'b'.repeat(64); }],
    ['uncertainty only', (p: SavedPage) => { p.attempts[2].assessment!.findings = []; }],
    ['derived finding', (p: SavedPage) => { p.attempts[2].assessment!.findings =
      p.attempts[2].assessment!.findings.map(f => ({ ...f, derived: true })); }],
  ] as const)('refuses %s', (_label, change) => {
    const page = frame();
    change(page);
    expect(() => exhaustedFrameEditParent(page, spec)).toThrow('audition_exhausted_frame_binding');
  });

  it('adds only render, review and identity at the same reservations as the ordinary slots', () => {
    const steps = ['page_4_2', 'page_4_2_qa', 'page_4_2_identity', 'page_5_2'].map((id,i) => ({id,maximumMicroUsd:10+i}));
    const next = localCurrentMediaRecoverySlots(steps,4);
    expect(next).toEqual([...steps,{id:'page_4_3',maximumMicroUsd:10},{id:'page_4_3_qa',maximumMicroUsd:11},{id:'page_4_3_identity',maximumMicroUsd:12}]);
    expect(() => localCurrentMediaRecoverySlots(next,4)).toThrow('local_media_recovery_slots');
    expect(() => localCurrentMediaRecoverySlots(steps,5)).toThrow('local_media_recovery_slots');
    expect(localCurrentMediaRecoverySlots(next,4,4).slice(-3)).toEqual([
      {id:'page_4_4',maximumMicroUsd:10},{id:'page_4_4_qa',maximumMicroUsd:11},{id:'page_4_4_identity',maximumMicroUsd:12},
    ]);
    expect(localCurrentMediaRecoverySchema.shape.targetReviewStep.safeParse('page_5_0_qa').success).toBe(true);
    for (const step of ['page_5_0_qa2','page_5_2_qa','page_0_0_qa','page_5_0_identity'])
      expect(localCurrentMediaRecoverySchema.shape.targetReviewStep.safeParse(step).success).toBe(false);
  });
});

describe('local evaluation keeps open story findings and hard checks', () => {
  const eligible = () => {
    const a = frame().attempts[2];
    a.assessment!.counts = {safety:0,story:1,identity:0,continuity:0,detail:0};
    a.assessment!.companionScale = {evidence:{comparable:true,reason:'same_plane_standing',estimatedRatio:.7},disposition:'pass'};
    return a;
  };
  it('retains a held disposition and leaves the ordinary gate strict', () => {
    const saved = Object.fromEntries(Array.from({length:9},(_,pageNumber) => {
      const chosen=eligible();
      return ['page_'+pageNumber,{pageNumber,attempts:[chosen],chosen,status:'held'}];
    }));
    expect(selectLocalEvaluationPages(saved).every(page=>page.status==='held')).toBe(true);
    expect(()=>selectSupportedNativePages(saved)).toThrow('engine_native_book_held');
    for(const page of Object.values(saved)){
      page.chosen.assessment!.companionScale={evidence:{comparable:false,reason:'not_standing',estimatedRatio:null},disposition:'abstain'};
    }
    expect(()=>selectLocalEvaluationPages(saved)).toThrow('engine_local_evaluation_scale');
  });
  it.each([
    ['identity score', (a:AuditionAttempt)=>{a.identity!.resemblanceScore=.69;}],
    ['explicit identity finding', (a:AuditionAttempt)=>{a.assessment!.findings.push({category:'identity',verdict:'defect',impact:'identity',bound:true,requirement:'cast:child',note:'changed'});}],
    ['scale', (a:AuditionAttempt)=>{a.assessment!.companionScale!.disposition='defect';}],
    ['action scale uncertainty', (a:AuditionAttempt)=>{a.assessment!.findings.push({category:'relative_scale',verdict:'uncertain',impact:'continuity',bound:true,requirement:'companion_scale',note:'unclear'});}],
    ['missing scale', (a:AuditionAttempt)=>{delete a.assessment!.companionScale;}],
    ['anatomy', (a:AuditionAttempt)=>{a.assessment!.findings.push({category:'anatomy',verdict:'uncertain',impact:'detail',bound:true,requirement:'anatomy:companion',note:'unclear'});}],
    ['safety', (a:AuditionAttempt)=>{a.assessment!.safetyBlocked=true;}],
    ['citations', (a:AuditionAttempt)=>{a.assessment!.invalidCitations=1;}],
    ['unreviewed', (a:AuditionAttempt)=>{a.review=null;}],
  ] as const)('refuses %s', (_label, change)=>{
    const attempt=eligible();
    expect(localEvaluationEligible(attempt)).toBe(true);
    change(attempt);
    expect(localEvaluationEligible(attempt)).toBe(false);
  });
  it('accepts a historical scale coverage note while rejecting a measured or actionable concern', ()=>{
    const attempt=eligible();
    attempt.assessment!.companionScale={evidence:{comparable:false,reason:'not_standing',estimatedRatio:null},disposition:'abstain'};
    attempt.assessment!.findings.push({category:'relative_scale',verdict:'uncertain',impact:'detail',bound:true,
      requirement:'companion_scale',note:'Standing coverage only'});
    expect(localEvaluationEligible(attempt)).toBe(true);
    attempt.assessment!.findings[1].verdict='defect';
    expect(localEvaluationEligible(attempt)).toBe(false);
  });
  it('validates exact held-page labels and keeps legacy manifests byte-compatible', ()=>{
    const manifest={version:'local-narrated-reader/v1',id:'local-test',title:'Title',childName:'Child',sourceManifestSha256:image,
      sourceQa:'incomplete',productAccepted:false,productionQualified:false,voice:{id:'dad_v2',label:'Dad',provider:'elevenlabs',model:'eleven_v3'},
      pages:[{pageNumber:0,text:'Title',imageSha256:image,audioSha256:image},{pageNumber:1,text:'Page',imageSha256:image,audioSha256:image}]};
    expect(localReaderPreviewSchema.parse(manifest)).toEqual(manifest);
    expect(localReaderPreviewSchema.parse({...manifest,heldFrames:[1]}).heldFrames).toEqual([1]);
    for(const heldFrames of [[],[1,0],[1,1],[2]])expect(localReaderPreviewSchema.safeParse({...manifest,heldFrames}).success).toBe(false);
  });
});
