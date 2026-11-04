import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { assertEnginePolicyCurrent, configuredEngineSpendPolicy } from './platform-policy';
import { productionEnginePrivateStorage } from './private-storage';
import { loadEngineOrderSnapshot, startEnginePersonalJob } from './personal-jobs';
import { runEngineDurableInvocation, type EngineRuntime } from './durable-worker';
import { createEngineNativeRecipe } from './native-recipe';
import { engineSiteFail } from './contract';
import { createEngineMaterializer } from './materialize';
import { engineFulfillmentEnabled, reconcileEngineBook, failEngineOrder, engineSiteOrigin } from './fulfillment';

export async function startProductionPersonalJob(db: PrismaClient, orderId: string) {
  return startEnginePersonalJob(db, orderId, configuredEngineSpendPolicy());
}
export async function runProductionPersonalWorker(db: PrismaClient, orderId: string, executor: 'chunk' | 'long' = 'chunk',
  finishing?: { materialize: (r: EngineRuntime) => Promise<void>; accept: (r: EngineRuntime) => Promise<void> }) {
  // Admission before storage construction or deferred credential access. No .env/file-based key fallback.
  configuredEngineSpendPolicy();
  const loaded = await loadEngineOrderSnapshot(db, orderId), storage = productionEnginePrivateStorage();
  const key = (name: 'OPENAI_API_KEY' | 'ANTHROPIC_API_KEY') => {
    const value = process.env[name]; if (!value || /\s/.test(value)) engineSiteFail('engine_provider_credential_unavailable'); return value;
  };
  const recipe = createEngineNativeRecipe({ db, storage, snapshot: loaded.snapshot,
    ports: { fetch, openAIKey: () => key('OPENAI_API_KEY'), anthropicKey: () => key('ANTHROPIC_API_KEY') },
    materialize: createEngineMaterializer({ db, storage, snapshot: loaded.snapshot, narration: { fetch, key: () => {
      const value = process.env.ELEVENLABS_API_KEY; if (!value || /\s/.test(value)) engineSiteFail('engine_provider_credential_unavailable'); return value;
    } } }), ...finishing });
  const result = await runEngineDurableInvocation(db, orderId, { executor, storage, recipe,
    assertAdmission: async authority => {
      assertEnginePolicyCurrent(authority);
      if (authority.requestSha256 !== loaded.inputSha256) engineSiteFail('engine_worker_input_changed');
    } });
  // The paid worker lease is released before free acceptance/publication takes its Order/policy locks.
  if (engineFulfillmentEnabled()) {
    if (result.kind === 'held') await failEngineOrder(db, orderId, result.code);
    else if (result.kind === 'progress' && result.phase === 'accept') await reconcileEngineBook(db, orderId, { storage, origin: engineSiteOrigin() });
  }
  return result;
}
