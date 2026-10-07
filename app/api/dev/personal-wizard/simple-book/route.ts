import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { personalOperatorAccess, storyResponse } from '@/lib/personal-wizard/story-access';
import { readBodyWithLimit } from '@/lib/personal-wizard/intake-gate';
import { resolveSimpleBookSettings, simpleBookConfig, enqueueSimpleBook, readSimpleBookStatus, queuedSimpleBook, SimpleBookBridgeError } from '@/lib/personal-wizard/simple-book-bridge';
import { readAuditionImage, readAuditionApproval } from '@/scripts/personal-simple-book-illustrator';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const envelope = z.object({ request: z.unknown(), requestId: hash,
  consent: z.literal('reviewed_text_to_simple_book_diagnostic') }).strict().refine(v => v.request !== undefined);
const access = (req: NextRequest) => personalOperatorAccess(req, resolveSimpleBookSettings, 'personal-native-book-pilot');
function failure(error: unknown) {
  const code = error instanceof SimpleBookBridgeError ? error.code : 'simple_unavailable';
  return storyResponse({ error: code, runtimeEligible: false }, code === 'simple_owner' ? 403 :
    code === 'simple_approval_consumed' ? 409 : code === 'simple_request_binding' ? 422 : 503);
}
export async function GET(req: NextRequest) {
  const allowed = await access(req); if (!allowed.ok) return allowed.response;
  try {
    const config = simpleBookConfig(allowed.settings.configFile);
    readAuditionApproval(config);
    const values = req.nextUrl.searchParams.getAll('requestId');
    if (!values.length) return storyResponse({ configured: true, engine: 'simple-opus-fresh-editor-astra',
      shortOnly: true, maximumUsd: 12, operatorWorkerRequired: true, imagesAvailable: !!config.illustratedAudition, runtimeEligible: false });
    if (values.length !== 1 || !hash.safeParse(values[0]).success) return storyResponse({ error: 'simple_request_binding' }, 422);
    const view = readSimpleBookStatus(config, allowed.userId, values[0]);
    const pages = req.nextUrl.searchParams.getAll('page');
    if (pages.length) {
      if (pages.length !== 1 || !/^[0-8]$/.test(pages[0]) || view.phase !== 'illustrated_audition') return storyResponse({ error: 'simple_image_unavailable' }, 404);
      const image = view.images.find(p => p.pageNumber === Number(pages[0]));
      if (!image) return storyResponse({ error: 'simple_image_unavailable' }, 404);
      const bytes = readAuditionImage(path.join(queuedSimpleBook(config).directory, 'illustrations'), image);
      return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" } });
    }
    return storyResponse(view);
  } catch (error) { return failure(error); }
}
export async function POST(req: NextRequest) {
  const allowed = await access(req); if (!allowed.ok) return allowed.response;
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return storyResponse({ error: 'unsupported_type' }, 415);
  const bytes = await readBodyWithLimit(req, 32768); if (!bytes) return storyResponse({ error: 'body_too_large' }, 413);
  let raw: unknown; try { raw = JSON.parse(bytes.toString('utf8')); } catch { return storyResponse({ error: 'invalid_json' }, 400); }
  const parsed = envelope.safeParse(raw); if (!parsed.success) return storyResponse({ error: 'invalid_envelope' }, 422);
  try {
    const config = simpleBookConfig(allowed.settings.configFile);
    readAuditionApproval(config);
    return storyResponse(enqueueSimpleBook(config, { request: parsed.data.request, requestId: parsed.data.requestId, userId: allowed.userId }), 202);
  } catch (error) { return failure(error); }
}
