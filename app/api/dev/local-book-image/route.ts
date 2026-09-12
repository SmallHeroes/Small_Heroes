import { loadLocalBookImage } from '@/lib/local-book-review';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const page = query.get('page') ?? '';
  const sha = query.get('sha') ?? '';
  if (!/^(0|[1-9]\d?)$/.test(page) || !/^[a-f0-9]{64}$/.test(sha)) return new Response(null, { status: 404 });
  try {
    const bytes = await loadLocalBookImage(Number(page), sha);
    return new Response(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
