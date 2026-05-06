import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, resolveUserFromRequest } from '@/lib/auth-session';
import { prisma } from '@/lib/prisma';
import { enforceSameOrigin } from '@/lib/request-security';

export async function POST(req: NextRequest) {
  const sameOriginError = enforceSameOrigin(req);
  if (sameOriginError) return sameOriginError;
  const resolved = await resolveUserFromRequest(req);
  if (resolved) {
    await prisma.userSession.deleteMany({
      where: { token: resolved.sessionTokenHash },
    });
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
