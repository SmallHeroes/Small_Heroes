import 'server-only';
import type {Prisma} from '@prisma/client';
import {createLogger} from '@/lib/logger';
import {z} from 'zod';
import {canonicalHash} from '@/lib/canonical-json';
const logger=createLogger({subsystem:'engine-site-operator'});
const PREFIX='engine-site-operator-notice/v1/';
const noticeSchema=z.object({version:z.literal('engine-site-operator-notice/v1'),caseId:z.string(),orderId:z.string(),scope:z.string(),
  code:z.string(),domain:z.string(),createdAt:z.string(),updatedAt:z.string()}).strict();
/** Existing server-only state store is the operator inbox. It is not a customer email or an automatic financial action. */
export async function recordEngineOperatorNotice(tx:Prisma.TransactionClient,input:{caseId:string;orderId:string;scope:string;code:string;domain:string}) {
  const sessionId=PREFIX+input.caseId,prior=await tx.wizardSession.findUnique({where:{sessionId}}),parsed=noticeSchema.safeParse(prior?.data);
  const now=new Date().toISOString(),data=noticeSchema.parse({...input,version:'engine-site-operator-notice/v1',createdAt:parsed.success?parsed.data.createdAt:now,updatedAt:now});
  await tx.wizardSession.upsert({where:{sessionId},create:{sessionId,data},update:{data}});
  if(!prior)logger.warn('Engine operator case opened',{caseId:input.caseId,orderId:input.orderId,scope:input.scope,code:input.code,domain:input.domain});
}
export async function listEngineOperatorNotices(db:Pick<Prisma.TransactionClient,'$queryRaw'>,orderId:string|null=null) {
  const rows=await db.$queryRaw<Array<{data:unknown}>>`SELECT w.data FROM "WizardSession" w
    JOIN "ExceptionCase" e ON w."sessionId"='engine-site-operator-notice/v1/'||e.id
    JOIN "Order" o ON o.id=e."orderId"
    WHERE o."frozenProductVersion"='engine-site/v1' AND e."activeKey" IS NOT NULL
      AND e.status::text IN ('open','retry_scheduled') AND e.resolution->>'operatorRequired'='true'
      AND (${orderId}::text IS NULL OR e."orderId"=${orderId})
    ORDER BY e."createdAt" ASC,e.id ASC LIMIT 100`;
  return rows.flatMap(row=>{const parsed=noticeSchema.safeParse(row.data);return parsed.success?[{...parsed.data,noticeSha256:canonicalHash(parsed.data)}]:[];});
}
