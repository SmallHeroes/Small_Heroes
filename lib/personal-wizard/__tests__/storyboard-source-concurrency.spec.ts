import { describe, expect, it } from 'vitest';
import { drawnInstantGaps } from '../storyboard-drawn-instant';
import { SOURCE_CONCURRENCY_VERSION, validateSourceConcurrency, concurrencyKeys, sourceConcurrencySchema } from '../storyboard-source-concurrency';

// Synthetic structural specimen, not a semantic approval or an alteration of a paid storyboard.
function specimen() {
  const action = 'The child pulled the lever.', change = 'Meanwhile the beacon turned blue.';
  const moments: any = {frames:[{depicted:null},{depicted:null},{depicted:{evidence:action,relations:[],attributes:[],actorStates:[],presence:[]}}]};
  const plan: any = {pages:[{},{},{}],continuity:{pages:[{visibleEntityIds:[],changes:[]},{visibleEntityIds:[],changes:[]},
    {visibleEntityIds:['beacon'],changes:[{entityId:'beacon',attribute:'color',value:'blue',storyEvidence:change}]}]}};
  const sequence: any = {pages:[{visibleCastIds:[],transitions:[]},{visibleCastIds:['child'],transitions:[]}]};
  return {moments,plan,sequence,texts:['Cover','Opening',`${action} ${change}`]};
}
describe('explicit source concurrency, default chronological behavior unchanged', () => {
  it('keeps a later-written change pending without an explicit concurrency declaration', () => {
    const x=specimen();expect(drawnInstantGaps(x.moments,x.plan,x.sequence,x.texts,true)).toHaveLength(1);
  });
  it('can represent a specifically declared concurrent change without a fabricated FROM override', () => {
    const x=specimen(), declared=new Set([JSON.stringify([2,'attribute','beacon','color'])]);
    expect(drawnInstantGaps(x.moments,x.plan,x.sequence,x.texts,true,declared)).toEqual([]);
  });
});

const declaration=(evidence='Meanwhile the beacon turned blue.'):any=>({version:SOURCE_CONCURRENCY_VERSION,
  frames:[{changes:[]},{changes:[]},{changes:[{kind:'attribute',entityId:'beacon',attribute:'color',evidence}]}]});
