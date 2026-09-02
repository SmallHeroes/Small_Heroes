import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { allNominalMvpStorySlots } from '@/backend/config/mvp-story-matrix';
import { buildPageNarrationTtsText } from '@/backend/providers/audio';
import {
  STORY_BANK_V3_DIR_NAME,
  V3_APPROVED_DIR_NAME,
} from '@/backend/providers/story-bank-index';
import { canonicalHash } from '@/lib/canonical-json';
import { getCompanionById } from '@/lib/companions';
import { resolveStoryBankPlaceholders } from '@/lib/story-bank-personalization';
import { parseStorySourceContent } from '@/lib/visual-contract-compiler/storySourceContent';
import {
  auditWizardAllStoryRenderReadiness,
  classifyAcceptedSourceAuthorityBlocker,
  configuredProductSourcePaths,
  inspectWizardStorySourceEvidence,
  isQaLowStoryGenerationReady,
} from '@/lib/visual-package/wizardAllStoryRenderReadiness';
import { auditMvpRenderQualification } from '@/lib/visual-package/audit';
import { STYLE_IDS } from '@/lib/styles';

const REPO = process.cwd();
const FIXED_NOW = () => new Date('2026-09-02T12:00:00.000Z');
const CHAMELEON_STORY_KEY = 'chameleon_koko_bedtime';
const CHAMELEON_SOURCE =
  'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a/integrated.md';
const CHAMELEON_PACKAGE =
  '836a3414174dbe3060010371e81ebdbef821f705650a199cc4bbfd70081d523f';

function baseline() {
  vi.stubEnv('ENABLE_V3_APPROVED_BANK', 'true');
  vi.stubEnv('ENABLE_WIZARD_QA_RENDER_CATALOG', 'false');
  return auditWizardAllStoryRenderReadiness({
    repoRoot: REPO,
    now: FIXED_NOW,
  });
}

