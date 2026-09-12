import 'server-only';
import path from 'node:path';
import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ReaderBookPayload } from './reader-book-source';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const manifestSchema = z.object({
  pages: z.array(z.object({
    pageNumber: z.number().int().min(0).max(99),
    imageName: z.string().regex(/^page-\d{2}\.png$/),
    imageSha: digest,
    text: z.string().min(1),
    automatedPassed: z.boolean(),
    reason: z.string(),
    score: z.number().finite().min(0).max(1).nullable(),
  })).min(2).max(100),
});
const ownerSchema = z.object({
  reviewer: z.literal('Guy'),
  pages: z.array(z.object({
    pageNumber: z.number().int().min(0).max(99),
    imageSha: digest,
    decision: z.literal('visually_accepted'),
  })).max(100),
});

// Deliberately stricter than staging QA: no hosted preview or production access.
export function localBookReviewEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && !process.env.VERCEL &&
    !process.env.VERCEL_ENV && Boolean(process.env.LOCAL_BOOK_REVIEW_DIR);
}

async function reviewRoot(): Promise<string> {
  if (!localBookReviewEnabled()) throw new Error('Local book review disabled');
  const configured = process.env.LOCAL_BOOK_REVIEW_DIR!;
  if (!path.isAbsolute(configured)) throw new Error('Absolute review directory required');
  return realpath(configured);
}

async function containedRead(root: string, name: string): Promise<Buffer> {
  const resolved = await realpath(path.join(root, name));
  if (path.dirname(resolved) !== root) throw new Error('Review file outside root');
  return readFile(resolved);
}

async function readManifest(root: string) {
  const manifest = manifestSchema.parse(JSON.parse((await containedRead(root, 'manifest.json')).toString('utf8')));
  manifest.pages.forEach((page, index) => {
    if (page.pageNumber !== index || page.imageName !== `page-${String(index).padStart(2, '0')}.png`) {
      throw new Error('Review pages must be contiguous from cover zero');
    }
  });
  return manifest;
}

async function verifiedImage(root: string, page: z.infer<typeof manifestSchema>['pages'][number]) {
  const bytes = await containedRead(root, page.imageName);
  if (createHash('sha256').update(bytes).digest('hex') !== page.imageSha) throw new Error('Review image digest mismatch');
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Review image is not PNG');
  return bytes;
}

export async function loadLocalBookReview() {
  const root = await reviewRoot();
  const manifest = await readManifest(root);
  await Promise.all(manifest.pages.map(page => verifiedImage(root, page)));
  let owner: z.infer<typeof ownerSchema> | null = null;
  try {
    owner = ownerSchema.parse(JSON.parse((await containedRead(root, 'owner-review.json')).toString('utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  for (const approval of owner?.pages ?? []) {
    if (manifest.pages[approval.pageNumber]?.imageSha !== approval.imageSha) throw new Error('Owner approval image mismatch');
  }
  const payload: ReaderBookPayload = {
    id: 'local-book-review', status: 'QA_FIXTURE_READY', powerCard: null,
    book: {
      title: manifest.pages[0].text, audioUrl: null,
      pages: manifest.pages.map(page => ({
        pageNumber: page.pageNumber, text: page.text,
        imageUrl: `/api/dev/local-book-image?page=${page.pageNumber}&sha=${page.imageSha}`,
        audioUrl: null, isCover: page.pageNumber === 0, pageLayout: 'standard',
      })),
    },
  };
  return { payload, automated: manifest.pages, owner };
}

export async function loadLocalBookImage(pageNumber: number, sha: string): Promise<Buffer> {
  const root = await reviewRoot();
  const manifest = await readManifest(root);
  const page = manifest.pages.find(item => item.pageNumber === pageNumber);
  if (!page || page.imageSha !== sha) throw new Error('Unknown review image');
  return verifiedImage(root, page);
}
