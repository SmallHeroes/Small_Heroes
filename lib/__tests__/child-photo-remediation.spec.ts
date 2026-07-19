import { describe, it, expect } from 'vitest';
import {
  remediateResidueReferences, resolveRemediationMode, orderHoldsChildPhotoReference,
  type RemediationOrder, type RemediationDeps,
} from '@/lib/child-photo-audit';
import { buildCharacterAnchorsAfterPhotoDeletion } from '@/lib/child-photo-deletion-policy';

const BUCKET = 'book-images';
const url = (k: string) => `https://p.supabase.co/storage/v1/object/public/${BUCKET}/${k}`;

function recorder() {
  const events: string[] = [];
  const cleared: string[] = [];
  const deps: RemediationDeps = {
    deleteObject: async (k) => { events.push(`del:${k}`); return { ok: true }; },
    clearReference: async (id) => { events.push(`clear:${id}`); cleared.push(id); },
    migrateObject: async (k) => { events.push(`mig:${k}`); },
  };
  return { deps, events, cleared };
}

describe('remediateResidueReferences (Finding 2 — order-driven, storage-independent)', () => {
  it('a residue order whose object is ALREADY GONE → reference cleared (dangling)', async () => {
    const o: RemediationOrder = { id: 'o1', status: 'failed', retryable: false, childImageUrl: url('orders/OLD/draft-a/references/main-child-1.jpg'), characterAnchors: null };
    const { deps, cleared } = recorder();
    const res = await remediateResidueReferences([o], new Set(), BUCKET, deps); // existing empty → object gone
    expect(cleared).toEqual(['o1']);
    expect(res).toMatchObject({ referencesCleared: 1, danglingCleared: 1, objectsDeleted: 0, aborted: [] });
  });

  it('a failed+retryable=true order (object gone) → NOT cleared (ambivalent may recover)', async () => {
    const o: RemediationOrder = { id: 'o2', status: 'failed', retryable: true, childImageUrl: url('orders/o2/references/main-child-1.jpg'), characterAnchors: null };
    const { deps, cleared } = recorder();
    const res = await remediateResidueReferences([o], new Set(), BUCKET, deps);
    expect(cleared).toEqual([]);
    expect(res.referencesCleared).toBe(0);
  });

  it('a residue order whose object STILL EXISTS → object deleted FIRST, then reference cleared', async () => {
    const key = 'orders/o3/references/main-child-1.jpg';
    const o: RemediationOrder = { id: 'o3', status: 'ready', childImageUrl: url(key), characterAnchors: null };
    const { deps, events } = recorder();
    const res = await remediateResidueReferences([o], new Set([key]), BUCKET, deps);
    expect(events).toEqual([`mig:${key}`, `del:${key}`, 'clear:o3']); // object-first (migrate→delete→clear)
    expect(res).toMatchObject({ referencesCleared: 1, danglingCleared: 0, objectsDeleted: 1 });
  });

  it('an object-delete FAILURE aborts before the field is touched (never orphan a live object)', async () => {
    const key = 'orders/o4/references/main-child-1.jpg';
    const o: RemediationOrder = { id: 'o4', status: 'failed', retryable: false, childImageUrl: url(key), characterAnchors: null };
    const cleared: string[] = [];
    const deps: RemediationDeps = { deleteObject: async () => ({ ok: false, error: 'boom' }), clearReference: async (id) => { cleared.push(id); } };
    const res = await remediateResidueReferences([o], new Set([key]), BUCKET, deps);
    expect(cleared).toEqual([]);            // reference NOT cleared
    expect(res.aborted).toEqual(['o4']);
    expect(res.referencesCleared).toBe(0);
  });

  it('a reference held ONLY in characterAnchars is still remediated; alreadyCleared ids are skipped', async () => {
    const o: RemediationOrder = { id: 'o6', status: 'failed', retryable: false, childImageUrl: null, characterAnchors: { _privacy: { originalChildPhotoUrl: url('orders/o6/references/main-child-1.jpg') } } };
    const { deps, cleared } = recorder();
    await remediateResidueReferences([o], new Set(), BUCKET, deps);
    expect(cleared).toEqual(['o6']);
    const r2 = recorder();
    await remediateResidueReferences([o], new Set(), BUCKET, r2.deps, { alreadyCleared: new Set(['o6']) });
    expect(r2.cleared).toEqual([]); // pass 1 already handled it
  });
});

describe('orderHoldsChildPhotoReference', () => {
  it('true for childImageUrl OR a nested originalChildPhotoUrl; false otherwise', () => {
    expect(orderHoldsChildPhotoReference({ childImageUrl: url('x/y.jpg'), characterAnchors: null })).toBe(true);
    expect(orderHoldsChildPhotoReference({ childImageUrl: null, characterAnchors: { _privacy: { originalChildPhotoUrl: url('x/y.jpg') } } })).toBe(true);
    expect(orderHoldsChildPhotoReference({ childImageUrl: null, characterAnchors: null })).toBe(false);
  });
});

describe('the nested characterAnchors fields are scrubbed, not just childImageUrl', () => {
  it('buildCharacterAnchorsAfterPhotoDeletion removes originalChildPhotoUrl + child.sourceImageUrl', () => {
    const after = buildCharacterAnchorsAfterPhotoDeletion({ _privacy: { originalChildPhotoUrl: 'https://x' }, child: { sourceImageUrl: 'https://y' } }, 'completed') as { _privacy: Record<string, unknown>; child: Record<string, unknown> };
    expect(after._privacy.originalChildPhotoUrl).toBeUndefined();
    expect(after.child.sourceImageUrl).toBeUndefined();
    expect(after._privacy.childPhotoDeletedAt).toBeDefined();
  });
});

describe('resolveRemediationMode — a destructive flag without acknowledgement is a HARD error', () => {
  it('--delete-residue / --migrate-residue without ack → error (never a silent report)', () => {
    expect(resolveRemediationMode({ deleteResidue: true, migrateResidue: false, ack: false })).toMatchObject({ ok: false });
    expect(resolveRemediationMode({ deleteResidue: false, migrateResidue: true, ack: false })).toMatchObject({ ok: false });
  });
  it('with ack → delete / migrate; no flags → report', () => {
    expect(resolveRemediationMode({ deleteResidue: true, migrateResidue: false, ack: true })).toEqual({ ok: true, mode: 'delete' });
    expect(resolveRemediationMode({ deleteResidue: false, migrateResidue: true, ack: true })).toEqual({ ok: true, mode: 'migrate' });
    expect(resolveRemediationMode({ deleteResidue: false, migrateResidue: false, ack: false })).toEqual({ ok: true, mode: 'report' });
  });
});
