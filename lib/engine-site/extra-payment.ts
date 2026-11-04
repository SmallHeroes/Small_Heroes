import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { canonicalHash } from '@/lib/canonical-json';
import { lockOrderForExceptionCase, openExceptionCase } from '@/lib/generation-chunked/exception-case';
import { engineSiteFail } from './contract';
import { ENGINE_BOOK_SCOPE } from './lifecycle-config';
const saleHash = (id: string) => createHash('sha256').update(id).digest('hex');
export const ENGINE_EXTRA_PAYMENT_PREFIX = 'engine_site_extra_payment/';
/** Caller must have verified get-sales sale id/order/amount/currency, never a callback status alone. */
export async function recordEngineUnexpectedCapture(tx: Prisma.TransactionClient, order: { id: string; totalPrice: number }, saleId: string, primaryFailed = false) {
  const lock = await lockOrderForExceptionCase(tx, order.id); if (!lock) engineSiteFail('engine_order_missing');
  const scope = primaryFailed ? ENGINE_BOOK_SCOPE : `${ENGINE_EXTRA_PAYMENT_PREFIX}${saleHash(saleId)}`;
  const operationKey = `engine-site/v1/${order.id}/captured-sale/${saleHash(saleId)}`;
  const binding = { version: 'engine-site-unexpected-capture/v1', orderId: order.id, saleId, amountAgorot: order.totalPrice, currency: 'ILS', scope };
  const payloadHash = canonicalHash(binding);
  const receipt = await tx.atomicOperationReceipt.upsert({ where: { operationKey }, create: { operationKey, orderId: order.id,
    kind: 'engine_site_unexpected_capture_v1', payloadHash, result: { value: binding } }, update: {} });
  if (receipt.payloadHash !== payloadHash || canonicalHash((receipt.result as any)?.value) !== payloadHash) engineSiteFail('engine_extra_payment_receipt_changed');
  const c = await openExceptionCase(tx, { orderId: order.id, scope, kind: 'integrity_blocked', reason: 'engine_unexpected_paid_capture',
    initialStatus: 'refund_pending', nextActionAt: new Date(), sourceRef: operationKey }, lock);
  const previous = c.resolution && typeof c.resolution === 'object' && !Array.isArray(c.resolution) ? c.resolution : {};
  await tx.exceptionCase.update({ where: { id: c.id }, data: { resolution: { ...previous, capturedSaleReceipt: operationKey } } });
}
/** The processor obtains the sale from a server-only immutable receipt, never from a mutable case string alone. */
export async function engineExceptionRefundSale(db: PrismaClient, c: { orderId: string; scope: string; resolution: unknown }) {
  const key = (c.resolution as { capturedSaleReceipt?: unknown } | null)?.capturedSaleReceipt;
  if (typeof key !== 'string') {
    if (c.scope.startsWith(ENGINE_EXTRA_PAYMENT_PREFIX)) engineSiteFail('engine_extra_payment_receipt_missing');
    return null;
  }
  const receipt = await db.atomicOperationReceipt.findUnique({ where: { operationKey: key } }), b = (receipt?.result as any)?.value;
  if (!receipt || receipt.orderId !== c.orderId || receipt.kind !== 'engine_site_unexpected_capture_v1' || !b ||
    b.version !== 'engine-site-unexpected-capture/v1' || b.orderId !== c.orderId || typeof b.saleId !== 'string' || !b.saleId ||
    b.scope !== c.scope || b.currency !== 'ILS' || !Number.isSafeInteger(b.amountAgorot) || b.amountAgorot <= 0 ||
    receipt.payloadHash !== canonicalHash(b) || key !== `engine-site/v1/${c.orderId}/captured-sale/${saleHash(b.saleId)}` ||
    c.scope !== ENGINE_BOOK_SCOPE && c.scope !== `${ENGINE_EXTRA_PAYMENT_PREFIX}${saleHash(b.saleId)}`) engineSiteFail('engine_extra_payment_receipt_changed');
  return b.saleId as string;
}
