import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildArchitectPilotBundle,
  buildStoryArchitectBundle,
  buildCommissionBundle,
  buildEditorialReviewBundle,
  buildMusicalPolishBundle,
  buildTargetedRevisionBundle,
  commissionMetadata,
  findArchitectPilot,
  findStoryArchitectCommission,
  findCompanionCreativePsychology,
  findCompanionCard,
  findCompanionQaCanon,
  findRecord,
  loadArchitectPilotAuthority,
  loadStoryArchitectAuthority,
  loadCommissionAuthority,
  normalizeTargetedRevisionDraft,
  projectBriefForWriter,
  readEditorialDraftFile,
  readEditorialReviewResultFile,
  validateArchitectPilotsDocument,
  validateStoryArchitectCommissionsDocument,
  validateCompanionCreativePsychologyDocument,
  validateCompanionCardsDocument,
  validateCompanionQaCanonsDocument,
  validateEditorialPassDraft,
  validateProductAcceptance,
  validateEditorialReviewResult,
  writeArchitectPilotFiles,
  writeStoryArchitectFiles,
  writeCommissionFiles,
  writeEditorialReviewFiles,
  writeEditorialPassFiles,
  writeProductAcceptedStorySource,
  writeMusicalPolishFiles,
  writeNormalizedRevisionFiles,
  writeTargetedRevisionFiles,
} = require('../../scripts/materialize-story-commission-briefs.cjs') as Materializer;
const autonomous = require('../../scripts/story-autonomous-batch-core.cjs') as {
  MODEL: string;
  SERVICE_TIER: string;
  EDITOR_MAX_OUTPUT_TOKENS: number;
  buildPrompts: (...args: any[]) => any;
  buildSelectorPrompt: (...args: any[]) => any;
  calculateCostUsd: (usage: Record<string, number>, serviceTier?: string) => number;
  chooseQualifiedOption: (architect: any, selection: any) => any;
  runAutonomousStoryWave: (input: any) => Promise<any>;
  requiredStoryEnvelope: (record: any) => string;
  validateArchitectOptions: (value: any, briefId: string) => any;
  validateSelection: (value: any, briefId: string) => any;
  validateWriterIsolation: (prompt: any, rejected: any[], selection: any) => boolean;
};
const { createOpenAiStoryProvider } = require('../../scripts/story-autonomous-openai-provider.cjs') as {
  createOpenAiStoryProvider: (input: any) => { complete: (request: any) => Promise<any> };
};

interface StoryBrief {
  id: string;
  category: string;
  direction: 'bedtime' | 'adventure' | 'fantasy';
  pageCount: number;
  workingTitle: string;
  creativePromise: string;
  hiddenUnderlayer: string;
  openingHook: string;
  childWant: string;
  physicalProblem: string;
  playRule: string;
  setPieces: Array<{ name: string; dramaticUse: string }>;
  lockedCausalMovement: string[];
  companionWrongHelp: string;
  comicEscalations: Array<{ consequence: string }>;
  attempts: Array<{ attempt: string; failure: string }>;
  childDiscovery: string;
  childClimaxAction: string;
  visiblePayoff: string;
  endingEnergy: string;
  recurringObjects: string[];
  transientCast: string[];
  lineTargets: { childRepeatable: string; parentReread: string };
  modelFreedom: string[];
}

interface CommissionRecord {
  brief: StoryBrief;
  briefSetPath: string;
  companionId: string;
  companionBiblePath: string;
}

interface CompanionCard {
  companionId: string;
  displayName: string;
  storyRole: string;
  lovableMistake: string;
  embodiedComedy: string;
  childPartnership: string;
  voiceDirection: string;
}

interface CommissionAuthority {
  records: CommissionRecord[];
  writerFreedomCharter: string;
  companionCards: CompanionCard[];
  sourceDocuments: { sharedStoryContract: string; writerContract: string };
}

interface ArchitectPilot {
  briefId: string;
  companionId: string;
  companionPortrait: string;
  premiseSeed: string;
}

interface ArchitectAuthority {
  commissionAuthority: CommissionAuthority;
  architectCharter: string;
  postDraftEditorialQa: string;
  companionQaCanons: CompanionQaCanon[];
  pilots: ArchitectPilot[];
}

interface StoryArchitectCommission {
  briefId: string;
  companionId: string;
  premiseSeed: string;
}

interface CompanionCreativePsychology {
  companionId: string;
  innerCharacter: string;
  relationshipDynamic: string;
  changeCapacity: string;
  forbiddenShortcuts: string;
}

interface StoryArchitectAuthority {
  commissionAuthority: CommissionAuthority;
  architectCharter: string;
  commissions: StoryArchitectCommission[];
  companionPsychologies: CompanionCreativePsychology[];
}

interface CompanionQaCanon {
  companionId: string;
  innerCharacter: string;
  relationshipDynamic: string;
  changeCapacity: string;
  editorChecks: string[];
  forbiddenRequirements: string[];
}

interface EditorialDraft {
  absolutePath: string;
  relativePath: string;
  bytes: number;
  text: string;
  sha256: string;
}

interface EditorialReview {
  version: 'small-heroes-story-editorial-review/v1';
  verdict: 'pass' | 'revise' | 'reject';
  strengths: string[];
  issues: Array<{
    code: string;
    severity: 'major' | 'minor';
    evidencePages: number[];
    functionalGap: string;
  }>;
  revisionPriorities: string[];
  mustPreserve: string[];
}

interface EditorialReviewResult {
  absolutePath: string;
  relativePath: string;
  bytes: number;
  sha256: string;
  review: EditorialReview;
}

interface CommissionMetadata {
  commissionVersion: 'small-heroes-story-commission/v2';
  authorityStatus: 'staging_only';
  briefId: string;
  workingTitle: string;
  companionId: string;
  category: string;
  direction: 'bedtime' | 'adventure' | 'fantasy';
  textPageCount: number;
  physicalPageCount: number;
  personalization: {
    childAppearance: 'not_supplied_story_writer_must_not_invent';
    childAgeBodyAuthority: 'downstream_visual_pipeline_only';
  };
}

