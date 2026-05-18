export type StoryDirection = 'bedtime' | 'adventure' | 'fantasy';
export type StoryPageCount = 10 | 15 | 20;
export type ChildGender = 'boy' | 'girl' | 'other';
export type ValidationMode = 'production' | 'repair';
export type FindingSeverity = 'BLOCKING' | 'WARNING' | 'NOTE';

export interface ParsedStory {
  frontmatter: Record<string, unknown>;
  pages: Array<{
    pageNumber: number;
    imageDirection: string;
    text: string;
  }>;
}

export interface ValidationInput {
  storyMarkdown: string;
  context: {
    companionId: string;
    direction: StoryDirection;
    pageCount: StoryPageCount;
    childName: string;
    childGender: ChildGender;
    childAge: number;
    declared: {
      moment: {
        page: number;
        type?: 'touch' | 'transformation' | 'discovery' | 'comic_failure' | 'sacrifice' | 'naming';
        physicalAction?: string;
        companionSignature?: string;
      };
      hook: {
        sound?: string;
        phrase?: string;
        microAction?: string;
        object?: string;
        appearsOnPages: number[];
      };
    };
  };
  mode: ValidationMode;
  previousVersion?: {
    storyMarkdown: string;
    preserveList: string[];
    changeOnly: number[];
  };
}

export interface Finding {
  validator: string;
  severity: FindingSeverity;
  message: string;
  page?: number;
  excerpt?: string;
  suggestion?: string;
}

export interface ValidationReport {
  verdict: 'PASS' | 'FAIL';
  summary: {
    blocking: number;
    warnings: number;
    notes: number;
  };
  findings: Finding[];
}

export interface ValidatorContext {
  parsed: ParsedStory;
  input: ValidationInput;
  previousParsed?: ParsedStory;
}

export type StoryValidator = {
  id: string;
  /** If set, only runs in these modes. */
  modes?: ValidationMode[];
  run: (ctx: ValidatorContext) => Finding[];
};
