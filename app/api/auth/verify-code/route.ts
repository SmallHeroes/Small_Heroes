import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit, enforceSameOrigin } from '@/lib/request-security';
import {
  createUserSession,
  DEFAULT_SESSION_SECONDS,
  LONG_SESSION_SECONDS,
  setSessionCookie,
} from '@/lib/auth-session';

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeCode(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: NextRequest) {
  const sameOriginError = enforceSameOrigin(req);
  if (sameOriginError) return sameOriginError;
  const rateLimitError = enforceRateLimit(req, {
    namespace: 'api-auth-verify-code',
    limit: 5,
    windowMs: 60_000,
  });
  if (rateLimitError) return rateLimitError;

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body?.email);
  const code = normalizeCode(body?.code);
  const stayLoggedIn = body?.stayLoggedIn === true;
  if (!email || !code) {
    return NextResponse.json({ error: 'email and code are required' }, { status: 400 });
  }

  const user = await prisma.userAccount.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 });
  }

  const codeHash = createHash('sha256').update(code).digest('hex');
  const otp = await prisma.otpCode.findFirst({
    where: {
      userId: user.id,
      code: codeHash,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 });
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { used: true },
  });

  // Link historical orders by customer email to this account.
  await prisma.order.updateMany({
    where: {
      customerEmail: email,
      userId: null,
    },
    data: { userId: user.id },
  });

  const ttlSeconds = stayLoggedIn ? LONG_SESSION_SECONDS : DEFAULT_SESSION_SECONDS;
  const { rawToken, expiresAt } = await createUserSession(user.id, ttlSeconds);
  await prisma.userSession.deleteMany({
    where: { userId: user.id, expiresAt: { lt: new Date() } },
  }).catch(() => {});
  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    expiresAt,
  });
  setSessionCookie(res, rawToken, ttlSeconds);
  return res;
}
