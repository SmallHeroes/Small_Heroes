import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COMPANION_STORY_PENDING_ALL_DIRECTIONS,
  getCompanionById,
  listActiveCompanionIds,
} from '@/lib/companions';
import { resolveCompanionHeroUrl } from '../hero';

const publicPath = (url: string) => path.join(process.cwd(), 'public', url.replace(/^\//, ''));
// Roster slots with no v5 story yet → they can never reach a Power Card (resolvePowerCardRenderInputForOrder
// returns null before the companion is read). Their art is a known gap tracked in the audit, not a ship blocker.
const NO_STORY = new Set<string>(COMPANION_STORY_PENDING_ALL_DIRECTIONS);

describe('resolveCompanionHeroUrl — full-body, per-companion, no shared default', () => {
  it('prefers the hi-res cardImage sheet when authored', () => {
    const bunny = getCompanionById('bunny_ometz')!;
    expect(bunny.cardImage).toBeTruthy();
    expect(resolveCompanionHeroUrl(bunny)).toBe(bunny.cardImage);
  });

  it('falls back to the full-body reference image when there is no cardImage', () => {
    const bat = getCompanionById('bat_lily')!;
    expect(bat.cardImage).toBeUndefined();
    expect(resolveCompanionHeroUrl(bat)).toBe(bat.image);
  });

  it('resolves each companion to its OWN art (cardImage ?? image) — never a cross-companion default', () => {
    // The old bug lived in resolve-from-order (`companion?.image ?? bolly`): an unresolved companion silently
    // became bolly. resolveCompanionHeroUrl has NO default arm, so it can only ever return THIS companion's art
    // (bolly showing bolly's own reference is correct; every other companion shows its own).
    for (const id of listActiveCompanionIds()) {
      const companion = getCompanionById(id)!;
      expect(resolveCompanionHeroUrl(companion)).toBe(companion.cardImage ?? companion.image);
    }
  });
});

// AUDIT + GUARD: every companion the wizard can pick must resolve to a full-body hero file that actually exists,
// so no order silently loses its card (or worse, gets someone else's). Fails loud listing any gap.
describe('(audit) every active wizard companion has an existing full-body hero source', () => {
  it('no active companion is missing its hero file on disk', () => {
    const missing: string[] = [];
    for (const id of listActiveCompanionIds()) {
      if (NO_STORY.has(id)) continue; // pending-story slots — can't produce a card; tracked in the audit
      const companion = getCompanionById(id);
      if (!companion) {
        missing.push(`${id} — no companion definition`);
        continue;
      }
      const hero = resolveCompanionHeroUrl(companion);
      if (!existsSync(publicPath(hero))) missing.push(`${id} → ${hero} (file not found)`);
    }
    expect(
      missing,
      `active companions missing a full-body hero source:\n${missing.join('\n')}`,
    ).toEqual([]);
  });
});
