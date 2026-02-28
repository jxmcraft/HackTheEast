/**
 * Extract 2–4 key points per page/slide from parsed document text.
 * Uses LLM when available; otherwise falls back to first meaningful sentence per page.
 */

import { chatCompletion } from "@/lib/ai/llm";

export type KeyPointItem = { pageNumber: number; points: string[] };

export function fallbackKeyPoints(
  pages: { pageNumber: number; text: string }[]
): KeyPointItem[] {
  return pages.map((p) => {
    const sentences = p.text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);
    const points = sentences.slice(0, 4);
    return { pageNumber: p.pageNumber, points: points.length ? points : [p.text.slice(0, 200) || "(No content)"] };
  });
}

export async function extractKeyPointsWithLLM(
  pages: { pageNumber: number; text: string }[],
  fileName: string
): Promise<KeyPointItem[]> {
  const excerpt = pages
    .map((p) => `--- Page ${p.pageNumber} ---\n${p.text.slice(0, 1500)}`)
    .join("\n\n");
  const totalExcerpt = excerpt.slice(0, 12000);

  try {
    const raw = await chatCompletion({
      system: `You are an assistant that extracts key points from documents. Given a document "${fileName}" with content split by page/slide, return a JSON array of objects: { "pageNumber": number, "points": string[] }. Each object has 2-4 concise key points (one short sentence each) for that page. Return ONLY the JSON array, no markdown or explanation.`,
      user: `Document:\n\n${totalExcerpt}`,
      temperature: 0.3,
    });

    const cleaned = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    const parsed = JSON.parse(cleaned) as KeyPointItem[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item) => ({
        pageNumber: Number(item.pageNumber) || 0,
        points: Array.isArray(item.points) ? item.points.map(String).slice(0, 4) : [],
      }));
    }
  } catch {
    // fall through to fallback
  }
  return fallbackKeyPoints(pages);
}
