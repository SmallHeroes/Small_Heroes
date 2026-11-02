import {beforeAll,afterEach,describe,it,expect,vi} from 'vitest';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {startSourcePreparation,continueSourcePreparation,admitPreparationToPageProof,PREPARATION_ADMISSION} from '../../../scripts/personal-source-preparation';
import {loadReviewedBook,nativePageProofInputFiles} from '../../../scripts/personal-simple-book-reviewed-audition';
import {currentPersonalStoryboardFrame} from '../storyboard';
import {preparationPin,preparationGrantSchema,PREPARATION_STEPS} from '../source-preparation-policy';
import {preparationFixtureWorkspace,preparationExecutionFixture,fixtureGit,put,h} from './source-preparation-fixture';
const address=vi.hoisted(()=>({root:''}));
vi.mock('../native-page-proof-authority-host',()=>({get NATIVE_PAGE_PROOF_AUTHORITY_ROOT(){if(!address.root)throw Error('SYNTHETIC_HOST_UNSET');return address.root;}}));
const sourceWorkspace=process.cwd(),read=(file:string)=>JSON.parse(readFileSync(file,'utf8'));
let shared:Awaited<ReturnType<typeof preparationFixtureWorkspace>>;
beforeAll(async()=>{if(!process.env.SMALL_HEROES_R17_READONLY_BOOK)return;shared=await preparationFixtureWorkspace(sourceWorkspace);address.root=shared.host;},60000);
afterEach(()=>{vi.restoreAllMocks();if(!shared)return;writeFileSync(path.join(shared.workspace,'code-marker.txt'),'SYNTHETIC Git guard address, not deployed implementation\n');});
const fixture=()=>{const f=preparationExecutionFixture(shared);vi.spyOn(process,'cwd').mockReturnValue(shared.workspace);return f;};

