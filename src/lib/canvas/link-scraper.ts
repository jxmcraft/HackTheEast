/**
 * Extract links from Canvas pages and recursively fetch linked web pages for course materials.
 * Also fetches PDF and PPTX links and extracts text for agent memory.
 */

import { fetchAndExtractDocument } from "./document-extractor";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_LINKED_PAGES_PER_SOURCE = 25;
const MAX_CRAWL_DEPTH = 2;
const USER_AGENT = "HTE-Study-Companion/1.0 (Canvas course material ingestion)";

export type LinkedPageResult = {
  url: string;
  title: string;
  text: string;
};

/**
 * Extract absolute http(s) URLs from HTML (e.g. Canvas page body or assignment description).
 */
export function extractLinksFromHTML(html: string, baseUrl: string): string[] {
  if (!html || typeof html !== "string") return [];
  const base = baseUrl.trim().replace(/\/$/, "");
  const seen = new Set<string>();
  const hrefRegex = /<a\s[^>]*href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRegex.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("javascript:"))
      continue;
    try {
      const url = new URL(raw, base.startsWith("http") ? base + "/" : "https://" + base + "/");
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      const normalized = url.origin + url.pathname.replace(/\/$/, "") + (url.search || "");
      if (normalized.length > 500) continue;
      seen.add(normalized);
    } catch {
      continue;
    }
  }
  return Array.from(seen);
}

/**
 * Fetch a URL and extract main text from HTML. Returns null on failure or non-HTML.
 * Optionally returns raw HTML for link extraction (caller should use for recursion only).
 */
export async function fetchPageText(
  url: string
): Promise<(LinkedPageResult & { rawHtml?: string }) | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      cache: "no-store",
    });
    clearTimeout(timeout);
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) return null;
    const html = await res.text();
    const text = extractTextFromHTML(html);
    if (!text || text.length < 50) return null;
    const title = extractTitleFromHTML(html) || new URL(url).pathname.split("/").filter(Boolean).pop() || url;
    return { url, title: title.slice(0, 500), text: text.slice(0, 100_000), rawHtml: html };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

function extractTextFromHTML(html: string): string {
  const stripped = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return stripped;
}

function extractTitleFromHTML(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

/**
 * Recursively crawl links: fetch each URL, extract text and nested links, up to maxDepth and maxPages.
 */
export async function crawlLinkedPages(
  startUrls: string[],
  options: {
    maxPages?: number;
    maxDepth?: number;
  } = {}
): Promise<LinkedPageResult[]> {
  const maxPages = Math.min(options.maxPages ?? MAX_LINKED_PAGES_PER_SOURCE, 50);
  const maxDepth = Math.min(options.maxDepth ?? MAX_CRAWL_DEPTH, 3);
  const results: LinkedPageResult[] = [];
  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = startUrls
    .slice(0, 20)
    .map((url) => ({ url, depth: 0 }));

  while (queue.length > 0 && results.length < maxPages) {
    const { url, depth } = queue.shift()!;
    const normalized = url.replace(/#.*$/, "").replace(/\/$/, "");
    if (visited.has(normalized)) continue;
    visited.add(normalized);

    let page: LinkedPageResult | null = await fetchPageText(url);
    if (!page) {
      const doc = await fetchAndExtractDocument(url);
      if (doc) page = { url: doc.url, title: doc.title, text: doc.text };
    }
    if (!page) continue;
    results.push({ url: page.url, title: page.title, text: page.text });

    if (depth >= maxDepth) continue;
    const htmlForLinks = "rawHtml" in page && page.rawHtml ? page.rawHtml : "";
    const nestedLinks = extractLinksFromHTML(String(htmlForLinks), String(page.url ?? ""));
    const toEnqueue = nestedLinks
      .filter((u) => {
        const n = u.replace(/#.*$/, "").replace(/\/$/, "");
        return !visited.has(n);
      })
      .slice(0, 15);
    for (const u of toEnqueue) {
      queue.push({ url: u, depth: depth + 1 });
    }
  }

  return results;
}
