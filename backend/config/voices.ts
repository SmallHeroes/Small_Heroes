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
    description: 'קול חם ועדין, מתאים לאמא',
    emoji: '👩',
    provider: 'elevenlabs',
    elevenlabsVoiceId: '4RZ84U1b4WCqpu57LvIq',
    previewUrl: null,
    stability: 0.55,
    similarityBoost: 0.78,
    style: 0.20,
  },
  {
    id: 'dad',
    label: 'אבא',
    description: 'קול עמוק, חם ומחבק',
    emoji: '👨',
    provider: 'elevenlabs',
    elevenlabsVoiceId: 'V4aTMuwwYUtBD7ZqVvZs',
    previewUrl: null,
    stability: 0.70,
    similarityBoost: 0.80,
  },
  {
    id: 'grandma',
    label: 'סבתא',
    description: 'קול סבתא חם ועדין',
    emoji: '👵',
    provider: 'elevenlabs',
    elevenlabsVoiceId: '7NsaqHdLuKNFvEfjpUno',
    previewUrl: null,
    stability: 0.75,
    similarityBoost: 0.80,
    style: 0.10,
  },
  {
    id: 'dad_thick',
    label: 'אבא עם קול עבה',
    description: 'קול אבא עבה ומחבק',
    emoji: '👨',
    provider: 'elevenlabs',
    elevenlabsVoiceId: 'cPoqAvGWCPfCfyPMwe4z',
    previewUrl: null,
    stability: 0.70,
    similarityBoost: 0.78,
  },
  {
    id: 'big_sister',
    label: 'אחות גדולה',
    description: 'קול אחות גדולה, רגוע ומחבק',
    emoji: '👧',
    provider: 'elevenlabs',
    elevenlabsVoiceId: 'qBDvhofpxp92JgXJxDjB',
    previewUrl: null,
    stability: 0.65,
    similarityBoost: 0.78,
    style: 0.15,
  },
  {
    id: 'big_brother',
    label: 'אח גדול',
    description: 'קול אח גדול, חברותי וחם',
    emoji: '🧒',
    provider: 'elevenlabs',
    elevenlabsVoiceId: 'chcMmmtY1cmQh2ye1oXi',
    previewUrl: null,
    stability: 0.65,
    similarityBoost: 0.78,
    style: 0.15,
  },
  {
    id: 'fairy',
    label: 'פייה קסומה',
    description: 'קול קסום, נעים ומיוחד',
    emoji: '🧚',
    provider: 'elevenlabs',
    elevenlabsVoiceId: 'piI8Kku0DcvcL6TTSeQt',
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
