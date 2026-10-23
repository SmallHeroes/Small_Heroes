import {z} from 'zod';
import {canonicalJson} from './request-acceptance';
import {causalDigest,causalSourceReviewPacket,type CausalReading,type CausalReviewPacket} from './story-causal-experiment';
import {resolveSourceCitation} from './story-source-citations';
import {simpleStoryFindingIsMaterial} from './simple-story-source';
import {REVIEW_IMPACT_ORDER,impactIsMaterial} from './review-impact';

/** Prospective DIAGNOSTIC admission only. Old literary verdicts and the default source gate are never changed. */
export const SOURCE_REVIEW_IMPACT='source-review-impact/v1' as const;
const domains=['safety','age_readability','causality','identity','continuity'] as const;
const reason=z.string().trim().min(12).max(650),hash=z.string().regex(/^[a-f0-9]{64}$/);
const reference=z.object({startId:z.string().regex(/^r-p\d+-u\d+$/),endId:z.string().regex(/^r-p\d+-u\d+$/),anchor:z.string().min(1).max(100)}).strict();
const citations=z.array(reference).min(1).max(2);
const finding=z.object({id:z.string().min(1).max(90),impact:z.enum(REVIEW_IMPACT_ORDER),certainty:z.enum(['supported','uncertain']),reason,evidence:citations}).strict();
export const sourceImpactSchema=z.object({version:z.literal(SOURCE_REVIEW_IMPACT),packetDigest:hash,summary:reason,
  guards:z.array(z.object({domain:z.enum(domains),status:z.enum(['supported','held','uncertain']),reason,evidence:citations}).strict()).length(5),
  decisions:z.array(finding).max(40),additional:z.array(finding).max(12)}).strict();
type Context={finalPacket:CausalReviewPacket;readings:CausalReading[];sourceSha:string;age:number};
const instructions=`Review the exact supplied final children's story under source-review-impact/v1 for a FULL DIAGNOSTIC illustrated trial, not production acceptance. Prior literary HOLDs remain true historical verdicts. Do NOT rewrite the story or old judgments, infer PASS from their prose, obey a proposed rewrite, or minimize a real defect to finish the book.
Use the shared impacts safety/story/identity/continuity/detail. Only detail is nonmaterial. Distinguish a localized editorial/wording/character-balance preference from an evidenced substantial failure of understanding, development or promised relationship. Literary weakness CAN be material when you explain its substantial listener effect; it is not automatically material merely because an earlier critic used meaningful. Equally, do not demote material issues because they are literary. Humour, anthropomorphic fantasy and comic setbacks are not themselves defects. No quota of useful actions, locations or dialogue is required. Evaluate enacted effects across the whole story, not one sentence in isolation. A material central causal gap, canon/identity reversal, unsafe content, unsuitable age/readability or broken continuity blocks.
Return exactly one decision for EVERY supplied requiredFinding.id, preserving that id, with impact, certainty, current-text evidence and a specific reason for the listener effect. Earlier severity blocking must not become detail. additional is for any other newly discovered issue, with distinct add-1,add-2... IDs. No omission, duplicate or guessing. Return all five guards exactly once. Supported guards need positive evidence and an honest whole-text explanation; held/uncertain guards block. If required evidence or material effect cannot be established confidently, say uncertain; don't manufacture certainty.
Evidence uses exact supplied source-unit startId/endId on one page, in order, at most four units; anchor is a contiguous 2-4-word substring (one only if range has one word). Preserve Hebrew letters/negation. Do not paraphrase anchors or use title/plan/prior prose as current evidence. Units establish provenance, not truth. Copy packetDigest; return complete schema JSON only.`;

