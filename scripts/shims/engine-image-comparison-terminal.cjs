'use strict';
/** Pure comparison completion classification. Diagnostic completion is never book or product acceptance. */
function classify(exit,envelopeSha,outcome,stop,assetShas){
 const m=outcome&&outcome.meter;
 const cells=['C01','C02','C03','C04'],models=['gpt-image-2.6-sunburst','gpt-image-2.6-flare'],expected=[models[0],models[1],models[1],models[0]];
 const assets=Array.isArray(outcome?.imageRecords)&&outcome.imageRecords.length===4&&outcome.imageRecords.every((r,i)=>
  r.cell===cells[i]&&/^[a-f0-9]{64}$/.test(r.imageSha)&&assetShas?.[r.cell]===r.imageSha&&r.requestedModel===expected[i]&&
  (r.reportedModel===null||r.reportedModel===r.requestedModel));
 const scores=Array.isArray(outcome?.scores)&&outcome.scores.length===2&&new Set(outcome.scores.map(s=>s.model)).size===2&&
  outcome.scores.every(s=>models.includes(s.model)&&s.settled===true&&typeof s.supported==='boolean'&&Number.isSafeInteger(s.knownMicroUsd)&&s.knownMicroUsd>=0)&&
  outcome.scores.reduce((n,s)=>n+s.knownMicroUsd,0)===m?.knownEstimateMicroUsd;
 const complete=exit.code===0&&exit.signal===null&&outcome?.version==='image-comparison-outcome/v1'&&outcome.complete===true&&
  outcome.envelopeSha256===envelopeSha&&outcome.bookCreated===false&&outcome.productAccepted===false&&outcome.automaticBookAuthority===false&&
  m&&m.logicalCalls===14&&m.pendingCalls===0&&m.unknownCalls===0&&m.failedCalls===0&&m.overReservedCalls===0&&m.lostLocalCalls===0&&
  m.blocked===false&&Number.isSafeInteger(m.knownEstimateMicroUsd)&&m.knownEstimateMicroUsd>=0&&m.knownEstimateMicroUsd===m.accountedMicroUsd&&m.accountedMicroUsd<=2500000&&
  assets&&scores&&JSON.stringify(outcome.frames)==='[0,7]';
 return{diagnosticComplete:!!complete,bookAccepted:false,supervisorExitCode:complete?0:exit.code!==0&&Number.isInteger(exit.code)?exit.code:70,
  nativeExit:exit,stopRecorded:!!stop&&stop.envelopeSha256===envelopeSha,unknownReservationMayExist:!complete};
}
module.exports={classify};
