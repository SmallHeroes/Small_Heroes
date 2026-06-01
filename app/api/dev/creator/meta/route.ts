import { NextResponse } from 'next/server';
import { devOnlyJsonError, isDevEnvironment } from '@/lib/dev-only-guard';
import { buildCreatorMetaPayload } from '@/lib/dev-creator-meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isDevEnvironment()) return devOnlyJsonError();
  return NextResponse.json(await buildCreatorMetaPayload());
}
