import type {
  ContractLlmCallOptions,
  ContractLlmPromptAuthority,
} from './compileBookVisualContract';
import { canonicalHash } from '@/lib/canonical-json';
import {
  DraftAuthorityReferenceDomainError,
  compileBookVisualContractTemplate,
  TemplateRepairExhaustedError,
  TemplateRepairIssueRegressionError,
  TemplateRepairStagnationError,
  TemplateRepairOutputInvalidError,
  TemplateRepairRouteAdmissionError,
  type TemplateCompileInput,
  type TemplateRepairSummary,
} from './compileBookVisualContractTemplate';
import {
  contractLlmCallOptionsIdentityDigest,
  projectContractLlmCallOptionsIdentity,
} from './contractLlmCallOptionsIdentity';
import { ActionSemanticCapabilityGapError } from './actionSemanticCoverage';
import { buildDraftAuthorityReferenceDiagnostics } from './draftAuthorityReferenceDiagnostics';
import {
  buildDraftValidationDiagnosticTrail,
  draftValidationIssueIsValid,
  normalizeDraftValidationIssues,
  type DraftValidationAttemptDiagnostics,
  type DraftValidationIssue,
} from './draftValidationDiagnostics';
import { InvalidTemplateContractError } from './validateTemplateContract';

export const OFFLINE_REPAIR_HARNESS_RESULT_VERSION =
  'visual-contract-offline-repair-harness-result/v3' as const;

export interface OfflineRepairHarnessScenario {
  input: TemplateCompileInput;
  initialDraft: unknown;
  repairResponses?: readonly unknown[];
  /**
   * Optional captured call sequence. A mismatch stops before the queued
   * response is returned, so an old patch can never be applied to a new route.
   */
  expectedCalls?: ReadonlyArray<
    Pick<
      OfflineRepairHarnessCall,
      'kind' | 'repairMode' | 'budgetClass' | 'schemaName'
    > &
      Partial<
        Omit<
          OfflineRepairHarnessCall,
          'call' | 'kind' | 'repairMode' | 'budgetClass' | 'schemaName'
        >
      >
  >;
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
  schemaDigest: string | null;
  callOptionsDigest: string;
  systemPromptVersion: string;
  userPromptVersion: string;
  systemPromptDigest: string;
  userPromptDigest: string;
}

export interface OfflineRepairHarnessActionCoverageRecord {
  pageNumber: number | null;
  coverageIndex: number;
  beatId: string | null;
  sourceEvidenceId: string | null;
  dispositionKind: string | null;
  matchingActionIndexes: readonly number[];
  attemptedPredicates: readonly string[];
}

