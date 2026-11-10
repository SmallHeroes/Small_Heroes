/** No provider/key access on the default preflight path. Existing response only after explicit new GO. */
import 'server-only';
import path from 'node:path';
import {mkdirSync} from 'node:fs';
import {captureLocalPendingResponse,pendingSettlementSpecSchema,pendingPinned,pendingRefSchema} from '@/lib/engine-site/local-pending-capture';
import {admitPendingSettlementExecution,collectExistingPendingResponse} from '@/lib/engine-site/local-pending-settlement';
import {localEngineGrantSchema,localEngineSecret} from './engine-local-book';
import {engineSiteFail} from '@/lib/engine-site/contract';

export async function localPendingSettlementCLI(argv:string[]){
 if(argv[0]!=='--spec'||argv[2]!=='--spec-sha'||![4,9].includes(argv.length))engineSiteFail('pending_arguments');
 const ref=pendingRefSchema.parse({file:argv[1],sha256:argv[3]}),spec=pendingSettlementSpecSchema.parse(pendingPinned(ref));
 const cap=await captureLocalPendingResponse(spec);
 if(argv.length===4){console.log(JSON.stringify({status:'pending_settlement_preflight',binding:cap.binding,sourceHead:spec.sourceHead,
  providerRequests:0,keyReads:0,activationWrites:0,executionAuthorized:false,styleApproved:false,bookAccepted:false}));return 0;}
 if(argv[4]!=='--go'||argv[6]!=='--go-sha'||argv[8]!=='--execute')engineSiteFail('pending_arguments');
 const approval=pendingRefSchema.parse({file:argv[5],sha256:argv[7]}),permit=admitPendingSettlementExecution(cap,approval);
 const grant=localEngineGrantSchema.parse(pendingPinned(spec.parentGrant));
 mkdirSync(path.dirname(spec.directory),{recursive:true,mode:0o700});
 const result=await collectExistingPendingResponse(cap,permit,{fetch,key:()=>localEngineSecret(grant,'OPENAI_API_KEY')});
 console.log(JSON.stringify(result));return 0;
}
