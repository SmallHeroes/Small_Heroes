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

/**
 * Minimal view of a Production Recipe the validators need.
 *
 * Defined HERE (not imported from story-generator) to keep the validators
 * package free of a back-dependency on the generator. The generator's
 * ProductionRecipe is structurally compatible — it maps into this shape.
 */
export interface RecipeContractPage {
  page: number;
  /** Tokens that must appear in this page's prose. */
  mustInclude: string[];
  /** Tokens forbidden on this specific page. */
  mustNotInclude: string[];
}

export interface RecipeContract {
  id: string;
  /** Patterns forbidden anywhere in the book. */
  forbiddenPatterns: string[];
  pages: RecipeContractPage[];
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
    /**
     * v0.5a #177 — present only for recipe-mode stories. When set, the
     * recipeContract validator enforces the Recipe's forbiddenPatterns +
     * per-page mustInclude / mustNotInclude. Absent for legacy stories.
     */
    recipe?: RecipeContract;
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
