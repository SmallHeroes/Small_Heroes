'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  adaptLegacyBookToStoryScenes,
  applyDevLayoutOverrides,
  buildRenderedBookMeta,
  splitIntoSentences,
  storySceneToDesktopSpread,
  type DevLayoutQueryFlags,
  storySceneToMobilePage,
  useSceneImageQueue,
  type StoryScene,
} from '@/lib/book-layout';
import { DesktopBookSpread } from './components/DesktopBookSpread';
import { MobileBookPage } from './components/MobileBookPage';
import { PowerCardEndScreen } from './components/PowerCardEndScreen';
import styles from './reader-v2.module.css';
import type { PowerCardRenderInput } from '@/lib/power-cards/types';

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

type OrderBookResponse = {
  id: string;
  status: string;
  childName?: string;
  storyDirection?: string | null;
  storyLength?: string | null;
  powerCard?: PowerCardRenderInput | null;
  book: {
    title?: string | null;
    coverText?: string | null;
    pages: BookPage[];
    storyScenes?: StoryScene[];
    /** Legacy: single MP3 for entire book (when no per-page audioUrl). */
    audioUrl?: string | null;
  } | null;
};

function sceneAllowsAudio(scene: StoryScene | null, fallbackBookAudio: string | null): boolean {
  if (!scene || scene.kind === 'cover' || scene.kind === 'dedication') return false;
  if (scene.effectiveTextTreatment === 'captionless') return false;
  return Boolean(scene.audioUrl ?? fallbackBookAudio);
}

type Props = {
  bookId: string;
  accessKey: string;
  /** Dev-only QA flags from query string (stripped in production). */
  devLayoutFlags?: DevLayoutQueryFlags;
};

const AUTO_PLAY_DELAY_MS = 1500;
const AUTO_ADVANCE_AFTER_NARRATION_MS = 2000;
const MIN_NO_AUDIO_DWELL_MS = 4000;
const NO_AUDIO_MS_PER_WORD = 400;

/** Dwell time on pages without narration before storytime auto-advance. */
export function storytimeNoAudioDwellMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(MIN_NO_AUDIO_DWELL_MS, words * NO_AUDIO_MS_PER_WORD);
}

