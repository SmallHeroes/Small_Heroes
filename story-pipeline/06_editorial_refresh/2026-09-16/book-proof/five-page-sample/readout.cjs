'use strict';
// Read-only paid evidence calculation; --write adds a standalone diagnostic reader.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {previewSha,previewStory,previewAccountedUsd}=require('../../../../../lib/local-story-preview.ts');
const repo=path.resolve(__dirname,'../../../../..');
const selected=process.argv.includes('--selected-props');
const root=path.join(repo,selected?'outputs/panda-five-page-selected-sample-20260919':'outputs/panda-five-page-sample-20260919');
const config=JSON.parse(fs.readFileSync(path.join(repo,selected?'outputs/panda-five-page-selected-input-20260919/config.json':'outputs/panda-five-page-input-20260919/config.json'),'utf8'));
const source=fs.readFileSync(path.join(repo,config.story.file),'utf8');
assert.equal(previewSha(source),config.story.sha);
const story=previewStory(source,config.childName,config.gender);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'sample-manifest.json'),'utf8'));
assert.equal(manifest.sourceSha,config.story.sha);assert.equal(manifest.planSha,config.plan.sha);
const inspect=dir=>{
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir).filter(n=>n.endsWith('.claim.json')).sort().map(name=>{
    const claim=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
    const resultFile=path.join(dir,name.replace('.claim.json','.result.json'));
    const result=fs.existsSync(resultFile)?JSON.parse(fs.readFileSync(resultFile,'utf8')):null;
    if(result)assert.equal(result.fingerprint,claim.fingerprint);
    return {step:name.replace('.claim.json',''),reserveUsd:claim.reserveUsd,
      outcome:result?'known':'unknown_reservation_retained',usage:result?.usage??null,
      model:result?.value?.model??null,serviceTier:result?.value?.serviceTier??null};
  });
};
const imageSteps=inspect(path.join(root,'steps')),qaSteps=inspect(path.join(root,'qa/steps'));
const pricing=JSON.parse(fs.readFileSync(path.join(__dirname,'PRICING.json'),'utf8'));
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const nominalImage=s=>{
  const u=s.usage,t=u?.input_tokens_details?.text_tokens,i=u?.input_tokens_details?.image_tokens,o=u?.output_tokens;
  if(s.model!=='gpt-image-2'||![t,i,o].every(integer)||t+i!==u.input_tokens)return null;
  const rates=pricing.perMillionTokens['gpt-image-2-standard'];
  return (t*rates.textInput+i*rates.imageInput+o*rates.imageOutput)/1e6;
};
const nominalQa=s=>{
  const u=s.usage,i=u?.input_tokens,c=u?.input_tokens_details?.cached_tokens,o=u?.output_tokens;
  if(!/^gpt-5\.5(?:-|$)/.test(s.model??'')||s.serviceTier!=='flex'||![i,c,o].every(integer)||c>i||i>=272000)return null;
  const rates=pricing.perMillionTokens['gpt-5.5-flex-below-272k'];
  return ((i-c)*rates.input+c*rates.cachedInput+o*rates.output)/1e6;
};
for(const s of imageSteps)s.nominalUsageCostUsd=nominalImage(s);
for(const s of qaSteps)s.nominalUsageCostUsd=nominalQa(s);
const priced=[...imageSteps,...qaSteps];
const predecessor=selected?path.join(repo,'outputs/panda-five-page-sample-20260919'):null;
const oldImageSteps=predecessor?inspect(path.join(predecessor,'steps')):[],oldQaSteps=predecessor?inspect(path.join(predecessor,'qa/steps')):[];
for(const s of oldImageSteps)s.nominalUsageCostUsd=nominalImage(s);
for(const s of oldQaSteps)s.nominalUsageCostUsd=nominalQa(s);
const allPriced=[...priced,...oldImageSteps,...oldQaSteps];
const cost={method:'existing previewAccountedUsd: all measured input+output tokens at30USD/M; unknown outcomes keep full reservation',
  invoiceVerified:false,nominalInvoiceCost:null,
  pricing,nominalUsageEstimateUsd:priced.every(s=>s.nominalUsageCostUsd!==null)?priced.reduce((n,s)=>n+s.nominalUsageCostUsd,0):null,
  unpricedSteps:priced.filter(s=>s.nominalUsageCostUsd===null).map(s=>s.step),
  imageAccountedUpperUsd:previewAccountedUsd(path.join(root,'steps')),
  qaAccountedUpperUsd:previewAccountedUsd(path.join(root,'qa/steps')),
  imageBudgetUsd:config.imageBudgetUsd,qaBudgetUsd:config.qaBudgetUsd,imageSteps,qaSteps};
