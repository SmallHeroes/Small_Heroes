import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildCommissionBundle,
  commissionMetadata,
  findCompanionCard,
  findRecord,
  loadCommissionAuthority,
  projectBriefForWriter,
  validateCompanionCardsDocument,
  writeCommissionFiles,
} = require('../../scripts/materialize-story-commission-briefs.cjs') as {
  buildCommissionBundle: (authority: CommissionAuthority, record: CommissionRecord) => string;
  commissionMetadata: (record: CommissionRecord) => CommissionMetadata;
  findCompanionCard: (authority: CommissionAuthority, companionId: string) => CompanionCard;
  findRecord: (authority: CommissionAuthority, briefId: string) => CommissionRecord;
  loadCommissionAuthority: () => CommissionAuthority;
  projectBriefForWriter: (brief: StoryBrief) => Record<string, unknown>;
  validateCompanionCardsDocument: (document: unknown) => unknown;
  writeCommissionFiles: (
    authority: CommissionAuthority,
    records: CommissionRecord[],
    outputDir: string,
  ) => { recordCount: number; records: Array<CommissionMetadata & { filename: string; sha256: string }> };
};

interface StoryBrief {
  id: string;
  category: string;
  direction: 'bedtime' | 'adventure' | 'fantasy';
  pageCount: number;
  workingTitle: string;
  creativePromise: string;
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
  sourceDocuments: {
    sharedStoryContract: string;
    writerContract: string;
  };
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

describe('story commission materializer', () => {
  it('materializes the exact 18 curated slots with 8/12/16 text pages and 16/24/32 physical pages', () => {
    const authority = loadCommissionAuthority();
    const metadata = authority.records.map(commissionMetadata);

    expect(metadata).toHaveLength(18);
    expect(new Set(metadata.map(({ briefId }) => briefId)).size).toBe(18);
    expect(new Set(metadata.map(({ companionId }) => companionId)).size).toBe(6);

    const pageContracts = new Map([
      ['bedtime', [8, 16]],
      ['adventure', [12, 24]],
      ['fantasy', [16, 32]],
    ]);
    for (const record of metadata) {
      expect(
        [record.textPageCount, record.physicalPageCount],
        record.briefId,
      ).toEqual(pageContracts.get(record.direction));
      expect(record.personalization.childAppearance).toBe(
        'not_supplied_story_writer_must_not_invent',
      );
      expect(record.personalization.childAgeBodyAuthority).toBe(
        'downstream_visual_pipeline_only',
      );
    }
  });

  it('builds one compact prompt from only the freedom charter, selected companion card, and projected story rails', () => {
    const authority = loadCommissionAuthority();
    const selected = authority.records.find(
      ({ brief }) => brief.direction === 'adventure',
    )!;
    const another = authority.records.find(
      ({ brief }) => brief.id !== selected.brief.id,
    )!;
    const bundle = buildCommissionBundle(authority, selected);

    expect(bundle).toContain(authority.writerFreedomCharter);
    expect(bundle).toContain(JSON.stringify(findCompanionCard(authority, selected.companionId), null, 2));
    expect(bundle).toContain(selected.brief.id);
    expect(bundle).toContain(selected.brief.workingTitle);
    expect(bundle).toContain('"textPageCount": 12');
    expect(bundle).toContain('"physicalPageCount": 24');
    expect(bundle).not.toContain(another.brief.id);
    expect(bundle).not.toContain(authority.sourceDocuments.sharedStoryContract);
    expect(bundle).not.toContain(authority.sourceDocuments.writerContract);
    expect(bundle).toContain('אל תמציא מראה, גוף, גובה, לבוש, פנים, שיער או סגנון איור לילד.');
  });

  it('uses six closed companion cards with behavior-led voice and no supplied catchphrases', () => {
    const authority = loadCommissionAuthority();
    const expectedKeys = [
      'companionId',
      'displayName',
      'storyRole',
      'lovableMistake',
      'embodiedComedy',
      'childPartnership',
      'voiceDirection',
    ];

    expect(authority.companionCards).toHaveLength(6);
    expect(new Set(authority.companionCards.map(({ companionId }) => companionId)).size).toBe(6);
    for (const card of authority.companionCards) {
      expect(Object.keys(card)).toEqual(expectedKeys);
      expect(JSON.stringify(card)).not.toMatch(/sample|catchphrase|slogan|lineTargets/i);
      expect(JSON.stringify(card)).not.toMatch(/[“”]/u);
    }

    expect(() =>
      validateCompanionCardsDocument({
        version: 'small-heroes-companion-authoring-cards/v1',
        status: 'staging_only',
        cards: authority.companionCards.map((card, index) =>
          index === 0 ? { ...card, sampleVoice: 'do not dispatch me' } : card
        ),
      })
    ).toThrow('story_commission_companion_cards_invalid');
  });

  it('projects all 18 briefs through a closed writer-facing allowlist and removes imitation pressure', () => {
    const authority = loadCommissionAuthority();
    const expectedProjectionKeys = [
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
    ];
    const forbiddenFieldNames = [
      'lineTargets',
      'childRepeatable',
      'parentReread',
      'rereadHooks',
      'oldStoryAntiCopy',
      'mustAvoid',
      'worldAndSafetyLocks',
      'companionIndispensability',
      'playRule',
      'dramaticPurpose',
      'escalatingConsequences',
      'failedApproaches',
    ];

    for (const record of authority.records) {
      const bundle = buildCommissionBundle(authority, record);
      const projection = projectBriefForWriter(record.brief);
      const companionBible = fs.readFileSync(
        path.join(process.cwd(), record.companionBiblePath),
        'utf8',
      );
      const historicalDispatchBytes = Buffer.byteLength(
        [
          authority.sourceDocuments.sharedStoryContract,
          authority.sourceDocuments.writerContract,
          companionBible,
          JSON.stringify(record.brief, null, 2),
        ].join('\n'),
        'utf8',
      );

      expect(Object.keys(projection), record.brief.id).toEqual(expectedProjectionKeys);
      expect(Buffer.byteLength(bundle, 'utf8'), record.brief.id).toBeLessThan(
        historicalDispatchBytes * 0.6,
      );
      for (const fieldName of forbiddenFieldNames) {
        expect(bundle, `${record.brief.id}:${fieldName}`).not.toContain(`"${fieldName}"`);
      }
      for (const target of Object.values(record.brief.lineTargets)) {
        expect(bundle, `${record.brief.id}:target-line`).not.toContain(target);
      }
      expect(bundle).not.toContain('Sample voice, not mandatory catchphrases');
      expect(bundle).not.toContain('## Selected companion bible');
      expect(bundle).not.toContain('## Shared next-generation story contract');
    }

    const dini = authority.records.find(
      ({ brief }) => brief.id === 'dragon_dini_adventure_wobble_cake_convoy_brief_v1',
    )!;
    const diniBundle = buildCommissionBundle(authority, dini);
    for (const contaminatedPhrase of [
      'הגנה מלאה',
      'הפתח נשאר פתוח. הזנב שלי הגיש הסתייגות.',
      'הוספתי כרית אחת. ועוד אחת לכרית.',
      'זה לא קיר. כרגע הוא פשוט עומד מאוד.',
      'כלל קצבי לשלוש תנודות קטנות.',
      'כלל התנודה מוצג',
      'שלוש תנודות קטנות',
    ]) {
      expect(diniBundle).not.toContain(contaminatedPhrase);
    }
  });

  it('writes content-addressed bundles and refuses ambiguous IDs or a non-empty output directory', () => {
    const authority = loadCommissionAuthority();
    const selected = authority.records[0]!;
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'small-heroes-story-commission-'));

    try {
      const manifest = writeCommissionFiles(authority, [selected], outputDir);
      expect(manifest.recordCount).toBe(1);
      expect((manifest as { version?: string }).version).toBe(
        'small-heroes-story-commission-manifest/v2',
      );
      expect(manifest.records[0]!.filename).toMatch(
        new RegExp(`^${selected.brief.id}\\.[a-f0-9]{64}\\.md$`),
      );
      expect(fs.readdirSync(outputDir).sort()).toEqual(
        [manifest.records[0]!.filename, 'INDEX.md', 'manifest.json'].sort(),
      );
      const index = fs.readFileSync(path.join(outputDir, 'INDEX.md'), 'utf8');
      expect(index).toContain(selected.brief.workingTitle);
      expect(index).toContain(`[copy-ready brief](${manifest.records[0]!.filename})`);
      expect(() => writeCommissionFiles(authority, [selected], outputDir)).toThrow(
        'story_commission_output_directory_not_empty',
      );
      expect(() => findRecord(authority, 'not-a-real-brief')).toThrow(
        'story_commission_brief_id_not_unique:not-a-real-brief',
      );
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
