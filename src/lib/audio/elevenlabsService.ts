/**
 * ElevenLabs text-to-speech for audio-visual lessons.
 * Generates audio from script and uploads to Supabase Storage.
 */

import { ElevenLabsClient } from "elevenlabs";
import { createClientOrThrow, createServiceRoleClient } from "@/utils/supabase/server";

const VOICE_RACHEL = "21m00Tcm4TlvDq8ikWAM";
const MODEL_ID = "eleven_turbo_v2_5";
const AUDIO_TIMEOUT_MS = 60_000;

function getClient(): ElevenLabsClient {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("ELEVENLABS_API_KEY is required for audio generation.");
  }
  return new ElevenLabsClient({ apiKey });
}

/** Collect stream into a Buffer (Node Readable or async iterable). */
async function streamToBuffer(stream: unknown): Promise<Buffer> {
  const chunks: Buffer[] = [];
  if (stream && typeof (stream as { on?: (e: string, fn: (chunk: unknown) => void) => void }).on === "function") {
    const r = stream as NodeJS.ReadableStream & { on(event: string, fn: (chunk: Buffer) => void): void };
    await new Promise<void>((resolve, reject) => {
      r.on("data", (chunk: Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      r.on("end", () => resolve());
      r.on("error", reject);
    });
  } else if (stream && typeof (stream as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function") {
    for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  } else {
    throw new Error("Unsupported stream type from ElevenLabs");
  }
  return Buffer.concat(chunks);
}

/**
 * Generate TTS audio from script. Returns buffer or null on failure (graceful degradation).
 */
export async function generateAudio(script: string, voiceId?: string): Promise<Buffer | null> {
  if (!script?.trim()) return null;

  const voice = voiceId?.trim() || process.env.ELEVENLABS_VOICE_ID?.trim() || VOICE_RACHEL;

  try {
    const client = getClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AUDIO_TIMEOUT_MS);

    const readable = await client.textToSpeech.convert(
      voice,
      {
        text: script.slice(0, 50_000),
        model_id: MODEL_ID,
      },
      {
        timeoutInSeconds: 60,
        abortSignal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!readable) return null;

    const buffer = await streamToBuffer(readable);
    return buffer.length > 0 ? buffer : null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("429") || msg.includes("rate limit")) {
      console.warn("[elevenlabs] Rate limited:", msg.slice(0, 200));
    } else {
      console.error("[elevenlabs] generateAudio failed:", msg);
    }
    return null;
  }
}

const BUCKET = "lesson-audio";

/**
 * Upload audio buffer to Supabase Storage and return public URL.
 * Uses service-role client so server-side uploads are not blocked by Storage RLS.
 */
export async function uploadAudioToStorage(audioBuffer: Buffer, lessonId: string): Promise<string> {
  const supabase = createServiceRoleClient();
  const fileName = `lessons/${lessonId}/audio_${Date.now()}.mp3`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, audioBuffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload audio: ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return urlData.publicUrl;
}
