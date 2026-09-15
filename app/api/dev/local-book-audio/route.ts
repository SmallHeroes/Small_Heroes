import { loadLocalBookAudio } from '@/lib/local-book-review';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const page = query.get('page') ?? ''; const sha = query.get('sha') ?? '';
  if (!/^(0|[1-9]\d?)$/.test(page) || !/^[a-f0-9]{64}$/.test(sha)) return new Response(null, { status: 404 });
  try {
    const bytes = await loadLocalBookAudio(Number(page), sha);
    return new Response(new Uint8Array(bytes), { headers: {
      'Content-Type': 'audio/mpeg', 'Content-Length': String(bytes.length),
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch { return new Response(null, { status: 404 }); }
}
