/**
 * Y-lite — schemas for the two new reviewers.
 *
 * Each reviewer returns its own 6-dim scores. The combine step maps both
 * into a single EditorialReportRuntime so downstream (orchestrator, summary,
 * repair) stays unchanged.
 */
import { z } from 'zod';

const ReviewerVerdict = z.enum(['PASS', 'WEAK', 'FAIL']);

const SharedIssue = z.object({
  page: z.number().int().min(0),
  severity: z.enum(['BLOCKING', 'MAJOR', 'MINOR']),
  quote: z.string().min(1).max(400),
  suggestion: z.string().min(1).max(500),
  explanation: z.string().min(1).max(400),
});

export const BookEditorDimensions = z.enum([
  'naturalHebrew',
  'pageRhythm',
  'readAloud',
  'wordDensity',
  'endingFit',
  'childWouldAskAgain',
]);

export const BookEditorIssueSchema = SharedIssue.extend({
  dimension: BookEditorDimensions,
});

export const BookEditorReportSchema = z.object({
  verdict: ReviewerVerdict,
  scores: z.object({
    naturalHebrew: z.number().int().min(1).max(5),
    pageRhythm: z.number().int().min(1).max(5),
    readAloud: z.number().int().min(1).max(5),
    wordDensity: z.number().int().min(1).max(5),
    endingFit: z.number().int().min(1).max(5),
    childWouldAskAgain: z.number().int().min(1).max(5),
  }),
  issues: z.array(BookEditorIssueSchema),
});

export const ResilienceDimensions = z.enum([
  'categoryFit',
  'childFacedDifficulty',
  'companionMechanicVisible',
  'companionIrreplaceable',
  'mirrorMomentExists',
  'residueResilient',
]);

export const ResilienceIssueSchema = SharedIssue.extend({
  dimension: ResilienceDimensions,
});

export const ResilienceReportSchema = z.object({
  verdict: ReviewerVerdict,
  scores: z.object({
    categoryFit: z.number().int().min(1).max(5),
    childFacedDifficulty: z.number().int().min(1).max(5),
    companionMechanicVisible: z.number().int().min(1).max(5),
    companionIrreplaceable: z.number().int().min(1).max(5),
    mirrorMomentExists: z.number().int().min(1).max(5),
    residueResilient: z.number().int().min(1).max(5),
  }),
  issues: z.array(ResilienceIssueSchema),
});

export type BookEditorReport = z.infer<typeof BookEditorReportSchema>;
export type ResilienceReport = z.infer<typeof ResilienceReportSchema>;
export type ReviewerVerdictT = z.infer<typeof ReviewerVerdict>;
