import 'server-only';

import { createHash } from 'crypto';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

import { DIRECTION_PAGE_MAP, TOPICS, displayPagesForBeats } from '@/backend/config/wizard';
import { VOICES } from '@/backend/config/voices';
import { getCompanionById } from '@/lib/companions';
import { DIRECTION_EXPERIENCE_CARDS, DIRECTION_ORDER } from '@/lib/web/direction-display';

/**
 * Prototype roster: a configured list, not a hardcoded story companion. Only companions whose
 * card art exists on disk are offered (fail closed). Being listed here is NOT render
 * qualification for a personal book.
 *
 * `personality` is PROTOTYPE COPY for Guy's product review: short character lines derived from
 * each companion's canonical essence in lib/companion-deep-profiles.ts, deliberately free of the
 * challenge-category ("helps with X") framing. It does not replace the canonical profile.
 */
export const PROTOTYPE_COMPANION_ROSTER: ReadonlyArray<{ id: string; personality: string }> = [
  { id: 'dragon_dini', personality: 'רוצה לשמור על כולם. לפעמים גם הזנב שלה רוצה לעזור.' },
  { id: 'panda_anat', personality: 'לא ממהרת לשום מקום, ולכן שמה לב לדבר הקטן שכולם פספסו.' },
  { id: 'fox_uri', personality: 'שועל קטן עם פנס, שבודק כל צל מקרוב. אבל לא בהגזמה.' },
  { id: 'chameleon_koko', personality: 'שובבה שמחליפה צבעים, ולוקחת איתה צבע מכל מקום שביקרה בו.' },
];

/** Optional story directions offered next to "just for fun" (canonical, non-legacy topic ids). */
export const PROTOTYPE_TOPIC_IDS = [
  'night',
  'sirens',
  'new_sibling',
  'anger',
  'confidence',
  'transitions',
  'social',
  'sensitivity',
  'focus',
  'medical',
] as const;

export type PersonalWizardOptions = {
  companions: Array<{ id: string; name: string; image: string; personality: string }>;
  unavailableCompanionIds: string[];
  topics: Array<{ id: string; label: string }>;
  voices: Array<{ id: string; label: string; description: string; emoji: string; sampleUrl: string | null }>;
  /** Existing package ids and display page counts; shown as prototype proposals without price. */
  packages: Array<{ id: string; kicker: string; name: string; pages: number }>;
  /** Binds a request identity to the exact option set it was validated against. */
  fingerprint: string;
};

const MIN_ASSET_BYTES = 100;

function publicAssetExists(publicPath: string, root: string): boolean {
  if (!publicPath.startsWith('/') || publicPath.includes('..')) return false;
  const absolute = join(root, 'public', publicPath.replace(/^\//, ''));
  try {
    return existsSync(absolute) && statSync(absolute).isFile() && statSync(absolute).size > MIN_ASSET_BYTES;
  } catch {
    return false;
  }
}

export function resolvePersonalWizardOptions(root: string = process.cwd()): PersonalWizardOptions {
  const companions: PersonalWizardOptions['companions'] = [];
  const unavailableCompanionIds: string[] = [];
  for (const entry of PROTOTYPE_COMPANION_ROSTER) {
    const companion = getCompanionById(entry.id);
    const image = companion?.cardImage ?? companion?.image;
    if (!companion || !image || !publicAssetExists(image, root)) {
      unavailableCompanionIds.push(entry.id);
      continue;
    }
    companions.push({ id: companion.id, name: companion.name, image, personality: entry.personality });
  }

  const topics = PROTOTYPE_TOPIC_IDS.map((id) => {
    const topic = TOPICS.find((candidate) => candidate.id === id);
    if (!topic) throw new Error(`personal_wizard_topic_missing:${id}`);
    return { id: topic.id, label: topic.label };
  });

  const voices = VOICES.map((voice) => ({
    id: voice.id,
    label: voice.label,
    description: voice.description,
    emoji: voice.emoji,
    sampleUrl: voice.previewUrl && publicAssetExists(voice.previewUrl, root) ? voice.previewUrl : null,
  }));

  const packages = DIRECTION_ORDER.map((id) => {
    const beats = DIRECTION_PAGE_MAP[id]?.pages;
    if (!beats) throw new Error(`personal_wizard_package_missing:${id}`);
    const card = DIRECTION_EXPERIENCE_CARDS[id];
    return { id, kicker: card.kicker, name: card.name, pages: displayPagesForBeats(beats) };
  });

  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        schema: 'personal-wizard-options/v1',
        companions,
        topics,
        voices: voices.map(({ id, label }) => ({ id, label })),
        packages,
      }),
    )
    .digest('hex');

  return { companions, unavailableCompanionIds, topics, voices, packages, fingerprint };
}
