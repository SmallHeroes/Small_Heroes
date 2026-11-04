import { NextRequest } from 'next/server';
import { engineReaderPorts } from '@/lib/engine-site/reader-production';
import { engineSiteOrigin } from '@/lib/engine-site/fulfillment';
import { handleEngineOperator } from '@/lib/engine-site/operator-http';
export const runtime = 'nodejs';
export const maxDuration = 300;
async function handle(req: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  const ports = engineReaderPorts(); return handleEngineOperator(req, (await context.params).orderId,
    { ...ports, fulfillment: () => ({ storage: ports.storage(), origin: engineSiteOrigin() }) });
}
export { handle as GET, handle as POST };
