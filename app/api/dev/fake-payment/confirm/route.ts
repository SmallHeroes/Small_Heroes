import { NextRequest } from 'next/server';

import { handleFakePaymentConfirmPost } from './handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handleFakePaymentConfirmPost(req, { routeProtocol: 'legacy-route' });
}
