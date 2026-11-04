import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { engineOrderIntakeEnabled, type EngineParent } from './personal-orders';
import { engineHttpGuard } from './order-http';
import { ENGINE_PHOTO_MAX_BYTES, loadEnginePrivateAsset, uploadEngineChildPhoto } from './private-assets';
import type { EnginePrivateStorage } from './private-storage';

export type PrivateHttpPorts = { enabled?: boolean; db: PrismaClient;
  parent: (req: NextRequest) => Promise<EngineParent | null>; storage: () => EnginePrivateStorage };
export async function handleEnginePhotoUpload(req: NextRequest, ports: PrivateHttpPorts) {
  if (!(ports.enabled ?? engineOrderIntakeEnabled())) return NextResponse.json({ error: 'unavailable' }, { status: 404 });
  const denied = engineHttpGuard(req, 'engine-private-upload'); if (denied) return denied;
  const parent = await ports.parent(req); if (!parent) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  try {
    const reader = req.body?.getReader(); if (!reader) throw Error('missing_body');
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const item = await reader.read(); if (item.done) break;
        size += item.value.length; if (size > ENGINE_PHOTO_MAX_BYTES) throw Error('too_large');
        chunks.push(item.value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const asset = await uploadEngineChildPhoto(ports.db, ports.storage(), parent.id,
      req.headers.get('x-engine-draft') ?? '', req.headers.get('content-type') ?? '', Buffer.concat(chunks));
    return NextResponse.json({ assetId: asset.assetId, sha256: asset.sha256 }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'private_photo_upload_failed' }, { status: 422 }); }
}
/** Parent session only; this endpoint never accepts reader/book tokens. */
export async function handleEnginePhotoRead(req: NextRequest, assetId: string, ports: PrivateHttpPorts) {
  if (!(ports.enabled ?? engineOrderIntakeEnabled())) return NextResponse.json({ error: 'unavailable' }, { status: 404 });
  const parent = await ports.parent(req); if (!parent) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  try {
    const asset = await loadEnginePrivateAsset(ports.db, assetId);
    if (asset.ownerId !== parent.id || asset.kind !== 'child_photo') throw Error('denied');
    const url = await ports.storage().sign(asset.key);
    return new NextResponse(null, { status: 307, headers: { Location: url, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch { return NextResponse.json({ error: 'not_found' }, { status: 404 }); }
}
