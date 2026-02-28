/**
 * MiniMax image generation for slide deck backgrounds.
 * Uses api.minimax.io v1/image_generation (text-to-image). No GroupId for this endpoint.
 * Requires MINIMAX_API_KEY.
 */

import type { Slide } from "@/types/audioVisual";

const MINIMAX_IMAGE_URL = "https://api.minimax.io/v1/image_generation";
const MINIMAX_IMAGE_MODEL = process.env.MINIMAX_IMAGE_MODEL ?? "image-01";

function getApiKey(): string {
  const key = process.env.MINIMAX_API_KEY;
  if (!key?.trim()) {
    throw new Error("MINIMAX_API_KEY is required for slide image generation.");
  }
  return key;
}

/**
 * Generate a single slide image from a text prompt using MiniMax Image-01.
 * Returns a data URL (base64) or null on failure.
 */
export async function generateSlideImageMinimax(prompt: string): Promise<string | null> {
  const apiKey = getApiKey();
  const fullPrompt = `${prompt}, educational, cinematic lighting, high quality, photorealistic, no text overlay`;
  const truncated = fullPrompt.slice(0, 1500);

  try {
    const res = await fetch(MINIMAX_IMAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MINIMAX_IMAGE_MODEL,
        prompt: truncated,
        aspect_ratio: "16:9",
        response_format: "base64",
        n: 1,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      console.warn("[minimax-image] API error", res.status, text.slice(0, 300));
      return null;
    }

    let data: {
      base_resp?: { status_code?: number; status_msg?: string };
      data?: { image_base64?: string[]; image_urls?: string[] };
    };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      return null;
    }

    const statusCode = data?.base_resp?.status_code;
    if (statusCode !== undefined && statusCode !== 0) {
      console.warn("[minimax-image] status", statusCode, data?.base_resp?.status_msg);
      return null;
    }

    const base64 = data?.data?.image_base64?.[0];
    const url = data?.data?.image_urls?.[0];
    if (base64) return `data:image/png;base64,${base64}`;
    if (url) return url;
    return null;
  } catch (error) {
    console.error("[minimax-image] generateSlideImage failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Generate images for all slides using MiniMax. Returns map of slide id -> image URL (or empty for failed).
 */
export async function generateAllSlideImagesMinimax(slides: Slide[]): Promise<Map<number, string>> {
  const results = await Promise.allSettled(
    slides.map(async (slide) => {
      try {
        const imageUrl = await generateSlideImageMinimax(slide.imagePrompt);
        return { id: slide.id, imageUrl };
      } catch (err) {
        console.error(`[minimax-image] Failed slide ${slide.id}:`, err);
        return { id: slide.id, imageUrl: null as string | null };
      }
    })
  );

  const imageMap = new Map<number, string>();
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.imageUrl) {
      imageMap.set(result.value.id, result.value.imageUrl);
    }
  }
  return imageMap;
}