interface Materializer {
  buildArchitectPilotBundle: (authority: ArchitectAuthority, record: CommissionRecord) => string;
  buildStoryArchitectBundle: (
    authority: StoryArchitectAuthority,
    record: CommissionRecord,
  ) => string;
  buildCommissionBundle: (authority: CommissionAuthority, record: CommissionRecord) => string;
  buildEditorialReviewBundle: (
    authority: ArchitectAuthority,
    record: CommissionRecord,
    draft: EditorialDraft,
  ) => string;
  buildMusicalPolishBundle: (
    record: CommissionRecord,
    draft: EditorialDraft,
    reviewResult: EditorialReviewResult,
    polishCharter: string,
  ) => string;
  buildTargetedRevisionBundle: (
    authority: ArchitectAuthority,
    record: CommissionRecord,
    draft: EditorialDraft,
    reviewResult: EditorialReviewResult,
  ) => string;
  commissionMetadata: (record: CommissionRecord) => CommissionMetadata;
  findArchitectPilot: (authority: ArchitectAuthority, briefId: string) => ArchitectPilot;
  findStoryArchitectCommission: (
    authority: StoryArchitectAuthority,
    briefId: string,
  ) => StoryArchitectCommission;
  findCompanionCreativePsychology: (
    authority: StoryArchitectAuthority,
    companionId: string,
  ) => CompanionCreativePsychology;
  findCompanionCard: (authority: CommissionAuthority, companionId: string) => CompanionCard;
  findCompanionQaCanon: (authority: ArchitectAuthority, companionId: string) => CompanionQaCanon;
  findRecord: (authority: CommissionAuthority, briefId: string) => CommissionRecord;
  loadArchitectPilotAuthority: (authority?: CommissionAuthority) => ArchitectAuthority;
  loadStoryArchitectAuthority: (authority?: CommissionAuthority) => StoryArchitectAuthority;
  loadCommissionAuthority: () => CommissionAuthority;
  normalizeTargetedRevisionDraft: (
    record: CommissionRecord,
    draft: EditorialDraft,
    reviewResult: EditorialReviewResult,
  ) => { text: string; sha256: string; actions: Array<{ code: string }> };
  projectBriefForWriter: (brief: StoryBrief) => Record<string, unknown>;
  readEditorialDraftFile: (draftPath: string) => EditorialDraft;
  readEditorialReviewResultFile: (
    reviewPath: string,
    expectedPageCount: number,
  ) => EditorialReviewResult;
  validateArchitectPilotsDocument: (document: unknown) => unknown;
  validateStoryArchitectCommissionsDocument: (document: unknown) => unknown;
  validateCompanionCreativePsychologyDocument: (document: unknown) => unknown;
  validateCompanionCardsDocument: (document: unknown) => unknown;
  validateCompanionQaCanonsDocument: (document: unknown) => unknown;
  validateEditorialReviewResult: (
    review: unknown,
    expectedPageCount: number,
  ) => EditorialReview;
  validateEditorialPassDraft: (
    record: CommissionRecord,
    draft: EditorialDraft,
  ) => { text: string; sha256: string; actions: Array<{ code: string }> };
  validateProductAcceptance: (approval: unknown) => Record<string, unknown>;
  writeArchitectPilotFiles: (
    authority: ArchitectAuthority,
    record: CommissionRecord,
    outputDir: string,
  ) => { version: string; recordCount: number; record: { filename: string; sha256: string } };
  writeStoryArchitectFiles: (
    authority: StoryArchitectAuthority,
    records: CommissionRecord[],
    outputDir: string,
  ) => { version: string; recordCount: number; records: Array<{ briefId: string; filename: string; sha256: string }> };
  writeCommissionFiles: (
    authority: CommissionAuthority,
    records: CommissionRecord[],
    outputDir: string,
  ) => { version: string; recordCount: number; records: Array<CommissionMetadata & { filename: string; sha256: string }> };
  writeEditorialReviewFiles: (
    authority: ArchitectAuthority,
    record: CommissionRecord,
    draft: EditorialDraft,
    outputDir: string,
  ) => { version: string; recordCount: number; record: { filename: string; sha256: string } };
  writeEditorialPassFiles: (
    record: CommissionRecord,
    draft: EditorialDraft,
    reviewResult: EditorialReviewResult,
    outputDir: string,
  ) => { version: string; recordCount: number; record: { filename: string; sha256: string } };
  writeProductAcceptedStorySource: (
    record: CommissionRecord,
    draft: EditorialDraft,
    reviewResult: EditorialReviewResult,
    acceptanceResult: {
      relativePath: string;
      bytes: number;
      sha256: string;
      approval: Record<string, any>;
    },
    outputDir: string,
  ) => { version: string; status: string; record: Record<string, any> };
  writeMusicalPolishFiles: (
    record: CommissionRecord,
    draft: EditorialDraft,
    reviewResult: EditorialReviewResult,
    outputDir: string,
  ) => { version: string; recordCount: number; record: { filename: string; sha256: string } };
  writeNormalizedRevisionFiles: (
    record: CommissionRecord,
    draft: EditorialDraft,
    reviewResult: EditorialReviewResult,
    outputDir: string,
  ) => { version: string; recordCount: number; record: { filename: string; sha256: string } };
  writeTargetedRevisionFiles: (
    authority: ArchitectAuthority,
    record: CommissionRecord,
    draft: EditorialDraft,
    reviewResult: EditorialReviewResult,
    outputDir: string,
  ) => { version: string; recordCount: number; record: { filename: string; sha256: string } };
}

const DINI_BRIEF_ID = 'dragon_dini_adventure_wobble_cake_convoy_brief_v1';

