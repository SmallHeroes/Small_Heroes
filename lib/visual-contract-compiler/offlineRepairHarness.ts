import type {
  ContractLlmCallOptions,
  ContractLlmPromptAuthority,
} from './compileBookVisualContract';
import {
  compileBookVisualContractTemplate,
  TemplateRepairExhaustedError,
  TemplateRepairIssueRegressionError,
  TemplateRepairOutputInvalidError,
  TemplateRepairRouteAdmissionError,
  type TemplateCompileInput,
  type TemplateRepairSummary,
} from './compileBookVisualContractTemplate';
import {
  buildDraftValidationDiagnosticTrail,
  draftValidationIssueIsValid,
  type DraftValidationAttemptDiagnostics,
  type DraftValidationIssue,
} from './draftValidationDiagnostics';
import { InvalidTemplateContractError } from './validateTemplateContract';

export const OFFLINE_REPAIR_HARNESS_RESULT_VERSION =
  'visual-contract-offline-repair-harness-result/v1' as const;

export interface OfflineRepairHarnessScenario {
  input: TemplateCompileInput;
  initialDraft: unknown;
  repairResponses?: readonly unknown[];
  /**
   * Optional independent census for each resulting draft, in validation order.
   * These lists never drive routing; they let the harness distinguish a newly
   * surfaced issue from a genuinely newly introduced issue.
   */
  completeDiagnosticIssuesByAttempt?: readonly (
    readonly DraftValidationIssue[]
  )[];
}

export interface OfflineRepairHarnessCall {
  call: number;
  kind: 'initial' | 'repair';
  repairMode: ContractLlmPromptAuthority extends infer Authority
    ? Authority extends { kind: 'repair'; repairMode: infer Mode }
      ? Mode | null
      : never
    : never;
  budgetClass: 'standard' | 'terminal_reference_cleanup';
  maxOutputTokens: number | null;
  schemaName: string | null;
}

export type OfflineRepairDeltaClassification =
  | 'baseline'
  | 'improved'
  | 'improved_with_unmasking'
  | 'stable'
  | 'unmasking'
  | 'destructive'
  | 'complete_census_unavailable';

export interface OfflineRepairHarnessStage {
  attempt: number;
  nextRepairMode: TemplateRepairSummary['nextRepairMode'] | null;
  surfacedDiagnosticIssues: readonly DraftValidationIssue[];
  surfacedIssueCount: number;
  surfacedDelta: number | null;
  completeIssueCount: number | null;
  completeDelta: number | null;
  classification: OfflineRepairDeltaClassification;
}

export interface OfflineRepairHarnessResult {
  version: typeof OFFLINE_REPAIR_HARNESS_RESULT_VERSION;
  executionMode: 'offline_stub';
  providerCalls: 0;
  outcome:
    | 'candidate'
    | 'repair_exhausted'
    | 'repair_regressed'
    | 'repair_output_invalid'
    | 'repair_route_not_admissible'
    | 'invalid_draft'
    | 'unexpected_failure';
  calls: readonly OfflineRepairHarnessCall[];
  stages: readonly OfflineRepairHarnessStage[];
  completeCensusCoverage: 'complete' | 'partial' | 'absent';
  monotonicCompleteIssueDelta: boolean | null;
  maxPositiveCompleteIssueDelta: number | null;
  finalSurfacedIssueCount: number | null;
  finalCompleteIssueCount: number | null;
}

