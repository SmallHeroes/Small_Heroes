'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { estimateQaConsoleCostUsd } from '@/lib/qa-console-cost';

type StoryEntry = { storyKey: string; label: string; companionId: string; direction: string };
type VoiceEntry = { id: string; label: string; description: string; emoji: string };
type ChildPreset = { id: string; label: string; gender: string; age: number };

type MetaResponse = {
  stories: StoryEntry[];
  voices: VoiceEntry[];
  childPresets: ChildPreset[];
  pagePresets: { representative10: number[] };
  maxPagesPerRun: number;
  defaultQuality: 'low' | 'medium';
  allowedQualities: Array<'low' | 'medium'>;
};

export function QaConsolePanel({
  onRunComplete,
}: {
  onRunComplete: (dir: string) => void;
}) {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [storyKey, setStoryKey] = useState('dragon_dini_fantasy');
  const [totalPages, setTotalPages] = useState(20);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(
    () => new Set([1, 2, 13, 20])
  );
  const [childPreset, setChildPreset] = useState<'noam' | 'mia'>('mia');
  const [voiceId, setVoiceId] = useState('mom');
  const [quality, setQuality] = useState<'low' | 'medium'>('low');
  const [generateAudio, setGenerateAudio] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [lastRunInfo, setLastRunInfo] = useState('');

  useEffect(() => {
    fetch('/api/dev/qa-console/meta', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: MetaResponse) => {
        setMeta(data);
        if (data.stories?.length && !data.stories.some((s) => s.storyKey === storyKey)) {
          setStoryKey(data.stories[0].storyKey);
        }
        if (data.voices?.length) setVoiceId(data.voices[0].id);
      })
      .catch(() => setError('Failed to load QA console metadata'));
  }, [storyKey]);

  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, i) => i + 1),
    [totalPages]
  );

  const costEstimate = useMemo(() => {
    const n = selectedPages.size;
    if (!n) return 0;
    return estimateQaConsoleCostUsd(n, quality, generateAudio);
  }, [selectedPages.size, quality, generateAudio]);

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
    if (!meta) return;
    const pages = [...selectedPages].sort((a, b) => a - b);
    if (!pages.length) {
      setError('Select at least one page');
      return;
    }
    if (pages.length > meta.maxPagesPerRun) {
      setError(`Maximum ${meta.maxPagesPerRun} pages per run`);
      return;
    }
    if (quality === 'medium') {
      const ok = window.confirm(
        'MEDIUM quality costs more than LOW. Continue with MEDIUM for this run?'
      );
      if (!ok) return;
    }

    setRunning(true);
    setError('');
    try {
      let childPhotoBase64: string | undefined;
      if (photoFile) {
        childPhotoBase64 = await fileToDataUrl(photoFile);
      }

      const res = await fetch('/api/dev/qa-console/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyKey,
          pages,
          childPreset,
          childPhotoBase64,
          quality,
          voiceId: generateAudio ? voiceId : null,
          generateAudio,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        manifestDir?: string;
        model?: string;
        quality?: string;
        estimatedCostUsd?: number;
        runtimeMs?: number;
      };
      if (!res.ok) throw new Error(data.error || 'Run failed');

      if (data.manifestDir) {
        setLastRunInfo(
          `Run ${data.manifestDir} · ${data.model} · ${data.quality} · ~$${(data.estimatedCostUsd ?? costEstimate).toFixed(3)} · ${Math.round((data.runtimeMs ?? 0) / 1000)}s`
        );
        onRunComplete(data.manifestDir);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }, [
    meta,
    selectedPages,
    quality,
    photoFile,
    storyKey,
    childPreset,
    voiceId,
    generateAudio,
    costEstimate,
    onRunComplete,
  ]);

  useEffect(() => {
    const story = meta?.stories.find((s) => s.storyKey === storyKey);
    if (story?.companionId === 'dragon_dini' && story.direction === 'fantasy') {
      setTotalPages(20);
    } else {
      setTotalPages(20);
    }
  }, [storyKey, meta?.stories]);

  return (
    <div
      style={{
        padding: '12px 16px',
        background: '#16213e',
        color: '#e8e8e8',
        fontFamily: 'sans-serif',
        fontSize: 13,
        borderBottom: '1px solid #334',
      }}
    >
      <strong>QA console — Style 01 run</strong>
      <p style={{ margin: '4px 0 10px', opacity: 0.85, fontSize: 12 }}>
        Dev-only · gpt-image-2 · photo-faithful DNA · max {meta?.maxPagesPerRun ?? 12} pages/run
      </p>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <label>
          Story
          <select
            value={storyKey}
            onChange={(e) => setStoryKey(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
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
          Child
          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {(meta?.childPresets ?? []).map((p) => (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="radio"
                  name="childPreset"
                  checked={childPreset === p.id}
                  onChange={() => setChildPreset(p.id as 'noam' | 'mia')}
                  disabled={running}
                />
                {p.label}
              </label>
            ))}
          </div>
        </label>

        <label>
          Voice {generateAudio ? '' : '(audio off)'}
          <select
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
            disabled={running || !generateAudio}
          >
            {(meta?.voices ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.emoji} {v.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Quality
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as 'low' | 'medium')}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
            disabled={running}
          >
            <option value="low">LOW (default)</option>
            <option value="medium">MEDIUM (confirm)</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: 10 }}>
        <span>Pages ({selectedPages.size} selected)</span>
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
                background: selectedPages.has(n) ? '#0f766e' : '#333',
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

      <label style={{ display: 'block', marginTop: 10 }}>
        Child photo (optional — photo-faithful DNA; not stored in git)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          disabled={running}
          style={{ display: 'block', marginTop: 4, maxWidth: '100%' }}
        />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <input
          type="checkbox"
          checked={generateAudio}
          onChange={(e) => setGenerateAudio(e.target.checked)}
          disabled={running}
        />
        Generate narration audio (ElevenLabs)
      </label>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onRun}
          disabled={running || !meta}
          style={{
            padding: '8px 20px',
            background: running ? '#555' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            cursor: running ? 'wait' : 'pointer',
          }}
        >
          {running ? 'Running…' : 'Run'}
        </button>
        <span style={{ fontSize: 12, opacity: 0.9 }}>
          Est. ~${costEstimate.toFixed(3)} · model gpt-image-2 · quality {quality}
        </span>
      </div>

      {error ? (
        <p style={{ color: '#fca5a5', marginTop: 10, marginBottom: 0 }} role="alert">
          {error}
        </p>
      ) : null}
      {lastRunInfo ? (
        <p style={{ color: '#86efac', marginTop: 8, marginBottom: 0, fontSize: 12 }}>{lastRunInfo}</p>
      ) : null}
    </div>
  );
}
