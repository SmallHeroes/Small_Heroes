'use client';

import { useMemo, useState } from 'react';
import {
  GOLDEN_SHELF_CATALOG,
  GOLDEN_SHELF_DIRECTION_LABELS,
  GOLDEN_SHELF_PAGE_OPTIONS,
  goldenShelfCompanionLabel,
  goldenShelfStoryFile,
  type GoldenShelfDirection,
} from '@/lib/power-cards/golden-shelf-catalog';

const DEFAULT_STORY = goldenShelfStoryFile('bear_cub_gahal_adventure');

export default function StoryBankDevPage() {
  const [storyFile, setStoryFile] = useState(DEFAULT_STORY);
  const [childName, setChildName] = useState('בר');
  const [childGender, setChildGender] = useState('boy');
  const [illustrationStyle, setIllustrationStyle] = useState('soft_hand_drawn_storybook');
  const [maxPages, setMaxPages] = useState<number>(3);
  const [skipCover, setSkipCover] = useState(false);
  const [generateAudio, setGenerateAudio] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{
    bookUrl?: string;
    pagesRendered?: number;
    pagesFailed?: number[];
    orderStatus?: string;
    storyDirection?: string;
    error?: string;
  } | null>(null);

  const companionCount = useMemo(
    () =>
      GOLDEN_SHELF_CATALOG.bedtime.length +
      GOLDEN_SHELF_CATALOG.adventure.length +
      GOLDEN_SHELF_CATALOG.fantasy.length,
    []
  );

  async function handleGenerate() {
    setStatus('loading');
    setResult(null);
    try {
      const res = await fetch('/api/dev/story-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyFile,
          childName,
          childGender,
          illustrationStyle,
          maxPages,
          skipCover,
          generateAudio,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        bookUrl?: string;
        pagesRendered?: number;
        pagesFailed?: number[];
        orderStatus?: string;
        storyDirection?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Failed');
      setResult(data);
      setStatus('done');
    } catch (e: unknown) {
      setResult({ error: e instanceof Error ? e.message : String(e) });
      setStatus('error');
    }
  }

  const failed = result?.pagesFailed?.length ?? 0;
  const rendered = result?.pagesRendered ?? 0;

  return (
    <div style={{ padding: 40, maxWidth: 640, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>Story Bank — Short E2E Test</h1>
      <p style={{ color: '#666', lineHeight: 1.5 }}>
        Generate a real book through the story-bank pipeline (images, optional audio, DB order).
        Use a short page count for fast iteration before PR-5 merge. After generation, open the reader,
        flip through all pages, verify Power Card EndScreen + PDF download, then tap המשך for סיימת.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
        <label>
          Companion / story ({companionCount} golden shelf):
          <select
            value={storyFile}
            onChange={(e) => setStoryFile(e.target.value)}
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
          >
            {(Object.keys(GOLDEN_SHELF_CATALOG) as GoldenShelfDirection[]).map((direction) => (
              <optgroup key={direction} label={GOLDEN_SHELF_DIRECTION_LABELS[direction]}>
                {GOLDEN_SHELF_CATALOG[direction].map((entry) => {
                  const file = goldenShelfStoryFile(entry.slug);
                  return (
                    <option key={file} value={file}>
                      {goldenShelfCompanionLabel(entry)}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
        </label>

        <label>
          Child name:
          <input
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
          />
        </label>

        <label>
          Gender:
          <select
            value={childGender}
            onChange={(e) => setChildGender(e.target.value)}
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
          >
            <option value="girl">Girl</option>
            <option value="boy">Boy</option>
          </select>
        </label>

        <label>
          Pages to render:
          <select
            value={maxPages}
            onChange={(e) => setMaxPages(Number(e.target.value))}
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
          >
            {GOLDEN_SHELF_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} {n === 3 ? '(default — E2E smoke)' : 'pages'}
              </option>
            ))}
          </select>
        </label>

        <label>
          Illustration style:
          <select
            value={illustrationStyle}
            onChange={(e) => setIllustrationStyle(e.target.value)}
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
          >
            <option value="soft_hand_drawn_storybook">Style 01 — גוונים רכים / soft hand-drawn</option>
            <option value="detailed_whimsical_world">Style 02 — עולם קסום / detailed whimsical</option>
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={skipCover}
            onChange={(e) => setSkipCover(e.target.checked)}
          />
          Skip cover (faster; reader still works)
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={generateAudio}
            onChange={(e) => setGenerateAudio(e.target.checked)}
          />
          Generate audio (ElevenLabs; requires env keys)
        </label>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={status === 'loading'}
          style={{
            padding: '12px 24px',
            fontSize: 16,
            background: '#7c3aed',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            opacity: status === 'loading' ? 0.5 : 1,
          }}
        >
          {status === 'loading' ? 'Generating… (1–3 min for 3 pages)' : 'Generate Book'}
        </button>
      </div>

      {result && (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: status === 'error' ? '#fef2f2' : '#f0fdf4',
            borderRadius: 8,
          }}
        >
          {status === 'done' && (
            <>
              <p style={{ color: '#16a34a', fontWeight: 'bold' }}>Book ready</p>
              <p>
                Pages rendered: {rendered} / {rendered + failed}
                {result.orderStatus ? ` · order status: ${result.orderStatus}` : ''}
                {result.storyDirection ? ` · direction: ${result.storyDirection}` : ''}
              </p>
              {failed > 0 && (
                <p style={{ color: '#dc2626' }}>Failed: pages {result.pagesFailed?.join(', ')}</p>
              )}
              {result.bookUrl && (
                <a
                  href={result.bookUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-block',
                    marginTop: 8,
                    padding: '8px 16px',
                    background: '#7c3aed',
                    color: '#fff',
                    borderRadius: 6,
                    textDecoration: 'none',
                  }}
                >
                  Open Reader →
                </a>
              )}
              <p style={{ marginTop: 12, color: '#444', fontSize: 14 }}>
                E2E checklist: read all pages → Power Card EndScreen → הורד PDF → המשך → סיימת
              </p>
            </>
          )}
          {status === 'error' && <p style={{ color: '#dc2626' }}>{result.error}</p>}
        </div>
      )}
    </div>
  );
}
