import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUserFromRequest } from '@/lib/auth-session';
import { handleEnginePhotoRead } from '@/lib/engine-site/private-http';
import { productionEnginePrivateStorage } from '@/lib/engine-site/private-storage';
export const runtime = 'nodejs';
export async function GET(req: NextRequest, context: { params: Promise<{ assetId: string }> }) {
  return handleEnginePhotoRead(req, (await context.params).assetId, { db: prisma, storage: productionEnginePrivateStorage,
    parent: async request => (await resolveUserFromRequest(request))?.user ?? null });
}
