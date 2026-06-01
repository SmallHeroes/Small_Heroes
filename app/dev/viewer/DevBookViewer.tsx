'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  adaptLegacyBookToStoryScenes,
  storySceneToDesktopSpread,
  storySceneToMobilePage,
  useSceneImageQueue,
  type StoryDirection,
} from '@/lib/book-layout';
import { DesktopBookSpread } from '@/app/book/[id]/read-v2/components/DesktopBookSpread';
import { MobileBookPage } from '@/app/book/[id]/read-v2/components/MobileBookPage';
import styles from '@/app/book/[id]/read-v2/reader-v2.module.css';

type LibraryEntry = {
  key: string;
  kind: 'audition' | 'order';
  label: string;
  dir?: string;
  root?: 'phase2-logs' | 'outputs';
  orderId?: string;
  accessKey?: string;
  viewerUrl?: string;
};

type PreviewPage = {
  pageNumber: number;
  text: string;
  imageUrl: string | null;
  audioUrl?: string | null;
  renderStatus?: string;
  pageTemplate?: string | null;
  pageLayout?: string | null;
  isCover?: boolean;
  isDedication?: boolean;
};

type PreviewPayload = {
  book: { title?: string; pages: PreviewPage[] };
  storyDirection?: string;
  manifestMeta?: Record<string, unknown>;
};

