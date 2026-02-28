/**
 * Retry logic with exponential backoff for AI/API calls.
 */

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.message.includes("invalid API key") || lastError.message.includes("401")) {
        throw lastError;
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(`[retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms:`, lastError.message);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error("Retry failed");
}
