import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUserFromRequest } from '@/lib/auth-session';
import { handleEnginePhotoUpload } from '@/lib/engine-site/private-http';
import { productionEnginePrivateStorage } from '@/lib/engine-site/private-storage';
import { engineQaRequired } from '@/lib/engine-site/qa-order-policy';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  if (engineQaRequired()) return NextResponse.json({ error: 'unavailable' }, { status: 404 });
  return handleEnginePhotoUpload(req, { db: prisma, storage: productionEnginePrivateStorage,
    parent: async request => (await resolveUserFromRequest(request))?.user ?? null });
}
