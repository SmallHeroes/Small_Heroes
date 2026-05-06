import { randomBytes, createHash } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const SESSION_COOKIE_NAME = 'sh_session';
const DAY_SECONDS = 60 * 60 * 24;
export const DEFAULT_SESSION_SECONDS = DAY_SECONDS;
export const LONG_SESSION_SECONDS = 30 * DAY_SECONDS;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export async function createUserSession(userId: string, ttlSeconds: number) {
  const rawToken = createSessionToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await prisma.userSession.create({
    data: {
      userId,
      token: tokenHash,
      expiresAt,
    },
  });
  return { rawToken, expiresAt };
}

export async function resolveUserFromRequest(req: NextRequest) {
  const rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const session = await prisma.userSession.findUnique({
    where: { token: tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.userSession.delete({ where: { token: tokenHash } }).catch(() => {});
    return null;
  }

  return {
    sessionTokenHash: tokenHash,
    user: session.user,
    expiresAt: session.expiresAt,
  };
}

export function setSessionCookie(res: NextResponse, rawToken: string, maxAge: number) {
  res.cookies.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
