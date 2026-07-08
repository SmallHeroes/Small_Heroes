/**
 * Listen mode — an AUDIO-ONLY, auto-advancing player for the whole book. No page images, no book UI:
 * "just hear the story from start to end." Reuses the reader's fetch + accessKey auth (GET
 * /api/orders/[id]?accessKey=…). Audio source = the per-page narration MP3s the chunked pipeline
 * produces (BookPage.audioUrl); a single whole-book MP3 is used only if per-page clips are absent.
 * Entry: /book/[id]/listen?accessKey=…  (linked from the ready email "השמע את הספר" + the reader).
 */
import ListenMode from './ListenMode';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BookListenPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const accessKey = asSingle(query.accessKey) || '';
  return <ListenMode bookId={id} accessKey={accessKey} />;
}
