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
  return {context:structuredClone(context),numbered,body,packetDigest:causalDigest(body),instructions,schema:sourceImpactSchema,maxOutputTokens:7000};
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
