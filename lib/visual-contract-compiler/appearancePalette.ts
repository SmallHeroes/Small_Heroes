/**
 * Deterministic appearance palette (P0) — the source for `deterministic_palette` human traits (a non-family human,
 * e.g. the clinic doctor, has no family band and no story-given colour, so the compiler picks ONE stable, coherent
 * appearance for it — the same across ALL orders of a story, varying across stories/casts).
 *
 * Selection is keyed EXACTLY by `hash(schemaVersion + palette.version + normalizedStoryKey + castId)` — NO orderId,
 * NO timestamp, NO deployment version — so it is byte-identical every render + auditable. Entries are CURATED
 * COHERENT {skin, hair} pairs (a plausible pairing per entry) — never independently-hashed skin/hair values.
 *
 * PURE: `createHash` is deterministic; no clock, no random, no I/O.
 */
import { createHash } from 'crypto';
import { PALETTE_VERSION, VISUAL_CONTRACT_SCHEMA_VERSION } from './contractTemplateTypes';

export interface PaletteEntry {
  /** Concrete skin-tone descriptor. */
  skin: string;
  /** Concrete hair COLOUR only (orthogonal from texture/style so projection-equality is checkable). */
  hairColour: string;
  /** Concrete hair TEXTURE only. */
  hairTexture: string;
}

export interface AppearancePalette {
  version: string;
  entries: readonly PaletteEntry[];
}

/** Curated coherent {skin, hairColour, hairTexture} entries spanning a fair range (mixed pairings allowed). */
export const DEFAULT_APPEARANCE_PALETTE: AppearancePalette = {
  version: PALETTE_VERSION,
  entries: [
    { skin: 'fair rosy', hairColour: 'light golden-blonde', hairTexture: 'straight' },
    { skin: 'light warm', hairColour: 'light brown', hairTexture: 'wavy' },
    { skin: 'light olive', hairColour: 'dark brown', hairTexture: 'straight' },
    { skin: 'warm beige', hairColour: 'medium brown', hairTexture: 'wavy' },
    { skin: 'warm tan', hairColour: 'dark brown', hairTexture: 'curly' },
    { skin: 'golden tan', hairColour: 'black', hairTexture: 'straight' },
    { skin: 'warm medium-brown', hairColour: 'dark brown', hairTexture: 'coily' },
    { skin: 'rich brown', hairColour: 'black', hairTexture: 'curly' },
    { skin: 'deep brown', hairColour: 'black', hairTexture: 'coily' },
    { skin: 'deep espresso', hairColour: 'black', hairTexture: 'tight coils' },
  ],
} as const;

/** Deterministic normalization of a story key (dir/extension-insensitive, case/space-insensitive). */
export function normalizeStoryKey(storyKey: string): string {
  return storyKey
    .trim()
    .toLowerCase()
    .replace(/\.md$/i, '')
    .replace(/^.*[\\/]/, '');
}

/** The palette index for a (story, cast member) — pure, deterministic, and independent of order/time/deploy. */
export function paletteIndexFor(palette: AppearancePalette, storyKey: string, castId: string): number {
  const key = `${VISUAL_CONTRACT_SCHEMA_VERSION}|${palette.version}|${normalizeStoryKey(storyKey)}|${castId}`;
  const digest = createHash('sha256').update(key).digest('hex');
  // Take a wide slice so the modulo is well-distributed across the (small) entry table.
  return Number(BigInt(`0x${digest.slice(0, 15)}`) % BigInt(palette.entries.length));
}

export function paletteEntryFor(palette: AppearancePalette, storyKey: string, castId: string): PaletteEntry {
  return palette.entries[paletteIndexFor(palette, storyKey, castId)];
}
