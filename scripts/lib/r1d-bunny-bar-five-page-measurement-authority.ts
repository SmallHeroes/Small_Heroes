import type { BookShotPlan } from '@/lib/book-shot-plan';
import {
  projectPageMustNotShow,
  projectPageMustShow,
  type BookVisualContract,
  type BookVisualContractTemplate,
} from '@/lib/visual-contract-compiler';

export const BUNNY_BAR_MEASUREMENT_PAGES = [1, 2, 3, 4, 5] as const;

export const BUNNY_BAR_SHOT_PLAN: BookShotPlan = {
  pageCount: 12,
  source: 'override',
  pages: [
    { page: 1, shot: 'establishing_wide', angle: 'eye', rationale: 'Establish the clinic waiting room and Bar holding tension in his body.' },
    { page: 2, shot: 'close_up', angle: 'high', rationale: 'Isolate Bar listening while Buni models a tentative brave step.' },
    { page: 3, shot: 'medium', angle: 'eye', rationale: 'Read Buni’s comic bouncing legs and Bar’s restrained amusement together.' },
    { page: 4, shot: 'medium_wide', angle: 'low', rationale: 'Open the doctor doorway and preserve the hesitant parent-child-companion relation.' },
    { page: 5, shot: 'dynamic_angle', angle: 'low', rationale: 'Make the examination chair feel tall while Bar and Buni deliberately steady themselves.' },
    { page: 6, shot: 'intimate', angle: 'eye', rationale: 'Stay close on the cold stethoscope and planted-paw coping rhythm.' },
    { page: 7, shot: 'medium', angle: 'high', rationale: 'Reveal the syringe drawer while keeping the urge to flee spatially readable.' },
    { page: 8, shot: 'close_up', angle: 'eye', rationale: 'Prioritize the quiet reciprocal look and trembling paws.' },
    { page: 9, shot: 'medium_wide', angle: 'eye', rationale: 'Show Bar choosing an arm while holding the parent’s hand.' },
    { page: 10, shot: 'close_up', angle: 'high', rationale: 'Frame the counting hands and brief injection without spectacle.' },
    { page: 11, shot: 'medium', angle: 'eye', rationale: 'Resolve the bandage reveal with surprise and relief.' },
    { page: 12, shot: 'establishing_wide', angle: 'eye', rationale: 'Release the story into warm daylight outside the clinic.' },
  ],
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Local measurement normalization only. It projects explicit legacy authority into
 * the current Blueprint boundary without changing the production compiler.
 */
export function applyBunnyBarFivePageMeasurementOverlay(
  template: BookVisualContractTemplate,
): void {
  const openingPage = template.pageContracts.find((entry) => entry.pageNumber === 1);
  if (!openingPage?.zoneId) throw new Error('Bunny measurement opening-page zone is missing');
  template.coverContract.zoneId ??= openingPage.zoneId;
  template.coverContract.castIds = [...(openingPage.castIds ?? [])];

  const openingLocation = template.locations.find(
    (entry) => entry.id === openingPage.locationId,
  );
  if (!openingLocation) throw new Error('Bunny measurement opening location is missing');
  openingLocation.timeOfDay ??= 'day';

  for (const location of template.locations) {
    if ((location.anchors?.length ?? 0) > 0) continue;
    location.anchors = [
      {
        id: `${location.id}_measurement_anchor`,
        description: location.description,
      },
    ];
  }

  const contract = template as unknown as BookVisualContract;
  for (const pageNumber of BUNNY_BAR_MEASUREMENT_PAGES) {
    const page = template.pageContracts.find((entry) => entry.pageNumber === pageNumber);
    if (!page) throw new Error(`Bunny measurement page ${pageNumber} is missing`);
    page.mustShow = unique([...page.mustShow, ...projectPageMustShow(page, contract)]);
    page.mustNotShow = unique([
      ...page.mustNotShow,
      ...projectPageMustNotShow(page, contract),
    ]);
  }
}
