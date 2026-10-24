/** Provider-free replay of an initial Sol source/planner. No client/key/dispatch or rewriting of a paid answer. */
import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import { prepareSimpleStory,writeSimpleStory } from '../lib/personal-wizard/simple-story-engine';
import { createCurrentSimpleStorySource,simpleStoryReadingPackets,simpleStoryFindingIsMaterial } from '../lib/personal-wizard/simple-story-source';
import { causalSourceReviewPacket,compileCausalSourceReading,CausalExperimentError } from '../lib/personal-wizard/story-causal-experiment';
import { prepareSourceCitationCorrection,applySourceCitationCorrection } from '../lib/personal-wizard/story-source-citations';
import { runSimpleStoryboardDiagnostic,type SimpleStoryboardDiagnosticCall } from '../lib/personal-wizard/simple-storyboard-diagnostic';
import type { PersonalWizardOptions } from '../lib/personal-wizard/options';
import type { StoryboardReviewCapacity } from '../lib/personal-wizard/storyboard-review-capacity';
import { prepareSolWritingWire,SOL_WRITING,solWritingMeterRule } from './personal-sol-writing-transport';
import { prepareCausalWire,type WirePolicy,type TransportReply } from './personal-causal-trial-adapters';
import { decodePersonalBookProviderOutput } from '../lib/personal-wizard/book-openai';
import { simpleWizardVisualPayload } from './personal-simple-wizard-worker';
import { previewSha } from '../lib/local-story-preview';
const fail=(code:string):never=>{throw Error(`saved_sol_${code}`);},same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
export async function replaySavedInitialSolSource(args:{request:unknown;options:PersonalWizardOptions;seed:string;bookDir:string;policy:WirePolicy;
  contracts:Record<string,true>;reviewCapacity?:StoryboardReviewCapacity}){
  const root=path.join(args.bookDir,'paid-stages'),read=(f:string)=>JSON.parse(readFileSync(f,'utf8')),
    saved=(stage:string,wire:unknown)=>{const r=read(path.join(root,`portrait_s0_${stage}.receipt.json`)),result=read(path.join(root,`portrait_s0_${stage}.result.json`));
      if(!same(wire,read(path.join(root,`portrait_s0_${stage}.wire.json`)))||result.completed!==true||result.estimatedMicroUsd!==r.estimatedMicroUsd||
        result.wireDigest!==previewSha(canonicalJson(wire)))fail('saved_call_binding');return r;};
  const prepared=prepareSimpleStory(args.request,args.options,args.seed),records:Partial<Record<'author'|'editor',TransportReply>>={};
  const generated=await writeSimpleStory(prepared,async call=>{const w=prepareSolWritingWire(call),r=saved(call.stage,w);records[call.stage]=r;
    if(!solWritingMeterRule.settle(w,r,true).coherent)fail('writing_receipt');return{output:r.output,usage:r.usage,estimatedUsd:r.estimatedMicroUsd/1e6};},{model:SOL_WRITING.model,reservedUsd:2});
  const source=createCurrentSimpleStorySource(args.request,generated,records as Record<'author'|'editor',TransportReply>,args.options,SOL_WRITING.model),packets=simpleStoryReadingPackets(args.request,source,args.options);
  let citationsUsed=0;
  const readCall=(call:any)=>{const d={...call,role:'astra' as const,conversationKey:`trial:${prepared.accepted.requestId}:0:${call.stage}`},w=prepareCausalWire(d,args.policy,2000000),r=saved(call.stage,w);
    if(!same(r.output,JSON.parse(r.raw.output_text)))fail('reader_output');return r.output;};
  const readings=[packets.final,packets.comparison].map((packet,i)=>{const stage=i?'comparison':'final_review',numbered=causalSourceReviewPacket(packet),raw=readCall({stage,instructions:numbered.instructions,
    input:canonicalJson({packetDigest:numbered.packetDigest,packet:numbered.packet}),schema:numbered.schema,maxOutputTokens:16000});
    try{return compileCausalSourceReading(packet,raw);}catch(e){if(!(e instanceof CausalExperimentError)||e.code!=='critic_evidence'||citationsUsed++)throw e;
      const correction=prepareSourceCitationCorrection(numbered,raw),answer=readCall({stage:'citation_correction',instructions:correction.instructions,input:correction.input,schema:correction.schema,maxOutputTokens:16000}),
        applied=applySourceCitationCorrection(numbered,raw,correction,answer);
      if(!same(read(path.join(args.bookDir,'text/citation-correction.json')),applied)||!same(read(path.join(args.bookDir,'text/citation-correction-request.json')),
        {stage,failed:raw,correctionDigest:correction.correctionDigest,body:correction.body}))fail('citation_binding');
      return compileCausalSourceReading(packet,applied.corrected);}});
  if(readings.some(r=>r.findings.some(simpleStoryFindingIsMaterial)))fail('source_not_admitted');
  const captured:{review?:SimpleStoryboardDiagnosticCall;planner?:SimpleStoryboardDiagnosticCall;draft?:unknown}={};
  try{await runSimpleStoryboardDiagnostic({request:args.request,writerResult:source,options:args.options,signal:new AbortController().signal,...args.contracts,reviewCapacity:args.reviewCapacity,
    generate:async call=>{if(call.stage==='review'){captured.review=call;throw Error('saved_replay_review_capture');}
      const w=prepareSolWritingWire(call),r=saved('storyboard',w);if(!solWritingMeterRule.settle(w,r,true).coherent||!same(r.output,decodePersonalBookProviderOutput(call,JSON.parse(r.raw.output_text))))fail('planner_receipt');
      captured.planner=call;captured.draft=r.output;return r.output;}});
  }catch(e){if(!captured.review||(e as any)?.code!=='review_callback_failed')throw e;}
  const review=captured.review??fail('review_not_captured'),planner=captured.planner??fail('planner_not_captured');
  if(!captured.draft)fail('draft_not_captured');
  return{source,generated,readings,citationsUsed,draft:captured.draft,planner,review,payload:simpleWizardVisualPayload(review,'gpt-6.1-sol')};
}