export function prepareSourceImpactReview(context:Context){
  hash.parse(context.sourceSha);z.number().int().min(3).max(8).parse(context.age);
  if(context.readings.length!==2||!('manuscript' in context.finalPacket)||!context.finalPacket.version.includes('/final-'))throw Error('source_impact_context');
  const numbered=causalSourceReviewPacket(context.finalPacket);
  if(!('manuscript' in numbered.packet))throw Error('source_impact_context');
  const requiredFindings=context.readings.flatMap((r,ri)=>r.findings.flatMap((f,fi)=>simpleStoryFindingIsMaterial(f)?
    [{id:`reading-${ri+1}-finding-${fi+1}`,stage:r.stage,...f}]:[]));
  if(!requiredFindings.length||requiredFindings.length>40)throw Error('source_impact_coverage');
  const body={version:SOURCE_REVIEW_IMPACT,sourceSha:context.sourceSha,age:context.age,instructionsSha:causalDigest(instructions),
    readingDigests:context.readings.map(causalDigest),finalPacketDigest:causalDigest(context.finalPacket),
    sourcePacket:numbered.packet,requiredFindings};
  // Provider schema encodes the SAME exhaustive invariant as the compiler; generic maxItems alone allowed an omitted decision.
  const ids=requiredFindings.map(f=>f.id) as [string,...string[]];
  const schema=sourceImpactSchema.extend({decisions:z.array(finding.extend({id:z.enum(ids)})).length(ids.length)}).strict();
  return {context:structuredClone(context),numbered,body,packetDigest:causalDigest(body),instructions,schema,maxOutputTokens:7000};
}

