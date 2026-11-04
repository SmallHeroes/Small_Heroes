import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUserFromRequest } from '@/lib/auth-session';
import { handleEngineOrderPost } from '@/lib/engine-site/order-http';
import { createEnginePersonalOrder, resolveEngineWizardOptions } from '@/lib/engine-site/personal-orders';
import { verifyEngineOrderPhoto } from '@/lib/engine-site/private-assets';

export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  return handleEngineOrderPost(req, {
    parent: async request => (await resolveUserFromRequest(request))?.user ?? null,
    create: (input, parent) => createEnginePersonalOrder(prisma, input, parent, resolveEngineWizardOptions(),
      (tx, assetId, draftId) => verifyEngineOrderPhoto(tx, assetId, parent.id, draftId)),
  });
}
