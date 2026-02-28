"use client";

import { useState, useRef, useEffect } from "react";
import type { SlideWithImage } from "@/types/audioVisual";
import { isPlaceholderImage } from "@/lib/images/featherlessService";

export type AudioVisualVariant = "podcast" | "slides";

/** MiniMax TTS voice options for podcast (matches AvatarStudio). */
export const PODCAST_VOICE_OPTIONS = [
  { value: "English_expressive_narrator", label: "Expressive Narrator" },
  { value: "English_radiant_girl", label: "Radiant Girl" },
  { value: "English_magnetic_voiced_man", label: "Magnetic Man" },
  { value: "English_compelling_lady1", label: "Compelling Lady" },
  { value: "English_captivating_female1", label: "Captivating Female" },
  { value: "English_Upbeat_Woman", label: "Upbeat Woman" },
  { value: "English_Trustworth_Man", label: "Trustworthy Man" },
  { value: "English_CalmWoman", label: "Calm Woman" },
  { value: "English_Gentle-voiced_man", label: "Gentle Man" },
  { value: "English_Graceful_Lady", label: "Graceful Lady" },
  { value: "English_PlayfulGirl", label: "Playful Girl" },
  { value: "English_FriendlyPerson", label: "Friendly Person" },
  { value: "English_Steadymentor", label: "Steady Mentor" },
  { value: "English_CaptivatingStoryteller", label: "Storyteller" },
  { value: "English_ConfidentWoman", label: "Confident Woman" },
];

const DEFAULT_VOICE_ID = "English_expressive_narrator";

export interface AudioVisualPlayerProps {
  variant: AudioVisualVariant;
  audioUrl: string;
  slides: SlideWithImage[];
  script: string;
  voiceId?: string;
  onRegenerateWithVoice?: (voiceId: string) => void;
  /** When slides have no audio, call this to generate narrator and refetch. Optional. */
  onAddNarrator?: () => Promise<void>;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5];

/** Cumulative start time (seconds) for each slide index. */
function getSlideStartTimes(slides: SlideWithImage[]): number[] {
  const out: number[] = [];
  let t = 0;
  for (const s of slides) {
    out.push(t);
    t += s.estimatedDuration ?? 0;
  }
  return out;
}

