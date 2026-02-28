/**
 * Types for Phase 3 audio-visual lesson generation (MiniMax + ElevenLabs + Featherless).
 */

export interface AudioVisualLesson {
  topic: string;
  courseId: string;
  script: string;
  slides: Slide[];
  metadata: {
    estimatedDuration: number;
    generatedAt: string;
    model: string;
  };
}

export interface Slide {
  id: number;
  title: string;
  points: string[];
  imagePrompt: string;
  segmentText: string;
  estimatedDuration: number;
}

export interface GeneratedAssets {
  audioUrl: string;
  audioDuration: number;
  slides: SlideWithImage[];
}

export interface SlideWithImage extends Slide {
  imageUrl: string;
  imageLoading: boolean;
}

export interface GenerationRequest {
  topic: string;
  courseId: string;
  context?: string;
  userId: string;
  avatarStyle?: "strict" | "encouraging" | "socratic";
  /** podcast = script + MiniMax TTS only (slides with placeholders). slides = MiniMax slides + Featherless images only (no audio). */
  mode?: "podcast" | "slides";
  /** MiniMax TTS voice ID (e.g. English_expressive_narrator). Used for podcast mode. */
  voiceId?: string;
}

export interface GenerationResponse {
  success: boolean;
  lesson?: AudioVisualLesson;
  assets?: GeneratedAssets;
  error?: string;
  sources: { title: string; url: string }[];
}

export enum GenerationError {
  MINIMAX_FAILED = "MINIMAX_FAILED",
  ELEVENLABS_FAILED = "ELEVENLABS_FAILED",
  FEATHERLESS_FAILED = "FEATHERLESS_FAILED",
  INVALID_RESPONSE = "INVALID_RESPONSE",
  TIMEOUT = "TIMEOUT",
}
