import { localReaderByteRange } from '@/lib/local-reader-preview';
import { loadLocalReaderAsset } from '@/lib/local-reader-preview-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') return new Response(null, { status: 404 });
  try {
    const url = new URL(request.url), id = url.searchParams.get('book') ?? '', file = url.searchParams.get('asset') ?? '';
    const { bytes, contentType } = await loadLocalReaderAsset(id, file);
    const range = localReaderByteRange(request.headers.get('range'), bytes.length);
    const headers: Record<string, string> = { 'Content-Type': contentType, 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
    if (range === 'unsatisfiable') return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${bytes.length}` } });
    if (range) {
      headers['Content-Range'] = `bytes ${range.start}-${range.end}/${bytes.length}`;
      headers['Content-Length'] = String(range.end - range.start + 1);
      return new Response(new Uint8Array(bytes.subarray(range.start, range.end + 1)), { status: 206, headers });
    }
    headers['Content-Length'] = String(bytes.length);
    return new Response(new Uint8Array(bytes), { headers });
  } catch { return new Response(null, { status: 404 }); }
}
