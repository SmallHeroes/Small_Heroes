import { NextRequest } from 'next/server';
import { handleEngineBookRead } from '@/lib/engine-site/reader-http';
import { engineReaderPorts } from '@/lib/engine-site/reader-production';
export const runtime = 'nodejs';
export async function GET(req: NextRequest, context: { params: Promise<{ orderId: string; assetId: string }> }) {
  const { orderId, assetId } = await context.params;
  return handleEngineBookRead(req, orderId, engineReaderPorts(), assetId);
}