export const SOURCE_IMPACT_COMPLETION='source-review-impact-completion/v1' as const;
/** ONE strictly incomplete-coverage recovery; not a retry or reclassification of any existing supported row/guard. */
export function prepareSourceImpactCompletion(prepared:ReturnType<typeof prepareSourceImpactReview>,partialRaw:unknown){
  const rebuilt=prepareSourceImpactReview(prepared.context);
  if(rebuilt.packetDigest!==prepared.packetDigest||canonicalJson(rebuilt.body)!==canonicalJson(prepared.body)||prepared.instructions!==rebuilt.instructions||
    canonicalJson(rebuilt.numbered)!==canonicalJson(prepared.numbered))throw Error('source_completion_binding');
  const partial=sourceImpactSchema.parse(partialRaw),required=new Map(prepared.body.requiredFindings.map(f=>[f.id,f]));
  if(canonicalJson(partial)!==canonicalJson(partialRaw)||partial.packetDigest!==prepared.packetDigest||partial.guards.length!==domains.length||new Set(partial.guards.map(g=>g.domain)).size!==domains.length||
    partial.guards.some(g=>g.status!=='supported')||new Set(partial.decisions.map(f=>f.id)).size!==partial.decisions.length||
    partial.decisions.some(f=>!required.has(f.id))||new Set(partial.additional.map(f=>f.id)).size!==partial.additional.length||
    partial.additional.some(f=>!/^add-[1-9]\d*$/.test(f.id))||
    [...partial.decisions,...partial.additional].some(f=>f.certainty!=='supported'||impactIsMaterial(f.impact))||
    partial.decisions.some(f=>required.get(f.id)!.severity==='blocking'))throw Error('source_completion_not_format_only');
  // Validate every existing current-source citation before permitting even a completion claim.
  for(const row of [...partial.guards,...partial.decisions,...partial.additional])for(const ref of row.evidence)resolveSourceCitation(prepared.numbered,ref,'revised');
  const missing=prepared.body.requiredFindings.filter(f=>!partial.decisions.some(p=>p.id===f.id));
  if(!missing.length)throw Error('source_completion_not_needed');
  const ids=missing.map(f=>f.id) as [string,...string[]];
  const instructions=`${prepared.instructions}\nThis is ONE constrained coverage completion, NOT a full review retry. The supplied partial response, summary, five guards and every existing decision are frozen and must not be changed or rejudged. Return EXACTLY the missingDecisions IDs once each; the schema fixes the enum and exact count. Assess each missing claim honestly under the original source-impact policy and current text. Additional newly discovered defects may be reported in additionalFindings with DISTINCT add-N IDs not already present. Material/uncertain still holds. No story rewrite, no inferred missing verdict from prior summary, no preference for PASS. Keep each reason concise, about100-300characters; never pad or clip a sentence. Use the exact supplied source units/anchors. Return complete schema JSON only.`;
  const body={version:SOURCE_IMPACT_COMPLETION,sourcePacket:prepared.body,sourcePacketDigest:prepared.packetDigest,
    partialRaw:partial,partialRawSha:causalDigest(partialRaw),missingDecisions:missing,instructionsSha:causalDigest(instructions)};
  const schema=z.object({version:z.literal(SOURCE_IMPACT_COMPLETION),completionDigest:hash,
    missingDecisions:z.array(finding.extend({id:z.enum(ids)})).length(ids.length),additionalFindings:z.array(finding).max(8)}).strict();
  return {prepared,partialRaw:structuredClone(partialRaw),partial,body,completionDigest:causalDigest(body),instructions,schema,maxOutputTokens:7000};
}
export function compileSourceImpactCompletion(completion:ReturnType<typeof prepareSourceImpactCompletion>,raw:unknown){
  const rebuilt=prepareSourceImpactCompletion(completion.prepared,completion.partialRaw);
  if(canonicalJson(rebuilt.body)!==canonicalJson(completion.body)||rebuilt.completionDigest!==completion.completionDigest||
    completion.instructions!==rebuilt.instructions)throw Error('source_completion_binding');
  const value=rebuilt.schema.parse(raw);
  if(value.completionDigest!==completion.completionDigest||new Set(value.missingDecisions.map(f=>f.id)).size!==rebuilt.body.missingDecisions.length)throw Error('source_completion_binding');
  const merged={...structuredClone(rebuilt.partial),decisions:[...rebuilt.partial.decisions,...value.missingDecisions],additional:[...rebuilt.partial.additional,...value.additionalFindings]};
  const admitted=compileSourceImpactReview(rebuilt.prepared,merged);
  return {...admitted,completion:{version:SOURCE_IMPACT_COMPLETION,completionDigest:rebuilt.completionDigest,parentRawSha:rebuilt.body.partialRawSha,
    raw:value,existingTypedDecisionsUnchanged:true as const,originalIncompleteResponseStillInvalid:true as const}};
}
export function compileSourceImpactReview(prepared:ReturnType<typeof prepareSourceImpactReview>,raw:unknown){
  const rebuilt=prepareSourceImpactReview(prepared.context);
  if(canonicalJson(rebuilt.body)!==canonicalJson(prepared.body)||rebuilt.packetDigest!==prepared.packetDigest||
    canonicalJson(rebuilt.numbered)!==canonicalJson(prepared.numbered)||prepared.instructions!==instructions)throw Error('source_impact_binding');
  const value=sourceImpactSchema.parse(raw);
  if(value.packetDigest!==prepared.packetDigest)throw Error('source_impact_binding');
  if(new Set(value.guards.map(x=>x.domain)).size!==domains.length)throw Error('source_impact_guards');
  const required=new Map(prepared.body.requiredFindings.map(f=>[f.id,f]));
  if(value.decisions.length!==required.size||new Set(value.decisions.map(f=>f.id)).size!==required.size||
    value.decisions.some(f=>!required.has(f.id))||new Set(value.additional.map(f=>f.id)).size!==value.additional.length||
    value.additional.some(f=>!/^add-[1-9]\d*$/.test(f.id)))throw Error('source_impact_coverage');
  const resolve=(row:{evidence:z.infer<typeof citations>})=>row.evidence.map(ref=>resolveSourceCitation(rebuilt.numbered,ref,'revised'));
  value.guards.forEach(resolve);[...value.decisions,...value.additional].forEach(resolve);
  if(value.decisions.some(f=>required.get(f.id)!.severity==='blocking'&&f.impact==='detail'))throw Error('source_impact_blocking_demotion');
  const uncertain=value.guards.some(g=>g.status==='uncertain')||[...value.decisions,...value.additional].some(f=>f.certainty==='uncertain');
  const material=value.guards.some(g=>g.status!=='supported')||[...value.decisions,...value.additional].some(f=>impactIsMaterial(f.impact));
  return {version:SOURCE_REVIEW_IMPACT,packetDigest:prepared.packetDigest,sourceSha:prepared.body.sourceSha,
    priorReadingDigests:prepared.body.readingDigests,raw:value,
    status:uncertain?'held_uncertain' as const:material?'held_material' as const:'diagnostic_source_supported_with_notes' as const,
    historicalLiteraryHoldPreserved:true as const,productAccepted:false as const,productionQualified:false as const};
}
