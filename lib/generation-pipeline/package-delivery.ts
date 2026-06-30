import type { Order, PrismaClient } from '@prisma/client';
import { sendBookReadyEmail } from '@/backend/lib/email';
import { createLogger } from '@/lib/logger';
import {
  commitBaseBookReadiness,
  isReadinessManifestEnabled,
  type CommitResult,
} from './readiness-manifest';

const log = createLogger({ subsystem: 'package-delivery' });

export interface PackageDeliveryGate {
  held: boolean;
  orderStatus: Order['status'];
  reason: string | null;
  sendBookReadyEmail: boolean;
}

export interface PackageDeliveryResult {
  mode: 'legacy' | 'manifest';
  deliveryHeld: boolean;
  manifest: CommitResult | null;
}

interface PackageDeliveryDeps {
  readinessEnabled?: () => boolean;
  commit?: typeof commitBaseBookReadiness;
  send?: typeof sendBookReadyEmail;
  now?: () => Date;
}

/**
 * Finalize package delivery at the single package boundary.
 * Flag-on: Manifest + readiness + Outbox only; never a direct email.
 * Flag-off: preserve the legacy status/job/direct-email behavior exactly.
 */
export async function finalizePackageDelivery(
  prisma: PrismaClient,
  args: {
    order: Pick<Order, 'id' | 'customerEmail' | 'customerName' | 'childName'>;
    deliveryGate: PackageDeliveryGate;
    readUrl: string;
    pdfUrl: string | null;
    firstAudioUrl: string | null;
  },
  deps: PackageDeliveryDeps = {},
): Promise<PackageDeliveryResult> {
  const readinessEnabled = deps.readinessEnabled ?? isReadinessManifestEnabled;
  if (readinessEnabled()) {
    const commit = deps.commit ?? commitBaseBookReadiness;
    const manifest = await commit(prisma, {
      orderId: args.order.id,
      anchorAllowsDelivery: args.deliveryGate.sendBookReadyEmail,
      anchorOrderStatus: args.deliveryGate.orderStatus,
      anchorReason: args.deliveryGate.reason,
    });
    return {
      mode: 'manifest',
      deliveryHeld: manifest.orderStatus !== 'ready',
      manifest,
    };
  }

  const completedAt = deps.now?.() ?? new Date();
  await prisma.order.update({
    where: { id: args.order.id },
    data: {
      status: args.deliveryGate.orderStatus,
      packageStatus: 'done',
      deliveryHoldReason: args.deliveryGate.reason,
    },
  });
  await prisma.generationJob.update({
    where: { orderId: args.order.id },
    data: {
      status: 'done',
      currentStage: 'done',
      completedAt,
      packaged: true,
    },
  });

  if (!args.deliveryGate.sendBookReadyEmail) {
    log.warn('Book-ready email withheld — order held for human QA', {
      orderId: args.order.id,
      reason: args.deliveryGate.reason,
    });
  } else {
    try {
      const send = deps.send ?? sendBookReadyEmail;
      await send({
        to: args.order.customerEmail,
        customerName: args.order.customerName ?? args.order.childName,
        childName: args.order.childName,
        readUrl: args.readUrl,
        audioUrl: args.firstAudioUrl ?? undefined,
        pdfUrl: args.pdfUrl ?? undefined,
      });
    } catch (error) {
      log.error('Ready email failed (non-fatal)', error, { orderId: args.order.id });
    }
  }

  return {
    mode: 'legacy',
    deliveryHeld: args.deliveryGate.held,
    manifest: null,
  };
}
