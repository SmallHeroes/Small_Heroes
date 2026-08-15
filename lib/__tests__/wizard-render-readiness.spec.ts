import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  allMvpCategories,
  MVP_STORY_MATRIX,
  type StoryDirection,
} from '@/backend/config/mvp-story-matrix';
import { WIZARD_QA_STORY_DIR_NAME } from '@/backend/providers/story-bank-index';
import {
  isWizardQaCatalogEnabled,
  loadWizardQaCatalog,
  WIZARD_QA_RESEMBLANCE_THRESHOLD,
} from '@/lib/wizard-render-readiness';
import { loadStoryFromBank } from '@/backend/providers/story-bank-loader';

const DIRECTIONS: StoryDirection[] = ['bedtime', 'adventure', 'fantasy'];

describe('Wizard QA render catalog', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('contains one exact source/companion/storyboard authority for every matrix slot', () => {
    const catalog = loadWizardQaCatalog({ repoRoot: process.cwd() });
    expect(catalog).not.toBeNull();
    expect(catalog?.records).toHaveLength(18);
    const identities = new Set<string>();
    for (const category of allMvpCategories()) {
      const companionId = MVP_STORY_MATRIX[category].companionId;
      for (const direction of DIRECTIONS) {
        const record = catalog?.records.find(
          (candidate) => candidate.category === category && candidate.direction === direction,
        );
        expect(record).toBeDefined();
        expect(record?.storyKey).toBe(`${companionId}_${direction}`);
        expect(record?.storySourcePath).toBe(
          `story-bank/${WIZARD_QA_STORY_DIR_NAME}/${companionId}_${direction}.md`,
        );
        expect(record?.storyReady).toBe(true);
        expect(record?.qaAuthoringReady).toBe(true);
        expect(record?.qaLowStoryGenerationReady).toBe(true);
        expect(record?.productionRenderQualified).toBe(false);
        expect(record?.state).toBe('qa_ready_for_low_story_generation');
        identities.add(`${category}:${direction}`);

        const artifact = JSON.parse(
          fs.readFileSync(path.join(process.cwd(), record!.candidatePath), 'utf8'),
        ) as {
          productionEligible: boolean;
          companionAuthority: {
            resemblanceThreshold: number;
            minimumResemblance: number;
            views: unknown[];
          };
          state: string;
          visualDirections: {
            version: string;
            path: string;
            digest: string;
            pageCount: number;
          };
          source: { pageCount: number };
        };
        expect(artifact.productionEligible).toBe(false);
        expect(artifact.companionAuthority.views).toHaveLength(6);
        expect(artifact.companionAuthority.resemblanceThreshold).toBe(
          WIZARD_QA_RESEMBLANCE_THRESHOLD,
        );
        expect(artifact.companionAuthority.minimumResemblance).toBeGreaterThanOrEqual(0.7);
        expect(artifact.state).toBe('qa_ready_for_low_story_generation');
        expect(artifact.visualDirections.version).toBe(
          'small-heroes-story-visual-direction-record/v1',
        );
        expect(artifact.visualDirections.pageCount).toBe(artifact.source.pageCount);
        expect(artifact.visualDirections.digest).toBe(record?.visualDirectionDigest);
        expect(artifact.visualDirections.path).toMatch(
          /^story-pipeline\/05_storyboard_inputs\/autonomous-20260815-v1\//,
        );
      }
    }
    expect(identities.size).toBe(18);
  });

  it('fails closed when the catalog digest is tampered', () => {
    const source = path.join(process.cwd(), 'qa-authorities', 'wizard', 'catalog.json');
    const tampered = JSON.parse(fs.readFileSync(source, 'utf8')) as Record<string, unknown>;
    tampered.slotCount = 17;
    const targetDir = path.join(process.cwd(), 'outputs', 'wizard-catalog-test');
    fs.mkdirSync(targetDir, { recursive: true });
    const target = path.join(targetDir, 'catalog.json');
    fs.writeFileSync(target, JSON.stringify(tampered), 'utf8');
    try {
      expect(loadWizardQaCatalog({ repoRoot: process.cwd(), catalogPath: target })).toBeNull();
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  });

  it('loads every QA story deterministically for both child-gender paths', async () => {
    const expectedPages: Record<StoryDirection, number> = {
      bedtime: 8,
      adventure: 12,
      fantasy: 16,
    };
    for (const category of allMvpCategories()) {
      const companionId = MVP_STORY_MATRIX[category].companionId;
      for (const direction of DIRECTIONS) {
        const storyPath = path.join(
          process.cwd(),
          'story-bank',
          WIZARD_QA_STORY_DIR_NAME,
          `${companionId}_${direction}.md`,
        );
        for (const child of [
          { name: 'יואב', gender: 'boy' },
          { name: 'נועה', gender: 'girl' },
        ] as const) {
          const story = await loadStoryFromBank(
            storyPath,
            child.name,
            companionId,
            child.gender,
            { skipLlmPersonalization: true },
          );
          expect(story.pages, `${companionId}_${direction}:${child.gender}`).toHaveLength(
            expectedPages[direction],
          );
          expect(
            story.pages.filter((page) => page.text.includes(child.name)).length,
            `${companionId}_${direction}:${child.gender}:personalized pages`,
          ).toBeGreaterThanOrEqual(3);
          expect(
            story.pages.some((page) => /\{\{|\}\}|\{[^{}|]+\|[^{}|]+\}/u.test(page.text)),
          ).toBe(false);
          expect(
            story.pages.every(
              (page) =>
                typeof page.rawScenePrompt === 'string' && page.rawScenePrompt.trim().length > 0,
            ),
          ).toBe(true);
        }
      }
    }
  });

  it('cannot be enabled in real Production even when all QA flags are set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('ALLOW_STAGING_QA', 'true');
    vi.stubEnv('ENABLE_WIZARD_QA_RENDER_CATALOG', 'true');
    expect(isWizardQaCatalogEnabled()).toBe(false);
  });

  it('keeps the public Wizard summary independent of the legacy companion roster', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'public', 'JS', 'wizard.js'),
      'utf8',
    );
    const summaryResolver = source.match(
      /function getCompanionImageForSummary\(\) \{[\s\S]*?\n\}/,
    )?.[0];
    expect(summaryResolver).toBeDefined();
    expect(summaryResolver).not.toContain('COMPANIONS_BY_CATEGORY');
    expect(summaryResolver).toContain('getMvpSlotForTopic');
  });
});
