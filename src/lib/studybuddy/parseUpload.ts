/**
 * Parse uploaded PDF, DOCX, PPTX and extract text (and optional per-page/slide chunks for key points).
 */

import mammoth from "mammoth";
import JSZip from "jszip";

export type ParsedDoc = {
  extractedText: string;
  pages: { pageNumber: number; text: string }[];
};

const MAX_TEXT_LENGTH = 500_000;

function truncate(s: string, max: number = MAX_TEXT_LENGTH): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n\n[Content truncated...]";
}

export async function parsePDF(buffer: Buffer): Promise<ParsedDoc> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();
  const full = truncate(result?.text?.trim() || "");
  const resultAny = result as { pages?: Array<{ num: number; text?: string }>; total?: number };
  const numPages = Math.max(1, resultAny?.total ?? 1);
  const pages: { pageNumber: number; text: string }[] = [];
  if (Array.isArray(resultAny?.pages) && resultAny.pages.length > 0) {
    for (const p of resultAny.pages) {
      pages.push({ pageNumber: p.num ?? pages.length + 1, text: (p.text || "").trim() || "(No text)" });
    }
  }
  if (pages.length === 0) {
    const chunkSize = Math.ceil(full.length / numPages);
    for (let i = 0; i < numPages; i++) {
      const start = i * chunkSize;
      const end = i === numPages - 1 ? full.length : (i + 1) * chunkSize;
      pages.push({ pageNumber: i + 1, text: full.slice(start, end).trim() || "(No text)" });
    }
  }
  if (pages.length === 0) pages.push({ pageNumber: 1, text: full || "(No text)" });
  return { extractedText: full, pages };
}

export async function parseDOCX(buffer: Buffer): Promise<ParsedDoc> {
  const result = await mammoth.extractRawText({ buffer });
  const full = truncate(result.value || "");
  const paragraphs = full.split(/\n\s*\n/).filter((p) => p.trim());
  const pageSize = Math.max(1, Math.ceil(paragraphs.length / 10));
  const pages: { pageNumber: number; text: string }[] = [];
  for (let i = 0; i < paragraphs.length; i += pageSize) {
    const chunk = paragraphs.slice(i, i + pageSize).join("\n\n");
    pages.push({ pageNumber: pages.length + 1, text: chunk });
  }
  if (pages.length === 0) pages.push({ pageNumber: 1, text: full || "(No text)" });
  return { extractedText: full, pages };
}

/** Extract text from PPTX (Office Open XML: zip of XML files). */
export async function parsePPTX(buffer: Buffer): Promise<ParsedDoc> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((n) => n.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ""), 10);
      const nb = parseInt(b.replace(/\D/g, ""), 10);
      return na - nb;
    });

  const pages: { pageNumber: number; text: string }[] = [];
  const allTexts: string[] = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("string");
    const text = extractTextFromSlideXml(xml);
    pages.push({ pageNumber: i + 1, text });
    allTexts.push(text);
  }

  const full = truncate(allTexts.join("\n\n"));
  if (pages.length === 0) pages.push({ pageNumber: 1, text: full || "(No text)" });
  return { extractedText: full, pages };
}

function extractTextFromSlideXml(xml: string): string {
  const texts: string[] = [];
  const tMatch = xml.match(/<a:t>([^<]*)<\/a:t>/g);
  if (tMatch) {
    tMatch.forEach((m) => {
      const inner = m.replace(/<\/?a:t>/g, "");
      if (inner) texts.push(inner);
    });
  }
  return texts.join(" ").trim() || "(No text)";
}

export async function parseFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ParsedDoc> {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (mimeType === "application/pdf" || ext === "pdf") return parsePDF(buffer);
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  )
    return parseDOCX(buffer);
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === "pptx"
  )
    return parsePPTX(buffer);
  throw new Error("Unsupported file type. Use PDF, DOCX, or PPTX.");
}
