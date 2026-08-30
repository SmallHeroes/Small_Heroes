import { describe, expect, it, vi } from 'vitest';

import {
  BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
  blueprintAuthoringCountRequestProjection,
  type BlueprintAuthoringExactInputTokenCountResult,
  type BlueprintAuthoringInputTokenCountRequest,
} from '@/lib/visual-package/blueprintAuthoringInputTokenAdmission';
import {
  blueprintAuthoringInputMicroUsd,
} from '@/lib/visual-package/blueprintAuthoringCountAwareCost';
import {
  blueprintAuthoringInputAccounting,
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
  BLUEPRINT_AUTHORING_MODEL,
  BLUEPRINT_AUTHORING_REASONING_EFFORT,
} from '@/lib/visual-package/blueprintAuthoringPolicy';
import {
  createBlueprintAuthoringRunnerCountAuthority,
} from '@/lib/visual-package/productionAuthoringRunner';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';

const schema = { type: 'object', additionalProperties: false };

function request(
  repairOrdinal: 1 | 2,
  exactUpperBound?: number,
): BlueprintAuthoringInputTokenCountRequest {
  const systemPrompt = 'repair system';
  const emptyAccounting = blueprintAuthoringInputAccounting({
    systemPrompt,
    userPrompt: '',
    schema,
  });
  const target = exactUpperBound ?? BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS + 10_000;
  const userPrompt = 'x'.repeat(target - emptyAccounting.estimatedBytes);
  const accounting = blueprintAuthoringInputAccounting({
    systemPrompt,
    userPrompt,
    schema,
  });
  expect(accounting.estimatedBytes).toBe(target);
  return {
    routeKind: 'repair',
    repairOrdinal,
    systemPrompt,
    userPrompt,
    schema,
    model: BLUEPRINT_AUTHORING_MODEL,
    reasoningEffort: BLUEPRINT_AUTHORING_REASONING_EFFORT,
    schemaName: 'PreRenderBookVisualBlueprintWholeBookDraft',
  };
}

function counted(
  req: BlueprintAuthoringInputTokenCountRequest,
  inputTokens = 50_000,
): BlueprintAuthoringExactInputTokenCountResult {
  return {
    routeKind: 'repair',
    repairOrdinal: req.repairOrdinal,
    countRequestDigest: canonicalJsonDigest(
      blueprintAuthoringCountRequestProjection(req),
    ),
    outcome: 'counted',
    inputTokens,
    unavailableReason: null,
    attestation: {
      provider: 'openai',
      model: BLUEPRINT_AUTHORING_MODEL,
      route: 'responses_input_tokens',
      evidenceVersion: BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
      transportDispatchCount: 1,
      transportRetryCount: 0,
      canonicalRouteConfirmed: true,
      canonicalModelConfirmed: true,
    },
  };
}

describe('runner-owned exact-count cache and debit authority', () => {
  it('deduplicates an in-flight and serial same-key count, but not a different ordinal', async () => {
    const source = vi.fn(async (req: BlueprintAuthoringInputTokenCountRequest) =>
      counted(req),
    );
    const authority = createBlueprintAuthoringRunnerCountAuthority({
      source,
      generationAccountedMicroUsd: () => 1_408_000,
    });
    const firstRequest = request(1);
    const [first, concurrent] = await Promise.all([
      authority.counter(firstRequest),
      authority.counter(structuredClone(firstRequest)),
    ]);
    const serial = await authority.counter(firstRequest);

    expect(first).toEqual(concurrent);
    expect(serial).toEqual(first);
    expect(source).toHaveBeenCalledTimes(1);
    const firstEvents = [
      authority.consumeProbeEvent(firstRequest)?.probe,
      authority.consumeProbeEvent(firstRequest)?.probe,
      authority.consumeProbeEvent(firstRequest)?.probe,
    ];
    expect(firstEvents.map((event) => event?.status).sort()).toEqual([
      'cache_hit',
      'cache_hit',
      'cache_miss',
    ]);
    const debit = blueprintAuthoringInputMicroUsd(50_000);
    expect(firstEvents.filter((event) => event?.debitMicroUsd === debit)).toHaveLength(1);
    expect(authority.cumulativeProbeDebitMicroUsd()).toBe(debit);

    const secondRequest = request(2);
    await authority.counter(secondRequest);
    expect(source).toHaveBeenCalledTimes(2);
    expect(authority.consumeProbeEvent(secondRequest)?.probe.status).toBe('cache_miss');
    expect(authority.cumulativeProbeDebitMicroUsd()).toBe(2 * debit);
  });

  it('proves no-dispatch only for runner-owned not-wired and reservation rejection', async () => {
    const notWired = createBlueprintAuthoringRunnerCountAuthority({
      generationAccountedMicroUsd: () => 1_408_000,
    });
    const ordinary = request(1);
    const unavailable = await notWired.counter(ordinary);
    expect(unavailable).toMatchObject({
      outcome: 'unavailable',
      unavailableReason: 'not_wired',
      attestation: null,
    });
    expect(notWired.consumeProbeEvent(ordinary)?.probe).toMatchObject({
      status: 'not_wired',
      debitMicroUsd: 0,
      transportDisposition: 'not_dispatched',
    });

    const source = vi.fn(async (req: BlueprintAuthoringInputTokenCountRequest) =>
      counted(req),
    );
    const reserved = createBlueprintAuthoringRunnerCountAuthority({
      source,
      generationAccountedMicroUsd: () => 1_408_000,
    });
    const overFence = request(1, 326_546);
    const rejected = await reserved.counter(overFence);
    expect(rejected.unavailableReason).toBe('count_cost_reservation_exceeded');
    expect(source).not.toHaveBeenCalled();
    expect(reserved.consumeProbeEvent(overFence)?.probe).toMatchObject({
      status: 'reservation_rejected',
      debitMicroUsd: 0,
      transportDisposition: 'not_dispatched',
    });
  });

  it('charges Q(U) once for a thrown or malformed invoked source and caches the failure', async () => {
    const req = request(1);
    const upperBound = blueprintAuthoringInputAccounting({
      systemPrompt: req.systemPrompt,
      userPrompt: req.userPrompt,
      schema: req.schema,
    }).estimatedBytes;
    for (const source of [
      vi.fn(async () => {
        throw new Error('unknown post-dispatch failure');
      }),
      vi.fn(async () => ({ hostile: true }) as never),
    ]) {
      const authority = createBlueprintAuthoringRunnerCountAuthority({
        source,
        generationAccountedMicroUsd: () => 1_408_000,
      });
      const result = await authority.counter(req);
      expect(result).toMatchObject({
        outcome: 'unavailable',
      });
      const event = authority.consumeProbeEvent(req)?.probe;
      expect(event).toMatchObject({
        status: 'cache_miss',
        debitMicroUsd: blueprintAuthoringInputMicroUsd(upperBound),
        transportDisposition: 'assumed_dispatched',
      });
      await authority.counter(req);
      expect(authority.consumeProbeEvent(req)?.probe).toMatchObject({
        status: 'cache_hit',
        debitMicroUsd: 0,
        transportDisposition: 'not_dispatched',
      });
      expect(source).toHaveBeenCalledTimes(1);
      expect(authority.cumulativeProbeDebitMicroUsd()).toBe(
        blueprintAuthoringInputMicroUsd(upperBound),
      );
    }
  });
});
