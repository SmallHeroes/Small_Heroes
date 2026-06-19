import { NextResponse } from 'next/server';
import { canAccessStagingQa } from './runtime-env';

export function isDevEnvironment(): boolean {
  return process.env.NODE_ENV !== 'production' || canAccessStagingQa();
}

export function devOnlyJsonError(status = 404): NextResponse {
  return NextResponse.json({ error: 'Dev-only endpoint' }, { status });
}

export function assertDevOnly(): void {
  if (!isDevEnvironment()) {
    throw new Error('Dev-only');
  }
}
