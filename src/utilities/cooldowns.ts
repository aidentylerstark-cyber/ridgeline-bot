/**
 * CooldownManager — auto-cleaning Map-based cooldown tracker.
 * Periodically removes expired entries to prevent memory leaks.
 */
export class CooldownManager {
  private map = new Map<string, number>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(
    private cooldownMs: number,
    cleanupIntervalMs: number = 60_000
  ) {
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  isOnCooldown(key: string): boolean {
    const lastTime = this.map.get(key);
    if (lastTime == null) return false;
    return Date.now() - lastTime < this.cooldownMs;
  }

  getRemainingMs(key: string): number {
    const lastTime = this.map.get(key);
    if (lastTime == null) return 0;
    return Math.max(0, this.cooldownMs - (Date.now() - lastTime));
  }

  set(key: string): void {
    this.map.set(key, Date.now());
  }

  private cleanup(): void {
    const now = Date.now();
    this.map.forEach((timestamp, key) => {
      if (now - timestamp > this.cooldownMs) {
        this.map.delete(key);
      }
    });
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.map.clear();
  }
}
