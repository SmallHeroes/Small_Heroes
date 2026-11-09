import 'server-only';
import { z } from 'zod';
import { canonicalHash } from '@/lib/canonical-json';
import { assessCompanionScale, scaleCoverage, type CompanionScaleAuthority } from '@/lib/personal-wizard/companion-scale';
import { engineSiteFail } from './contract';

export const IMAGE_COMPARISON_VERSION = 'image-model-comparison/v1' as const;
export const COMPARISON_MODELS = ['gpt-image-2.6-sunburst', 'gpt-image-2.6-flare'] as const;
export const COMPARISON_CAP = 2_500_000, COMPARISON_CALLS = 14;
export const COMPARISON_RESERVES = Object.freeze({ image: 1_275_904, pixel: 600_000, identity: 50_000, pair: 600_000 });
export const PAIR_SCALE_CHECK = 'natural_standing_scale' as const;
const sha = z.string().regex(/^[a-f0-9]{64}$/), page = z.number().int().min(0).max(8), note = z.string().min(1).max(1500);
const verdict = z.enum(['pass','defect','uncertain','not_applicable']);
export const comparisonPairSchema = z.object({
  version:z.literal('image-comparison-pair/v2'), sourceDigest:sha, storyboardDigest:sha,
  candidateShas:z.array(sha).length(2), contextShas:z.array(sha).length(2), canonicalReferenceShas:z.array(sha).length(4),
  checks:z.array(z.object({id:z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),frames:z.array(z.object({pageNumber:page,verdict,observation:note}).strict()).length(2),reason:note}).strict()).min(1).max(40),
}).strict();
export type PairCheck = string;
export type ComparisonFrameRecord = {pageNumber:number;candidateSha:string;contextSha:string;supported:boolean;
  /** Taken ONLY from the bound, admitted per-frame raw review; never from the extra pair report. */
  scaleEvidence:unknown;applicableChecks:readonly PairCheck[]};
export type ComparisonPairBinding = {sourceDigest:string;storyboardDigest:string;canonicalReferenceShas:readonly string[];checkIds:readonly string[];
  scaleAuthority:CompanionScaleAuthority;frames:readonly ComparisonFrameRecord[]};

/** Extra pair evidence can add a HOLD; it cannot grant per-frame support or invent a scale observation. */
export function assessComparisonPair(raw:unknown,binding:ComparisonPairBinding){
  const r=comparisonPairSchema.parse(raw),frames=binding.frames;
  if(frames.length!==2||frames[0].pageNumber===frames[1].pageNumber||
    r.sourceDigest!==binding.sourceDigest||r.storyboardDigest!==binding.storyboardDigest||
    canonicalHash(r.candidateShas)!==canonicalHash(frames.map(f=>f.candidateSha))||
    canonicalHash(r.contextShas)!==canonicalHash(frames.map(f=>f.contextSha))||
    canonicalHash(r.canonicalReferenceShas)!==canonicalHash(binding.canonicalReferenceShas)||
    !binding.checkIds.includes(PAIR_SCALE_CHECK)||new Set(binding.checkIds).size!==binding.checkIds.length||
    canonicalHash([...r.checks.map(c=>c.id)].sort())!==canonicalHash([...binding.checkIds].sort()))engineSiteFail('comparison_pair_binding');
  const scales=frames.map(f=>assessCompanionScale(f.scaleEvidence,binding.scaleAuthority)),reasons:string[]=[];
  if(!frames.every(f=>f.supported))reasons.push('native_frame_held');
  const coverage=scaleCoverage(scales);
  if(coverage!=='observed_within_range')reasons.push(coverage==='defect'?'native_scale_defect':'native_scale_unverified');
  for(const check of r.checks){
    if(canonicalHash(check.frames.map(f=>f.pageNumber))!==canonicalHash(frames.map(f=>f.pageNumber)))engineSiteFail('comparison_pair_frame_binding');
    const applies=frames.map((f,i)=>check.id===PAIR_SCALE_CHECK?scales[i].disposition!=='abstain':f.applicableChecks.includes(check.id));
    if(!applies.some(Boolean))reasons.push(check.id+':no_applicable_frame');
    check.frames.forEach((observation,i)=>{
      // A legitimate abstention is explicit. Calling it PASS overstates evidence; calling an applicable check N/A hides it.
      if(!applies[i]&&observation.verdict!=='not_applicable')reasons.push(check.id+':inapplicable_verdict');
      if(applies[i]&&observation.verdict!=='pass')reasons.push(check.id+':'+observation.verdict);
    });
  }
  return {supported:reasons.length===0,scaleCoverage:coverage,reasons:[...new Set(reasons)],review:r};
}

