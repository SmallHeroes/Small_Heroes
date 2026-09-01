import { NextRequest } from 'next/server';

import { handleOrderPost } from './handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handleOrderPost(req, { routeProtocol: 'legacy-route' });
}
