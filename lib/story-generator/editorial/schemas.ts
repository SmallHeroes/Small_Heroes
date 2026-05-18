import { z } from 'zod';

export const EditorialReasonSchema = z.enum([
  'broken_hebrew',
  'semantic_nonsense',
  'read_aloud_stumble',
  'too_abstract_for_age',
  'direction_drift',
  'object_drift',
  'companion_drift',
  'companion_name_repeat',
  'metadata_inconsistency',
  'image_direction_mismatch',
  'wrong_ending',
]);

export const EditorialIssueSchema = z
  .object({
    // v0.2.4: page 0 allowed when field === 'frontmatter' (frontmatter has no page number).
    // Editor correctly flags direction_drift / metadata_inconsistency with page:0+field:frontmatter;
    // the prior schema rejected these as Zod-invalid and we lost the signal.
    page: z.number().int().min(0),
    field: z.enum(['body', 'imageDirection', 'frontmatter']),
    severity: z.enum(['BLOCKING', 'MAJOR', 'MINOR']),
    reason: EditorialReasonSchema,
    quote: z.string().min(1),
    suggestion: z.string().min(1),
    explanation: z.string().min(1),
  })
  .refine((data) => data.page >= 1 || data.field === 'frontmatter', {
    message: 'page must be >= 1 unless field is "frontmatter"',
    path: ['page'],
  });

export const EditorialReportSchema = z.object({
  scores: z.object({
    naturalHebrew: z.number().int().min(1).max(5),
    directionFit: z.number().int().min(1).max(5),
    motifConsistency: z.number().int().min(1).max(5),
    continuity: z.number().int().min(1).max(5),
    readAloud: z.number().int().min(1).max(5),
    ageFit: z.number().int().min(1).max(5),
  }),
  issues: z.array(EditorialIssueSchema),
  verdict: z.enum(['READY', 'NEEDS_REPAIR', 'REJECT']),
});

export type EditorialReason = z.infer<typeof EditorialReasonSchema>;
export type EditorialIssue = z.infer<typeof EditorialIssueSchema>;
export type EditorialReport = z.infer<typeof EditorialReportSchema>;

/** Runtime fields — added AFTER Zod parse, never in LLM schema. */
export type EditorialIssueRuntime = EditorialIssue & {
  _unmatchedQuote?: boolean;
  _source?: 'scanner' | 'llm' | 'merged';
  _repairedDeterministically?: boolean;
  _ambiguousReplacement?: boolean;
};

export type EditorialReportRuntime = Omit<EditorialReport, 'issues'> & {
  issues: EditorialIssueRuntime[];
};
