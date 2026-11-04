import { NextRequest } from 'next/server';
import { engineReaderPorts } from '@/lib/engine-site/reader-production';
import { engineSiteOrigin } from '@/lib/engine-site/fulfillment';
import { handleEngineOperator } from '@/lib/engine-site/operator-http';
export const runtime = 'nodejs';
async function handle(req: NextRequest) {
  const ports = engineReaderPorts(); return handleEngineOperator(req, null, { ...ports,
    fulfillment: () => ({ storage: ports.storage(), origin: engineSiteOrigin() }) });
}
export { handle as GET, handle as POST };
