import {
  CANDIDATE_EVIDENCE_VERSION,
  type StorySourceIdentity,
} from './types';

export interface CandidateEvidenceBinding {
  version: typeof CANDIDATE_EVIDENCE_VERSION;
  storyKey: string;
  storySource: StorySourceIdentity;
  sourceInputDigest: string;
  templateDigest: string;
}

const START = `<!-- ${CANDIDATE_EVIDENCE_VERSION}`;
const END = '-->';

export function renderCandidateEvidenceHeader(binding: CandidateEvidenceBinding): string {
  return `${START}\n${JSON.stringify(binding)}\n${END}\n\n`;
}

export function parseCandidateEvidenceHeader(review: string): CandidateEvidenceBinding | null {
  if (!review.startsWith(START)) return null;
  const end = review.indexOf(END);
  if (end < 0) return null;
  const payload = review.slice(START.length, end).trim();
  try {
    const parsed = JSON.parse(payload) as Partial<CandidateEvidenceBinding>;
    if (
      parsed.version !== CANDIDATE_EVIDENCE_VERSION ||
      typeof parsed.storyKey !== 'string' ||
      !parsed.storySource ||
      typeof parsed.sourceInputDigest !== 'string' ||
      typeof parsed.templateDigest !== 'string'
    ) {
      return null;
    }
    return parsed as CandidateEvidenceBinding;
  } catch {
    return null;
  }
}
