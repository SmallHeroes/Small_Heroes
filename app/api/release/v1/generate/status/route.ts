import { NextRequest } from 'next/server';

import { handleGenerationStatusGet } from '@/app/api/generate/status/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleGenerationStatusGet(req, { routeProtocol: 'release/v1' });
}
