import { canonicalHash } from '@/lib/canonical-json';

import {
  SET_BOARD_AMBIENT_DRESSING_CATEGORIES,
  SET_BOARD_AMBIENT_DRESSING_POLICY_VERSION,
  type SetBoardAmbientDressingCategory,
  type SetBoardAmbientDressingPolicy,
} from './types';

export const SET_BOARD_AMBIENT_DRESSING_LABELS: Readonly<
  Record<SetBoardAmbientDressingCategory, string>
> = Object.freeze({
  fixed_practical_light: 'fixed practical light, such as a small night light or wall light',
  books_without_readable_text: 'picture books with blank, unreadable covers',
  soft_furnishing: 'soft furnishing, such as a woven rug or cushion',
  toy_storage_and_blocks: 'toy storage with simple wooden blocks or shape toys',
  clearly_inanimate_cloth_doll: 'one clearly manufactured, inanimate cloth doll',
  non_text_wall_decor: 'non-text wall art, decals, or hanging shapes',
  plant: 'one modest indoor or outdoor plant where physically appropriate',
  ordinary_storage: 'ordinary fixed or freestanding storage appropriate to the space',
  surface_detail: 'small material and surface details that make the set specific and lived-in',
});

const CANONICAL_POLICY: SetBoardAmbientDressingPolicy = {
  version: SET_BOARD_AMBIENT_DRESSING_POLICY_VERSION,
  density: 'rich_lived_in',
  selectionMode: 'space_appropriate_subset',
  minimumDistinctDetails: 4,
  allowedCategories: [...SET_BOARD_AMBIENT_DRESSING_CATEGORIES],
  inanimateOnly: true,
  textFree: true,
  spoilerNeutral: true,
};

const CANONICAL_POLICY_DIGEST = canonicalHash(CANONICAL_POLICY);

export function currentSetBoardAmbientDressingPolicy(): SetBoardAmbientDressingPolicy {
  return structuredClone(CANONICAL_POLICY);
}

export function assertCurrentSetBoardAmbientDressingPolicy(
  policy: SetBoardAmbientDressingPolicy,
): void {
  if (canonicalHash(policy) !== CANONICAL_POLICY_DIGEST) {
    throw new Error('set_board_ambient_dressing_policy_invalid');
  }
}

export interface SetBoardAmbientDressingSelection {
  category: SetBoardAmbientDressingCategory;
  label: string;
}

/**
 * Select the prompt-visible subset after the ordinary blocked-cast/prop vocabulary check. A generic decor category
 * must never re-authorize a same-named story prop that this particular board explicitly blocks.
 */
export function selectSetBoardAmbientDressing(
  policy: SetBoardAmbientDressingPolicy,
  labelIsSafe: (label: string) => boolean,
): SetBoardAmbientDressingSelection[] {
  assertCurrentSetBoardAmbientDressingPolicy(policy);
  const selected = policy.allowedCategories
    .map((category) => ({
      category,
      label: SET_BOARD_AMBIENT_DRESSING_LABELS[category],
    }))
    .filter((entry) => labelIsSafe(entry.label));
  if (selected.length < policy.minimumDistinctDetails) {
    throw new Error('set_board_ambient_dressing_authority_insufficient');
  }
  return selected;
}
