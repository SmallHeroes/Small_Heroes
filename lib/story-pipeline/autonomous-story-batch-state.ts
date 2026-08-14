export type ContentAddressedArtifact = Readonly<{
  filename: string;
  sha256: string;
  bytes: number;
}>;

export type CompletedStoryCall = Readonly<{
  stage: string;
  terminal?: false;
  output: ContentAddressedArtifact;
  receipt: ContentAddressedArtifact;
  costUsd: number;
}>;

export type TerminalStoryCall = Readonly<{
  stage: string;
  terminal: true;
  receipt: ContentAddressedArtifact;
  costUsd: number;
}>;

export type StoryCall = CompletedStoryCall | TerminalStoryCall;

export type StoryInflightCall = Readonly<{
  stage: string;
  promptSha256: string;
}>;

export type StoryState = {
  status: 'in_progress' | 'machine_qualified' | 'hold';
  identity: Record<string, unknown>;
  calls: StoryCall[];
  selectedOptionId: string | null;
  revisionCount: number;
  inflight: StoryInflightCall | null;
  reasonCode?: string;
  editorialVerdict?: 'pass';
  finalStory?: ContentAddressedArtifact;
};

export type AutonomousStoryBatchManifest = {
  version: string;
  status: 'in_progress' | 'machine_qualified' | 'completed_with_holds';
  authorityStatus: 'machine_qualified_staging_only';
  model: string;
  serviceTier: string;
  store: false;
  repoHead: string;
  briefIds: string[];
  maxCostUsd: number;
  actualCostUsd: number;
  logicalProviderCalls: number;
  transportRetries: 0;
  fallbackUsed: false;
  resumeCount: number;
  credentialAccess: 'supervisor_child_only';
  stories: Record<string, StoryState>;
  authorityDigests: Record<string, Readonly<{ path: string; sha256: string }>>;
};

type Assert<T extends true> = T;
type TerminalVariantCannotExposeOutput = Assert<
  Extract<StoryCall, { terminal: true }> extends { output: unknown } ? false : true
>;
type CompletedVariantMustExposeOutput = Assert<
  Extract<StoryCall, { terminal?: false }> extends { output: ContentAddressedArtifact }
    ? true
    : false
>;

export type StoryCallStaticContract =
  | TerminalVariantCannotExposeOutput
  | CompletedVariantMustExposeOutput;
