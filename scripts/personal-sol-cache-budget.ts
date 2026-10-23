/** Opt-in tariff supplement; legacy base-rate records remain immutable. No provider/key/filesystem side effects. */
export const SOL_CACHE_BUDGET='sol-default-cache-write-budget/v1' as const;
const fail=():never=>{throw Error('trial_sol_cache_pricing');};
/** This restricted pricing policy supports no per-content overrides. Strings and output schemas are DATA,not cache controls. */
function noInputBreakpoints(value:unknown,seen=new Set<object>()){
  if(!value||typeof value!=='object')return;
  if(seen.has(value))fail();seen.add(value);
  if(Object.prototype.hasOwnProperty.call(value,'prompt_cache_breakpoint'))fail();
  for(const child of Object.values(value))noInputBreakpoints(child,seen);
  seen.delete(value);
}
function requestOf(wire:any){
  if(wire?.payload)return wire.payload;
  if(typeof wire?.json==='string'){try{return JSON.parse(wire.json);}catch{return fail();}}
  return wire;
}
/** Only the documented default/explicit30m Standard short-context contract is priced by this policy. */
export function isSolCacheWire(wire:unknown){
  const request=requestOf(wire);
  if(request?.model!=='gpt-6.1-sol')return false;
  noInputBreakpoints(request.input);
  if(request.service_tier!==undefined&&request.service_tier!=='default')fail();
  const options=request.prompt_cache_options;
  if(options!==undefined&&(!options||typeof options!=='object'||Array.isArray(options)||
    Object.keys(options).some(k=>k!=='ttl')||options.ttl!=='30m'))fail();
  // Responses reference: maximum retention and minimum TTL are independent.24h is the supported maximum for current models.
  if(request.prompt_cache_retention!=null&&request.prompt_cache_retention!=='24h')fail();
  return true;
}
const count=(n:unknown):number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0?n:fail();
export function solCacheWriteAdjustment(wire:unknown,raw:any){
  if(!isSolCacheWire(wire))return 0;
  if(raw?.model!=='gpt-6.1-sol'||raw?.service_tier!=='default'||raw.prompt_cache_retention!=null&&raw.prompt_cache_retention!=='24h')fail();
  const options=raw.prompt_cache_options;
  if(options!==undefined&&options!==null&&(!options||typeof options!=='object'||Array.isArray(options)||
    Object.keys(options).some(k=>k!=='ttl')||options.ttl!=='30m'))fail();
  const input=count(raw.usage?.input_tokens),details=raw.usage?.input_tokens_details,
    writes=count(details?.cache_write_tokens),reads=count(details?.cached_tokens);
  if(input>272000||writes+reads>input)fail();
  // Old base journals charge ALL input at2. No cached-read discount; this remains a labeled upper-bound estimate,not invoice.
  return Math.ceil(writes*.5);
}
export function solCacheReserveMargin(wire:unknown,maximum:number){
  if(!Number.isSafeInteger(maximum)||maximum<1)fail();
  return isSolCacheWire(wire)?Math.ceil(maximum*.25):0;
}
