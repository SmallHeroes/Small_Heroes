export const VITEST_WORKER_CEILING = 4;

export interface VitestExecutionPolicy {
  fileParallelism: true;
  maxWorkers: number;
}

export function resolveVitestMaxWorkers(
  availableParallelism: number,
): number {
  const normalizedParallelism = Number.isFinite(
    availableParallelism,
  )
    ? Math.max(1, Math.floor(availableParallelism))
    : 1;

  return Math.min(
    VITEST_WORKER_CEILING,
    Math.max(1, normalizedParallelism - 1),
  );
}

export function createVitestExecutionPolicy(
  availableParallelism: number,
): VitestExecutionPolicy {
  return {
    fileParallelism: true,
    maxWorkers: resolveVitestMaxWorkers(
      availableParallelism,
    ),
  };
}
