import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { localReaderByteRange } from '@/lib/local-reader-preview';
import { loadEngineOrderSnapshot } from './personal-jobs';
import { engineFamilyBookReady, engineOperatorIds, engineReaderEnabled, engineReaderPayload, loadEngineReaderBook, type EngineReaderContext } from './reader';
import { verifyEngineBookAsset } from './materialize';
import { loadEnginePrivateAsset } from './private-assets';
import type { EnginePrivateStorage } from './private-storage';
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
export type EngineReaderPorts = { db: PrismaClient; storage: () => EnginePrivateStorage; enabled?: boolean;
  parent: (req: NextRequest) => Promise<{ id: string } | null>; operatorIds?: readonly string[];
  /** Test/local seam only: production redirects to a60s private signed object, avoiding serverless4.5MB response limits. */
  proxyBytes?: boolean;
  familyReady?: (db: PrismaClient, context: EngineReaderContext) => Promise<boolean> };
async function access(req: NextRequest, orderId: string, ports: EngineReaderPorts) {
  if (!(ports.enabled ?? engineReaderEnabled())) return null;
  const parent = await ports.parent(req); if (!parent) return null;
  const loaded = await loadEngineOrderSnapshot(ports.db, orderId), preview = req.nextUrl.searchParams.get('preview') === '1';
  if (preview ? !(ports.operatorIds ?? engineOperatorIds()).includes(parent.id) : parent.id !== loaded.snapshot.ownerId) return null;
  return { parent, loaded, preview };
}
/** Final-book assets only. Book permission can never resolve photos, references, raw candidates or receipts. */
export async function handleEngineBookRead(req: NextRequest, orderId: string, ports: EngineReaderPorts, assetId?: string) {
  try {
    const allowed = await access(req, orderId, ports); if (!allowed) throw Error('denied');
    const storage = ports.storage(), context = await loadEngineReaderBook(ports.db, storage, orderId);
    if (!allowed.preview && !(await (ports.familyReady ?? engineFamilyBookReady)(ports.db, context))) throw Error('held');
    if (!assetId) return NextResponse.json(engineReaderPayload(orderId, context.book, allowed.preview), { headers });
    const book = context.book, match = book.pdf.assetId === assetId ? { ref: book.pdf, kind: 'pdf' as const, contentType: 'application/pdf' }
      : book.pages.flatMap(p => [{ ref: p.image, kind: 'page' as const, contentType: 'image/png' },
        { ref: p.audio, kind: 'audio' as const, contentType: 'audio/mpeg' }]).find(r => r.ref.assetId === assetId);
    if (!match) throw Error('denied');
    const bytes = await verifyEngineBookAsset(ports.db, storage, context, match.ref, match.kind);
    if (!ports.proxyBytes) {
      const asset = await loadEnginePrivateAsset(ports.db, match.ref.assetId);
      return new NextResponse(null, { status: 307, headers: { ...headers, Location: await storage.sign(asset.key, match.kind === 'pdf' ? 'small-heroes-book.pdf' : undefined) } });
    }
    const range = localReaderByteRange(req.headers.get('range'), bytes.length);
    if (range === 'unsatisfiable') return new NextResponse(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${bytes.length}` } });
    const body = range ? bytes.subarray(range.start, range.end + 1) : bytes;
    return new NextResponse(new Uint8Array(body), { status: range ? 206 : 200, headers: { ...headers, 'Content-Type': match.contentType,
      'Content-Length': String(body.length), 'Accept-Ranges': 'bytes',
      ...(range ? { 'Content-Range': `bytes ${range.start}-${range.end}/${bytes.length}` } : {}),
      ...(match.kind === 'pdf' ? { 'Content-Disposition': 'attachment; filename="small-heroes-book.pdf"' } : {}) } });
  } catch { return NextResponse.json({ error: 'not_found' }, { status: 404, headers }); }
}
export async function handleEngineBookStatus(req: NextRequest, orderId: string, ports: EngineReaderPorts) {
  try {
    const allowed = await access(req, orderId, ports); if (!allowed) throw Error('denied');
    const order = allowed.loaded.order;
    let context: EngineReaderContext | null = null;
    try { context = await loadEngineReaderBook(ports.db, ports.storage(), orderId); } catch { /* still preparing or held */ }
    const ready = !!context && (allowed.preview || await (ports.familyReady ?? engineFamilyBookReady)(ports.db, context));
    const previewQuery = allowed.preview ? '?preview=1' : '';
    return NextResponse.json({ id: orderId, status: ready ? 'ready' : ['failed', 'refunded', 'cancelled'].includes(order.status) ? order.status : 'preparing',
      readerUrl: ready ? `/personal/book/${encodeURIComponent(orderId)}${previewQuery}` : null,
      pdfUrl: ready ? `/api/engine-site/v1/books/${encodeURIComponent(orderId)}/assets/${context!.book.pdf.assetId}${previewQuery}` : null,
      ...(allowed.preview && context ? { bookSha256: context.bookSha256, preview: true } : {}) }, { headers });
  } catch { return NextResponse.json({ error: 'not_found' }, { status: 404, headers }); }
}
