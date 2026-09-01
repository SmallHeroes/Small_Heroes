/**
 * Voice Configuration — ElevenLabs Voice Registry
 * Add/swap voices here without touching business logic.
 * previewUrl: hosted preview audio file (optional).
 *
 * UI COPY SYNC:
 * The `label` and `description` fields here are user-facing strings. They MUST stay in sync with the voices array in
 * public/JS/content.js → window.CONTENT.he.wizard.voices (the ONLY frontend list; there is no content/ui/he/wizard.ts).
 *
 * When adding or renaming a voice:
 *   1. Update this file (service config + ElevenLabs IDs)
 *   2. Update public/JS/content.js → window.CONTENT.he.wizard.voices
 */
import { createLogger } from '../../lib/logger';

const log = createLogger({ subsystem: 'voices-config' });

export interface VoiceConfig {
  id: string;              // our internal ID
  label: string;           // Hebrew display label
  description: string;     // short description for UI
  emoji: string;
  provider: 'elevenlabs';
  elevenlabsVoiceId: string; // replace with real ElevenLabs voice IDs
  previewUrl: string | null; // URL to a short mp3 preview
  // ElevenLabs voice settings overrides
  stability?: number;       // 0-1, higher = more consistent
  similarityBoost?: number; // 0-1
  style?: number;           // 0-1 (style exaggeration)
  useSpeakerBoost?: boolean;
}

export const VOICES: VoiceConfig[] = [
  {
    id: 'mom',
    label: 'אמא',
    description: 'קול חם ועדין, מתאים לאמא',
    emoji: '👩',
    provider: 'elevenlabs',
    elevenlabsVoiceId: '4RZ84U1b4WCqpu57LvIq',
    previewUrl: '/voice-samples/4RZ84U1b4WCqpu57LvIq.mp3',
    stability: 0.55,
    similarityBoost: 0.78,
    style: 0.20,
  },
  {
    id: 'dad_v2',
    label: 'אבא',
    description: 'קול עמוק, חם ומחבק',
    emoji: '👨',
    provider: 'elevenlabs',
    elevenlabsVoiceId: 'NaMUH1vcebhHvD4z3Lku',
    previewUrl: null,
    stability: 0.70,
    similarityBoost: 0.80,
  },
  {
    id: 'fairy',
    label: 'פייה קסומה',
    description: 'קול קסום, נעים ומיוחד',
    emoji: '🧚',
    provider: 'elevenlabs',
    elevenlabsVoiceId: 'piI8Kku0DcvcL6TTSeQt',
    previewUrl: '/voice-samples/piI8Kku0DcvcL6TTSeQt.mp3',
    stability: 0.60,
    similarityBoost: 0.75,
    style: 0.3,
  },
];

/** Runtime-only voices retained so unfinished historical Orders keep their original narrator. */
const LEGACY_RUNTIME_VOICES: VoiceConfig[] = [
  {
    id: 'dad',
    label: 'אבא',
    description: 'קול אבא היסטורי',
    emoji: '👨',
    provider: 'elevenlabs',
    elevenlabsVoiceId: 'V4aTMuwwYUtBD7ZqVvZs',
    previewUrl: '/voice-samples/V4aTMuwwYUtBD7ZqVvZs.mp3',
    stability: 0.70,
    similarityBoost: 0.80,
  },
];

// Sleep mode overrides — slower, softer
export const SLEEP_MODE_OVERRIDES: Partial<VoiceConfig> = {
  stability: 0.90,
  similarityBoost: 0.70,
  style: 0,
};

/** Strict registry lookup for intake validation. Never use the fallback here. */
export function findVoiceById(id: string): VoiceConfig | undefined {
  return VOICES.find(v => v.id === id);
}

/**
 * Runtime narration lookup. Old/test orders can retain a voice id that was removed
 * from the sellable roster; narration must not fail an otherwise deliverable book.
 */
export function getVoiceById(id: string): VoiceConfig {
  const voice = findVoiceById(id) ?? LEGACY_RUNTIME_VOICES.find(v => v.id === id);
  if (voice) return voice;

  const fallback = VOICES.find(v => v.id === 'mom');
  if (!fallback) {
    throw new Error('Default narration voice "mom" is missing from the voice registry');
  }
  log.warn('unknown narration voice; using default', {
    requestedVoiceId: id,
    fallbackVoiceId: fallback.id,
  });
  return fallback;
}
