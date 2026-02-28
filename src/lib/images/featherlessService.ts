/**
 * Featherless.ai image generation for slide backgrounds.
 * Generates images from prompts; falls back to placeholder on failure.
 * Endpoint may vary: set FEATHERLESS_API_BASE if your provider uses a different path.
 */

import type { Slide } from "@/types/audioVisual";

const FEATHERLESS_API = process.env.FEATHERLESS_API_BASE ?? "https://api.featherless.ai";
const FEATHERLESS_IMAGE_MODEL = process.env.FEATHERLESS_IMAGE_MODEL ?? "stabilityai/stable-diffusion-xl-base-1.0";
const IMAGE_WIDTH = 1024;
const IMAGE_HEIGHT = 576;

function getApiKey(): string {
  const key = process.env.FEATHERLESS_API_KEY;
  if (!key?.trim()) {
    throw new Error("FEATHERLESS_API_KEY is required for slide image generation.");
  }
  return key;
}

/**
 * Generate a single slide image from prompt. Returns URL or null on failure.
 */
export async function generateSlideImage(prompt: string): Promise<string | null> {
  const apiKey = getApiKey();
  const base = FEATHERLESS_API.replace(/\/$/, "");
  const url = `${base}/v1/inference`;

  const body = {
    prompt: `${prompt}, educational, cinematic lighting, high quality, photorealistic`,
    model: FEATHERLESS_IMAGE_MODEL,
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    num_inference_steps: 25,
    guidance_scale: 7.5,
    negative_prompt: "text, watermark, blurry, low quality, distorted",
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(base.includes("featherless") && {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://github.com/hte",
          "X-Title": "HTE Study Companion",
        }),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("[featherless] Image API error", res.status, text.slice(0, 300));
      return null;
    }

    const data = (await res.json()) as {
      data?: Array<{ url?: string }>;
      images?: string[] | Array<{ url?: string }>;
    };
    const first = data?.data?.[0] ?? data?.images?.[0];
    const urlOrB64 = typeof first === "string" ? first : (first as { url?: string })?.url;
    if (typeof urlOrB64 === "string") {
      return urlOrB64.startsWith("data:") ? urlOrB64 : urlOrB64;
    }
    return null;
  } catch (error) {
    console.error("[featherless] generateSlideImage failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Generate images for all slides in parallel. Returns map of slide id -> image URL (or empty for failed).
 */
export async function generateAllSlideImages(slides: Slide[]): Promise<Map<number, string>> {
  const results = await Promise.allSettled(
    slides.map(async (slide) => {
      try {
        const imageUrl = await generateSlideImage(slide.imagePrompt);
        return { id: slide.id, imageUrl };
      } catch (err) {
        console.error(`[featherless] Failed slide ${slide.id}:`, err);
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

/** Placeholder image when generation fails (inline gradient data URL so no file required). */
export function getPlaceholderImage(): string {
  return "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="576" viewBox="0 0 1024 576"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%232d3748"/><stop offset="100%" style="stop-color:%231a202c"/></linearGradient></defs><rect width="1024" height="576" fill="url(#g)"/></svg>'
  );
}

/** True if the URL is our placeholder (gradient), not a real generated image. */
export function isPlaceholderImage(url: string): boolean {
  return typeof url === "string" && url.startsWith("data:image/svg+xml,");
}
