import { NextRequest, NextResponse } from 'next/server';
import { resolveUserFromRequest } from '@/lib/auth-session';
import { prisma } from '@/lib/prisma';

const BOOK_STATUSES = ['ready', 'partial', 'generating', 'paid'] as const;

export async function GET(req: NextRequest) {
  const resolved = await resolveUserFromRequest(req);
  if (!resolved) {
    return NextResponse.json({ user: null, hasBooks: false });
  }

  const bookCount = await prisma.order.count({
    where: {
      userId: resolved.user.id,
      status: { in: [...BOOK_STATUSES] },
    },
  });

  return NextResponse.json({
    user: resolved.user,
    hasBooks: bookCount > 0,
    expiresAt: resolved.expiresAt,
  });
}
