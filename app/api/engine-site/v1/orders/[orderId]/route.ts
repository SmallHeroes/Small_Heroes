import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUserFromRequest } from '@/lib/auth-session';
import { handleEngineBookStatus } from '@/lib/engine-site/reader-http';
import { engineReaderPorts } from '@/lib/engine-site/reader-production';
import { engineQaScope } from '@/lib/engine-site/qa-order-policy';
import { kickEngineQaOrder } from '@/lib/engine-site/qa-kick';
import { chainGenerationWorker } from '@/lib/generation-chunked/chain-worker';
export const runtime = 'nodejs';
export async function GET(req: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  const response = await handleEngineBookStatus(req, orderId, engineReaderPorts());
  // QA Preview only: the parent's polling page stands in for the production cron sweep.
  if (response.ok && engineQaScope()) {
    const user = (await resolveUserFromRequest(req))?.user;
    if (user) await kickEngineQaOrder(prisma, orderId, user.id, id => chainGenerationWorker(id)).catch(() => undefined);
  }
  return response;
}
