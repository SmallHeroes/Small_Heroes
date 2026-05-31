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
    presentEntities: ['pillow_fortress', 't_rex_toy', 'crib'],
    forbiddenEntities: ['dini', 'baby_dragon', 'green_speckled_egg', 'toy_chest_portal', 'orange_moss_hills', 'silver_ribbon'],
    objectStates: { pillow_fortress: 'intact', t_rex_toy: 'intact', crib: 'intact' },
  },
  2: {
    presentEntities: ['crib', 'yellow_blanket', 't_rex_toy', 'baby_sister'],
    forbiddenEntities: ['dini', 'baby_dragon', 'green_speckled_egg', 'pillow_fortress', 'toy_chest_portal'],
    objectStates: { crib: 'intact', yellow_blanket: 'intact', t_rex_toy: 'intact' },
  },
  3: {
    presentEntities: ['toy_chest', 'dini'],
    forbiddenEntities: ['baby_dragon', 'green_speckled_egg', 'orange_moss_hills', 'silver_ribbon', 'pillow_fortress'],
    objectStates: { toy_chest: 'intact' },
  },
  4: {
    presentEntities: ['toy_chest', 'dini'],
    forbiddenEntities: ['baby_dragon', 'green_speckled_egg', 'orange_moss_hills', 'silver_ribbon', 'crib'],
    objectStates: { toy_chest: 'intact' },
  },
  5: {
    presentEntities: ['toy_chest', 'dini', 'orange_moss_hills'],
    forbiddenEntities: ['baby_dragon', 'green_speckled_egg', 'silver_ribbon', 'crib', 'pillow_fortress'],
    objectStates: { toy_chest: 'portal_active', orange_moss_hills: 'intact' },
  },
  6: {
    presentEntities: ['dini', 'green_speckled_egg', 'nest_of_cushions', 'orange_moss_hills'],
    forbiddenEntities: ['baby_dragon', 'crib', 'pillow_fortress', 'silver_ribbon', 'cracked_eggshell'],
    objectStates: { green_speckled_egg: 'intact_bouncing', nest_of_cushions: 'intact', orange_moss_hills: 'intact' },
  },
  7: {
    presentEntities: ['dini', 'green_speckled_egg', 'orange_moss_hills'],
    forbiddenEntities: ['baby_dragon', 'crib', 'silver_ribbon', 'cracked_eggshell'],
    objectStates: { green_speckled_egg: 'intact_wobbling', orange_moss_hills: 'intact' },
  },
  8: {
    presentEntities: ['dini', 'green_speckled_egg', 'orange_moss_hills'],
    forbiddenEntities: ['baby_dragon', 'silver_ribbon', 'cracked_eggshell'],
    objectStates: { green_speckled_egg: 'intact_launched', orange_moss_hills: 'intact' },
  },
  9: {
    presentEntities: ['dini', 'green_speckled_egg', 'orange_moss_hills'],
    forbiddenEntities: ['baby_dragon', 'silver_ribbon', 'cracked_eggshell'],
    objectStates: { green_speckled_egg: 'intact_vibrating', orange_moss_hills: 'intact' },
  },
  10: {
    presentEntities: ['dini', 'green_speckled_egg', 'blue_crystal_slide'],
    forbiddenEntities: ['baby_dragon', 'silver_ribbon', 'cracked_eggshell'],
    objectStates: { green_speckled_egg: 'intact_rolling', blue_crystal_slide: 'intact' },
  },
  11: {
    presentEntities: ['dini', 'green_speckled_egg', 'whisper_valley_reeds', 'marshmallow_swamp'],
    forbiddenEntities: ['baby_dragon', 'silver_ribbon', 'cracked_eggshell', 'orange_moss_hills'],
    objectStates: { green_speckled_egg: 'intact_spinning', whisper_valley_reeds: 'intact', marshmallow_swamp: 'intact' },
  },
  12: {
    presentEntities: ['dini', 'green_speckled_egg', 'whisper_valley_reeds', 'silver_ribbon'],
    forbiddenEntities: ['baby_dragon', 'cracked_eggshell', 'marshmallow_swamp'],
    objectStates: { green_speckled_egg: 'intact_spinning', silver_ribbon: 'hanging_intact', whisper_valley_reeds: 'intact' },
  },
  13: {
    presentEntities: ['dini', 'green_speckled_egg', 'silver_ribbon'],
    forbiddenEntities: ['baby_dragon', 'cracked_eggshell'],
    objectStates: { green_speckled_egg: 'being_wrapped', silver_ribbon: 'active_wrapping' },
  },
  14: {
    presentEntities: ['dini', 'green_speckled_egg', 'silver_ribbon', 'orange_moss_hills'],
    forbiddenEntities: ['baby_dragon', 'cracked_eggshell'],
    objectStates: { green_speckled_egg: 'wrapped_burrito', silver_ribbon: 'fully_wrapped' },
  },
  15: {
    presentEntities: ['dini', 'green_speckled_egg', 'silver_ribbon'],
    forbiddenEntities: ['baby_dragon', 'cracked_eggshell'],
    objectStates: { green_speckled_egg: 'wrapped_glowing', silver_ribbon: 'fully_wrapped' },
  },
  16: {
    presentEntities: ['baby_dragon', 'cracked_eggshell', 'silver_ribbon', 'orange_moss_hills'],
    forbiddenEntities: ['green_speckled_egg', 'dini'],
    objectStates: { cracked_eggshell: 'split_open', silver_ribbon: 'torn', baby_dragon: 'newly_hatched' },
  },
  17: {
    presentEntities: ['dini', 'baby_dragon', 'orange_moss_hills'],
    forbiddenEntities: ['green_speckled_egg', 'silver_ribbon'],
    objectStates: { baby_dragon: 'present_shell_on_snout', orange_moss_hills: 'intact' },
  },
  18: {
    presentEntities: ['dini', 'baby_dragon', 'orange_moss_hills'],
    forbiddenEntities: ['green_speckled_egg'],
    objectStates: { baby_dragon: 'present', orange_moss_hills: 'intact' },
  },
  19: {
    presentEntities: ['dini', 'baby_dragon', 'toy_chest', 'orange_moss_hills'],
    forbiddenEntities: ['green_speckled_egg', 'crib', 'pillow_fortress'],
    objectStates: { toy_chest: 'portal_active', baby_dragon: 'present_shell_on_snout', orange_moss_hills: 'intact' },
  },
  20: {
    presentEntities: ['crib', 'yellow_blanket', 'baby_sister', 'pillow_fortress'],
    forbiddenEntities: ['dini', 'baby_dragon', 'green_speckled_egg', 'orange_moss_hills', 'silver_ribbon', 'toy_chest'],
    objectStates: { crib: 'intact', yellow_blanket: 'wrapping_active', pillow_fortress: 'expanded' },
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

const GREEN_EGG_STATE_SUFFIX: Partial<Record<ObjectState, string>> = {
  intact_bouncing: `STATE — BOUNCING: Egg mid-air, ricocheting off surfaces with comic motion lines.`,
  intact_wobbling: `STATE — WOBBLING: Egg wobbling on orange moss, about to roll down a slope.`,
  intact_launched: `STATE — LAUNCHED: Egg shooting upward from the failed roar attempt, comic motion lines.`,
  intact_vibrating: `STATE — VIBRATING: Egg vibrating in place, motion-blurred from the maraca dance.`,
  intact_rolling: `STATE — ROLLING: Egg rolling down the blue crystal slide ahead of Dini and child.`,
  intact_spinning: `STATE — SPINNING: Egg spinning on its tip like a top in whisper valley.`,
  being_wrapped: `STATE — BEING WRAPPED: Egg mid-spin; child wrestling it while silver ribbon loops around.`,
  wrapped_burrito: `STATE — WRAPPED BURRITO: Egg fully wrapped in silver ribbon, lying still like a giant burrito.`,
  wrapped_glowing: `STATE — WRAPPED GLOWING: Egg wrapped in ribbon, pulsing slow amber-green glow visible through ribbon.`,
};

const SILVER_RIBBON_STATE_SUFFIX: Partial<Record<ObjectState, string>> = {
  hanging_intact: `STATE — HANGING: Wide silvery strand hanging from a reed, within the child's reach. Not yet cut or used.`,
  active_wrapping: `STATE — ACTIVE WRAPPING: Ribbon being looped around the spinning egg; Dini holds one end.`,
  fully_wrapped: `STATE — FULLY WRAPPED: Ribbon completely encircling the egg like a burrito wrap.`,
  torn: `STATE — TORN: Ribbon ripped open in pieces; hatching has occurred.`,
};

function formatDiniObjectLock(lockId: string, state: ObjectState): string {
  if (state === 'absent') return '';

  const base = DRAGON_DINI_RECURRING_OBJECT_LOCKS[lockId] ?? '';
  if (!base) return '';

  if (lockId === 'green_speckled_egg') {
    const suffix = GREEN_EGG_STATE_SUFFIX[state];
    return suffix ? `${base}\n\n${suffix}` : base;
  }

  if (lockId === 'silver_ribbon') {
    const suffix = SILVER_RIBBON_STATE_SUFFIX[state];
    return suffix ? `${base}\n\n${suffix}` : base;
  }

  if (lockId === 'toy_chest') {
    if (state === 'portal_active') {
      return `${base}\n\nSTATE — PORTAL ACTIVE: Rear interior glows with warm-light shimmer — magical portal between worlds.`;
    }
    return base;
  }

  if (lockId === 'pillow_fortress') {
    if (state === 'expanded') {
      return `${base}\n\nSTATE — EXPANDED: Fortress visibly LARGER than page 1 — chairs pushed outward, extra blanket spread wider.`;
    }
    return base;
  }

  if (lockId === 'yellow_blanket') {
    if (state === 'wrapping_active') {
      return `${base}\n\nSTATE — WRAPPING ACTIVE: Child gently tucking yellow blanket around baby sister in crib — not too tight, not too loose.`;
    }
    return base;
  }

  if (lockId === 'cracked_eggshell') {
    if (state === 'split_open') {
      return `${base}\n\nSTATE — SPLIT OPEN: Two large moss-green halves split apart; pale cream inside; fragments scattered.`;
    }
    return base;
  }

  return base;
}

function formatDiniEntityLock(lockId: string, state: ObjectState): string {
  if (state === 'absent') return '';

  if (lockId === 'baby_sister' && state === 'present') {
    return DRAGON_DINI_RECURRING_ENTITY_LOCKS.baby_sister ?? '';
  }

  if (lockId !== 'baby_dragon') return '';

  const base = DRAGON_DINI_RECURRING_ENTITY_LOCKS.baby_dragon ?? '';

  if (state === 'newly_hatched') {
    return `${base}\n\nSTATE — NEWLY HATCHED: Just emerged from cracked moss-green shell; large amber eyes wide with wonder; tiny star-shaped sneeze puff optional.`;
  }

  if (state === 'present_shell_on_snout') {
    return `${base}\n\nSTATE — SHELL ON SNOUT: Running gag — small piece of broken eggshell visibly stuck on the baby's snout.`;
  }

  if (state === 'present') {
    return `${base}\n\nSTATE — PRESENT: Baby dragon active in scene — moss-green, copper freckles, peach-coral wings; playful and clumsy.`;
  }

  if (state === 'emerging') {
    return `${base}\n\nSTATE — EMERGING: Baby dragon just breaking free from shell fragments.`;
  }

  return base;
}

function formatDobiObjectLock(lockId: string, state: ObjectState): string {
  if (state === 'absent') return '';
  return BEAR_CUB_DOBI_RECURRING_OBJECT_LOCKS[lockId] ?? '';
}

export function resolveStoryStateLockBundle(companionId?: string | null): StoryStateLockBundle | null {
  if (companionId === 'dragon_dini') {
    return {
      objectLockLabels: {
        pillow_fortress: 'PILLOW FORTRESS',
        crib: 'CRIB',
        yellow_blanket: 'YELLOW BLANKET',
        toy_chest: 'TOY CHEST',
        t_rex_toy: 'T-REX TOY',
        green_speckled_egg: 'GREEN SPECKLED EGG',
        silver_ribbon: 'SILVER RIBBON',
        orange_moss_hills: 'ORANGE MOSS HILLS',
        nest_of_cushions: 'CUSHION NEST',
        blue_crystal_slide: 'BLUE CRYSTAL SLIDE',
        whisper_valley_reeds: 'WHISPER VALLEY REEDS',
        marshmallow_swamp: 'MARSHMALLOW SWAMP',
        cracked_eggshell: 'CRACKED EGGSHELL',
      },
      entityLockLabels: {
        baby_dragon: 'BABY DRAGON',
        baby_sister: 'BABY SISTER',
      },
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
