export interface HumanExpectedIssue {
  family: string;
  quoteContains?: string;
  page?: number | null;
  scope?: 'page' | 'story';
  optional?: boolean;
}

export interface HumanExpectedNonFinding {
  family: string;
  quoteContains?: string;
  note: string;
}

export interface HumanCalibrationNotes {
  storyId: string;
  ageTier: string;
  expectedFindings: HumanExpectedIssue[];
  expectedNonFindings?: HumanExpectedNonFinding[];
}
