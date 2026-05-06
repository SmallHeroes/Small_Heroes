/**
 * Voice Configuration — ElevenLabs Voice Registry
 * Add/swap voices here without touching business logic.
 * previewUrl: hosted preview audio file (optional).
 *
 * UI COPY SYNC:
 * The `label` and `description` fields here are user-facing strings.
 * They MUST stay in sync with WIZARD.voices in content/ui/he/wizard.ts
 * (the typed content layer) and the voices array in JS/content.js
 * (the static frontend).
 *
 * When adding or renaming a voice:
 *   1. Update this file (service config + ElevenLabs IDs)
 *   2. Update content/ui/he/wizard.ts → WIZARD.voices
 *   3. Update JS/content.js → window.CONTENT.he.wizard.voices
 */

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
    description: 'קול חם, מחבק ורגוע',
    emoji: '👩',
    provider: 'elevenlabs',
    elevenlabsVoiceId: 'HO9ohm2RhnVssYFKCBje', // TODO: replace
    previewUrl: null, // TODO: '/previews/voice-mom.mp3'
    stability: 0.75,
    similarityBoost: 0.85,
  },
  {
    id: 'dad',
    label: 'אבא',
    description: 'קול חזק, חם ומחבק',
    emoji: '👨',
    provider: 'elevenlabs',
    elevenlabsVoiceId: 'YOUR_ELEVENLABS_VOICE_ID_DAD', // TODO: replace
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
    elevenlabsVoiceId: 'YOUR_ELEVENLABS_VOICE_ID_FAIRY', // TODO: replace
    previewUrl: null,
    stability: 0.60,
    similarityBoost: 0.75,
    style: 0.3,
  },
];

// Sleep mode overrides — slower, softer
export const SLEEP_MODE_OVERRIDES: Partial<VoiceConfig> = {
  stability: 0.90,
  similarityBoost: 0.70,
  style: 0,
};

export function getVoiceById(id: string): VoiceConfig | undefined {
  return VOICES.find(v => v.id === id);
}
