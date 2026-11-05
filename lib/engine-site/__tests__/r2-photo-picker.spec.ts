import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({error:vi.fn()}));
vi.mock('react',async original=>({...await original<any>(),useRef:()=>({current:null}),useState:()=>[null,state.error]}));
import { StepBook } from '@/app/dev/personal-wizard/StepBook';
import { createDraft } from '@/lib/personal-wizard/draft';
import { resolveEngineWizardOptions } from '../personal-orders';
import { prepareEnginePhotoUpload } from '../photo-upload-client';
function find(node:any,id:string):any {if(!node||typeof node!=='object')return null;if(node.props?.id===id)return node;
  for(const child of [node.props?.children].flat(Infinity)){const found=find(child,id);if(found)return found;}return null;}
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('R2-6 actual StepBook picker and bitmap decode',()=>{
  it('lets a phone photo above the server cap reach the browser downscale path',()=>{
    vi.stubGlobal('React',React);const onPhoto=vi.fn();const file=new File([new Uint8Array(5*1024*1024)],'synthetic.jpg',{type:'image/jpeg'});
    const tree=StepBook({draft:createDraft('draft_synthetic_r2'),update:vi.fn(),options:resolveEngineWizardOptions() as any,titleRef:{current:null},photoUrl:null,
      onPhoto,playback:{playingId:null,play:vi.fn(),stop:vi.fn()},launchOrder:true});
    find(tree,'pw-photo-input').props.onChange({target:{files:[file],value:'selected'}});
    expect(onPhoto).toHaveBeenCalledWith(file);
  });
  it('falls back when bitmap decode rejects and requests bounded bitmap decoding',async()=>{
    const bitmap=vi.fn(async(_file:unknown,_options:unknown)=>{throw Error('synthetic_bitmap_not_supported');});vi.stubGlobal('createImageBitmap',bitmap);
    vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:synthetic');vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
    class FakeImage {naturalWidth=8000;naturalHeight=6000;onload=()=>{};set src(_v:string){queueMicrotask(()=>this.onload());}}
    vi.stubGlobal('Image',FakeImage);vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},drawImage(){}}),
      toBlob:(done:any)=>done(new Blob(['synthetic'],{type:'image/jpeg'}))})});
    const header=new Uint8Array([255,216,255,192,0,17,8,23,112,31,64,3,1,17,0,2,17,0,3,17,0]);
    await expect(prepareEnginePhotoUpload(new File([header],'photo.jpg',{type:'image/jpeg'}))).resolves.toBeInstanceOf(Blob);
    expect(bitmap.mock.calls[0]![1]).toEqual(expect.objectContaining({resizeWidth:expect.any(Number),resizeHeight:expect.any(Number)}));
  });
});
