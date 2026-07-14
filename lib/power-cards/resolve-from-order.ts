import 'server-only';

import fs from 'fs/promises';
import path from 'path';
import { selectCompanionStory, STORY_BANK_V3_DIR_NAME } from '@/backend/providers/story-bank-index';
import { getCompanionById } from '@/lib/companions';
import { resolveCompanionHeroUrl } from './hero';
import { getWizardMeta } from '@/lib/orderMeta';
import { normalizeWizardChildGender } from '@/lib/story-bank-personalization';
import {
  parseAndValidateStoryPowerCard,
  resolvePowerCard,
} from './parse';
import { paletteForDirection } from './palettes';
import type { PowerCardPalette, PowerCardRenderInput } from './types';

type OrderPowerCardSource = {
  id: string;
  childName: string;
  childGender: string | null;
  storyDirection: string | null;
  characterAnchors: unknown;
  book: { title: string } | null;
};

function orderGenderToRenderGender(gender: string | null | undefined): PowerCardRenderInput['childGender'] {
  return normalizeWizardChildGender(gender) === 'girl' ? 'female' : 'male';
}

function parseCompanionCanonicalName(markdown: string): string | null {
  const match = markdown.match(/^Companion canonical name:\s*(.+?)\s*$/m);
  if (!match) return null;
  const name = match[1].replace(/\s*\(.*\)\s*$/, '').trim();
  return name || null;
}

function resolveDirection(
  storyDirection: string | null | undefined
): 'bedtime' | 'adventure' | 'fantasy' | null {
  const dir = (storyDirection ?? '').trim().toLowerCase();
  if (dir === 'bedtime' || dir === 'adventure' || dir === 'fantasy') return dir;
  return null;
}

export async function resolvePowerCardRenderInputForOrder(
  order: OrderPowerCardSource
): Promise<PowerCardRenderInput | null> {
  const wizardMeta = getWizardMeta(order.characterAnchors as never);
  const companionId = wizardMeta.companionCharacterId;
  const direction = resolveDirection(order.storyDirection);

  if (!companionId || !direction) return null;

  const selection = selectCompanionStory(companionId, direction);
  if (!selection) return null;

  const storyPath = path.join(
    process.cwd(),
    'story-bank',
    selection.dirName ?? STORY_BANK_V3_DIR_NAME,
    selection.filename
  );
  const markdown = await fs.readFile(storyPath, 'utf8');
  const slug = selection.base;
  const parsed = parseAndValidateStoryPowerCard(markdown, slug);

  if (!parsed.spec) return null;

  const spec = resolvePowerCard({ powerCard: parsed.spec });
  const companion = getCompanionById(companionId);
  // The avatar is the child's ACTUAL companion, full-body — never a shared default. If the companion can't be
  // resolved to its own definition, refuse to render rather than ship someone else's picture (the old bolly bug
  // where any unresolved companion silently became bolly — "everyone gets the same card").
  if (!companion) {
    console.error(
      `[power-card] companion "${companionId}" did not resolve to a definition — refusing the shared default; no card rendered for order ${order.id}.`,
    );
    return null;
  }
  const companionName = parseCompanionCanonicalName(markdown) ?? companion.name;

  const palette: PowerCardPalette = paletteForDirection(direction);

  return {
    spec,
    childName: order.childName.trim(),
    childGender: orderGenderToRenderGender(order.childGender),
    companionName,
    // The companion's OWN art, best quality first (hi-res card sheet → full-body reference); NO shared fallback.
    companionAvatarUrl: resolveCompanionHeroUrl(companion),
    palette,
    bookTitle: order.book?.title?.trim() || undefined,
  };
}
