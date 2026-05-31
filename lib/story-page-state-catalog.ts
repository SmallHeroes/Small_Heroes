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
  6: {
    presentEntities: [],
    forbiddenEntities: ['dini', 'baby_dragon', 'glowing_stone', 'blue_speckled_egg', 'mountain_cave'],
    objectStates: {},
  },
  7: {
    presentEntities: [],
    forbiddenEntities: ['dini', 'baby_dragon', 'glowing_stone', 'blue_speckled_egg', 'mountain_cave'],
    objectStates: {},
  },
  8: {
    presentEntities: [],
    forbiddenEntities: ['dini', 'baby_dragon', 'glowing_stone', 'blue_speckled_egg'],
    objectStates: {},
  },
  9: {
    presentEntities: [],
    forbiddenEntities: ['dini', 'baby_dragon', 'glowing_stone', 'blue_speckled_egg'],
    objectStates: {},
  },
  10: {
    presentEntities: ['glowing_stone', 'baby_dragon'],
    forbiddenEntities: ['intact_blue_speckled_egg', 'intact_full_egg'],
    objectStates: {
      glowing_stone: 'intact',
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
    presentEntities: ['berry_bush', 'broken_crayon'],
    forbiddenEntities: [],
    objectStates: { berry_bush: 'intact', broken_crayon: 'intact' },
  },
  5: {
    presentEntities: ['broken_crayon'],
    forbiddenEntities: [],
    objectStates: { broken_crayon: 'intact' },
  },
  6: {
    presentEntities: ['pond', 'fallen_log'],
    forbiddenEntities: [],
    objectStates: { pond: 'intact', fallen_log: 'intact' },
  },
  7: {
    presentEntities: ['pond'],
    forbiddenEntities: [],
    objectStates: { pond: 'intact' },
  },
  8: {
    presentEntities: ['pond'],
    forbiddenEntities: [],
    objectStates: { pond: 'intact' },
  },
  9: {
    presentEntities: ['pond'],
    forbiddenEntities: [],
    objectStates: { pond: 'intact' },
  },
  10: {
    presentEntities: ['pond'],
    forbiddenEntities: [],
    objectStates: { pond: 'intact' },
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

  const babyContrastLock = `
SIZE CONTRAST (mandatory): The baby dragon is visibly MUCH smaller than Dini — body size ratio approximately 1:3. The baby's head is also proportionally larger relative to its tiny body (newborn proportions). If Dini and the baby appear in the same frame, the baby should sit comfortably in a circle the size of Dini's chest plates.

ANATOMY CONTRAST (mandatory):
- Baby has ZERO horns. Only two tiny soft rounded head bumps.
- Baby has ZERO back spikes (too young — they have not grown yet).
- Baby wings are folded and tiny, NOT spread or extended like Dini's.
- Baby snout is even shorter and more button-like than Dini's.
- Baby does not breathe fire. No flame, no warm glow at the snout.`;

  if (state === 'emerging') {
    return `RECURRING ENTITY LOCK — BABY DRAGON (EMERGING):
One tiny copper-orange dragon hatchling just emerging from the cracking blue-speckled egg. Same species/color family as Dini — NOT green/teal. Wobbly legs, small sunset wings. ONLY ONE baby dragon.
Match the baby dragon reference sheets: oversized round head, two tiny soft head bumps (NOT developed horns), small side ear-flaps, folded tiny coral wings, chubby newborn body, soft pale cream underside.
CRITICAL — not a miniature adult Dini: this baby has softer features, NO developed horns, NO back spikes, NO fire yet, newborn proportions. Distinct from Dini's adult form even though they share copper-orange palette.${babyContrastLock}`;
  }

  if (state === 'present') {
    return `RECURRING ENTITY LOCK — BABY DRAGON (PRESENT):
The same tiny copper-orange dragon hatchling — polished copper-to-sunset scales, warm amber highlights, NOT green/teal. Nestled on the warm zone of the glowing stone. ONLY ONE baby dragon.
Match the baby dragon reference sheets: oversized round head, two tiny soft head bumps (NOT developed horns), small side ear-flaps, folded tiny coral wings, chubby newborn body, soft pale cream underside.
CRITICAL — not a miniature adult Dini: this baby has softer features, NO developed horns, NO back spikes, NO fire yet, newborn proportions. Distinct from Dini's adult form even though they share copper-orange palette.${babyContrastLock}`;
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
        broken_crayon: 'BROKEN CRAYON',
        pond: 'POND',
        fallen_log: 'FALLEN LOG',
      },
      entityLockLabels: {},
      formatObjectLock: formatDobiObjectLock,
      formatEntityLock: () => '',
    };
  }
  return null;
}
