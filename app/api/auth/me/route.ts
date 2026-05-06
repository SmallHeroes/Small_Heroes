import { NextRequest, NextResponse } from 'next/server';
import { resolveUserFromRequest } from '@/lib/auth-session';

export async function GET(req: NextRequest) {
  const resolved = await resolveUserFromRequest(req);
  if (!resolved) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: resolved.user,
    expiresAt: resolved.expiresAt,
  });
}
