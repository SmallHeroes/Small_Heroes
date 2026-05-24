import { readFileSync } from 'fs';
import path from 'path';
import type { HumanCalibrationNotes } from '../../editorial/voice-calibration-types';

export type {
  HumanCalibrationNotes,
  HumanExpectedIssue,
  HumanExpectedNonFinding,
} from '../../editorial/voice-calibration-types';

const CORPUS_DIR = path.join(__dirname);

export const VOICE_CALIBRATION_FIXTURE_IDS = [
  'fantasy_gold',
  'adventure_noa',
  'adventure_michal',
  'adventure_daniel',
  'bedtime_noa',
  'bedtime_michal',
  'bedtime_daniel',
  'adventure_michal_run1',
  'probe_impossible_subject',
  'probe_abstract_speaker',
  'probe_gender_mismatch',
  'probe_dense_readaloud',
  'probe_relationship_failure',
] as const;

export type VoiceCalibrationFixtureId = (typeof VOICE_CALIBRATION_FIXTURE_IDS)[number];

export function loadCalibrationFixture(id: VoiceCalibrationFixtureId): {
  markdown: string;
  human: HumanCalibrationNotes;
} {
  const mdPath = path.join(CORPUS_DIR, `${id}.md`);
  const humanPath = path.join(CORPUS_DIR, `${id}.human.json`);
  const markdown = readFileSync(mdPath, 'utf8');
  const human = JSON.parse(readFileSync(humanPath, 'utf8')) as HumanCalibrationNotes;
  return { markdown, human };
}

export function listCalibrationFixtures(): VoiceCalibrationFixtureId[] {
  return VOICE_CALIBRATION_FIXTURE_IDS.filter((id) => {
    try {
      readFileSync(path.join(CORPUS_DIR, `${id}.md`));
      readFileSync(path.join(CORPUS_DIR, `${id}.human.json`));
      return true;
    } catch {
      return false;
    }
  });
}
