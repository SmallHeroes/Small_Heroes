import 'server-only';
import { z } from 'zod';
import { canonicalJson } from './request-acceptance';
import { previewSha } from '../local-story-preview';
import { assertChildAnchorInspectedAccepted, childAnchorInspectionContext, childAnchorDescriptionRequest,
  childAnchorPoseDescriptionRequest, childAnchorAcceptanceVersions, childAnchorPoseVersions } from './child-anchor-style';

export const EXISTING_CHILD_APPEARANCE = 'existing-admitted-child-appearance/v1' as const;
export const EXISTING_CHILD_APPEARANCE_FILE = 'existing_child_appearance.json';
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const existingChildAppearanceSchema = z.object({version:z.literal(EXISTING_CHILD_APPEARANCE),requestId:hash,
  originalSourceDigest:hash,originalStoryboardDigest:hash,candidateSha:hash,adoptionSha:hash,contextSha:hash,recipeSha:hash,
  child:z.object({age:z.number().int().min(2).max(12),gender:z.enum(['boy','girl']),design:z.string().min(20).max(1500),
    clothing:z.array(z.string().min(1).max(400)).min(1).max(12),acceptance:z.enum(childAnchorAcceptanceVersions),pose:z.enum(childAnchorPoseVersions).optional()}).strict()}).strict();
export type ExistingChildAppearanceData = z.infer<typeof existingChildAppearanceSchema>;
declare const admitted: unique symbol;
export type ExistingChildAppearance = ExistingChildAppearanceData & {readonly [admitted]:true};
const admittedRecords = new WeakMap<object,string>();
const fail=():never=>{throw Error('existing_child_appearance_binding');};

/** Raw authority is never accepted by the compiler: restore by checking the actual copied adoption and image on every load. */
export function admitExistingChildAppearance(data:unknown,adoption:any,candidateSha:string):ExistingChildAppearance {
  const d=existingChildAppearanceSchema.parse(data),c=d.child,child={age:c.age,gender:c.gender,design:c.design,wardrobe:c.clothing.join('; ')};
  const prompt=c.pose?childAnchorPoseDescriptionRequest(child,c.pose).prompt:childAnchorDescriptionRequest(child).prompt;
  const context=childAnchorInspectionContext(child,prompt,c.acceptance,c.pose);
  if(d.candidateSha!==candidateSha||adoption?.name!=='child'||adoption?.candidate?.imageSha!==candidateSha||
    previewSha(canonicalJson(adoption))!==d.adoptionSha||canonicalJson(adoption.context)!==canonicalJson(context)||
    previewSha(canonicalJson(context))!==d.contextSha||adoption.anchor?.recipeSha!==d.recipeSha)fail();
  assertChildAnchorInspectedAccepted(adoption.anchor,candidateSha,context);
  const result=d as ExistingChildAppearance;admittedRecords.set(result,canonicalJson(result));return result;
}

/** The caller supplies the clothing from an already compiler/review-admitted original board, not a parsed wardrobe string. */
export function deriveExistingChildAppearance(origin:{requestId:string;sourceDigest:string;storyboardDigest:string;clothing:readonly string[]},
  child:{age:number;gender:'boy'|'girl';design:string;acceptance:typeof childAnchorAcceptanceVersions[number];pose?:typeof childAnchorPoseVersions[number]},
  adoption:unknown,candidateSha:string):ExistingChildAppearance {
  const a=adoption as any;
  return admitExistingChildAppearance({version:EXISTING_CHILD_APPEARANCE,requestId:origin.requestId,originalSourceDigest:origin.sourceDigest,
    originalStoryboardDigest:origin.storyboardDigest,candidateSha,adoptionSha:previewSha(canonicalJson(adoption)),contextSha:a?.anchor?.contextSha,
    recipeSha:a?.anchor?.recipeSha,child:{...child,clothing:[...origin.clothing]}},adoption,candidateSha);
}
export function assertExistingChildAppearance(value:ExistingChildAppearance,requestId?:string,age?:number,gender?:string){
  if(!value||!admittedRecords.has(value)||admittedRecords.get(value)!==canonicalJson(value)||
    requestId!==undefined&&value.requestId!==requestId||age!==undefined&&value.child.age!==age||gender!==undefined&&value.child.gender!==gender)fail();
  return value;
}
export function existingChildAppearanceData(value:ExistingChildAppearance):ExistingChildAppearanceData {
  assertExistingChildAppearance(value);return structuredClone(value);
}
export function assertExistingChildClothing(value:ExistingChildAppearance,draft:unknown){
  assertExistingChildAppearance(value);
  if(canonicalJson((draft as any)?.plan?.actorAppearance?.child?.clothing)!==canonicalJson(value.child.clothing))fail();
}
/** Additive schema narrowing; the real provider's metadata-free schema and local compiler use the same allowed items. */
export function withExistingChildAppearanceSchema<T extends z.AnyZodObject>(schema:T,data?:ExistingChildAppearanceData):T{
  if(data===undefined)return schema;
  const d=existingChildAppearanceSchema.parse(data),plan=schema.shape.plan as z.AnyZodObject,actors=plan?.shape.actorAppearance as z.AnyZodObject,
    child=actors?.shape.child as z.AnyZodObject;
  if(!child)fail();
  return schema.extend({plan:plan.extend({actorAppearance:actors.extend({child:child.extend({clothing:
    z.array(z.enum(d.child.clothing as [string,...string[]])).length(d.child.clothing.length)})})})}) as unknown as T;
}
export const EXISTING_CHILD_APPEARANCE_INSTRUCTION = `EXISTING ADMITTED CHILD APPEARANCE: existingChildAppearance is typed identity authority, not scene direction.
Copy child.clothing exactly, in its existing order, into actorAppearance.child.clothing. Preserve its design/age/address.
Do not paraphrase, reorder, add or remove clothing. Do not derive scene/page choices from this identity input.`;
