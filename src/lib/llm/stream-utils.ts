import "server-only";

/**
 * Shared streaming helpers for the app-side LLM stream engines (the cockpit
 * Master Agent and the Product Workspace brief generator). Extracted so the
 * abort-race loop and the resilient enqueue are defined ONCE instead of copied
 * into each engine.
 */

/**
 * Advance an async iterator one step, but reject as soon as `signal` aborts —
 * so a stalled upstream stream can never hang the turn past its abort budget.
 * Returns the iterator result; throws `signal.reason` (or a generic abort
 * error) if the signal fires first.
 */
export async function nextOrAbort<T>(
  iterator: AsyncIterator<T>,
  signal: AbortSignal,
): Promise<IteratorResult<T>> {
  const abortPromise = new Promise<never>((_, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new Error("aborted"));
      return;
    }
    signal.addEventListener(
      "abort",
      () => reject(signal.reason ?? new Error("aborted")),
      { once: true },
    );
  });
  // Prevent an unhandled-rejection warning when the iterator wins the race.
  abortPromise.catch(() => {});
  return Promise.race([iterator.next(), abortPromise]);
}

/**
 * Build a resilient enqueue bound to a ReadableStream controller: encodes text
 * and swallows the throw that happens once the consumer (downstream guard /
 * client) has gone away, latching a `consumerGone` flag so later writes no-op
 * instead of throwing repeatedly. Empty strings are skipped.
 */
export function createSafeEnqueue(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): (text: string) => void {
  let consumerGone = false;
  return (text: string): void => {
    if (consumerGone || text.length === 0) return;
    try {
      controller.enqueue(encoder.encode(text));
    } catch {
      consumerGone = true; // downstream guard terminated / client aborted
    }
  };
}
