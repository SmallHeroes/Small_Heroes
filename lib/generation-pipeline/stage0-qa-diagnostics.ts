export const STAGE0_DESCRIPTION_TEMPLATE_QA_DIAGNOSTICS_VERSION =
  'stage0-description-template-candidate-qa/v1' as const;

export const STAGE0_DESCRIPTION_TEMPLATE_QA_REASON_VALUES = [
  'vision_description_missing',
  'gender_mismatch',
  'hair_trait_missing',
  'face_detect_low',
  'style_mismatch',
  'style_photoreal',
  'style_portrait',
  'style_evidence_unavailable',
] as const;

export type Stage0DescriptionTemplateQaReason =
  (typeof STAGE0_DESCRIPTION_TEMPLATE_QA_REASON_VALUES)[number];

export type Stage0DescriptionTemplateCandidateQaDiagnostics = {
  version: typeof STAGE0_DESCRIPTION_TEMPLATE_QA_DIAGNOSTICS_VERSION;
  reasonCodes: Stage0DescriptionTemplateQaReason[];
  styleNotes: string | null;
};

type DescriptionTemplateQaInput = {
  anchorVisionDescription: string | null | undefined;
  semantic: {
    genderMismatch: boolean;
    missingHairTraits: readonly string[];
    faceDetectOk: boolean;
  };
  styleQa: {
    style01Match: boolean;
    looksPhotoreal: boolean;
    looksPortrait: boolean;
    notes: string;
  };
};

const EXACT_DIAGNOSTIC_KEYS = ['reasonCodes', 'styleNotes', 'version'] as const;
const MAX_STYLE_NOTE_CODE_POINTS = 240;
const STYLE_EVIDENCE_UNAVAILABLE = /(?:skipped|style qa http|style qa error)/i;
const URL_OR_EMAIL = /(?:https?:\/\/|www\.)\S+|\b[^\s@]+@[^\s@]+\.[^\s@]+\b/giu;
const SECRET_LIKE_TOKEN = /\b(?:sk|pk|api)[-_][a-z0-9_-]{8,}\b|\b[a-f0-9]{32,}\b/giu;

export function stage0StyleQaEvidenceIsUnavailable(notes: string): boolean {
  return STYLE_EVIDENCE_UNAVAILABLE.test(notes);
}

export function sanitizeStage0StyleQaNotes(notes: string): string | null {
  const normalized = notes
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ')
    .replace(URL_OR_EMAIL, '[redacted]')
    .replace(SECRET_LIKE_TOKEN, '[redacted]')
    .replace(/\s+/gu, ' ')
    .replace(/\s+([,.;:!?])/gu, '$1')
    .trim();
  if (!normalized) return null;
  return Array.from(normalized).slice(0, MAX_STYLE_NOTE_CODE_POINTS).join('');
}

export function buildStage0DescriptionTemplateQaDiagnostics(
  input: DescriptionTemplateQaInput
): Stage0DescriptionTemplateCandidateQaDiagnostics {
  const reasonCodes: Stage0DescriptionTemplateQaReason[] = [];
  if (!input.anchorVisionDescription?.trim()) reasonCodes.push('vision_description_missing');
  if (input.semantic.genderMismatch) reasonCodes.push('gender_mismatch');
  if (input.semantic.missingHairTraits.length > 0) reasonCodes.push('hair_trait_missing');
  if (!input.semantic.faceDetectOk) reasonCodes.push('face_detect_low');
  if (!input.styleQa.style01Match) reasonCodes.push('style_mismatch');
  if (input.styleQa.looksPhotoreal) reasonCodes.push('style_photoreal');
  if (input.styleQa.looksPortrait) reasonCodes.push('style_portrait');
  if (stage0StyleQaEvidenceIsUnavailable(input.styleQa.notes)) {
    reasonCodes.push('style_evidence_unavailable');
  }
  return {
    version: STAGE0_DESCRIPTION_TEMPLATE_QA_DIAGNOSTICS_VERSION,
    reasonCodes,
    styleNotes: sanitizeStage0StyleQaNotes(input.styleQa.notes),
  };
}

export function stage0DescriptionTemplateQaDiagnosticsIsValid(
  value: unknown
): value is Stage0DescriptionTemplateCandidateQaDiagnostics {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(record).sort()) !==
    JSON.stringify([...EXACT_DIAGNOSTIC_KEYS])
  ) {
    return false;
  }
  if (record.version !== STAGE0_DESCRIPTION_TEMPLATE_QA_DIAGNOSTICS_VERSION) return false;
  if (record.styleNotes !== null) {
    if (typeof record.styleNotes !== 'string') return false;
    if (sanitizeStage0StyleQaNotes(record.styleNotes) !== record.styleNotes) return false;
  }
  if (!Array.isArray(record.reasonCodes)) return false;
  const reasonCodes = record.reasonCodes;
  const expected = STAGE0_DESCRIPTION_TEMPLATE_QA_REASON_VALUES.filter((reason) =>
    reasonCodes.includes(reason)
  );
  return (
    reasonCodes.every((reason) =>
      STAGE0_DESCRIPTION_TEMPLATE_QA_REASON_VALUES.includes(
        reason as Stage0DescriptionTemplateQaReason
      )
    ) && JSON.stringify(reasonCodes) === JSON.stringify(expected)
  );
}

export function stage0DescriptionTemplateQaDiagnosticsMatchCandidate(input: {
  diagnostics: Stage0DescriptionTemplateCandidateQaDiagnostics;
  semanticPass: boolean | undefined;
  stylePass: boolean | undefined;
  passed: boolean | undefined;
}): boolean {
  if (!stage0DescriptionTemplateQaDiagnosticsIsValid(input.diagnostics)) return false;
  const semanticReasons: readonly Stage0DescriptionTemplateQaReason[] = [
    'vision_description_missing',
    'gender_mismatch',
    'hair_trait_missing',
    'face_detect_low',
  ];
  const styleReasons: readonly Stage0DescriptionTemplateQaReason[] = [
    'style_mismatch',
    'style_photoreal',
    'style_portrait',
    'style_evidence_unavailable',
  ];
  const semanticPassed = !input.diagnostics.reasonCodes.some((reason) =>
    semanticReasons.includes(reason)
  );
  const stylePassed = !input.diagnostics.reasonCodes.some((reason) =>
    styleReasons.includes(reason)
  );
  return (
    input.semanticPass === semanticPassed &&
    input.stylePass === stylePassed &&
    input.passed === (semanticPassed && stylePassed)
  );
}

export function summarizeStage0DescriptionTemplateQaReasons(
  diagnostics: readonly Stage0DescriptionTemplateCandidateQaDiagnostics[]
): Stage0DescriptionTemplateQaReason[] {
  return STAGE0_DESCRIPTION_TEMPLATE_QA_REASON_VALUES.filter((reason) =>
    diagnostics.some((item) => item.reasonCodes.includes(reason))
  );
}

export function formatStage0DescriptionTemplateQaBudgetFailure(input: {
  diagnostics: readonly Stage0DescriptionTemplateCandidateQaDiagnostics[];
  attemptsUsed: number;
  maxAttempts: number;
}): string {
  const reasons = summarizeStage0DescriptionTemplateQaReasons(input.diagnostics);
  return (
    'ANCHOR_QA_BLOCK: description-template child anchor did not pass semantic and style QA ' +
    `within the bounded attempt budget (attempts=${input.attemptsUsed}/${input.maxAttempts} ` +
    `reasonCodes=${reasons.join('|') || 'none'})`
  );
}