describe('Wizard all-story render-readiness control plane', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('reports the exact 18-slot baseline without collapsing QA, accepted, or package authority', () => {
    const report = baseline();
    const expectedSlots = allNominalMvpStorySlots();
    const strictAudit = auditMvpRenderQualification({
      repoRoot: REPO,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      now: FIXED_NOW,
    });
    const strictByStory = new Map(
      strictAudit.records.map((record) => [record.storyKey, record]),
    );

    expect(report.records.map((record) => record.storyKey)).toEqual(
      expectedSlots.map((slot) => slot.storyKey),
    );
    expect(new Set(report.records.map((record) => record.storyKey)).size).toBe(18);
    expect(report.summary).toEqual({
      nominalSlotCount: 18,
      environmentProductSellableCount: 18,
      qaLowReadyCount: 18,
      acceptedProductLineageCount: 1,
      visualContractAuthoringAdmittedCount: 18,
      renderQualifiedCount: 1,
      sourceCorpusConflictCount: 18,
      supportedGenderProjectionReadyCount: 18,
      supportedNarrationInputReadyCount: 18,
      supportedCriticalTtsGateReadyCount: 18,
      supportedNarrationAutomatedPreflightReadyCount: 18,
      softTtsReviewItemCount: 12,
      storiesWithSoftTtsReviewItemsCount: 6,
    });
    expect(report.decisions.productSourceCorpus).toEqual({
      required: true,
      currentFallback: 'v3_product_fallback',
      alternate: 'qa_low_only',
      conflictingSlotCount: 18,
      decisionRequiredSlotCount: 17,
    });

    for (const record of report.records) {
      expect(record.productionStages.renderQualified).toBe(
        strictByStory.get(record.storyKey)?.renderQualified,
      );
      expect(record.qaAuthority.readyForLowStoryGeneration).toBe(true);
      expect(record.qaAuthority.companionMinimumResemblance).toBeGreaterThanOrEqual(0.7);
      expect(record.qaAuthority.resemblanceThreshold).toBe(0.7);
      expect(record.sources.v3ProductFallback.available).toBe(true);
      expect(record.sources.qaLowOnly.available).toBe(true);
      if (record.storyKey !== CHAMELEON_STORY_KEY) {
        expect(record.sources.corpusDecisionRequired).toBe(true);
        expect(record.earliestBlocker).toBe(
          'product_source_corpus_unconfirmed',
        );
        expect(record.nextCanonicalAction).toMatchObject({
          code: 'guy_select_product_source_corpus',
          requiresGuyDecision: true,
          providerSpendAuthorized: false,
        });
      }
    }

    const chameleon = report.records.find(
      (record) => record.storyKey === CHAMELEON_STORY_KEY,
    );
    expect(chameleon).toBeDefined();
    expect(chameleon).toMatchObject({
      earliestBlocker: null,
      nextCanonicalAction: null,
      productionStages: {
        sourceCorpusConfirmed: true,
        acceptedSourceRevision: true,
        visualContractAuthoringAdmitted: true,
        publishedPackageBoundVisualContractTemplate: true,
        publishedPackageBoundApprovedBlueprint: true,
        publishedPackageBoundBoardsAndProps: true,
        approvedVisualPackage: true,
        renderQualified: true,
      },
      packageAuthority: {
        revisionDigest: CHAMELEON_PACKAGE,
        state: 'approved',
        requiredBoardCount: 2,
        requiredPropReferenceCount: 0,
      },
    });
    expect(chameleon?.sources.acceptedProductRevisions).toHaveLength(1);
    expect(chameleon?.sources.acceptedProductSource).toMatchObject({
      role: 'accepted_product_source',
      available: true,
      path: CHAMELEON_SOURCE,
    });
    expect(chameleon?.sources.approvedVisualPackageSource).toMatchObject({
      role: 'approved_visual_package_source',
      available: true,
      path: CHAMELEON_SOURCE,
    });
    expect(chameleon?.sources.corpusDecisionRequired).toBe(false);
  });

  it('freezes direction contracts, policy blockers, narration review items, and product/UI mismatches', () => {
    const report = baseline();
    const directionContracts = {
      bedtime: { renderBeatCount: 8, displayPageCount: 16, priceILS: 59 },
      adventure: { renderBeatCount: 12, displayPageCount: 24, priceILS: 79 },
      fantasy: { renderBeatCount: 16, displayPageCount: 32, priceILS: 99 },
    } as const;
    for (const record of report.records) {
      expect(record).toMatchObject(directionContracts[record.direction]);
    }

    expect(report.decisions.fantasyAuthoringPolicy).toEqual({
      required: false,
      blockedStoryKeys: [],
      currentMaximumPages: 16,
    });
    expect(report.decisions.genderContract).toEqual({
      wizardOptions: ['boy', 'girl', 'other'],
      technicallyCertified: ['boy', 'girl'],
      otherUsesMasculineChipProjection: true,
      otherCertified: false,
    });
    expect(report.decisions.ageContract).toEqual({
      productPromise: { minimum: 3, maximum: 8 },
      wizardOptions: [2, 3, 4, 5, 6, 7, 8, 9, 10],
      aligned: false,
      storyTextUsesAgeInput: false,
    });

    const softItems = report.records.flatMap((record) =>
      (['boy', 'girl'] as const).flatMap((gender) =>
        (record.productTextReadiness?.[gender].softTtsGaps ?? []).map(
          (gap) => `${record.storyKey}:${gender}:${gap.pageNumber}:${gap.lemma}`,
        ),
      ),
    );
    expect(softItems).toEqual([
      'fox_uri_adventure:boy:2:שם',
      'fox_uri_adventure:girl:2:שם',
      'fox_uri_fantasy:boy:10:שם',
      'fox_uri_fantasy:girl:10:שם',
      'panda_anat_bedtime:boy:1:שם',
      'panda_anat_bedtime:girl:1:שם',
      'panda_anat_fantasy:boy:5:שם',
      'panda_anat_fantasy:girl:5:שם',
      'dragon_dini_adventure:boy:10:שם',
      'dragon_dini_adventure:girl:10:שם',
      'lion_shaket_fantasy:boy:10:שם',
      'lion_shaket_fantasy:girl:10:שם',
    ]);
  });

  it('keeps all 432 selected product page projections executable by the real production TTS builder', () => {
    const report = baseline();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let projectionCount = 0;
    for (const record of report.records) {
      const sourcePath = record.sources.currentProductSourcePath;
      const companion = getCompanionById(record.companionId);
      expect(sourcePath).toBeTruthy();
      expect(companion).not.toBeNull();
      const parsed = parseStorySourceContent(
        fs.readFileSync(path.join(REPO, sourcePath!), 'utf8'),
      );
      for (const childGender of ['boy', 'girl'] as const) {
        for (const page of parsed.pages) {
          const projected = resolveStoryBankPlaceholders(page.text, {
            childName: 'רוני',
            childGender,
            companionName: companion!.name,
          }).trim();
          expect(buildPageNarrationTtsText(projected, false)).not.toBe('');
          projectionCount += 1;
        }
      }
    }
    expect(projectionCount).toBe(432);
    expect(
      report.summary.supportedNarrationAutomatedPreflightReadyCount,
    ).toBe(18);
  });

  it('keeps its semantic digest deterministic and environment claims aligned with runtime helpers', () => {
    const first = baseline();
    const second = auditWizardAllStoryRenderReadiness({
      repoRoot: REPO,
      now: () => new Date('2030-01-01T00:00:00.000Z'),
    });
    expect(first.evaluatedAt).not.toBe(second.evaluatedAt);
    expect(first.digest).toBe(second.digest);
    const {
      evaluatedAt: _evaluatedAt,
      digestAlgorithm: _digestAlgorithm,
      digest: _digest,
      ...semantic
    } = first;
    expect(canonicalHash(semantic)).toBe(first.digest);
    expect(first.effects).toEqual({
      filesWritten: 0,
      directoriesCreated: 0,
      filesDeleted: 0,
      databaseReads: 0,
      databaseWrites: 0,
      storageReads: 0,
      networkCalls: 0,
      providerCalls: 0,
      imagesGenerated: 0,
      audioGenerated: 0,
      ordersCreatedOrModified: 0,
    });

    vi.stubEnv('ENABLE_V3_APPROVED_BANK', 'false');
    const disabled = auditWizardAllStoryRenderReadiness({
      repoRoot: REPO,
      now: FIXED_NOW,
    });
    expect(disabled.records).toHaveLength(18);
    expect(disabled.summary.environmentProductSellableCount).toBe(1);
    expect(disabled.summary.renderQualifiedCount).toBe(1);
    expect(disabled.environment.v3ApprovedBankEnabled).toBe(false);

    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ENABLE_WIZARD_QA_RENDER_CATALOG', 'true');
    const production = auditWizardAllStoryRenderReadiness({
      repoRoot: REPO,
      now: FIXED_NOW,
    });
    expect(production.environment.wizardQaCatalogEnabled).toBe(false);
  });

  it('routes configured banks and classifies accepted/QA authority fail-closed', () => {
    expect(
      configuredProductSourcePaths({
        configuredStatus: 'approved_v3',
        storyKey: 'fox_uri_bedtime',
      }),
    ).toEqual({
      sourcePath:
        `story-bank/${V3_APPROVED_DIR_NAME}/fox_uri_bedtime.md`,
      importSidecarPath:
        `story-bank/${V3_APPROVED_DIR_NAME}/fox_uri_bedtime.import.json`,
    });
    expect(
      configuredProductSourcePaths({
        configuredStatus: 'approved',
        storyKey: 'fox_uri_bedtime',
      }),
    ).toEqual({
      sourcePath:
        `story-bank/${STORY_BANK_V3_DIR_NAME}/fox_uri_bedtime.md`,
      importSidecarPath: null,
    });

    expect(
      classifyAcceptedSourceAuthorityBlocker({
        lineage: { kind: 'present' },
        revisionCount: 0,
        inventoryIssues: [],
        acceptedSourceAvailable: false,
      }),
    ).toMatchObject({
      code: 'accepted_story_source_revision_missing',
      stage: 'source_acceptance',
    });
    expect(
      classifyAcceptedSourceAuthorityBlocker({
        lineage: { kind: 'invalid', reasons: ['tampered'] },
        revisionCount: 0,
        inventoryIssues: [],
        acceptedSourceAvailable: false,
      }),
    ).toMatchObject({
      code: 'accepted_story_source_lineage_invalid',
      message: 'tampered',
    });
    expect(
      isQaLowStoryGenerationReady({
        qaSourceAvailable: false,
        catalogRecordReady: true,
        candidateProductionEligible: false,
      }),
    ).toBe(false);
  });
});

