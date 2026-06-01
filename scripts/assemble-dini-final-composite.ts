/**
 * Assemble canonical accepted LOW Dini composite preview (no re-render).
 * Usage: npx tsx scripts/assemble-dini-final-composite.ts
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const AUD_ROOT = path.join(ROOT, 'outputs', 'style01-auditions');
const OUT_DIR = path.join(AUD_ROOT, 'dini-boundary-egg-low-final-composite');

const SOURCE_BY_PAGE: Record<number, string> = {
  1: 'dini-boundary-egg-low-20260601-211811',
  13: 'dini-boundary-egg-low-20260601-211811',
  15: 'dini-boundary-egg-low-20260601-050055',
  20: 'dini-boundary-egg-low-20260601-050055',
  6: 'dini-boundary-egg-low-20260531-203640',
  10: 'dini-boundary-egg-low-20260531-203640',
  16: 'dini-boundary-egg-low-20260531-203640',
};

const RENDERED = [1, 6, 10, 13, 15, 16, 20] as const;

type ManifestPage = {
  pageNumber: number;
  hebrewText?: string;
  imageUrl?: string | null;
  localPng?: string | null;
  failed?: boolean;
  renderStatus?: string;
  sourceRun?: string;
};

function loadManifest(dirName: string) {
  return JSON.parse(
    readFileSync(path.join(AUD_ROOT, dirName, 'manifest.json'), 'utf-8')
  ) as {
    pages?: ManifestPage[];
    allStoryPages?: Array<{ pageNumber: number; hebrewText?: string }>;
  };
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  const hebrewBase = loadManifest('dini-boundary-egg-low-20260601-211811');
  const hebrewByPage = new Map<number, string>();
  for (const p of hebrewBase.allStoryPages ?? []) {
    if (p.hebrewText) hebrewByPage.set(p.pageNumber, p.hebrewText);
  }
  for (const p of hebrewBase.pages ?? []) {
    if (p.hebrewText && !hebrewByPage.has(p.pageNumber)) {
      hebrewByPage.set(p.pageNumber, p.hebrewText);
    }
  }

  const sourceProvenance: Record<number, string> = {};
  const pages: ManifestPage[] = [];

  for (const pageNumber of RENDERED) {
    const srcDir = SOURCE_BY_PAGE[pageNumber];
    const srcManifest = loadManifest(srcDir);
    const srcPage = srcManifest.pages?.find((p) => p.pageNumber === pageNumber);
    const srcPng = path.join(AUD_ROOT, srcDir, `page-${String(pageNumber).padStart(2, '0')}.png`);
    const destPng = path.join(OUT_DIR, `page-${String(pageNumber).padStart(2, '0')}.png`);
    copyFileSync(srcPng, destPng);
    sourceProvenance[pageNumber] = srcDir;
    pages.push({
      pageNumber,
      hebrewText: hebrewByPage.get(pageNumber) ?? srcPage?.hebrewText,
      imageUrl: srcPage?.imageUrl ?? null,
      localPng: destPng,
      failed: false,
      renderStatus: 'rendered',
      sourceRun: srcDir,
    });
  }

  pages.sort((a, b) => a.pageNumber - b.pageNumber);

  const allStoryPages = Array.from({ length: 20 }, (_, i) => {
    const pageNumber = i + 1;
    const rendered = pages.find((p) => p.pageNumber === pageNumber);
    const isRendered = Boolean(rendered);
    return {
      pageNumber,
      hebrewText: hebrewByPage.get(pageNumber) ?? '',
      renderStatus: isRendered ? 'rendered' : 'not rendered in this audition',
      imageUrl: rendered?.imageUrl ?? null,
      localPng: rendered?.localPng ?? null,
    };
  });

  const manifest = {
    audition: 'style01-dini-boundary-egg-low-final-composite',
    compositeNote:
      'Canonical accepted LOW set — assembled from 211811 (p1,p13), 050055 (p15,p20), 203640 (p6,p10,p16). No re-render.',
    sourceProvenance,
    anchorMissingExpected: true,
    anchorMissingNote:
      'EXPECTED: prompt-only locks; new Dini/baby character sheets not yet regenerated.',
    model: 'gpt-image-2',
    quality: 'low',
    provider: 'gpt-image',
    style: 'style01',
    illustrationStyle: 'soft_hand_drawn_storybook',
    storyFile: 'dragon_dini_fantasy.md',
    refConfig: 'A',
    orderId: 'style01-dini-boundary-final-composite',
    manifestDir: 'dini-boundary-egg-low-final-composite',
    outputRoot: 'outputs/style01-auditions',
    totalStoryPages: 20,
    renderedPageNumbers: [...RENDERED],
    previewUrl:
      '/dev/style01-book-preview?dir=dini-boundary-egg-low-final-composite&root=outputs',
    failedPages: [] as number[],
    pages,
    allStoryPages,
    acceptanceChecklist: [
      'Composite of accepted LOW renders — full-slice visual sign-off before girl-test',
      'p1,p13 ← 211811 | p15,p20 ← 050055 | p6,p10,p16 ← 203640',
    ],
  };

  writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`Composite ready: ${OUT_DIR}`);
  console.log(`Preview: http://localhost:3000/dev/style01-book-preview?dir=dini-boundary-egg-low-final-composite&root=outputs`);
}

main();
