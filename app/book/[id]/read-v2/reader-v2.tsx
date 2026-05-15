'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { deriveLayout, type PageLayout } from '@/backend/providers/image-prompt-enricher';
import styles from './reader-v2.module.css';

type BookPageTemplate = 'full_bleed_overlay' | 'art_top_text_bottom' | 'character_vignette_text' | 'text_only';

type TextZone = 'top_clear' | 'bottom_clear';

type BookPage = {
  pageNumber: number;
  title?: string | null;
  text: string;
  narrationText?: string | null;
  audioUrl?: string | null;
  imageUrl: string | null;
  presentationImageUrl?: string | null;
  isCover?: boolean;
  pageTemplate?: string | null;
  pageLayout?: PageLayout | null;
  isLetter?: boolean;
  isQuietPage?: boolean;
  isDedication?: boolean;
  textZone?: string | null;
  lighting?: string | null;
  textColorScheme?: string | null;
};

type ReaderPage = {
  pageNumber: number;
  title: string | null;
  text: string;
  audioUrl: string | null;
  imageUrl: string | null;
  isCover: boolean;
  isDedication: boolean;
  pageTemplate: BookPageTemplate;
  pageLayout: PageLayout;
  textZone: TextZone;
};

type OrderBookResponse = {
  id: string;
  status: string;
  book: {
    title?: string | null;
    coverText?: string | null;
    pages: BookPage[];
    /** Legacy: single MP3 for entire book (when no per-page audioUrl). */
    audioUrl?: string | null;
  } | null;
};

type Props = {
  bookId: string;
  accessKey: string;
};

const TEXT_ZONES: TextZone[] = ['top_clear', 'bottom_clear'];

/**
 * Compact story text for display: collapse ALL line breaks into spaces.
 * The story rhythm comes from punctuation (periods, dashes, exclamation marks),
 * not from forced line breaks. In a real printed book, this would be a flowing paragraph.
 */
function compactStoryText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')       // all line breaks → single space
    .replace(/\s{2,}/g, ' ')    // collapse multiple spaces
    .trim();
}

function resolvePageImageUrl(page: BookPage): string | null {
  const direct = page.imageUrl ?? page.presentationImageUrl ?? null;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  return null;
}

function splitCoverAndInterior(pages: BookPage[]): { cover: BookPage | null; interior: BookPage[] } {
  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const cover = sorted.find((p) => p.pageNumber === 0) ?? sorted.find((p) => Boolean(p.isCover)) ?? null;
  const interior = sorted.filter((p) => p !== cover).sort((a, b) => a.pageNumber - b.pageNumber);
  return { cover, interior };
}

/** Preserved for API typing; reader layout is chosen from pageLayout with text-only fallback. */
function normalizePageTemplate(raw: string | null | undefined, hasImage: boolean): BookPageTemplate {
  if (!hasImage) return 'text_only';
  if (raw === 'full_bleed_overlay' || raw === 'art_top_text_bottom' || raw === 'character_vignette_text') {
    return raw;
  }
  return 'art_top_text_bottom';
}

function parseTextZone(raw: string | null | undefined): TextZone | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const t = raw.trim() as TextZone;
  return TEXT_ZONES.includes(t) ? t : undefined;
}

function normalizeReaderPages(pages: BookPage[]): ReaderPage[] {
  const { cover, interior } = splitCoverAndInterior(pages);
  const ordered = cover ? [cover, ...interior] : interior;
  const totalPages = interior.length;
  return ordered.map((page) => {
    const imageUrl = resolvePageImageUrl(page);
    const pageTemplate = normalizePageTemplate(page.pageTemplate ?? null, Boolean(imageUrl));
    const isCoverPage = page.pageNumber === 0 || Boolean(page.isCover);
    const textZone =
      !isCoverPage && imageUrl
        ? parseTextZone(page.textZone ?? undefined) ?? 'top_clear'
        : 'bottom_clear';
    const pageLayout =
      page.pageLayout ??
      deriveLayout({
        pageNumber: page.pageNumber,
        totalPages,
        text: page.text || '',
        isCover: isCoverPage,
        isLetter: Boolean(page.isLetter),
        isQuietPage: Boolean(page.isQuietPage),
      });
    const rawAudio = typeof page.audioUrl === 'string' ? page.audioUrl.trim() : '';
    return {
      pageNumber: page.pageNumber,
      title: page.title ?? null,
      text: compactStoryText(page.text ?? ''),
      audioUrl: rawAudio.length > 0 ? rawAudio : null,
      imageUrl,
      isCover: isCoverPage,
      isDedication: Boolean(page.isDedication),
      pageTemplate,
      pageLayout,
      textZone,
    };
  });
}

