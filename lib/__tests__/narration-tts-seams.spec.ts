/**
 * Narration TTS seams — per-page niqqud disambiguation + effective voice_settings (Codex-consult fixes).
 *
 * Proves: (Fix 1) a bare ambiguous Hebrew homograph is VOCALIZED in the TTS input before ElevenLabs, already-vocalized
 * text is untouched, and the DISPLAY text stays clean (niqqud stripped downstream); (Fix 2) generatePageAudio now
 * SENDS the voices.ts voice_settings (per-page tuning was previously dead). No real network — fetch + storage mocked.
 *
 * NOTE: vocalized forms carry multiple combining marks whose codepoint ORDER is fragile to hand-type, so we compare
 * against the RULE's own output (applyTtsAmbiguityNiqqudToText) and use strip-back / has-niqqud proofs — never a
 * typed vocalized literal.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/image-storage', () => ({
  uploadToSupabaseWithRetry: vi.fn(async () => {}),
}));

import {
  buildPageNarrationTtsText,
  resolveVoiceSettings,
  generatePageAudio,
} from '@/backend/providers/audio';
import { applyTtsAmbiguityNiqqudToText } from '@/lib/story-gen-v2/tts-ambiguity-niqqud';
import { formatHebrewForDisplay } from '@/lib/hebrew-text';
import { getVoiceById } from '@/backend/config/voices';

const hasNiqqud = (s: string) => /[֑-ׇ]/.test(s);
const V_CHOL = applyTtsAmbiguityNiqqudToText('חול').text; // the rule's own vocalized codepoints
const V_GESHER = applyTtsAmbiguityNiqqudToText('גשר').text;

describe('narration TTS seams', () => {
  it('(Fix 1) vocalizes a bare homograph; already-vocalized + non-homographs untouched; strips back clean', () => {
    // חול (bare) → vocalized (changed, now carries niqqud), and strips back to the clean display form.
    expect(V_CHOL).not.toBe('חול');
    expect(hasNiqqud(V_CHOL)).toBe(true);
    expect(formatHebrewForDisplay(V_CHOL)).toBe('חול');
    // already-vocalized input is returned unchanged (same string in/out → order-safe identity check).
    expect(applyTtsAmbiguityNiqqudToText(V_CHOL).text).toBe(V_CHOL);
    // a non-homograph word is untouched.
    expect(applyTtsAmbiguityNiqqudToText('הילד').text).toBe('הילד');
  });

  it('buildPageNarrationTtsText: niqqud runs BEFORE pause punctuation; display stays clean via stripNikud', () => {
    const tts = buildPageNarrationTtsText('הילד בנה חול ליד גשר.', false);
    expect(tts).toContain(V_CHOL); // חול vocalized
    expect(tts).toContain(V_GESHER); // גשר vocalized
    expect(tts).toContain('... '); // pause punctuation applied AFTER niqqud (on the period)
    // Stripping niqqud yields the original bare words + the pause marks — nothing niqqud leaks to the screen.
    expect(formatHebrewForDisplay(tts)).toBe('הילד בנה חול ליד גשר... ');
  });

  it('(Fix 2) resolveVoiceSettings = registry tuning; sleep-mode overrides layer on', () => {
    expect(resolveVoiceSettings(getVoiceById('mom'), false)).toMatchObject({ stability: 0.55, similarity_boost: 0.78, style: 0.2 });
    expect(resolveVoiceSettings(getVoiceById('dad_v2'), false)).toMatchObject({ stability: 0.7, similarity_boost: 0.8, style: 0 });
    expect(resolveVoiceSettings(getVoiceById('dad'), false)).toMatchObject({ stability: 0.7, similarity_boost: 0.8, style: 0 });
    expect(resolveVoiceSettings(getVoiceById('fairy'), false)).toMatchObject({ stability: 0.6, similarity_boost: 0.75, style: 0.3 });
    expect(resolveVoiceSettings(getVoiceById('mom'), true)).toMatchObject({ stability: 0.9, similarity_boost: 0.7, style: 0 });
  });

  describe('generatePageAudio wiring (both fixes reach ElevenLabs)', () => {
    const saved = { ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY, SUPABASE_URL: process.env.SUPABASE_URL };
    const realFetch = global.fetch;
    let requestedUrl = '';
    let sentBody: { text?: string; voice_settings?: { stability?: number; style?: number }; language_code?: string } | null = null;

    beforeEach(() => {
      process.env.ELEVENLABS_API_KEY = 'test-key';
      process.env.SUPABASE_URL = 'https://supabase.test';
      requestedUrl = '';
      sentBody = null;
      global.fetch = vi.fn(async (url: string | URL | Request, init: RequestInit) => {
        requestedUrl = String(url);
        sentBody = JSON.parse(String(init.body));
        return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });
      }) as unknown as typeof fetch;
    });
    afterEach(() => {
      global.fetch = realFetch;
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      vi.clearAllMocks();
    });

    it('sends the niqqud-vocalized text AND the voice_settings (mom tuning) to ElevenLabs', async () => {
      await generatePageAudio({
        narrationText: 'הילד בנה חול ליד גשר.',
        voiceId: 'mom',
        sleepMode: false,
        orderId: 'o1',
        pageNumber: 3,
      });
      expect(sentBody).toBeTruthy();
      expect(sentBody!.text).toContain(V_CHOL); // (Fix 1)
      expect(sentBody!.text).toContain(V_GESHER); // (Fix 1)
      expect(sentBody!.voice_settings).toBeDefined(); // (Fix 2) — previously absent → dead tuning
      expect(sentBody!.voice_settings!.stability).toBe(0.55);
      expect(sentBody!.voice_settings!.style).toBe(0.2);
      expect(sentBody!.language_code).toBe('he');
    });

    it('uses the approved provider ID for fresh Dad and the historical ID for legacy Dad', async () => {
      await generatePageAudio({
        narrationText: 'הילד רץ מהר.',
        voiceId: 'dad_v2',
        sleepMode: false,
        orderId: 'o2',
        pageNumber: 1,
      });
      expect(requestedUrl).toContain('/NaMUH1vcebhHvD4z3Lku');

      await generatePageAudio({
        narrationText: 'הילד רץ מהר.',
        voiceId: 'dad',
        sleepMode: false,
        orderId: 'legacy-o1',
        pageNumber: 1,
      });
      expect(requestedUrl).toContain('/V4aTMuwwYUtBD7ZqVvZs');
    });
  });

  describe('niqqud coverage preflight (wired into buildPageNarrationTtsText — fail-closed)', () => {
    it('HARD-BLOCKS synthesis when a CRITICAL homograph reaches TTS still unniqqud', () => {
      // "זה ספר." — ספר with no count/book context stays bare after the pass → critical gap → refuse to synthesize.
      expect(() => buildPageNarrationTtsText('זה ספר.', false)).toThrow(/coverage gap/i);
      expect(() => buildPageNarrationTtsText('זה ספר.', false)).toThrow(/ספר/);
    });

    it('does NOT block a COVERED critical homograph (the rule fires → niqqud → no gap)', () => {
      expect(() => buildPageNarrationTtsText('ספר עם פינה מקופלת.', false)).not.toThrow(); // → סֵפֶר
      expect(() => buildPageNarrationTtsText('לצעוד בקצב של כולם.', false)).not.toThrow(); // → בְּקֶצֶב
    });

    it('SOFT-WARNS (does NOT block) on a non-critical שם gap', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const out = buildPageNarrationTtsText('הוא הצביע. "שם."', false); // isolated "שם." — un-gateable there-answer
        expect(out).toContain('שם'); // returned (not thrown)
        expect(warn).toHaveBeenCalled();
        expect(String(warn.mock.calls[0]?.[0])).toMatch(/שם/);
      } finally {
        warn.mockRestore();
      }
    });
  });
});
