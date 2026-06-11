/**
 * Power Card — shared types (inline frontmatter + future catalog).
 */

export interface PowerCardSpec {
  /** Raw title with {{childName}} placeholder */
  title: string;
  /** Raw subtitle with /ה slash personalization */
  subtitle: string;
  /** Internal English label for tooling */
  coreTool: string;
  steps: [string, string, string, string];
  companionReminder: string;
  /** 3–5 English visual hooks for design/dev */
  visualMotifs:
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string];
}

export type PowerCardPalette = 'moonlit' | 'earth-warm' | 'magical-cool';

/** Render input — used by preview/export in later PRs; defined here for catalog compatibility. */
export interface PowerCardRenderInput {
  spec: PowerCardSpec;
  childName: string;
  childGender: 'male' | 'female';
  companionName: string;
  companionAvatarUrl: string;
  palette: PowerCardPalette;
  bookTitle?: string;
}

export interface StoryFrontmatterPowerCardSource {
  powerCard?: unknown;
  powerCardId?: unknown;
}

export type PowerCardIssueSeverity = 'error' | 'warning';

export interface PowerCardValidationIssue {
  path: string;
  severity: PowerCardIssueSeverity;
  message: string;
}

export interface ParsedStoryPowerCard {
  slug: string;
  spec: PowerCardSpec | null;
  issues: PowerCardValidationIssue[];
}