describe('story commission materializer', () => {
  it('preserves the existing v2 18-slot dispatch and page accounting', () => {
    const authority = loadCommissionAuthority();
    const metadata = authority.records.map(commissionMetadata);

    expect(metadata).toHaveLength(18);
    expect(new Set(metadata.map(({ briefId }) => briefId)).size).toBe(18);
    expect(new Set(metadata.map(({ companionId }) => companionId)).size).toBe(6);
    expect(new Set(metadata.map(({ commissionVersion }) => commissionVersion))).toEqual(
      new Set(['small-heroes-story-commission/v2']),
    );

    const pageContracts = new Map([
      ['bedtime', [8, 16]],
      ['adventure', [12, 24]],
      ['fantasy', [16, 32]],
    ]);
    for (const record of metadata) {
      expect([record.textPageCount, record.physicalPageCount], record.briefId).toEqual(
        pageContracts.get(record.direction),
      );
    }
  });

  it('keeps the v2 materializer projection and companion-card contract unchanged', () => {
    const authority = loadCommissionAuthority();
    const selected = authority.records.find(({ brief }) => brief.direction === 'adventure')!;
    const projection = projectBriefForWriter(selected.brief);
    const bundle = buildCommissionBundle(authority, selected);

    expect(Object.keys(projection)).toEqual([
      'version',
      'briefId',
      'workingTitle',
      'category',
      'direction',
      'textPageCount',
      'storyPromise',
      'openingSituation',
      'childGoal',
      'centralPhysicalProblem',
      'physicalLogic',
      'setPieces',
      'storyMovement',
      'companionComplication',
      'childDiscovery',
      'childClimaxAction',
      'visiblePayoff',
      'endingEnergy',
      'continuity',
      'creativeOpenings',
    ]);
    expect(bundle).toContain(authority.writerFreedomCharter);
    expect(bundle).toContain(
      JSON.stringify(findCompanionCard(authority, selected.companionId), null, 2),
    );
    expect(bundle).not.toContain(authority.sourceDocuments.sharedStoryContract);
    expect(bundle).not.toContain(authority.sourceDocuments.writerContract);

    const expectedCardKeys = [
      'companionId',
      'displayName',
      'storyRole',
      'lovableMistake',
      'embodiedComedy',
      'childPartnership',
      'voiceDirection',
    ];
    expect(authority.companionCards).toHaveLength(6);
    for (const card of authority.companionCards) {
      expect(Object.keys(card)).toEqual(expectedCardKeys);
    }
    expect(() =>
      validateCompanionCardsDocument({
        version: 'small-heroes-companion-authoring-cards/v1',
        status: 'staging_only',
        cards: authority.companionCards.map((card, index) =>
          index === 0 ? { ...card, extra: 'rejected' } : card,
        ),
      }),
    ).toThrow('story_commission_companion_cards_invalid');
  });

  it('defines exactly one closed Dini architect pilot and rejects undeclared structure', () => {
    const authority = loadArchitectPilotAuthority();

    expect(authority.pilots).toHaveLength(1);
    expect(authority.pilots[0]!.briefId).toBe(DINI_BRIEF_ID);
    expect(Object.keys(authority.pilots[0]!)).toEqual([
      'briefId',
      'companionId',
      'companionPortrait',
      'premiseSeed',
    ]);
    expect(() =>
      validateArchitectPilotsDocument({
        version: 'small-heroes-story-architect-pilots/v2',
        status: 'staging_only',
        pilots: [{ ...authority.pilots[0]!, requiredManeuver: 'rejected' }],
      }),
    ).toThrow('story_architect_pilots_invalid');
    expect(() => findArchitectPilot(authority, 'not-a-pilot')).toThrow(
      'story_architect_pilot_not_unique:not-a-pilot',
    );
  });

  it('asks the Architect for three divergent shapes and stops before story prose', () => {
    const commissionAuthority = loadCommissionAuthority();
    const authority = loadArchitectPilotAuthority(commissionAuthority);
    const record = findRecord(commissionAuthority, DINI_BRIEF_ID);
    const bundle = buildArchitectPilotBundle(authority, record);

    expect(bundle).toContain('exactly three story shapes');
    expect(bundle).toContain('WAITING_FOR_GUY_SELECTION');
    expect(bundle).toContain('Do not write the story until Guy selects exactly one shape.');
    expect(bundle).toContain('Comic engine');
    expect(bundle).toContain('Child agency arc');
    expect(bundle).toContain('Climax principle');
    expect(bundle).toContain('Why Dini');
    expect(bundle).toContain('Surprise');
    expect(bundle).toContain(findArchitectPilot(authority, DINI_BRIEF_ID).companionPortrait);
    expect(bundle).not.toContain(authority.postDraftEditorialQa);
    expect(bundle).not.toContain(
      JSON.stringify(findCompanionQaCanon(authority, record.companionId), null, 2),
    );
    expect(bundle).not.toContain('Post-Draft Editorial QA Contract');
    expect(bundle).not.toContain('imageDirection:');
    expect(bundle).not.toContain(record.brief.workingTitle);
    expect(bundle).not.toContain(record.brief.category);
    expect(bundle).toContain('immediately visible, child-interesting disruption');
    expect(bundle).toContain('memorable large visual-comedy escalation');
    expect(bundle).toContain('experiment, attempt, comparison');
    expect(bundle).toContain('Four drafting priorities only');
  });

  it('keeps the former screenplay and Dini choreography out of the pilot prompt', () => {
    const commissionAuthority = loadCommissionAuthority();
    const authority = loadArchitectPilotAuthority(commissionAuthority);
    const record = findRecord(commissionAuthority, DINI_BRIEF_ID);
    const bundle = buildArchitectPilotBundle(authority, record);
    const forbiddenSourceValues = [
      record.brief.creativePromise,
      record.brief.openingHook,
      record.brief.childWant,
      record.brief.hiddenUnderlayer,
      record.brief.physicalProblem,
      record.brief.playRule,
      record.brief.companionWrongHelp,
      record.brief.childDiscovery,
      record.brief.childClimaxAction,
      record.brief.visiblePayoff,
      record.brief.endingEnergy,
      ...record.brief.lockedCausalMovement,
      ...record.brief.recurringObjects,
      ...record.brief.setPieces.flatMap(({ name, dramaticUse }) => [name, dramaticUse]),
      ...record.brief.comicEscalations.map(({ consequence }) => consequence),
      ...record.brief.attempts.flatMap(({ attempt, failure }) => [attempt, failure]),
    ];

    for (const sourceValue of forbiddenSourceValues) {
      expect(bundle, sourceValue).not.toContain(sourceValue);
    }
    for (const oldMechanic of ['כריות', 'קפיצים', 'סרטים', 'ווים', 'שלוש תנודות קטנות']) {
      expect(bundle, oldMechanic).not.toContain(oldMechanic);
    }
  });

  it('keeps strict quality standards in a post-draft contract outside authoring input', () => {
    const authority = loadArchitectPilotAuthority();
    expect(authority.postDraftEditorialQa).toContain('## Story QA');
    expect(authority.postDraftEditorialQa).toContain('## Delight QA');
    expect(authority.postDraftEditorialQa).toContain('## Companion QA');
    expect(authority.postDraftEditorialQa).toContain('## Child agency QA');
    expect(authority.postDraftEditorialQa).toContain('## Hebrew read-aloud and musicality QA');
    expect(authority.postDraftEditorialQa).toContain('The absence of rhyme is never a defect');
    expect(authority.postDraftEditorialQa).toContain('Rhyme becomes a defect when it forces');
    expect(authority.postDraftEditorialQa).toContain('Do not reward mechanical compliance');
    expect(authority.postDraftEditorialQa).toContain('Guy retains final product and story acceptance.');

    const canon = findCompanionQaCanon(authority, 'dragon_dini');
    expect(Object.keys(canon)).toEqual([
      'companionId',
      'innerCharacter',
      'relationshipDynamic',
      'changeCapacity',
      'editorChecks',
      'forbiddenRequirements',
    ]);
    expect(canon.forbiddenRequirements.join(' ')).toContain('No fixed Dini maneuver');
    expect(() =>
      validateCompanionQaCanonsDocument({
        version: 'small-heroes-companion-qa-canons/v1',
        status: 'staging_pilot_only',
        canons: [{ ...canon, requiredTailMove: 'rejected' }],
      }),
    ).toThrow('story_editor_companion_qa_canons_invalid');
  });

  it('materializes a diagnostic-only editor review and rejects unsafe draft inputs', () => {
    const commissionAuthority = loadCommissionAuthority();
    const authority = loadArchitectPilotAuthority(commissionAuthority);
    const record = findRecord(commissionAuthority, DINI_BRIEF_ID);
    const fixtureRoot = fs.mkdtempSync(
      path.join(process.cwd(), 'outputs', 'small-heroes-editor-test-'),
    );
    const draftPath = path.join(fixtureRoot, 'draft.md');
    const outputDir = path.join(fixtureRoot, 'review');
    const outsidePath = path.join(os.tmpdir(), 'small-heroes-editor-outside.md');
    const draftText = '---\ntitle: test\n---\n\n--- Page 1 ---\n\nטיוטה לבדיקה.';

    try {
      fs.writeFileSync(draftPath, draftText, 'utf8');
      fs.writeFileSync(outsidePath, draftText, 'utf8');
      const draft = readEditorialDraftFile(draftPath);
      const bundle = buildEditorialReviewBundle(authority, record, draft);

      expect(bundle).toContain(authority.postDraftEditorialQa);
      expect(bundle).toContain(
        JSON.stringify(findCompanionQaCanon(authority, record.companionId), null, 2),
      );
      expect(bundle).toContain('Diagnose only; do not rewrite');
      expect(bundle).toContain('child_pre_climax_agency_weak');
      expect(bundle).toContain('personalization_syntax_invalid');
      expect(bundle).toContain(JSON.stringify({ draft: draftText }, null, 2));
      expect(bundle).not.toContain(authority.architectCharter);
      expect(bundle).not.toContain('WAITING_FOR_GUY_SELECTION');

      const manifest = writeEditorialReviewFiles(authority, record, draft, outputDir);
      expect(manifest.version).toBe('small-heroes-story-editorial-review-pilot-manifest/v1');
      expect(manifest.recordCount).toBe(1);
      expect(manifest.record.filename).toMatch(
        new RegExp(`^${DINI_BRIEF_ID}\\.editor\\.[a-f0-9]{64}\\.md$`),
      );
      expect(fs.readdirSync(outputDir).sort()).toEqual(
        [manifest.record.filename, 'manifest.json'].sort(),
      );
      expect(() => writeEditorialReviewFiles(authority, record, draft, outputDir)).toThrow(
        'story_editor_output_directory_not_empty',
      );
      expect(() => readEditorialDraftFile(outsidePath)).toThrow(
        'story_editor_draft_path_rejected',
      );

      fs.writeFileSync(draftPath, 'x'.repeat(64 * 1024 + 1), 'utf8');
      expect(() => readEditorialDraftFile(draftPath)).toThrow(
        'story_editor_draft_size_rejected',
      );
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
      fs.rmSync(outsidePath, { force: true });
    }
  });

  it('binds a closed editor result into a targeted revision without restoring plot rails', () => {
    const commissionAuthority = loadCommissionAuthority();
    const authority = loadArchitectPilotAuthority(commissionAuthority);
    const record = findRecord(commissionAuthority, DINI_BRIEF_ID);
    const fixtureRoot = fs.mkdtempSync(
      path.join(process.cwd(), 'outputs', 'small-heroes-revision-test-'),
    );
    const draftPath = path.join(fixtureRoot, 'draft.md');
    const reviewPath = path.join(fixtureRoot, 'review.json');
    const outputDir = path.join(fixtureRoot, 'revision');
    const outsidePath = path.join(os.tmpdir(), 'small-heroes-review-outside.json');
    const draftText = '---\ntitle: test\n---\n\n--- Page 1 ---\n\nטיוטה לבדיקה.';
    const review: EditorialReview = {
      version: 'small-heroes-story-editorial-review/v1',
      verdict: 'revise',
      strengths: ['הסיפור שומר על משחק פיזי ברור.'],
      issues: [
        {
          code: 'personalization_syntax_invalid',
          severity: 'major',
          evidencePages: [2, 4],
          functionalGap: 'הטיות אחדות אינן כתובות בשתי צורות מלאות.',
        },
        {
          code: 'output_structure_invalid',
          severity: 'major',
          evidencePages: [1],
          functionalGap: 'מעטפת ה-frontmatter אינה נסגרת במפריד התקני.',
        },
        {
          code: 'comic_peak_insufficient',
          severity: 'minor',
          evidencePages: [3, 5],
          functionalGap: 'חסר רגע קומי גדול וזכיר בתוך ההרפתקה.',
        },
      ],
      revisionPriorities: [
        'לתקן את התחביר הטכני.',
        'לחזק את השיא הקומי בלי להחליף עלילה.',
      ],
      mustPreserve: ['לשמור את עקרון התנועה ואת פעולת הילד.'],
    };

    try {
      fs.writeFileSync(draftPath, draftText, 'utf8');
      fs.writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`, 'utf8');
      fs.writeFileSync(outsidePath, JSON.stringify(review), 'utf8');
      const draft = readEditorialDraftFile(draftPath);
      const reviewResult = readEditorialReviewResultFile(reviewPath, record.brief.pageCount);
      const bundle = buildTargetedRevisionBundle(authority, record, draft, reviewResult);

      expect(bundle).toContain('Targeted Writer Revision Pilot');
      expect(bundle).toContain('Every gender chip must contain two complete Hebrew forms');
      expect(bundle).toContain('Open and close the minimal frontmatter');
      expect(bundle).toContain('invent the implementation freely');
      expect(bundle).toContain(JSON.stringify({ draft: draftText }, null, 2));
      expect(bundle).toContain('comic_peak_insufficient');
      expect(bundle).not.toContain(authority.architectCharter);
      expect(bundle).not.toContain(authority.postDraftEditorialQa);
      expect(bundle).not.toContain(JSON.stringify(findCompanionQaCanon(authority, 'dragon_dini')));
      expect(bundle).not.toContain('WAITING_FOR_GUY_SELECTION');

      const manifest = writeTargetedRevisionFiles(
        authority,
        record,
        draft,
        reviewResult,
        outputDir,
      );
      expect(manifest.version).toBe('small-heroes-targeted-story-revision-pilot-manifest/v1');
      expect(manifest.recordCount).toBe(1);
      expect(manifest.record.filename).toMatch(
        new RegExp(`^${DINI_BRIEF_ID}\\.revision\\.[a-f0-9]{64}\\.md$`),
      );
      expect(fs.readdirSync(outputDir).sort()).toEqual(
        [manifest.record.filename, 'manifest.json'].sort(),
      );
      expect(() =>
        writeTargetedRevisionFiles(authority, record, draft, reviewResult, outputDir),
      ).toThrow('story_writer_revision_output_directory_not_empty');
      expect(() => readEditorialReviewResultFile(outsidePath, record.brief.pageCount)).toThrow(
        'story_editor_review_path_rejected',
      );

      expect(() =>
        validateEditorialReviewResult(
          {
            mustPreserve: review.mustPreserve,
            revisionPriorities: review.revisionPriorities,
            issues: review.issues,
            strengths: review.strengths,
            verdict: review.verdict,
            version: review.version,
          },
          record.brief.pageCount,
        ),
      ).not.toThrow();
      expect(() =>
        validateEditorialReviewResult({ ...review, extra: 'rejected' }, record.brief.pageCount),
      ).toThrow('story_editor_review_result_invalid');
      expect(() =>
        validateEditorialReviewResult(
          {
            ...review,
            issues: [{ ...review.issues[0]!, evidencePages: [13] }],
          },
          record.brief.pageCount,
        ),
      ).toThrow('story_editor_review_result_invalid');
      expect(() =>
        validateEditorialReviewResult(
          {
            ...review,
            issues: [{ ...review.issues[0]!, code: 'invented_issue_code' }],
          },
          record.brief.pageCount,
        ),
      ).toThrow('story_editor_review_result_invalid');
      expect(() =>
        validateEditorialReviewResult(
          {
            ...review,
            issues: [review.issues[0]!, { ...review.issues[0]! }],
          },
          record.brief.pageCount,
        ),
      ).toThrow('story_editor_review_result_invalid');
      expect(() =>
        validateEditorialReviewResult(
          {
            ...review,
            verdict: 'pass',
            issues: [],
            revisionPriorities: ['A passing review cannot retain an open revision priority.'],
          },
          record.brief.pageCount,
        ),
      ).toThrow('story_editor_review_result_invalid');
      expect(() =>
        buildTargetedRevisionBundle(authority, record, draft, {
          ...reviewResult,
          review: { ...review, verdict: 'pass', issues: [], revisionPriorities: [] },
        }),
      ).toThrow('story_writer_revision_not_authorized:pass');
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
      fs.rmSync(outsidePath, { force: true });
    }
  });

  it('normalizes only an authorized frontmatter delimiter and validates revision intake', () => {
    const commissionAuthority = loadCommissionAuthority();
    const record = findRecord(commissionAuthority, DINI_BRIEF_ID);
    const fixtureRoot = fs.mkdtempSync(
      path.join(process.cwd(), 'outputs', 'small-heroes-revision-intake-test-'),
    );
    const draftPath = path.join(fixtureRoot, 'draft.md');
    const reviewPath = path.join(fixtureRoot, 'review.json');
    const outputDir = path.join(fixtureRoot, 'normalized');
    const pages = Array.from(
      { length: record.brief.pageCount },
      (_, index) => `--- Page ${index + 1} ---\n\n{{childName}} {חייך|חייכה}.`,
    ).join('\n\n');
    const rawDraft = [
      '---',
      'title: "{{childName}} ו־דיני: בדיקה"',
      `companionId: ${record.companionId}`,
      `direction: ${record.brief.direction}`,
      `category: ${record.brief.category}`,
      `pages: ${record.brief.pageCount}`,
      'gender: female',
      'endingType: resolution',
      '----------------------',
      '',
      pages,
      '',
    ].join('\n');
    const review: EditorialReview = {
      version: 'small-heroes-story-editorial-review/v1',
      verdict: 'revise',
      strengths: ['הטיוטה שומרת על המשחק המרכזי.'],
      issues: [
        {
          code: 'output_structure_invalid',
          severity: 'major',
          evidencePages: [1],
          functionalGap: 'מפריד הסיום אינו תקני.',
        },
      ],
      revisionPriorities: ['לתקן את מעטפת ה-frontmatter בלבד.'],
      mustPreserve: ['לשמור את כל עמודי הפרוזה.'],
    };

    try {
      fs.writeFileSync(draftPath, rawDraft, 'utf8');
      fs.writeFileSync(reviewPath, `${JSON.stringify(review)}\n`, 'utf8');
      const draft = readEditorialDraftFile(draftPath);
      const reviewResult = readEditorialReviewResultFile(reviewPath, record.brief.pageCount);
      const normalized = normalizeTargetedRevisionDraft(record, draft, reviewResult);

      expect(normalized.actions).toEqual([
        { code: 'frontmatter_closing_delimiter_normalized', fromLength: 22, to: '---' },
      ]);
      expect(normalized.text).not.toContain('----------------------');
      expect(normalized.text.match(/^---$/gm)).toHaveLength(2);
      expect(normalized.text.match(/^--- Page \d+ ---$/gm)).toHaveLength(12);
      expect(normalized.text.split(/^--- Page \d+ ---$/gm).slice(1)).toEqual(
        rawDraft.split(/^--- Page \d+ ---$/gm).slice(1),
      );

      const manifest = writeNormalizedRevisionFiles(
        record,
        draft,
        reviewResult,
        outputDir,
      );
      expect(manifest.version).toBe(
        'small-heroes-targeted-story-revision-normalization-manifest/v1',
      );
      expect(manifest.record.filename).toMatch(
        new RegExp(`^${DINI_BRIEF_ID}\\.normalized\\.[a-f0-9]{64}\\.md$`),
      );
      expect(() =>
        writeNormalizedRevisionFiles(record, draft, reviewResult, outputDir),
      ).toThrow('story_writer_normalized_output_directory_not_empty');

      const badChipDraft = {
        ...draft,
        text: rawDraft.replace('{חייך|חייכה}', 'חייכ{ה|ה}'),
      };
      expect(() =>
        normalizeTargetedRevisionDraft(record, badChipDraft, reviewResult),
      ).toThrow('story_writer_revision_gender_chips_invalid');
      const wrongIdentityDraft = {
        ...draft,
        text: rawDraft.replace(`companionId: ${record.companionId}`, 'companionId: fox_uri'),
      };
      expect(() =>
        normalizeTargetedRevisionDraft(record, wrongIdentityDraft, reviewResult),
      ).toThrow('story_writer_revision_identity_mismatch');
      expect(() =>
        normalizeTargetedRevisionDraft(record, draft, {
          ...reviewResult,
          review: {
            ...review,
            issues: [{ ...review.issues[0]!, code: 'comic_peak_insufficient' }],
          },
        }),
      ).toThrow('story_writer_revision_frontmatter_invalid');
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('freezes only a canonical draft with a closed editorial pass', () => {
    const commissionAuthority = loadCommissionAuthority();
    const record = findRecord(commissionAuthority, DINI_BRIEF_ID);
    const fixtureRoot = fs.mkdtempSync(
      path.join(process.cwd(), 'outputs', 'small-heroes-editorial-pass-test-'),
    );
    const draftPath = path.join(fixtureRoot, 'draft.md');
    const reviewPath = path.join(fixtureRoot, 'review.json');
    const outputDir = path.join(fixtureRoot, 'candidate');
    const pages = Array.from(
      { length: record.brief.pageCount },
      (_, index) => `--- Page ${index + 1} ---\n\n{{childName}} {חייך|חייכה}.`,
    ).join('\n\n');
    const draftText = [
      '---',
      'title: "{{childName}} ו־דיני: בדיקה"',
      `companionId: ${record.companionId}`,
      `direction: ${record.brief.direction}`,
      `category: ${record.brief.category}`,
      `pages: ${record.brief.pageCount}`,
      'gender: female',
      'endingType: resolution',
      '---',
      '',
      pages,
      '',
    ].join('\n');
    const review: EditorialReview = {
      version: 'small-heroes-story-editorial-review/v1',
      verdict: 'pass',
      strengths: ['The child owns the discovery and climax.'],
      issues: [],
      revisionPriorities: [],
      mustPreserve: ['Preserve the causal discovery arc.'],
    };

    try {
      fs.writeFileSync(draftPath, draftText, 'utf8');
      fs.writeFileSync(reviewPath, `${JSON.stringify(review)}\n`, 'utf8');
      const draft = readEditorialDraftFile(draftPath);
      const reviewResult = readEditorialReviewResultFile(reviewPath, record.brief.pageCount);

      expect(validateEditorialPassDraft(record, draft)).toEqual({
        text: draftText,
        sha256: draft.sha256,
        actions: [],
      });

      const manifest = writeEditorialPassFiles(record, draft, reviewResult, outputDir);
      expect(manifest.version).toBe('small-heroes-editorial-pass-candidate-manifest/v1');
      expect(manifest.record.filename).toBe(
        `${DINI_BRIEF_ID}.editorial-pass.${draft.sha256}.md`,
      );
      expect(fs.readFileSync(path.join(outputDir, manifest.record.filename), 'utf8')).toBe(
        draftText,
      );
      expect(fs.readdirSync(outputDir).sort()).toEqual(
        [manifest.record.filename, 'manifest.json'].sort(),
      );
      expect(() => writeEditorialPassFiles(record, draft, reviewResult, outputDir)).toThrow(
        'story_editorial_pass_output_directory_not_empty',
      );
      expect(() =>
        writeEditorialPassFiles(
          record,
          draft,
          {
            ...reviewResult,
            review: {
              ...review,
              verdict: 'revise',
              issues: [
                {
                  code: 'payoff_weak',
                  severity: 'major',
                  evidencePages: [12],
                  functionalGap: 'The payoff requires revision.',
                },
              ],
              revisionPriorities: ['Strengthen the payoff.'],
            },
          },
          path.join(fixtureRoot, 'rejected'),
        ),
      ).toThrow('story_editorial_pass_not_authorized:revise');
      expect(() =>
        validateEditorialPassDraft(record, {
          ...draft,
          text: draftText.replace('\n---\n\n--- Page 1 ---', '\n----------------------\n\n--- Page 1 ---'),
        }),
      ).toThrow('story_writer_revision_frontmatter_invalid');
      expect(() =>
        validateEditorialPassDraft(record, {
          ...draft,
          text: draftText.replace('{חייך|חייכה}', 'חייכ{ה}'),
        }),
      ).toThrow('story_writer_revision_gender_chips_invalid');
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('materializes a pass-bound musical polish without authorizing a story rewrite', () => {
    const commissionAuthority = loadCommissionAuthority();
    const architectAuthority = loadArchitectPilotAuthority(commissionAuthority);
    const record = findRecord(commissionAuthority, DINI_BRIEF_ID);
    const fixtureRoot = fs.mkdtempSync(
      path.join(process.cwd(), 'outputs', 'small-heroes-musical-polish-test-'),
    );
    const draftPath = path.join(fixtureRoot, 'draft.md');
    const reviewPath = path.join(fixtureRoot, 'review.json');
    const outputDir = path.join(fixtureRoot, 'polish');
    const rejectedDir = path.join(fixtureRoot, 'rejected');
    const pages = Array.from(
      { length: record.brief.pageCount },
      (_, index) => `--- Page ${index + 1} ---\n\n{{childName}} {חייך|חייכה}.`,
    ).join('\n\n');
    const draftText = [
      '---',
      'title: "{{childName}} ו־דיני: בדיקה מוזיקלית"',
      `companionId: ${record.companionId}`,
      `direction: ${record.brief.direction}`,
      `category: ${record.brief.category}`,
      `pages: ${record.brief.pageCount}`,
      'gender: female',
      'endingType: resolution',
      '---',
      '',
      pages,
      '',
    ].join('\n');
    const review: EditorialReview = {
      version: 'small-heroes-story-editorial-review/v1',
      verdict: 'pass',
      strengths: ['The complete story is editorially sound.'],
      issues: [],
      revisionPriorities: [],
      mustPreserve: ['Preserve every story event and causal relationship.'],
    };
    const polishCharter = fs
      .readFileSync(
        path.join(
          process.cwd(),
          'story-pipeline/03_story_briefs/STORY_MUSICAL_READ_ALOUD_POLISH_CHARTER.md',
        ),
        'utf8',
      )
      .trim();

    try {
      fs.writeFileSync(draftPath, draftText, 'utf8');
      fs.writeFileSync(reviewPath, `${JSON.stringify(review)}\n`, 'utf8');
      const draft = readEditorialDraftFile(draftPath);
      const reviewResult = readEditorialReviewResultFile(reviewPath, record.brief.pageCount);
      const bundle = buildMusicalPolishBundle(record, draft, reviewResult, polishCharter);

      expect(bundle).toContain('small-heroes-musical-read-aloud-polish/v1');
      expect(bundle).toContain(JSON.stringify({ draft: draftText }, null, 2));
      expect(bundle).toContain('Do not turn the whole story into a poem');
      expect(bundle).toContain('There is no rhyme quota');
      expect(bundle).toContain('story events, causal mechanism, discovery sequence');
      expect(bundle).toContain('Do not make a rhyme depend on only one side of a gender chip');
      expect(bundle.toLowerCase()).not.toContain('must rhyme');
      expect(bundle).not.toContain(architectAuthority.architectCharter);
      expect(bundle).not.toContain(architectAuthority.postDraftEditorialQa);
      expect(bundle).not.toContain('imageDirection:');

      const manifest = writeMusicalPolishFiles(record, draft, reviewResult, outputDir);
      expect(manifest.version).toBe('small-heroes-musical-read-aloud-polish-manifest/v1');
      expect(manifest.record.filename).toMatch(
        new RegExp(`^${DINI_BRIEF_ID}\\.musical-polish\\.[a-f0-9]{64}\\.md$`),
      );
      expect(fs.readdirSync(outputDir).sort()).toEqual(
        [manifest.record.filename, 'manifest.json'].sort(),
      );
      expect(() => writeMusicalPolishFiles(record, draft, reviewResult, outputDir)).toThrow(
        'story_musical_polish_output_directory_not_empty',
      );

      const reviseReviewResult: EditorialReviewResult = {
        ...reviewResult,
        review: {
          ...review,
          verdict: 'revise',
          issues: [
            {
              code: 'hebrew_readaloud_issue',
              severity: 'minor',
              evidencePages: [2],
              functionalGap: 'The spoken cadence needs revision.',
            },
          ],
          revisionPriorities: ['Improve the spoken cadence.'],
        },
      };
      expect(() =>
        writeMusicalPolishFiles(record, draft, reviseReviewResult, rejectedDir),
      ).toThrow('story_musical_polish_not_authorized:revise');
      expect(fs.existsSync(rejectedDir)).toBe(false);

      expect(() =>
        buildMusicalPolishBundle(
          record,
          {
            ...draft,
            text: draftText.replace('{חייך|חייכה}', 'חייכ{ה}'),
          },
          reviewResult,
          polishCharter,
        ),
      ).toThrow('story_writer_revision_gender_chips_invalid');
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('writes content-addressed legacy and pilot artifacts and fails closed on reuse', () => {
    const commissionAuthority = loadCommissionAuthority();
    const architectAuthority = loadArchitectPilotAuthority(commissionAuthority);
    const selected = findRecord(commissionAuthority, DINI_BRIEF_ID);
    const legacyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'small-heroes-story-v2-'));
    const pilotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'small-heroes-story-architect-'));

    try {
      const legacy = writeCommissionFiles(commissionAuthority, [selected], legacyDir);
      expect(legacy.version).toBe('small-heroes-story-commission-manifest/v2');
      expect(legacy.recordCount).toBe(1);

      const pilot = writeArchitectPilotFiles(architectAuthority, selected, pilotDir);
      expect(pilot.version).toBe('small-heroes-story-architect-pilot-manifest/v1');
      expect(pilot.recordCount).toBe(1);
      expect(pilot.record.filename).toMatch(
        new RegExp(`^${DINI_BRIEF_ID}\\.architect\\.[a-f0-9]{64}\\.md$`),
      );
      expect(fs.readdirSync(pilotDir).sort()).toEqual(
        [pilot.record.filename, 'manifest.json'].sort(),
      );
      expect(() => writeArchitectPilotFiles(architectAuthority, selected, pilotDir)).toThrow(
        'story_architect_output_directory_not_empty',
      );
    } finally {
      fs.rmSync(legacyDir, { recursive: true, force: true });
      fs.rmSync(pilotDir, { recursive: true, force: true });
    }
  });

  it('generalizes the Story Architect to all 18 slots without restoring screenplay rails', () => {
    const commissionAuthority = loadCommissionAuthority();
    const authority = loadStoryArchitectAuthority(commissionAuthority);

    expect(authority.commissions).toHaveLength(18);
    expect(authority.companionPsychologies).toHaveLength(6);
    expect(new Set(authority.commissions.map(({ briefId }) => briefId)).size).toBe(18);
    expect(new Set(authority.commissions.map(({ companionId }) => companionId)).size).toBe(6);
    expect(new Set(authority.companionPsychologies.map(({ companionId }) => companionId))).toEqual(
      new Set(commissionAuthority.records.map(({ companionId }) => companionId)),
    );

    for (const record of commissionAuthority.records) {
      const commission = findStoryArchitectCommission(authority, record.brief.id);
      const psychology = findCompanionCreativePsychology(authority, record.companionId);
      const bundle = buildStoryArchitectBundle(authority, record);

      expect(commission.companionId).toBe(record.companionId);
      expect(bundle).toContain('exactly three genuinely different story shapes');
      expect(bundle).toContain('WAITING_FOR_GUY_SELECTION');
      expect(bundle).toContain(`"textPageCount": ${record.brief.pageCount}`);
      expect(bundle).toContain(`"physicalPageCount": ${record.brief.pageCount * 2}`);
      expect(bundle).toContain(JSON.stringify(psychology, null, 2));
      expect(bundle).toContain(commission.premiseSeed);
      expect(bundle).not.toContain('storyMovement');
      expect(bundle).not.toContain('childDiscovery');
      expect(bundle).not.toContain('childClimaxAction');
      expect(bundle).not.toContain('visiblePayoff');
      expect(bundle).not.toContain('companionWrongHelp');
      expect(bundle).not.toContain('imageDirection:');
    }

    expect(() =>
      validateStoryArchitectCommissionsDocument({
        version: 'small-heroes-story-architect-commissions/v1',
        status: 'staging_only',
        commissions: authority.commissions.map((entry, index) =>
          index === 0 ? { ...entry, exactClimax: 'rejected' } : entry,
        ),
      }),
    ).toThrow('story_architect_commissions_invalid');
    expect(() =>
      validateCompanionCreativePsychologyDocument({
        version: 'small-heroes-companion-creative-psychology/v1',
        status: 'staging_only',
        companions: authority.companionPsychologies.map((entry, index) =>
          index === 0 ? { ...entry, requiredManeuver: 'rejected' } : entry,
        ),
      }),
    ).toThrow('story_architect_companion_psychology_invalid');
  });

  it('materializes a 17-story next wave while excluding the accepted Dini adventure', () => {
    const commissionAuthority = loadCommissionAuthority();
    const authority = loadStoryArchitectAuthority(commissionAuthority);
    const records = commissionAuthority.records.filter(
      ({ brief }) => brief.id !== DINI_BRIEF_ID,
    );
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'small-heroes-architect-wave-'));

    try {
      const manifest = writeStoryArchitectFiles(authority, records, outputDir);
      expect(manifest.version).toBe('small-heroes-story-architect-commission-manifest/v2');
      expect(manifest.recordCount).toBe(17);
      expect(manifest.records).toHaveLength(17);
      expect(manifest.records.some(({ briefId }) => briefId === DINI_BRIEF_ID)).toBe(false);
      expect(new Set(manifest.records.map(({ briefId }) => briefId)).size).toBe(17);
      expect(fs.readdirSync(outputDir)).toHaveLength(19);
      expect(fs.existsSync(path.join(outputDir, 'INDEX.md'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'manifest.json'))).toBe(true);
      expect(() => writeStoryArchitectFiles(authority, records, outputDir)).toThrow(
        'story_architect_output_directory_not_empty',
      );
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('promotes only a digest-bound Editor PASS plus Guy product acceptance', () => {
    const commissionAuthority = loadCommissionAuthority();
    const record = findRecord(commissionAuthority, DINI_BRIEF_ID);
    const fixtureRoot = fs.mkdtempSync(
      path.join(process.cwd(), 'outputs', 'small-heroes-product-acceptance-test-'),
    );
    const draftPath = path.join(fixtureRoot, 'draft.md');
    const reviewPath = path.join(fixtureRoot, 'review.json');
    const acceptedRoot = path.join(
      process.cwd(),
      'story-pipeline',
      '04_approved_story_sources',
      'accepted',
    );
    fs.mkdirSync(acceptedRoot, { recursive: true });
    const outputDir = fs.mkdtempSync(path.join(acceptedRoot, 'test-'));
    fs.rmSync(outputDir, { recursive: true, force: true });
    const pages = Array.from(
      { length: record.brief.pageCount },
      (_, index) => `--- Page ${index + 1} ---\n\n{{childName}} {חייך|חייכה}.`,
    ).join('\n\n');
    const draftText = [
      '---',
      'title: "{{childName}} ו־דיני: בדיקה"',
      `companionId: ${record.companionId}`,
      `direction: ${record.brief.direction}`,
      `category: ${record.brief.category}`,
      `pages: ${record.brief.pageCount}`,
      'gender: female',
      'endingType: resolution',
      '---',
      '',
      pages,
      '',
    ].join('\n');
    const review: EditorialReview = {
      version: 'small-heroes-story-editorial-review/v1',
      verdict: 'pass',
      strengths: ['The story has a complete child-owned causal arc.'],
      issues: [],
      revisionPriorities: [],
      mustPreserve: ['Preserve the complete accepted text.'],
    };

    try {
      fs.writeFileSync(draftPath, draftText, 'utf8');
      fs.writeFileSync(reviewPath, `${JSON.stringify(review)}\n`, 'utf8');
      const draft = readEditorialDraftFile(draftPath);
      const reviewResult = readEditorialReviewResultFile(reviewPath, record.brief.pageCount);
      const approval = {
        version: 'small-heroes-story-product-acceptance/v1',
        status: 'accepted',
        briefId: DINI_BRIEF_ID,
        acceptedBy: 'Guy',
        acceptedOn: '2026-08-14',
        acceptanceScope: 'story_text_only',
        storySha256: draft.sha256,
        editorialReviewSha256: reviewResult.sha256,
        independentArtifactAudit: {
          status: 'pass',
          reviewedHead: '95ffa41943237532cb51b6b96f9b69aad56595a7',
          blocker: 0,
          major: 0,
          minor: 0,
        },
        decision: 'Guy accepted the complete story text for durable source promotion.',
        exclusions: [
          'story_bank_import',
          'wizard_runtime',
          'visual_contract',
          'render',
          'deployment',
        ],
      };
      expect(() => validateProductAcceptance(approval)).not.toThrow();
      const approvalBytes = Buffer.from(`${JSON.stringify(approval)}\n`, 'utf8');
      const acceptanceResult = {
        relativePath: 'story-pipeline/04_approved_story_sources/approvals/test.json',
        bytes: approvalBytes.length,
        sha256: createHash('sha256').update(approvalBytes).digest('hex'),
        approval,
      };

      const manifest = writeProductAcceptedStorySource(
        record,
        draft,
        reviewResult,
        acceptanceResult,
        outputDir,
      );
      expect(manifest.version).toBe('small-heroes-product-accepted-story-source-manifest/v1');
      expect(manifest.status).toBe('product_accepted_story_source');
      expect(manifest.record.story.sha256).toBe(draft.sha256);
      expect(manifest.record.story.byteIdenticalToSource).toBe(true);
      expect(fs.readFileSync(path.join(outputDir, 'story.md'), 'utf8')).toBe(draftText);
      expect(fs.readFileSync(path.join(outputDir, 'editorial-review.json'), 'utf8')).toBe(
        `${JSON.stringify(review)}\n`,
      );
      expect(manifest.record.editorialReview.byteIdenticalToSource).toBe(true);
      expect(() =>
        writeProductAcceptedStorySource(
          record,
          draft,
          reviewResult,
          acceptanceResult,
          outputDir,
        ),
      ).toThrow('story_product_accepted_output_directory_not_empty');
      expect(() =>
        writeProductAcceptedStorySource(
          record,
          draft,
          reviewResult,
          {
            ...acceptanceResult,
            approval: { ...approval, storySha256: '0'.repeat(64) },
          },
          path.join(acceptedRoot, 'binding-mismatch-test'),
        ),
      ).toThrow('story_product_acceptance_binding_mismatch');
      expect(() => validateProductAcceptance({ ...approval, acceptedBy: 'Codex' })).toThrow(
        'story_product_acceptance_invalid',
      );
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
      fs.rmSync(outputDir, { recursive: true, force: true });
      fs.rmSync(path.join(acceptedRoot, 'binding-mismatch-test'), {
        recursive: true,
        force: true,
      });
    }
  });
});

describe('autonomous story batch', () => {
  const option = (optionId: 'A' | 'B' | 'C', suffix: string) => ({
    optionId,
    title: `כותרת ${suffix}`,
    hook: `אירוע מיידי ומפתיע מספיק ${suffix}`,
    comicOrWonderEngine: `מנוע קומי או פלאי שונה וברור ${suffix}`,
    journeyShape: `מסע רחב בין מצבים שונים ללא ביטים ${suffix}`,
    childAgencyArc: `הילד בודק בוחר ומשנה את המהלך ${suffix}`,
    climaxPrinciple: `הילד מוביל פתרון שנבנה מן הגילוי ${suffix}`,
    payoffFlavor: `תשלום חזותי ורגשי מפתיע בסיום ${suffix}`,
    whyThisCompanion: `האופי של הקומפניון מניע את הסיפור ${suffix}`,
    surprise: `היפוך שאינו צפוי ישירות מן הגרעין ${suffix}`,
  });
  const architect = (briefId: string) => ({
    version: 'small-heroes-autonomous-architect-options/v1',
    briefId,
    options: [option('A', 'אלף'), option('B', 'בית'), option('C', 'גימל')],
  });
  const evaluation = (optionId: 'A' | 'B' | 'C', score: number) => ({
    optionId,
    childDelight: score,
    rereadDesire: score,
    humorOrWonder: score,
    childAgency: score,
    companionSpecificity: score,
    visualJourney: score,
    causalityPayoff: score,
    hebrewPotential: score,
    disqualifiers: [] as string[],
    notes: `נימוק עריכתי עבור אפשרות ${optionId}`,
  });
  const selection = (briefId: string) => ({
    version: 'small-heroes-autonomous-premise-selection/v1',
    briefId,
    evaluations: [evaluation('A', 8), evaluation('B', 9), evaluation('C', 7)],
    recommendedOptionId: 'B',
    selectionReason: 'אפשרות בית היא החזקה ביותר בכל המדדים המרכזיים.',
  });

  it('validates closed A/B/C contracts and independently selects the unique winner', () => {
    const briefId = 'test_brief_v1';
    expect(autonomous.validateArchitectOptions(architect(briefId), briefId).options).toHaveLength(3);
    expect(autonomous.validateSelection(selection(briefId), briefId).evaluations).toHaveLength(3);
    expect(autonomous.chooseQualifiedOption(architect(briefId), selection(briefId))).toMatchObject({
      status: 'selected',
      selectedOption: { optionId: 'B' },
    });

    const mismatched = { ...selection(briefId), recommendedOptionId: 'A' };
    expect(() => autonomous.chooseQualifiedOption(architect(briefId), mismatched)).toThrow(
      'story_batch_selector_recommendation_mismatch',
    );
    const tied = selection(briefId);
    tied.evaluations[0] = evaluation('A', 9);
    expect(autonomous.chooseQualifiedOption(architect(briefId), tied).status).toBe('reroll_required');
    expect(() => autonomous.validateArchitectOptions({ ...architect(briefId), extra: true }, briefId)).toThrow(
      'story_batch_architect_output_invalid',
    );
  });

  it('keeps selector scores and rejected options out of the Writer context', () => {
    const authority = loadStoryArchitectAuthority();
    const record = findRecord(authority.commissionAuthority, authority.commissions[0].briefId);
    const options = architect(record.brief.id);
    const selected = options.options[1];
    const prompt = autonomous.buildPrompts(process.cwd(), authority, record, selected);
    expect(prompt.stage).toBe('writer');
    expect(prompt.userPrompt).toContain(selected.title);
    expect(prompt.userPrompt).not.toContain(options.options[0].title);
    expect(prompt.userPrompt).not.toContain('recommendedOptionId');
    expect(prompt.userPrompt).toContain('requiredOutputEnvelope');
    expect(prompt.userPrompt).toContain('--- Page 1 ---');
    expect(prompt.userPrompt).toContain(`--- Page ${record.brief.pageCount} ---`);
    expect(prompt.userPrompt).toContain('two complete Hebrew forms');
    expect(autonomous.validateWriterIsolation(prompt, [options.options[0], options.options[2]], selection(record.brief.id))).toBe(true);

    const architectPrompt = autonomous.buildPrompts(process.cwd(), authority, record);
    expect(architectPrompt.systemPrompt).toContain('natural Hebrew');

    const editorPrompt = autonomous.buildPrompts(process.cwd(), authority, record, selected, 'draft');
    expect(editorPrompt.reasoningEffort).toBe('high');
    expect(editorPrompt.maxOutputTokens).toBe(autonomous.EDITOR_MAX_OUTPUT_TOKENS);
    expect(autonomous.EDITOR_MAX_OUTPUT_TOKENS).toBe(6000);

    for (const direction of ['bedtime', 'adventure', 'fantasy']) {
      const directionRecord = authority.commissionAuthority.records.find(
        ({ brief }: any) => brief.direction === direction,
      )!;
      const directionSelected = architect(directionRecord.brief.id).options[0];
      const directionEditorPrompt = autonomous.buildPrompts(
        process.cwd(),
        authority,
        directionRecord,
        directionSelected,
        'draft',
      );
      expect(directionEditorPrompt).toMatchObject({
        stage: 'editor',
        reasoningEffort: 'high',
        maxOutputTokens: 6000,
      });
    }
    expect(editorPrompt.systemPrompt).toContain('strengths contains 1–4 items');
    expect(editorPrompt.systemPrompt).toContain('mustPreserve contains 1–8 items');
  });

  it('uses the Responses API sentinel settings and sanitizes provider failures', async () => {
    let captured: any;
    const provider = createOpenAiStoryProvider({
      apiKey: 'test-only-key',
      fetchImpl: async (_url: string, init: any) => {
        captured = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            status: 'completed',
            model: autonomous.MODEL,
            service_tier: autonomous.SERVICE_TIER,
            output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }],
            usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15, input_tokens_details: {}, output_tokens_details: { reasoning_tokens: 2 } },
          }),
        };
      },
    });
    const result = await provider.complete({
      systemPrompt: 'system',
      userPrompt: 'user',
      reasoningEffort: 'high',
      maxOutputTokens: 100,
      schemaName: 'test_schema',
      schema: { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } },
    });
    expect(captured).toMatchObject({
      model: 'gpt-5.6-sol',
      service_tier: 'default',
      store: false,
      truncation: 'disabled',
      reasoning: { effort: 'high' },
      max_output_tokens: 100,
      text: { format: { type: 'json_schema', strict: true } },
    });
    const serializedSchema = JSON.stringify(captured.text.format.schema);
    for (const unsupportedKeyword of ['minLength', 'maxLength', 'minItems', 'maxItems', 'minimum', 'maximum', 'uniqueItems']) {
      expect(serializedSchema).not.toContain(`"${unsupportedKeyword}"`);
    }
    expect(result.usage).toEqual({ inputTokens: 10, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 5, reasoningTokens: 2, totalTokens: 15 });

    const incomplete = createOpenAiStoryProvider({
      apiKey: 'test-only-key',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          status: 'incomplete',
          incomplete_details: { reason: 'max_output_tokens' },
          model: autonomous.MODEL,
          service_tier: autonomous.SERVICE_TIER,
          usage: { input_tokens: 20, output_tokens: 100, total_tokens: 120 },
        }),
      }),
    });
    await expect(incomplete.complete({ systemPrompt: 'system', userPrompt: 'user', reasoningEffort: 'high', maxOutputTokens: 100 })).resolves.toMatchObject({
      completed: false,
      terminalReason: 'story_provider_max_output_tokens',
      usage: { inputTokens: 20, outputTokens: 100, totalTokens: 120 },
    });

    const failed = createOpenAiStoryProvider({ apiKey: 'test-only-key', fetchImpl: async () => ({ ok: false, status: 429 }) });
    await expect(failed.complete({ systemPrompt: 'secret prompt', userPrompt: 'secret story', reasoningEffort: 'low', maxOutputTokens: 10 })).rejects.toThrow('story_provider_http_429');
  });

  it('runs a bounded story into staging only and rejects a pass with revision priorities', async () => {
    const authority = loadStoryArchitectAuthority();
    const commission = authority.commissions.find(({ companionId }) => companionId === 'bunny_ometz')!;
    const record = findRecord(authority.commissionAuthority, commission.briefId);
    const options = architect(record.brief.id);
    const selected = selection(record.brief.id);
    const story = [
      '---',
      'title: "{{childName}} ובוני: לילה קטן"',
      `companionId: ${record.companionId}`,
      `direction: ${record.brief.direction}`,
      `category: ${record.brief.category}`,
      `pages: ${record.brief.pageCount}`,
      'gender: female',
      'endingType: resolution',
      '---',
      ...Array.from({ length: record.brief.pageCount }, (_, index) => `--- Page ${index + 1} ---\n\n{{childName}} {צעד|צעדה} קדימה, ובוני הקשיב.`),
      '',
    ].join('\n');
    const pass = {
      version: 'small-heroes-story-editorial-review/v1',
      verdict: 'pass',
      strengths: ['הילד מוביל את הפעולה באופן ברור.'],
      issues: [],
      revisionPriorities: [],
      mustPreserve: ['את הפעולה של הילד ואת הקצב.'],
    };
    const outputs = [JSON.stringify(options), JSON.stringify(selected), story, JSON.stringify(pass)];
    const seen: any[] = [];
    const provider = {
      complete: async (request: any) => {
        seen.push(request);
        const text = outputs.shift();
        if (!text) throw new Error('unexpected_provider_call');
        return {
          text,
          model: autonomous.MODEL,
          serviceTier: autonomous.SERVICE_TIER,
          usage: { inputTokens: 100, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 100, reasoningTokens: 10, totalTokens: 200 },
        };
      },
    };
    const outputRoot = path.join(process.cwd(), 'outputs', `autonomous-story-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const invalidOutputRoot = path.join(process.cwd(), 'outputs', `autonomous-story-priority-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    try {
      const manifest = await autonomous.runAutonomousStoryWave({
        repoRoot: process.cwd(), outputRoot, briefIds: [record.brief.id], provider, maxCostUsd: 1,
      });
      expect(manifest.status).toBe('machine_qualified');
      expect(manifest.authorityStatus).toBe('machine_qualified_staging_only');
      expect(manifest.logicalProviderCalls).toBe(4);
      expect(manifest.transportRetries).toBe(0);
      expect(manifest.fallbackUsed).toBe(false);
      expect(manifest.stories[record.brief.id]).toMatchObject({ status: 'machine_qualified', selectedOptionId: 'B', revisionCount: 0 });
      expect(seen.map(({ stage }) => stage)).toEqual(['architect', 'selector', 'writer', 'editor']);
      expect(seen[2].userPrompt).not.toContain(options.options[0].title);
      expect(fs.readdirSync(path.join(outputRoot, record.brief.id)).some((name) => name.startsWith('final-story.'))).toBe(true);

      const invalidOutputs = [
        JSON.stringify(options),
        JSON.stringify(selected),
        story,
        JSON.stringify({
          ...pass,
          revisionPriorities: ['Page 8 still needs a stronger closing beat.'],
        }),
      ];
      const invalidManifest = await autonomous.runAutonomousStoryWave({
        repoRoot: process.cwd(),
        outputRoot: invalidOutputRoot,
        briefIds: [record.brief.id],
        provider: {
          complete: async () => ({
            text: invalidOutputs.shift(),
            model: autonomous.MODEL,
            serviceTier: autonomous.SERVICE_TIER,
            usage: { inputTokens: 100, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 100, reasoningTokens: 10, totalTokens: 200 },
          }),
        },
        maxCostUsd: 1,
      });
      expect(invalidManifest.status).toBe('completed_with_holds');
      expect(invalidManifest.stories[record.brief.id]).toMatchObject({
        status: 'hold',
        reasonCode: 'story_editor_review_result_invalid',
      });
      expect(fs.readdirSync(path.join(invalidOutputRoot, record.brief.id)).some((name) => name.startsWith('final-story.'))).toBe(false);
    } finally {
      fs.rmSync(outputRoot, { recursive: true, force: true });
      fs.rmSync(invalidOutputRoot, { recursive: true, force: true });
    }
  });

  it('accounts standard and fast-tier usage without hiding cache-write cost', () => {
    const usage = { inputTokens: 1000, cachedInputTokens: 200, cacheWriteTokens: 100, outputTokens: 500, reasoningTokens: 50, totalTokens: 1500 };
    expect(autonomous.calculateCostUsd(usage, 'default')).toBeCloseTo(0.019225, 9);
    expect(autonomous.calculateCostUsd(usage, 'fast')).toBeCloseTo(0.03845, 9);
  });

  it('resumes completed stages without a duplicate call and holds an ambiguous in-flight call', async () => {
    const authority = loadStoryArchitectAuthority();
    const commission = authority.commissions.find(({ companionId }) => companionId === 'bunny_ometz')!;
    const record = findRecord(authority.commissionAuthority, commission.briefId);
    const outputRoot = path.join(process.cwd(), 'outputs', `autonomous-resume-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const manifestPath = path.join(outputRoot, 'manifest.json');
    const options = architect(record.brief.id);
    let providerCalls = 0;
    const provider = {
      complete: async () => {
        providerCalls += 1;
        throw new Error('simulated_interruption');
      },
    };
    try {
      fs.mkdirSync(path.join(outputRoot, record.brief.id), { recursive: true });
      const head = createRequire(import.meta.url)('node:child_process').execFileSync(
        'git', ['rev-parse', 'HEAD'], { cwd: process.cwd(), encoding: 'utf8' },
      ).trim();
      const contracts = autonomous.buildPrompts(process.cwd(), authority, record);
      const authorityDigests = Object.fromEntries(
        Object.entries(require('../../scripts/story-autonomous-batch-core.cjs').CONTRACTS).map(([key, relative]) => [
          key,
          { path: relative, sha256: createHash('sha256').update(fs.readFileSync(path.join(process.cwd(), relative as string), 'utf8').trim()).digest('hex') },
        ]),
      );
      const promptSha = createHash('sha256').update(`${contracts.systemPrompt}\n${contracts.userPrompt}`).digest('hex');
      const manifest = {
        version: 'small-heroes-autonomous-story-batch/v1', status: 'in_progress', authorityStatus: 'machine_qualified_staging_only',
        model: autonomous.MODEL, serviceTier: autonomous.SERVICE_TIER, store: false, repoHead: head,
        briefIds: [record.brief.id], maxCostUsd: 1, actualCostUsd: 0, logicalProviderCalls: 0,
        transportRetries: 0, fallbackUsed: false, resumeCount: 0, credentialAccess: 'supervisor_child_only',
        stories: {
          [record.brief.id]: {
            status: 'in_progress', identity: {}, calls: [], selectedOptionId: null, revisionCount: 0,
            inflight: { stage: 'architect', promptSha256: promptSha },
          },
        },
        authorityDigests,
      };
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      const resumed = await autonomous.runAutonomousStoryWave({ repoRoot: process.cwd(), outputRoot, briefIds: [record.brief.id], provider, maxCostUsd: 1 });
      expect(providerCalls).toBe(0);
      expect(resumed.resumeCount).toBe(1);
      expect(resumed.stories[record.brief.id]).toMatchObject({ status: 'hold', reasonCode: 'story_batch_ambiguous_inflight_call' });
    } finally {
      fs.rmSync(outputRoot, { recursive: true, force: true });
    }
  });

  it('refuses to resume a terminal provider call with a closed sanitized reason', async () => {
    const authority = loadStoryArchitectAuthority();
    const commission = authority.commissions.find(({ companionId }) => companionId === 'bunny_ometz')!;
    const record = findRecord(authority.commissionAuthority, commission.briefId);
    const outputRoot = path.join(process.cwd(), 'outputs', `autonomous-terminal-resume-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const manifestPath = path.join(outputRoot, 'manifest.json');
    let providerCalls = 0;
    const provider = {
      complete: async () => {
        providerCalls += 1;
        if (providerCalls > 1) throw new Error('unexpected_duplicate_provider_call');
        return {
          completed: false,
          terminalReason: 'story_provider_max_output_tokens',
          model: autonomous.MODEL,
          serviceTier: autonomous.SERVICE_TIER,
          usage: { inputTokens: 20, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 100, reasoningTokens: 10, totalTokens: 120 },
        };
      },
    };
    try {
      const first = await autonomous.runAutonomousStoryWave({
        repoRoot: process.cwd(), outputRoot, briefIds: [record.brief.id], provider, maxCostUsd: 1,
      });
      expect(first.stories[record.brief.id]).toMatchObject({
        status: 'hold',
        reasonCode: 'story_provider_max_output_tokens',
      });
      expect(providerCalls).toBe(1);

      const edited = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      edited.status = 'in_progress';
      edited.stories[record.brief.id].status = 'in_progress';
      delete edited.stories[record.brief.id].reasonCode;
      fs.writeFileSync(manifestPath, `${JSON.stringify(edited, null, 2)}\n`, 'utf8');

      const resumed = await autonomous.runAutonomousStoryWave({
        repoRoot: process.cwd(), outputRoot, briefIds: [record.brief.id], provider, maxCostUsd: 1,
      });
      expect(providerCalls).toBe(1);
      expect(resumed.stories[record.brief.id]).toMatchObject({
        status: 'hold',
        reasonCode: 'story_batch_terminal_call_not_resumable',
      });
    } finally {
      fs.rmSync(outputRoot, { recursive: true, force: true });
    }
  });
});
