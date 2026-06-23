/**
 * Persist / load a compiled BookVisualContract in the per-order manifest store
 * (Supabase: orders/{orderId}/visual-contracts/contract.json).
 */

import { persistJson } from '@/lib/generation-pipeline/runtime-artifact-store';
import { downloadOrderArtifactJson } from '@/lib/image-storage';
import type { BookVisualContract } from './types';

const CONTRACT_KIND = 'visual-contracts';
const CONTRACT_FILENAME = 'contract.json';

export async function persistBookVisualContract(
  orderId: string,
  contract: BookVisualContract
): Promise<{ url: string; storageKey: string }> {
  return persistJson(orderId, CONTRACT_KIND, CONTRACT_FILENAME, contract);
}

export async function loadBookVisualContract(orderId: string): Promise<BookVisualContract | null> {
  return downloadOrderArtifactJson<BookVisualContract>({
    orderId,
    kind: CONTRACT_KIND,
    filename: CONTRACT_FILENAME,
  });
}
