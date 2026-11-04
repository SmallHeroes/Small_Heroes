import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUserFromRequest } from '@/lib/auth-session';
import { handleEnginePhotoUpload } from '@/lib/engine-site/private-http';
import { productionEnginePrivateStorage } from '@/lib/engine-site/private-storage';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  return handleEnginePhotoUpload(req, { db: prisma, storage: productionEnginePrivateStorage,
    parent: async request => (await resolveUserFromRequest(request))?.user ?? null });
}
