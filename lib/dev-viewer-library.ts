import { prisma } from '@/lib/prisma';
import { listStyle01DiniAuditions } from '@/lib/style01-audition-preview';

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

export async function listDevViewerLibrary(): Promise<DevLibraryEntry[]> {
  const auditions = await listStyle01DiniAuditions();
  const auditionEntries: DevLibraryEntry[] = auditions.map((a) => ({
    key: `audition:${a.root ?? 'auto'}:${a.dir}`,
    kind: 'audition',
    label: `[audition] ${a.label ?? a.dir}`,
    mtimeMs: a.mtimeMs,
    dir: a.dir,
    root: a.root,
  }));

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

  const orderEntries: DevLibraryEntry[] = books
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

  return [...auditionEntries, ...orderEntries].sort((a, b) => b.mtimeMs - a.mtimeMs);
}
