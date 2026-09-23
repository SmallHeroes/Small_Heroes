'use strict';
// Offline evidence/readout only. Never edits checkpoints or infers product acceptance.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
require('../../../../../scripts/shims/register-server-only.cjs');require('tsx/cjs');
const {previewAccountedUsd,previewSha,previewStory}=require('../../../../../lib/local-story-preview.ts');
const repo=path.resolve(__dirname,'../../../../..');
globalThis.fetch=()=>{throw Error('offline_provider_forbidden');};
const output='outputs/panda-sequence-pair-sample-20260923',root=path.join(repo,output);
const read=rel=>JSON.parse(fs.readFileSync(path.join(repo,rel),'utf8'));
const config=read('outputs/panda-sequence-pair-input-20260923/config.json');
const execution=read('outputs/panda-sequence-pair-execution-20260923/execution.json');
assert.equal(execution.preserved,true);assert(!fs.existsSync(path.join(root,'run.lock')));
const source=fs.readFileSync(path.join(repo,config.story.file),'utf8');assert.equal(previewSha(source),config.story.sha);
const story=previewStory(source,config.childName,config.gender),manifest=read(output+'/sample-manifest.json');
assert.equal(manifest.sourceSha,config.story.sha);assert.equal(manifest.planSha,config.plan.sha);assert.deepEqual(manifest.samplePages,[1,2]);
const {loadOwnerDraft,ownerDraftPagePrompt,selectedDraftQaContext}=require('../../../../../scripts/run-owner-book-draft.ts');
const {sequencePagePacket,sequenceRenderPrompt}=require('../../../../../lib/local-book-sequence.ts');
const {PREVIEW_QUALITY_VERSION,qualityDisposition}=require('../../../../../lib/local-preview-quality.ts');
const {plan,sequence}=loadOwnerDraft(repo,config),completed=[];
for(const row of manifest.results){
  const n=row.pageNumber,step='page-'+String(n).padStart(2,'0'),packet=sequencePagePacket(sequence,plan,n,completed);
  const request=read(output+'/'+step+'.request.json');assert.deepEqual(request.sequence,packet);
  assert.equal(request.prompt,sequenceRenderPrompt(ownerDraftPagePrompt(plan,n,story.pages[n-1].text,config.childAge,config.gender,config.companionDescription),packet,n===2?4:null));
  const refs=['reference-1.png','reference-2.png','prop-reference-'+String(n).padStart(2,'0')+'.png',...(n===2?['page-01.png']:[])];
  assert.deepEqual(request.references,refs.map(f=>previewSha(fs.readFileSync(path.join(root,f)))));
  const imageRecord=read(output+'/steps/'+step+'.result.json');assert.equal(imageRecord.value.referencesPassed,refs.length);
  assert.equal(imageRecord.fingerprint,previewSha(JSON.stringify({version:'owner-book-draft/v1',model:'gpt-image-2',quality:'low',size:'1024x1536',prompt:request.prompt,refs:request.references})));
  const context={selectedPlan:selectedDraftQaContext(plan,n),sequence:packet,pageNumber:n,text:story.pages[n-1].text,
    priorPages:completed.map(p=>({pageNumber:p.pageNumber,text:story.pages[p.pageNumber-1].text,imageName:p.candidate.imageName,imageSha:p.candidate.imageSha,
      automatedPassed:false,score:null,reason:'editorial_draft_visual_and_numerical_qa_not_accepted'})),calibrationStatus:'not_established',purpose:'diagnostic_only'};
  if(row.history?.length){
    assert.equal(row.contextSha,previewSha(JSON.stringify({version:PREVIEW_QUALITY_VERSION,context})));
    const decision=qualityDisposition(row.history[0].review,row.candidate.imageSha,row.contextSha);
    assert.equal(row.status,decision.disposition==='repair'?'held_repair_limit':decision.disposition);
  }
  completed.push(row);
}
const pricing=read('story-pipeline/06_editorial_refresh/2026-09-16/book-proof/five-page-sample/PRICING.json');
function inspect(rel){
  const rows=[];
  for(const kind of ['image','qa']){
    const dir=path.join(repo,rel,kind==='image'?'steps':'qa/steps');if(!fs.existsSync(dir))continue;
    for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.claim.json')).sort()){
      const claim=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')),file=path.join(dir,name.replace('.claim.json','.result.json'));
      const result=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;if(result)assert.equal(result.fingerprint,claim.fingerprint);
      const u=result?.usage,m=result?.value?.model,tier=result?.value?.serviceTier;let nominal=null;
      const valid=xs=>xs.every(n=>Number.isSafeInteger(n)&&n>=0);
      if(kind==='image'&&m==='gpt-image-2'){
        const t=u?.input_tokens_details?.text_tokens,i=u?.input_tokens_details?.image_tokens,o=u?.output_tokens;
        if(valid([t,i,o])&&t+i===u.input_tokens){const r=pricing.perMillionTokens['gpt-image-2-standard'];nominal=(t*r.textInput+i*r.imageInput+o*r.imageOutput)/1e6;}
      }else if(kind==='qa'&&/^gpt-5\.5(?:-|$)/.test(m??'')&&tier==='flex'){
        const i=u?.input_tokens,c=u?.input_tokens_details?.cached_tokens,o=u?.output_tokens;
        if(valid([i,c,o])&&c<=i&&i<272000){const r=pricing.perMillionTokens['gpt-5.5-flex-below-272k'];nominal=((i-c)*r.input+c*r.cachedInput+o*r.output)/1e6;}
      }
      rows.push({root:rel,step:name.replace('.claim.json',''),kind,outcome:result?'known':'unknown_reservation_retained',
        reserveUsd:claim.reserveUsd,model:m??null,serviceTier:tier??null,usage:u??null,nominalUsageEstimateUsd:nominal});
    }
  }
  return rows;
}
const fresh=inspect(output),historical=['outputs/panda-five-page-sample-20260919','outputs/panda-five-page-selected-sample-20260919'].flatMap(inspect);
const sum=rows=>rows.reduce((n,r)=>n+(r.nominalUsageEstimateUsd??0),0);
const cost={invoiceVerified:false,pricingSnapshot:pricing,newKnownUsageEstimateUsd:sum(fresh),newUnpricedSteps:fresh.filter(r=>r.nominalUsageEstimateUsd===null).map(r=>r.step),
  newAccountedUpperUsd:previewAccountedUsd(path.join(root,'steps'))+previewAccountedUsd(path.join(root,'qa/steps')),
  aggregateAccountedUpperUsd:execution.aggregateAccountedUpperUsd,aggregateKnownUsageEstimateUsd:sum([...historical,...fresh]),
  aggregateUnknownReservationUsd:[...historical,...fresh].filter(r=>r.outcome==='unknown_reservation_retained').reduce((n,r)=>n+r.reserveUsd,0),steps:fresh};
