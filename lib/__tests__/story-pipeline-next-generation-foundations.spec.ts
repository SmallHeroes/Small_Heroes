import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { validatePremiseHardFails } from '../story-gen-v3/premise-validator';
import type { PremiseFamily, StoryPremiseCandidate } from '../story-gen-v3/types';

interface TournamentRecord {
  candidate: StoryPremiseCandidate;
  review: {
    decision: 'finalist' | 'reserve' | 'reject';
    weightedScore: number;
    reason: string;
  };
}

interface FinalistExpansion {
  id: string;
  setPieces: string[];
  comicEscalations: string[];
  tryFails: string[];
  eventChain: string[];
  childOwnedClimax: string;
  bedtimeEnergyProof: string;
  continuityRisks: string[];
  oldStoryNonCopy: string;
}

interface PremiseTournamentArtifact {
  schemaVersion: 'next-generation-premise-tournament/v1';
  status: 'staging_only';
  companionId: 'chameleon_koko';
  displayName: 'קִים';
  direction: 'bedtime';
  pageCount: 8;
  targetAge: string;
  finalistIds: string[];
  candidates: TournamentRecord[];
  finalistExpansions: FinalistExpansion[];
}

const ROOT = process.cwd();
const PIPELINE_ROOT = path.join(ROOT, 'story-pipeline');
const TOURNAMENT_PATH = path.join(
  PIPELINE_ROOT,
  '02_prompts',
  'drafts',
  'chameleon_koko__bedtime.premise-tournament.json'
);

const REQUIRED_STRING_FIELDS: Array<keyof StoryPremiseCandidate> = [
  'id',
  'titleSeed',
  'resilienceTheme',
  'hiddenResilienceTool',
  'oneLineHook',
  'openingWeirdEvent',
  'childWant',
  'whyItMattersToChild',
  'physicalProblem',
  'playSystem',
  'companionComicEngineUsed',
  'companionWrongHelp',
  'firstTry',
  'whyFirstTryFails',
  'funnyFailureImage',
  'escalation',
  'childDiscovery',
  'braveChildAction',
  'bigReleasePayoff',
  'oneResilienceLineMax',
  'whyChildWillCare',
  'whyParentWillCare',
  'whyNotTherapeuticFable',
  'whyNotGoldenCopy',
  'premiseFamily',
];

const COMPANION_IDS = [
  'fox_uri',
  'panda_anat',
  'bunny_ometz',
  'dragon_dini',
  'chameleon_koko',
  'lion_shaket',
] as const;

const REQUIRED_BIBLE_HEADINGS = [
  '## Child-facing promise',
  '## Story engine',
  '## Comic engine',
  '## Voice and oral Hebrew',
  '## Play vocabulary',
  '## Direction modulation',
  '## Do not write',
  '## Swap test and acceptance',
  '## Visual continuity locks',
] as const;

function loadTournament(): PremiseTournamentArtifact {
  return JSON.parse(fs.readFileSync(TOURNAMENT_PATH, 'utf8')) as PremiseTournamentArtifact;
}

function premisePlotText(candidate: StoryPremiseCandidate): string {
  return [
    candidate.titleSeed,
    candidate.oneLineHook,
    candidate.openingWeirdEvent,
    candidate.childWant,
    candidate.physicalProblem,
    candidate.playSystem,
    candidate.companionWrongHelp,
    candidate.firstTry,
    candidate.whyFirstTryFails,
    candidate.funnyFailureImage,
    candidate.escalation,
    candidate.childDiscovery,
    candidate.braveChildAction,
    candidate.bigReleasePayoff,
    ...candidate.keyObjects,
  ].join('\n');
}

