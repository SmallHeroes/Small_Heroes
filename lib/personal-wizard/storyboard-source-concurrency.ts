import 'server-only';
import { z } from 'zod';
import type { PreviewPlan } from '../local-story-preview';
import type { bookSequenceSchema } from '../local-book-sequence';
import type { StoryboardMoments } from './storyboard-moments';
import { drawnInstantGaps, drawnChangeKey } from './storyboard-drawn-instant';

/** Explicit prospective interpretation; quoted provenance is NEVER a semantic verdict. */
export const SOURCE_CONCURRENCY_VERSION = 'storyboard-source-concurrency/v1' as const;
export const SOURCE_CONCURRENCY_DRAWN_RULE=`- A frame's drawn instant is where the first occurrence of its depicted.evidence ends in the page text. Source sentence order is the DEFAULT: a visible entity's later-written sequence transition or continuity change needs a supported depicted override UNLESS an explicit concurrency declaration binds that exact change. A declaration permits its existing end value only provisionally; the independent reviewer must find that the same-page quote establishes the temporal relationship. A crop never removes state, and no keyword automatically establishes concurrency.`;
const id=z.string().regex(/^[a-z][a-z0-9_]{0,49}$/);
const change=z.object({kind:z.enum(['relation','attribute']),entityId:id,
  attribute:z.string().trim().min(1).max(400).nullable(),evidence:z.string().trim().min(1).max(800)}).strict()
  .refine(v=>v.kind==='relation'?v.attribute===null:v.attribute!==null,'concurrent target shape');
export const sourceConcurrencySchema=z.object({version:z.literal(SOURCE_CONCURRENCY_VERSION),
  frames:z.array(z.object({changes:z.array(change).max(20)}).strict()).min(3).max(25)}).strict();
export const sourceConcurrencyPacketSchema=z.object({version:z.literal(SOURCE_CONCURRENCY_VERSION),changes:z.array(change).max(20)}).strict();
export type SourceConcurrency=z.infer<typeof sourceConcurrencySchema>;
type Sequence=z.infer<typeof bookSequenceSchema>;
function fail(code:string):never {throw Error(`storyboard_source_concurrency_${code}`);}
export const concurrencyClaimRef=(n:number,c:SourceConcurrency['frames'][number]['changes'][number])=>
  `p${n}:concurrent:${c.kind}:${c.entityId}${c.attribute===null?'':`:${c.attribute}`}`;
export const concurrencyKeys=(value:SourceConcurrency):ReadonlySet<string>=>new Set(value.frames.flatMap((f,n)=>
  f.changes.map(c=>drawnChangeKey(n,c.kind,c.entityId,c.attribute??undefined))));
export const withSourceConcurrency=<T extends z.AnyZodObject>(schema:T,frameCount?:number)=>schema.extend({concurrency:frameCount===undefined?sourceConcurrencySchema:
  sourceConcurrencySchema.extend({frames:z.array(sourceConcurrencySchema.shape.frames.element).length(frameCount)})});

/** Bind ONLY visible, later-written changes not otherwise overridden. Default chronology stays untouched. */
export function validateSourceConcurrency(raw:unknown,moments:StoryboardMoments,plan:PreviewPlan,sequence:Sequence,texts:readonly string[]):SourceConcurrency {
  const value=sourceConcurrencySchema.parse(raw);
  if(value.frames.length!==plan.pages.length||moments.frames.length!==plan.pages.length||texts.length!==plan.pages.length)fail('coverage');
  const gaps=drawnInstantGaps(moments,plan,sequence,texts,true),seen=new Set<string>();
  value.frames.forEach((frame,n)=>{
    if(!frame.changes.length)return;
    const d=moments.frames[n].depicted,text=texts[n];
    if(n===0||!d)fail('drawn_instant_required');
    if(!text.includes(d.evidence)||text.split(d.evidence).length!==2)fail('drawn_evidence_binding');
    for(const c of frame.changes){
      const key=drawnChangeKey(n,c.kind,c.entityId,c.attribute??undefined);
      if(seen.has(key))fail('duplicate');seen.add(key);
      const gap=gaps.find(g=>drawnChangeKey(g.pageNumber,g.kind,g.entityId,g.kind==='attribute'?g.attribute:undefined)===key);
      if(!gap)fail('target_not_pending_visible_change');
      // An unrelated quote, a different page, a partial change or an ambiguous occurrence cannot supply the relationship.
      if(!text.includes(c.evidence)||!c.evidence.includes(gap.changeEvidence)||text.split(c.evidence).length!==2)fail('source_binding');
    }
  });
  return value;
}

