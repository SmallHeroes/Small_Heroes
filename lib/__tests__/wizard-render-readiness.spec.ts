import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  allMvpCategories,
  MVP_STORY_MATRIX,
  type StoryDirection,
} from '@/backend/config/mvp-story-matrix';
import {
  isWizardQaCatalogEnabled,
  loadWizardQaCatalog,
  WIZARD_QA_RESEMBLANCE_THRESHOLD,
} from '@/lib/wizard-render-readiness';

const DIRECTIONS: StoryDirection[] = ['bedtime', 'adventure', 'fantasy'];

describe('Wizard QA render catalog', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('contains one exact source/companion/candidate authority for every matrix slot', () => {
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
          `story-bank/v3-approved/${companionId}_${direction}.md`,
        );
        expect(record?.storyReady).toBe(true);
        expect(record?.qaAuthoringReady).toBe(true);
        expect(record?.productionRenderQualified).toBe(false);
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
          template: { pageContracts: unknown[] };
          source: { pageCount: number };
        };
        expect(artifact.productionEligible).toBe(false);
        expect(artifact.companionAuthority.views).toHaveLength(6);
        expect(artifact.companionAuthority.resemblanceThreshold).toBe(
          WIZARD_QA_RESEMBLANCE_THRESHOLD,
        );
        expect(artifact.companionAuthority.minimumResemblance).toBeGreaterThanOrEqual(0.7);
        expect(artifact.template.pageContracts).toHaveLength(artifact.source.pageCount);
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
