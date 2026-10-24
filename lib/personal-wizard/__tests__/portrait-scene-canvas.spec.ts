import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const { generated } = vi.hoisted(() => ({ generated: vi.fn() }));
vi.mock('../../generate-image', async original => ({ ...await original<object>(), generateGPTImage: generated }));
import { READER_PORTRAIT_FRAMING_VERSION as v3, READER_FIT_FRAMING_VERSION as v2, READER_SAFE_FRAMING_VERSION as v1,
  readerSafeSceneFraming, readerSafeSceneFramingPrompt } from '../../storybook-scene-framing';
import { auditionAdapters, auditionRenderPlan, auditionRenderRule, readAuditionGrant, reviewedBookLayoutSchema,
  LEGACY_BOOK_LAYOUT, type AuditionMeter } from '../../../scripts/personal-simple-book-reviewed-audition';
import { auditionJudgeInstruction } from '../simple-book-reviewed-audition';
import { trialApiRules } from '../../../scripts/personal-book-e2e-trial';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { personalStoryboardFrame } from '../storyboard';
import { previewSha } from '../../local-story-preview';

describe('prospective portrait source contract through the shared real scene transport', () => {
  beforeEach(() => { generated.mockReset(); });
  const plan = (version: typeof v1 | typeof v2 | typeof v3 | undefined, mode: 'book_identity' | 'identity' | 'style' = 'book_identity') =>
    auditionRenderPlan('not-read', 'A complete fictional scene, camera pulled back.', [], mode, undefined, undefined, version);
  it('requests real2:3pixels,not a square image with portrait CSS', () => {
    const p = plan(v3), f = readerSafeSceneFraming(v3, 'medium');
    expect(p.input.size).toBe('1024x1536');
    expect(p.wire.body).toMatchObject({ model: 'gpt-image-2', quality: 'low', size: '1024x1536', n: 1 });
    expect(p.wire).toMatchObject({ readerFraming: v3, retries: 0, outputReservationTokens: 8192 });
    expect(auditionRenderRule.reserve(p.wire)).toBe(p.maximumMicroUsd);
    expect(trialApiRules('page_1_0')?.reserve(p.wire)).toBe(p.maximumMicroUsd);
    expect(f).toMatchObject({ sourceCanvas: { width: 1024, height: 1536, size: '1024x1536', aspectRatio: '2:3' },
      targetChildHeightFraction: .4, maximumVisibleActorHeightFraction: .55, ratioDeviationImpact: 'detail' });
    expect(readerSafeSceneFramingPrompt(f)).toContain('1024x1536');
    expect(auditionJudgeInstruction('page', { packet: { readerFraming: f } })).toContain('1024x1536');
    expect(auditionJudgeInstruction('page', { packet: { readerFraming: f } })).toContain('ceiling55%');
  });
  it.each([undefined, v1, v2])('retains the exact legacy square request/reservation for %s', version => {
    expect(plan(version)).toEqual(plan(undefined));
    expect(plan(version).input.size).toBe('1024x1024');
  });
  it.each(['identity', 'style'] as const)('does not turn a %s child anchor into a page canvas', mode => {
    expect(plan(v3, mode)).toEqual(plan(undefined, mode));
  });
  it('keeps design sheets square while scene repair uses the same portrait as initial scenes', () => {
    const refs = ['target', 'child', 'companion', 'entities'].map(n => ({ imageName: n+'.png', imageSha: 'a'.repeat(64) }));
    const roles = ['scene_edit_target','child_design_authority','companion_design_authority','entity_design_authority'] as const;
    const repair = auditionRenderPlan('not-read','A bounded scene repair.',refs,'book_scene_edit',roles,undefined,v3);
    expect(repair.input.size).toBe('1024x1536');
    expect(repair.wire.referenceRoles).toEqual(roles);
    const sheet = auditionRenderPlan('not-read','A reference sheet.',refs.slice(1),'book_design',roles.slice(1),undefined,v3);
    expect(sheet.input.size).toBe('1024x1024');
    expect(sheet.wire).not.toHaveProperty('readerFraming');
  });
  it.each(['missing', 'old', 'square', 'landscape', 'quality', 'reservation'])('rejects a mismatched portrait wire: %s', edit => {
    const wire: any = structuredClone(plan(v3).wire);
    if (edit === 'missing') delete wire.readerFraming;
    if (edit === 'old') wire.readerFraming = v2;
    if (edit === 'square') wire.body.size = '1024x1024';
    if (edit === 'landscape') wire.body.size = '1536x1024';
    if (edit === 'quality') wire.body.quality = 'high';
    if (edit === 'reservation') wire.outputReservationTokens = 1024;
    expect(auditionRenderRule.reserve(wire)).toBeNull();
  });
  it('rejects an unknown marker before any key/provider/claim', () => {
    expect(() => plan('unknown' as never)).toThrow('framing_contract');
    const key = vi.fn(), meter = { run: vi.fn() } as unknown as AuditionMeter;
    expect(() => auditionAdapters({ directory: 'not-read', meter, key, signal: new AbortController().signal,
      readerFraming: 'unknown' as never })).toThrow('framing_contract');
    expect(key).not.toHaveBeenCalled(); expect(meter.run).not.toHaveBeenCalled(); expect(generated).not.toHaveBeenCalled();
  });
  it.each([[1024,1536,true],[1024,1024,false],[1536,1024,false]] as const)('actual adapter checks returned pixels %ix%i,not labels', async (width,height,accepted) => {
    const directory=mkdtempSync(path.join(tmpdir(),'portrait-render-')), calls: any[]=[];
    const buffer=await sharp({create:{width,height,channels:3,background:'#abcdef'}}).png().toBuffer();
    generated.mockImplementation(async input=>{
      const usage={input_tokens:10,output_tokens:20};input.observeProviderResponse?.({created:1,usage});
      return {buffer,model:'gpt-image-2',fallbackUsed:false,usage};
    });
    const meter={run:async(step: string,wire: unknown,maximum: number,dispatch: () => Promise<any>)=>{
      const call:any={step,wire,maximum};calls.push(call);try {const result=await dispatch();call.receipt=result;return result.value;}
      catch(error){call.error=error;throw error;}
    }} as unknown as AuditionMeter;
    const key=vi.fn(()=> 'offline-synthetic-placeholder-not-a-key');
    const io=auditionAdapters({directory,meter,key,signal:new AbortController().signal,readerFraming:v3});
    if(accepted) expect((await io.render('page_1_0','A complete generic scene.',[],'book_identity')).imageName).toBe('page_1_0.png');
    else await expect(io.render('page_1_0','A complete generic scene.',[],'book_identity')).rejects.toThrow('audition_image_dimensions');
    expect(generated).toHaveBeenCalledTimes(1); expect(generated.mock.calls[0][0].size).toBe('1024x1536');
    expect(calls).toHaveLength(1);expect(key).toHaveBeenCalledTimes(1);
    expect(existsSync(path.join(directory,'page_1_0.png'))).toBe(accepted);
    if(!accepted){
      expect(calls[0].error.receipt.estimatedMicroUsd).toBe(680);
      expect(auditionRenderRule.settle(calls[0].wire,calls[0].error.receipt,false)).toEqual({estimatedMicroUsd:680,coherent:true});
    }
  });
  it('validates source-canvas metadata in the shared judge instead of trusting arbitrary prose', () => {
    const f=readerSafeSceneFraming(v3,'wide');
    expect(()=>auditionJudgeInstruction('page',{packet:{readerFraming:{...f,sourceCanvas:{width:1024,height:1024,size:'1024x1024',aspectRatio:'1:1'}}}})).toThrow('audition_reader_framing_contract');
  });
});