function responseJson(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function currentIssues(
  diagnostics: DraftValidationAttemptDiagnostics,
): DraftValidationIssue[] {
  return diagnostics.items
    .filter((item) => item.state !== 'resolved')
    .map((item) => structuredClone(item.issue));
}

function uniqueIssueCount(
  diagnosticIssues: readonly DraftValidationIssue[],
): number {
  if (
    diagnosticIssues.some(
      (issue) => !draftValidationIssueIsValid(issue),
    )
  ) {
    throw new Error('offline_harness_diagnostic_issue_invalid');
  }
  return buildDraftValidationDiagnosticTrail([
    diagnosticIssues,
  ])[0]!.currentUniqueCount;
}

export function classifyOfflineRepairDelta(args: {
  surfacedDelta: number | null;
  completeDelta: number | null;
}): OfflineRepairDeltaClassification {
  if (args.surfacedDelta === null) return 'baseline';
  if (args.completeDelta === null) {
    return 'complete_census_unavailable';
  }
  if (args.completeDelta > 0) return 'destructive';
  if (args.completeDelta < 0) {
    return args.surfacedDelta > 0
      ? 'improved_with_unmasking'
      : 'improved';
  }
  return args.surfacedDelta > 0 ? 'unmasking' : 'stable';
}

function errorEvidence(error: unknown): {
  outcome: OfflineRepairHarnessResult['outcome'];
  attempts: readonly TemplateRepairSummary[];
  diagnostics: readonly DraftValidationAttemptDiagnostics[];
} {
  if (error instanceof TemplateRepairExhaustedError) {
    return {
      outcome: 'repair_exhausted',
      attempts: error.attempts,
      diagnostics: error.draftValidationDiagnostics,
    };
  }
  if (error instanceof TemplateRepairIssueRegressionError) {
    return {
      outcome: 'repair_regressed',
      attempts: error.attempts,
      diagnostics: error.draftValidationDiagnostics,
    };
  }
  if (error instanceof TemplateRepairOutputInvalidError) {
    return {
      outcome: 'repair_output_invalid',
      attempts: error.attempts,
      diagnostics: error.draftValidationDiagnostics,
    };
  }
  if (error instanceof TemplateRepairRouteAdmissionError) {
    return {
      outcome: 'repair_route_not_admissible',
      attempts: error.attempts,
      diagnostics: error.draftValidationDiagnostics,
    };
  }
  if (error instanceof InvalidTemplateContractError) {
    return {
      outcome: 'invalid_draft',
      attempts: [{
        attempt: 1,
        diagnosticIssues: error.diagnosticIssues,
      }],
      diagnostics: buildDraftValidationDiagnosticTrail([
        error.diagnosticIssues,
      ]),
    };
  }
  return {
    outcome: 'unexpected_failure',
    attempts: [],
    diagnostics: [],
  };
}

/**
 * Executes the production compiler with an in-memory response queue. No
 * provider adapter, credential, network boundary, artifact writer or retry is
 * reachable from this function.
 */
export async function runOfflineRepairHarness(
  scenario: OfflineRepairHarnessScenario,
): Promise<OfflineRepairHarnessResult> {
  const responseQueue = [
    scenario.initialDraft,
    ...(scenario.repairResponses ?? []),
  ];
  const calls: OfflineRepairHarnessCall[] = [];
  let outcome: OfflineRepairHarnessResult['outcome'];
  let summaries: readonly TemplateRepairSummary[] = [];
  let diagnosticTrail: readonly DraftValidationAttemptDiagnostics[] = [];

  try {
    const result = await compileBookVisualContractTemplate(
      structuredClone(scenario.input),
      {
        callLLM: async (
          _system: string,
          _user: string,
          options?: ContractLlmCallOptions,
          authority?: ContractLlmPromptAuthority,
        ): Promise<string> => {
          const call = calls.length + 1;
          if (!authority) {
            throw new Error('offline_harness_prompt_authority_missing');
          }
          calls.push({
            call,
            kind: authority.kind,
            repairMode:
              authority.kind === 'repair'
                ? authority.repairMode
                : null,
            budgetClass: authority.budgetClass,
            maxOutputTokens:
              options?.maxOutputTokens ?? null,
            schemaName: options?.jsonSchema?.name ?? null,
          });
          if (call > responseQueue.length) {
            throw new Error('offline_harness_response_exhausted');
          }
          return responseJson(responseQueue[call - 1]);
        },
      },
    );
    outcome = 'candidate';
    summaries = result.repairAttempts;
    diagnosticTrail = result.draftValidationDiagnostics;
  } catch (error) {
    const evidence = errorEvidence(error);
    outcome = evidence.outcome;
    summaries = evidence.attempts;
    diagnosticTrail = evidence.diagnostics;
  }

  const completeSets =
    scenario.completeDiagnosticIssuesByAttempt ?? [];
  for (const issues of completeSets) uniqueIssueCount(issues);

  const stages = diagnosticTrail.map((diagnostics, index) => {
    const surfacedDiagnosticIssues = currentIssues(diagnostics);
    const surfacedIssueCount = diagnostics.currentUniqueCount;
    const previousSurfacedIssueCount =
      index > 0
        ? diagnosticTrail[index - 1]!.currentUniqueCount
        : null;
    const completeIssueCount = completeSets[index]
      ? uniqueIssueCount(completeSets[index]!)
      : null;
    const previousCompleteIssueCount =
      index > 0 && completeSets[index - 1]
        ? uniqueIssueCount(completeSets[index - 1]!)
        : null;
    const surfacedDelta =
      previousSurfacedIssueCount === null
        ? null
        : surfacedIssueCount - previousSurfacedIssueCount;
    const completeDelta =
      completeIssueCount === null ||
      previousCompleteIssueCount === null
        ? null
        : completeIssueCount - previousCompleteIssueCount;
    return {
      attempt: index + 1,
      nextRepairMode:
        summaries[index]?.nextRepairMode ?? null,
      surfacedDiagnosticIssues,
      surfacedIssueCount,
      surfacedDelta,
      completeIssueCount,
      completeDelta,
      classification: classifyOfflineRepairDelta({
        surfacedDelta,
        completeDelta,
      }),
    } satisfies OfflineRepairHarnessStage;
  });

  const knownDeltas = stages
    .map((stage) => stage.completeDelta)
    .filter((delta): delta is number => delta !== null);
  const completeCensusCoverage =
    completeSets.length === 0
      ? 'absent'
      : completeSets.length >= stages.length
        ? 'complete'
        : 'partial';
  const monotonicCompleteIssueDelta =
    completeCensusCoverage === 'complete'
      ? knownDeltas.every((delta) => delta <= 0)
      : null;
  const maxPositiveCompleteIssueDelta =
    completeCensusCoverage === 'complete'
      ? Math.max(0, ...knownDeltas)
      : null;
  const finalStage = stages[stages.length - 1];

  return {
    version: OFFLINE_REPAIR_HARNESS_RESULT_VERSION,
    executionMode: 'offline_stub',
    providerCalls: 0,
    outcome,
    calls,
    stages,
    completeCensusCoverage,
    monotonicCompleteIssueDelta,
    maxPositiveCompleteIssueDelta,
    finalSurfacedIssueCount:
      finalStage?.surfacedIssueCount ?? null,
    finalCompleteIssueCount:
      finalStage?.completeIssueCount ?? null,
  };
}
