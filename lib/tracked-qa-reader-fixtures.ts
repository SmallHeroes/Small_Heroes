import page01Asset from '../qa-fixtures/reader/r1d-dini-bar-canonical-anchor-d728849a/page-01.webp';
import page02Asset from '../qa-fixtures/reader/r1d-dini-bar-canonical-anchor-d728849a/page-02.webp';
import page03Asset from '../qa-fixtures/reader/r1d-dini-bar-canonical-anchor-d728849a/page-03.webp';
import page04Asset from '../qa-fixtures/reader/r1d-dini-bar-canonical-anchor-d728849a/page-04.webp';
import page05Asset from '../qa-fixtures/reader/r1d-dini-bar-canonical-anchor-d728849a/page-05.webp';
import bunnyPage01Asset from '../qa-fixtures/reader/r1d-bunny-bar-expression-generalization-fe97f823/page-01.webp';
import bunnyPage02Asset from '../qa-fixtures/reader/r1d-bunny-bar-expression-generalization-fe97f823/page-02.webp';
import bunnyPage03Asset from '../qa-fixtures/reader/r1d-bunny-bar-expression-generalization-fe97f823/page-03.webp';
import bunnyPage04Asset from '../qa-fixtures/reader/r1d-bunny-bar-expression-generalization-fe97f823/page-04.webp';
import bunnyPage05Asset from '../qa-fixtures/reader/r1d-bunny-bar-expression-generalization-fe97f823/page-05.webp';

type ImportedImageAsset = string | { src: string };

export type TrackedQaReaderFixture = {
  id: string;
  label: string;
  sourceRenderHead: string;
  storyFile: string;
  companionId: string;
  direction: 'bedtime' | 'adventure' | 'fantasy';
  childProfile: {
    name: string;
    gender: 'boy' | 'girl';
  };
  totalStoryPages: number;
  pages: Array<{
    pageNumber: number;
    imageUrl: string;
  }>;
};

function assetUrl(asset: ImportedImageAsset): string {
  return typeof asset === 'string' ? asset : asset.src;
}

const TRACKED_QA_READER_FIXTURES: readonly TrackedQaReaderFixture[] = [
  {
    id: 'r1d-dini-bar-canonical-anchor-reader-qa-d728849a',
    label: 'Dini + Bar · canonical anchor · pages 1–5',
    sourceRenderHead: 'd728849a9b1192321b34fc2ab61f48a6a00ca1f2',
    storyFile: 'dragon_dini_fantasy.md',
    companionId: 'dragon_dini',
    direction: 'fantasy',
    childProfile: {
      name: 'Bar',
      gender: 'boy',
    },
    totalStoryPages: 16,
    pages: [page01Asset, page02Asset, page03Asset, page04Asset, page05Asset].map(
      (asset, index) => ({
        pageNumber: index + 1,
        imageUrl: assetUrl(asset),
      })
    ),
  },
  {
    id: 'r1d-bunny-bar-expression-generalization-reader-qa-fe97f823',
    label: 'Buni + Bar · expression generalization · pages 1–5',
    sourceRenderHead: 'fe97f823',
    storyFile: 'bunny_ometz_adventure.md',
    companionId: 'bunny_ometz',
    direction: 'adventure',
    childProfile: {
      name: 'Bar',
      gender: 'boy',
    },
    totalStoryPages: 12,
    pages: [
      bunnyPage01Asset,
      bunnyPage02Asset,
      bunnyPage03Asset,
      bunnyPage04Asset,
      bunnyPage05Asset,
    ].map((asset, index) => ({
      pageNumber: index + 1,
      imageUrl: assetUrl(asset),
    })),
  },
] as const;

export function trackedQaReaderFixtureForDir(dir: string): TrackedQaReaderFixture | null {
  return TRACKED_QA_READER_FIXTURES.find((fixture) => fixture.id === dir) ?? null;
}

export function listTrackedQaReaderFixtures(): readonly TrackedQaReaderFixture[] {
  return TRACKED_QA_READER_FIXTURES;
}
