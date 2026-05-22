import { parseStoryMarkdown } from './parser';
import type { Finding, ValidationInput, ValidationReport, ValidatorContext } from './types';
import { companionNameValidator } from './validators/companionName';
import { companionPresenceValidator } from './validators/companionPresence';
import { companionSpeechViolationValidator } from './validators/companionSpeechViolation';
import { directTherapyLanguageValidator } from './validators/directTherapyLanguage';
import { errorNotesValidator } from './validators/errorNotes';
import { forbiddenAnatomyValidator } from './validators/forbiddenAnatomy';
import { forbiddenObjectsValidator } from './validators/forbiddenObjects';
import { forbiddenToneValidator } from './validators/forbiddenTone';
import { foreignCharsValidator } from './validators/foreignChars';
import { frontmatterConsistencyValidator } from './validators/frontmatterConsistency';
import { genderConsistencyValidator } from './validators/genderConsistency';
import { hookAppearancesValidator } from './validators/hookAppearances';
import { imageDirectionValidator } from './validators/imageDirectionValidator';
import { instructionLeakageValidator } from './validators/instructionLeakage';
import { killPhrasesValidator } from './validators/killPhrases';
import { modeComplianceValidator } from './validators/modeCompliance';
import { momentPageWindowValidator } from './validators/momentPageWindow';
import { namePersonalizationValidator } from './validators/namePersonalization';
import { narrativeVoiceConsistencyValidator } from './validators/narrativeVoiceConsistency';
import { pageCountValidator } from './validators/pageCount';
import { pageDepthMinimumValidator } from './validators/pageDepthMinimum';
import { pageLengthSpikeValidator } from './validators/pageLengthSpike';
import { pageSequenceValidator } from './validators/pageSequence';
import { procedureMomentSpreadValidator } from './validators/procedureMomentSpread';
import { recipeContractValidator } from './validators/recipeContract';
import { repairRegressionValidator } from './validators/repairRegression';
import { temporalContradictionValidator } from './validators/temporalContradiction';
import { unicodeEscapesValidator } from './validators/unicodeEscapes';
import { visualVarietyValidator } from './validators/visualVariety';
import type { StoryValidator } from './types';

export { parseStoryMarkdown } from './parser';
export type {
  Finding,
  ParsedStory,
  ValidationInput,
  ValidationReport,
  ValidationMode,
  StoryDirection,
  StoryPageCount,
  RecipeContract,
  RecipeContractPage,
} from './types';

const ALL_VALIDATORS: StoryValidator[] = [
  foreignCharsValidator,
  unicodeEscapesValidator,
  errorNotesValidator,
  pageCountValidator,
  pageSequenceValidator,
  frontmatterConsistencyValidator,
  imageDirectionValidator,
  genderConsistencyValidator,
  companionNameValidator,
  forbiddenAnatomyValidator,
  forbiddenObjectsValidator,
  forbiddenToneValidator,
  killPhrasesValidator,
  hookAppearancesValidator,
  momentPageWindowValidator,
  namePersonalizationValidator,
  companionPresenceValidator,
  visualVarietyValidator,
  directTherapyLanguageValidator,
  // v0.3.2 — children's-book literary quality gates
  narrativeVoiceConsistencyValidator,
  temporalContradictionValidator,
  pageLengthSpikeValidator,
  // v0.3.4 — page density floor per age tier
  pageDepthMinimumValidator,
  // v0.3.5 — procedure beats must spread across pages (phase-aware: skips bedtime)
  procedureMomentSpreadValidator,
  // v0.3.6 — meta-instruction leakage + companion-speech violation
  instructionLeakageValidator,
  companionSpeechViolationValidator,
  repairRegressionValidator,
  modeComplianceValidator,
  // v0.5a #177 — Recipe contract: forbiddenPatterns + per-page
  // mustInclude / mustNotInclude. No-op for non-recipe stories.
  recipeContractValidator,
];

function summarize(findings: Finding[]): ValidationReport['summary'] {
  return findings.reduce(
    (acc, f) => {
      if (f.severity === 'BLOCKING') acc.blocking++;
      else if (f.severity === 'WARNING') acc.warnings++;
      else acc.notes++;
      return acc;
    },
    { blocking: 0, warnings: 0, notes: 0 }
  );
}

/**
 * Validates a generated story markdown file against QA rules.
 * Parser runs first; validators only scan their designated zones.
 */
export function validateStory(input: ValidationInput): ValidationReport {
  const parsed = parseStoryMarkdown(input.storyMarkdown);
  const previousParsed = input.previousVersion
    ? parseStoryMarkdown(input.previousVersion.storyMarkdown)
    : undefined;

  const ctx: ValidatorContext = { parsed, input, previousParsed };
  const findings: Finding[] = [];

  for (const validator of ALL_VALIDATORS) {
    if (validator.modes && !validator.modes.includes(input.mode)) continue;
    findings.push(...validator.run(ctx));
  }

  const summary = summarize(findings);
  const verdict = summary.blocking > 0 ? 'FAIL' : 'PASS';

  return { verdict, summary, findings };
}

export const VALIDATOR_IDS = ALL_VALIDATORS.map((v) => v.id);
