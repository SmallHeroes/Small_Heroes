import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { EngineReaderPorts } from './reader-http';
import { engineOperatorIds, loadEngineReaderBook } from './reader';
import { engineHttpGuard, readEngineJson } from './order-http';
import { engineFulfillmentEnabled, decideEngineBook, type EngineFulfillmentPorts, ENGINE_BOOK_SCOPE } from './fulfillment';
import { readEngineLaunchPolicy, changeEngineLaunchPolicy } from './launch-policy';
import { readEngineOperatorHistory } from './operator-review-store';
import { operatorDecisionDigest, policyDigest } from './delivery-gate';
import { identifierSchema, digestSchema } from './contract';
import { readEngineInfrastructureReview,decideEngineInfrastructure,infrastructureActionSchema } from './infrastructure-review';
import {listEngineOperatorNotices} from './operator-notices';
import {assertEnginePrivateDatabase} from './private-assets';
import {clearEnginePaymentProofRefusal,dismissEnginePaymentNotice,paymentNoticeDismissSchema} from './payment-proof-alert';
const decisionSchema = z.object({ expectedBookSha256: digestSchema, expectedPreviousDecisionSha256: digestSchema.nullable(),
  expectedPolicySha256: digestSchema, idempotencyKey: identifierSchema, decision: z.enum(['approve', 'reject']), reason: z.string().trim().min(1).max(500) }).strict();
const policyCommand = z.object({ idempotencyKey: identifierSchema, expectedPolicySha256: digestSchema, mode: z.enum(['required', 'off']),
  reason: z.string().trim().min(1).max(500) }).strict();
export type EngineOperatorPorts = EngineReaderPorts & { fulfillment: () => EngineFulfillmentPorts; fulfillmentEnabled?: boolean };
async function actor(req: NextRequest, ports: EngineOperatorPorts) {
  if (!(ports.fulfillmentEnabled ?? engineFulfillmentEnabled())) return null;
  const user = await ports.parent(req); return user && (ports.operatorIds ?? engineOperatorIds()).includes(user.id) ? user.id : null;
}
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
export async function handleEngineOperator(req: NextRequest, orderId: string | null, ports: EngineOperatorPorts) {
  const actorId = await actor(req, ports); if (!actorId) return NextResponse.json({ error: 'not_found' }, { status: 404, headers });
  if (req.method === 'POST') { const denied = engineHttpGuard(req, 'engine-site-operator'); if (denied) return denied; }
  try {
    if(req.method==='GET'&&req.nextUrl.searchParams.get('view')==='cases') {
      await assertEnginePrivateDatabase(ports.db);
      const closed=await ports.db.$queryRaw<Array<{id:string}>>`SELECT DISTINCT o.id FROM "Order" o JOIN "ExceptionCase" e ON e."orderId"=o.id WHERE o."frozenProductVersion"='engine-site/v1' AND o.status::text NOT IN ('draft','pending_payment') AND e.scope LIKE 'engine_site_payment_proof/%' AND e."activeKey" IS NOT NULL LIMIT 100`;
      for(const row of closed)await clearEnginePaymentProofRefusal(ports.db,row.id,'');
      return NextResponse.json({cases:await listEngineOperatorNotices(ports.db,orderId)},{headers});
    }
    if (!orderId) {
      const policy = req.method === 'POST' ? await changeEngineLaunchPolicy(ports.db, policyCommand.parse(await readEngineJson(req, 8192)), actorId)
        : await readEngineLaunchPolicy(ports.db);
      return NextResponse.json({ policy, policySha256: policyDigest(policy) }, { headers });
    }
    if (req.method === 'POST') {
      const body=await readEngineJson(req,8192);
      if(body&&typeof body==='object'&&'action' in body&&body.action==='dismiss_payment_notice'){
        await assertEnginePrivateDatabase(ports.db);return NextResponse.json(await dismissEnginePaymentNotice(ports.db,orderId,paymentNoticeDismissSchema.parse(body),actorId),{headers});}
      if(body&&typeof body==='object'&&'action' in body)return NextResponse.json(await decideEngineInfrastructure(ports.db,orderId,
        infrastructureActionSchema.parse(body),actorId),{headers});
      return NextResponse.json(await decideEngineBook(ports.db, orderId,decisionSchema.parse(body), actorId, ports.fulfillment()), { headers });
    }
    await clearEnginePaymentProofRefusal(ports.db,orderId,'');
    const paymentCases=(await listEngineOperatorNotices(ports.db,orderId)).filter(notice=>notice.domain==='payment');
    const infrastructure=await readEngineInfrastructureReview(ports.db,orderId);
    if(infrastructure)return NextResponse.json({...infrastructure,paymentCases},{headers});
    let context:Awaited<ReturnType<typeof loadEngineReaderBook>>;
    try{context=await loadEngineReaderBook(ports.db,ports.storage(),orderId);}catch(error){if(paymentCases.length)return NextResponse.json({kind:'payment_proof',orderId,cases:paymentCases},{headers});throw error;}
    const policy = await readEngineLaunchPolicy(ports.db);
    const history = await readEngineOperatorHistory(ports.db, context.checkpoint.authority), previous = history[history.length - 1];
    const readiness = await ports.db.bookReadiness.findUnique({ where: { orderId_scope: { orderId, scope: ENGINE_BOOK_SCOPE } } });
    return NextResponse.json({ kind:'book',paymentCases,orderId, bookSha256: context.bookSha256, policy, policySha256: policyDigest(policy),
      previousDecisionSha256: previous ? operatorDecisionDigest(previous) : null, history,
      readiness: readiness?.status ?? 'pending', holdReason: context.order.deliveryHoldReason,
      previewUrl: `/personal/book/${encodeURIComponent(orderId)}?preview=1`,
      pdfUrl: `/api/engine-site/v1/books/${encodeURIComponent(orderId)}/assets/${context.book.pdf.assetId}?preview=1` }, { headers });
  } catch { return NextResponse.json({ error: 'engine_operator_conflict_or_unavailable' }, { status: 409, headers }); }
}
