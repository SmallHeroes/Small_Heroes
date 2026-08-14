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
type IsNever<T> = [T] extends [never] ? true : false;
type CompletedVariant = Extract<StoryCall, { terminal?: false }>;
type TerminalVariant = Extract<StoryCall, { terminal: true }>;
type CompletedVariantMustExist = Assert<IsNever<CompletedVariant> extends false ? true : false>;
type TerminalVariantMustExist = Assert<IsNever<TerminalVariant> extends false ? true : false>;
type TerminalVariantCannotExposeOutput = Assert<
  TerminalVariant extends { output: unknown } ? false : true
>;
type CompletedVariantMustExposeOutput = Assert<
  CompletedVariant extends { output: ContentAddressedArtifact } ? true : false
>;
type CompletedVariantMustExposeReceipt = Assert<
  CompletedVariant extends { receipt: ContentAddressedArtifact } ? true : false
>;
type TerminalVariantMustExposeReceipt = Assert<
  TerminalVariant extends { receipt: ContentAddressedArtifact } ? true : false
>;

export type StoryCallStaticContract =
  | CompletedVariantMustExist
  | TerminalVariantMustExist
  | TerminalVariantCannotExposeOutput
  | CompletedVariantMustExposeOutput
  | CompletedVariantMustExposeReceipt
  | TerminalVariantMustExposeReceipt;
