'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { estimateQaConsoleCostUsd } from '@/lib/qa-console-cost';
import styles from './creator-panel.module.css';

type StoryEntry = {
  storyKey: string;
  storyFile: string;
  label: string;
  companionId: string;
  direction: string;
  bankDir?: 'v3-approved';
  source?: string;
};
type VoiceEntry = { id: string; label: string; description: string; emoji: string };
type StyleEntry = { id: string; label: string; blurb: string };
type ChildPreset = { id: string; label: string; gender: string; age: number };

type MetaResponse = {
  stories: StoryEntry[];
  voices: VoiceEntry[];
  illustrationStyles: StyleEntry[];
  childPresets: ChildPreset[];
  pagePresets: { representative10: number[] };
  maxPagesPerRun: number;
  fullBookPageOptions: number[];
  defaultQuality: 'low' | 'medium';
  allowedQualities: Array<'low' | 'medium'>;
};

type RunMode = 'audition' | 'fullBook';

export function CreatorPanel() {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [mode, setMode] = useState<RunMode>('audition');
  const [storyKey, setStoryKey] = useState('');
  const [illustrationStyle, setIllustrationStyle] = useState('soft_hand_drawn_storybook');
  const [totalPages, setTotalPages] = useState(20);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(() => new Set([1, 2, 13, 20]));
  const [childPreset, setChildPreset] = useState<'noam' | 'mia' | 'custom'>('mia');
  const [childName, setChildName] = useState('מיה');
  const [childGender, setChildGender] = useState<'boy' | 'girl'>('girl');
  const [childAge, setChildAge] = useState(8);
  const [voiceId, setVoiceId] = useState('mom');
  const [quality, setQuality] = useState<'low' | 'medium'>('low');
  const [generateAudio, setGenerateAudio] = useState(true);
  const [skipCover, setSkipCover] = useState(false);
  const [fullBookMaxPages, setFullBookMaxPages] = useState(3);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [lastRunInfo, setLastRunInfo] = useState('');
  const [viewerLink, setViewerLink] = useState('');

  useEffect(() => {
    fetch('/api/dev/creator/meta', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: MetaResponse) => {
        setMeta(data);
        if (data.stories?.length) {
          setStoryKey((prev) => {
            if (prev && data.stories.some((s) => s.storyKey === prev)) return prev;
            const foxV3 = data.stories.find((s) => s.storyKey === 'fox_uri_adventure@v3-approved');
            return foxV3?.storyKey ?? data.stories[0].storyKey;
          });
        }
        if (data.voices?.length) setVoiceId(data.voices[0].id);
        if (data.illustrationStyles?.length) {
          setIllustrationStyle((prev) =>
            prev && data.illustrationStyles.some((s) => s.id === prev)
              ? prev
              : data.illustrationStyles[0].id
          );
        }
        if (data.fullBookPageOptions?.length) {
          setFullBookMaxPages(data.fullBookPageOptions[0] ?? 3);
        }
      })
      .catch(() => setError('Failed to load CREATOR metadata'));
  }, []);

  const selectedStory = useMemo(
    () => meta?.stories.find((s) => s.storyKey === storyKey) ?? null,
    [meta?.stories, storyKey]
  );

  const storyFile = useMemo(() => selectedStory?.storyFile ?? '', [selectedStory]);

  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, i) => i + 1),
    [totalPages]
  );

  const costEstimate = useMemo(() => {
    if (mode === 'fullBook') return null;
    const n = selectedPages.size;
    if (!n) return 0;
    return estimateQaConsoleCostUsd(n, quality, generateAudio);
  }, [mode, selectedPages.size, quality, generateAudio]);

  const maxPagesPerRun = meta?.maxPagesPerRun ?? 12;

  const togglePage = (n: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const applyPreset = (preset: 'representative10' | 'all' | 'clear') => {
    if (preset === 'clear') {
      setSelectedPages(new Set());
      return;
    }
    if (preset === 'all') {
      setSelectedPages(new Set(pageNumbers));
      return;
    }
    const rep = meta?.pagePresets.representative10 ?? [1, 2, 3, 4, 5, 8, 13, 15, 16, 20];
    setSelectedPages(new Set(rep.filter((p) => p <= totalPages)));
  };

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read photo file'));
      reader.readAsDataURL(file);
    });

  const onRun = useCallback(async () => {
    if (!meta || !storyFile) return;
    if (quality === 'medium') {
      const ok = window.confirm('MEDIUM quality costs more than LOW. Continue?');
      if (!ok) return;
    }

    setRunning(true);
    setError('');
    setViewerLink('');
    try {
      let childPhotoBase64: string | undefined;
      if (photoFile) {
        childPhotoBase64 = await fileToDataUrl(photoFile);
      }

      const preset = meta.childPresets.find((p) => p.id === childPreset);
      const resolvedName =
        childPreset === 'custom' ? childName.trim() : preset?.label.split(' ')[0] ?? childName;
      const resolvedGender =
        childPreset === 'custom' ? childGender : preset?.gender === 'girl' ? 'girl' : 'boy';
      const resolvedAge =
        childPreset === 'custom' ? childAge : preset?.age ?? 5;

      if (mode === 'audition') {
        const pages = [...selectedPages].sort((a, b) => a - b);
        if (!pages.length) throw new Error('Select at least one page');
        if (pages.length > meta.maxPagesPerRun) {
          throw new Error(`Maximum ${meta.maxPagesPerRun} pages per audition run`);
        }

        const body: Record<string, unknown> = {
          storyKey,
          pages,
          quality,
          voiceId: generateAudio ? voiceId : null,
          generateAudio,
          childPhotoBase64,
        };
        if (childPreset === 'noam' || childPreset === 'mia') {
          body.childPreset = childPreset;
        } else {
          body.child = { name: resolvedName, gender: resolvedGender, age: resolvedAge };
        }

        const res = await fetch('/api/dev/qa-console/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as {
          error?: string;
          previewUrl?: string;
          manifestDir?: string;
          model?: string;
          estimatedCostUsd?: number;
          runtimeMs?: number;
        };
        if (!res.ok) throw new Error(data.error || 'Run failed');

        const link = data.previewUrl ?? `/dev/viewer?dir=${encodeURIComponent(data.manifestDir ?? '')}&root=outputs`;
        setViewerLink(link);
        setLastRunInfo(
          `Audition ${data.manifestDir ?? ''} · ${data.model ?? 'gpt-image-2'} · ~$${(data.estimatedCostUsd ?? 0).toFixed(3)} · ${Math.round((data.runtimeMs ?? 0) / 1000)}s`
        );
      } else {
        const res = await fetch('/api/dev/story-bank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storyFile,
            childName: resolvedName,
            childGender: resolvedGender,
            childAge: resolvedAge,
            illustrationStyle,
            maxPages: fullBookMaxPages,
            skipCover,
            generateAudio,
            voiceId: generateAudio ? voiceId : null,
            childPhotoBase64,
            ...(selectedStory?.bankDir === 'v3-approved' ? { bankDir: 'v3-approved' } : {}),
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          viewerUrl?: string;
          orderId?: string;
          pagesRendered?: number;
          orderStatus?: string;
        };
        if (!res.ok) throw new Error(data.error || 'Full book failed');

        const link =
          data.viewerUrl ??
          (data.orderId
            ? `/dev/viewer?orderId=${encodeURIComponent(data.orderId)}`
            : '/dev/viewer');
        setViewerLink(link);
        setLastRunInfo(
          `Full book order ${data.orderId?.slice(0, 8) ?? ''} · ${data.pagesRendered ?? 0} pages · ${data.orderStatus ?? ''}`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }, [
    meta,
    mode,
    selectedPages,
    quality,
    photoFile,
    storyKey,
    storyFile,
    childPreset,
    childName,
    childGender,
    childAge,
    voiceId,
    generateAudio,
    illustrationStyle,
    selectedStory,
    fullBookMaxPages,
    skipCover,
  ]);

  useEffect(() => {
    if (storyKey.includes('dragon_dini') && storyKey.includes('fantasy')) {
      setTotalPages(20);
    } else {
      setTotalPages(20);
    }
  }, [storyKey]);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>CREATOR</h1>
          <p className={styles.headerSubtitle}>dev-only · chunked pipeline · gpt-image-2 LOW default</p>
        </div>
        <Link href="/dev/viewer" className={styles.viewerLink}>
          VIEWER →
        </Link>
      </header>

      <div className={styles.card}>
        <section className={styles.section}>
          <span className={styles.sectionLabel}>Mode</span>
          <div className={styles.modeGrid}>
            <label
              className={`${styles.modeCard} ${mode === 'audition' ? styles.modeCardSelected : ''}`}
            >
              <input
                type="radio"
                name="runMode"
                checked={mode === 'audition'}
                onChange={() => setMode('audition')}
                disabled={running}
              />
              <span className={styles.modeCardTitle}>Audition</span>
              <span className={styles.modeCardDesc}>Fast · selected pages · no DB</span>
            </label>
            <label
              className={`${styles.modeCard} ${mode === 'fullBook' ? styles.modeCardSelected : ''}`}
            >
              <input
                type="radio"
                name="runMode"
                checked={mode === 'fullBook'}
                onChange={() => setMode('fullBook')}
                disabled={running}
              />
              <span className={styles.modeCardTitle}>Full book</span>
              <span className={styles.modeCardDesc}>Real order · cover + reader + audio</span>
            </label>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionBorder}`}>
          <div className={styles.selectGrid}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="creator-story">
                Story
              </label>
              <select
                id="creator-story"
                className={styles.select}
                value={storyKey}
                onChange={(e) => setStoryKey(e.target.value)}
                disabled={running}
              >
                {(meta?.stories ?? []).map((s) => (
                  <option key={s.storyKey} value={s.storyKey}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="creator-style">
                Illustration style
              </label>
              <select
                id="creator-style"
                className={styles.select}
                value={illustrationStyle}
                onChange={(e) => setIllustrationStyle(e.target.value)}
                disabled={running || mode === 'audition'}
                title={mode === 'audition' ? 'Audition fast path uses Style 01 phase-2' : ''}
              >
                {(meta?.illustrationStyles ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              {mode === 'audition' ? (
                <span className={styles.fieldHint}>Audition uses Style 01 engine</span>
              ) : null}
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="creator-voice">
                Voice
              </label>
              <select
                id="creator-voice"
                className={styles.select}
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                disabled={running || !generateAudio}
              >
                {(meta?.voices ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.emoji} {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              {mode === 'audition' ? (
                <>
                  <label className={styles.fieldLabel} htmlFor="creator-quality">
                    Quality
                  </label>
                  <select
                    id="creator-quality"
                    className={styles.select}
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as 'low' | 'medium')}
                    disabled={running}
                  >
                    <option value="low">Low (default)</option>
                    <option value="medium">Medium (guarded)</option>
                  </select>
                </>
              ) : (
                <>
                  <label className={styles.fieldLabel} htmlFor="creator-pages-count">
                    Pages to render
                  </label>
                  <select
                    id="creator-pages-count"
                    className={styles.select}
                    value={fullBookMaxPages}
                    onChange={(e) => setFullBookMaxPages(Number(e.target.value))}
                    disabled={running}
                  >
                    {(meta?.fullBookPageOptions ?? [3, 5, 10]).map((n) => (
                      <option key={n} value={n}>
                        {n} pages
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionBorder}`}>
          <span className={styles.sectionLabel}>Child</span>
          <div className={styles.childRadioRow}>
            {(meta?.childPresets ?? []).map((p) => (
              <label key={p.id} className={styles.childRadio}>
                <input
                  type="radio"
                  name="childPreset"
                  checked={childPreset === p.id}
                  onChange={() => {
                    setChildPreset(p.id as 'noam' | 'mia');
                    setChildName(p.label.split(' ')[0] ?? p.id);
                    setChildGender(p.gender === 'girl' ? 'girl' : 'boy');
                    setChildAge(p.age);
                  }}
                  disabled={running}
                />
                {p.id === 'noam' ? 'נועם' : p.id === 'mia' ? 'מיה' : p.label}
              </label>
            ))}
            <label className={styles.childRadio}>
              <input
                type="radio"
                name="childPreset"
                checked={childPreset === 'custom'}
                onChange={() => setChildPreset('custom')}
                disabled={running}
              />
              Custom
            </label>
          </div>

          {childPreset === 'custom' ? (
            <div className={styles.customChildGrid}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="creator-child-name">
                  Name
                </label>
                <input
                  id="creator-child-name"
                  className={styles.input}
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  disabled={running}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="creator-child-gender">
                  Gender
                </label>
                <select
                  id="creator-child-gender"
                  className={styles.select}
                  value={childGender}
                  onChange={(e) => setChildGender(e.target.value as 'boy' | 'girl')}
                  disabled={running}
                >
                  <option value="girl">Girl</option>
                  <option value="boy">Boy</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="creator-child-age">
                  Age
                </label>
                <input
                  id="creator-child-age"
                  type="number"
                  min={2}
                  max={12}
                  className={styles.numberInput}
                  value={childAge}
                  onChange={(e) => setChildAge(Number(e.target.value) || 5)}
                  disabled={running}
                />
              </div>
            </div>
          ) : null}
        </section>

        {mode === 'audition' ? (
          <section className={`${styles.section} ${styles.sectionBorder}`}>
            <div className={styles.pagesHeader}>
              <div className={styles.pagesHeaderLeft}>
                <span className={styles.sectionLabel} style={{ marginBottom: 0 }}>
                  Pages to render
                </span>
                <span className={styles.pagesCaption}>
                  {selectedPages.size} selected · max {maxPagesPerRun}
                </span>
              </div>
              <div className={styles.presetRow}>
                <button
                  type="button"
                  className={styles.presetBtn}
                  onClick={() => applyPreset('clear')}
                  disabled={running}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className={styles.presetBtn}
                  onClick={() => applyPreset('all')}
                  disabled={running}
                >
                  All
                </button>
                <button
                  type="button"
                  className={styles.presetBtn}
                  onClick={() => applyPreset('representative10')}
                  disabled={running}
                >
                  Representative 10
                </button>
              </div>
            </div>
            <div className={styles.chipRow}>
              {pageNumbers.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`${styles.chip} ${selectedPages.has(n) ? styles.chipSelected : ''}`}
                  onClick={() => togglePage(n)}
                  disabled={running}
                  aria-pressed={selectedPages.has(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className={`${styles.section} ${styles.sectionBorder}`}>
          <div className={styles.optionsRow}>
            <label className={styles.uploadBtn}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                disabled={running}
              />
              Child photo
            </label>
            {photoFile ? <span className={styles.uploadFileName}>{photoFile.name}</span> : null}
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={generateAudio}
                onChange={(e) => setGenerateAudio(e.target.checked)}
                disabled={running}
              />
              Generate narration audio
            </label>
            {mode === 'fullBook' ? (
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={skipCover}
                  onChange={(e) => setSkipCover(e.target.checked)}
                  disabled={running}
                />
                Skip cover
              </label>
            ) : null}
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionBorder}`}>
          <div className={styles.footer}>
            <span className={styles.costEstimate}>
              {mode === 'audition' && costEstimate != null
                ? `Est. ~$${costEstimate.toFixed(3)}`
                : mode === 'fullBook'
                  ? 'Full book — cost varies by page count'
                  : ''}
            </span>
            <button
              type="button"
              className={styles.runBtn}
              onClick={onRun}
              disabled={running || !meta}
            >
              {running ? 'Running…' : 'Run'}
            </button>
          </div>
        </section>

        {error || lastRunInfo || viewerLink ? (
          <div className={styles.statusBlock}>
            {error ? (
              <p className={styles.alertError} role="alert">
                {error}
              </p>
            ) : null}
            {lastRunInfo ? <p className={styles.alertSuccess}>{lastRunInfo}</p> : null}
            {viewerLink ? (
              <p>
                <Link href={viewerLink} className={styles.resultLink}>
                  Open in VIEWER →
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
