import { stripNikud } from '@/lib/story-validators/utils';
import { parseStoryMarkdown, type ValidationReport } from '@/lib/story-validators';
import { getCompanionBible } from '@/lib/companion-bible';
import { buildRepairPatchSystemPrompt, buildRepairPatchUserPrompt } from '../prompts/repair-prompt';
import type { Plan } from '../types';
import { getDefaultLLM, parseJsonFromLLM, type StoryGeneratorLLM } from '../llm';
import { rebuildStoryMarkdown, pagesFromParsed } from '../markdown';

interface RepairedPagePayload {
  pageNumber: number;
  text: string;
  imageDirection?: string;
}

interface RepairedPagesResponse {
  pages: RepairedPagePayload[];
}

/**
 * v0.2.1: Builds preserveList anchors — short atomic tokens only.
 *
 * Prior version returned descriptions like "Moment on page 6: ..." which never matched.
 * v0.2 used physicalAction/companionSignature first-clauses — still too long, LLM
 * rephrased them. v0.2.1 returns ONLY tokens that WILL appear verbatim in prose:
 * - canonical companion name (stripped of nikud)
 * - hook.sound (atomic, e.g. "טוּמְפּ")
 * - hook.phrase (short, e.g. "בפנים היה חם")
 * - hook.object (single noun, e.g. "המדבקה")
 */
export function buildPreserveList(plan: Plan, companionId?: string): string[] {
  const hook = plan.hookContract;
  const anchors = new Set<string>();

  // Canonical companion name as it'll actually appear in prose (no nikud)
  if (companionId) {
    const bible = getCompanionBible(companionId);
    if (bible) {
      anchors.add(stripNikud(bible.nameClean));
    }
  }

  // Hook atoms — these are short by Plan contract (v0.2 enforced)
  if (hook.sound && hook.sound.length <= 12) anchors.add(stripNikud(hook.sound));
  if (hook.phrase && hook.phrase.length <= 30) anchors.add(stripNikud(hook.phrase));
  if (hook.object && hook.object.length <= 20) anchors.add(stripNikud(hook.object));
  // microAction omitted — too narrative to anchor

  // Seeds from plan — REJECT long/multi-word phrases.
  // v0.2.2: anchors must be atomic. "בולי נסגר לכדור" is too phrasey — the LLM
  // can rephrase to "בולי התקפל לכדור" and the verbatim anchor fails. Keep only
  // single-word or short-2-word noun phrases (≤12 chars stripped).
  for (const seed of plan.preserveListSeeds) {
    const cleaned = stripNikud(seed.trim());
    if (cleaned.length < 3) continue;
    if (cleaned.length > 12) continue; // too long → not a reliable anchor
    const wordCount = cleaned.split(/\s+/).length;
    if (wordCount > 2) continue; // multi-word verb phrases drift in prose
    anchors.add(cleaned);
  }

  return [...anchors].filter((a) => a.length >= 2);
}

/**
 * v0.2.1: changeOnly is union of:
 * - all pages with BLOCKING findings that have a page number
 * - if the most recent repair already broke modeCompliance pages, include those too
 * - structural (no page) → allow page 1 (frontmatter)
 */
export function buildChangeOnly(report: ValidationReport): number[] {
  const pages = new Set<number>();
  for (const f of report.findings) {
    if (f.severity === 'BLOCKING' && typeof f.page === 'number') {
      pages.add(f.page);
    }
  }
  if (pages.size === 0) {
    const structural = report.findings.some((f) =>
      ['pageCount', 'pageSequence'].includes(f.validator)
    );
    if (structural) return [1];
  }
  return [...pages].sort((a, b) => a - b);
}

/**
 * Stage E v0.2.1: PATCH-MERGE REPAIR.
 *
 * The previous approach asked the LLM to return the full story markdown and
 * trusted it not to modify non-changeOnly pages. In production batches the
 * LLM consistently violated this, cascading modeCompliance failures.
 *
 * New approach:
 * 1. Parse the previous story into typed pages.
 * 2. Ask the LLM to return ONLY the repaired pages (JSON: {pages: [{pageNumber, text, imageDirection}]}).
 * 3. In code, replace ONLY the changeOnly pages; keep all others byte-for-byte from the original.
 * 4. Rebuild markdown.
 *
 * This makes byte-for-byte preservation a code guarantee, not a prompt request.
 */
export async function runRepair(
  previousStory: string,
  report: ValidationReport,
  plan: Plan,
  attempt: number,
  llm: StoryGeneratorLLM = getDefaultLLM(),
  companionId?: string
): Promise<{
  storyMarkdown: string;
  preserveList: string[];
  changeOnly: number[];
  llmCostUsd: number;
  modelVersion: string;
}> {
  const preserveList = buildPreserveList(plan, companionId);
  const changeOnly = buildChangeOnly(report);
  const parsedPrev = parseStoryMarkdown(previousStory);

  // No pages to change → return previous unchanged (validators will FAIL again, but
  // at least we don't synthesize a worse version).
  if (changeOnly.length === 0) {
    return {
      storyMarkdown: previousStory,
      preserveList,
      changeOnly,
      llmCostUsd: 0,
      modelVersion: '',
    };
  }

  // Identify the pages the LLM needs to repair
  const pagesToRepair = parsedPrev.pages.filter((p) => changeOnly.includes(p.pageNumber));
  if (pagesToRepair.length === 0) {
    return {
      storyMarkdown: previousStory,
      preserveList,
      changeOnly,
      llmCostUsd: 0,
      modelVersion: '',
    };
  }

  const result = await llm.call({
    stage: `repair-${attempt}`,
    systemPrompt: buildRepairPatchSystemPrompt(),
    userPrompt: buildRepairPatchUserPrompt({
      pagesToRepair,
      report,
      preserveList,
      plan,
      attempt,
    }),
    maxOutputTokens: 4000,
    jsonMode: true,
  });

  const parsed = parseJsonFromLLM<RepairedPagesResponse>(result.text, `repair-${attempt}`);
  if (!parsed || !Array.isArray(parsed.pages)) {
    throw new Error(`[repair-${attempt}] LLM did not return {pages: [...]} JSON`);
  }

  // Build a lookup of repaired pages by number
  const repairedByPage = new Map<number, RepairedPagePayload>();
  for (const repaired of parsed.pages) {
    if (typeof repaired.pageNumber !== 'number') continue;
    if (!changeOnly.includes(repaired.pageNumber)) continue; // ignore unsolicited
    repairedByPage.set(repaired.pageNumber, repaired);
  }

  // Patch-merge: keep original for non-changeOnly, replace for changeOnly
  const mergedPages = pagesFromParsed(parsedPrev).map((page) => {
    const repaired = repairedByPage.get(page.pageNumber);
    if (!repaired) return page; // either not in changeOnly OR LLM omitted — keep original
    return {
      pageNumber: page.pageNumber,
      text: typeof repaired.text === 'string' && repaired.text.trim() ? repaired.text : page.text,
      imageDirection:
        typeof repaired.imageDirection === 'string' && repaired.imageDirection.trim()
          ? repaired.imageDirection
          : page.imageDirection,
    };
  });

  const storyMarkdown = rebuildStoryMarkdown(parsedPrev.frontmatter, mergedPages);

  return {
    storyMarkdown,
    preserveList,
    changeOnly,
    llmCostUsd: result.costUsd,
    modelVersion: result.modelVersion,
  };
}
