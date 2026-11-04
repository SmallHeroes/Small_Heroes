import { NextRequest } from 'next/server';
import { handleEngineBookStatus } from '@/lib/engine-site/reader-http';
import { engineReaderPorts } from '@/lib/engine-site/reader-production';
export const runtime = 'nodejs';
export async function GET(req: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  return handleEngineBookStatus(req, (await context.params).orderId, engineReaderPorts());
}
