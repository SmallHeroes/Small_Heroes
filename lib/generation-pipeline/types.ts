import type { Companion } from '@/lib/companions';
import type { BookPageTemplate } from '@/lib/bookPageLayout';

export type PipelineCache = {
  storyFilePath?: string;
  storyBankVersion?: 'v3' | 'v1';
  selectionFilename?: string;
  directionForV3?: 'bedtime' | 'adventure' | 'fantasy';
  challengeCategory?: string;
  /** Dev story-bank: direct file path already loaded */
  devStoryBankFile?: string;
  devSkipCover?: boolean;
  lockedChildDescription?: string;
  childPhotoDescription?: string | null;
  dna?: {
    childDNA: string;
    companionDNA: string;
    childStructured?: {
      face: string;
      hair: string;
      body: string;
      clothing: string;
      signature: string;
    };
    companionStructured?: {
      species: string;
      size: string;
      coloring: string;
      feature: string;
    };
    propDNA?: Record<string, string>;
    negativeRules?: string[];
    worldDNA?: string;
  };
};

export type ChunkProcessResult = {
  stage: string;
  done: boolean;
  stopChunk: boolean;
  error?: string;
};

export type PageForGeneration = {
  pageTemplate: BookPageTemplate;
  pageNumber: number;
  imagePrompt: string;
  rawScenePrompt?: string;
  bookPageText?: string;
  imageSubject?: string;
  pageIntent?: unknown;
  composition?: Record<string, string>;
  compositionRules?: string;
  environmentContinuity?: string;
  expectedCharacterIds?: string[];
  supportingCharacters?: Array<{
    name: string;
    description: string;
    relationship?: string;
  }>;
  visualDirection?: unknown;
};

export type ResolvedCompanionRef = Companion | null;