cost.totalAccountedUpperUsd=cost.imageAccountedUpperUsd+cost.qaAccountedUpperUsd;
cost.predecessor=predecessor?{root:path.relative(repo,predecessor),imageSteps:oldImageSteps,qaSteps:oldQaSteps,
  accountedUpperUsd:previewAccountedUsd(path.join(predecessor,'steps'))+previewAccountedUsd(path.join(predecessor,'qa/steps'))}:null;
cost.aggregateAccountedUpperUsd=cost.totalAccountedUpperUsd+(cost.predecessor?.accountedUpperUsd??0);
cost.aggregateKnownUsageEstimateUsd=allPriced.reduce((n,s)=>n+(s.nominalUsageCostUsd??0),0);
cost.aggregateUnpricedSteps=allPriced.filter(s=>s.nominalUsageCostUsd===null).map(s=>s.step);
cost.aggregateUnknownReservationUsd=allPriced.filter(s=>s.outcome==='unknown_reservation_retained').reduce((n,s)=>n+s.reserveUsd,0);
assert(cost.aggregateAccountedUpperUsd<=9.5+1e-8);
const pages=manifest.results.filter(r=>r.candidate).map(r=>{
  const candidate=r.candidate;assert.equal(previewSha(fs.readFileSync(path.join(root,candidate.imageName))),candidate.imageSha);
  for(const item of r.history??[])assert.equal(previewSha(fs.readFileSync(path.join(root,item.candidate.imageName))),item.candidate.imageSha);
  return {pageNumber:r.pageNumber,text:story.pages[r.pageNumber-1].text,imageName:candidate.imageName,
    imageSha:candidate.imageSha,status:r.status,history:r.history??[],error:r.error??null};
});
const report={title:story.title,pages,unassessed:manifest.unassessed,status:manifest.status,cost,
  scope:'Existing local owner-draft sample pipeline, not canonical contract/Blueprint/package qualification',
  canonicalCandidateHeld:true,productionReady:false,productAcceptance:'pending',audio:false};