describe('portrait contract stays bound to actual frames and exact native grant version',()=>{
  let fixture:Awaited<ReturnType<typeof personalStoryboardFixture>>;
  beforeAll(async()=>{fixture=await personalStoryboardFixture();},20000);
  it.each([0,1,6])('binds actual cover/body %i renderer and judge without rewriting story',page=>{
    const f=fixture,old=personalStoryboardFrame(f.book,f.review,page,{...f.current,readerFraming:v2});
    const next=personalStoryboardFrame(f.book,f.review,page,{...f.current,readerFraming:v3});
    expect(next.context.readerFraming).toMatchObject({sourceCanvas:{size:'1024x1536'}});
    expect(next.render.prompt).toContain('1024x1536');expect(next.qa.context).toBe(next.context);
    expect(next.render.contextSha).toBe(next.qa.contextSha);expect(next.packetDigest).not.toBe(old.packetDigest);
    expect(next.context.text).toBe(old.context.text);expect(next.context.sequence).toEqual(old.context.sequence);
    expect(next.context.visual).toEqual(old.context.visual);
  });
  it('admits only exactly equal optional grant/layout markers,including v3',()=>{
    const dir=mkdtempSync(path.join(tmpdir(),'portrait-grant-')),evidence=path.join(dir,'evidence.json'),file=path.join(dir,'grant.json');writeFileSync(evidence,'{}');
    const versions=[undefined,v1,v2,v3];
    for(const grantVersion of versions)for(const bookVersion of versions){
      const book={requestId:'a'.repeat(64),storyboardDigest:'b'.repeat(64),...(bookVersion?{readerFraming:bookVersion}:{})};
      const grant={version:'audition-spend-grant/v1',approvalReference:'Synthetic offline portrait binding; NOT permission to spend',
        book:{requestId:book.requestId,storyboardDigest:book.storyboardDigest,...(grantVersion?{readerFraming:grantVersion}:{})},
        ledger:{priorKnownApiMicroUsd:0,evidence:[{file:evidence,sha256:previewSha('{}')}],note:'Synthetic offline known ledger'},
        capMicroUsd:1000000,maxCalls:1,scope:{mode:'render',pages:[1]},claudeMax:'Claude Max usage is separate: not an API invoice, not $0 and not included in this ledger'};
      writeFileSync(file,JSON.stringify(grant));
      if(grantVersion===bookVersion)expect(readAuditionGrant(file,book).grant.book).toEqual(book);
      else expect(()=>readAuditionGrant(file,book)).toThrow('audition_grant_reader_framing');
    }
    expect(reviewedBookLayoutSchema.parse({...LEGACY_BOOK_LAYOUT,readerFraming:v3}).readerFraming).toBe(v3);
  });
});
