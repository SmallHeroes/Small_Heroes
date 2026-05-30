/**
 * Default per-page story states by companion — until frontmatter overrides land in all shelf stories.
 */
import type { ObjectState, PageStoryState, StoryStateLockBundle } from './story-page-state';
import {
  BEAR_CUB_DOBI_RECURRING_OBJECT_LOCKS,
  DRAGON_DINI_RECURRING_ENTITY_LOCKS,
  DRAGON_DINI_RECURRING_OBJECT_LOCKS,
} from './style01-gptimage';

export const DRAGON_DINI_PAGE_STORY_STATES: Record<number, PageStoryState> = {
  1: {
    presentEntities: ['glowing_stone'],
    forbiddenEntities: [
      'blue_speckled_egg',
      'baby_dragon',
      'hatchling',
      'second_dragon',
      'intact_egg',
    ],
    objectStates: { glowing_stone: 'intact' },
  },
  2: {
    presentEntities: ['glowing_stone'],
    forbiddenEntities: [
      'blue_speckled_egg',
      'baby_dragon',
      'hatchling',
      'second_dragon',
      'intact_egg',
    ],
    objectStates: { glowing_stone: 'intact' },
  },
  3: {
    presentEntities: ['glowing_stone', 'blue_speckled_egg'],
    forbiddenEntities: [
      'baby_dragon',
      'hatchling',
      'cracked_egg_open',
      'emerging_creature',
      'second_dragon',
    ],
    objectStates: {
      glowing_stone: 'intact',
      blue_speckled_egg: 'intact',
    },
  },
  4: {
    presentEntities: ['glowing_stone', 'blue_speckled_egg', 'baby_dragon'],
    forbiddenEntities: [
      'second_baby_dragon',
      'intact_egg_alongside_hatched_baby',
      'intact_full_egg',
    ],
    objectStates: {
      glowing_stone: 'intact',
      blue_speckled_egg: 'transitioning',
      baby_dragon: 'emerging',
    },
  },
  5: {
    presentEntities: ['glowing_stone', 'baby_dragon', 'blue_speckled_egg'],
    forbiddenEntities: ['intact_blue_speckled_egg', 'intact_full_egg'],
    objectStates: {
      glowing_stone: 'intact',
      blue_speckled_egg: 'fragments',
      baby_dragon: 'present',
    },
  },
};

export const BEAR_CUB_DOBI_PAGE_STORY_STATES: Record<number, PageStoryState> = {
  1: {
    presentEntities: ['berry_bush', 'mossy_rock'],
    forbiddenEntities: [],
    objectStates: { berry_bush: 'intact', mossy_rock: 'intact' },
  },
  2: {
    presentEntities: ['berry_bush', 'mossy_rock'],
    forbiddenEntities: [],
    objectStates: { berry_bush: 'intact', mossy_rock: 'intact' },
  },
  3: {
    presentEntities: ['berry_bush'],
    forbiddenEntities: [],
    objectStates: { berry_bush: 'intact' },
  },
  4: {
    presentEntities: ['berry_bush'],
    forbiddenEntities: [],
    objectStates: { berry_bush: 'intact' },
  },
  5: {
    presentEntities: [],
    forbiddenEntities: [],
    objectStates: {},
  },
};

const STORY_STATE_BY_COMPANION: Record<string, Record<number, PageStoryState>> = {
  dragon_dini: DRAGON_DINI_PAGE_STORY_STATES,
  bear_cub_gahal: BEAR_CUB_DOBI_PAGE_STORY_STATES,
};

export function resolveDefaultPageStoryState(
  companionId: string | null | undefined,
  pageNumber: number
): PageStoryState | null {
  if (!companionId) return null;
  return STORY_STATE_BY_COMPANION[companionId]?.[pageNumber] ?? null;
}

function formatDiniObjectLock(lockId: string, state: ObjectState): string {
  if (state === 'absent') return '';

  if (lockId === 'glowing_stone') {
    return DRAGON_DINI_RECURRING_OBJECT_LOCKS.glowing_stone ?? '';
  }

  if (lockId === 'blue_speckled_egg') {
    if (state === 'intact') {
      return `RECURRING OBJECT LOCK — BLUE-SPECKLED EGG (INTACT):
The same round blue-speckled egg. Soft pale blue shell with darker blue freckles. Sealed and unbroken on Dini's glowing stone. No cracks visible. Do not show a baby dragon yet.`;
    }
    if (state === 'transitioning') {
      return `RECURRING OBJECT LOCK — BLUE-SPECKLED EGG (CRACKING):
The blue-speckled egg on the glowing stone, mid-hatching. Visible cracks opening. NOT fully intact, NOT yet only scattered fragments. One tiny copper-orange baby dragon just emerging — no second baby.`;
    }
    if (state === 'fragments') {
      return `RECURRING OBJECT LOCK — BLUE-SPECKLED EGG (FRAGMENTS):
Scattered pale blue eggshell pieces with darker speckles around the glowing stone. The intact egg is GONE — only shell fragments remain. NOT a whole unbroken egg.`;
    }
    return DRAGON_DINI_RECURRING_OBJECT_LOCKS.blue_speckled_egg ?? '';
  }

  return '';
}

function formatDiniEntityLock(lockId: string, state: ObjectState): string {
  if (lockId !== 'baby_dragon' || state === 'absent') return '';

  if (state === 'emerging') {
    return `RECURRING ENTITY LOCK — BABY DRAGON (EMERGING):
One tiny copper-orange dragon hatchling just emerging from the cracking blue-speckled egg. Same species/color family as Dini — NOT green/teal. Wobbly legs, small sunset wings. ONLY ONE baby dragon.`;
  }

  if (state === 'present') {
    return `RECURRING ENTITY LOCK — BABY DRAGON (PRESENT):
The same tiny copper-orange dragon hatchling — polished copper-to-sunset scales, warm amber highlights, NOT green/teal. Nestled on the warm zone of the glowing stone. ONLY ONE baby dragon.`;
  }

  return DRAGON_DINI_RECURRING_ENTITY_LOCKS.baby_dragon ?? '';
}

function formatDobiObjectLock(lockId: string, state: ObjectState): string {
  if (state === 'absent') return '';
  return BEAR_CUB_DOBI_RECURRING_OBJECT_LOCKS[lockId] ?? '';
}

export function resolveStoryStateLockBundle(companionId?: string | null): StoryStateLockBundle | null {
  if (companionId === 'dragon_dini') {
    return {
      objectLockLabels: {
        glowing_stone: 'GLOWING STONE',
        blue_speckled_egg: 'BLUE-SPECKLED EGG',
      },
      entityLockLabels: { baby_dragon: 'BABY DRAGON' },
      formatObjectLock: formatDiniObjectLock,
      formatEntityLock: formatDiniEntityLock,
    };
  }
  if (companionId === 'bear_cub_gahal') {
    return {
      objectLockLabels: {
        berry_bush: 'BERRY BUSH',
        mossy_rock: 'MOSSY GREEN ROCK',
      },
      entityLockLabels: {},
      formatObjectLock: formatDobiObjectLock,
      formatEntityLock: () => '',
    };
  }
  return null;
}
