'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adaptLegacyBookToStoryScenes,
  storySceneToDesktopSpread,
  storySceneToMobilePage,
  useSceneImageQueue,
} from '@/lib/book-layout';
import { DesktopBookSpread } from '@/app/book/[id]/read-v2/components/DesktopBookSpread';
import { MobileBookPage } from '@/app/book/[id]/read-v2/components/MobileBookPage';
import styles from '@/app/book/[id]/read-v2/reader-v2.module.css';

type AuditionSummary = {
  dir: string;
  root?: 'phase2-logs' | 'outputs';
  mtimeMs: number;
  pageCount: number;
  audition?: string;
  quality?: string;
};

type PreviewPage = {
  pageNumber: number;
  text: string;
  imageUrl: string | null;
  renderStatus?: 'rendered' | 'not rendered in this audition';
};

type PreviewPayload = {
  book: { title?: string; pages: PreviewPage[] };
  storyDirection?: string;
  manifestMeta?: {
    renderedPageNumbers?: number[];
    totalStoryPages?: number;
  };
};

export function Style01BookPreviewClient({
  initialDir,
  initialRoot,
}: {
  initialDir?: string;
  initialRoot?: 'phase2-logs' | 'outputs';
}) {
  const [auditions, setAuditions] = useState<AuditionSummary[]>([]);
  const [selectedDir, setSelectedDir] = useState(initialDir ?? '');
  const [selectedRoot, setSelectedRoot] = useState<'phase2-logs' | 'outputs' | undefined>(
    initialRoot
  );
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [sceneIndex, setSceneIndex] = useState(0);
  const [transitionKey, setTransitionKey] = useState(0);
  const [scenes, setScenes] = useState<ReturnType<typeof adaptLegacyBookToStoryScenes>>([]);
  const [previewPages, setPreviewPages] = useState<PreviewPage[]>([]);
  const [manifestMeta, setManifestMeta] = useState<PreviewPayload['manifestMeta']>();

  const currentScene = scenes[sceneIndex] ?? null;
  const currentPreviewPage = previewPages[sceneIndex];
  const imageUrls = useMemo(() => scenes.map((s) => s.illustration.imageUrl), [scenes]);
  useSceneImageQueue(imageUrls, sceneIndex, status === 'ready' && scenes.length > 0);

  const desktopSpread = useMemo(
    () => (currentScene?.kind === 'story' ? storySceneToDesktopSpread(currentScene, bookTitle) : null),
    [currentScene, bookTitle]
  );
  const mobilePage = useMemo(
    () => (currentScene ? storySceneToMobilePage(currentScene, bookTitle) : null),
    [currentScene, bookTitle]
  );

  const loadBook = useCallback(async (dir: string, root?: 'phase2-logs' | 'outputs') => {
    if (!dir) return;
    setStatus('loading');
    setErrorMessage('');
    try {
      const qs = new URLSearchParams({ dir });
      if (root) qs.set('root', root);
      const res = await fetch(`/api/dev/style01-book-preview?${qs.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to load book');
      }
      const data = (await res.json()) as PreviewPayload;
      const pages = data.book?.pages ?? [];
      if (!pages.length) throw new Error('No pages in manifest');

      const adapted = adaptLegacyBookToStoryScenes({
        book: {
          title: data.book.title,
          pages: pages.map((p) => ({
            pageNumber: p.pageNumber,
            text: p.text,
            imageUrl: p.imageUrl,
            layout: 'standard',
            illustrationAspect: 'portrait',
            textTreatment: 'standard',
            direction: 'fantasy',
          })),
        },
        storyDirection: data.storyDirection ?? 'fantasy',
        storyLength: 'long',
      });

      setBookTitle(data.book.title?.trim() || 'Style 01 Dini preview');
      setPreviewPages(pages);
      setManifestMeta(data.manifestMeta);
      setScenes(adapted);
      setSceneIndex(0);
      setTransitionKey(0);
      setStatus('ready');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Load failed');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/dev/style01-book-preview', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to list auditions');
        const data = (await res.json()) as { auditions: AuditionSummary[] };
        setAuditions(data.auditions ?? []);
        const dir = initialDir || data.auditions?.[0]?.dir || '';
        const root = initialRoot || data.auditions?.[0]?.root;
        if (dir) {
          setSelectedDir(dir);
          setSelectedRoot(root);
          await loadBook(dir, root);
        } else {
          setErrorMessage(
            'No Dini audition logs found. Run scripts/run-style01-dini-audition.ts first.'
          );
          setStatus('error');
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Init failed');
        setStatus('error');
      }
    }
    init().catch(() => undefined);
  }, [initialDir, initialRoot, loadBook]);

  const goPrev = () => {
    if (sceneIndex <= 0) return;
    setSceneIndex((i) => i - 1);
    setTransitionKey((k) => k + 1);
  };

  const goNext = () => {
    if (sceneIndex >= scenes.length - 1) return;
    setSceneIndex((i) => i + 1);
    setTransitionKey((k) => k + 1);
  };

  const onDirChange = (dir: string) => {
    const entry = auditions.find((a) => a.dir === dir);
    setSelectedDir(dir);
    setSelectedRoot(entry?.root);
    loadBook(dir, entry?.root).catch(() => undefined);
  };

  const isFirst = sceneIndex === 0;
  const isLast = sceneIndex >= scenes.length - 1;
  const renderLabel = currentPreviewPage?.renderStatus ?? '';
  const isPlaceholder = renderLabel === 'not rendered in this audition';

  return (
    <main className={`${styles.root} ${status === 'ready' ? styles.rootReaderReady : ''}`}>
      <div
        style={{
          padding: '10px 16px',
          background: '#1a1a2e',
          color: '#fff',
          fontFamily: 'sans-serif',
          zIndex: 20,
          position: 'relative',
        }}
      >
        <strong>Style 01 Dini — boundary-egg book preview (dev)</strong>
        <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.85 }}>
          {manifestMeta?.totalStoryPages ?? 20} story pages · rendered in this run:{' '}
          {(manifestMeta?.renderedPageNumbers ?? []).join(', ') || '—'}
        </p>
        <label style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
          Audition manifest:
          <select
            value={selectedDir}
            onChange={(e) => onDirChange(e.target.value)}
            style={{ display: 'block', marginTop: 4, padding: 8, minWidth: 280, maxWidth: '100%' }}
          >
            {auditions.map((a) => (
              <option key={`${a.root ?? 'auto'}:${a.dir}`} value={a.dir}>
                {a.dir} ({a.pageCount} rendered{a.quality ? ` · ${a.quality}` : ''})
              </option>
            ))}
          </select>
        </label>
      </div>

      {status === 'loading' ? <section className={styles.centerState}>טוען ספר…</section> : null}

      {status === 'error' ? (
        <section className={styles.centerState}>
          <p className={styles.errorText}>{errorMessage}</p>
        </section>
      ) : null}

      {status === 'ready' && currentScene ? (
        <>
          {renderLabel ? (
            <div
              style={{
                textAlign: 'center',
                padding: '6px 12px',
                fontSize: 12,
                fontFamily: 'sans-serif',
                color: isPlaceholder ? '#b45309' : '#166534',
                background: isPlaceholder ? '#fff7ed' : '#ecfdf5',
              }}
            >
              {isPlaceholder
                ? `עמוד ${currentPreviewPage?.pageNumber ?? sceneIndex + 1} — לא הודפס באודישן הזה (טקסט בלבד)`
                : `עמוד ${currentPreviewPage?.pageNumber ?? sceneIndex + 1} — rendered`}
            </div>
          ) : null}

          <section className={`${styles.pageStage} ${styles.bookStageInner}`}>
            <div className={styles.bookTableStage}>
              <div className={styles.bookSpreadWrap}>
                <button
                  type="button"
                  className={`${styles.spreadNavBtn} ${styles.spreadNavPrev}`}
                  onClick={goPrev}
                  disabled={isFirst}
                  aria-label="עמוד קודם"
                >
                  ‹
                </button>
                <div key={transitionKey} className={styles.sceneTransition}>
                  {isPlaceholder ? (
                    <div
                      className={styles.centerState}
                      style={{
                        minHeight: 320,
                        background: 'linear-gradient(135deg, #f5f0e8 0%, #e8dfd0 100%)',
                        borderRadius: 8,
                        margin: '0 auto',
                        maxWidth: 720,
                        padding: 24,
                      }}
                    >
                      <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 12 }}>
                        Placeholder — לא הודפס באודישן
                      </p>
                      <p dir="rtl" style={{ fontSize: 18, lineHeight: 1.6 }}>
                        {currentPreviewPage?.text ?? ''}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className={styles.desktopOnly}>
                        {desktopSpread ? <DesktopBookSpread spread={desktopSpread} isCurrent /> : null}
                      </div>
                      <div className={styles.mobileOnly}>
                        {mobilePage ? <MobileBookPage page={mobilePage} isCurrent /> : null}
                      </div>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className={`${styles.spreadNavBtn} ${styles.spreadNavNext}`}
                  onClick={goNext}
                  disabled={isLast}
                  aria-label="עמוד הבא"
                >
                  ›
                </button>
              </div>
            </div>
          </section>

          <div className={styles.controls}>
            <p className={styles.controlsPageMeta} aria-live="polite">
              עמוד {sceneIndex + 1} מתוך {scenes.length}
              {bookTitle ? (
                <>
                  <span className={styles.controlsMetaSep}> · </span>
                  {bookTitle}
                </>
              ) : null}
            </p>
            <button type="button" className={styles.controlBtn} onClick={goPrev} disabled={isFirst}>
              הקודם
            </button>
            <button type="button" className={styles.controlBtn} onClick={goNext} disabled={isLast}>
              הבא
            </button>
          </div>
        </>
      ) : null}
    </main>
  );
}