export const SOURCE_CONCURRENCY_PLANNER_ADDENDUM=`SOURCE-SUPPORTED CONCURRENCY (storyboard-source-concurrency/v1):
Choose ONE consequential illustrated instant before assigning its state. Under the visible-only policy, depicted with empty relations/attributes/actorStates/presence is valid: it locates an earlier instant even when no state override is needed. A background state is not a substitute key event for the page's meaningful action, failure, reveal or joke; a quiet ending that IS the meaning stays valid.
The default remains source sentence order. The top-level concurrency has version "storyboard-source-concurrency/v1" and frames matching every plan frame, each {changes:[]}. Only when the actual prose establishes that a LATER-WRITTEN change happens concurrently with depicted.evidence, list it as {kind:"relation"|"attribute",entityId,attribute:null for relation or exact attribute name,evidence:exact same-page quote containing the entire change quote}. The compiler binds an otherwise required visible change; it does NOT establish simultaneity. No keyword rule, decorative staging, arbitrary state, offscreen target or inference of certainty. Do not also override that change: its existing end value is used at THIS instant only; the page-end ledger and later pages are unchanged.
Every declaration is a stated temporal claim with self-check ref p{n}:concurrent:relation:{entityId} or p{n}:concurrent:attribute:{entityId}:{attribute}; never stage it. Its changedSections key is p{n}:moment. The independent reviewer must judge whether its quote establishes the temporal link. Without that support keep the normal supported override or choose another supported instant. Keep empty changes on cover and on frames with depicted null.`;
export const SOURCE_CONCURRENCY_REVIEW_ADDENDUM=`SOURCE-SUPPORTED CONCURRENCY (storyboard-source-concurrency/v1): concurrency.frames[n].changes are stated temporal claims, each bound to a visible later-written change. Their exact same-page quote must actually establish concurrency with that frame's depicted.evidence; quote presence and compiler acceptance are provenance only. Do not infer simultaneity from declaration, sentence position or a keyword alone. Uncertain, contradictory or unsupported consequential timing is a material evidence/story issue, never staging or cosmetic polish. A verified citation must support the WHOLE temporal claim, not merely the change. Judge the chosen instant's meaningful action and the effective state separately. Depicted with empty overrides is legal under visible-only policy; page-end state still never leaks an override forward.`;
export const SOURCE_CONCURRENCY_IMAGE_RULES=`SOURCE-SUPPORTED CONCURRENT STATE (storyboard-source-concurrency/v1): context.packet.sourceConcurrency names the reviewed exact concurrent changes at this ONE drawn instant. Their existing ledger end value is effective here; source sentence position alone is not a reason to substitute an earlier value. Compare the pixels against the packet's effective state AND its meaningful action. The declaration does not waive a missing action, wrong state, identity, geometry, continuity, safety or uncertainty finding. Keep every other unchanged requirement.`;
export function sourceConcurrencyFromContext(context:unknown){
  const c=context&&typeof context==='object'?context as {packet?:{sourceConcurrency?:unknown}}:undefined;
  return c?.packet?.sourceConcurrency===undefined?undefined:sourceConcurrencyPacketSchema.parse(c.packet.sourceConcurrency);
}
export function sourceConcurrencyRender(value:SourceConcurrency,n:number):string {
  const changes=value.frames[n]?.changes??[];
  return `SOURCE-SUPPORTED CONCURRENT STATE ${SOURCE_CONCURRENCY_VERSION}: ${JSON.stringify(changes)}. These reviewed declarations keep their existing ledger end value at this drawn instant. Draw one instant; retain fixed canon, geometry, identity and safety. Do not invent another change or persist a picture override.`;
}
