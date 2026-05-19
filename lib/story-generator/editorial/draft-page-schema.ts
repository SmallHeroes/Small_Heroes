/**
 * v0.4 — Page-Structured Author.
 *
 * The Author returns JSON, not free-form markdown. Each page is a typed
 * object with hard caps on word count and sentence count. Code assembles
 * the final markdown.
 *
 * Why this exists: in v0.3.x batches, the LLM consistently dumped 30-90
 * Hebrew words onto "important" pages even when the prompt asked for
 * brevity. Free-form markdown gave no structural lever to enforce the cap.
 * In v0.4, the schema IS the lever — the page can't exceed maxWords
 * because we validate it at parse time and reject the entire output.
 */
import { z } from 'zod';

/** Per-page output from the structured Author. */
export const DraftPageSchema = z.object({
  page: z.number().int().min(1),
  /** What the Plan said this page is for — echoed back for verification. */
  purpose: z.string().min(1).max(160),
  /** Hebrew prose, one sentence per array entry. Code joins with newlines. */
  textSentences: z.array(z.string().min(1).max(160)).min(1).max(5),
  /** English-only image direction (parser separates this from prose). */
  imageDirection: z.string().min(1).max(400),
});

export const DraftFrontmatterSchema = z.object({
  title: z.string().min(1).max(80),
  // Other frontmatter fields are forced by code (enforceCanonicalFrontmatter)
  // so the model only authors the title here.
});

export const StructuredDraftOutputSchema = z.object({
  frontmatter: DraftFrontmatterSchema,
  pages: z.array(DraftPageSchema).min(1),
});

export type DraftPage = z.infer<typeof DraftPageSchema>;
export type DraftFrontmatter = z.infer<typeof DraftFrontmatterSchema>;
export type StructuredDraftOutput = z.infer<typeof StructuredDraftOutputSchema>;

/**
 * Blueprint passed from Plan/Draft-orchestrator to the LLM.
 * The LLM sees one blueprint entry per page and must fill in textSentences
 * within the maxWords + maxSentences cap.
 */
export interface PageBlueprint {
  page: number;
  /** Short label the Author should fulfill. */
  purpose: string;
  /** Target Hebrew word count — Author should aim near this. */
  targetWords: number;
  /** Maximum allowed Hebrew word count. Hard cap. */
  maxWords: number;
  /** Maximum sentences in textSentences array. Hard cap. */
  maxSentences: number;
  /** Whether the companion must physically appear on this page. */
  requiredCompanionPresence: boolean;
  /**
   * v0.4.3 — How the companion requirement is enforced:
   *   - 'per-page': companion must appear in THIS page's prose.
   *   - 'cumulative-by': companion must appear in ANY page from 1..this.page.
   *
   * Adventure uses 'cumulative-by' on page 2 (Bolly must appear by p2 but it
   * can be in p1 OR p2). Fantasy uses 'per-page' on p1+p2 (both strict).
   *
   * Default = 'per-page' when undefined.
   */
  companionRequirementMode?: 'per-page' | 'cumulative-by';
  /**
   * Anchor object/phrase that MUST appear in this page's prose.
   * E.g., "מדחום" / "מדבקה" / "טוּמְפּ" / "בפנים היה חם".
   */
  requiredAnchor?: string;
}

export interface BlueprintValidationFinding {
  page: number;
  rule: 'too-many-words' | 'too-many-sentences' | 'missing-anchor' | 'missing-companion' | 'page-mismatch';
  detail: string;
}
