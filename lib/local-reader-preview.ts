import { z } from 'zod';
import type { ReaderBookPayload } from './reader-book-source';

const sha = z.string().regex(/^[a-f0-9]{64}$/);
const localReaderBase = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{2,79}$/),
  title: z.string().min(1).max(200),
  childName: z.string().min(1).max(80),
  sourceManifestSha256: sha,
  sourceQa: z.literal('incomplete'),
  productAccepted: z.literal(false),
  productionQualified: z.literal(false),
}).strict();
const localReaderPage = z.object({
    pageNumber: z.number().int().min(0).max(64),
    text: z.string().min(1).max(16000),
    imageSha256: sha,
}).strict();
const narratedReader = localReaderBase.extend({ version: z.literal('local-narrated-reader/v1'),
  voice: z.object({ id: z.string().min(1).max(50), label: z.string().min(1).max(80),
    provider: z.literal('elevenlabs'), model: z.string().min(1).max(60) }).strict(),
  pages: z.array(localReaderPage.extend({ audioSha256: sha }).strict()).min(2).max(65),
}).strict();
const imageOnlyReader = localReaderBase.extend({ version: z.literal('local-image-reader/v1'),voice: z.null(),
  pages: z.array(localReaderPage.extend({ audioSha256: z.null() }).strict()).min(2).max(65),
}).strict();
/** An image-only trial has NO audio, not silent/reused narration or an invented mom recording. */
export const localReaderPreviewSchema = z.discriminatedUnion('version',[narratedReader,imageOnlyReader]).superRefine((value, ctx) => {
  if (value.pages.some((p, index) => p.pageNumber !== index))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cover and body pages must be complete and ordered from zero' });
  if (value.pages[0]?.text !== value.title)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cover text must match the frozen title' });
});
export type LocalReaderPreview = z.infer<typeof localReaderPreviewSchema>;

export function localReaderId(value: string): string {
  if (!/^[a-z][a-z0-9-]{2,79}$/.test(value)) throw Error('local_reader_id');
  return value;
}

export function localReaderAsset(preview: LocalReaderPreview, file: string) {
  const match = /^page-(0|[1-9]\d*)\.(png|mp3)$/.exec(file);
  if (!match) throw Error('local_reader_asset');
  const page = preview.pages.find(p => p.pageNumber === Number(match[1]));
  if (!page) throw Error('local_reader_asset');
  if (match[2] === 'mp3' && page.audioSha256 === null) throw Error('local_reader_asset');
  return { sha256: match[2] === 'png' ? page.imageSha256 : page.audioSha256,
    contentType: match[2] === 'png' ? 'image/png' : 'audio/mpeg' };
}

export function localReaderPayload(preview: LocalReaderPreview): ReaderBookPayload {
  return { id: preview.id, status: 'LOCAL_DIAGNOSTIC_PREVIEW', childName: preview.childName, powerCard: null,
    book: { title: preview.title, audioUrl: null, pages: preview.pages.map(p => ({
      pageNumber: p.pageNumber, text: p.text, narrationText: p.text, isCover: p.pageNumber === 0,
      pageLayout: 'standard',
      imageUrl: `/api/dev/local-reader?book=${encodeURIComponent(preview.id)}&asset=page-${p.pageNumber}.png`,
      audioUrl: p.audioSha256 === null ? null : `/api/dev/local-reader?book=${encodeURIComponent(preview.id)}&asset=page-${p.pageNumber}.mp3`,
    })) } };
}

/** A single RFC byte range. Multiple ranges are deliberately not served by this local preview. */
export function localReaderByteRange(header: string | null, size: number): null | 'unsatisfiable' | { start: number; end: number } {
  if (!header) return null;
  if (!Number.isSafeInteger(size) || size <= 0) return 'unsatisfiable';
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return 'unsatisfiable';
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return 'unsatisfiable';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]), end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return 'unsatisfiable';
  return { start, end: Math.min(end, size - 1) };
}