const validate=(d:any,x=specimen())=>validateSourceConcurrency(d,x.moments,x.plan,x.sequence,x.texts);
describe('concurrency provenance and target fences (not semantic acceptance)',()=>{
  it('binds the exact pending visible change and changes no plan, moment or ledger value',()=>{
    const x=specimen(),before=JSON.stringify(x),v=validate(declaration(),x);
    expect(drawnInstantGaps(x.moments,x.plan,x.sequence,x.texts,true,concurrencyKeys(v))).toEqual([]);
    expect(JSON.stringify(x)).toBe(before);expect(v.frames[2].changes[0].evidence).toContain('beacon turned blue');
  });
  it.each(['unknown','other_entity'])('refuses a nonexistent pending entity %s',entityId=>{
    const d=declaration();d.frames[2].changes[0].entityId=entityId;expect(()=>validate(d)).toThrow('target_not_pending_visible_change');
  });
  it('refuses a fixed or unrelated attribute',()=>{const d=declaration();d.frames[2].changes[0].attribute='age';expect(()=>validate(d)).toThrow('target_not_pending_visible_change');});
  it('refuses duplicate declarations of one target',()=>{const d=declaration();d.frames[2].changes.push({...d.frames[2].changes[0]});expect(()=>validate(d)).toThrow('duplicate');});
  it.each(['not a source quote','The child pulled the lever.','beacon turned blue'])('refuses unsupported/incomplete quotation %s',e=>expect(()=>validate(declaration(e))).toThrow('source_binding'));
  it('refuses an ambiguous duplicate quote',()=>{const x=specimen();x.texts[2]+=' Meanwhile the beacon turned blue.';expect(()=>validate(declaration(),x)).toThrow('source_binding');});
  it('refuses a unique longer declaration around a different occurrence of the repeated target-change quote',()=>{
    const x=specimen(),quote='Meanwhile the beacon turned blue.';x.texts[2]+=' Later they looked back. '+quote;
    expect(()=>validate(declaration('Later they looked back. '+quote),x)).toThrow('source_binding');
  });
  it('refuses a quote belonging to a different page',()=>{const x=specimen();x.texts[1]+=' The bell rings.';expect(()=>validate(declaration('The bell rings.'),x)).toThrow('source_binding');});
  it('refuses a declaration at page end or on the cover',()=>{
    const x=specimen();x.moments.frames[2].depicted=null;expect(()=>validate(declaration(),x)).toThrow('drawn_instant_required');
    const d=declaration();d.frames[0].changes=d.frames[2].changes;expect(()=>validate(d)).toThrow('drawn_instant_required');
  });
  it('refuses a hidden entity instead of silently erasing temporal authority',()=>{const x=specimen();x.plan.continuity.pages[2].visibleEntityIds=[];expect(()=>validate(declaration(),x)).toThrow('target_not_pending_visible_change');});
  it('refuses concurrency when the same target is also overridden',()=>{const x=specimen();x.moments.frames[2].depicted.attributes=[{entityId:'beacon',attribute:'color',value:'red',evidence:x.texts[2]}];expect(()=>validate(declaration(),x)).toThrow('target_not_pending_visible_change');});
  it('refuses a change already written before the instant',()=>{const x=specimen();x.moments.frames[2].depicted.evidence='Meanwhile the beacon turned blue.';expect(()=>validate(declaration(),x)).toThrow('target_not_pending_visible_change');});
  it('cannot invent a state value, model verdict, or extra protocol key',()=>{
    const d=declaration();d.frames[2].changes[0].value='giant';expect(()=>sourceConcurrencySchema.parse(d)).toThrow();
    delete d.frames[2].changes[0].value;d.accepted=true;expect(()=>sourceConcurrencySchema.parse(d)).toThrow();
  });
  it('binds relation targets as well as attributes, with no free relation override',()=>{
    const x=specimen();x.sequence.pages[1].transitions=[{entityId:'child',from:{relation:'at',targetId:'bank'},to:{relation:'on',targetId:'bridge'},evidence:'Meanwhile the beacon turned blue.'}];
    x.plan.continuity.pages[2].changes=[];
    const d=declaration();d.frames[2].changes[0]={kind:'relation',entityId:'child',attribute:null,evidence:x.texts[2]};
    const v=validate(d,x);expect(drawnInstantGaps(x.moments,x.plan,x.sequence,x.texts,true,concurrencyKeys(v))).toEqual([]);
    d.frames[2].changes[0].attribute='color';expect(()=>validate(d,x)).toThrow();
  });
  it('does not exempt a different entity or another page',()=>{
    const x=specimen();x.plan.continuity.pages[2].changes.push({entityId:'lamp',attribute:'color',value:'blue',storyEvidence:'Meanwhile the beacon turned blue.'});x.plan.continuity.pages[2].visibleEntityIds.push('lamp');
    const v=validate(declaration(),x);expect(drawnInstantGaps(x.moments,x.plan,x.sequence,x.texts,true,concurrencyKeys(v))).toMatchObject([{entityId:'lamp'}]);
  });
  it('requires exact frame coverage and version',()=>{const d=declaration();d.frames.push({changes:[]});expect(()=>validate(d)).toThrow('coverage');d.version='future-unreviewed';expect(()=>validate(d)).toThrow();});
  it('has no language-keyword heuristic and still records only structural provenance',()=>{
    const x=specimen(),quote='At that very instant, the beacon changed to blue.';x.texts[2]='The child pulled the lever. '+quote;x.plan.continuity.pages[2].changes[0].storyEvidence=quote;
    expect(validate(declaration(quote),x).frames[2].changes[0].evidence).toBe(quote);
  });
});
