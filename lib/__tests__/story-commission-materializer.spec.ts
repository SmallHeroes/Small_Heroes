import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildArchitectPilotBundle,
  buildCommissionBundle,
  commissionMetadata,
  findArchitectPilot,
  findCompanionCard,
  findRecord,
  loadArchitectPilotAuthority,
  loadCommissionAuthority,
  projectBriefForWriter,
  validateArchitectPilotsDocument,
  validateCompanionCardsDocument,
  writeArchitectPilotFiles,
  writeCommissionFiles,
} = require('../../scripts/materialize-story-commission-briefs.cjs') as Materializer;

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
  pilots: ArchitectPilot[];
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
  buildCommissionBundle: (authority: CommissionAuthority, record: CommissionRecord) => string;
  commissionMetadata: (record: CommissionRecord) => CommissionMetadata;
  findArchitectPilot: (authority: ArchitectAuthority, briefId: string) => ArchitectPilot;
  findCompanionCard: (authority: CommissionAuthority, companionId: string) => CompanionCard;
  findRecord: (authority: CommissionAuthority, briefId: string) => CommissionRecord;
  loadArchitectPilotAuthority: (authority?: CommissionAuthority) => ArchitectAuthority;
  loadCommissionAuthority: () => CommissionAuthority;
  projectBriefForWriter: (brief: StoryBrief) => Record<string, unknown>;
  validateArchitectPilotsDocument: (document: unknown) => unknown;
  validateCompanionCardsDocument: (document: unknown) => unknown;
  writeArchitectPilotFiles: (
    authority: ArchitectAuthority,
    record: CommissionRecord,
    outputDir: string,
  ) => { version: string; recordCount: number; record: { filename: string; sha256: string } };
  writeCommissionFiles: (
    authority: CommissionAuthority,
    records: CommissionRecord[],
    outputDir: string,
  ) => { version: string; recordCount: number; records: Array<CommissionMetadata & { filename: string; sha256: string }> };
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
        version: 'small-heroes-story-architect-pilots/v1',
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
    expect(bundle).toContain('Child discovery');
    expect(bundle).toContain('Climax principle');
    expect(bundle).toContain('Why Dini');
    expect(bundle).toContain('Surprise');
    expect(bundle).toContain(findArchitectPilot(authority, DINI_BRIEF_ID).companionPortrait);
    expect(bundle).not.toContain(authority.postDraftEditorialQa);
    expect(bundle).not.toContain('Post-Draft Editorial QA Contract');
    expect(bundle).not.toContain('imageDirection:');
    expect(bundle).not.toContain(record.brief.workingTitle);
    expect(bundle).not.toContain(record.brief.category);
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
    expect(authority.postDraftEditorialQa).toContain('## Hebrew read-aloud QA');
    expect(authority.postDraftEditorialQa).toContain('Do not reward mechanical compliance');
    expect(authority.postDraftEditorialQa).toContain('Guy retains final product and story acceptance.');
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
});
