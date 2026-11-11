import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, enforceSameOrigin } from '@/lib/request-security';
import { engineOrderIntakeEnabled, type EngineParent } from './personal-orders';

export async function readEngineJson(req: NextRequest, maximumBytes = 32_768): Promise<unknown> {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw Error('engine_json_required');
  const reader = req.body?.getReader();
  if (!reader) throw Error('engine_body_required');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.length; if (size > maximumBytes) throw Error('engine_body_too_large');
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); }
}
export function engineHttpGuard(req: NextRequest, namespace: string) {
  return enforceSameOrigin(req) ?? enforceRateLimit(req, { namespace, limit: 20, windowMs: 60_000 });
}
export async function handleEngineOrderPost(req: NextRequest, ports: {
  enabled?: boolean; parent: (req: NextRequest) => Promise<EngineParent | null>;
  create: (input: unknown, parent: EngineParent) => Promise<{ orderId: string; inputSha256: string; replay: boolean }>;
}) {
  if (!(ports.enabled ?? engineOrderIntakeEnabled())) return NextResponse.json({ error: 'unavailable' }, { status: 404 });
  const denied = engineHttpGuard(req, 'engine-site-order'); if (denied) return denied;
  const parent = await ports.parent(req);
  if (!parent) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  try {
    const result = await ports.create(await readEngineJson(req), parent);
    return NextResponse.json({ ...result, status: 'personal_order_created' }, {
      status: result.replay ? 200 : 201, headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'engine_qa_parent_required') return NextResponse.json({ error: code }, { status: 403 });
    const conflict = ['engine_order_draft_already_bound', 'engine_order_existing_binding_mismatch', 'engine_order_options_changed'].includes(code);
    return NextResponse.json({ error: conflict ? code : 'engine_order_invalid' }, { status: conflict ? 409 : 422 });
  }
}
