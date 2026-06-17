/**
 * Companion name/species tokens for entity-presence heuristics.
 * Registry + manual aliases — no companion should be silently unmatched.
 */
import { getCompanionById } from './companions';
import { stripNikud } from './hebrew-text';

const MANUAL_ALIASES: Record<string, string[]> = {
  fox_uri: ['fox', 'uri', 'אורי', 'אוּרי'],
  dragon_dini: ['dini', 'דיני'],
  bear_cub_gahal: ['dobi'],
  octopus_seara: ['octopus', 'seara', 'זוזי'],
  lion_shaket: ['lion', 'leo', 'shaket', 'ליאו', 'אריה'],
  chameleon_koko: ['kim', 'Kim', 'קים', 'קִים', 'chameleon', 'זיקית'],
  panda_anat: ['anat', 'ענת', 'עֲנָת', 'panda', 'פנדה'],
  bunny_ometz: ['buni', 'בוני', 'בּוּני', 'bunny', 'rabbit', 'ארנב', 'ארנבון'],
};

function addToken(tokens: Set<string>, raw: string): void {
  const trimmed = raw.trim();
  if (trimmed.length < 2) return;
  tokens.add(trimmed);
  tokens.add(trimmed.toLowerCase());
  const bare = stripNikud(trimmed);
  if (bare.length >= 2) {
    tokens.add(bare);
    tokens.add(bare.toLowerCase());
  }
}

/** Lowercase presence-match tokens for a companion (name parts + species aliases). */
export function companionPresenceTokens(
  companionName: string,
  companionId?: string | null
): string[] {
  const tokens = new Set<string>();
  const trimmed = companionName.trim();
  if (trimmed) {
    addToken(tokens, trimmed);
    const parts = trimmed.split(/\s+/).filter((p) => p.length >= 2);
    if (parts.length > 1) {
      const short = parts[parts.length - 1];
      addToken(tokens, short);
    }
  }

  const id = (companionId ?? '').toLowerCase();
  const registry = getCompanionById(id);
  if (registry?.name) {
    for (const part of registry.name.split(/\s+/)) {
      addToken(tokens, part);
    }
    const speciesWord = registry.name.split(/\s+/)[0];
    if (speciesWord) addToken(tokens, speciesWord);
  }

  for (const alias of MANUAL_ALIASES[id] ?? []) {
    addToken(tokens, alias);
  }

  return [...tokens];
}