export type ComparisonStep={id:string;kind:keyof typeof COMPARISON_RESERVES;cell:string;model:typeof COMPARISON_MODELS[number];
  pageNumber?:number;candidateCells?:string[];maximumMicroUsd:number};
/** Balanced order, fixed scope and exactly one generation per cell. No generated image is a render reference. */
export function comparisonSchedule(pages:readonly number[]):ComparisonStep[]{
  if(!Array.isArray(pages)||pages.length!==2||pages.some(n=>!Number.isInteger(n)||n<0||n>8)||pages[0]>=pages[1])engineSiteFail('comparison_pages');
  const cells=[['C01',0,pages[0]],['C02',1,pages[0]],['C03',1,pages[1]],['C04',0,pages[1]]] as const,steps:ComparisonStep[]=[];
  for(const [cell,m,pageNumber]of cells)for(const kind of ['image','pixel','identity'] as const)
    steps.push({id:cell+'_'+kind,kind,cell,model:COMPARISON_MODELS[m],pageNumber,maximumMicroUsd:COMPARISON_RESERVES[kind]});
  for(const [i,model]of COMPARISON_MODELS.entries())steps.push({id:'pair_'+i,kind:'pair',cell:'P0'+i,model,
    candidateCells:cells.filter(c=>c[1]===i).sort((a,b)=>a[2]-b[2]).map(c=>c[0]),maximumMicroUsd:COMPARISON_RESERVES.pair});
  return steps;
}
export function selectComparisonModel(rows:readonly {model:typeof COMPARISON_MODELS[number];supported:boolean;settled:boolean;knownMicroUsd:number;imageLatencyMs:number}[]){
  if(rows.length!==2||new Set(rows.map(r=>r.model)).size!==2||rows.some(r=>!COMPARISON_MODELS.includes(r.model)||
    !Number.isSafeInteger(r.knownMicroUsd)||r.knownMicroUsd<0||!Number.isFinite(r.imageLatencyMs)||r.imageLatencyMs<0))engineSiteFail('comparison_selection_binding');
  if(rows.some(r=>!r.settled))return null;
  const yes=rows.filter(r=>r.supported);
  if(yes.length===1)return yes[0].model;if(yes.length!==2)return null;
  const [a,b]=yes;
  if(Math.max(a.knownMicroUsd,b.knownMicroUsd)>Math.min(a.knownMicroUsd,b.knownMicroUsd)*1.1)return a.knownMicroUsd<b.knownMicroUsd?a.model:b.model;
  if(Math.max(a.imageLatencyMs,b.imageLatencyMs)>Math.min(a.imageLatencyMs,b.imageLatencyMs)*1.1)return a.imageLatencyMs<b.imageLatencyMs?a.model:b.model;
  return COMPARISON_MODELS[0];
}
export function comparisonCarry(meter:{knownEstimateMicroUsd:number;accountedMicroUsd:number;logicalCalls:number;pendingCalls:number;unknownCalls:number;blocked:boolean}){
  if(meter.blocked||meter.pendingCalls||meter.unknownCalls||meter.accountedMicroUsd!==meter.knownEstimateMicroUsd||
    !Number.isSafeInteger(meter.accountedMicroUsd)||meter.accountedMicroUsd<0||meter.accountedMicroUsd>COMPARISON_CAP||
    !Number.isInteger(meter.logicalCalls)||meter.logicalCalls<0||meter.logicalCalls>COMPARISON_CALLS)engineSiteFail('comparison_unsettled');
  return {comparisonMicroUsd:meter.accountedMicroUsd,comparisonCalls:meter.logicalCalls,
    remainingBookMicroUsd:10_000_000-meter.accountedMicroUsd,remainingBookCalls:121-meter.logicalCalls,grantAuthority:false as const};
}