describe('Wizard Story Source evidence', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-wizard-source-'));
    roots.push(root);
    const bank = path.join(root, 'story-bank', 'v3-approved');
    fs.mkdirSync(bank, { recursive: true });
    const sourcePath = 'story-bank/v3-approved/fox_uri_bedtime.md';
    const sidecarPath = 'story-bank/v3-approved/fox_uri_bedtime.import.json';
    fs.copyFileSync(
      path.join(REPO, sourcePath),
      path.join(root, sourcePath),
    );
    fs.copyFileSync(
      path.join(REPO, sidecarPath),
      path.join(root, sidecarPath),
    );
    return { root, sourcePath, sidecarPath };
  }

  function inspect(f: ReturnType<typeof fixture>) {
    return inspectWizardStorySourceEvidence({
      repoRoot: f.root,
      role: 'v3_product_fallback',
      sourcePath: f.sourcePath,
      importSidecarPath: f.sidecarPath,
      expected: {
        storyKey: 'fox_uri_bedtime',
        category: 'NIGHT_FEAR',
        companionId: 'fox_uri',
        direction: 'bedtime',
      },
    });
  }

  it('accepts the golden preamble but rejects swapped identity and duplicate image directions', () => {
    const f = fixture();
    expect(inspect(f)).toMatchObject({
      available: true,
      pageCount: 8,
      imageDirectionCount: 8,
      issues: [],
    });

    const absolute = path.join(f.root, f.sourcePath);
    const original = fs.readFileSync(absolute, 'utf8');
    fs.writeFileSync(
      absolute,
      original.replace('direction: bedtime', 'direction: adventure'),
      'utf8',
    );
    expect(inspect(f).issues).toContain('source_frontmatter_identity_mismatch');

    fs.writeFileSync(
      absolute,
      `${original}\nimageDirection: duplicate direction outside a page\n`,
      'utf8',
    );
    expect(inspect(f).issues).toContain(
      'source_image_direction_coverage_mismatch',
    );
  });

  it('accepts a configured approved source when no import sidecar is required', () => {
    const f = fixture();
    const evidence = inspectWizardStorySourceEvidence({
      repoRoot: f.root,
      role: 'v3_product_fallback',
      sourcePath: f.sourcePath,
      importSidecarPath: null,
      expected: {
        storyKey: 'fox_uri_bedtime',
        category: 'NIGHT_FEAR',
        companionId: 'fox_uri',
        direction: 'bedtime',
      },
    });

    expect(evidence).toMatchObject({
      available: true,
      importSidecarPath: null,
      importSidecarValid: null,
      issues: [],
    });
  });

  it('returns closed evidence for missing and hard-linked source files instead of throwing', () => {
    const missing = fixture();
    fs.unlinkSync(path.join(missing.root, missing.sourcePath));
    expect(inspect(missing)).toMatchObject({
      available: false,
      issues: ['source_missing_or_unreadable'],
    });

    const linked = fixture();
    const sourceAbsolute = path.join(linked.root, linked.sourcePath);
    const sibling = path.join(path.dirname(sourceAbsolute), 'linked-copy.md');
    fs.linkSync(sourceAbsolute, sibling);
    expect(inspect(linked)).toMatchObject({
      available: false,
      issues: ['source_file_identity_invalid'],
    });
  });

  it('keeps missing-source evidence root-independent', () => {
    const left = fixture();
    const right = fixture();
    fs.unlinkSync(path.join(left.root, left.sourcePath));
    fs.unlinkSync(path.join(right.root, right.sourcePath));

    expect(inspect(left)).toEqual(inspect(right));
  });
});

