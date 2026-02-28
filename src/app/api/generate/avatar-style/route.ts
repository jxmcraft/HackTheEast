/**
 * Avatar Style Transfer API
 * Uses Stability AI (Stable Diffusion) when STABILITY_API_KEY is set.
 * Otherwise uses MiniMax Image-01 (best for portrait/style transfer) with MINIMAX_API_KEY.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STABILITY_ENGINE = "stable-diffusion-xl-1024-v1-0";

// MiniMax Image-01: best for portrait & image-to-image; supports subject_reference (character).
const MINIMAX_IMAGE_MODEL = "image-01";

// Preserve the subject's face, gender, and identity in every style
const PRESERVE_SUBJECT =
  "Preserve the person's face, gender, and identity exactly. Same person, same appearance—only change the art style. ";

// Style definitions (used for prompt; Stability also has style_preset for extra guidance)
const STYLE_PROMPTS: Record<string, string> = {
  anime:
    "Anime portrait: Japanese animation style. Use the distinct visual language of anime—expressive eyes that match the person's own eyes, clean linework, manga aesthetic, varied color palette. Keep the subject's face, gender, and proportions recognizable; only apply anime styling.",
  pop: "Pop art portrait: 1960s pop art movement style. Bold flat colors, hard edges, halftone or Ben-Day dots like comic prints, mass-produced graphic look. Andy Warhol / Roy Lichtenstein inspired. Keep the person clearly recognizable.",
  oil: "Oil painting portrait: Classical oil portrait style. Rich brushstrokes, luminous skin tones, layered glazing, Renaissance-to-museum quality. Tactile paint texture, depth and subtle shadows. Keep the person's likeness.",
  cartoon: "Cartoon portrait: Pixar-style 3D CGI look. Expressive but relatable face, bright saturated colors, smooth forms, family-friendly appeal. Stylized yet lifelike. Keep the person's identity and gender.",
  sketch: "Pencil sketch portrait: Graphite pencil drawing. Monochrome black and white, full range of values from light to dark, visible pencil strokes, tonal gradations. Emphasis on form, shape, and three-dimensionality. Keep the person's likeness.",
  watercolor: "Watercolor portrait: Traditional watercolor painting. Transparent washes, soft edges, delicate layers, flowing pigment. Ethereal and atmospheric, subtle color transitions, opalescent skin tones. Keep the person recognizable.",
  pixel: "Pixel art portrait: 8-bit retro video game style. Image made of deliberate visible pixels, limited color palette, bold outlines, minimal shading, no anti-aliasing. NES/arcade aesthetic. Keep the person's face and gender identifiable.",
  neon: "Neon cyberpunk portrait: Neon aesthetic on dark background. Vibrant neon pink, blue, cyan, or purple glow; electric high-contrast lighting; urban futuristic mood. Glowing edges or rim light. Keep the person's face and identity clear.",
};

// Map our style keys to Stability AI style_preset (optional; guides the diffusion model)
const STABILITY_STYLE_PRESET: Record<string, string> = {
  anime: "anime",
  pop: "comic-book",
  oil: "photographic",
  cartoon: "3d-model",
  sketch: "line-art",
  watercolor: "digital-art",
  pixel: "pixel-art",
  neon: "neon-punk",
};

function getBase64Buffer(image: string): { buffer: Buffer; mime: string } {
  let base64 = image;
  let mime = "image/jpeg";
  if (image.startsWith("data:image")) {
    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mime = match[1] || "image/jpeg";
      base64 = match[2] || image;
    } else {
      base64 = image.split(",")[1] || image;
    }
  }
  return { buffer: Buffer.from(base64, "base64"), mime };
}

async function styleWithStability(
  prompt: string,
  style: string,
  imageBuffer: Buffer,
  mime: string
): Promise<{ imageUrl: string } | { error: string }> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) return { error: "STABILITY_API_KEY not set" };

  const form = new FormData();
  form.append("init_image", new Blob([imageBuffer], { type: mime }), "image.jpg");
  form.append("text_prompts[0][text]", prompt);
  form.append("text_prompts[0][weight]", "1");
  form.append("init_image_mode", "IMAGE_STRENGTH");
  form.append("image_strength", "0.45");
  form.append("cfg_scale", "7");
  form.append("steps", "30");
  form.append("samples", "1");
  const preset = STABILITY_STYLE_PRESET[style];
  if (preset) form.append("style_preset", preset);

  const response = await fetch(
    `https://api.stability.ai/v1/generation/${STABILITY_ENGINE}/image-to-image`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    }
  );

  const text = await response.text();
  if (!response.ok) {
    console.error("Stability API error:", response.status, text);
    let errMsg = "Style transfer failed.";
    try {
      const j = JSON.parse(text);
      errMsg = j.message || j.name || errMsg;
    } catch {
      errMsg = text.slice(0, 200) || errMsg;
    }
    return { error: errMsg };
  }

  let data: { artifacts?: Array<{ base64?: string; finishReason?: string }> };
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "Invalid response from Stability API" };
  }

  const artifact = data.artifacts?.[0];
  if (!artifact?.base64) return { error: "No image in Stability response" };
  if (artifact.finishReason === "CONTENT_FILTERED")
    return { error: "Content was filtered; try a different style or image." };

  return { imageUrl: `data:image/png;base64,${artifact.base64}` };
}

async function styleWithMiniMax(
  prompt: string,
  imageFile: string,
  apiKey: string,
  groupId?: string
): Promise<{ imageUrl: string } | { error: string }> {
  const url = new URL("https://api.minimax.io/v1/image_generation");
  if (groupId) url.searchParams.set("GroupId", groupId);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MINIMAX_IMAGE_MODEL,
      prompt,
      subject_reference: [{ type: "character", image_file: imageFile }],
      aspect_ratio: "1:1",
      response_format: "base64",
      n: 1,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error("MiniMax image API error:", response.status, responseText);
    let errMsg = "Style transfer failed.";
    try {
      const errJson = JSON.parse(responseText);
      errMsg = errJson.base_resp?.status_msg || errJson.error?.message || errMsg;
    } catch {
      errMsg = responseText.slice(0, 200) || errMsg;
    }
    return { error: errMsg };
  }

  const data = JSON.parse(responseText);
  const statusCode = data.base_resp?.status_code;
  if (statusCode !== undefined && statusCode !== 0) {
    const errMsg = data.base_resp?.status_msg || `API error ${statusCode}`;
    return { error: errMsg };
  }

  const base64Result = data.data?.image_base64?.[0];
  const imageUrlResult = data.data?.image_urls?.[0];
  if (base64Result) return { imageUrl: `data:image/png;base64,${base64Result}` };
  if (imageUrlResult) return { imageUrl: imageUrlResult };
  return { error: data.base_resp?.status_msg || "No image in response" };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, style } = body as { image?: string; style?: string };

    if (!image || !style) {
      return NextResponse.json(
        { error: "image and style are required" },
        { status: 400 }
      );
    }

    const prompt = PRESERVE_SUBJECT + (STYLE_PROMPTS[style] || STYLE_PROMPTS.anime);
    const { buffer, mime } = getBase64Buffer(image);

    // Prefer Stability AI (Stable Diffusion) when API key is set
    if (process.env.STABILITY_API_KEY) {
      const result = await styleWithStability(prompt, style, buffer, mime);
      if ("imageUrl" in result) return NextResponse.json(result);
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    // Use MiniMax Image-01 (best for avatar/portrait style transfer)
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "STABILITY_API_KEY or MINIMAX_API_KEY required. Add one to .env.local" },
        { status: 503 }
      );
    }
    const groupId = process.env.MINIMAX_GROUP_ID ?? undefined;

    const imageFile = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image.split(",")[1] || image}`;
    const result = await styleWithMiniMax(prompt, imageFile, apiKey, groupId);
    if ("imageUrl" in result) return NextResponse.json(result);
    return NextResponse.json({ error: result.error }, { status: 502 });
  } catch (error) {
    console.error("Avatar style API error:", error);
    return NextResponse.json(
      { error: "Failed to apply style" },
      { status: 500 }
    );
  }
}
