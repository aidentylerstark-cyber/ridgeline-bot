/**
 * TtlCache — tiny time-to-live cache for expensive, read-heavy command output.
 * Values expire after `ttlMs`. Intended for a small, fixed set of keys (e.g.
 * one per slash command), so no background cleanup is needed — stale entries
 * are simply overwritten on the next miss.
 */
export class TtlCache<T> {
  private store = new Map<string, { value: T; expiresAt: number }>();

  constructor(private ttlMs: number) {}

  /** Returns the cached value if still fresh, otherwise undefined. */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /** Invalidate a single key (or all keys if none given). */
  invalidate(key?: string): void {
    if (key === undefined) this.store.clear();
    else this.store.delete(key);
  }
}