export interface OfflineRepairHarnessActionCoverageCensus {
  call: number;
  repairMode: OfflineRepairHarnessCall['repairMode'];
  records: readonly OfflineRepairHarnessActionCoverageRecord[];
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
  /** Derived only from compiler-owned attempt metadata. */
  diagnosticPopulation: TemplateRepairSummary['diagnosticPopulation'];
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
     | 'repair_stagnated'
    | 'repair_output_invalid'
    | 'repair_route_not_admissible'
    | 'invalid_draft'
    | 'unexpected_failure';
  candidateTemplateDigest: string | null;
  terminalFailureCode:
    | 'draft_validation_repair_exhausted'
    | 'draft_validation_repair_regressed'
    | 'draft_validation_repair_stagnated'
    | 'repair_output_invalid'
    | 'repair_route_input_not_admissible'
    | 'draft_authority_reference_domain_invalid'
    | 'action_semantic_capability_gap'
    | null;
  terminalIssueDigest: string | null;
  terminalFailureIdentityDigest: string | null;
  terminalFailureIdentityComplete: boolean;
  calls: readonly OfflineRepairHarnessCall[];
  /**
   * Sanitized action/coverage evidence from injected draft-shaped responses.
   * No prompt, source phrase, contract value or provider material is retained.
   */
  actionCoverageCensuses: readonly OfflineRepairHarnessActionCoverageCensus[];
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

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function sanitizedActionCoverageCensus(args: {
  call: number;
  repairMode: OfflineRepairHarnessCall['repairMode'];
  response: unknown;
}): OfflineRepairHarnessActionCoverageCensus | null {
  const response = objectValue(args.response);
  const pages = response?.pageContracts;
  if (!Array.isArray(pages)) return null;

  const records: OfflineRepairHarnessActionCoverageRecord[] = [];
  for (const pageValue of pages) {
    const page = objectValue(pageValue);
    if (!page) continue;
    const pageNumber =
      Number.isSafeInteger(page.pageNumber) &&
      (page.pageNumber as number) > 0
        ? page.pageNumber as number
        : null;
    const coverage = Array.isArray(page.actionSemanticCoverage)
      ? page.actionSemanticCoverage
      : [];
    const actions = Array.isArray(page.actionRequirements)
      ? page.actionRequirements
      : [];

    for (const [coverageIndex, coverageValue] of coverage.entries()) {
      const coverageRecord = objectValue(coverageValue);
      const beatId =
        typeof coverageRecord?.beatId === 'string'
          ? coverageRecord.beatId
          : null;
      const matchingActionIndexes: number[] = [];
      const attemptedPredicates: string[] = [];
      if (beatId !== null) {
        for (const [actionIndex, actionValue] of actions.entries()) {
          const action = objectValue(actionValue);
          if (action?.beatId !== beatId) continue;
          matchingActionIndexes.push(actionIndex);
          if (typeof action.predicate === 'string') {
            attemptedPredicates.push(action.predicate);
          }
        }
      }
      const disposition = objectValue(coverageRecord?.disposition);
      records.push({
        pageNumber,
        coverageIndex,
        beatId,
        sourceEvidenceId:
          typeof coverageRecord?.sourceEvidenceId === 'string'
            ? coverageRecord.sourceEvidenceId
            : null,
        dispositionKind:
          typeof disposition?.kind === 'string'
            ? disposition.kind
            : null,
        matchingActionIndexes,
        attemptedPredicates,
      });
    }
  }

  return {
    call: args.call,
    repairMode: args.repairMode,
    records,
  };
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

function routeSubsetSummaries(
  diagnosticIssuesByAttempt: readonly (
    readonly DraftValidationIssue[]
  )[],
): TemplateRepairSummary[] {
  return diagnosticIssuesByAttempt.map((diagnosticIssues, index) => ({
    attempt: index + 1,
    diagnosticIssues,
    diagnosticPopulation: 'route_subset',
  }));
}

function normalizedCompilerIssues(
  issues: readonly DraftValidationIssue[],
): readonly DraftValidationIssue[] {
  if (issues.some((issue) => !draftValidationIssueIsValid(issue))) {
    throw new Error('offline_harness_compiler_diagnostic_invalid');
  }
  return normalizeDraftValidationIssues(issues);
}

function compilerDiagnosticIssuesByStage(args: {
  summaries: readonly TemplateRepairSummary[];
  diagnosticTrail: readonly DraftValidationAttemptDiagnostics[];
  outcome: OfflineRepairHarnessResult['outcome'];
}): readonly (readonly DraftValidationIssue[])[] {
  const expectedTrailLength =
    args.summaries.length + (args.outcome === 'candidate' ? 1 : 0);
  if (args.diagnosticTrail.length !== expectedTrailLength) {
    throw new Error(
      'offline_harness_compiler_diagnostic_alignment_invalid',
    );
  }
  for (const [index, summary] of args.summaries.entries()) {
    if (
      summary.attempt !== index + 1 ||
      summary.diagnosticIssues.some(
        (issue) => !draftValidationIssueIsValid(issue),
      )
    ) {
      throw new Error(
        'offline_harness_compiler_diagnostic_alignment_invalid',
      );
    }
  }
  const emissionsByAttempt: (readonly DraftValidationIssue[])[] = [
    ...args.summaries.map((summary) => summary.diagnosticIssues),
    ...(args.outcome === 'candidate' ? [[]] : []),
  ];
  const expectedTrail = buildDraftValidationDiagnosticTrail(
    emissionsByAttempt,
  );
  if (canonicalHash(expectedTrail) !== canonicalHash(args.diagnosticTrail)) {
    throw new Error(
      'offline_harness_compiler_diagnostic_alignment_invalid',
    );
  }
  if (
    args.outcome === 'candidate' &&
    args.diagnosticTrail[args.diagnosticTrail.length - 1]
      ?.currentUniqueCount !== 0
  ) {
    throw new Error(
      'offline_harness_candidate_complete_census_invalid',
    );
  }
  return emissionsByAttempt.map((issues) =>
    normalizedCompilerIssues(issues),
  );
}

function compilerDiagnosticPopulationAt(args: {
  index: number;
  summaries: readonly TemplateRepairSummary[];
  outcome: OfflineRepairHarnessResult['outcome'];
  diagnosticTrailLength: number;
}): TemplateRepairSummary['diagnosticPopulation'] {
  const summary = args.summaries[args.index];
  if (summary) return summary.diagnosticPopulation;
  return args.outcome === 'candidate' &&
    args.diagnosticTrailLength === args.summaries.length + 1 &&
    args.index === args.diagnosticTrailLength - 1
    ? 'complete'
    : 'route_subset';
}

function errorEvidence(error: unknown): {
  outcome: OfflineRepairHarnessResult['outcome'];
  terminalFailureCode: OfflineRepairHarnessResult['terminalFailureCode'];
  terminalFailureIdentityDigest: string | null;
  terminalFailureIdentityComplete: boolean;
  attempts: readonly TemplateRepairSummary[];
  diagnostics: readonly DraftValidationAttemptDiagnostics[];
} {
  if (error instanceof TemplateRepairExhaustedError) {
    return {
      outcome: 'repair_exhausted',
      terminalFailureCode: 'draft_validation_repair_exhausted',
      terminalFailureIdentityDigest: null,
      terminalFailureIdentityComplete: true,
      attempts: error.attempts,
      diagnostics: error.draftValidationDiagnostics,
    };
  }
  if (error instanceof TemplateRepairIssueRegressionError) {
    return {
      outcome: 'repair_regressed',
      terminalFailureCode: 'draft_validation_repair_regressed',
      terminalFailureIdentityDigest: null,
      terminalFailureIdentityComplete: true,
      attempts: error.attempts,
      diagnostics: error.draftValidationDiagnostics,
    };
  }
  if (error instanceof TemplateRepairStagnationError) {
    return {
      outcome: 'repair_stagnated',
      terminalFailureCode: 'draft_validation_repair_stagnated',
      terminalFailureIdentityDigest: null,
      terminalFailureIdentityComplete: true,
      attempts: error.attempts,
      diagnostics: error.draftValidationDiagnostics,
    };
  }
  if (error instanceof TemplateRepairOutputInvalidError) {
    const carriedDraftDiagnosticCount = error.attempts.reduce(
      (count, attempt) => count + attempt.diagnosticIssues.length,
      0,
    );
    return {
      outcome: 'repair_output_invalid',
      terminalFailureCode: 'repair_output_invalid',
      terminalFailureIdentityDigest: canonicalHash({
        kind: 'repair_output_invalid',
        repairAttempt: error.repairAttempt,
        repairMode: error.repairMode,
        failureCode: error.failureCode,
        identity: error.identity,
        targetContext: error.targetContext,
        carriedDraftDiagnosticCount,
      }),
      terminalFailureIdentityComplete: true,
      attempts: error.attempts,
      diagnostics: error.draftValidationDiagnostics,
    };
  }
  if (error instanceof TemplateRepairRouteAdmissionError) {
    const carriedDraftDiagnosticCount = error.attempts.reduce(
      (count, attempt) => count + attempt.diagnosticIssues.length,
      0,
    );
    return {
      outcome: 'repair_route_not_admissible',
      terminalFailureCode: 'repair_route_input_not_admissible',
      terminalFailureIdentityDigest: canonicalHash({
        kind: 'repair_route_input_not_admissible',
        repairAttempt: error.repairAttempt,
        repairMode: error.repairMode,
        inputAccounting: error.inputAccounting,
        maxAdmissibleInputBytes: error.maxAdmissibleInputBytes,
        carriedDraftDiagnosticCount,
      }),
      terminalFailureIdentityComplete: true,
      attempts: error.attempts,
      diagnostics: error.draftValidationDiagnostics,
    };
  }
  if (error instanceof DraftAuthorityReferenceDomainError) {
    const authorityReferenceDiagnostics =
      buildDraftAuthorityReferenceDiagnostics(error.issues);
    return {
      outcome: 'invalid_draft',
      terminalFailureCode: 'draft_authority_reference_domain_invalid',
      terminalFailureIdentityDigest:
        authorityReferenceDiagnostics.truncated
          ? null
          : canonicalHash({
              kind: 'draft_authority_reference_domain_invalid',
              authorityReferenceDiagnostics,
            }),
      terminalFailureIdentityComplete:
        !authorityReferenceDiagnostics.truncated,
      attempts: [],
      diagnostics: [],
    };
  }
  if (error instanceof ActionSemanticCapabilityGapError) {
    const diagnostics = error.draftValidationDiagnostics;
    return {
      outcome: 'invalid_draft',
      terminalFailureCode: 'action_semantic_capability_gap',
      terminalFailureIdentityDigest: canonicalHash({
        kind: 'action_semantic_capability_gap',
        gapCount: error.gaps.length,
      }),
      terminalFailureIdentityComplete: true,
      attempts: routeSubsetSummaries(
        error.diagnosticIssuesByAttempt,
      ),
      diagnostics,
    };
  }
  if (error instanceof InvalidTemplateContractError) {
    const diagnostics = buildDraftValidationDiagnosticTrail([
      error.diagnosticIssues,
    ]);
    return {
      outcome: 'invalid_draft',
      terminalFailureCode: null,
      terminalFailureIdentityDigest: null,
      terminalFailureIdentityComplete: false,
      attempts: routeSubsetSummaries([
        error.diagnosticIssues,
      ]),
      diagnostics,
    };
  }
  return {
    outcome: 'unexpected_failure',
    terminalFailureCode: null,
    terminalFailureIdentityDigest: null,
    terminalFailureIdentityComplete: false,
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
  if (
    Object.prototype.hasOwnProperty.call(
      scenario,
      'completeDiagnosticIssuesByAttempt',
    )
  ) {
    throw new Error(
      'offline_harness_caller_supplied_complete_census_forbidden',
    );
  }
  const responseQueue = [
    scenario.initialDraft,
    ...(scenario.repairResponses ?? []),
  ];
  const calls: OfflineRepairHarnessCall[] = [];
  const actionCoverageCensuses: OfflineRepairHarnessActionCoverageCensus[] = [];
  let outcome: OfflineRepairHarnessResult['outcome'];
  let candidateTemplateDigest: string | null = null;
  let terminalFailureCode:
    OfflineRepairHarnessResult['terminalFailureCode'] = null;
  let terminalFailureIdentityDigest: string | null = null;
  let terminalFailureIdentityComplete = true;
  let summaries: readonly TemplateRepairSummary[] = [];
  let diagnosticTrail: readonly DraftValidationAttemptDiagnostics[] = [];

  try {
    const result = await compileBookVisualContractTemplate(
      structuredClone(scenario.input),
      {
        callLLM: async (
          system: string,
          user: string,
          options?: ContractLlmCallOptions,
          authority?: ContractLlmPromptAuthority,
        ): Promise<string> => {
          const call = calls.length + 1;
          if (!authority) {
            throw new Error('offline_harness_prompt_authority_missing');
          }
          const callOptionsIdentity =
            projectContractLlmCallOptionsIdentity(options);
          if (!callOptionsIdentity) {
            throw new Error('offline_harness_call_options_invalid');
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
            schemaDigest: options?.jsonSchema?.schema
              ? canonicalHash(options.jsonSchema.schema)
              : null,
            callOptionsDigest:
              contractLlmCallOptionsIdentityDigest(
                callOptionsIdentity,
              ),
            systemPromptVersion: authority.systemPromptVersion,
            userPromptVersion: authority.userPromptVersion,
            systemPromptDigest: canonicalHash(system),
            userPromptDigest: canonicalHash(user),
          });
          const expectedCall = scenario.expectedCalls?.[call - 1];
          const actualCall = calls[call - 1]!;
          if (scenario.expectedCalls && !expectedCall) {
            throw new Error(
              'offline_harness_captured_route_mismatch',
            );
          }
          if (
            expectedCall &&
            (actualCall.kind !== expectedCall.kind ||
              actualCall.repairMode !== expectedCall.repairMode ||
              actualCall.budgetClass !== expectedCall.budgetClass ||
              actualCall.schemaName !== expectedCall.schemaName ||
              (expectedCall.maxOutputTokens !== undefined &&
                actualCall.maxOutputTokens !==
                  expectedCall.maxOutputTokens) ||
              (expectedCall.schemaDigest !== undefined &&
                actualCall.schemaDigest !== expectedCall.schemaDigest) ||
              (expectedCall.callOptionsDigest !== undefined &&
                actualCall.callOptionsDigest !==
                  expectedCall.callOptionsDigest) ||
              (expectedCall.systemPromptVersion !== undefined &&
                actualCall.systemPromptVersion !==
                  expectedCall.systemPromptVersion) ||
              (expectedCall.userPromptVersion !== undefined &&
                actualCall.userPromptVersion !==
                  expectedCall.userPromptVersion) ||
              (expectedCall.systemPromptDigest !== undefined &&
                actualCall.systemPromptDigest !==
                  expectedCall.systemPromptDigest) ||
              (expectedCall.userPromptDigest !== undefined &&
                actualCall.userPromptDigest !==
                  expectedCall.userPromptDigest))
          ) {
            throw new Error(
              'offline_harness_captured_route_mismatch',
            );
          }
          if (call > responseQueue.length) {
            throw new Error('offline_harness_response_exhausted');
          }
          const response = responseQueue[call - 1];
          const census = sanitizedActionCoverageCensus({
            call,
            repairMode:
              authority.kind === 'repair'
                ? authority.repairMode
                : null,
            response,
          });
          if (census) actionCoverageCensuses.push(census);
          return responseJson(response);
        },
      },
    );
    if (
      scenario.expectedCalls &&
      calls.length !== scenario.expectedCalls.length
    ) {
      throw new Error(
        'offline_harness_captured_route_mismatch',
      );
    }
    outcome = 'candidate';
    candidateTemplateDigest = canonicalHash(result.template);
    summaries = result.repairAttempts;
    diagnosticTrail = result.draftValidationDiagnostics;
  } catch (error) {
    const evidence = errorEvidence(error);
    outcome = evidence.outcome;
    terminalFailureCode = evidence.terminalFailureCode;
    terminalFailureIdentityDigest =
      evidence.terminalFailureIdentityDigest;
    terminalFailureIdentityComplete =
      evidence.terminalFailureIdentityComplete;
    summaries = evidence.attempts;
    diagnosticTrail = evidence.diagnostics;
  }

  const compilerIssuesByStage = compilerDiagnosticIssuesByStage({
    summaries,
    diagnosticTrail,
    outcome,
  });

  const stages = diagnosticTrail.map((diagnostics, index) => {
    const surfacedDiagnosticIssues = compilerIssuesByStage[index]!;
    const surfacedIssueCount = diagnostics.currentUniqueCount;
    const previousSurfacedIssueCount =
      index > 0
        ? diagnosticTrail[index - 1]!.currentUniqueCount
        : null;
    const summary = summaries[index];
    const diagnosticPopulation = compilerDiagnosticPopulationAt({
      index,
      summaries,
      outcome,
      diagnosticTrailLength: diagnosticTrail.length,
    });
    const completeIssueCount =
      diagnosticPopulation === 'complete'
        ? surfacedIssueCount
        : null;
    const previousCompleteIssueCount =
      index > 0 &&
      compilerDiagnosticPopulationAt({
        index: index - 1,
        summaries,
        outcome,
        diagnosticTrailLength: diagnosticTrail.length,
      }) === 'complete'
        ? diagnosticTrail[index - 1]!.currentUniqueCount
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
      nextRepairMode: summary?.nextRepairMode ?? null,
      diagnosticPopulation,
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
  const completeStageCount = stages.filter(
    (stage) => stage.diagnosticPopulation === 'complete',
  ).length;
  const completeCensusCoverage =
    completeStageCount === 0
      ? 'absent'
      : completeStageCount === stages.length
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
  const finalIssues = finalStage?.surfacedDiagnosticIssues ?? [];

  return {
    version: OFFLINE_REPAIR_HARNESS_RESULT_VERSION,
    executionMode: 'offline_stub',
    providerCalls: 0,
    outcome,
    candidateTemplateDigest,
    terminalFailureCode,
    terminalIssueDigest:
      finalIssues.length > 0 ? canonicalHash(finalIssues) : null,
    terminalFailureIdentityDigest,
    terminalFailureIdentityComplete,
    calls,
    actionCoverageCensuses,
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
