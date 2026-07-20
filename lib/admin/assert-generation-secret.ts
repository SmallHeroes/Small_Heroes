import 'server-only';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Admin auth gate — same secret as `app/api/admin/anchor-hold-release` and the generation worker.
 * Accepts `Authorization: Bearer <GENERATION_SECRET>` or `x-generation-secret` (GET-friendly),
 * and for POSTs also `body.secret` (legacy admin pattern).
 */
export function extractAdminSecret(req: NextRequest, body?: { secret?: unknown }): string | null {
  const auth = req.headers.get('authorization');
  const bearer = /^Bearer\s+(.+)$/i.exec(auth ?? '')?.[1]?.trim();
  if (bearer) return bearer;
  const header = req.headers.get('x-generation-secret')?.trim();
  if (header) return header;
  if (typeof body?.secret === 'string' && body.secret.trim()) return body.secret.trim();
  return null;
}

export function assertAdminSecret(req: NextRequest, body?: { secret?: unknown }): NextResponse | null {
  const expected = process.env.GENERATION_SECRET?.trim();
  if (!expected) {
    return NextResponse.json({ error: 'Admin review disabled (server misconfigured)' }, { status: 503 });
  }
  const provided = extractAdminSecret(req, body);
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
