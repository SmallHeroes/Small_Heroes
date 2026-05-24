/**
 * v0.4 — Structured Draft stage.
 *
 * The Author returns JSON. Code assembles the markdown. The cap on each
 * page is enforced at parse time — no amount of poetic dump can survive
 * a 32-word maxWords check.
 *
 * Same downstream interface as runDraft (returns { storyMarkdown, ... })
 * so the orchestrator pipeline is unchanged.
 */
import {
  buildStructuredDraftSystemPrompt,
  buildStructuredDraftUserPrompt,
} from '../prompts/structured-draft-prompt';
import {
  buildRecipeStructuredDraftSystemPrompt,
  buildRecipeStructuredDraftUserPrompt,
} from '../prompts/recipe-draft-prompt';
import {
  StructuredDraftOutputSchema,
  type DraftPage,
  type PageBlueprint,
  type StructuredDraftOutput,
} from '../editorial/draft-page-schema';
import { validateDraftAgainstBlueprint, hasCompanionMention } from './page-blueprint';
import type { GenerateInput, Plan } from '../types';
import { getDefaultLLM, parseJsonFromLLM, type StoryGeneratorLLM } from '../llm';
import { resolvePageCount } from '../data/direction-dna';
import { getCompanionBible } from '@/lib/companion-bible';
import type {
  ProductionRecipe,
  RecipeVariationSlots,
} from '../recipes/recipe-types';

/**
 * #169 — opt-in recipe context. When present, the Author prompt is built
 * from the Recipe's PageCards instead of the synth-Plan blueprint. The
 * Author then sees explicit dramaticRole, requiredEvent, childBodyState,
 * companionAction, mustInclude, mustNotInclude per page.
 *
 * When absent (legacy path), the existing buildStructuredDraftUserPrompt
 * is used unchanged.
 */
export interface RecipeDraftContext {
  recipe: ProductionRecipe;
  variations: Partial<Record<keyof RecipeVariationSlots, string>>;
}

/**
 * Stage C (v0.4): Plan → JSON pages → assembled Markdown.
 */
