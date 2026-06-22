import { prisma } from '@/lib/prisma';
import { listStyle01DiniAuditions } from '@/lib/style01-audition-preview';
import { createLogger } from '@/lib/logger';

const logger = createLogger({ subsystem: 'dev-viewer-library' });

export type DevLibraryEntry = {
  key: string;
  kind: 'audition' | 'order';
  label: string;
  mtimeMs: number;
  dir?: string;
  root?: 'phase2-logs' | 'outputs';
  orderId?: string;
  accessKey?: string;
};

export function devViewerUrlForEntry(entry: DevLibraryEntry): string {
  if (entry.kind === 'order' && entry.orderId && entry.accessKey) {
    return `/dev/viewer?orderId=${encodeURIComponent(entry.orderId)}&accessKey=${encodeURIComponent(entry.accessKey)}`;
  }
  if (entry.kind === 'audition' && entry.dir) {
    const qs = new URLSearchParams({ dir: entry.dir });
    if (entry.root) qs.set('root', entry.root);
    return `/dev/viewer?${qs.toString()}`;
  }
  return '/dev/viewer';
}

/** Cloud-persisted audition runs (Supabase storage in serverless; local FS in dev). */
async function listAuditionEntries(): Promise<DevLibraryEntry[]> {
  const auditions = await listStyle01DiniAuditions();
  return auditions.map((a) => ({
    key: `audition:${a.root ?? 'auto'}:${a.dir}`,
    kind: 'audition',
    label: `[audition] ${a.label ?? a.dir}`,
    mtimeMs: a.mtimeMs,
    dir: a.dir,
    root: a.root,
  }));
}

/** Generated books (orders) from Postgres. */
async function listOrderEntries(): Promise<DevLibraryEntry[]> {
  const books = await prisma.generatedBook.findMany({
    orderBy: { createdAt: 'desc' },
    take: 150,
    select: {
      id: true,
      title: true,
      createdAt: true,
      order: {
        select: {
          id: true,
          paymentId: true,
          childName: true,
          childImageUrl: true,
          status: true,
          illustrationStyle: true,
          storyDirection: true,
          bookName: true,
        },
      },
    },
  });

  return books
    .filter((b) => b.order?.paymentId)
    .map((b) => {
      const order = b.order!;
      const title = b.title?.trim() || order.bookName?.trim() || 'Book';
      const child = order.childName?.trim() || '';
      // Generic-child books (no photo uploaded) must be identifiable at a
      // glance during the ship-gate review.
      const noPhoto = !order.childImageUrl;
      return {
        key: `order:${order.id}`,
        kind: 'order' as const,
        label: `[order]${noPhoto ? ' [NO-PHOTO]' : ''} ${title}${child ? ` · ${child}` : ''} · ${order.status}`,
        mtimeMs: b.createdAt.getTime(),
        orderId: order.id,
        accessKey: order.paymentId!,
      };
    });
}

/**
 * The library is assembled from two INDEPENDENT sources: cloud-persisted auditions (Supabase storage)
 * and generated-book orders (Postgres). Isolate them so a failure in one source can't 500 the whole
 * endpoint (0096 M5b made auditions serverless-safe but the endpoint still hard-coupled them with the
 * orders query) — in serverless the library still lists from Supabase even if the DB query hiccups.
 * Each failure is logged with its stack so the cause is observable instead of an opaque 500.
 */
export async function listDevViewerLibrary(): Promise<DevLibraryEntry[]> {
  const [auditionEntries, orderEntries] = await Promise.all([
    listAuditionEntries().catch((err) => {
      logger.error('Failed to list audition entries (Supabase storage)', err);
      return [] as DevLibraryEntry[];
    }),
    listOrderEntries().catch((err) => {
      logger.error('Failed to list order entries (Postgres)', err);
      return [] as DevLibraryEntry[];
    }),
  ]);

  return [...auditionEntries, ...orderEntries].sort((a, b) => b.mtimeMs - a.mtimeMs);
}