assert(Math.abs(cost.newAccountedUpperUsd-execution.newAccountedUpperUsd)<1e-8);
const pages=manifest.results.filter(r=>r.candidate).map(r=>{
  assert.match(r.candidate.imageName,/^page-\d{2}\.png$/);assert.equal(previewSha(fs.readFileSync(path.join(root,r.candidate.imageName))),r.candidate.imageSha);
  return {...r,text:story.pages[r.pageNumber-1].text};
});
const report={title:story.title,status:manifest.status,pages,unassessed:manifest.unassessed,cost,execution,productionReady:false,productAcceptance:'pending',audio:false,
  scope:'local diagnostic pair only; not five completed pages, production qualification or semantic entailment proof'};
if(process.argv.includes('--write')){
  const save=(name,data)=>{const file=path.join(root,name);if(fs.existsSync(file))assert.equal(fs.readFileSync(file,'utf8'),data);else fs.writeFileSync(file,data,{flag:'wx'});};
  save('readout.json',JSON.stringify(report,null,2)+'\n');
  const data=JSON.stringify(report).replace(/</g,'\\u003c');
  save('index.html',`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>בדיקת רציפות · הפנדה</title>
<style>*{box-sizing:border-box}body{margin:0;background:#e9e4d9;color:#24372f;font-family:Arial,sans-serif}header,footer{max-width:1400px;margin:auto;padding:18px 24px;line-height:1.6}h1{font-size:24px;margin:0}main{max-width:1400px;margin:auto;background:#fffaf1;display:grid;grid-template-columns:1.1fr .9fr;border-radius:14px;overflow:hidden}img{width:100%;height:78vh;object-fit:contain}.reading{padding:32px;align-self:center}#text{white-space:pre-line;font-size:22px;line-height:1.9}nav{display:flex;gap:16px}button{padding:12px;border:1px solid #aaa;border-radius:8px;background:#fffaf1;font:inherit}button:disabled{opacity:.4}details{margin-top:20px;font-size:14px;line-height:1.6}pre{direction:ltr;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:760px){main{display:block;margin:0 10px}img{height:52vh}.reading{padding:20px}#text{font-size:20px}}</style>
<header><h1 id="title"></h1><div>בדיקת רציפות בין עמודים 1–2 · LOW · ללא קריינות · לא מאושר לפרסום</div><div id="state"></div></header>
<main><img id="image" alt=""><section class="reading"><div id="number"></div><p id="text"></p><nav><button id="prev">הקודם</button><button id="next">הבא</button></nav><details><summary>ממצאי הבדיקה האוטומטית</summary><pre id="qa"></pre></details></section></main><footer id="cost"></footer>
<script>const book=${data};const $=id=>document.getElementById(id);let current=0;$('title').textContent=book.title;$('state').textContent=book.status==='sample_held'?'הדגימה מוחזקת. הבדיקה אינה אישור מוצר.':'הבדיקה האוטומטית עברה; אישור מוצר עדיין נדרש.';function show(i){if(!book.pages.length)return;current=Math.max(0,Math.min(book.pages.length-1,i));const p=book.pages[current];$('image').src=p.candidate.imageName;$('image').alt='עמוד '+p.pageNumber;$('text').textContent=p.text;$('number').textContent='עמוד '+p.pageNumber+' · '+p.status;$('prev').disabled=current===0;$('next').disabled=current===book.pages.length-1;$('qa').textContent=JSON.stringify({status:p.status,error:p.error,history:p.history},null,2);history.replaceState(null,'','#page-'+p.pageNumber)}$('prev').onclick=()=>show(current-1);$('next').onclick=()=>show(current+1);document.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')show(current+1);if(e.key==='ArrowRight')show(current-1)});$('cost').textContent='אומדן שימוש מדווח בסבב: $'+book.cost.newKnownUsageEstimateUsd.toFixed(4)+' לפי מחירון שמור מ־19.9.2026, לא חשבונית. חשבון שמרני כולל היסטוריה ורזרבה לא פתורה: $'+book.cost.aggregateAccountedUpperUsd.toFixed(4)+'. '+(book.unassessed.length?'לא רונדרו: '+book.unassessed.join(', '):'שני העמודים נבדקו.');show(Math.max(0,book.pages.findIndex(p=>p.pageNumber===Number(location.hash.replace('#page-','')))));</script></html>`);
}
console.log(JSON.stringify({status:report.status,pages:pages.map(p=>({page:p.pageNumber,status:p.status})),cost:{...cost,steps:undefined,pricingSnapshot:undefined}},null,2));
