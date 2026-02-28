/**
 * Condense course material content into a short Instagram Reels–style script
 * (2–4 sentences, ~15–30 seconds when spoken).
 */

import { chatCompletion } from "@/lib/ai/llm";

const MAX_SCRIPT_WORDS = 80;

export async function createReelScript(content: string, topic?: string): Promise<string> {
  const truncated = content.slice(0, 12_000).trim();
  if (!truncated) {
    return "No content available for this reel.";
  }

  const system = `You are a study content writer. Turn the given course material into a single short script for an Instagram Reels–style study tip. Rules:
- Output only the spoken script: 2–4 sentences, no titles or labels.
- Keep it under ${MAX_SCRIPT_WORDS} words so it fits 15–30 seconds when read aloud.
- One clear takeaway or hook. Conversational, engaging tone.
- Do not use markdown, bullet points, or hashtags. Plain text only.`;

  const user = topic
    ? `Topic focus: ${topic}\n\nCourse material:\n\n${truncated}`
    : `Course material:\n\n${truncated}`;

  const script = await chatCompletion({
    system,
    user,
    temperature: 0.6,
  });

  // Fallback if LLM returns something too long
  const words = script.split(/\s+/).filter(Boolean);
  if (words.length > MAX_SCRIPT_WORDS + 20) {
    return words.slice(0, MAX_SCRIPT_WORDS).join(" ") + ".";
  }
  return script;
}

/**
 * Create a short visual scene prompt for MiniMax text-to-video (no spoken words).
 * Describes the look and mood of the reel, not the narration.
 */
export async function createReelVisualPrompt(title: string, script: string): Promise<string> {
  const system = `You are a video director. Given a study reel title and its narration script, output a single short sentence (under 100 chars) describing the VISUAL scene only: setting, style, mood. No dialogue, no on-screen text. Example: "Abstract educational scene with soft gradients and floating geometric shapes, modern and calm."`;
  const user = `Title: ${title}\n\nNarration (for context only, do not put in video): ${script.slice(0, 300)}`;
  try {
    const prompt = await chatCompletion({ system, user, temperature: 0.6 });
    return prompt.slice(0, 500).trim() || "Educational video scene, soft lighting, abstract shapes, study theme.";
  } catch {
    return "Educational video scene, soft lighting, abstract shapes, study theme.";
  }
}