function overlayZoneClass(zone: TextZone): string {
  const map: Record<TextZone, string> = {
    top_clear: styles.overlayZoneTop,
    bottom_clear: styles.overlayZoneBottom,
  };
  return map[zone] ?? styles.overlayZoneBottom;
}

export default function ReaderV2({ bookId, accessKey }: Props) {
  const resolvedAccessKey = useMemo(() => {
    if (accessKey) return accessKey;
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('accessKey') || '';
  }, [accessKey]);

  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [errorMessage, setErrorMessage] = useState('לא הצלחנו לפתוח את הספר.');
  const [bookTitle, setBookTitle] = useState('');
  const [readerPages, setReaderPages] = useState<ReaderPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [showEndScreen, setShowEndScreen] = useState(false);
  /** Whole-book MP3 when the order has no per-page clips. */
  const [fallbackBookAudioUrl, setFallbackBookAudioUrl] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const keyPart = resolvedAccessKey ? `&accessKey=${encodeURIComponent(resolvedAccessKey)}` : '';
  const readyHref = `/ready?orderId=${encodeURIComponent(bookId)}${keyPart}`;
  const generationSecret = process.env.NEXT_PUBLIC_GENERATION_SECRET;

  const currentPage = readerPages[currentPageIndex] ?? null;
  const hasPerPageAudio = useMemo(() => readerPages.some((p) => Boolean(p.audioUrl)), [readerPages]);
  const audioSrcForCurrentPage =
    currentPage && !currentPage.isCover ? currentPage.audioUrl ?? fallbackBookAudioUrl : null;
  const showAudioButton = Boolean(audioSrcForCurrentPage);
  const isFirstPage = currentPageIndex === 0;
  const isLastPage = currentPageIndex >= readerPages.length - 1 && readerPages.length > 0;

  useEffect(() => {
    if (!resolvedAccessKey) {
      setErrorMessage('נדרש קישור גישה מלא כדי לפתוח את הספר. חזרו לעמוד ההזמנה ונסו שוב.');
      setStatus('error');
      return;
    }

    async function loadBook() {
      setStatus('loading');
      setShowEndScreen(false);
      const url = `/api/orders/${encodeURIComponent(bookId)}?accessKey=${encodeURIComponent(resolvedAccessKey)}`;
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          setErrorMessage(res.status === 404 ? 'לא מצאנו את הספר המבוקש.' : 'טעינת הספר נכשלה.');
          setStatus('error');
          return;
        }

        const data = (await res.json()) as OrderBookResponse;
        const pages = data?.book?.pages ?? [];
        if (!pages.length) {
          setErrorMessage('הספר עדיין לא מוכן לקריאה.');
          setStatus('error');
          return;
        }

        const normalizedPages = normalizeReaderPages(pages);
        if (!normalizedPages.length) {
          setErrorMessage('לא נמצאו עמודים קריאים בספר.');
          setStatus('error');
          return;
        }

        setBookTitle(data.book?.title?.trim() || '');
        setReaderPages(normalizedPages);
        setCurrentPageIndex(0);
        setFallbackBookAudioUrl(
          typeof data.book?.audioUrl === 'string' && data.book.audioUrl.trim()
            ? data.book.audioUrl.trim()
            : null
        );
        setStatus('ready');
      } catch {
        setErrorMessage('נכשלה טעינת הספר. נסו שוב בעוד רגע.');
        setStatus('error');
      }
    }

    loadBook().catch(() => {
      setErrorMessage('נכשלה טעינת הספר. נסו שוב בעוד רגע.');
      setStatus('error');
    });
  }, [bookId, resolvedAccessKey]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsAudioPlaying(true);
    const onPause = () => setIsAudioPlaying(false);
    const onEnded = () => setIsAudioPlaying(false);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentPage?.isCover) {
      audio.pause();
      return;
    }
  }, [currentPage?.isCover]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentPage?.audioUrl) {
      if (hasPerPageAudio) {
        audio.pause();
        audio.currentTime = 0;
      }
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    audio.src = currentPage.audioUrl;
    audio.load();

    const timer = window.setTimeout(() => {
      audio.play().catch(() => {
        console.log('[read-v2] auto-play blocked, user interaction required');
      });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [currentPageIndex, currentPage?.audioUrl, hasPerPageAudio]);

  const next = useCallback(() => {
    if (!readerPages.length) return;
    if (isLastPage) {
      setShowEndScreen(true);
      return;
    }
    setShowEndScreen(false);
    setCurrentPageIndex((prev) => Math.min(prev + 1, readerPages.length - 1));
  }, [isLastPage, readerPages.length]);

  const prev = useCallback(() => {
    if (showEndScreen) {
      setShowEndScreen(false);
      return;
    }
    setCurrentPageIndex((prev) => Math.max(prev - 1, 0));
  }, [showEndScreen]);

  const toggleAudio = useCallback(async () => {
    const audio = audioRef.current;
    const src = audioSrcForCurrentPage;
    if (!audio || !src) return;

    try {
      const resolved = new URL(src, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
        .href;
      if (audio.src !== resolved) {
        audio.pause();
        audio.currentTime = 0;
        audio.src = src;
        audio.load();
      }
    } catch {
      audio.pause();
      audio.currentTime = 0;
      audio.src = src;
      audio.load();
    }

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsAudioPlaying(false);
      }
      return;
    }
    audio.pause();
  }, [audioSrcForCurrentPage]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (status !== 'ready') return;
      if (event.key === 'ArrowLeft') next();
      if (event.key === 'ArrowRight') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, status]);

  const onTouchStart = useCallback((event: React.TouchEvent) => {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  }, []);

  const onTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      const startX = touchStartXRef.current;
      touchStartXRef.current = null;
      if (startX == null) return;
      const delta = startX - (event.changedTouches[0]?.clientX ?? startX);
      if (Math.abs(delta) < 48) return;
      if (delta > 0) next();
      else prev();
    },
    [next, prev]
  );

  const retryGeneration = useCallback(async () => {
    if (!generationSecret) {
      setErrorMessage('לא ניתן לנסות שוב כרגע. חסר מפתח יצירה.');
      return;
    }
    setIsRetrying(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: bookId, secret: generationSecret, reason: 'user_retry' }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `retry_failed_${res.status}`);
      }
      window.location.href = `/generating?orderId=${encodeURIComponent(bookId)}`;
    } catch (error) {
      console.error('[read-v2] retry generation failed', error);
      setErrorMessage('לא הצלחנו להפעיל יצירה מחדש. אפשר לנסות שוב בעוד רגע.');
    } finally {
      setIsRetrying(false);
    }
  }, [bookId, generationSecret]);

  useEffect(() => {
    console.log('[read-v2] single-page reader state', {
      readerPages: readerPages.length,
      currentPageIndex,
      pageNumber: currentPage?.pageNumber,
      hasText: Boolean(currentPage?.text),
      hasImage: Boolean(currentPage?.imageUrl),
      isCover: Boolean(currentPage?.isCover),
      pageTemplate: currentPage?.pageTemplate,
      pageLayout: currentPage?.pageLayout,
      textZone: currentPage?.textZone,
    });
  }, [currentPage, currentPageIndex, readerPages.length]);

  const pageFooter = currentPage ? (
    <footer className={styles.pageFooter}>
      <span>
        עמוד {currentPageIndex + 1} מתוך {readerPages.length}
      </span>
      {bookTitle ? (
        <>
          <span className={styles.footerSep}> · </span>
          <span>{bookTitle}</span>
        </>
      ) : null}
    </footer>
  ) : null;

  // Splits Hebrew text into reading-rhythm lines:
  //  1. Honors existing newlines from the story bank if any
  //  2. Falls back to sentence-level splits (. ! ? followed by space)
  //  3. Trims and filters empty fragments
  const splitTextByRhythm = (text: string): string[] => {
    if (!text) return [' '];
    // First try: split by existing newlines if present
    const byNewline = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (byNewline.length > 1) return byNewline;
    // Fallback: split by sentence endings while keeping the punctuation
    return text
      .split(/(?<=[.!?…])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const renderInteriorPage = (page: ReaderPage) => {
    if (page.isDedication) {
      return (
        <article className={`${styles.pageCanvas} ${styles.tplDedication}`}>
          <div className={styles.dedicationPaper}>
            <span className={styles.dedicationKicker}>הקדשה</span>
            <p className={styles.dedicationText}>{page.text || ' '}</p>
            <span className={styles.dedicationOrnament}>· · ·</span>
          </div>
          {pageFooter}
        </article>
      );
    }

    if (page.pageTemplate === 'text_only') {
      return (
        <article className={`${styles.pageCanvas} ${styles.tplTextOnly}`}>
          <div className={styles.textOnlyPaper}>
            <p className={styles.paperPageText}>{page.text || ' '}</p>
          </div>
          {pageFooter}
        </article>
      );
    }

    // NOTE: vignette_breath legacy layout now falls through to the spread template
    // for visual consistency. The data field is preserved but the reader treats it
    // identically to full_bleed_soft.

    if (page.pageLayout === 'asymmetric_split') {
      return (
        <article className={`${styles.pageCanvas} ${styles.tplAsymmetricSplit}`}>
          <div className={styles.splitImageHalf}>
            {page.imageUrl ? (
              <img src={page.imageUrl} alt={`איור עמוד ${page.pageNumber}`} className={styles.splitImg} />
            ) : (
              <div className={styles.imagePlaceholder}>
                <span className={styles.imagePlaceholderIcon}>🎨</span>
                <span>איור בעיבוד</span>
              </div>
            )}
          </div>
          <div className={styles.splitTextHalf}>
            <p className={styles.splitText}>{page.text || ' '}</p>
          </div>
          {pageFooter}
        </article>
      );
    }

    if (page.pageLayout === 'letter') {
      return (
        <article className={`${styles.pageCanvas} ${styles.tplLetter}`}>
          <div className={styles.letterPortraitWrap}>
            {page.imageUrl ? (
              <img src={page.imageUrl} alt={`איור עמוד ${page.pageNumber}`} className={styles.letterPortrait} />
            ) : (
              <div className={styles.imagePlaceholder}>
                <span className={styles.imagePlaceholderIcon}>🎨</span>
                <span>איור בעיבוד</span>
              </div>
            )}
          </div>
          <div className={styles.letterPaper}>
            <p className={styles.letterText}>{page.text || ' '}</p>
          </div>
          {pageFooter}
        </article>
      );
    }

    // Default → SPREAD layout: desktop=2 pages, mobile=single page with overlay
    return (
      <article
        className={`${styles.pageCanvas} ${styles.tplSpread}`}
        data-text-zone={page.textZone}
      >
        {/* Text page — visible only on desktop (≥1024px) */}
        <div className={styles.spreadTextPage}>
          <div className={styles.spreadBodyText}>
            {splitTextByRhythm(page.text || ' ').map((line, i) => (
              <p key={i} className={styles.spreadTextLine}>{line}</p>
            ))}
          </div>
          <span className={styles.spreadPageNumber}>· {page.pageNumber} ·</span>
        </div>
        {/* Image page — visible on both, but desktop crops out textZone band via CSS */}
        <div className={styles.spreadImagePage}>
          {page.imageUrl ? (
            <img
              src={page.imageUrl}
              alt={`איור עמוד ${page.pageNumber}`}
              className={styles.spreadImg}
              onLoad={() => console.log('[read-v2] image loaded', page.imageUrl)}
              onError={(event: SyntheticEvent<HTMLImageElement, Event>) =>
                console.error('[read-v2] image failed', page.imageUrl, event)
              }
            />
          ) : (
            <div className={styles.imagePlaceholder}>
              <span className={styles.imagePlaceholderIcon}>🎨</span>
              <span>איור בעיבוד</span>
            </div>
          )}
          {/* Mobile-only overlay (hidden on desktop via CSS) */}
          <div className={styles.mobileOverlay}>
            <p className={styles.mobileBodyText}>{page.text || ' '}</p>
          </div>
        </div>
        {pageFooter}
      </article>
    );
  };

  return (
    <main className={styles.root} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <a href={readyHref} className={styles.closeBtn} aria-label="סגירה">
        ×
      </a>

      {status === 'loading' && <section className={styles.centerState}>פותחים את הספר...</section>}

      {status === 'error' && (
        <section className={styles.centerState}>
          <p className={styles.errorText}>{errorMessage}</p>
          <button type="button" className={styles.controlBtn} onClick={retryGeneration} disabled={isRetrying}>
            {isRetrying ? 'מנסים שוב...' : 'לנסות שוב'}
          </button>
          <a href={readyHref} className={styles.backHomeLink}>
            חזרה לעמוד ההזמנה
          </a>
        </section>
      )}

      {status === 'ready' && !showEndScreen && currentPage && (
        <>
          <section className={styles.pageStage}>
            {currentPage.isCover ? (
              <article className={`${styles.pageCanvas} ${styles.tplCover}`}>
                <div className={styles.coverBleed}>
                  {currentPage.imageUrl ? (
                    <img
                      src={currentPage.imageUrl}
                      alt="כריכת הספר"
                      className={styles.coverBleedImg}
                      onLoad={() => console.log('[read-v2] image loaded', currentPage.imageUrl)}
                      onError={(event: SyntheticEvent<HTMLImageElement, Event>) =>
                        console.error('[read-v2] image failed', currentPage.imageUrl, event)
                      }
                    />
                  ) : (
                    <div className={styles.imagePlaceholder}>
                      <span className={styles.imagePlaceholderIcon}>🎨</span>
                      <span>כריכה ללא איור</span>
                    </div>
                  )}
                </div>
                <div className={styles.coverTitleOverlay}>
                  <div className={styles.coverTitleGradient} aria-hidden />
                  <div className={styles.coverBrandTag}>סיפורי גיבורים קטנים</div>
                  <h1 className={styles.coverDisplayTitle}>{bookTitle || currentPage.title || 'הספר שלכם'}</h1>
                </div>
              </article>
            ) : (
              renderInteriorPage(currentPage)
            )}
          </section>

          <div className={styles.controls}>
            <button type="button" className={styles.controlBtn} onClick={prev} disabled={isFirstPage && !showEndScreen}>
              הקודם
            </button>
            {showAudioButton ? (
              <button type="button" className={styles.controlBtn} onClick={toggleAudio}>
                {isAudioPlaying ? 'השהה' : 'נגן'}
              </button>
            ) : null}
            <button type="button" className={styles.controlBtn} onClick={next}>
              {isLastPage ? 'סיום' : 'הבא'}
            </button>
          </div>
        </>
      )}

      {status === 'ready' && showEndScreen && (
        <section className={styles.centerState}>
          <div className={styles.endGlyph}>✦</div>
          <h2 className={styles.endTitle}>סוף</h2>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={() => {
              setCurrentPageIndex(0);
              setShowEndScreen(false);
            }}
          >
            קראו שוב מההתחלה
          </button>
          <a href="/" className={styles.backHomeLink}>
            חזרה לדף הבית
          </a>
        </section>
      )}

      <audio ref={audioRef} preload="metadata" hidden />
    </main>
  );
}
