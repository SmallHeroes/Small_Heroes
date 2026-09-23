'use client';

import { useEffect, useRef, useState } from 'react';

/* The real product voice - the "אמא" narration preview the wizard offers.
   A real clip of the real voice, not a demo track. */
const SAMPLE_SRC = '/voice-samples/4RZ84U1b4WCqpu57LvIq.mp3';

/**
 * "Hear it": one press plays a short real narration clip over the sample
 * book. While it plays the section goes into a listening state (a warm
 * lamp glow behind the book, a pulse ring on the button) - the page shows
 * the parent what bedtime with this book sounds like.
 */
export function HearPage() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const section = document.getElementById('sample');
    if (!section) return;
    if (playing) section.setAttribute('data-listening', '');
    else section.removeAttribute('data-listening');
    return () => section.removeAttribute('data-listening');
  }, [playing]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      audio.currentTime = 0;
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  return (
    <div className="hear-page" data-reveal="up" data-reveal-delay="200">
      <button
        type="button"
        className={'hear-btn' + (playing ? ' is-playing' : '')}
        onClick={toggle}
        aria-pressed={playing}
        data-event="landing_hear_sample"
      >
        <span className="hear-btn-icon" aria-hidden="true">
          {playing ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1.2" />
              <rect x="14" y="5" width="4" height="14" rx="1.2" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
            </svg>
          )}
        </span>
        <span className="hear-btn-label">{playing ? 'מנגן... ללחוץ לעצירה' : 'לשמוע איך זה נשמע'}</span>
      </button>
      <span className="hear-hint">קטע קצר בקול של אמא, מתוך הקריינות</span>
      <audio
        ref={audioRef}
        src={SAMPLE_SRC}
        preload="none"
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
      />
    </div>
  );
}
