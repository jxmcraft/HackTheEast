/**
 * Web search fallback for when course materials are missing or low relevance.
 * Optional: set SEARCH_API_KEY or use a server-side search API to augment context.
 */

export type WebSearchResult = {
  title: string;
  url: string;
  snippet?: string;
  relevance?: number;
};

const SEARCH_TIMEOUT_MS = 10_000;

/**
 * Search the web for educational content on a topic.
 * Returns null if no API is configured or search fails (caller falls back to general knowledge).
 */
export async function searchWebForTopic(
  topic: string,
  _courseInfo?: { courseName?: string }
): Promise<WebSearchResult[] | null> {
  // Optional: integrate with SERP API, Bing Search API, or similar.
  // For now, no API key = no web search; fall back to Tier 1.
  const apiKey = process.env.SEARCH_API_KEY ?? process.env.SERP_API_KEY;
  if (!apiKey) return null;

  const query = `${topic} explained university lecture`.slice(0, 200);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    // Example: SERP API (https://serpapi.com/) or similar
    const res = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { organic_results?: Array<{ title?: string; link?: string; snippet?: string }> };
    const results = data?.organic_results ?? [];
    return results.slice(0, 5).map((r) => ({
      title: r.title ?? "Source",
      url: r.link ?? "#",
      snippet: r.snippet,
      relevance: 0.8,
    }));
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

/**
 * Combine base context (course materials) with web search snippets.
 * Higher weight to course materials when both exist.
 */
export function augmentWithWebContent(baseContext: string, webContent: string): string {
  if (!baseContext.trim()) return webContent;
  if (!webContent.trim()) return baseContext;
  return `${baseContext}\n\n--- Additional web sources ---\n${webContent}`;
}
