/**
 * Extract links from Canvas pages and recursively fetch linked web pages for course materials.
 * - Canvas page links: resolved via Canvas API when resolveCanvasPage is provided.
 * - File links (PDF, DOCX, PPTX): downloaded and extracted; buffer returned for storage.
 * - Other URLs: fetched as HTML and text extracted.
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
  rawHtml?: string;
  /** When this result came from a document (PDF/DOCX/PPTX), the original file buffer for storage. */
  fileBinary?: Buffer;
  fileContentType?: string;
  fileFileName?: string;
  /** True when this result was fetched via Canvas API (resolveCanvasPage); treat as course page, not "linked". */
  isCanvasPage?: boolean;
};

/** Return true if the URL looks like a document we can download and extract. */
export function isDocumentUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(pdf|docx|pptx)(\?|$)/i.test(path);
  } catch {
    return false;
  }
}

/**
 * Parse a URL that points to a Canvas course page (e.g. .../courses/123/pages/lecture-notes).
 * Returns { courseId, pageSlug } or null if not a Canvas page URL.
 */
export function parseCanvasPageUrl(url: string, baseUrl: string): { courseId: string; pageSlug: string } | null {
  try {
    const u = new URL(url);
    const base = new URL(baseUrl);
    if (u.origin !== base.origin) return null;
    const match = u.pathname.match(/\/courses\/(\d+)\/pages\/([^/?#]+)/i);
    if (!match) return null;
    return { courseId: match[1], pageSlug: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
}

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
 * Recursively crawl links: resolve Canvas pages via API, download document links (PDF/DOCX/PPTX), else fetch HTML.
 */
export async function crawlLinkedPages(
  startUrls: string[],
  options: {
    maxPages?: number;
    maxDepth?: number;
    /** If provided, called first for each URL; when it returns a result, that URL is treated as a Canvas page and not fetched directly. */
    resolveCanvasPage?: (url: string) => Promise<LinkedPageResult | null>;
    /** Optional extra headers for document fetches (e.g. Authorization for Canvas file URLs). */
    documentHeaders?: Record<string, string>;
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

    let page: LinkedPageResult | null = null;
    let fromCanvasApi = false;

    if (options.resolveCanvasPage) {
      page = await options.resolveCanvasPage(url);
      if (page) fromCanvasApi = true;
    }
    if (!page && isDocumentUrl(url)) {
      const doc = await fetchAndExtractDocument(url, { headers: options.documentHeaders });
      if (doc) {
        const fileName = url.split("/").filter(Boolean).pop()?.replace(/\?.*$/, "") ?? "document";
        page = {
          url: doc.url,
          title: doc.title,
          text: doc.text,
          fileBinary: doc.buffer,
          fileContentType: doc.contentType,
          fileFileName: fileName,
        };
      }
    }
    if (!page) {
      page = await fetchPageText(url);
    }
    if (!page) {
      const doc = await fetchAndExtractDocument(url, { headers: options.documentHeaders });
      if (doc) {
        const fileName = url.split("/").filter(Boolean).pop()?.replace(/\?.*$/, "") ?? "document";
        page = {
          url: doc.url,
          title: doc.title,
          text: doc.text,
          fileBinary: doc.buffer,
          fileContentType: doc.contentType,
          fileFileName: fileName,
        };
      }
    }
    if (!page) continue;
    results.push({
      url: page.url,
      title: page.title,
      text: page.text,
      fileBinary: page.fileBinary,
      fileContentType: page.fileContentType,
      fileFileName: page.fileFileName,
      isCanvasPage: fromCanvasApi,
    });

    // Only follow links to document files (PDF/DOCX/PPTX). Do not recursively fetch other HTML pages.
    if (depth >= maxDepth) continue;
    const htmlForLinks = page.rawHtml ?? "";
    const nestedLinks = extractLinksFromHTML(String(htmlForLinks), String(page.url ?? ""));
    const documentLinksOnly = nestedLinks.filter((u) => isDocumentUrl(u));
    const toEnqueue = documentLinksOnly
      .filter((u) => {
        const n = u.replace(/#.*$/, "").replace(/\/$/, "");
        return !visited.has(n);
      })
      .slice(0, 20);
    for (const u of toEnqueue) {
      queue.push({ url: u, depth: depth + 1 });
    }
  }

  return results;
}
