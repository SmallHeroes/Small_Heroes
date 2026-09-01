/**
 * Voice registry contract — the invariant the paid-order intake gate depends on.
 *
 * `POST /api/orders` rejects any `selectedVoice` that `findVoiceById` cannot resolve (fail-closed), so a stale/removed
 * id (e.g. a returning user whose persisted wizard state still holds a voice we later dropped) can never enter a paid
 * order and crash audio generation with "Unknown voice" AFTER payment. This test pins that:
 *   - the 3 producible voices resolve, and
 *   - previously-offered / dropped ids + arbitrary junk do NOT resolve (so the gate rejects them).
 * It also guards the sync contract in backend/config/voices.ts: don't re-add a wizard voice without a registry entry.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { findVoiceById, getVoiceById, VOICES, type VoiceConfig } from '@/backend/config/voices';

describe('voice registry — paid-order intake gate contract', () => {
  it('resolves exactly the producible voices (mom / dad_v2 / fairy)', () => {
    expect(VOICES.map((v) => v.id).sort()).toEqual(['dad_v2', 'fairy', 'mom']);
    for (const id of ['mom', 'dad_v2', 'fairy']) {
      expect(findVoiceById(id), `expected "${id}" to be a producible voice`).toBeDefined();
    }
  });

  it('binds new Dad orders to the approved provider while preserving legacy Dad only at runtime', () => {
    expect(findVoiceById('dad_v2')).toMatchObject({
      elevenlabsVoiceId: 'NaMUH1vcebhHvD4z3Lku',
      previewUrl: null,
    });
    expect(findVoiceById('dad')).toBeUndefined();
    expect(getVoiceById('dad')).toMatchObject({
      id: 'dad',
      elevenlabsVoiceId: 'V4aTMuwwYUtBD7ZqVvZs',
    });
  });

  it('keeps the Wizard roster in sync, migrates stale Dad sessions, and exposes no dead preview control', () => {
    const contentSource = readFileSync(path.join(process.cwd(), 'public/JS/content.js'), 'utf8');
    const wizardSource = readFileSync(path.join(process.cwd(), 'public/JS/wizard.js'), 'utf8');
    const browserWindow = { location: { hostname: 'qa.smallheroes.co.il' } } as unknown as Window & typeof globalThis;
    const browserDocument = { documentElement: { lang: 'he' } } as Document;
    new Function('window', 'document', contentSource)(browserWindow, browserDocument);
    const wizardVoices = (browserWindow as unknown as { CONTENT: { he: { wizard: { voices: VoiceConfig[] } } } }).CONTENT.he.wizard.voices;

    expect(wizardVoices.map((voice) => voice.id)).toEqual(VOICES.map((voice) => voice.id));
    expect(wizardVoices.find((voice) => voice.id === 'dad_v2')).toMatchObject({ sampleUrl: null });
    expect(wizardSource).toContain("if (state.voice === 'dad') state.voice = 'dad_v2';");
    expect(wizardSource).toContain("const hasPreview = typeof v.sampleUrl === 'string' && v.sampleUrl.trim().length > 0;");
    expect(wizardSource).toContain('if (hasPreview) {');
  });

  it('every registry voice carries a real ElevenLabs id (no empty/placeholder that would break narration)', () => {
    for (const v of VOICES) {
      expect(v.elevenlabsVoiceId, `voice "${v.id}" needs an ElevenLabs id`).toBeTruthy();
    }
  });

  it('rejects dropped/stale ids and arbitrary junk (the gate fails closed on these)', () => {
    for (const id of ['grandma', 'dad_thick', 'big_sister', 'big_brother', 'dad_calm', '', 'not-a-voice', 'MOM']) {
      expect(findVoiceById(id), `expected "${id}" to be unknown`).toBeUndefined();
    }
  });

  it('falls back to mom at narration time for a removed/unknown id', () => {
    expect(getVoiceById('grandma').id).toBe('mom');
    expect(getVoiceById('not-a-voice').id).toBe('mom');
  });
});
