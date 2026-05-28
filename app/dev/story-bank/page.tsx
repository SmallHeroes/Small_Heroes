'use client';

import { useState } from 'react';

// ✅ Golden shelf only — stories that passed adapt-pass + gate under the
// page-count rule (bedtime=10, adventure=15, fantasy=20). Keep in sync with
// docs/LITERARY_SHELF_TRACKER.md. To QA a non-golden draft, add a temporary
// entry but mark it [DRAFT] so it's obvious in the dropdown.
const AVAILABLE_STORIES = [
  { file: 'fox_uri_adventure.md',          label: '✅ fox_uri — adventure 15p (NIGHT_FEAR) — slot 1' },
  { file: 'dolphin_shahkan_adventure.md',  label: '✅ dolphin_shahkan — adventure 15p (FOCUS_LEARNING) — slot 5' },
  { file: 'owl_chacham_bedtime.md',        label: '✅ owl_chacham — bedtime 10p (NIGHT_FEAR) — slot 6' },
  { file: 'firefly_namit_adventure.md',    label: '✅ firefly_namit — adventure 15p (NIGHT_FEAR) — slot 7' },
  { file: 'dragon_dini_fantasy.md',        label: '✅ dragon_dini — fantasy 20p (NEW_SIBLING) — slot 8' },
];

export default function StoryBankDevPage() {
  const [storyFile, setStoryFile] = useState('fox_uri_adventure.md');
  const [childName, setChildName] = useState('בר');
  const [childGender, setChildGender] = useState('boy');
  const [companionName, setCompanionName] = useState('');
  const [illustrationStyle, setIllustrationStyle] = useState('soft_hand_drawn_storybook');
  const [maxPages, setMaxPages] = useState(1);
  const [skipCover, setSkipCover] = useState(true);
  const [generateAudio, setGenerateAudio] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{
    bookUrl?: string;
    pagesRendered?: number;
    pagesFailed?: number[];
    error?: string;
  } | null>(null);

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
          companionName,
          illustrationStyle,
          maxPages,
          skipCover,
          generateAudio,
        }),
      });
      const data = (await res.json()) as { error?: string; bookUrl?: string; pagesRendered?: number; pagesFailed?: number[] };
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
    <div style={{ padding: 40, maxWidth: 600, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>Story Bank — Dev Renderer</h1>
      <p style={{ color: '#666' }}>
        Render a pre-written story with illustrations. Dev only. For Bolly + Style 02 blockers set{' '}
        <code>PHASE2_STYLE02_BOOK_PIPELINE=true</code>, <code>IMAGE_PROVIDER=gpt-image</code>,{' '}
        <code>PHASE2_STEP5_PROFILE=guarded-v1</code> in <code>.env.local</code>.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
        <label>
          Story:
          <select
            value={storyFile}
            onChange={(e) => setStoryFile(e.target.value)}
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
          >
            {AVAILABLE_STORIES.map((s) => (
              <option key={s.file} value={s.file}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Child Name:
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
          Companion Name:
          <input
            value={companionName}
            onChange={(e) => setCompanionName(e.target.value)}
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
          />
        </label>

        <label>
          Pages to render:
          <select
            value={maxPages}
            onChange={(e) => setMaxPages(Number(e.target.value))}
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
          >
            <option value={1}>1 page (single page test)</option>
            <option value={2}>2 pages (video debug)</option>
            <option value={5}>5 pages (quick test)</option>
            <option value={10}>10 pages</option>
            <option value={15}>15 pages (full)</option>
            <option value={0}>All pages</option>
          </select>
        </label>

        <label>
          Style:
          <select
            value={illustrationStyle}
            onChange={(e) => setIllustrationStyle(e.target.value)}
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
          >
            <option value="soft_hand_drawn_storybook">Style 01 — Portrait Artistic (soft watercolor, Flux + LoRA)</option>
            <option value="detailed_whimsical_world">Style 02 — Detailed Whimsical World (gpt-image-2)</option>
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={skipCover}
            onChange={(e) => setSkipCover(e.target.checked)}
          />
          Skip cover (faster for single-page tests)
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={generateAudio}
            onChange={(e) => setGenerateAudio(e.target.checked)}
          />
          Generate audio (per-page ElevenLabs; requires env keys)
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
          {status === 'loading' ? 'Generating... (2-5 min)' : 'Generate Book'}
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
              <p style={{ color: '#16a34a', fontWeight: 'bold' }}>✓ Book ready!</p>
              <p>
                Pages rendered: {rendered} / {rendered + failed}
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
                  Open Book →
                </a>
              )}
            </>
          )}
          {status === 'error' && <p style={{ color: '#dc2626' }}>{result.error}</p>}
        </div>
      )}
    </div>
  );
}
