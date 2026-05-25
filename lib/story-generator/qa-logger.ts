import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import type { Finding } from '@/lib/story-validators';
import type { ValidationReport } from '@/lib/story-validators';
import type { EditorialReportRuntime } from './editorial/schemas';
import type { VoiceReviewReportType } from './editorial/voice-schemas';
import type { GenerateInput, ManualReview, Plan, PlanQualityWarning, QASummary } from './types';
import { GENERATOR_VERSION, PROMPT_VERSION, VALIDATOR_VERSION } from './versions';

export interface QALogHandle {
  dir: string;
  recordInput(input: GenerateInput): void;
  recordPlan(plan: Plan, warnings: PlanQualityWarning[]): void;
  recordPlanValidation(ok: boolean, reason?: string): void;
  recordDraft(markdown: string): void;
  recordValidation(attempt: number, report: ValidationReport): void;
  recordRepair(attempt: number, markdown: string): void;
  recordFinalStory(markdown: string): void;
  recordEditorialQA(
    report: EditorialReportRuntime,
    meta: {
      zodParseFailed: boolean;
      reviewRequired: boolean;
      prescanCount: number;
      model: string;
      costUsd: number;
    }
  ): void;
  recordEditorialRepair(
    attempt: number,
    markdown: string,
    meta: {
      phase1Fixed: number;
      phase2Used: boolean;
      diffRatioExceeded: boolean;
      costUsd: number;
    }
  ): void;
  recordEditorialSummary(markdown: string): void;
  recordVoiceReview(
    payload:
      | { status: 'ok'; report: VoiceReviewReportType; costUsd: number; model: string }
      | { status: 'skipped'; error?: string; costUsd: number; model: string }
  ): void;
  markPassed(summary: Omit<QASummary, 'finalVerdict' | 'blockingFindings' | 'warningFindings'>): string;
  markFailure(reason: string, report?: ValidationReport): string;
}

function writeJson(filePath: string, data: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function startQALog(input: GenerateInput): QALogHandle {
  const runId = `${new Date().toISOString().slice(0, 10)}_${Date.now()}`;
  const dir = path.join(process.cwd(), 'story-qa-logs', runId);
  mkdirSync(dir, { recursive: true });

  let lastReport: ValidationReport | undefined;

  const manualReviewTemplate: ManualReview = {
    reviewer: '',
    reviewedAt: '',
    scores: {
      childWouldAskAgain: 3,
      companionIdentity: 3,
      emotionalTruth: 3,
      storyFun: 3,
      visualPotential: 3,
      hebrewNaturalness: 3,
    },
    overall: 'WEAK',
    notes: '',
  };

  writeJson(path.join(dir, 'manual-review.json'), manualReviewTemplate);

  return {
    dir,
    recordInput(data) {
      writeJson(path.join(dir, 'input.json'), data);
    },
    recordPlan(plan, warnings) {
      writeJson(path.join(dir, 'plan.json'), { plan, planQualityWarnings: warnings });
    },
    recordPlanValidation(ok, reason) {
      writeJson(path.join(dir, 'plan-validation.json'), { ok, reason: reason ?? null });
    },
    recordDraft(markdown) {
      writeFileSync(path.join(dir, 'draft.md'), markdown, 'utf8');
    },
    recordValidation(attempt, report) {
      lastReport = report;
      writeJson(path.join(dir, `validation-${attempt}.json`), report);
    },
    recordRepair(attempt, markdown) {
      writeFileSync(path.join(dir, `repair-${attempt}.md`), markdown, 'utf8');
    },
    recordFinalStory(markdown) {
      writeFileSync(path.join(dir, 'final-story.md'), markdown, 'utf8');
    },
    recordEditorialQA(report, meta) {
      writeJson(path.join(dir, 'editorial-qa.json'), { report, ...meta });
    },
    recordEditorialRepair(attempt, markdown, meta) {
      writeFileSync(path.join(dir, `editorial-repair-${attempt}.md`), markdown, 'utf8');
      writeJson(path.join(dir, `editorial-repair-${attempt}.json`), meta);
    },
    recordEditorialSummary(markdown) {
      writeFileSync(path.join(dir, 'editorial-summary.md'), markdown, 'utf8');
    },
    recordVoiceReview(payload) {
      writeJson(path.join(dir, 'voice-review.json'), payload);
    },
    markPassed(partial) {
      const blocking = (lastReport?.findings ?? []).filter((f: Finding) => f.severity === 'BLOCKING');
      const warnings = (lastReport?.findings ?? []).filter((f: Finding) => f.severity === 'WARNING');
      // v0.3.6 — INVARIANT: a story with ANY BLOCKING finding cannot be PASS.
      // Earlier code wrote finalVerdict='PASS' alongside a populated blockingFindings
      // array — an impossible state. If blocking exists, this is a FAIL even if
      // the orchestrator (incorrectly) reached this code path.
      const finalVerdict: 'PASS' | 'FAIL' = blocking.length > 0 ? 'FAIL' : 'PASS';
      const summary: QASummary = {
        finalVerdict,
        blockingFindings: blocking,
        warningFindings: warnings,
        ...partial,
      };
      writeJson(path.join(dir, 'summary.json'), summary);
      const noteHeader = finalVerdict === 'PASS' ? '# QA Run PASS' : '# QA Run FAIL (had blocking findings)';
      writeFileSync(
        path.join(dir, 'notes.md'),
        `${noteHeader}\n\n- Model: ${partial.modelName}\n- Cost: $${partial.costUsd.toFixed(4)}\n- Repairs: ${partial.repairAttempts}\n- Blocking findings: ${blocking.length}\n`,
        'utf8'
      );
      return dir;
    },
    markFailure(reason, report) {
      if (report) lastReport = report;
      const summary: QASummary = {
        finalVerdict: 'FAIL',
        blockingFindings: report?.findings.filter((f) => f.severity === 'BLOCKING') ?? [],
        warningFindings: report?.findings.filter((f) => f.severity === 'WARNING') ?? [],
        repairAttempts: 0,
        fallbackUsed: false,
        costUsd: 0,
        durationMs: 0,
        llmCalls: 0,
        modelName: process.env.GENERATOR_LLM_MODEL ?? 'gpt-5-chat-latest',
        modelVersion: '',
        promptVersion: PROMPT_VERSION,
        validatorVersion: VALIDATOR_VERSION,
        generatorVersion: GENERATOR_VERSION,
        planQualityWarnings: [],
        timestamp: new Date().toISOString(),
      };
      writeJson(path.join(dir, 'summary.json'), summary);
      writeFileSync(path.join(dir, 'notes.md'), `# QA Run FAIL\n\n${reason}\n`, 'utf8');
      return dir;
    },
  };
}
