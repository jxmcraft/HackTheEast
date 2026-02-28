/**
 * Orchestrates MiniMax (structure), MiniMax TTS (podcast), and MiniMax Image (slide deck) by mode.
 * Podcast mode: MiniMax structure + MiniMax TTS only; slides get placeholders.
 * Slides mode: MiniMax structure + MiniMax Image for slide backgrounds; no audio.
 */

import type {
  AudioVisualLesson,
  GenerationRequest,
  GenerationResponse,
  GeneratedAssets,
  Slide,
  SlideWithImage,
} from "@/types/audioVisual";
import { generateLessonStructure } from "./minimaxService";
import { generateAudioMinimax } from "@/lib/audio/minimaxTtsService";
import { uploadAudioToStorage } from "@/lib/audio/elevenlabsService";
import { generateAllSlideImagesMinimax } from "@/lib/images/minimaxImageService";
import { getPlaceholderImage } from "@/lib/images/featherlessService";

const WORDS_PER_MINUTE = 150;

function calculateDuration(script: string): number {
  const wordCount = script.split(/\s+/).filter(Boolean).length;
  return Math.ceil((wordCount / WORDS_PER_MINUTE) * 60);
}

function slideSegmentDuration(segmentText: string): number {
  const wordsPerSecond = 2.5;
  const words = segmentText.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / wordsPerSecond));
}

/**
 * Generate audio-visual lesson by mode:
 * - podcast: MiniMax structure + MiniMax TTS (audio only); slides use placeholders.
 * - slides: MiniMax structure + MiniMax Image for slide images + MiniMax TTS for narrator audio (same voice as podcast).
 */
export async function generateAudioVisualLesson(request: GenerationRequest): Promise<GenerationResponse> {
  const { topic, courseId, context, avatarStyle, mode, voiceId } = request;
  const isPodcast = mode !== "slides";
  const isSlides = mode === "slides";

  try {
    console.log("Step 1: Generating lesson structure with MiniMax...");
    const lessonStructure = await generateLessonStructure(
      topic,
      context ?? "",
      avatarStyle ?? "encouraging"
    );

    const slides: Slide[] = lessonStructure.slides.map((s, i) => ({
      ...s,
      id: i + 1,
      estimatedDuration: slideSegmentDuration(s.segmentText),
    }));

    const lessonId = `${courseId}_${Date.now()}`;
    const estimatedDurationSec = calculateDuration(lessonStructure.script);

    let audioUrl = "";
    const audioDurationSec = estimatedDurationSec;

    if (isPodcast) {
      console.log("Step 2 (podcast): Generating audio with MiniMax TTS...");
      const audioBuffer = await generateAudioMinimax(lessonStructure.script, voiceId);
      if (audioBuffer) {
        try {
          audioUrl = await uploadAudioToStorage(audioBuffer, lessonId);
        } catch (uploadErr) {
          console.warn("[audioVisual] Audio upload failed:", uploadErr);
        }
      }
      // Podcast mode: no Featherless; use placeholders for slides
    }

    if (isSlides) {
      console.log("Step 2 (slides): Generating slide images with MiniMax Image...");
    }

    const imageUrls =
      isSlides ? await generateAllSlideImagesMinimax(slides) : new Map<number, string>();

    if (isSlides && !audioUrl) {
      console.log("Step 3 (slides): Generating narrator audio with MiniMax TTS (podcast voice)...");
      const audioBuffer = await generateAudioMinimax(lessonStructure.script, voiceId);
      if (audioBuffer) {
        try {
          audioUrl = await uploadAudioToStorage(audioBuffer, lessonId);
        } catch (uploadErr) {
          console.warn("[audioVisual] Slide deck audio upload failed:", uploadErr);
        }
      }
    }

    const slidesWithImages: SlideWithImage[] = slides.map((slide) => ({
      ...slide,
      imageUrl: imageUrls.get(slide.id) ?? getPlaceholderImage(),
      imageLoading: false,
    }));

    const lesson: AudioVisualLesson = {
      topic,
      courseId,
      script: lessonStructure.script,
      slides,
      metadata: {
        estimatedDuration: estimatedDurationSec,
        generatedAt: new Date().toISOString(),
        model: process.env.MINIMAX_CHAT_MODEL ?? "M2-her",
      },
    };

    const assets: GeneratedAssets = {
      audioUrl,
      audioDuration: audioDurationSec,
      slides: slidesWithImages,
    };

    return {
      success: true,
      lesson,
      assets,
      sources: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[audioVisual] Generation failed:", message);
    return {
      success: false,
      error: message,
      sources: [],
    };
  }
}
