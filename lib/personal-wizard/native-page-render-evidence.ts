import 'server-only';
import type { illustrateReviewedAudition } from './simple-book-reviewed-audition';
/** A returned image is diagnostic evidence before any subsequent review/identity/guard await; it grants no selection authority. */
export const NATIVE_PAGE_RENDER_EVIDENCE_VERSION='native-page-render-evidence/v1' as const;
type TrialPageRender=Parameters<typeof illustrateReviewedAudition>[0]['render'];
export function trialPageRenderEvidence(render:TrialPageRender,save:Parameters<typeof illustrateReviewedAudition>[0]['save']):TrialPageRender {
  return async(...call)=>{
    const candidate=await render(...call),frame=/^page_([0-8])_0$/.exec(call[0]);
    if(frame)save('drawn_page_'+frame[1],{version:NATIVE_PAGE_RENDER_EVIDENCE_VERSION,pageNumber:Number(frame[1]),attempt:0,step:call[0],candidate:{...candidate}});
    return candidate;
  };
}
/** One record per actual drawn frame, in draw order. More complete records replace evidence without counting the page twice. */
export function trialDrawnFrames(saved:ReadonlyMap<string,any>):string[]{
  const frames=new Map<number,{name:string;rank:number}>();
  for(const [name,value]of saved){
    const m=/^(page|halted_page|drawn_page|diagnostic_render)_([0-8])$/.exec(name);if(!m)continue;
    const candidate=m[1]==='halted_page'?(Array.isArray(value?.attempts)?value.attempts.some((a:any)=>!!a?.candidate):false):!!(value?.chosen?.candidate??value?.candidate);
    if(!candidate)continue;
    const frame=Number(m[2]),rank=m[1]==='page'?4:m[1]==='halted_page'?3:m[1]==='drawn_page'?2:1;
    if(rank>(frames.get(frame)?.rank??0))frames.set(frame,{name,rank});
  }
  return [...frames.values()].map(v=>v.name);
}
