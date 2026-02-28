/**
 * MiniMax TTS for full podcast script (chunks long text, returns single MP3 buffer).
 * Uses api.minimax.io T2A; same as /api/generate/tts.
 */

const MINIMAX_TTS_URL = "https://api-uw.minimax.io/v1/t2a_v2";
const MINIMAX_TTS_MODEL = "speech-02-turbo";
const DEFAULT_VOICE = "English_expressive_narrator";
const MAX_CHARS_PER_REQUEST = 8000;

function getApiKey(): string {
  const key = process.env.MINIMAX_API_KEY;
  if (!key?.trim()) throw new Error("MINIMAX_API_KEY is required for podcast audio.");
  return key;
}

/** Split script into chunks that fit MiniMax TTS limit (by sentences when possible). */
function chunkScript(script: string): string[] {
  const trimmed = script.trim();
  if (!trimmed) return [];
  if (trimmed.length <= MAX_CHARS_PER_REQUEST) return [trimmed];
  const chunks: string[] = [];
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  let current = "";
  for (const s of sentences) {
    if ((current + " " + s).trim().length > MAX_CHARS_PER_REQUEST && current.length > 0) {
      chunks.push(current.trim());
      current = s;
    } else {
      current = current ? current + " " + s : s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Generate audio for one text chunk; returns buffer or null. */
async function generateChunk(apiKey: string, text: string, voiceId?: string): Promise<Buffer | null> {
  const voice = (voiceId ?? process.env.MINIMAX_TTS_VOICE ?? DEFAULT_VOICE).trim();
  const res = await fetch(MINIMAX_TTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MINIMAX_TTS_MODEL,
      text: text.slice(0, MAX_CHARS_PER_REQUEST),
      stream: false,
      voice_setting: { voice_id: voice, speed: 1, vol: 1, pitch: 0 },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
      output_format: "hex",
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.warn("[minimax-tts] chunk error", res.status, raw.slice(0, 200));
    return null;
  }
  let data: { base_resp?: { status_code?: number }; data?: { audio?: string } };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    return null;
  }
  if (data?.base_resp?.status_code !== 0 || !data?.data?.audio) return null;
  return Buffer.from(data.data.audio, "hex");
}

/**
 * Generate full podcast audio from script using MiniMax TTS.
 * Returns a single MP3 buffer or null on failure (graceful degradation).
 */
export async function generateAudioMinimax(script: string, voiceId?: string): Promise<Buffer | null> {
  if (!script?.trim()) return null;
  const apiKey = getApiKey();
  const chunks = chunkScript(script);
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const buf = await generateChunk(apiKey, chunk, voiceId);
    if (buf) buffers.push(buf);
  }
  if (buffers.length === 0) return null;
  return Buffer.concat(buffers);
}
