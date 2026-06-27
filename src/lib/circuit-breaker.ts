/**
 * Circuit breaker for LLM and external API calls.
 *
 * After `failureThreshold` consecutive failures, the circuit opens and
 * rejects all calls for `cooldownMs`. After the cooldown, the next call
 * is allowed through (half-open). If it succeeds, the circuit closes;
 * if it fails, the circuit reopens.
 *
 * Usage:
 *   const breaker = new CircuitBreaker({ name: "anthropic", failureThreshold: 5, cooldownMs: 60_000 });
 *   await breaker.run(() => callLlm(...));
 */

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;
  cooldownMs?: number;
}

type State = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private name: string;
  private failureThreshold: number;
  private cooldownMs: number;
  private state: State = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(opts: CircuitBreakerOptions) {
    this.name = opts.name;
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.cooldownMs = opts.cooldownMs ?? 60_000;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.cooldownMs) {
        this.state = "half-open";
      } else {
        throw new Error(
          `Circuit breaker "${this.name}" is OPEN. ` +
            `Cooldown remaining: ${Math.ceil((this.lastFailureTime + this.cooldownMs - now) / 1000)}s.`,
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = "open";
    }
  }

  getStatus(): { state: State; failureCount: number } {
    return { state: this.state, failureCount: this.failureCount };
  }

  /**
   * Force the breaker back to its initial closed state. Intended for tests
   * that share a module-level breaker across cases (a failure-path case can
   * otherwise leave the breaker OPEN and poison later cases). No effect on
   * runtime behavior — production code never calls this.
   */
  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}