describe.runIf(!!process.env.SMALL_HEROES_R17_READONLY_BOOK)('actual preparation caller, actual Git/fs/meter/reader, synthetic paid answers only',()=>{
  it('starts only the two text calls, preserves base frames, waits without refs, then admits the SAME serialized bundle into real USD1 dry proof',async()=>{
    const f=fixture(),waiting=await startSourcePreparation(f.args);
    expect(f.calls).toEqual(PREPARATION_STEPS.slice(0,2));expect(waiting.status).toBe('WAITING_FOR_OWNER_PAGE_SELECTION');
    const result=read(path.join(waiting.bookDir,'storyboard_cde_0','visual_simple_book_result.json'));
    const loaded=loadReviewedBook(waiting.bookDir,f.workspace,undefined,waiting.layout,PREPARATION_ADMISSION);
    expect(result.source.manuscript).toEqual(f.plan.original.result.source.manuscript);
    expect(result.storyboard.framePackets).toHaveLength(9);
    for(let n=0;n<9;n++){
      expect(result.storyboard.framePackets[n].context).not.toHaveProperty('readerFraming');
      const base=currentPersonalStoryboardFrame(loaded.book,loaded.rawReview,n,{request:loaded.current.request,writerResult:loaded.current.writerResult,options:loaded.current.options});
      expect(base).toEqual(result.storyboard.framePackets[n]);
    }
    expect(currentPersonalStoryboardFrame(loaded.book,loaded.rawReview,1,loaded.current).context).toHaveProperty('visual');
    const choiceFile=f.choice(waiting),done=await continueSourcePreparation({...f.args,choiceFile});
    expect(f.calls).toEqual([...PREPARATION_STEPS]);expect(done.spend.calls).toBe(6);expect(done.spend.unknownCost).toBe(0);
    expect(done.status).toBe('REFERENCES_QUALIFIED_EXACT_PAGE_PROOF_DRY_PENDING');
    // A prospective proof envelope is SYNTHETIC here; dryNativePageProof creates no authority/claim/output/provider.
    const pageOwnerFile=path.join(f.dir,'synthetic-page-owner.json');put(pageOwnerFile,{version:'native-page-proof-owner-approval/v1',owner:'Guy',approvalId:h('synthetic-page-owner'),
      approvalReference:'SYNTHETIC page allowance only, no real execution approval.',capMicroUsd:1000000,maxLowImages:2,allReviewsAndFullUnknownReserves:true,fullBook:false,narration:false,paidRetries:false});
    const pageOut=path.join(f.dir,'page-proof-not-created'),pageGrantFile=path.join(f.dir,'synthetic-page-grant.json');
    const required=nativePageProofInputFiles(done.bookDir,waiting.layout,done.sourceRun,'elephant_momo',pageOwnerFile,f.workspace);
    put(pageGrantFile,{version:'audition-spend-grant/v1',approvalReference:'SYNTHETIC downstream dry admission only, no provider authority',
      book:{requestId:loaded.queued.requestId,storyboardDigest:done.storyboardDigest,readerFraming:waiting.layout.readerFraming},
      ledger:{priorKnownApiMicroUsd:0,evidence:[{file:pageOwnerFile,sha256:preparationPin(pageOwnerFile).sha256}],note:'Synthetic distinct page ledger, not a reset of any real history'},capMicroUsd:1000000,maxCalls:6,
      scope:{mode:'render',pages:[1,7],sample:[1,7],pageAttempts:1,reuseSheets:{sourceRun:done.sourceRun,roles:['entities','locations']},pageProof:{version:'native-cde-page-proof/v1',workspace:f.workspace,sourceHead:f.grant.sourceHead,
        sourceDigest:loaded.book.sourceDigest,reviewSha256:h(loaded.rawReview),layoutSha256:h(waiting.layout),ownerApproval:preparationPin(pageOwnerFile),inputs:required.map(preparationPin)}},
      claudeMax:'Claude Max usage is separate: not an API invoice, not $0 and not included in this ledger'});
    const dry=await admitPreparationToPageProof({bookDir:done.bookDir,out:pageOut,grantFile:pageGrantFile,layout:waiting.layout});
    expect(dry.sourceAndReferencesAdmitted).toBe(true);expect(dry.executionReady).toBe(false);expect(dry.providerCalls).toBe(0);expect(existsSync(pageOut)).toBe(false);
  },60000);
  it('rejects a one-use replay before another text call or output directory',async()=>{
    const f=fixture();await startSourcePreparation(f.args);await expect(startSourcePreparation(f.args)).rejects.toThrow('consumed');expect(f.calls).toHaveLength(2);
  });
  it('N4 changed code while waiting refuses continuation before references',async()=>{
    const f=fixture(),waiting=await startSourcePreparation(f.args),choiceFile=f.choice(waiting);
    writeFileSync(path.join(f.workspace,'code-marker.txt'),'changed code');
    await expect(continueSourcePreparation({...f.args,choiceFile})).rejects.toThrow('source_changed');expect(f.calls).toHaveLength(2);
  });
  it('N4 changed clean HEAD while waiting also refuses continuation',async()=>{
    const f=fixture(),waiting=await startSourcePreparation(f.args),choiceFile=f.choice(waiting);
    fixtureGit(f.workspace,'commit','--allow-empty','-qm','synthetic changed clean head');
    await expect(continueSourcePreparation({...f.args,choiceFile})).rejects.toThrow('source_changed');expect(f.calls).toHaveLength(2);
  });
  it('N4 changing the saved waiting record cannot redefine its own layout/pins',async()=>{
    const f=fixture(),waiting=await startSourcePreparation(f.args),choiceFile=f.choice(waiting),file=path.join(f.grant.out,'WAITING-OWNER.json');
    const changed=read(file);changed.layout.readerFraming='reader-safe-scene-framing/v2';put(file,changed);
    await expect(continueSourcePreparation({...f.args,choiceFile})).rejects.toThrow('waiting_changed');expect(f.calls).toHaveLength(2);
  });
  it('N4 duplicate continuation cannot dispatch another reference or retry',async()=>{
    const f=fixture(),waiting=await startSourcePreparation(f.args),choiceFile=f.choice(waiting);
    const a=continueSourcePreparation({...f.args,choiceFile}),b=continueSourcePreparation({...f.args,choiceFile});
    const results=await Promise.allSettled([a,b]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
    expect(f.calls).toEqual([...PREPARATION_STEPS]);
  },60000);
  it('unknown first-call outcome retains its entire reserve and stops before review',async()=>{
    const f=fixture();f.args.transport=async step=>{f.calls.push(step);throw Error('synthetic lost response');};
    await expect(startSourcePreparation(f.args)).rejects.toThrow();expect(f.calls).toEqual(['prep_storyboard_0']);
    const stop=read(path.join(f.grant.out,'PREPARATION-STOP.json')),claim=read(path.join(f.grant.out,'sourceRun','paid-stages','prep_storyboard_0.claim.json'));
    expect(stop.spend.unknownOutcome).toBe(1);expect(stop.spend.reservedUnsettledMicroUsd).toBe(claim.maximumMicroUsd);expect(claim.maximumMicroUsd).toBeGreaterThan(f.plan.firstWire.reservedMicroUsd);
  });
  it('in-progress provider outcome keeps the FULL UNKNOWN reserve instead of settling preliminary usage',async()=>{
    const f=fixture();f.args.transport=async step=>{f.calls.push(step);return{model:'gpt-6.1-sol',service_tier:'default',status:'in_progress',id:'synthetic-pending',
      usage:{input_tokens:100,output_tokens:100,input_tokens_details:{cached_tokens:0,cache_write_tokens:100}}};};
    await expect(startSourcePreparation(f.args)).rejects.toThrow();
    const stop=read(path.join(f.grant.out,'PREPARATION-STOP.json')),claim=read(path.join(f.grant.out,'sourceRun','paid-stages','prep_storyboard_0.claim.json'));
    expect(stop.spend.unknownOutcome).toBe(1);expect(stop.spend.reservedUnsettledMicroUsd).toBe(claim.maximumMicroUsd);
    expect(f.calls).toEqual(['prep_storyboard_0']);
  });
  it('a real wardrobe response mismatch stops after the single paid-shaped answer; the raw receipt remains',async()=>{
    const f=fixture();f.board.raw.plan.actorAppearance.child.clothing.reverse();
    await expect(startSourcePreparation(f.args)).rejects.toThrow();expect(f.calls).toEqual(['prep_storyboard_0']);
    expect(existsSync(path.join(f.grant.out,'sourceRun','paid-stages','prep_storyboard_0.receipt.json'))).toBe(true);
    expect(existsSync(path.join(f.grant.out,'PREPARATION-STOP.json'))).toBe(true);
  });
  it('objects HOLD stops before places, keeps candidate/raw review, and cannot continue again',async()=>{
    const f=fixture(),waiting=await startSourcePreparation(f.args),choiceFile=f.choice(waiting),normal=f.args.transport;
    f.args.transport=async(step,wire,signal)=>{const raw=await normal(step,wire,signal);if(step==='sheet_entities_0_qa'){
      const review=JSON.parse(raw.output_text);const issue=JSON.parse(JSON.stringify(review.checks[0]));
      review.checks[0].verdict='uncertain';review.checks[0].issues=[{impact:'identity',requirement:'synthetic_unknown_requirement',note:'SYNTHETIC unresolved identity'}];raw.output_text=JSON.stringify(review);
    }return raw;};
    await expect(continueSourcePreparation({...f.args,choiceFile})).rejects.toThrow();expect(f.calls).toEqual(PREPARATION_STEPS.slice(0,4));
    expect(existsSync(path.join(f.grant.out,'sourceRun','illustrations','sheet_entities_0.png'))).toBe(true);
    await expect(continueSourcePreparation({...f.args,choiceFile})).rejects.toThrow();expect(f.calls).toHaveLength(4);
  });
});
