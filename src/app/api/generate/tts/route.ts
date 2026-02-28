/**
 * Text-to-Speech API for revision / avatar voice
 * Uses MiniMax T2A when MINIMAX_API_KEY is set. Returns MP3 as base64 for playback.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MINIMAX_TTS_MODEL = "speech-02-turbo";
const DEFAULT_VOICE = "English_expressive_narrator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { text, speed = 1, voice_id: voiceId } = body as {
      text?: string;
      speed?: number;
      voice_id?: string;
    };

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "text is required and must be non-empty" },
        { status: 400 }
      );
    }

    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "MINIMAX_API_KEY not configured" },
        { status: 503 }
      );
    }

    const speedClamped = Math.min(2, Math.max(0.5, Number(speed) || 1));
    const voice = voiceId && voiceId.trim() ? voiceId.trim() : DEFAULT_VOICE;

    // Use api-uw for reduced Time-to-First-Audio (TTFA)
    const response = await fetch("https://api-uw.minimax.io/v1/t2a_v2", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MINIMAX_TTS_MODEL,
        text: text.trim().slice(0, 10000),
        stream: false,
        voice_setting: {
          voice_id: voice,
          speed: speedClamped,
          vol: 1,
          pitch: 0,
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: "mp3",
          channel: 1,
        },
        output_format: "hex",
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      console.error("MiniMax TTS error:", response.status, raw);
      let errMsg = "TTS failed.";
      try {
        const j = JSON.parse(raw);
        errMsg = j.base_resp?.status_msg || j.message || errMsg;
      } catch {
        errMsg = raw.slice(0, 200) || errMsg;
      }
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    const data = JSON.parse(raw);
    if (data.base_resp?.status_code !== 0) {
      const errMsg = data.base_resp?.status_msg || "TTS failed";
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    const hexAudio = data.data?.audio;
    if (!hexAudio || typeof hexAudio !== "string") {
      return NextResponse.json({ error: "No audio in response" }, { status: 502 });
    }

    const buffer = Buffer.from(hexAudio, "hex");
    const base64 = buffer.toString("base64");

    return NextResponse.json({
      audioBase64: base64,
      format: "mp3",
    });
  } catch (error) {
    console.error("TTS API error:", error);
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    );
  }
}