describe('Wizard readiness forbidden-boundary isolation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('contains no authoring, provider, storage, database, process, or filesystem-write seam', () => {
    const files = [
      'lib/visual-package/wizardAllStoryRenderReadiness.ts',
      'scripts/audit-wizard-all-story-readiness.ts',
    ];
    const forbidden = [
      'backend/providers/pipeline',
      'backend/providers/story-bank-loader',
      "from 'openai'",
      "from '@prisma/client'",
      "from '@supabase/supabase-js'",
      'publishVisualPackageV4',
      'fetch(',
      'child_process',
      'OPENAI_API_KEY',
      'ELEVENLABS_API_KEY',
      'REPLICATE_API_TOKEN',
      'writeFileSync(',
      'mkdirSync(',
      'renameSync(',
      'unlinkSync(',
      'createWriteStream(',
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.join(REPO, file), 'utf8');
      for (const token of forbidden) {
        expect(source, `${file} contains forbidden token ${token}`).not.toContain(token);
      }
    }
  });

  it('runs the audit while network and filesystem writes are denied', () => {
    const denied = (boundary: string) => () => {
      throw new Error(`forbidden readiness boundary invoked: ${boundary}`);
    };
    for (const method of [
      'appendFileSync',
      'createWriteStream',
      'linkSync',
      'mkdirSync',
      'renameSync',
      'rmSync',
      'unlinkSync',
      'writeFileSync',
    ] as const) {
      vi.spyOn(fs, method).mockImplementation(denied(`fs.${method}`) as never);
    }
    for (const method of [
      'appendFile',
      'link',
      'mkdir',
      'open',
      'rename',
      'rm',
      'unlink',
      'writeFile',
    ] as const) {
      vi.spyOn(fs.promises, method).mockImplementation(
        denied(`fs.promises.${method}`) as never,
      );
    }
    vi.stubGlobal('fetch', denied('fetch'));
    vi.stubEnv('ENABLE_V3_APPROVED_BANK', 'true');
    vi.stubEnv('ENABLE_WIZARD_QA_RENDER_CATALOG', 'false');

    const report = auditWizardAllStoryRenderReadiness({
      repoRoot: REPO,
      now: FIXED_NOW,
    });
    expect(report).toMatchObject({
      summary: { nominalSlotCount: 18, renderQualifiedCount: 1 },
      effects: { providerCalls: 0, imagesGenerated: 0, ordersCreatedOrModified: 0 },
    });
  });
});
