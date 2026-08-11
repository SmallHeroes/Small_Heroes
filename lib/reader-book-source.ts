import type { StoryScene } from '@/lib/book-layout';
import type { PowerCardRenderInput } from '@/lib/power-cards/types';

export type ReaderBookPage = {
  pageNumber: number;
  title?: string | null;
  text: string;
  narrationText?: string | null;
  audioUrl?: string | null;
  imageUrl: string | null;
  presentationImageUrl?: string | null;
  isCover?: boolean;
  pageTemplate?: string | null;
  pageLayout?: string | null;
  isLetter?: boolean;
  isQuietPage?: boolean;
  isDedication?: boolean;
  textZone?: string | null;
  lighting?: string | null;
  textColorScheme?: string | null;
  layout?: 'standard' | 'wide-spread';
  illustrationAspect?: 'portrait' | 'wide';
  textTreatment?: 'standard' | 'overlay' | 'captionless';
};

export type ReaderBookPayload = {
  id: string;
  status: string;
  childName?: string;
  storyDirection?: string | null;
  storyLength?: string | null;
  powerCard?: PowerCardRenderInput | null;
  book: {
    title?: string | null;
    coverText?: string | null;
    pages: ReaderBookPage[];
    storyScenes?: StoryScene[];
    /** Legacy: single MP3 for an entire book when page clips do not exist. */
    audioUrl?: string | null;
  } | null;
};

export type ReaderBookSource =
  | {
      kind: 'order';
      bookId: string;
      accessKey: string;
    }
  | {
      kind: 'qa_fixture';
      payload: ReaderBookPayload;
      exitHref: string;
      exitLabel: string;
    };

export function readerSourceBookId(source: ReaderBookSource): string {
  return source.kind === 'order' ? source.bookId : source.payload.id;
}

export function readerSourceExitHref(source: ReaderBookSource, resolvedAccessKey: string): string {
  if (source.kind === 'qa_fixture') return source.exitHref;
  const keyPart = resolvedAccessKey ? `&accessKey=${encodeURIComponent(resolvedAccessKey)}` : '';
  return `/ready?orderId=${encodeURIComponent(source.bookId)}${keyPart}`;
}

export function readerSourceAccessKey(
  source: ReaderBookSource,
  browserAccessKey: string | null
): string {
  if (source.kind === 'qa_fixture') return '';
  return source.accessKey || browserAccessKey || '';
}
