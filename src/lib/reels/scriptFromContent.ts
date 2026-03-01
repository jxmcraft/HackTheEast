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
 * Create a short visual scene prompt for MiniMax text-to-video.
 * Must specify: someone talking, 3–4 different photos/shots, and emphasise LONG / full-length video.
 */
export async function createReelVisualPrompt(title: string, script: string): Promise<string> {
  const system = `You are a video director. Given a study reel title and its narration script, output a single short visual prompt (under 200 chars) for a video. CRITICAL: Emphasise that the video must be LONG and use the FULL duration — say "long video", "full-length", "extended", or "at least 10 seconds" so the result feels substantial. Other requirements:
- The video MUST show a person talking (talking head, presenter, or educator speaking to camera).
- The video MUST include at least 3 or 4 different photos or distinct visual shots (cut between 3–4 different images, scenes, or B-roll).
Describe: who is speaking, the style, that it cuts between 3–4 images/shots, and that it is a LONG or full-length video. No on-screen text. Example: "Long full-length video: educator talking to camera, cutting between 4 different educational photos, extended and professional."`;
  const user = `Title: ${title}\n\nNarration (for context only): ${script.slice(0, 300)}`;
  try {
    const prompt = await chatCompletion({ system, user, temperature: 0.6 });
    const out = prompt.slice(0, 500).trim();
    if (out) return out;
  } catch {
    // fallback
  }
  return "Long full-length video: educator or presenter talking to camera, cuts between 3 or 4 different educational photos or scenes, extended, modern and professional.";
}
