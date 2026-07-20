import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const orderFindUnique = vi.fn();
const orderUpdateMany = vi.fn();
const jobCreate = vi.fn();
const jobUpdate = vi.fn();
const bookFindUnique = vi.fn();
const chainGenerationWorker = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findUnique: orderFindUnique, updateMany: orderUpdateMany },
    generationJob: { create: jobCreate, update: jobUpdate },
    generatedBook: { findUnique: bookFindUnique },
  },
}));

vi.mock('../chain-worker', () => ({ chainGenerationWorker }));
vi.mock('../env-separation-guard', () => ({
  assertProdGenerationAllowed: vi.fn(),
  assertEnvSeparation: vi.fn(),
}));

const KEYS = ['VERCEL_ENV', 'NEXT_PUBLIC_APP_URL', 'SUPABASE_URL', 'DATABASE_URL'] as const;

describe('startChunkedGeneration — exception recovery redrive', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of KEYS) saved[k] = process.env[k];
    process.env.VERCEL_ENV = 'preview';
    process.env.NEXT_PUBLIC_APP_URL = 'https://preview.vercel.app';
    process.env.SUPABASE_URL = 'https://qvksgpzzosotubcbizay.supabase.co';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
    jobCreate.mockResolvedValue({ id: 'job_1' });
    orderUpdateMany.mockResolvedValue({ count: 1 });
    jobUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.resetModules();
  });

  async function loadStart() {
    vi.resetModules();
    return import('../start');
  }

  it('rejects needs_human_qa for normal starts (Already completed)', async () => {
    const { startChunkedGeneration } = await loadStart();
    orderFindUnique.mockResolvedValue({
      id: 'order_1',
      status: 'needs_human_qa',
      storyDirectionSet: null,
      generationJob: { status: 'done' },
    });
    const result = await startChunkedGeneration('order_1', 'payme_webhook_payment_paid', {
      skipWorkerChain: true,
    });
    expect(result).toEqual({ started: false, orderId: 'order_1', message: 'Already completed' });
    expect(jobUpdate).not.toHaveBeenCalled();
  });

  it('redrives needs_human_qa when reason is exception_case_recovery', async () => {
    const { startChunkedGeneration, RECOVERY_REDRIVE_REASON } = await loadStart();
    expect(RECOVERY_REDRIVE_REASON).toBe('exception_case_recovery');
    orderFindUnique.mockResolvedValue({
      id: 'order_1',
      status: 'needs_human_qa',
      storyDirectionSet: null,
      generationJob: { status: 'done', currentStage: 'done', packaged: true, imagesDone: true },
    });
    bookFindUnique.mockResolvedValue({
      coverImageUrl: 'https://cdn/cover.webp',
      pages: [
        { imageAsset: { id: 'a1' } },
        { imageAsset: null },
      ],
    });
    const result = await startChunkedGeneration('order_1', 'exception_case_recovery', {
      skipWorkerChain: true,
    });
    expect(result).toEqual({ started: true, orderId: 'order_1' });
    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order_1', status: { in: ['paid', 'failed', 'needs_human_qa'] } },
      data: { status: 'generating' },
    });
    expect(jobUpdate).toHaveBeenCalledWith({
      where: { orderId: 'order_1' },
      data: expect.objectContaining({
        status: 'pending',
        currentStage: 'pending',
        imagesDone: false,
        packaged: false,
        completedAt: null,
        triggerReason: 'exception_case_recovery',
      }),
    });
    expect(chainGenerationWorker).not.toHaveBeenCalled();
  });

  it('(Slice A) refuses to redrive a contract_world_hold order even under recovery redrive (parked for human QA)', async () => {
    const { startChunkedGeneration } = await loadStart();
    orderFindUnique.mockResolvedValue({
      id: 'order_1',
      status: 'needs_human_qa',
      deliveryHoldReason: 'contract_world_hold:quality_failed:page:2',
      storyDirectionSet: null,
      generationJob: { status: 'done' },
    });
    const result = await startChunkedGeneration('order_1', 'exception_case_recovery', {
      skipWorkerChain: true,
    });
    expect(result.started).toBe(false);
    expect(result.message).toMatch(/contract-world drift/);
    expect(orderUpdateMany).not.toHaveBeenCalled(); // never claims the order for a re-render
    expect(jobUpdate).not.toHaveBeenCalled();
  });

  it('(Fix 5) refuses to redrive a safety_hold order even under recovery redrive (parked for human QA)', async () => {
    const { startChunkedGeneration } = await loadStart();
    orderFindUnique.mockResolvedValue({
      id: 'order_1',
      status: 'needs_human_qa',
      deliveryHoldReason: 'safety_hold:hazard:page:2:child_on_railing',
      storyDirectionSet: null,
      generationJob: { status: 'done' },
    });
    const result = await startChunkedGeneration('order_1', 'exception_case_recovery', { skipWorkerChain: true });
    expect(result.started).toBe(false);
    expect(result.message).toMatch(/physical-safety hold/);
    expect(orderUpdateMany).not.toHaveBeenCalled(); // never re-renders a safety-parked book
    expect(jobUpdate).not.toHaveBeenCalled();
  });

  it('(cutover 1.3) refuses to redrive a quarantine_cutover order even under recovery redrive (terminal park)', async () => {
    const { startChunkedGeneration } = await loadStart();
    orderFindUnique.mockResolvedValue({
      id: 'order_1',
      status: 'needs_human_qa',
      deliveryHoldReason: 'quarantine_cutover:generating',
      storyDirectionSet: null,
      generationJob: { status: 'failed' },
    });
    const result = await startChunkedGeneration('order_1', 'exception_case_recovery', { skipWorkerChain: true });
    expect(result.started).toBe(false);
    expect(result.message).toMatch(/cutover quarantine/);
    expect(orderUpdateMany).not.toHaveBeenCalled(); // never re-claims a quarantined order
    expect(jobUpdate).not.toHaveBeenCalled();
  });

  it('(Human-QA Slice 4 PARK) refuses to redrive a manual_resolution_hold order even under recovery redrive (terminal park)', async () => {
    const { startChunkedGeneration } = await loadStart();
    orderFindUnique.mockResolvedValue({
      id: 'order_1',
      status: 'needs_human_qa',
      deliveryHoldReason: 'manual_resolution_hold:anchor_low_confidence:soft_band',
      storyDirectionSet: null,
      generationJob: { status: 'done' },
    });
    const result = await startChunkedGeneration('order_1', 'exception_case_recovery', { skipWorkerChain: true });
    expect(result.started).toBe(false);
    expect(result.message).toMatch(/manual resolution/);
    expect(orderUpdateMany).not.toHaveBeenCalled(); // a manually-parked book is never auto-redriven
    expect(jobUpdate).not.toHaveBeenCalled();
  });

  it('resumes to cover stage when cover was cleared but pages remain', async () => {
    const { startChunkedGeneration } = await loadStart();
    orderFindUnique.mockResolvedValue({
      id: 'order_1',
      status: 'needs_human_qa',
      storyDirectionSet: null,
      generationJob: { status: 'done' },
    });
    bookFindUnique.mockResolvedValue({
      coverImageUrl: null,
      pages: [{ imageAsset: { id: 'a1' } }],
    });
    const result = await startChunkedGeneration('order_1', 'exception_case_recovery', {
      skipWorkerChain: true,
    });
    expect(result.started).toBe(true);
    expect(jobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ imagesDone: false }),
      }),
    );
  });
});
