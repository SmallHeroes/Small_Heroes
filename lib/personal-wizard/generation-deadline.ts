import 'server-only';
import { generationTimeoutMs } from './story-config';

/** Race even providers that ignore abort; late settlements cannot advance a job. */
export async function withGenerationDeadline<T>(outputTokens: number, signal: AbortSignal,
  error: (reason: 'timeout' | 'cancelled') => Error, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const timeoutMs = generationTimeoutMs(outputTokens);
  if (signal.aborted) throw error('cancelled');
  const controller = new AbortController();
  let rejectAbort: (error: Error) => void = () => {};
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const stop = (reason: 'timeout' | 'cancelled') => { controller.abort(); rejectAbort(error(reason)); };
  const cancel = () => stop('cancelled');
  signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => stop('timeout'), timeoutMs);
  try {
    if (signal.aborted) cancel();
    return await Promise.race([aborted, Promise.resolve().then(() => {
      if (controller.signal.aborted) throw error('cancelled');
      return operation(controller.signal);
    })]);
  } finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); }
}