export async function runStructuredDraft(
  plan: Plan,
  input: GenerateInput,
  llm: StoryGeneratorLLM = getDefaultLLM(),
  recipeContext?: RecipeDraftContext
): Promise<{
  storyMarkdown: string;
  llmCostUsd: number;
  modelVersion: string;
  /** v0.4.6+ — telemetry: lines that code injected because the Author skipped the companion. */
  autoInjections?: AutoInjection[];
}> {
  // #169 — branch on recipe context. Either path returns the same shape
  // ({ prompt, blueprint }) so the rest of the function is unchanged.
  const built = recipeContext
    ? buildRecipeStructuredDraftUserPrompt({
        recipe: recipeContext.recipe,
        variations: recipeContext.variations,
        plan,
        input,
      })
    : buildStructuredDraftUserPrompt(plan, input);
  const { prompt, blueprint } = built;
  const systemPrompt = recipeContext
    ? buildRecipeStructuredDraftSystemPrompt()
    : buildStructuredDraftSystemPrompt();
  if (recipeContext) {
    console.log(
      `[structured-draft] recipe-mode prompt active (recipe=${recipeContext.recipe.id})`
    );
  }

  async function callOnce(retryNote?: string) {
    return llm.call({
      stage: 'draft',
      systemPrompt,
      userPrompt: retryNote ? `${prompt}\n\nRETRY NOTE: ${retryNote}` : prompt,
      maxOutputTokens: 8000,
      jsonMode: true,
    });
  }

  function tryParse(text: string): StructuredDraftOutput | null {
    try {
      const raw = parseJsonFromLLM<unknown>(text, 'structured-draft');
      const parsed = StructuredDraftOutputSchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  // First attempt
  let result = await callOnce();
  let parsed = tryParse(result.text);
  let totalCost = result.costUsd;
  let modelVersion = result.modelVersion;

  // #169 — deterministic enforcement of Recipe PageCard contracts that the
  // Author cannot be relied on to obey. Runs BEFORE blueprint validation so
  // injected lines satisfy missing-companion / missing-anchor checks.
  if (parsed && recipeContext) {
    enforceRequiredExactLines(parsed, recipeContext.recipe);
  }

  // If parse failed OR blueprint validation failed, retry with diagnostics.
  let blueprintFindings = parsed
    ? validateDraftAgainstBlueprint(parsed.pages, blueprint, input.companionId)
    : [];

  // v0.5.5e — SPLICE-SAFE RETRY. Up to MAX_RETRY_ROUNDS rounds. Each round
  // re-attempts ONLY the pages that currently fail; every other page is kept
  // byte-identical from the last good draft. The Author still returns a full
  // story, but the code splices in only the change-list pages — so a retry
  // can NEVER turn a page that passed into a new blocker. (Earlier,
  // full-story retries silently drifted unrelated pages.)
  const MAX_RETRY_ROUNDS = 2;
  for (
    let round = 1;
    (!parsed || blueprintFindings.length > 0) && round <= MAX_RETRY_ROUNDS;
    round++
  ) {
    const baseDraft = parsed;
    // Splice only when there is a base draft AND the page count is right.
    // A page-mismatch means the whole story is wrong — take the retry whole.
    const spliceable =
      baseDraft != null &&
      !blueprintFindings.some((f) => f.rule === 'page-mismatch');
    const changeList = new Set(blueprintFindings.map((f) => f.page));

    const retryReason = buildRetryMessage({
      parsed: baseDraft,
      blueprintFindings,
      expectedPageCount: blueprint.length,
    });
    console.warn(
      `[structured-draft] Retry round ${round}/${MAX_RETRY_ROUNDS} — issues:\n${retryReason}`
    );
    const retry = await callOnce(retryReason);
    totalCost += retry.costUsd;
    modelVersion = retry.modelVersion;
    const retryParsed = tryParse(retry.text);

    if (retryParsed && spliceable && baseDraft) {
      // Keep every page from the base draft EXCEPT the change-list pages,
      // which come from the retry. Cross-page drift becomes impossible.
      const merged: StructuredDraftOutput = {
        frontmatter: baseDraft.frontmatter,
        pages: baseDraft.pages.map((basePage) =>
          changeList.has(basePage.page)
            ? (retryParsed.pages.find((p) => p.page === basePage.page) ??
               basePage)
            : basePage
        ),
      };
      const splicedPages = Array.from(changeList)
        .filter((pg) => retryParsed.pages.some((p) => p.page === pg))
        .sort((a, b) => a - b);
      console.log(
        `[structured-draft] round ${round} spliced — replaced only page(s) ` +
          `[${splicedPages.join(', ')}]; all other pages kept byte-identical.`
      );
      parsed = merged;
    } else {
      // No base draft, or wrong page count — accept the retry whole.
      parsed = retryParsed;
    }

    // Re-enforce requiredExactLine on the (possibly spliced) draft.
    if (parsed && recipeContext) {
      enforceRequiredExactLines(parsed, recipeContext.recipe);
    }

    blueprintFindings = parsed
      ? validateDraftAgainstBlueprint(parsed.pages, blueprint, input.companionId)
      : [];
    if (parsed && blueprintFindings.length === 0) {
      console.log(`[structured-draft] Retry succeeded (round ${round}).`);
      result = retry;
      break;
    }
  }

  // After retry: if still no valid output, surface the error to the orchestrator.
  // The orchestrator's repair flow may still recover or mark FAILED_TECHNICAL.
  if (!parsed) {
    throw new Error('[structured-draft] LLM returned invalid JSON after retry.');
  }

  // v0.4.6 — COMPANION AUTO-INJECT before HARD GATE.
  // If the only remaining blueprint finding is "missing-companion" and the
  // page has room for one more short sentence within maxWords/maxSentences,
  // inject a CONTEXTUAL companion line (entrance / fear-object / after-mirror /
  // support-quiet). Each variant is hand-tuned per companion + page role.
  //
  // This recovers the v0.4.5 fantasy p6 case where the model dropped Bolly
  // despite explicit instructions. Code patches what the model can't.
  const autoInjections: AutoInjection[] = [];
  if (blueprintFindings.length > 0) {
    const heartPage = plan.momentContract?.page ?? Math.ceil(parsed.pages.length / 2);
    const remainingFindings: typeof blueprintFindings = [];
    for (const finding of blueprintFindings) {
      if (finding.rule === 'missing-companion') {
        const injected = tryInjectCompanionLine({
          pages: parsed.pages,
          pageNumber: finding.page,
          blueprint,
          companionId: input.companionId,
          heartPage,
        });
        if (injected.success && injected.line && injected.context) {
          autoInjections.push({
            page: finding.page,
            line: injected.line,
            context: injected.context,
            reason: 'missing-companion',
          });
          console.log(
            `[structured-draft] auto-injected companion line on page ${finding.page} (${injected.context}): "${injected.line}"`
          );
          continue; // resolved
        }
        // Couldn't inject (no room) — keep as a real failure
        remainingFindings.push(finding);
      } else {
        remainingFindings.push(finding);
      }
    }
    blueprintFindings = remainingFindings;
  }

  // v0.4.1 — HARD PRE-ASSEMBLY GATE.
  // After auto-inject, any persisting findings are real failures.
  if (blueprintFindings.length > 0) {
    const summary = blueprintFindings
      .map((f) => `  - page ${f.page} [${f.rule}]: ${f.detail}`)
      .join('\n');
    throw new Error(
      `[structured-draft] HARD GATE: blueprint violations persist after retry+auto-inject (${blueprintFindings.length}):\n${summary}\n` +
        `The Author could not satisfy the per-page caps. Refusing to assemble markdown.`
    );
  }

  const storyMarkdown = assembleMarkdown(parsed, input);

  return {
    storyMarkdown,
    llmCostUsd: totalCost,
    modelVersion,
    autoInjections: autoInjections.length > 0 ? autoInjections : undefined,
  };
}

/**
 * Assemble markdown from the structured output.
 *
 * Frontmatter is fully written here with canonical values from `input`.
 * (enforceCanonicalFrontmatter later in orchestrate is a safety net.)
 */
export function assembleMarkdown(
  parsed: StructuredDraftOutput,
  input: GenerateInput
): string {
  const pageCount = resolvePageCount(input.direction, input.pageCount);
  const bible = getCompanionBible(input.companionId);

  const lines: string[] = [];
  lines.push('---');
  lines.push(`title: ${JSON.stringify(parsed.frontmatter.title)}`);
  lines.push(`companionId: ${JSON.stringify(input.companionId)}`);
  lines.push(`canonicalName: ${JSON.stringify(bible?.nameClean ?? '')}`);
  lines.push(`direction: ${JSON.stringify(input.direction)}`);
  lines.push(`childGender: ${JSON.stringify(input.childGender)}`);
  lines.push(`pages: ${pageCount}`);
  lines.push('---');
  lines.push('');

  const sortedPages = [...parsed.pages].sort((a, b) => a.page - b.page);
  for (const page of sortedPages) {
    lines.push(`--- Page ${page.page} ---`);
    for (const sentence of page.textSentences) {
      lines.push(sentence);
    }
    lines.push('');
    lines.push(`imageDirection: ${page.imageDirection}`);
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

/**
 * v0.4.6 — Auto-inject a deterministic companion line into a page that's
 * missing the companion despite the blueprint requiring it.
 *
 * v0.4.6+ — CONTEXTUAL variants. ChatGPT noted that a single generic line
 * feels mechanical when injected mid-fantasy. Now we pick the line by the
 * page's narrative role:
 *   - entrance       (page 1-2): companion arrives
 *   - fear/object    (procedure beat zone): companion closes near obstacle
 *   - after-mirror   (heart page + 1): companion opens slightly
 *   - support/quiet  (cooldown pages near end): companion stays close
 *
 * Used as the last resort before HARD GATE. Mutates `pages[idx].textSentences`
 * IN PLACE if it can fit a short line within the maxSentences cap.
 */
type InjectContext = 'entrance' | 'fear-object' | 'after-mirror' | 'support-quiet';

const CONTEXTUAL_INJECT_LINES: Record<string, Record<InjectContext, string>> = {
  bolly_armadillo: {
    'entrance': 'בּוֹלִי התגלגל אל קצה השמיכה. טוּמְפּ.',
    'fear-object': 'בּוֹלִי נסגר לכדור קטן ליד הרגל שלה. טוּמְפּ.',
    'after-mirror': 'בּוֹלִי פתח פס שריון אחד והציץ.',
    'support-quiet': 'בּוֹלִי נשאר סגור לידה, קטן וחם.',
  },
  bat_lily: {
    'entrance': 'לִילִי תלויה הפוכה מהמדף. ששש.',
    'fear-object': 'לִילִי כיווצה כנף סביב הצעצוע. ששש.',
    'after-mirror': 'לִילִי פתחה כנף אחת. הפנס הבהב.',
    'support-quiet': 'לִילִי נחה לידה, כנף עוטפת אותה.',
  },
  chameleon_koko: {
    'entrance': 'קִים על הקיר ליד נועה. הצעיף הפסים שלה לא משתנה.',
    'fear-object': 'קִים עצרה ליד החפץ. הצבע מהמקום הקודם עוד פה.',
    'after-mirror': 'קִים פתחה עין אחת אחורה ואחת קדימה.',
    'support-quiet': 'קִים על הכרית ליד נועה. הצעיף נשאר.',
  },
};

function pickInjectContext(args: {
  pageNumber: number;
  totalPages: number;
  heartPage: number;
}): InjectContext {
  const { pageNumber, totalPages, heartPage } = args;
  if (pageNumber <= 2) return 'entrance';
  // Last 20% of story → cooldown / support
  if (pageNumber > totalPages * 0.8) return 'support-quiet';
  // The page right after the heart moment → after-mirror
  if (pageNumber === heartPage + 1 || pageNumber === heartPage + 2) return 'after-mirror';
  // Default: middle pages around the obstacle/fear
  return 'fear-object';
}

export interface AutoInjection {
  page: number;
  line: string;
  context: InjectContext;
  reason: string;
}

function tryInjectCompanionLine(args: {
  pages: DraftPage[];
  pageNumber: number;
  blueprint: PageBlueprint[];
  companionId: string;
  heartPage: number;
}): { success: boolean; line?: string; context?: InjectContext } {
  const idx = args.pages.findIndex((p) => p.page === args.pageNumber);
  if (idx < 0) return { success: false };
  const bp = args.blueprint.find((b) => b.page === args.pageNumber);
  if (!bp) return { success: false };

  const companionLines = CONTEXTUAL_INJECT_LINES[args.companionId];
  if (!companionLines) return { success: false };

  const context = pickInjectContext({
    pageNumber: args.pageNumber,
    totalPages: args.pages.length,
    heartPage: args.heartPage,
  });
  const line = companionLines[context];

  const page = args.pages[idx];
  // Refuse to inject if there's no room. Better to HARD GATE than to violate cap.
  if (page.textSentences.length >= bp.maxSentences) {
    return { success: false };
  }

  // Append to keep narrative flow ending with the companion appearance.
  page.textSentences.push(line);
  return { success: true, line, context };
}

// ─────────────────────────────────────────────────────────────────────────
// #169 — Deterministic Recipe contract enforcement.
// ─────────────────────────────────────────────────────────────────────────

/**
 * For each PageCard with `requiredExactLine`, ensure the companion is
 * physically present on that page. The PageCard's requiredExactLine is
 * the CANONICAL FALLBACK sentence used when the Author skipped the
 * companion entirely.
 *
 * v0.5.0-d (#170 polish): no longer over-replaces. The earlier behavior
 * (always inject if exact line missing) was overwriting natural Author
 * prose ("בּוֹלִי שכב קרוב לכרית, פתוח חלקית, מביט בה בשקט") with the
 * shorter canonical line — which then hurt Y-lite Book Editor scores.
 *
 * New strategy:
 *   1. If the companion is ALREADY mentioned on the page (normalized
 *      check via hasCompanionMention) → no-op. Author handled it.
 *   2. Otherwise — companion truly missing — inject the requiredExactLine
 *      as fallback. If there's room → APPEND. If full → REPLACE last.
 *
 * Mutates parsed.pages in place. Logs each intervention.
 */
function enforceRequiredExactLines(
  parsed: StructuredDraftOutput,
  recipe: import('../recipes/recipe-types').ProductionRecipe
): void {
  for (const card of recipe.pageCards) {
    const required = card.requiredExactLine?.trim();
    if (!required) continue;

    const page = parsed.pages.find((p) => p.page === card.page);
    if (!page) continue; // page-mismatch — handled elsewhere

    // #170 — preserve Author's natural prose when companion already on page.
    const pageText = page.textSentences
      .filter((s): s is string => typeof s === 'string')
      .join(' ');
    if (hasCompanionMention(pageText, recipe.companionId)) {
      continue;
    }

    // Companion is truly missing — inject the fallback line.
    if (page.textSentences.length < card.maxSentences) {
      page.textSentences.push(required);
      console.log(
        `[structured-draft] injected requiredExactLine on p${card.page} (companion missing, appended): "${required}"`
      );
    } else if (page.textSentences.length > 0) {
      const replaced = page.textSentences[page.textSentences.length - 1];
      page.textSentences[page.textSentences.length - 1] = required;
      console.log(
        `[structured-draft] injected requiredExactLine on p${card.page} (companion missing, replaced last): "${replaced}" → "${required}"`
      );
    } else {
      page.textSentences.push(required);
      console.log(
        `[structured-draft] injected requiredExactLine on p${card.page} (empty page filled): "${required}"`
      );
    }
  }
}

/**
 * Build a focused retry message for the Author.
 *
 * Three failure modes get distinct messages so the Author doesn't conflate
 * a wrong page count with a wrong sentence on one page:
 *   - parse failure       → "Return STRICT JSON"
 *   - page-mismatch       → "Return exactly N page objects" (no
 *                            "fix specific pages keep others identical"
 *                            confusion — there ARE no others)
 *   - blueprint findings  → page-by-page diagnostics
 */
function buildRetryMessage(args: {
  parsed: StructuredDraftOutput | null;
  blueprintFindings: import('../editorial/draft-page-schema').BlueprintValidationFinding[];
  expectedPageCount: number;
}): string {
  if (!args.parsed) {
    return 'The previous response was not valid JSON matching the StructuredDraftOutput schema. Return STRICT JSON only.';
  }

  const hasPageMismatch = args.blueprintFindings.some(
    (f) => f.rule === 'page-mismatch'
  );

  if (hasPageMismatch) {
    return (
      `Return exactly ${args.expectedPageCount} page objects in the "pages" array. ` +
      `Do not return a story as a single string. Do not summarize. ` +
      `Each object must have: page (number), purpose (string), ` +
      `textSentences (array of strings), imageDirection (string). ` +
      `No Markdown. No prose outside JSON.`
    );
  }

  return (
    `The previous response violated the page blueprint on these pages:\n` +
    args.blueprintFindings
      .map((f) => `  - Page ${f.page}: ${f.rule} — ${f.detail}`)
      .join('\n') +
    `\nReturn the COMPLETE story again — ALL ${args.expectedPageCount} page ` +
    `objects in the "pages" array, in order. Reproduce every page NOT listed ` +
    `above EXACTLY as in your previous response (do not drop or shorten them). ` +
    `Change ONLY the listed pages: fix the stated problem and stay within every cap.`
  );
}
