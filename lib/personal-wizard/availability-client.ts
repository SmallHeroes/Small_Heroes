/** Browser-only GET refresh. undefined means unknown, not revoked authority. */
export type AvailabilityFetch = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Recheck on mount/return from sign-in without reloading an in-memory draft.
 * Only the newest response may publish; indeterminate reads keep the previous
 * value (the caller's initial value remains fail-closed). No polling or POST.
 */
export function watchAvailability<T>(
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>,
  read: () => Promise<T | undefined>,
  publish: (value: T) => void,
): () => void {
  let active = true;
  let epoch = 0;
  const refresh = async () => {
    const token = ++epoch;
    try {
      const value = await read();
      if (active && token === epoch && value !== undefined) publish(value);
    } catch {
      // A failed refresh is not a server refusal, nor grounds for an auto retry.
    }
  };
  target.addEventListener('focus', refresh);
  void refresh();
  return () => {
    active = false;
    target.removeEventListener('focus', refresh);
  };
}