describe('next-generation story foundations', () => {
  it('keeps the Koko bedtime tournament typed, bounded, diverse, and staging-only', () => {
    const artifact = loadTournament();

    expect(artifact.schemaVersion).toBe('next-generation-premise-tournament/v1');
    expect(artifact.status).toBe('staging_only');
    expect(artifact.companionId).toBe('chameleon_koko');
    expect(artifact.direction).toBe('bedtime');
    expect(artifact.pageCount).toBe(8);
    expect(artifact.candidates).toHaveLength(12);
    expect(artifact.finalistIds).toHaveLength(3);
    expect(new Set(artifact.finalistIds).size).toBe(3);

    const ids = artifact.candidates.map(({ candidate }) => candidate.id);
    expect(new Set(ids).size).toBe(12);
    expect(artifact.finalistIds.every((id) => ids.includes(id))).toBe(true);

    const premiseFamilies = new Set(
      artifact.candidates.map(({ candidate }) => candidate.premiseFamily as PremiseFamily)
    );
    expect(premiseFamilies.size).toBeGreaterThanOrEqual(6);

    for (const { candidate, review } of artifact.candidates) {
      for (const field of REQUIRED_STRING_FIELDS) {
        expect(candidate[field], `${candidate.id}.${field}`).toEqual(expect.any(String));
        expect((candidate[field] as string).trim().length, `${candidate.id}.${field}`).toBeGreaterThan(
          0
        );
      }
      expect(candidate.keyObjects.length, `${candidate.id}.keyObjects`).toBeGreaterThan(0);
      expect(review.reason.trim().length).toBeGreaterThan(0);
      expect(review.weightedScore).toBeGreaterThanOrEqual(0);
      expect(review.weightedScore).toBeLessThanOrEqual(10);
    }
  });

  it('admits all three finalists through the existing deterministic premise hard-fail gate', () => {
    const artifact = loadTournament();
    const byId = new Map(
      artifact.candidates.map(({ candidate }) => [candidate.id, candidate] as const)
    );

    for (const finalistId of artifact.finalistIds) {
      const candidate = byId.get(finalistId);
      expect(candidate, finalistId).toBeDefined();
      expect(validatePremiseHardFails(candidate!), finalistId).toEqual([]);

      const plotText = premisePlotText(candidate!);
      expect(plotText).not.toMatch(
        /bedroom|sleepover|under the pillow|first night in|מיטה|חדר שינה|לישון אצל|לילה ראשון בחדר|כפתור מתחת לכרית/i
      );
      expect(plotText).not.toMatch(/home[- ]?token|חפץ מהבית|צבע מהבית/i);
      expect(plotText).not.toMatch(/calm down|תירגע|לנשום עמוק|תרגיל נשימה/i);
    }
  });

  it('proves each finalist has complete pre-prose structure evidence', () => {
    const artifact = loadTournament();
    expect(artifact.finalistExpansions).toHaveLength(3);
    expect(artifact.finalistExpansions.map(({ id }) => id)).toEqual(artifact.finalistIds);

    for (const finalist of artifact.finalistExpansions) {
      expect(finalist.setPieces, finalist.id).toHaveLength(3);
      expect(finalist.comicEscalations, finalist.id).toHaveLength(3);
      expect(finalist.tryFails, finalist.id).toHaveLength(2);
      expect(finalist.eventChain, finalist.id).toHaveLength(8);
      expect(finalist.childOwnedClimax.trim().length).toBeGreaterThan(30);
      expect(finalist.bedtimeEnergyProof.trim().length).toBeGreaterThan(30);
      expect(finalist.continuityRisks.length).toBeGreaterThanOrEqual(3);
      expect(finalist.oldStoryNonCopy.trim().length).toBeGreaterThan(20);
    }
  });

  it('keeps all six MVP companion bibles on one complete causal template', () => {
    for (const companionId of COMPANION_IDS) {
      const biblePath = path.join(PIPELINE_ROOT, '01_companions', `${companionId}.md`);
      const bible = fs.readFileSync(biblePath, 'utf8');

      expect(bible).toContain('**Status:** next-generation staging canon; not runtime authority.');
      expect(bible).toContain(`(\`${companionId}\`)`);
      expect(bible).toContain('**Immutable visual identity:**');
      expect(bible).toContain('**Visible desire:**');
      expect(bible).toContain('**Lovable flaw:**');
      expect(bible).toContain('**Wrong help:**');
      expect(bible).toContain('**Child-only ability:**');
      expect(bible).toContain('**Relationship change:**');
      expect(bible).toContain('**Emotional underlayer, never headline:**');

      for (const heading of REQUIRED_BIBLE_HEADINGS) {
        expect(bible, `${companionId}: ${heading}`).toContain(heading);
      }
    }
  });

  it('keeps the pilot selection historical and makes legacy prose authority explicit', () => {
    const finalistBrief = fs.readFileSync(
      path.join(
        PIPELINE_ROOT,
        '02_prompts',
        'drafts',
        'chameleon_koko__bedtime.premises.md'
      ),
      'utf8'
    );
    const masterPrompt = fs.readFileSync(
      path.join(PIPELINE_ROOT, '00_MASTER_STORY_PROMPT_TEMPLATE.md'),
      'utf8'
    );

    expect(finalistBrief).toContain('No finalist has been selected by Codex.');
    expect(finalistBrief).toContain('Guy selected **B — תחנת האוטובוס שקמה והלכה**.');
    expect(finalistBrief).toContain('The subsequently proposed hand-authored eight-page spine was rejected and removed.');
    expect(finalistBrief).not.toMatch(/--- Page 1 ---/);
    expect(masterPrompt).toContain('LEGACY / HOLD');
    expect(masterPrompt).toContain('Do not use this template for next-generation story prose.');
  });
});
