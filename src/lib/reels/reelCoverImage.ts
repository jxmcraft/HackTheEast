/**
 * Generate a vertical 9:16 cover image for Study Reels.
 * Uses MiniMax (preferred) or Featherless. Returns PNG buffer or null.
 */

import { chatCompletion } from "@/lib/ai/llm";

const MINIMAX_IMAGE_URL = "https://api.minimax.io/v1/image_generation";
const MINIMAX_IMAGE_MODEL = process.env.MINIMAX_IMAGE_MODEL ?? "image-01";
const FEATHERLESS_API = process.env.FEATHERLESS_API_BASE ?? "https://api.featherless.ai";
const FEATHERLESS_IMAGE_MODEL = process.env.FEATHERLESS_IMAGE_MODEL ?? "stabilityai/stable-diffusion-xl-base-1.0";
const REEL_IMAGE_WIDTH = 576;
const REEL_IMAGE_HEIGHT = 1024;

async function imagePromptFromContent(title: string, script: string): Promise<string> {
  const system = `You are a visual designer. Given a short study reel title and script, output a single concise image prompt (one line, no quotes) for a vertical cover image. Style: clean, educational, modern. No text in the image. Example: "Abstract gradient background with soft geometric shapes, study and learning theme, professional".`;
  const user = `Title: ${title}\n\nScript (first 200 chars): ${script.slice(0, 200)}`;
  return chatCompletion({ system, user, temperature: 0.7 });
}

/** Generate 9:16 cover via MiniMax. Returns PNG buffer or null. */
async function generateMinimaxReelCover(prompt: string): Promise<Buffer | null> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey?.trim()) return null;

  const fullPrompt = `${prompt}, educational, cinematic, high quality, no text overlay`;
  try {
    const res = await fetch(MINIMAX_IMAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MINIMAX_IMAGE_MODEL,
        prompt: fullPrompt.slice(0, 1500),
        aspect_ratio: "9:16",
        response_format: "base64",
        n: 1,
      }),
    });

    const text = await res.text();
    if (!res.ok) return null;

    const data = JSON.parse(text) as {
      base_resp?: { status_code?: number };
      data?: { image_base64?: string[] };
    };
    if (data?.base_resp?.status_code !== 0) return null;
    const b64 = data?.data?.image_base64?.[0];
    if (!b64) return null;
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}

/** Generate 9:16 cover via Featherless. Returns PNG buffer or null. */
async function generateFeatherlessReelCover(prompt: string): Promise<Buffer | null> {
  const apiKey = process.env.FEATHERLESS_API_KEY;
  if (!apiKey?.trim()) return null;

  const base = FEATHERLESS_API.replace(/\/$/, "");
  const url = `${base}/v1/inference`;
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
      body: JSON.stringify({
        prompt: `${prompt}, educational, cinematic, high quality, no text`,
        model: FEATHERLESS_IMAGE_MODEL,
        width: REEL_IMAGE_WIDTH,
        height: REEL_IMAGE_HEIGHT,
        num_inference_steps: 25,
        guidance_scale: 7.5,
        negative_prompt: "text, watermark, blurry",
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: Array<{ url?: string; b64?: string }>;
      images?: string[] | Array<{ url?: string }>;
    };
    const first = data?.data?.[0] ?? data?.images?.[0];
    const urlOrB64 = typeof first === "string" ? first : (first as { url?: string; b64?: string })?.url ?? (first as { b64?: string })?.b64;
    if (typeof urlOrB64 === "string") {
      if (urlOrB64.startsWith("data:")) {
        const base64 = urlOrB64.split(",")[1];
        return base64 ? Buffer.from(base64, "base64") : null;
      }
      if (urlOrB64.startsWith("http")) {
        const imgRes = await fetch(urlOrB64);
        if (!imgRes.ok) return null;
        const arr = await imgRes.arrayBuffer();
        return Buffer.from(arr);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Generate a 9:16 reel cover image; returns PNG buffer or null if no image provider. */
export async function generateReelCoverImage(title: string, script: string): Promise<Buffer | null> {
  const prompt = await imagePromptFromContent(title, script).catch(() => "Abstract educational background, soft gradient, study theme");
  const minimax = await generateMinimaxReelCover(prompt);
  if (minimax && minimax.length > 0) return minimax;
  const featherless = await generateFeatherlessReelCover(prompt);
  return featherless && featherless.length > 0 ? featherless : null;
}
