import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { password, next } = await request.json();
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword || password !== sitePassword) {
    return NextResponse.json({ error: 'wrong' }, { status: 401 });
  }

  const redirect = next || '/wizard';
  const response = NextResponse.json({ ok: true, redirect });

  response.cookies.set('sh_access', sitePassword, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
