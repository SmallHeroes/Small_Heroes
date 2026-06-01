'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { estimateQaConsoleCostUsd } from '@/lib/qa-console-cost';

type StoryEntry = { storyKey: string; storyFile: string; label: string; companionId: string; direction: string };
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
          setStoryKey((prev) => (prev && data.stories.some((s) => s.storyKey === prev) ? prev : data.stories[0].storyKey));
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

  const storyFile = useMemo(
    () => meta?.stories.find((s) => s.storyKey === storyKey)?.storyFile ?? '',
    [meta?.stories, storyKey]
  );

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
    <div
      style={{
        padding: '16px 20px',
        maxWidth: 960,
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        color: '#0f172a',
      }}
    >
      <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>CREATOR</h1>
      <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 13 }}>
        Dev-only · gpt-image-2 Style 01/02 · photo-faithful DNA ·{' '}
        <Link href="/dev/viewer" style={{ color: '#2563eb' }}>
          VIEWER
        </Link>
      </p>

      <fieldset
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <legend style={{ padding: '0 6px', fontWeight: 600 }}>Mode</legend>
        <label style={{ marginRight: 16 }}>
          <input
            type="radio"
            name="runMode"
            checked={mode === 'audition'}
            onChange={() => setMode('audition')}
            disabled={running}
          />{' '}
          Audition (fast — selected pages, no DB order)
        </label>
        <label>
          <input
            type="radio"
            name="runMode"
            checked={mode === 'fullBook'}
            onChange={() => setMode('fullBook')}
            disabled={running}
          />{' '}
          Full book (real order — cover + reader + audio)
        </label>
      </fieldset>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label>
          Story
          <select
            value={storyKey}
            onChange={(e) => setStoryKey(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            disabled={running}
          >
            {(meta?.stories ?? []).map((s) => (
              <option key={s.storyKey} value={s.storyKey}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Illustration style
          <select
            value={illustrationStyle}
            onChange={(e) => setIllustrationStyle(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
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
            <span style={{ fontSize: 11, color: '#64748b' }}>Audition: Style 01 engine</span>
          ) : null}
        </label>

        <label>
          Voice {generateAudio ? '' : '(off)'}
          <select
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            disabled={running || !generateAudio}
          >
            {(meta?.voices ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.emoji} {v.label}
              </option>
            ))}
          </select>
        </label>

        {mode === 'audition' ? (
          <label>
            Quality
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as 'low' | 'medium')}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
              disabled={running}
            >
              <option value="low">LOW (default)</option>
              <option value="medium">MEDIUM (guarded)</option>
            </select>
          </label>
        ) : (
          <label>
            Pages to render
            <select
              value={fullBookMaxPages}
              onChange={(e) => setFullBookMaxPages(Number(e.target.value))}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
              disabled={running}
            >
              {(meta?.fullBookPageOptions ?? [3, 5, 10]).map((n) => (
                <option key={n} value={n}>
                  {n} pages
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <span style={{ fontWeight: 600 }}>Child</span>
        <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
          {(meta?.childPresets ?? []).map((p) => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
              {p.label}
            </label>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <input
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="שם"
              style={{ padding: 6, flex: 1, minWidth: 100 }}
              disabled={running}
            />
            <select
              value={childGender}
              onChange={(e) => setChildGender(e.target.value as 'boy' | 'girl')}
              disabled={running}
            >
              <option value="girl">Girl</option>
              <option value="boy">Boy</option>
            </select>
            <input
              type="number"
              min={2}
              max={12}
              value={childAge}
              onChange={(e) => setChildAge(Number(e.target.value) || 5)}
              style={{ width: 64, padding: 6 }}
              disabled={running}
            />
          </div>
        ) : null}
      </div>

      {mode === 'audition' ? (
        <div style={{ marginTop: 12 }}>
          <span>Pages ({selectedPages.size} selected, max {meta?.maxPagesPerRun ?? 12})</span>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => applyPreset('representative10')} disabled={running}>
              Representative 10
            </button>
            <button type="button" onClick={() => applyPreset('all')} disabled={running}>
              All
            </button>
            <button type="button" onClick={() => applyPreset('clear')} disabled={running}>
              Clear
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              marginTop: 8,
              maxHeight: 100,
              overflowY: 'auto',
            }}
          >
            {pageNumbers.map((n) => (
              <label
                key={n}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 6px',
                  background: selectedPages.has(n) ? '#0d9488' : '#e2e8f0',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedPages.has(n)}
                  onChange={() => togglePage(n)}
                  disabled={running}
                  style={{ marginLeft: 4 }}
                />
                {n}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <label style={{ display: 'block', marginTop: 12 }}>
        Child photo (optional — photo-faithful DNA; temp only)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          disabled={running}
          style={{ display: 'block', marginTop: 4 }}
        />
      </label>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={generateAudio}
            onChange={(e) => setGenerateAudio(e.target.checked)}
            disabled={running}
          />
          Generate narration audio
        </label>
        {mode === 'fullBook' ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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

      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onRun}
          disabled={running || !meta}
          style={{
            padding: '10px 24px',
            background: running ? '#94a3b8' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            cursor: running ? 'wait' : 'pointer',
          }}
        >
          {running ? 'Running…' : 'Run'}
        </button>
        {mode === 'audition' && costEstimate != null ? (
          <span style={{ fontSize: 12, color: '#64748b' }}>Est. ~${costEstimate.toFixed(3)}</span>
        ) : null}
      </div>

      {error ? (
        <p style={{ color: '#dc2626', marginTop: 12 }} role="alert">
          {error}
        </p>
      ) : null}
      {lastRunInfo ? <p style={{ color: '#15803d', marginTop: 8, fontSize: 13 }}>{lastRunInfo}</p> : null}
      {viewerLink ? (
        <p style={{ marginTop: 8 }}>
          <Link href={viewerLink} style={{ color: '#2563eb', fontWeight: 600 }}>
            Open in VIEWER →
          </Link>
        </p>
      ) : null}
    </div>
  );
}
