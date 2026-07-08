'use client';

/**
 * Audio-only auto-player. One <audio> element steps through the per-page narration MP3s as a single
 * playlist presented on ONE continuous timeline (sum of page durations, measured client-side because the
 * pipeline stores no durations). One initial tap unlocks autoplay (browser policy); after that it plays
 * every page end-to-end and auto-advances hands-free. Transport: play/pause, scrub the whole-book
 * timeline, skip prev/next page, elapsed/total. NO page images / book UI — a calm "now playing" screen.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import styles from './listen.module.css';

type ApiPage = {
  pageNumber: number;
  audioUrl: string | null;
  narrationText: string | null;
  isCover?: boolean;
};
type Track = { pageNumber: number; audioUrl: string };

type Status = 'loading' | 'ready' | 'empty' | 'error';

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ListenMode({ bookId, accessKey }: { bookId: string; accessKey: string }) {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [title, setTitle] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [durations, setDurations] = useState<number[]>([]); // measured per-track; [] until ready

  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [scrubbing, setScrubbing] = useState<number | null>(null); // global seconds while dragging

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wantPlayRef = useRef(false);        // auto-play the next track after its metadata loads
  const pendingSeekRef = useRef<number | null>(null); // offset to seek to once the new track loads

  // ── Fetch the book (same endpoint + accessKey as the reader) ────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/orders/${encodeURIComponent(bookId)}?accessKey=${encodeURIComponent(accessKey)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error(res.status === 403 || res.status === 404 ? 'לא הצלחנו לאמת את הגישה לספר.' : 'טעינת הספר נכשלה.');
        const data = (await res.json()) as { book?: { title?: string; coverImageUrl?: string | null; audioUrl?: string | null; pages?: ApiPage[] } };
        const book = data.book;
        if (cancelled) return;
        if (!book) { setStatus('error'); setErrorMsg('הספר לא נמצא.'); return; }

        setTitle(book.title?.trim() || 'הספר שלי');
        setCoverUrl(book.coverImageUrl?.trim() || null);

        const perPage: Track[] = (book.pages ?? [])
          .filter((p) => !p.isCover && typeof p.audioUrl === 'string' && p.audioUrl.trim().length > 0)
          .sort((a, b) => a.pageNumber - b.pageNumber)
          .map((p) => ({ pageNumber: p.pageNumber, audioUrl: (p.audioUrl as string).trim() }));

        // Fallback: a single whole-book MP3 (legacy) when there are no per-page clips.
        const resolved: Track[] =
          perPage.length > 0
            ? perPage
            : book.audioUrl?.trim()
              ? [{ pageNumber: 1, audioUrl: book.audioUrl.trim() }]
              : [];

        if (resolved.length === 0) { setStatus('empty'); return; }
        setTracks(resolved);
        setStatus('ready');
      } catch (e) {
        if (!cancelled) { setStatus('error'); setErrorMsg(e instanceof Error ? e.message : 'טעינת הספר נכשלה.'); }
      }
    })();
    return () => { cancelled = true; };
  }, [bookId, accessKey]);

  // ── Measure per-track durations (metadata only) to build ONE unified timeline ─
  useEffect(() => {
    if (tracks.length === 0) return;
    let cancelled = false;
    const measured = new Array(tracks.length).fill(0);
    let remaining = tracks.length;
    const finish = () => { if (!cancelled) setDurations([...measured]); };
    const probes = tracks.map((t, i) => {
      const a = new Audio();
      a.preload = 'metadata';
      const done = (d: number) => {
        if (cancelled) return;
        measured[i] = Number.isFinite(d) && d > 0 ? d : 0;
        remaining -= 1;
        if (remaining <= 0) finish();
      };
      a.addEventListener('loadedmetadata', () => done(a.duration), { once: true });
      a.addEventListener('error', () => done(0), { once: true });
      a.src = t.audioUrl;
      return a;
    });
    const timer = setTimeout(finish, 9000); // don't block the UI forever on a slow/broken clip
    return () => {
      cancelled = true;
      clearTimeout(timer);
      probes.forEach((a) => { a.removeAttribute('src'); a.load(); });
    };
  }, [tracks]);

  const cumulative = useMemo(() => {
    const c: number[] = [];
    let acc = 0;
    for (const d of durations) { c.push(acc); acc += d; }
    return c;
  }, [durations]);
  const totalDuration = useMemo(() => durations.reduce((n, d) => n + d, 0), [durations]);
  const durationsReady = durations.length === tracks.length && totalDuration > 0;
  const elapsed = (cumulative[currentIdx] ?? 0) + curTime;
  const displayGlobal = scrubbing != null ? scrubbing : elapsed;

  // ── Drive the single <audio> element as currentIdx changes ──────────────────
  useEffect(() => {
    const audio = audioRef.current;
    const track = tracks[currentIdx];
    if (!audio || !track) return;
    audio.src = track.audioUrl;
    audio.load();
    const onLoaded = () => {
      if (pendingSeekRef.current != null) {
        const off = pendingSeekRef.current;
        pendingSeekRef.current = null;
        try { audio.currentTime = Math.min(off, (audio.duration || off)); } catch { /* ignore */ }
        setCurTime(audio.currentTime);
      } else {
        setCurTime(0);
      }
      if (wantPlayRef.current) audio.play().catch(() => { /* autoplay blocked until a gesture */ });
    };
    audio.addEventListener('loadedmetadata', onLoaded, { once: true });
    return () => audio.removeEventListener('loadedmetadata', onLoaded);
  }, [currentIdx, tracks]);

  const onEnded = useCallback(() => {
    if (currentIdx < tracks.length - 1) {
      wantPlayRef.current = true;
      setCurrentIdx((i) => i + 1);
    } else {
      wantPlayRef.current = false;
      setIsPlaying(false);
      setCurTime((t) => t); // leave at the end
    }
  }, [currentIdx, tracks.length]);

  const startListening = useCallback(() => {
    setStarted(true);
    wantPlayRef.current = true;
    audioRef.current?.play().catch(() => { /* ignore */ });
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) { wantPlayRef.current = true; audio.play().catch(() => {}); }
    else { wantPlayRef.current = false; audio.pause(); }
  }, []);

  const seekToGlobal = useCallback((globalT: number) => {
    if (!durationsReady) return;
    let i = 0;
    while (i < tracks.length - 1 && globalT >= (cumulative[i] + durations[i])) i += 1;
    const offset = Math.max(0, globalT - (cumulative[i] ?? 0));
    if (i === currentIdx) {
      const audio = audioRef.current;
      if (audio) { try { audio.currentTime = offset; } catch { /* ignore */ } }
      setCurTime(offset);
    } else {
      pendingSeekRef.current = offset;
      wantPlayRef.current = started && isPlaying;
      setCurrentIdx(i);
    }
  }, [durationsReady, tracks.length, cumulative, durations, currentIdx, started, isPlaying]);

  // ±N seconds along the WHOLE-book timeline (crosses page boundaries via the global seek).
  const skipSeconds = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (durationsReady) {
      seekToGlobal(Math.max(0, Math.min(totalDuration, elapsed + delta)));
    } else {
      const upper = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number.MAX_SAFE_INTEGER;
      const t = Math.max(0, Math.min(upper, audio.currentTime + delta));
      try { audio.currentTime = t; } catch { /* ignore */ }
      setCurTime(audio.currentTime);
    }
  }, [durationsReady, totalDuration, elapsed, seekToGlobal]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return <Shell><p className={styles.dim}>טוען את הספר…</p></Shell>;
  }
  if (status === 'error') {
    return <Shell><p className={styles.dim}>{errorMsg || 'טעינת הספר נכשלה.'}</p></Shell>;
  }
  if (status === 'empty') {
    return <Shell><p className={styles.dim}>אין עדיין הקראה לספר הזה.</p></Shell>;
  }

  return (
    <Shell>
      <div className={styles.player}>
        {coverUrl ? (
          <img src={coverUrl} alt="" className={styles.cover} />
        ) : (
          <div className={styles.coverFallback} aria-hidden>🎧</div>
        )}

        <h1 className={styles.title}>{title}</h1>
        <p className={styles.counter}>עמוד {Math.min(currentIdx + 1, tracks.length)} מתוך {tracks.length}</p>

        {/* continuous whole-book timeline */}
        <div className={styles.timeline}>
          <input
            type="range"
            className={styles.scrubber}
            min={0}
            max={durationsReady ? Math.max(1, Math.floor(totalDuration)) : 1}
            step={1}
            value={Math.floor(displayGlobal)}
            disabled={!durationsReady}
            onChange={(e) => setScrubbing(Number(e.target.value))}
            onMouseUp={(e) => { seekToGlobal(Number((e.target as HTMLInputElement).value)); setScrubbing(null); }}
            onTouchEnd={(e) => { seekToGlobal(Number((e.target as HTMLInputElement).value)); setScrubbing(null); }}
            aria-label="ציר הזמן של הספר"
          />
          <div className={styles.times}>
            <span>{fmt(displayGlobal)}</span>
            <span>{durationsReady ? fmt(totalDuration) : '—:—'}</span>
          </div>
        </div>

        {/* transport */}
        <div className={styles.transport}>
          <button type="button" className={styles.skip} onClick={() => skipSeconds(-15)} aria-label="אחורה 15 שניות">
            <span className={styles.skipIcon}>⟲</span><span className={styles.skipNum}>15</span>
          </button>
          <button type="button" className={styles.playPause} onClick={togglePlay} aria-label={isPlaying ? 'השהה' : 'נגן'}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button type="button" className={styles.skip} onClick={() => skipSeconds(15)} aria-label="קדימה 15 שניות">
            <span className={styles.skipNum}>15</span><span className={styles.skipIcon}>⟳</span>
          </button>
        </div>
      </div>

      {/* one-tap start overlay (unlocks autoplay; after this it's hands-free) */}
      {!started && (
        <button type="button" className={styles.startOverlay} onClick={startListening}>
          <span className={styles.startCircle}>▶</span>
          <span className={styles.startLabel}>התחילו להאזין</span>
          <span className={styles.startHint}>הספר יתנגן מעצמו מתחילתו ועד סופו</span>
        </button>
      )}

      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={() => { if (scrubbing == null) setCurTime(audioRef.current?.currentTime ?? 0); }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={onEnded}
        hidden
      />
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" className={styles.screen}>
      <div className={styles.brand}>✨ גיבורים קטנים</div>
      {children}
      <div className={styles.footer}>גיבורים קטנים — סיפורי חוסן לילדים</div>
    </div>
  );
}
