import { parseStoryMarkdown } from '@/lib/story-validators';
import { getEditorialQaModel } from '../editorial/config';
import { buildVoiceReviewMeta } from '../editorial/voice-reviewer-meta';
import {
  processVoiceFinding,
  VoiceFindingLLM,
  VoiceReviewReport,
  type VoiceFindingType,
  type VoiceReviewReportType,
} from '../editorial/voice-schemas';
import { OpenAIResponsesLLM, parseJsonFromLLM, type StoryGeneratorLLM } from '../llm';
import {
  buildVoiceReviewerUserPrompt,
  VOICE_REVIEWER_SYSTEM_PROMPT,
} from '../prompts/voice-reviewer-prompt';

export type VoiceReviewerStatus = 'ok' | 'skipped';

export interface VoiceReviewerResult {
  status: VoiceReviewerStatus;
  report?: VoiceReviewReportType;
  llmCostUsd: number;
  model: string;
  modelVersion: string;
  parseFailed: boolean;
  error?: string;
}

function parseFindingsFromLlm(
  raw: unknown,
  storyId: string,
  ageTier: string,
  modelName: string
): VoiceReviewReportType | null {
  if (!raw || typeof raw !== 'object') return null;

  const findingsRaw = Array.isArray((raw as { findings?: unknown }).findings)
    ? (raw as { findings: unknown[] }).findings
    : [];

  const findings: VoiceFindingType[] = [];
  for (const item of findingsRaw) {
    const parsed = VoiceFindingLLM.safeParse(item);
    if (!parsed.success) return null;
    const processed = processVoiceFinding(parsed.data);
    if (processed) findings.push(processed);
  }

  return VoiceReviewReport.parse({
    meta: buildVoiceReviewMeta(modelName),
    storyId,
    language: 'he',
    ageTier,
    findings,
  });
}

function tryParseVoiceReport(
  text: string,
  storyId: string,
  ageTier: string,
  modelName: string
): VoiceReviewReportType | null {
  try {
    const raw = parseJsonFromLLM<unknown>(text, 'voice-reviewer');
    return parseFindingsFromLlm(raw, storyId, ageTier, modelName);
  } catch {
    return null;
  }
}

export function logVoiceReviewConsole(
  storyId: string,
  report: VoiceReviewReportType,
  diagnosticOnly: boolean
): void {
  const pageCount = report.findings.filter((f) => f.scope === 'page').length;
  const storyCount = report.findings.filter((f) => f.scope === 'story').length;
  console.log(
    `[voice-reviewer] story=${storyId}  ${report.findings.length} findings (${pageCount} page / ${storyCount} story)`
  );

  for (const f of report.findings) {
    const pageLabel = f.scope === 'page' && f.page != null ? `p${f.page}` : '--';
    const scopeTag = f.scope === 'page' ? 'page' : 'story';
    const quoteBit =
      f.scope === 'page' && f.quote
        ? `  "${f.quote.length > 60 ? `${f.quote.slice(0, 57)}...` : f.quote}"`
        : `  (${f.reason.slice(0, 80)}${f.reason.length > 80 ? '...' : ''})`;
    console.log(
      `  ${pageLabel.padStart(3)}  ${scopeTag.padEnd(5)}  ${f.severity.toUpperCase().padEnd(10)} ` +
        `${f.axis}/${f.family}`.padEnd(35) +
        ` conf=${f.confidence.toFixed(2)}${quoteBit}`
    );
  }

  if (diagnosticOnly) {
    console.log(
      '[voice-reviewer] v1 diagnostic-only — findings recorded, finalStatus unaffected'
    );
  }
}

export async function runVoiceReviewer(
  storyMarkdown: string,
  args: { storyId: string; ageTier: string; language?: 'he' },
  llm?: StoryGeneratorLLM
): Promise<VoiceReviewerResult> {
  const model = getEditorialQaModel();
  const client = llm ?? new OpenAIResponsesLLM(model);
  const userPrompt = buildVoiceReviewerUserPrompt({
    storyMarkdown,
    storyId: args.storyId,
    ageTier: args.ageTier,
  });

  try {
    const first = await client.call({
      stage: 'voice-reviewer',
      systemPrompt: VOICE_REVIEWER_SYSTEM_PROMPT,
      userPrompt,
      maxOutputTokens: 3500,
      jsonMode: true,
      temperature: 0.2,
    });

    let parsed = tryParseVoiceReport(first.text, args.storyId, args.ageTier, model);
    let totalCost = first.costUsd;
    let modelVersion = first.modelVersion;

    if (!parsed) {
      console.warn('[voice-reviewer] parse failed — retrying once');
      const retry = await client.call({
        stage: 'voice-reviewer',
        systemPrompt: VOICE_REVIEWER_SYSTEM_PROMPT,
        userPrompt:
          userPrompt +
          '\n\nRETRY: Return STRICT JSON only. At most 6 findings. Every scope=page finding MUST include exact quote. Story-scope: page=null, severity=diagnostic, no quote.',
        maxOutputTokens: 3500,
        jsonMode: true,
        temperature: 0.1,
      });
      totalCost += retry.costUsd;
      modelVersion = retry.modelVersion;
      parsed = tryParseVoiceReport(retry.text, args.storyId, args.ageTier, model);
    }

    if (!parsed) {
      return {
        status: 'skipped',
        llmCostUsd: totalCost,
        model,
        modelVersion,
        parseFailed: true,
        error: 'Zod/quote validation failed after retry',
      };
    }

    const parsedStory = parseStoryMarkdown(storyMarkdown);
    for (const f of parsed.findings) {
      if (f.scope !== 'page' || !f.quote || f.page == null) continue;
      const page = parsedStory.pages.find((p) => p.pageNumber === f.page);
      if (!page?.text.includes(f.quote)) {
        console.warn(
          `[voice-reviewer] quote not found on p${f.page}: "${f.quote.slice(0, 40)}..."`
        );
      }
    }

    logVoiceReviewConsole(args.storyId, parsed, true);

    return {
      status: 'ok',
      report: parsed,
      llmCostUsd: totalCost,
      model,
      modelVersion,
      parseFailed: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[voice-reviewer] skipped — ${message}`);
    return {
      status: 'skipped',
      llmCostUsd: 0,
      model,
      modelVersion: '',
      parseFailed: true,
      error: message,
    };
  }
}
