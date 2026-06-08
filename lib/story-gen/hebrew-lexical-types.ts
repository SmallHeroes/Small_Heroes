/**
 * Hebrew lexical gate — severity tiers and domains (Step 4.3 calibration).
 */

export type HebrewLexicalSeverity = 'BLOCKER' | 'REVIEW' | 'ALLOW';

export type HebrewLexicalDomain =
  | 'non_word'
  | 'malformed_inflection'
  | 'broken_chip_word'
  | 'unnatural_phrase'
  | 'age_inappropriate_register'
  | 'allowed_sound_word'
  | 'companion_name'
  | 'placeholder_or_chip'
  | 'valid_nikud_form';

export type HebrewLexicalHitSource = 'deterministic' | 'llm';

export interface HebrewLexicalHit {
  page: number;
  original: string;
  issue: string;
  suggestedMinimalFix: string;
  source: HebrewLexicalHitSource;
  severity?: HebrewLexicalSeverity;
  domain?: HebrewLexicalDomain;
}

export interface HebrewLexicalFinding extends HebrewLexicalHit {
  severity: HebrewLexicalSeverity;
  domain: HebrewLexicalDomain;
}
