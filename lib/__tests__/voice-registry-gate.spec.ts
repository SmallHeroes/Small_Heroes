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
import { describe, it, expect } from 'vitest';
import { findVoiceById, getVoiceById, VOICES } from '@/backend/config/voices';

describe('voice registry — paid-order intake gate contract', () => {
  it('resolves exactly the producible voices (mom / dad / fairy)', () => {
    expect(VOICES.map((v) => v.id).sort()).toEqual(['dad', 'fairy', 'mom']);
    for (const id of ['mom', 'dad', 'fairy']) {
      expect(findVoiceById(id), `expected "${id}" to be a producible voice`).toBeDefined();
    }
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
