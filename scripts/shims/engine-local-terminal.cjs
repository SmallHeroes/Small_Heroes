'use strict';

/** Pure operational completion check. Does not approve content, read assets, mutate a journal or release a reserve. */
function classifyLocalBookExit(input){
 const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),integer=x=>Number.isSafeInteger(x)&&x>=0;
 const native=object(input?.native)?input.native:{},terminal=input?.terminal,expected=object(input?.expected)?input.expected:{};
 const incomplete=reason=>({supervisorExitCode:1,completionStatus:'incomplete',completionReason:reason});
 if(native.code!==0||native.signal!=null||native.errorCode!==undefined)return{
  supervisorExitCode:Number.isSafeInteger(native.code)&&native.code>0&&native.code<=255?native.code:1,
  completionStatus:'native_failed',completionReason:'native_exit_failure'};
 if(input?.terminalState!=='record')return incomplete(input?.terminalState==='missing'?'terminal_missing':'terminal_unreadable');
 if(!object(terminal))return incomplete('terminal_invalid');
 if(!/^[a-f0-9]{64}$/.test(expected.grantSha256??'')||!/^[a-f0-9]{40}$/.test(expected.sourceRevision??'')||
    typeof expected.readerId!=='string'||!expected.readerId||!integer(expected.maximumMicroUsd)||expected.maximumMicroUsd===0||
    !integer(expected.maximumCalls)||expected.maximumCalls===0)return incomplete('expected_binding_invalid');
 if(terminal.version!=='engine-local-book-outcome/v1'||terminal.status!=='automated_supported_internal_review_pending'||
    terminal.grantSha256!==expected.grantSha256||terminal.sourceRevision!==expected.sourceRevision||terminal.fictional!==true||
    terminal.admittedFrames!==9||terminal.reader?.url!=='http://127.0.0.1:3482/dev/local-reader?book='+encodeURIComponent(expected.readerId)||
    terminal.productAccepted!==false||terminal.productionQualified!==false)return incomplete('terminal_binding_changed');
 const meter=terminal.meter;
 if(!object(meter)||!['accountedMicroUsd','knownEstimateMicroUsd','logicalCalls','carriedMicroUsd','carriedCalls'].every(k=>integer(meter[k]))||
    meter.accountedMicroUsd!==meter.knownEstimateMicroUsd||meter.accountedMicroUsd>expected.maximumMicroUsd||meter.logicalCalls>expected.maximumCalls||
    meter.accountedMicroUsd<meter.carriedMicroUsd||meter.logicalCalls<meter.carriedCalls||meter.blocked!==false||
    ['pendingCalls','unknownCalls','failedCalls','overReservedCalls','lostLocalCalls'].some(k=>meter[k]!==0))return incomplete('terminal_unsettled_or_over_cap');
 if((expected.carriedMicroUsd!==undefined&&meter.carriedMicroUsd!==expected.carriedMicroUsd)||
    (expected.carriedCalls!==undefined&&meter.carriedCalls!==expected.carriedCalls))return incomplete('terminal_carry_changed');
 return{supervisorExitCode:0,completionStatus:'terminal_outcome_recorded',completionReason:'bound_settled_internal_outcome'};
}

module.exports={classifyLocalBookExit};
