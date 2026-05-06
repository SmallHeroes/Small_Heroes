import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit, enforceSameOrigin } from '@/lib/request-security';
import { sendOtpCodeEmail } from '@/backend/lib/email';

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  const sameOriginError = enforceSameOrigin(req);
  if (sameOriginError) return sameOriginError;
  const rateLimitError = enforceRateLimit(req, {
    namespace: 'api-auth-send-code',
    limit: 10,
    windowMs: 60_000,
  });
  if (rateLimitError) return rateLimitError;

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body?.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const user = await prisma.userAccount.upsert({
    where: { email },
    update: {},
    create: { email },
    select: { id: true, email: true },
  });

  // Dev shortcut: use fixed code when no email provider is configured
  const hasEmailProvider = Boolean(process.env.RESEND_API_KEY);
  const code = hasEmailProvider
    ? String(Math.floor(100000 + Math.random() * 900000))
    : '123456';
  const codeHash = createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Invalidate any previous unused OTP codes for this user.
  await prisma.otpCode.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  await prisma.otpCode.create({
    data: {
      userId: user.id,
      code: codeHash,
      expiresAt,
      used: false,
    },
  });

  await sendOtpCodeEmail({ to: user.email, code });
  return NextResponse.json({ ok: true });
}