if(process.argv.includes('--write')){
  const save=(name,bytes)=>{const f=path.join(root,name);if(fs.existsSync(f))assert.equal(fs.readFileSync(f,'utf8'),bytes);else fs.writeFileSync(f,bytes,{flag:'wx'});};
  save('readout.json',JSON.stringify(report,null,2)+'\n');
  const data=JSON.stringify(report).replace(/</g,'\\u003c');
  const html=`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>דגימת הפנדה · חמישה עמודים</title>
<style>*{box-sizing:border-box}body{margin:0;background:#e9e4d9;color:#24372f;font-family:Arial,sans-serif}header,footer{max-width:1400px;margin:auto;padding:18px 24px}h1{font-size:24px;margin:0 0 10px}.note{font-size:14px;line-height:1.7}main{max-width:1400px;margin:0 auto 24px;background:#fffaf1;display:grid;grid-template-columns:1.1fr .9fr;border-radius:14px;overflow:hidden;box-shadow:0 12px 40px #29382e18}.art{background:#dddacb;display:flex;align-items:center;justify-content:center}img{width:100%;height:78vh;object-fit:contain}.reading{padding:32px;display:flex;flex-direction:column;justify-content:center}#text{white-space:pre-line;font-size:22px;line-height:1.9}nav{display:flex;gap:12px;justify-content:space-between;margin-top:24px}button,select{padding:10px;border:1px solid #aaa;border-radius:8px;background:#fffaf1;font:inherit;cursor:pointer}button:disabled{opacity:.3}details{font-size:13px;line-height:1.6;margin-top:18px}#qa{white-space:pre-wrap;direction:ltr;text-align:left}.held{color:#963e24}.ok{color:#326642}@media(max-width:760px){main{display:block;margin:0 10px}img{height:52vh}.reading{padding:20px}#text{font-size:20px}}</style>
<header><h1 id="title"></h1><div class="note">דגימת איור מקומית · LOW · ללא קריינות · לא מאושרת לפרסום<br>בדיקה אוטומטית אינה אישור מוצר. זו אינה הוכחת השלמה של מסלול הייצור.</div></header>
<main><div class="art"><img id="image" alt=""></div><section class="reading"><div id="number"></div><p id="text"></p><nav><button id="prev">הקודם</button><select id="select" aria-label="בחירת עמוד"></select><button id="next">הבא</button></nav><details><summary id="status"></summary><div id="qa"></div></details></section></main><footer id="cost" class="note"></footer>
<script>const book=${data};const $=id=>document.getElementById(id);let current=0;$('title').textContent=book.title;for(const p of book.pages){const o=document.createElement('option');o.value=book.pages.indexOf(p);o.textContent='עמוד '+p.pageNumber;$('select').append(o)}function show(i){if(!book.pages.length)return;current=Math.max(0,Math.min(book.pages.length-1,i));const p=book.pages[current];$('image').src=p.imageName;$('image').alt='איור לעמוד '+p.pageNumber;$('text').textContent=p.text;$('number').textContent='עמוד '+p.pageNumber+' · מתוך דגימה מתוכננת של 5';$('select').value=current;$('prev').disabled=current===0;$('next').disabled=current===book.pages.length-1;$('status').textContent=p.status==='passed'?'QA אוטומטי עבר · לא אישור מוצר':'העמוד מוחזק · פתיחת ממצאים';$('status').className=p.status==='passed'?'ok':'held';$('qa').textContent=JSON.stringify({status:p.status,error:p.error,attempts:p.history.map(h=>({image:h.candidate.imageName,checks:h.review.checks}))},null,2);history.replaceState(null,'','#page-'+p.pageNumber)}$('prev').onclick=()=>show(current-1);$('next').onclick=()=>show(current+1);$('select').onchange=e=>show(Number(e.target.value));document.addEventListener('keydown',e=>{if(e.target.tagName==='SELECT')return;if(e.key==='ArrowLeft')show(current+1);if(e.key==='ArrowRight')show(current-1)});$('cost').textContent='חשבון שמרני לפי שימוש: $'+book.cost.totalAccountedUpperUsd.toFixed(4)+' · זה אינו חיוב חשבונית מאומת. תקרת הסבב: $9.50. '+(book.unassessed.length?'טרם נבדקו עמודים: '+book.unassessed.join(', '):'כל חמשת העמודים נבדקו.');show(Math.max(0,book.pages.findIndex(p=>p.pageNumber===Number(location.hash.replace('#page-','')))));</script></html>`;
  save('index.html',html.replace('book.cost.totalAccountedUpperUsd.toFixed(4)','book.cost.aggregateAccountedUpperUsd.toFixed(4)')
    .replace('חשבון שמרני לפי שימוש:', 'חשבון שמרני כולל הניסיון הקודם והרזרבה הלא פתורה:'));
}
console.log(JSON.stringify({status:report.status,renderedPages:pages.map(p=>p.pageNumber),
  pageStatuses:pages.map(p=>({page:p.pageNumber,status:p.status})),unassessed:report.unassessed,
  imageCalls:imageSteps.length,qaCalls:qaSteps.length,accountedUpperUsd:cost.totalAccountedUpperUsd,
  invoiceVerified:false,reader:path.join(root,'index.html')},null,2));
