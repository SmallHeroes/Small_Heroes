import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { engineSiteFail, ENGINE_SITE_PROTOCOL } from './contract';
import { engineSiteCheckoutPricing } from './offer';
import { assertEnginePrivateDatabase } from './private-assets';
import { ENGINE_QA_FAKE_PROVIDER, engineQaFakePaymentId, engineQaScope, isEngineQaOrder } from './qa-order-policy';

/**
 * QA-only simulated payment. Exists only inside a valid fake-payment QA scope (staging Preview, isolated database,
 * staging access gate, QA parent). It marks ONE fictional QA order paid exactly once; no PayMe call, no money,
 * no refund liability. The book then runs on the same engine, meter and gates as a paid customer order.
 */
export async function confirmEngineQaFakePayment(db: PrismaClient, orderId: string, parentId: string) {
  const qa = engineQaScope();
  if (!qa || qa.payment !== 'fake') engineSiteFail('engine_qa_fake_payment_unavailable');
  if (parentId !== qa.parentId) engineSiteFail('engine_qa_parent_required');
  await assertEnginePrivateDatabase(db);
  return db.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    if (rows.length !== 1) engineSiteFail('engine_order_missing');
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { wizardSession: { select: { sessionId: true } } } });
    if (order.frozenProductVersion !== ENGINE_SITE_PROTOCOL || !engineSiteCheckoutPricing(order) ||
        !isEngineQaOrder(qa, order, order.wizardSession?.sessionId)) engineSiteFail('engine_qa_order_scope_required');
    const paymentId = engineQaFakePaymentId(order.id);
    if (order.paymentProvider === ENGINE_QA_FAKE_PROVIDER && order.paymentId === paymentId && ['paid', 'generating', 'ready', 'needs_human_qa', 'failed'].includes(order.status))
      return { status: 'already_paid' as const, orderId };
    if (!['draft', 'pending_payment'].includes(order.status) || order.paymentProvider !== null && order.paymentProvider !== ENGINE_QA_FAKE_PROVIDER ||
        order.paymeTransactionId !== null || order.paymentId !== null && order.paymentId !== paymentId) engineSiteFail('engine_qa_fake_payment_state');
    await tx.order.update({ where: { id: orderId }, data: { status: 'paid', paymentProvider: ENGINE_QA_FAKE_PROVIDER, paymentId,
      checkoutAttemptToken: null, checkoutAttemptAt: null } });
    return { status: 'paid' as const, orderId };
  });
}
