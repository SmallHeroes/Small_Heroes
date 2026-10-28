import 'server-only';

import { createHash } from 'crypto';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

import { DIRECTION_PAGE_MAP, TOPICS, displayPagesForBeats } from '@/backend/config/wizard';
import { VOICES } from '@/backend/config/voices';
import { getCompanionById } from '@/lib/companions';
import { PERSONAL_ADDED_COMPANIONS, personalCompanionVisual } from './personal-companions';
import { companionSheetsComplete } from './companion-identity';
import { PERSONAL_CHARACTER_IDS } from './companion-character';

/**
 * Prototype roster: a configured list, not a hardcoded story companion. All six companions with
 * card art are offered, by name only (Guy 2026-09-29); one whose art is missing on disk is dropped
 * (fail closed). Being listed here is NOT render qualification for a personal book.
 */
export const PROTOTYPE_COMPANION_ROSTER: readonly string[] = [
  'dragon_dini',
  'panda_anat',
  'fox_uri',
  'chameleon_koko',
  'lion_shaket',
  'bunny_ometz',
];

/** Every companion the personal product shows, in display order: the six registry companions, then the added ones. */
export const PERSONAL_COMPANION_IDS: readonly string[] = [
  ...PROTOTYPE_COMPANION_ROSTER,
  ...PERSONAL_ADDED_COMPANIONS.map((companion) => companion.id),
];

/**
 * Book length tiers (Guy 2026-09-29): every book is an adventure with fantasy, and the tiers differ
 * only in length and plot depth. Page counts reuse the current catalogue's beat counts, shortest to
 * longest; mapping them to production prices and the story bank is a separate decision.
 */
export const PROTOTYPE_LENGTHS = [
  { id: 'short', beatsOf: 'bedtime' },
  { id: 'medium', beatsOf: 'adventure' },
  { id: 'long', beatsOf: 'fantasy' },
] as const;

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
  /** Selectable for a book: only companions the engine can draw (see `companionDrawable`). */
  companions: Array<{ id: string; name: string; image: string }>;
  /** Shown as "in preparation" and never selectable (not part of the fingerprint, so request identities do not change). */
  pendingCompanions: Array<{ id: string; name: string; image: string | null }>;
  /** Roster (registry) companions that are not offered because something they need is missing (fail closed). */
  unavailableCompanionIds: string[];
  topics: Array<{ id: string; label: string }>;
  voices: Array<{ id: string; label: string; description: string; emoji: string; sampleUrl: string | null }>;
  /** Length tiers with display page counts; shown as prototype proposals without price. */
  lengths: Array<{ id: string; pages: number }>;
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

/**
 * One rule for every companion: selectable for a book only when the engine can write and draw it, meaning an admitted literary profile,
 * a declared appearance, card art on disk and a complete passed sheet set. Decided from the files, so a companion becomes selectable by
 * itself once its sheet set passes.
 */
export function companionDrawable(id: string, image: string | null | undefined, root: string = process.cwd()) {
  const visual = personalCompanionVisual(id);
  return (PERSONAL_CHARACTER_IDS as readonly string[]).includes(id) && !!visual?.description.trim() && !!image && publicAssetExists(image, root) &&
    companionSheetsComplete(id, root);
}

export function resolvePersonalWizardOptions(root: string = process.cwd()): PersonalWizardOptions {
  const companions: PersonalWizardOptions['companions'] = [];
  const pendingCompanions: PersonalWizardOptions['pendingCompanions'] = [];
  const unavailableCompanionIds: string[] = [];
  for (const id of PROTOTYPE_COMPANION_ROSTER) {
    const companion = getCompanionById(id);
    const image = companion?.cardImage ?? companion?.image;
    if (!companion || !image || !companionDrawable(id, image, root)) {
      unavailableCompanionIds.push(id);
      continue;
    }
    companions.push({ id: companion.id, name: companion.name, image });
  }
  for (const companion of PERSONAL_ADDED_COMPANIONS) {
    // A personal companion is a new identity: it may never shadow (alias) a registry companion.
    if (getCompanionById(companion.id)) throw new Error(`personal_wizard_companion_alias:${companion.id}`);
    const image = companion.image && publicAssetExists(companion.image, root) ? companion.image : null;
    if (image && companionDrawable(companion.id, image, root)) companions.push({ id: companion.id, name: companion.name, image });
    else pendingCompanions.push({ id: companion.id, name: companion.name, image });
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

  const lengths = PROTOTYPE_LENGTHS.map(({ id, beatsOf }) => {
    const beats = DIRECTION_PAGE_MAP[beatsOf]?.pages;
    if (!beats) throw new Error(`personal_wizard_length_missing:${id}`);
    return { id, pages: displayPagesForBeats(beats) };
  });

  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        schema: 'personal-wizard-options/v2',
        companions,
        topics,
        voices: voices.map(({ id, label }) => ({ id, label })),
        lengths,
      }),
    )
    .digest('hex');

  return { companions, pendingCompanions, unavailableCompanionIds, topics, voices, lengths, fingerprint };
}
