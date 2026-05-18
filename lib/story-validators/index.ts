import { parseStoryMarkdown } from './parser';
import type { Finding, ValidationInput, ValidationReport, ValidatorContext } from './types';
import { companionNameValidator } from './validators/companionName';
import { companionPresenceValidator } from './validators/companionPresence';
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
import { killPhrasesValidator } from './validators/killPhrases';
import { modeComplianceValidator } from './validators/modeCompliance';
import { momentPageWindowValidator } from './validators/momentPageWindow';
import { namePersonalizationValidator } from './validators/namePersonalization';
import { pageCountValidator } from './validators/pageCount';
import { pageSequenceValidator } from './validators/pageSequence';
import { repairRegressionValidator } from './validators/repairRegression';
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
  repairRegressionValidator,
  modeComplianceValidator,
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
