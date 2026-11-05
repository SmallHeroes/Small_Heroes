/** Offline proof only. No real provider, environment credentials, git index, patch application or service write. */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const historical=process.argv.includes('--baseline-m13');
const artifacts=historical?path.resolve(__dirname,'../m13-qa-r1-fixes'):__dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(artifacts, 'PROD-PAYME-HOTFIX.json'), 'utf8'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const baseline = file => cp.execFileSync('git', ['show', `${manifest.productionHead}:${file}`], { cwd: root, encoding: 'utf8', windowsHide: true });
const current = (historical?cp.execFileSync('git',['show','f4dd9d46:lib/payme.ts'],{cwd:root,encoding:'utf8',windowsHide:true}):fs.readFileSync(path.join(root,'lib/payme.ts'),'utf8')).replace(/\r\n/g,'\n');
const verifier = current.slice(current.indexOf('export async function verifyPaymePayment'),current.indexOf('export type PaymeSaleState'));
assert.equal(hash(verifier),manifest.verifierSha256);
assert.equal(hash(fs.readFileSync(path.join(artifacts,'PROD-PAYME-HOTFIX.patch'))),manifest.patchSha256);
const old = baseline('lib/payme.ts');
const planned = old.slice(0,old.indexOf('export async function verifyPaymePayment')) + verifier + old.slice(old.indexOf('export type PaymeSaleState'));
const oldReturn = baseline('app/api/payme/return/route.ts');
let plannedReturn=oldReturn;
for(const [before,after] of [
  ['Boolean(paymentIdFromQuery || transactionIdFromQuery || order.paymentId)','Boolean(order.paymentId)'],
  ['paymentId: paymentIdFromQuery || order.paymentId || undefined,\n        transactionId: transactionIdFromQuery || undefined,',"paymentId: order.paymentId || undefined,\n        amountAgorot: order.totalPrice,\n        currency: 'ILS',"],
  ['const resolvedPaymentId = transactionIdFromQuery || paymentIdFromQuery || order.paymentId || `payme_verified_${order.id}`;','const resolvedPaymentId = order.paymentId!;'],
  ["where: { id: order.id, status: { in: ['draft', 'pending_payment', 'failed'] } },","where: { id: order.id, paymentId: resolvedPaymentId, status: { in: ['draft', 'pending_payment', 'failed'] } },"],
]) {assert.ok(plannedReturn.includes(before));plannedReturn=plannedReturn.replace(before,after);}
if(!historical)plannedReturn=plannedReturn.replace("['draft', 'pending_payment', 'failed']","['draft', 'pending_payment']");
const plannedFiles={'lib/payme.ts':planned,'app/api/payme/return/route.ts':plannedReturn};
for(const file of manifest.files){assert.equal(hash(baseline(file)),manifest.baselineBlobs[file]);assert.equal(hash(plannedFiles[file]),manifest.plannedBlobs[file]);}
function load(source,modules,globals={}) {
  const exports={};
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code,{exports,module:{exports},Buffer,URL,URLSearchParams,Response,AbortSignal,
    process:{env:{PAYME_API_BASE_URL:'https://payme.example.invalid/api',PAYME_API_KEY:'SYNTHETIC_ONLY',NODE_ENV:'production'}},
    console:{error(){},warn(){},log(){}},require:name=>{if(name==='server-only')return {};if(name==='crypto')return crypto;if(name in modules)return modules[name];throw Error('external_module_forbidden:'+name);},...globals});
  return exports;
}
(async()=>{
  const sale={sale_payme_id:'sale_server',transaction_id:'order_synthetic',sale_price:5900,sale_currency:'ILS',sale_status:'completed'};
  const cases=[['exact',sale,true],['foreign_sale',{...sale,sale_payme_id:'other'},false],['foreign_order',{...sale,transaction_id:'other'},false],
    ['amount',{...sale,sale_price:1},false],['currency',{...sale,sale_currency:'USD'},false],['root_fallback',null,false],['duplicates','duplicates',false],
    ['string_amount',{...sale,sale_price:'5900'},true],['integer_decimal_string',{...sale,sale_price:'5900.00'},true],
    ['lowercase_currency',{...sale,sale_currency:'ils'},true],['alternate_currency',{...sale,sale_currency:undefined,currency:'ILS'},true],
    ['fractional_amount',{...sale,sale_price:'5900.01'},false],['invalid_amount',{...sale,sale_price:'5900oops'},false],
    ['truncated_order',{...sale,transaction_id:'x'.repeat(50)},true,'x'.repeat(70)]];
  const results=[];
  for(const [name,item,expected,orderId] of cases){
    const raw=item===null?{...sale,items:[]}:item==='duplicates'?{items:[sale,sale]}:{status_code:0,items:[item]};
    const api=load(planned,{}, {fetch:async(_url,init)=>{const body=JSON.parse(init.body);assert.equal(body.sale_payme_id,'sale_server');assert.equal(body.payme_sale_id,undefined);return new Response(JSON.stringify(raw));}});
    const actual=(await api.verifyPaymePayment({paymentId:'sale_server',transactionId:'browser_forgery',orderId:orderId??'order_synthetic',amountAgorot:5900,currency:'ILS'})).verified;
    results.push({name,passed:actual===expected,expected,actual});
  }
  for(const [valid,status] of [[true,'pending_payment'],[false,'pending_payment'],[true,'failed']]){
    const transitions=[];let triggers=0;
    const api=load(planned,{}, {fetch:async(_url,init)=>{assert.equal(JSON.parse(init.body).sale_payme_id,'sale_server');return new Response(JSON.stringify({items:[valid?sale:{...sale,transaction_id:'another_order'}]}));}});
    const tx={order:{updateMany:async command=>{const count=command.where.status.in.includes(status)&&command.where.paymentId==='sale_server'?1:0;if(count)transitions.push(command);return{count};}},paymentRecord:{upsert:async()=>{}}};
    const route=load(plannedReturn,{
      'next/server':{NextResponse:{redirect:url=>({location:url.href})}},
      '@/lib/prisma':{prisma:{order:{findUnique:async()=>({id:'order_synthetic',status,paymentId:'sale_server',paymentProvider:'payme',totalPrice:5900})},$transaction:async fn=>fn(tx)}},
      '@/lib/logger':{createLogger:()=>({info(){},warn(){},error(){}})},'@/lib/env':{env:{PAYMENT_PROVIDER:'payme',PAYME_REDIRECT_TRUST_MODE:false}},
      '@/lib/routes':{ROUTES:{wizard:'/wizard',generating:'/generating'}},'../../generate/route':{triggerGeneration:async()=>{triggers++;}},'@/lib/payme':api,
      '@/lib/coupon/coupon-service':{confirmCouponForOrder:async()=>null,couponConfirmFenceReason:async()=>null},
      '@/lib/human-qa/sync-hold-case':{syncHumanQaHoldCasePostCommit:async()=>{}},'@/lib/generation-pipeline/order-authority':{writeOrderHoldFenced:async()=>{throw Error('unexpected_hold');}},
    });
    await route.GET({nextUrl:new URL('https://app.example.invalid/api/payme/return?orderId=order_synthetic&transactionId=browser_forgery')});
    const expected=valid&&status==='pending_payment'?1:0;
    const passed=transitions.length===expected&&triggers===expected&&(!expected||transitions[0].data.paymeTransactionId==='sale_server');
    results.push({name:status==='failed'?'failed_return_cannot_revive':valid?'production_return_ignores_query':'production_return_refuses_foreign_proof',passed,transitions:transitions.length,triggers});
  }
  const tmp=path.join(__dirname,'synthetic-tmp','prod-hotfix',historical?'m13-original':'m14-original');
  for(const file of manifest.files){const target=path.join(tmp,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,baseline(file));}
  cp.execFileSync('git',['apply','--check','--directory='+path.relative(root,tmp).split(path.sep).join('/'),path.join(artifacts,'PROD-PAYME-HOTFIX.patch')],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
  const failures=results.filter(r=>!r.passed),result={mode:'synthetic VM transports and copied-baseline dry-run only',historicalM13:historical,
    productionHead:manifest.productionHead,passed:results.length-failures.length,failed:failures.length,results};
  fs.writeFileSync(path.join(__dirname,historical?'PROD-PAYME-HOTFIX-BASELINE-RED.json':'PROD-PAYME-HOTFIX-VALIDATION.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
