import { NextRequest, NextResponse } from 'next/server';

import { handleGenerationWorkerPost } from '@/app/api/generate/worker/handler';
import {
  RELEASE_V1_WORKER_PROBE_HEADER,
  RELEASE_V1_WORKER_PROBE_VERSION,
} from '@/lib/generation-chunked/release-v1-worker-reachability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  return handleGenerationWorkerPost(req, { routeProtocol: 'release/v1' });
}

/** State-free protected-deployment reachability proof used before recovery Apply. */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      [RELEASE_V1_WORKER_PROBE_HEADER]: RELEASE_V1_WORKER_PROBE_VERSION,
      'Cache-Control': 'no-store',
    },
  });
}