export function DevBookViewer({
  initialOrderId,
  initialAccessKey,
  initialDir,
  initialRoot,
}: {
  initialOrderId?: string;
  initialAccessKey?: string;
  initialDir?: string;
  initialRoot?: 'phase2-logs' | 'outputs';
}) {
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [sceneIndex, setSceneIndex] = useState(0);
  const [transitionKey, setTransitionKey] = useState(0);
  const [scenes, setScenes] = useState<ReturnType<typeof adaptLegacyBookToStoryScenes>>([]);
  const [previewPages, setPreviewPages] = useState<PreviewPage[]>([]);

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

  const loadEntry = useCallback(async (entry: LibraryEntry | null) => {
    if (!entry) return;
    setStatus('loading');
    setErrorMessage('');
    try {
      const qs = new URLSearchParams();
      if (entry.kind === 'order' && entry.orderId) {
        qs.set('orderId', entry.orderId);
      } else if (entry.dir) {
        qs.set('dir', entry.dir);
        if (entry.root) qs.set('root', entry.root);
      } else {
        throw new Error('Invalid library entry');
      }

      const res = await fetch(`/api/dev/viewer/book?${qs.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to load book');
      }
      const data = (await res.json()) as PreviewPayload;
      const pages = data.book?.pages ?? [];
      if (!pages.length) throw new Error('No pages in book');

      const storyDirection = (data.storyDirection ?? 'fantasy') as StoryDirection;

      const adapted = adaptLegacyBookToStoryScenes({
        book: {
          title: data.book.title,
          pages: pages.map((p) => ({
            pageNumber: p.pageNumber,
            text: p.text,
            imageUrl: p.imageUrl,
            audioUrl: p.audioUrl,
            layout: (p.pageLayout as 'standard' | 'wide-spread') ?? 'standard',
            illustrationAspect: 'portrait',
            textTreatment: 'standard',
            direction: storyDirection,
            pageTemplate: p.pageTemplate,
            isCover: p.isCover,
            isDedication: p.isDedication,
          })),
        },
        storyDirection,
        storyLength: 'long',
      });

      setBookTitle(data.book.title?.trim() || 'Dev viewer');
      setPreviewPages(pages);
      setScenes(adapted);
      setSceneIndex(0);
      setTransitionKey(0);
      setStatus('ready');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Load failed');
      setStatus('error');
    }
  }, []);

  const resolveInitialEntry = useCallback(
    (entries: LibraryEntry[]): LibraryEntry | null => {
      if (initialOrderId) {
        return (
          entries.find((e) => e.kind === 'order' && e.orderId === initialOrderId) ?? {
            key: `order:${initialOrderId}`,
            kind: 'order',
            label: `Order ${initialOrderId.slice(0, 8)}…`,
            orderId: initialOrderId,
            accessKey: initialAccessKey,
          }
        );
      }
      if (initialDir) {
        return (
          entries.find((e) => e.kind === 'audition' && e.dir === initialDir) ?? {
            key: `audition:${initialRoot ?? 'outputs'}:${initialDir}`,
            kind: 'audition',
            label: initialDir,
            dir: initialDir,
            root: initialRoot ?? 'outputs',
          }
        );
      }
      return entries[0] ?? null;
    },
    [initialOrderId, initialAccessKey, initialDir, initialRoot]
  );

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/dev/viewer/library', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to list library');
        const data = (await res.json()) as { entries: LibraryEntry[] };
        const entries = data.entries ?? [];
        setLibrary(entries);
        const entry = resolveInitialEntry(entries);
        if (!entry) {
          setErrorMessage('No books in library yet. Run CREATOR first.');
          setStatus('error');
          return;
        }
        setSelectedKey(entry.key);
        await loadEntry(entry);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Init failed');
        setStatus('error');
      }
    }
    init().catch(() => undefined);
  }, [loadEntry, resolveInitialEntry]);

  const onLibraryChange = (key: string) => {
    const entry = library.find((e) => e.key === key);
    if (!entry) return;
    setSelectedKey(key);
    loadEntry(entry).catch(() => undefined);
  };

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

  const isFirst = sceneIndex === 0;
  const isLast = sceneIndex >= scenes.length - 1;
  const renderLabel = currentPreviewPage?.renderStatus ?? '';
  const isPlaceholder = renderLabel === 'not rendered in this audition';

  return (
    <main className={`${styles.root} ${status === 'ready' ? styles.rootReaderReady : ''}`}>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
          zIndex: 30,
          position: 'relative',
        }}
      >
        <strong style={{ marginRight: 4 }}>VIEWER</strong>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#64748b' }}>Book</span>
          <select
            value={selectedKey}
            onChange={(e) => onLibraryChange(e.target.value)}
            style={{ padding: '4px 8px', maxWidth: 280 }}
          >
            {library.map((e) => (
              <option key={e.key} value={e.key}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <span style={{ color: '#64748b' }}>
          ‹ עמוד {sceneIndex + 1} / {scenes.length || 0} ›
        </span>
        <button type="button" onClick={goPrev} disabled={isFirst || status !== 'ready'}>
          ‹
        </button>
        <button type="button" onClick={goNext} disabled={isLast || status !== 'ready'}>
          ›
        </button>
        {currentPreviewPage?.audioUrl ? (
          <audio
            key={currentPreviewPage.audioUrl}
            controls
            src={currentPreviewPage.audioUrl}
            style={{ height: 28, maxWidth: 220 }}
          />
        ) : null}
        <Link href="/dev/creator" style={{ marginLeft: 'auto', color: '#2563eb' }}>
          open in CREATOR
        </Link>
      </header>

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
                padding: '4px 12px',
                fontSize: 12,
                fontFamily: 'sans-serif',
                color: isPlaceholder ? '#b45309' : '#166534',
                background: isPlaceholder ? '#fff7ed' : '#ecfdf5',
              }}
            >
              {isPlaceholder
                ? `עמוד ${currentPreviewPage?.pageNumber ?? sceneIndex + 1} — לא הודפס (טקסט בלבד)`
                : null}
            </div>
          ) : null}

          <section className={`${styles.pageStage} ${styles.bookStageInner}`}>
            <div className={styles.bookTableStage}>
              <div className={styles.bookSpreadWrap}>
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
                      <p dir="rtl" style={{ fontSize: 18, lineHeight: 1.6 }}>
                        {currentPreviewPage?.text ?? ''}
                      </p>
                    </div>
                  ) : currentScene.kind === 'cover' ? (
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
              </div>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
