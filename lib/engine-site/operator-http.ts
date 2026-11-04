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
    if (!orderId) {
      const policy = req.method === 'POST' ? await changeEngineLaunchPolicy(ports.db, policyCommand.parse(await readEngineJson(req, 8192)), actorId)
        : await readEngineLaunchPolicy(ports.db);
      return NextResponse.json({ policy, policySha256: policyDigest(policy) }, { headers });
    }
    if (req.method === 'POST') return NextResponse.json(await decideEngineBook(ports.db, orderId,
      decisionSchema.parse(await readEngineJson(req, 8192)), actorId, ports.fulfillment()), { headers });
    const context = await loadEngineReaderBook(ports.db, ports.storage(), orderId), policy = await readEngineLaunchPolicy(ports.db);
    const history = await readEngineOperatorHistory(ports.db, context.checkpoint.authority), previous = history[history.length - 1];
    const readiness = await ports.db.bookReadiness.findUnique({ where: { orderId_scope: { orderId, scope: ENGINE_BOOK_SCOPE } } });
    return NextResponse.json({ orderId, bookSha256: context.bookSha256, policy, policySha256: policyDigest(policy),
      previousDecisionSha256: previous ? operatorDecisionDigest(previous) : null, history,
      readiness: readiness?.status ?? 'pending', holdReason: context.order.deliveryHoldReason,
      previewUrl: `/personal/book/${encodeURIComponent(orderId)}?preview=1`,
      pdfUrl: `/api/engine-site/v1/books/${encodeURIComponent(orderId)}/assets/${context.book.pdf.assetId}?preview=1` }, { headers });
  } catch { return NextResponse.json({ error: 'engine_operator_conflict_or_unavailable' }, { status: 409, headers }); }
}