export function AudioVisualPlayer({
  variant,
  audioUrl,
  slides,
  script,
  voiceId: initialVoiceId,
  onRegenerateWithVoice,
  onAddNarrator,
}: AudioVisualPlayerProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioLoadError, setAudioLoadError] = useState(false);
  const [addingNarrator, setAddingNarrator] = useState(false);
  const [addNarratorError, setAddNarratorError] = useState<string | null>(null);
  const voiceId = initialVoiceId ?? DEFAULT_VOICE_ID;
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setAudioLoadError(false);
  }, [audioUrl]);

  const startTimes = getSlideStartTimes(slides);
  const hasAudio = !!audioUrl && !audioLoadError;
  const isPodcast = variant === "podcast";

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const currentTime = audio.currentTime;
      const duration = audio.duration;
      if (duration > 0) setProgress((currentTime / duration) * 100);

      for (let i = slides.length - 1; i >= 0; i--) {
        const start = startTimes[i] ?? 0;
        const end = i < slides.length - 1 ? (startTimes[i + 1] ?? duration) : duration;
        if (currentTime >= start && currentTime < end) {
          setCurrentSlideIndex(i);
          break;
        }
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [slides.length, startTimes]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.play().catch(() => setIsPlaying(false));
    else audio.pause();
  }, [isPlaying]);

  const slideCount = slides.length;
  const hasMultipleSlides = slideCount > 1;
  const currentSlide = slides[currentSlideIndex];
  const isPlaceholder = !!(currentSlide?.imageUrl && isPlaceholderImage(currentSlide.imageUrl));

  // Keyboard: prev/next slide in slides mode
  useEffect(() => {
    if (isPodcast || !hasMultipleSlides) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") return;
      if (e.key === "ArrowLeft") {
        setCurrentSlideIndex((s) => Math.max(0, s - 1));
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        setCurrentSlideIndex((s) => Math.min(slideCount - 1, s + 1));
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPodcast, hasMultipleSlides, slideCount]);

  const controlsAndTranscript = (
    <div className="w-full lg:w-96 bg-gray-900 p-4 lg:p-6 flex flex-col shrink-0">
      <audio
        ref={audioRef}
        src={audioUrl}
        preload={audioUrl ? "metadata" : "none"}
        onError={() => setAudioLoadError(true)}
      />

      <div className="flex items-center justify-center gap-3 lg:gap-4 mb-4 lg:mb-6">
        {!isPodcast && hasMultipleSlides && (
          <button
            type="button"
            onClick={() => setCurrentSlideIndex((s) => Math.max(0, s - 1))}
            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white cursor-pointer touch-manipulation shrink-0"
            aria-label="Previous slide"
          >
            ◀
          </button>
        )}
        {!isPodcast && hasMultipleSlides && (
          <span className="text-gray-400 text-sm tabular-nums min-w-[4rem] text-center" aria-live="polite">
            {currentSlideIndex + 1} / {slideCount}
          </span>
        )}
        <button
          type="button"
          onClick={() => setIsPlaying((p) => !p)}
          disabled={!hasAudio}
          className="p-4 rounded-full bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white cursor-pointer touch-manipulation"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        {!isPodcast && hasMultipleSlides && (
          <button
            type="button"
            onClick={() => setCurrentSlideIndex((s) => Math.min(slideCount - 1, s + 1))}
            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white cursor-pointer touch-manipulation shrink-0"
            aria-label="Next slide"
          >
            ▶
          </button>
        )}
      </div>

      {hasAudio && (
        <div className="w-full h-2 bg-gray-700 rounded mb-4 lg:mb-6">
          <div
            className="h-full bg-green-500 rounded transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Speed</span>
          <select
            value={playbackRate}
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
            className="rounded bg-gray-700 text-white text-sm px-2 py-1 border-0"
            aria-label="Playback speed"
          >
            {PLAYBACK_RATES.map((r) => (
              <option key={r} value={r}>
                {r === 1 ? "1×" : `${r}×`}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Voice</span>
          {onRegenerateWithVoice ? (
            <select
              value={voiceId}
              onChange={(e) => {
                const v = e.target.value;
                if (v && v !== voiceId) onRegenerateWithVoice(v);
              }}
              className="rounded bg-gray-700 text-white text-sm px-2 py-1 border-0"
              aria-label="Voice"
            >
              {PODCAST_VOICE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-white text-sm">
              {PODCAST_VOICE_OPTIONS.find((o) => o.value === voiceId)?.label ?? "Default"}
            </span>
          )}
        </div>
      </div>

      {(!hasAudio || audioLoadError) && (
        <p className="text-gray-400 text-sm mb-4">
          {isPodcast
            ? "Audio could not be loaded or generated. Try “Regenerate podcast” below with a different voice if needed."
            : "Narrator audio is not available. Use “Add narrator audio” below, or regenerate the slide deck / convert to podcast for audio."}
        </p>
      )}
      {!isPodcast && !hasAudio && script.trim() && onAddNarrator && (
        <div className="mb-4">
          <button
            type="button"
            onClick={async () => {
              setAddNarratorError(null);
              setAddingNarrator(true);
              try {
                await onAddNarrator();
              } catch (e) {
                setAddNarratorError(e instanceof Error ? e.message : "Failed to add narrator");
              } finally {
                setAddingNarrator(false);
              }
            }}
            disabled={addingNarrator}
            className="rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
          >
            {addingNarrator ? "Adding narrator audio…" : "Add narrator audio"}
          </button>
          {addNarratorError && (
            <p className="text-amber-400 text-sm mt-2">{addNarratorError}</p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        {!isPodcast && <h3 className="text-white font-bold mb-2 lg:mb-3">Transcript</h3>}
        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{script}</p>
      </div>
    </div>
  );

  if (isPodcast) {
    return (
      <div className="flex flex-col min-h-[70vh] bg-gray-900 rounded-xl border border-[var(--border)]">
        <div className="flex-1 flex flex-col p-4 lg:p-8 max-w-2xl mx-auto w-full">
          <audio
            ref={audioRef}
            src={audioUrl}
            preload={audioUrl ? "metadata" : "none"}
            onError={() => setAudioLoadError(true)}
          />
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              disabled={!hasAudio}
              className="p-4 rounded-full bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
          </div>
          {hasAudio && (
            <div className="w-full h-2 bg-gray-700 rounded mb-6">
              <div
                className="h-full bg-green-500 rounded transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Speed</span>
              <select
                value={playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                className="rounded bg-gray-700 text-white text-sm px-2 py-1 border-0"
                aria-label="Playback speed"
              >
                {PLAYBACK_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r === 1 ? "1×" : `${r}×`}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Voice</span>
              {onRegenerateWithVoice ? (
                <select
                  value={voiceId}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v && v !== voiceId) onRegenerateWithVoice(v);
                  }}
                  className="rounded bg-gray-700 text-white text-sm px-2 py-1 border-0"
                  aria-label="Voice"
                >
                  {PODCAST_VOICE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-white text-sm">
                  {PODCAST_VOICE_OPTIONS.find((o) => o.value === voiceId)?.label ?? "Default"}
                </span>
              )}
            </div>
          </div>
          {(!hasAudio || audioLoadError) && (
            <p className="text-gray-400 text-sm mb-4">
              Audio could not be loaded or generated. Try “Regenerate podcast” below with a different voice if needed.
            </p>
          )}
          <div className="flex-1 overflow-y-auto">
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{script}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-[70vh] bg-gray-900 rounded-xl border border-[var(--border)]">
      <div className="flex-1 relative bg-black min-h-[40vh] lg:min-h-0">
        {currentSlide?.imageUrl ? (
          <img
            src={currentSlide.imageUrl}
            alt={currentSlide.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" />
        )}
        {isPlaceholder && (
          <div className="absolute top-4 left-4 right-4 text-center">
            <span className="inline-block px-3 py-1.5 rounded bg-black/60 text-gray-300 text-sm">
              Slide image could not be generated for this slide
            </span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 lg:p-8">
          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-3 lg:mb-4">
            {currentSlide?.title ?? "Slide"}
          </h2>
          <ul className="space-y-2">
            {(currentSlide?.points ?? []).map((point, i) => (
              <li key={i} className="text-white text-base lg:text-xl flex items-start">
                <span className="text-green-400 mr-3">•</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {controlsAndTranscript}
    </div>
  );
}

export function AudioVisualLoading({
  step,
  progress,
  mode = "podcast",
}: { step?: string | null; progress?: number | null; mode?: "podcast" | "slides" } = {}) {
  const progressNum = typeof progress === "number" && progress >= 0 ? progress : 0;
  const title = mode === "slides" ? "Generating slide deck" : "Generating podcast";
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-gray-900 rounded-xl border border-[var(--border)]">
      <div className="text-center max-w-md w-full px-6 py-8">
        <div
          className="animate-spin w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-6"
          aria-hidden
        />
        <h2 className="text-white text-2xl font-semibold mb-1">{title}</h2>
        <p className="text-gray-400 text-lg mb-6">{step ?? "Preparing…"}</p>
        <div className="w-full space-y-2">
          <div className="h-3 w-full bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(2, progressNum))}%` }}
            />
          </div>
          <p className="text-gray-400 text-sm font-medium">{Math.round(progressNum)}%</p>
        </div>
        <p className="text-gray-500 text-sm mt-4">This may take a minute. Do not close this page.</p>
      </div>
    </div>
  );
}
