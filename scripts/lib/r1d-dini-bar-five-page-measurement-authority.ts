import type { BookShotPlan } from '@/lib/book-shot-plan';
import {
  projectPageMustNotShow,
  projectPageMustShow,
  type BookVisualContract,
  type BookVisualContractTemplate,
} from '@/lib/visual-contract-compiler';

export const DINI_BAR_MEASUREMENT_PAGES = [1, 2, 3, 4, 5] as const;

export const DINI_BAR_SHOT_PLAN: BookShotPlan = {
  pageCount: 16,
  source: 'override',
  pages: [
    { page: 1, shot: 'medium_wide', angle: 'eye', rationale: 'Establish Bar alone in the crowded bedroom.' },
    { page: 2, shot: 'close_up', angle: 'high', rationale: 'Look down past Bar into the glowing toy-chest portal.' },
    { page: 3, shot: 'establishing_wide', angle: 'low', rationale: 'Reveal the orange-hill world and Dini at a radically wider scale.' },
    { page: 4, shot: 'dynamic_angle', angle: 'eye', rationale: 'Read Dini tail, bell, stone and comic embarrassment in side action.' },
    { page: 5, shot: 'intimate', angle: 'high', rationale: 'Look gently into the nest while keeping Bar and Dini emotionally present.' },
    { page: 6, shot: 'dynamic_angle', angle: 'low', rationale: 'Follow the egg popping out of the nest.' },
    { page: 7, shot: 'medium_wide', angle: 'eye', rationale: 'Track the downhill chase with landscape context.' },
    { page: 8, shot: 'establishing_wide', angle: 'high', rationale: 'Show the full downhill relation to the purple swamp.' },
    { page: 9, shot: 'close_up', angle: 'eye', rationale: 'Isolate the tiny crack and Dini shock.' },
    { page: 10, shot: 'medium', angle: 'eye', rationale: 'Hold a reflective three-way attention line.' },
    { page: 11, shot: 'close_up', angle: 'high', rationale: 'Prioritize Bar hands and the soft silver cloth.' },
    { page: 12, shot: 'medium_wide', angle: 'high', rationale: 'Make the open ribbon boundary spatially legible.' },
    { page: 13, shot: 'intimate', angle: 'eye', rationale: 'Stay close for the gentle hatch reveal.' },
    { page: 14, shot: 'medium', angle: 'low', rationale: 'Give the hatchling room to wobble safely.' },
    { page: 15, shot: 'intimate', angle: 'eye', rationale: 'Echo the loose-hug lesson at home.' },
    { page: 16, shot: 'establishing_wide', angle: 'eye', rationale: 'Resolve with the whole bedroom breathing again.' },
  ],
};

const PROP_VISIBILITY: Record<
  number,
  Array<{ propId: string; visibility: 'required' | 'forbidden' }>
> = {
  1: [
    { propId: 'prop_yellow_blanket', visibility: 'required' },
    { propId: 'prop_baby_things_cluster', visibility: 'required' },
  ],
  2: [
    { propId: 'prop_toy_chest_portal', visibility: 'required' },
    { propId: 'prop_green_speckled_egg', visibility: 'forbidden' },
  ],
  3: [
    { propId: 'prop_toy_chest_portal', visibility: 'forbidden' },
    { propId: 'prop_green_speckled_egg', visibility: 'forbidden' },
    { propId: 'prop_soft_nest', visibility: 'forbidden' },
  ],
  4: [
    { propId: 'prop_small_stone', visibility: 'required' },
    { propId: 'prop_green_speckled_egg', visibility: 'forbidden' },
    { propId: 'prop_soft_nest', visibility: 'forbidden' },
  ],
  5: [
    { propId: 'prop_soft_nest', visibility: 'required' },
    { propId: 'prop_green_speckled_egg', visibility: 'required' },
    { propId: 'prop_silver_cloth_ribbon', visibility: 'forbidden' },
  ],
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Local measurement overlay only: turn explicit legacy prop states for the five audition pages
 * into typed Blueprint placement authority. It changes no production compiler behavior.
 */
export function applyDiniBarFivePageMeasurementOverlay(
  template: BookVisualContractTemplate,
): void {
  const nestPage = template.pageContracts.find((entry) => entry.pageNumber === 5);
  if (!nestPage?.zoneId) throw new Error('Dini measurement nest-page zone is missing');
  template.coverContract.zoneId = nestPage.zoneId;
  template.coverContract.castIds = [...(nestPage.castIds ?? [])];

  const openingPage = template.pageContracts.find((entry) => entry.pageNumber === 1);
  const openingLocation = template.locations.find(
    (entry) => entry.id === openingPage?.locationId,
  );
  if (!openingLocation) throw new Error('Dini measurement opening location is missing');
  openingLocation.timeOfDay ??= 'mixed';

  const contract = template as unknown as BookVisualContract;
  for (const pageNumber of DINI_BAR_MEASUREMENT_PAGES) {
    const page = template.pageContracts.find((entry) => entry.pageNumber === pageNumber);
    if (!page) throw new Error(`Dini measurement page ${pageNumber} is missing`);
    page.propConstraints = structuredClone(PROP_VISIBILITY[pageNumber]);
    page.mustShow = unique([...page.mustShow, ...projectPageMustShow(page, contract)]);
    page.mustNotShow = unique([
      ...page.mustNotShow,
      ...projectPageMustNotShow(page, contract),
    ]);
  }
}
