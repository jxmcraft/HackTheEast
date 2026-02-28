/**
 * Extract text from PDF and PPTX for agent memory.
 * Used for linked documents and Canvas file items.
 * pdf-parse (and pdfjs-dist) are loaded only when parsing a PDF to avoid
 * "Object.defineProperty called on non-object" in Next.js server webpack context.
 */

import JSZip from "jszip";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_PPTX_SIZE = 30 * 1024 * 1024; // 30 MB

export type DocumentResult = {
  url: string;
  title: string;
  text: string;
};

function isPdfUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith(".pdf");
  } catch {
    return false;
  }
}

function isPptxUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith(".pptx");
  } catch {
    return false;
  }
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string | null> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    return result?.text?.trim() || null;
  } catch {
    return null;
  }
}

/** Extract text from PPTX (zip of XML slides); reads <a:t> and similar text nodes. */
export async function extractTextFromPptxBuffer(buffer: Buffer): Promise<string | null> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slides: string[] = [];
    const slideNames = Object.keys(zip.files).filter((n) => n.match(/^ppt\/slides\/slide\d+\.xml$/i));
    slideNames.sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ""), 10);
      const nb = parseInt(b.replace(/\D/g, ""), 10);
      return na - nb;
    });
    for (const name of slideNames) {
      const file = zip.files[name];
      if (file.dir) continue;
      const xml = await file.async("string");
      const textMatches = xml.match(/<a:t>([^<]*)<\/a:t>/g);
      if (textMatches) {
        const parts = textMatches.map((m) => m.replace(/<\/?a:t>/g, "").trim()).filter(Boolean);
        if (parts.length) slides.push(parts.join(" "));
      }
    }
    const text = slides.join("\n\n").replace(/\s+/g, " ").trim();
    return text.length >= 20 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Fetch a URL and extract text if it's PDF or PPTX.
 * Optional headers (e.g. Authorization) for Canvas file URLs.
 */
export async function fetchAndExtractDocument(
  url: string,
  options?: { headers?: Record<string, string> }
): Promise<DocumentResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "HTE-Study-Companion/1.0", ...options?.headers },
      redirect: "follow",
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    const isPdf =
      contentType.includes("application/pdf") || isPdfUrl(url);
    const isPptx =
      contentType.includes("application/vnd.openxmlformats-officedocument.presentationml") ||
      contentType.includes("application/vnd.ms-powerpoint") ||
      isPptxUrl(url);
    const buf = Buffer.from(await res.arrayBuffer());
    if (isPdf && buf.length <= MAX_PDF_SIZE) {
      const text = await extractTextFromPdfBuffer(buf);
      if (text) {
        const title = url.split("/").filter(Boolean).pop() ?? url;
        return { url, title: title.slice(0, 500), text: text.slice(0, 150_000) };
      }
    }
    if (isPptx && buf.length <= MAX_PPTX_SIZE) {
      const text = await extractTextFromPptxBuffer(buf);
      if (text) {
        const title = url.split("/").filter(Boolean).pop() ?? url;
        return { url, title: title.slice(0, 500), text: text.slice(0, 150_000) };
      }
    }
    return null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}
