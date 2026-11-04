import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
const m = vi.hoisted(() => ({ state: 0, file: null as File | null, draft: {} as any, request: {} as any }));
vi.mock('react', async original => ({ ...await original<any>(), useEffect() {}, useMemo: (fn: any) => fn(), useRef: (current: any) => ({current}),
  useState: (initial: any) => { const i=m.state++; return [i===0 ? 4 : i===8 ? m.file : typeof initial==='function' ? initial() : initial, vi.fn()]; } }));
vi.mock('@/app/dev/personal-wizard/hooks', () => ({ useDraftStore: () => ({draft:m.draft,read:()=>m.draft,update:vi.fn()}),
  useObjectUrl:()=>null,usePlayback:()=>({}),useRecorder:()=>({snapshot:{phase:'idle'}}),useSoftKeyboardOpen:()=>false }));
vi.mock('@/lib/personal-wizard/draft', async original => { const actual = await original<any>(); return { ...actual,
  buildReviewedRequest:(draft:any)=>m.request?.draftId ? {ok:true,request:m.request} : actual.buildReviewedRequest(draft),requestIssues:()=>[] }; });
import { PersonalWizard } from '@/app/dev/personal-wizard/PersonalWizard';
import { createDraft } from '@/lib/personal-wizard/draft';
import { syntheticEngineOrderInput } from './synthetic-order';
import { resolveEngineWizardOptions } from '../personal-orders';
import { handleEnginePhotoUpload } from '../private-http';
import { ENGINE_PHOTO_MAX_BYTES } from '../photo-policy';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
function findButton(node: any): any {
  if (!node || typeof node!=='object') return null;
  if (node.type==='button' && String(node.props.children).includes('שמירת פרטי הספר')) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const found=findButton(child);if(found)return found; }
  return null;
}
describe('Q15 actual PersonalWizard submit to actual private photo HTTP cap/decoder',()=>{
  it('re-encodes and downsizes an oversized phone JPEG before upload; the server cap remains unchanged',async()=>{
    vi.stubGlobal('React', React); m.request = {};
    const original=await sharp({create:{width:4000,height:3000,channels:3,background:'#376685'}}).jpeg().toBuffer();
    const large=Buffer.concat([original,Buffer.alloc(ENGINE_PHOTO_MAX_BYTES+1)]);
    m.file=new File([large],'synthetic-phone.jpg',{type:'image/jpeg'}); m.state=0;
    m.request=syntheticEngineOrderInput().request; m.draft={...createDraft(m.request.draftId),revision:m.request.draftRevision,
      child:{...m.request.child},companionId:m.request.companion.id,bookOptions:m.request.bookOptions};
    const sizes:number[]=[];let canvasWidth=0,canvasHeight=0;
    vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:4000,height:3000,close:vi.fn()})));
    vi.stubGlobal('document',{createElement:()=>({get width(){return canvasWidth;},set width(v){canvasWidth=v;},get height(){return canvasHeight;},set height(v){canvasHeight=v;},
      getContext:()=>({fillRect(){},drawImage(){},fillStyle:''}),toBlob:(done:any)=>{
        void sharp(original).resize(canvasWidth,canvasHeight).jpeg({quality:85}).toBuffer().then(b=>done(new Blob([new Uint8Array(b)],{type:'image/jpeg'})));
      }})});
    const rows=new Map(),objects=new Map(); const db={$queryRaw:async()=>[{safe:true}],wizardSession:{create:async({data}:any)=>{rows.set(data.sessionId,data);return data;}}} as any;
    const storage={put:async(k:string,b:Buffer)=>{objects.set(k,b);},read:async(k:string)=>objects.get(k),sign:async()=>''};
    const posts=vi.fn(async(url:string,init:any)=>{
      if(url.endsWith('/photos')) { sizes.push(init.body.size); return handleEnginePhotoUpload(new NextRequest('https://app.example.invalid'+url,
        {...init,headers:{...init.headers,origin:'https://app.example.invalid'}}),{db,storage:()=>storage,enabled:true,parent:async()=>({id:'synthetic_parent',email:'parent@example.invalid',name:'Synthetic'})}); }
      return new Response(JSON.stringify({status:'personal_order_created',orderId:'synthetic_order'}),{status:201});
    }); vi.stubGlobal('fetch',posts);
    const tree=PersonalWizard({options:resolveEngineWizardOptions() as any,launchOrder:{optionsFingerprint:'a'.repeat(64),checkoutEnabled:false}});
    const button=findButton(tree); expect(button).not.toBeNull(); button.props.onClick();
    for(let n=0;n<100&&!posts.mock.calls.some(c=>c[0].endsWith('/orders'));n++) await new Promise(r=>setTimeout(r,10));
    expect(sizes).toHaveLength(1); expect(sizes[0]).toBeLessThanOrEqual(ENGINE_PHOTO_MAX_BYTES);
    expect(canvasWidth).toBe(2048);expect(canvasHeight).toBe(1536);
    expect(posts.mock.calls.some(c=>c[0].endsWith('/orders'))).toBe(true);
  },20_000);
});
