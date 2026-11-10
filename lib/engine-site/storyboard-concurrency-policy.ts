import 'server-only';
import { PREPARATION_CONTRACTS } from '@/lib/personal-wizard/source-preparation-contracts';
import { SOURCE_CONCURRENCY_VERSION } from '@/lib/personal-wizard/storyboard-source-concurrency';

/** Explicit prospective TEST authority only. Old authorities return the exact old recipe object. */
export const ENGINE_SOURCE_CONCURRENCY_POLICY=SOURCE_CONCURRENCY_VERSION;
export function enginePreparationContracts(authority:{purpose:string;storyboardConcurrencyPolicy?:typeof ENGINE_SOURCE_CONCURRENCY_POLICY}){
  if(authority.storyboardConcurrencyPolicy===undefined)return PREPARATION_CONTRACTS;
  if(authority.purpose!=='test'||authority.storyboardConcurrencyPolicy!==ENGINE_SOURCE_CONCURRENCY_POLICY)throw Error('engine_source_concurrency_policy');
  return {...PREPARATION_CONTRACTS,engineContinuity:{...PREPARATION_CONTRACTS.engineContinuity,sourceConcurrency:true as const}};
}
