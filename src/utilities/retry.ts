/**
 * Retry an async operation with exponential backoff.
 * Used by scheduled tasks to handle transient DB/network errors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; baseDelayMs?: number; label?: string }
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 2000, label = 'operation' } = options ?? {};
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[Peaches] ${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${Math.round(delay / 1000)}s...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}
