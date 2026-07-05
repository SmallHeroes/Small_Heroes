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
  /** Concrete hair descriptor (colour + natural texture) — style (length/parting) stays an `explicit` trait. */
  hair: string;
}

export interface AppearancePalette {
  version: string;
  entries: readonly PaletteEntry[];
}

/** Curated coherent {skin, hair} pairs spanning a fair range (mixed pairings allowed — coherence, not typecasting). */
export const DEFAULT_APPEARANCE_PALETTE: AppearancePalette = {
  version: PALETTE_VERSION,
  entries: [
    { skin: 'fair rosy', hair: 'light golden-blonde, straight' },
    { skin: 'light warm', hair: 'light brown, wavy' },
    { skin: 'light olive', hair: 'dark brown, straight' },
    { skin: 'warm beige', hair: 'medium brown, wavy' },
    { skin: 'warm tan', hair: 'dark brown, curly' },
    { skin: 'golden tan', hair: 'black, straight' },
    { skin: 'warm medium-brown', hair: 'dark brown, coily' },
    { skin: 'rich brown', hair: 'black, curly' },
    { skin: 'deep brown', hair: 'black, coily' },
    { skin: 'deep espresso', hair: 'black, tight coils' },
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