export default function ReaderV2({ bookId, accessKey, devLayoutFlags = {} }: Props) {
  const resolvedAccessKey = useMemo(() => {
    if (accessKey) return accessKey;
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('accessKey') || '';
  }, [accessKey]);

  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [errorMessage, setErrorMessage] = useState('לא הצלחנו לפתוח את הספר.');
  const [bookTitle, setBookTitle] = useState('');
  const [storyScenes, setStoryScenes] = useState<StoryScene[]>([]);
  const [renderMeta, setRenderMeta] = useState<ReturnType<typeof buildRenderedBookMeta> | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [transitionKey, setTransitionKey] = useState(0);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [showPowerCardScreen, setShowPowerCardScreen] = useState(false);
  const [powerCardInput, setPowerCardInput] = useState<PowerCardRenderInput | null>(null);
  const [childName, setChildName] = useState('');
  /** Whole-book MP3 when the order has no per-page clips. */
  const [fallbackBookAudioUrl, setFallbackBookAudioUrl] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isRegeneratingPage, setIsRegeneratingPage] = useState(false);
  const [regenMessage, setRegenMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoPlayTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  /** Storytime auto-advance (default on until the user turns a page manually). */
  const storytimeAutoAdvanceRef = useRef(true);
  /** Scene the user explicitly paused — suppress auto-play until they turn the page. */
  const userPausedSceneIdRef = useRef<string | null>(null);
  const advancePageAutoRef = useRef<() => void>(() => undefined);
  const touchStartXRef = useRef<number | null>(null);
  const keyPart = resolvedAccessKey ? `&accessKey=${encodeURIComponent(resolvedAccessKey)}` : '';
  const readyHref = `/ready?orderId=${encodeURIComponent(bookId)}${keyPart}`;
  // GUY-28: never ship the generation secret to the public client. The in-reader regen control is a
  // dev/creator tool; read the secret ONLY outside production so Next dead-code-eliminates the
  // NEXT_PUBLIC reference from the prod bundle (regen is simply disabled on the public site).
  const generationSecret =
    process.env.NODE_ENV === 'production' ? undefined : process.env.NEXT_PUBLIC_GENERATION_SECRET;

  const currentScene = storyScenes[currentSceneIndex] ?? null;
  const imageUrls = useMemo(
    () => storyScenes.map((s) => s.illustration.imageUrl),
    [storyScenes]
  );
  useSceneImageQueue(imageUrls, currentSceneIndex, status === 'ready');

  const hasPerPageAudio = useMemo(() => storyScenes.some((s) => Boolean(s.audioUrl)), [storyScenes]);
  const audioSrcForCurrentScene = useMemo(() => {
    if (!currentScene || currentScene.kind === 'cover') return null;
    if (currentScene.effectiveTextTreatment === 'captionless') return null;
    return currentScene.audioUrl ?? fallbackBookAudioUrl;
  }, [currentScene, fallbackBookAudioUrl]);
  const showAudioButton = sceneAllowsAudio(currentScene, fallbackBookAudioUrl);
  const isFirstPage = currentSceneIndex === 0;
  const isLastPage = currentSceneIndex >= storyScenes.length - 1 && storyScenes.length > 0;

  const clearAutoPlayTimer = useCallback(() => {
    if (autoPlayTimerRef.current != null) {
      window.clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  }, []);

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current != null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const stopNarration = useCallback(
    (resetTime = true) => {
      clearAutoPlayTimer();
      clearAutoAdvanceTimer();
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      if (resetTime) audio.currentTime = 0;
    },
    [clearAutoAdvanceTimer, clearAutoPlayTimer]
  );

  const desktopSpread = useMemo(
    () =>
      currentScene?.kind === 'story'
        ? storySceneToDesktopSpread(currentScene, bookTitle)
        : null,
    [currentScene, bookTitle]
  );
  const mobilePage = useMemo(
    () => (currentScene ? storySceneToMobilePage(currentScene, bookTitle) : null),
    [currentScene, bookTitle]
  );

  useEffect(() => {
    if (!resolvedAccessKey) {
      setErrorMessage('נדרש קישור גישה מלא כדי לפתוח את הספר. חזרו לעמוד ההזמנה ונסו שוב.');
      setStatus('error');
      return;
    }

    async function loadBook() {
      setStatus('loading');
      setShowEndScreen(false);
      setShowPowerCardScreen(false);
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

        const scenes = applyDevLayoutOverrides(
          adaptLegacyBookToStoryScenes({
            book: {
              pages,
              title: data.book?.title,
              storyScenes: data.book?.storyScenes,
            },
            storyDirection: data.storyDirection,
            storyLength: data.storyLength,
          }),
          devLayoutFlags
        );
        if (!scenes.length) {
          setErrorMessage('לא נמצאו עמודים קריאים בספר.');
          setStatus('error');
          return;
        }

        setBookTitle(data.book?.title?.trim() || '');
        setChildName(data.childName?.trim() || '');
        setPowerCardInput(data.powerCard ?? null);
        setStoryScenes(scenes);
        setRenderMeta(buildRenderedBookMeta(scenes));
        setCurrentSceneIndex(0);
        setTransitionKey(0);
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
  }, [bookId, resolvedAccessKey, devLayoutFlags]);

  useEffect(() => () => {
    stopNarration();
    clearAutoAdvanceTimer();
  }, [clearAutoAdvanceTimer, stopNarration]);

  useEffect(() => {
    if (showEndScreen || showPowerCardScreen) {
      stopNarration();
    }
  }, [showEndScreen, showPowerCardScreen, stopNarration]);

  useEffect(() => {
    userPausedSceneIdRef.current = null;
  }, [currentSceneIndex]);

  const bumpTransition = useCallback(() => {
    setTransitionKey((k) => k + 1);
  }, []);

  /** Storytime auto-turn — never opens end/power-card screens. */
  const advancePageAuto = useCallback(() => {
    if (!storytimeAutoAdvanceRef.current) return;
    stopNarration();
    if (!storyScenes.length) return;
    if (currentSceneIndex >= storyScenes.length - 1) return;
    setShowEndScreen(false);
    setShowPowerCardScreen(false);
    bumpTransition();
    setCurrentSceneIndex((prev) => Math.min(prev + 1, storyScenes.length - 1));
  }, [bumpTransition, currentSceneIndex, stopNarration, storyScenes.length]);

  advancePageAutoRef.current = advancePageAuto;

  const nextManual = useCallback(() => {
    storytimeAutoAdvanceRef.current = false;
    clearAutoAdvanceTimer();
    stopNarration();
    if (!storyScenes.length) return;
    if (showPowerCardScreen) {
      setShowPowerCardScreen(false);
      setShowEndScreen(true);
      return;
    }
    if (isLastPage) {
      if (powerCardInput) {
        setShowPowerCardScreen(true);
      } else {
        setShowEndScreen(true);
      }
      return;
    }
    setShowEndScreen(false);
    setShowPowerCardScreen(false);
    bumpTransition();
    setCurrentSceneIndex((prev) => Math.min(prev + 1, storyScenes.length - 1));
  }, [
    bumpTransition,
    clearAutoAdvanceTimer,
    isLastPage,
    powerCardInput,
    showPowerCardScreen,
    stopNarration,
    storyScenes.length,
  ]);

  const prevManual = useCallback(() => {
    storytimeAutoAdvanceRef.current = false;
    clearAutoAdvanceTimer();
    stopNarration();
    if (showEndScreen) {
      setShowEndScreen(false);
      if (powerCardInput) {
        setShowPowerCardScreen(true);
      }
      return;
    }
    if (showPowerCardScreen) {
      setShowPowerCardScreen(false);
      return;
    }
    bumpTransition();
    setCurrentSceneIndex((prev) => Math.max(prev - 1, 0));
  }, [bumpTransition, clearAutoAdvanceTimer, powerCardInput, showEndScreen, showPowerCardScreen, stopNarration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsAudioPlaying(true);
    const onPause = () => setIsAudioPlaying(false);
    const onEnded = () => {
      setIsAudioPlaying(false);
      if (!storytimeAutoAdvanceRef.current) return;
      if (userPausedSceneIdRef.current) return;
      clearAutoAdvanceTimer();
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        autoAdvanceTimerRef.current = null;
        advancePageAutoRef.current();
      }, AUTO_ADVANCE_AFTER_NARRATION_MS);
    };
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [clearAutoAdvanceTimer]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || status !== 'ready') return;
    if (showEndScreen || showPowerCardScreen) return;

    const src = audioSrcForCurrentScene;
    const sceneId = currentScene?.sceneId ?? null;

    if (!src) {
      if (hasPerPageAudio) stopNarration();
      return;
    }

    if (userPausedSceneIdRef.current === sceneId) {
      clearAutoPlayTimer();
      audio.pause();
      return;
    }

    stopNarration();
    audio.src = src;
    audio.load();

    autoPlayTimerRef.current = window.setTimeout(() => {
      autoPlayTimerRef.current = null;
      audio.play().catch(() => {
        console.log('[read-v2] auto-play blocked, user interaction required');
      });
    }, AUTO_PLAY_DELAY_MS);

    return () => {
      clearAutoPlayTimer();
      clearAutoAdvanceTimer();
      audio.pause();
    };
  }, [
    audioSrcForCurrentScene,
    clearAutoAdvanceTimer,
    clearAutoPlayTimer,
    currentScene?.sceneId,
    currentSceneIndex,
    hasPerPageAudio,
    showEndScreen,
    showPowerCardScreen,
    status,
    stopNarration,
  ]);

  /** No-audio pages: dwell by text length, then storytime auto-advance. */
  useEffect(() => {
    if (status !== 'ready' || showEndScreen || showPowerCardScreen) return;
    if (!storytimeAutoAdvanceRef.current) return;
    if (isLastPage) return;
    if (userPausedSceneIdRef.current === currentScene?.sceneId) return;
    if (audioSrcForCurrentScene) return;

    clearAutoAdvanceTimer();
    const dwellMs = storytimeNoAudioDwellMs(currentScene?.text ?? '');
    autoAdvanceTimerRef.current = window.setTimeout(() => {
      autoAdvanceTimerRef.current = null;
      advancePageAutoRef.current();
    }, dwellMs);

    return () => clearAutoAdvanceTimer();
  }, [
    audioSrcForCurrentScene,
    clearAutoAdvanceTimer,
    currentScene?.sceneId,
    currentScene?.text,
    currentSceneIndex,
    isLastPage,
    showEndScreen,
    showPowerCardScreen,
    status,
  ]);

  const toggleAudio = useCallback(async () => {
    const audio = audioRef.current;
    const src = audioSrcForCurrentScene;
    if (!audio || !src) return;

    clearAutoPlayTimer();
    clearAutoAdvanceTimer();

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
      userPausedSceneIdRef.current = null;
      try {
        await audio.play();
      } catch {
        setIsAudioPlaying(false);
      }
      return;
    }

    userPausedSceneIdRef.current = currentScene?.sceneId ?? null;
    audio.pause();
  }, [audioSrcForCurrentScene, clearAutoAdvanceTimer, clearAutoPlayTimer, currentScene?.sceneId]);

  /**
   * RTL book navigation (desktop + keyboard):
   * - Right on-screen control / ArrowRight → previous scene (earlier page)
   * - Left on-screen control / ArrowLeft → next scene (later page)
   * Matches Hebrew reading direction: forward is toward the left.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (status !== 'ready') return;
      if (event.key === 'ArrowLeft') nextManual();
      if (event.key === 'ArrowRight') prevManual();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nextManual, prevManual, status]);

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
      if (delta > 0) nextManual();
      else prevManual();
    },
    [nextManual, prevManual]
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

  const regenCurrentPage = useCallback(async () => {
    if (!generationSecret) {
      setRegenMessage('חסר מפתח יצירה (NEXT_PUBLIC_GENERATION_SECRET).');
      return;
    }
    const scene = storyScenes[currentSceneIndex];
    if (!scene || scene.kind === 'cover' || scene.sceneIndex < 1) {
      setRegenMessage('לא ניתן לרנדר מחדש את הכריכה מכאן.');
      return;
    }

    setIsRegeneratingPage(true);
    setRegenMessage(null);
    try {
      const res = await fetch('/api/debug/regen-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: bookId,
          pageNumber: Number(scene.sceneId.replace(/\D/g, '')) || scene.sceneIndex,
          secret: generationSecret,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        newImageUrl?: string;
        promptLength?: number;
      };
      if (!res.ok) {
        throw new Error(body.error || `regen_failed_${res.status}`);
      }
      const cacheBust = body.newImageUrl
        ? `${body.newImageUrl}${body.newImageUrl.includes('?') ? '&' : '?'}t=${Date.now()}`
        : null;
      const pageNumMatch = scene.sceneId.match(/(\d+)$/);
      const pageNum = pageNumMatch ? Number(pageNumMatch[1]) : scene.sceneIndex;
      setStoryScenes((prev) =>
        prev.map((s) =>
          s.sceneId === scene.sceneId && cacheBust
            ? { ...s, illustration: { ...s.illustration, imageUrl: cacheBust } }
            : s
        )
      );
      setRegenMessage(
        body.promptLength
          ? `עמוד ${pageNum} עודכן (פרומפט: ${body.promptLength} תווים).`
          : `עמוד ${pageNum} עודכן.`
      );
    } catch (error) {
      console.error('[read-v2] regen page failed', error);
      setRegenMessage('רינדור העמוד נכשל. בדקו לוגים בשרת.');
    } finally {
      setIsRegeneratingPage(false);
    }
  }, [bookId, currentSceneIndex, generationSecret, storyScenes]);

  useEffect(() => {
    if (typeof window === 'undefined' || status !== 'ready') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const lockScroll = () => {
      const lock = mq.matches;
      document.documentElement.style.overflow = lock ? 'hidden' : '';
      document.body.style.overflow = lock ? 'hidden' : '';
    };
    lockScroll();
    mq.addEventListener('change', lockScroll);
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      mq.removeEventListener('change', lockScroll);
    };
  }, [status]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    console.log('[read-v2] book-layout reader', {
      layoutVersion: renderMeta?.layoutVersion,
      templateVersion: renderMeta?.templateVersion,
      sceneCount: renderMeta?.sceneCount,
      currentSceneIndex,
      sceneId: currentScene?.sceneId,
      kind: currentScene?.kind,
    });
  }, [currentScene, currentSceneIndex, renderMeta]);

  const sceneFooter = currentScene ? (
    <footer className={styles.pageFooter}>
      <span>
        עמוד {currentSceneIndex + 1} מתוך {storyScenes.length}
      </span>
      {bookTitle ? (
        <>
          <span className={styles.footerSep}> · </span>
          <span>{bookTitle}</span>
        </>
      ) : null}
    </footer>
  ) : null;

  const renderInteriorScene = (scene: StoryScene) => {
    if (scene.kind === 'dedication') {
      return (
        <article className={`${styles.pageCanvas} ${styles.tplDedication}`}>
          <div className={styles.dedicationPaper}>
            <span className={styles.dedicationKicker}>הקדשה</span>
            <p className={styles.dedicationText}>{scene.text || ' '}</p>
            <span className={styles.dedicationOrnament}>· · ·</span>
          </div>
          {sceneFooter}
        </article>
      );
    }

    if (!scene.illustration.imageUrl && scene.text) {
      return (
        <article className={`${styles.pageCanvas} ${styles.tplTextOnly}`}>
          <div className={styles.textOnlyPaper}>
            {splitIntoSentences(scene.text).map((sentence, i) => (
              <p key={i} className={`${styles.paperPageText} ${styles.sentence}`}>
                {sentence}
              </p>
            ))}
          </div>
          {sceneFooter}
        </article>
      );
    }

    return (
      <div key={transitionKey} className={styles.sceneTransition}>
        <div className={styles.desktopOnly}>
          {desktopSpread ? (
            <DesktopBookSpread spread={desktopSpread} isCurrent />
          ) : null}
        </div>
        <div className={styles.mobileOnly}>
          {mobilePage ? <MobileBookPage page={mobilePage} isCurrent /> : null}
          {sceneFooter}
        </div>
      </div>
    );
  };

  return (
    <main
      className={`${styles.root} ${status === 'ready' ? styles.rootReaderReady : ''}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      data-layout-version={renderMeta?.layoutVersion}
      data-template-version={renderMeta?.templateVersion}
      data-scene-count={renderMeta?.sceneCount}
      data-dev-wide-spread={devLayoutFlags.forceWideSpreadScene ?? ''}
      data-dev-wide-portrait={devLayoutFlags.forceWideSpreadPortrait ?? ''}
    >
      <a href={readyHref} className={styles.closeBtn} aria-label="סגירה" onClick={() => stopNarration()}>
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

      {status === 'ready' && !showEndScreen && !showPowerCardScreen && currentScene && (
        <>
          <section className={`${styles.pageStage} ${styles.bookStageInner}`}>
            <div className={styles.bookTableStage}>
              <div className={styles.bookSpreadWrap}>
                {/* RTL: right control = previous */}
                <button
                  type="button"
                  className={`${styles.spreadNavBtn} ${styles.spreadNavPrev}`}
                  onClick={prevManual}
                  disabled={isFirstPage}
                  aria-label="עמוד קודם"
                >
                  ‹
                </button>
                {currentScene.kind === 'cover' ? (
                  <article className={`${styles.pageCanvas} ${styles.tplCover}`}>
                    <div className={styles.coverBleed}>
                      {currentScene.illustration.imageUrl ? (
                        <img
                          src={currentScene.illustration.imageUrl}
                          alt="כריכת הספר"
                          className={styles.coverBleedImg}
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
                      <h1 className={styles.coverDisplayTitle}>
                        {bookTitle || currentScene.title || 'הספר שלכם'}
                      </h1>
                    </div>
                  </article>
                ) : (
                  renderInteriorScene(currentScene)
                )}
                {/* RTL: left control = next */}
                <button
                  type="button"
                  className={`${styles.spreadNavBtn} ${styles.spreadNavNext}`}
                  onClick={nextManual}
                  aria-label={isLastPage ? 'סיום הספר' : 'עמוד הבא'}
                >
                  ›
                </button>
              </div>
            </div>
          </section>

          <div className={styles.controls}>
            <p className={styles.controlsPageMeta} aria-live="polite">
              עמוד {currentSceneIndex + 1} מתוך {storyScenes.length}
              {bookTitle ? (
                <>
                  <span className={styles.controlsMetaSep}> · </span>
                  {bookTitle}
                </>
              ) : null}
            </p>
            <button type="button" className={styles.controlBtn} onClick={prevManual} disabled={isFirstPage && !showEndScreen && !showPowerCardScreen}>
              הקודם
            </button>
            {showAudioButton ? (
              <button type="button" className={styles.controlBtn} onClick={toggleAudio}>
                {isAudioPlaying ? (
                  <span className={styles.audioIndicator}>
                    <span className={styles.audioIndicatorDot} aria-hidden />
                    השהה
                  </span>
                ) : (
                  'נגן'
                )}
              </button>
            ) : null}
            <button type="button" className={styles.controlBtn} onClick={nextManual}>
              {isLastPage ? 'סיום' : 'הבא'}
            </button>
          </div>
          {generationSecret && currentScene && currentScene.kind === 'story' ? (
            <div className={styles.devRegenBar}>
              <button
                type="button"
                className={styles.devRegenBtn}
                onClick={regenCurrentPage}
                disabled={isRegeneratingPage}
              >
                {isRegeneratingPage ? 'מרנדר עמוד…' : 'צור עמוד מחדש'}
              </button>
              {regenMessage ? <p className={styles.devRegenMsg}>{regenMessage}</p> : null}
            </div>
          ) : null}

          <div className={styles.mobileEdgeNav} aria-hidden={showEndScreen || showPowerCardScreen}>
            <button
              type="button"
              className={styles.mobileEdgeBtn}
              onClick={prevManual}
              disabled={isFirstPage}
              aria-label="עמוד קודם"
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.mobileEdgeBtn}
              onClick={nextManual}
              aria-label={isLastPage ? 'סיום הספר' : 'עמוד הבא'}
            >
              ›
            </button>
          </div>
        </>
      )}

      {status === 'ready' && showPowerCardScreen && powerCardInput && (
        <PowerCardEndScreen
          orderId={bookId}
          accessKey={resolvedAccessKey}
          childName={childName || powerCardInput.childName}
          powerCard={powerCardInput}
          onContinue={() => {
            setShowPowerCardScreen(false);
            setShowEndScreen(true);
          }}
        />
      )}

      {status === 'ready' && showEndScreen && (
        <section className={styles.centerState}>
          <div className={styles.endGlyph}>✦</div>
          <h2 className={styles.endTitle}>סיימת! לקרוא שוב?</h2>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={() => {
              storytimeAutoAdvanceRef.current = false;
              clearAutoAdvanceTimer();
              setCurrentSceneIndex(0);
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
