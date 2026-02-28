/**
 * Video Teaching Component - Lecture Style
 * Features:
 * - Avatar top-right, slides center (lecture video layout)
 * - Preloaded TTS, subtitle synced to audio
 * - Verbose LLM-expanded script with teaching style
 * - Customized slides (charts, definitions)
 */

"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipForward, SkipBack, Volume2, Settings, ArrowLeft, MessageCircle, BookOpen, X, Loader2, Maximize2, Minimize2, ChevronDown, ChevronUp, Bookmark, BookmarkCheck } from "lucide-react";
import LiveChat from "./LiveChat";
import PracticeQuestion from "./PracticeQuestion";
import TalkingAvatar from "./TalkingAvatar";
import LectureSlides from "./LectureSlides";
import { getUserData, saveUserData } from "@/lib/studybuddyStorage";
import { stopAllVoice, STOP_ALL_VOICE_EVENT } from "@/lib/voiceControl";
import { saveLecture, isLectureSaved } from "@/lib/savedLectures";
import type { StudyBuddySlide } from "@/app/api/studybuddy/generate-slides/route";

function buildFallbackSlides(sectionTitle: string, sectionContent: string): StudyBuddySlide[] {
  const trimmed = sectionContent.trim();
  if (!trimmed) {
    return [{ title: sectionTitle, bullets: ["Press Play to start the lesson."] }];
  }
  const blocks = trimmed.split(/\n\s*\n/).filter((b) => b.trim().length > 0);
  if (blocks.length === 0) {
    return [{ title: sectionTitle, bullets: [trimmed.slice(0, 200)] }];
  }
  return blocks.map((block, i) => {
    const lines = block.split("\n").map((l) => l.replace(/^[-*]\s*/, "").trim()).filter(Boolean);
    const firstLine = lines[0] ?? "";
    const isHeading = firstLine.length < 60 && (lines.length === 1 || lines[1]?.startsWith("-") || lines[1]?.startsWith("•"));
    const title = i === 0 ? sectionTitle : (isHeading ? firstLine : `Part ${i + 1}`);
    const bullets = isHeading && lines.length > 1 ? lines.slice(1) : lines;
    return { title, bullets: bullets.slice(0, 6) };
  });
}

const SCRIPT_CACHE_KEY = (sectionId: string, topic: string) =>
  `studybuddy_script_${sectionId}_${topic.replace(/\s+/g, "_")}`;

export type UploadedDocForContext = {
  id: string;
  name: string;
  file_type: string;
  extracted_text?: string;
  key_points: { pageNumber: number; points: string[] }[];
};

interface VideoTeacherProps {
  sectionTitle: string;
  sectionContent: string;
  sectionId: string;
  topic: string;
  fullTopicContent?: string;
  uploadedMaterials?: UploadedDocForContext[];
  sourceType?: "neural_networks" | "pdf";
  pdfId?: string;
  onComplete?: () => void;
  onBack?: () => void;
}

export default function VideoTeacher({
  sectionTitle,
  sectionContent,
  sectionId,
  topic,
  fullTopicContent = "",
  uploadedMaterials = [],
  sourceType = "neural_networks",
  pdfId,
  onComplete,
  onBack,
}: VideoTeacherProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [progress, setProgress] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [sidebarMode, setSidebarMode] = useState<"chat" | "practice">("chat");

  const userData = getUserData();
  const avatarName = userData?.avatarProfile.avatarName || "Tutor";
  const avatarConfig = userData?.avatarProfile.avatarConfig || {};
  const [personalityPrompt, setPersonalityPrompt] = useState(
    () => userData?.avatarProfile.teachingStylePrompt || "be clear and helpful"
  );
  const [teachingStyleOpen, setTeachingStyleOpen] = useState(false);
  const [teachingStyleDraft, setTeachingStyleDraft] = useState("");

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const skipNextStopAllRef = useRef(false);
  const weAreDispatchersRef = useRef(false);
  const narrationInFlightRef = useRef(false);
  const cancelPlaybackRef = useRef(false);
  const playbackSpeedRef = useRef(1.0);
  const volumeRef = useRef(1);
  const advanceRef = useRef<(() => void) | null>(null);
  const currentSentenceTextRef = useRef<string>("");

  const [volume, setVolume] = useState(1);

  // Expanded script (verbose, learner-friendly) or fallback to raw content
  const [narrationScript, setNarrationScript] = useState<string | null>(null);
  const [slides, setSlides] = useState<StudyBuddySlide[]>(() => buildFallbackSlides(sectionTitle, sectionContent));
  const [scriptLoading, setScriptLoading] = useState(true);

  const lectureContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const contentForSentences = narrationScript ?? sectionContent;
  const sentences = contentForSentences.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);

  const preloadedAudioRef = useRef<{ index: number; audio: HTMLAudioElement } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAdvanceRef = useRef(false);

  const [pauseCountdown, setPauseCountdown] = useState(0);

  isPlayingRef.current = isPlaying;
  playbackSpeedRef.current = playbackSpeed;
  volumeRef.current = volume;

  useEffect(() => {
    const u = getUserData();
    if (u?.avatarProfile.teachingStylePrompt) setPersonalityPrompt(u.avatarProfile.teachingStylePrompt);
  }, [teachingStyleOpen]);

  useEffect(() => {
    setSaved(isLectureSaved({ sectionId, sectionTitle, topic, sourceType, pdfId }));
  }, [sectionId, sectionTitle, topic, sourceType, pdfId]);

  // Preload first sentence's audio only after transcript is ready (so we don't preload raw section content)
  useEffect(() => {
    if (scriptLoading || sentences.length === 0 || currentSentenceIndex !== 0) return;
    const voiceId = avatarConfig.voiceId || undefined;
    fetch("/api/generate/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: sentences[0].trim(),
        speed: playbackSpeedRef.current,
        voice_id: voiceId,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.audioBase64) {
          const audio = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
          preloadedAudioRef.current = { index: 0, audio };
        }
      })
      .catch(() => {});
  }, [scriptLoading, sentences.length, currentSentenceIndex, avatarConfig.voiceId]);

  // Fetch expanded script (with cache for consistency) and slides on mount
  useEffect(() => {
    let cancelled = false;
    const cacheKey = SCRIPT_CACHE_KEY(sectionId, topic);

    setScriptLoading(true);
    const cachedScript =
      typeof sessionStorage !== "undefined" ? sessionStorage.getItem(cacheKey) : null;
    if (cachedScript) {
      setNarrationScript(cachedScript);
      setScriptLoading(false);
    }

    void (cachedScript
      ? Promise.resolve(null)
      : fetch("/api/studybuddy/expand-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionTitle,
            sectionContent,
            topic,
            personalityPrompt,
            fullTopicContent,
            uploadsContext: uploadedMaterials.map((u) => ({
              name: u.name,
              extracted_text: u.extracted_text,
              key_points: u.key_points,
            })),
          }),
        })
          .then((r) => r.ok ? r.json() : null)
          .then((data) => {
            if (!cancelled && data?.script) {
              setNarrationScript(data.script);
              try {
                sessionStorage.setItem(cacheKey, data.script);
              } catch {}
            }
            return data;
          })
          .catch(() => null)
          .finally(() => {
            if (!cancelled) setScriptLoading(false);
          }));

    void fetch("/api/studybuddy/generate-slides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionTitle, sectionContent, topic }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled) return;
        const hasContent = Array.isArray(data?.slides) && data.slides.length > 0 &&
          data.slides.some((s: StudyBuddySlide) => (s.bullets?.length ?? 0) > 0);
        if (hasContent) setSlides(data.slides);
        // Never set slides to empty; keep initial fallback on API failure or empty response
      })
      .catch(() => {
        // Keep current slides (initial fallback) on error
      });

    return () => {
      cancelled = true;
    };
  }, [sectionId, sectionTitle, sectionContent, topic, personalityPrompt, fullTopicContent, uploadedMaterials]);

  const openTeachingStyleModal = () => {
    setTeachingStyleDraft(personalityPrompt);
    setTeachingStyleOpen(true);
  };
  const saveTeachingStyle = () => {
    const next = teachingStyleDraft.trim() || "be clear and helpful";
    setPersonalityPrompt(next);
    const u = getUserData();
    if (u) {
      saveUserData({
        ...u,
        avatarProfile: {
          ...u.avatarProfile,
          teachingStylePrompt: next,
        },
      });
    }
    setTeachingStyleOpen(false);
  };

  const handlePlayPause = () => {
    if (scriptLoading) return;
    if (isPlaying) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = null;
      }
      setPauseCountdown(0);
      pendingAdvanceRef.current = false;
      narrationInFlightRef.current = false;
      cancelPlaybackRef.current = true;
      preloadedAudioRef.current = null;
      window.speechSynthesis.cancel();
      const audio = currentAudioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        currentAudioRef.current = null;
      }
      setIsPlaying(false);
      setIsSpeaking(false);
    } else {
      cancelPlaybackRef.current = false;
      abortControllerRef.current = new AbortController();
      if (currentSentenceIndex >= sentences.length) {
        setCurrentSentenceIndex(0);
        setProgress(0);
      }
      setIsPlaying(true);
    }
  };

  function stopOwnPlayback(clearPlayingState: boolean) {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
    setPauseCountdown(0);
    pendingAdvanceRef.current = false;
    narrationInFlightRef.current = false;
    cancelPlaybackRef.current = true;
    preloadedAudioRef.current = null;
    window.speechSynthesis.cancel();
    const audio = currentAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
    setCurrentText("");
    if (clearPlayingState) setIsPlaying(false);
  }

  async function narrateNextSentence() {
    if (currentSentenceIndex >= sentences.length) {
      narrationInFlightRef.current = false;
      setIsPlaying(false);
      setIsSpeaking(false);
      setProgress(100);
      // Coursera-style pause before next section
      if (onComplete) {
        pendingAdvanceRef.current = true;
        setPauseCountdown(3);
      }
      return;
    }
    if (narrationInFlightRef.current) return;
    narrationInFlightRef.current = true;

    cancelPlaybackRef.current = false;
    skipNextStopAllRef.current = true;
    weAreDispatchersRef.current = true;
    stopAllVoice();
    weAreDispatchersRef.current = false;
    const sentence = sentences[currentSentenceIndex].trim();
    setProgress((currentSentenceIndex / sentences.length) * 100);
    setIsSpeaking(true);
    // Subtitle: show ONLY when audio actually plays (not before)
    setCurrentText("");

    const advance = () => {
      if (advanceRef.current !== advance) return;
      advanceRef.current = null;
      narrationInFlightRef.current = false;
      if (!isPlayingRef.current) return;
      setIsSpeaking(false);
      setCurrentText("");
      setCurrentSentenceIndex((prev) => {
        const next = Math.min(prev + 1, sentences.length);
        setProgress((next / sentences.length) * 100);
        return next;
      });
    };

    advanceRef.current = advance;
    currentSentenceTextRef.current = sentence;

    const playAudio = (audio: HTMLAudioElement) => {
      audio.volume = volumeRef.current;
      currentAudioRef.current = audio;
      audio.onplay = () => {
        setCurrentText(sentence);
      };
      audio.onended = () => {
        currentAudioRef.current = null;
        if (advanceRef.current === advance) advance();
      };
      audio.onerror = () => {
        currentAudioRef.current = null;
        if (advanceRef.current === advance) fallbackBrowserTTS(sentence, advance);
      };
      audio.play();
    };

    const voiceId = avatarConfig.voiceId || undefined;

    // Use preloaded audio if available for this sentence
    const preloaded = preloadedAudioRef.current;
    if (preloaded && preloaded.index === currentSentenceIndex && preloaded.audio) {
      preloadedAudioRef.current = null;
      if (cancelPlaybackRef.current) {
        setIsSpeaking(false);
        narrationInFlightRef.current = false;
        return;
      }
      playAudio(preloaded.audio);
      return;
    }
    preloadedAudioRef.current = null;

    const signal = abortControllerRef.current?.signal;
    try {
      const res = await fetch("/api/generate/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sentence, speed: playbackSpeed, voice_id: voiceId }),
        signal,
      });
      if (cancelPlaybackRef.current) {
        setIsSpeaking(false);
        narrationInFlightRef.current = false;
        return;
      }
      if (res.ok) {
        const { audioBase64 } = await res.json();
        if (cancelPlaybackRef.current) {
          setIsSpeaking(false);
          narrationInFlightRef.current = false;
          return;
        }
        const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
        if (cancelPlaybackRef.current) {
          setIsSpeaking(false);
          narrationInFlightRef.current = false;
          return;
        }
        playAudio(audio);

        // Preload next sentence's audio in background
        const nextIdx = currentSentenceIndex + 1;
        if (nextIdx < sentences.length) {
          const nextSentence = sentences[nextIdx].trim();
          fetch("/api/generate/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: nextSentence, speed: playbackSpeed, voice_id: voiceId }),
            signal: abortControllerRef.current?.signal,
          })
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
              if (data?.audioBase64 && !cancelPlaybackRef.current) {
                const nextAudio = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
                preloadedAudioRef.current = { index: nextIdx, audio: nextAudio };
              }
            })
            .catch(() => {});
        }
        return;
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      // TTS API failed, use browser
    }
    if (cancelPlaybackRef.current) {
      setIsSpeaking(false);
      narrationInFlightRef.current = false;
      return;
    }
    setCurrentText(sentence);
    fallbackBrowserTTS(sentence, advance);
  }

  function fallbackBrowserTTS(sentence: string, onEnd: () => void, rate?: number) {
    if (cancelPlaybackRef.current) return;
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.rate = rate ?? playbackSpeedRef.current;
    utterance.pitch = 1;
    utterance.onend = () => onEnd();
    utterance.onerror = () => onEnd();
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    const onStopAll = () => {
      if (weAreDispatchersRef.current) {
        weAreDispatchersRef.current = false;
        return;
      }
      const skip = skipNextStopAllRef.current;
      if (skip) {
        skipNextStopAllRef.current = false;
        return;
      }
      stopOwnPlayback(true);
    };
    window.addEventListener(STOP_ALL_VOICE_EVENT, onStopAll);
    return () => {
      window.removeEventListener(STOP_ALL_VOICE_EVENT, onStopAll);
      window.speechSynthesis.cancel();
      const audio = currentAudioRef.current;
      if (audio) {
        audio.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  // Coursera-style pause countdown before next section (one interval, cleared when countdown hits 0)
  const countdownActive = pauseCountdown > 0;
  useEffect(() => {
    if (!countdownActive || !onComplete) return;
    const id = setInterval(() => {
      setPauseCountdown((prev) => {
        if (prev <= 1) {
          pendingAdvanceRef.current = false;
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    pauseTimeoutRef.current = id;
    return () => {
      clearInterval(id);
      pauseTimeoutRef.current = null;
    };
  }, [countdownActive, onComplete]);

  useEffect(() => {
    if (scriptLoading || !isPlaying || currentSentenceIndex >= sentences.length) return;
    narrateNextSentence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSentenceIndex, isPlaying, scriptLoading]);

  const currentSlideIndex = slides.length > 0
    ? Math.min(Math.floor((currentSentenceIndex / Math.max(sentences.length, 1)) * slides.length), slides.length - 1)
    : 0;

  const toggleFullscreen = () => {
    const el = lectureContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const handleSaveLecture = () => {
    saveLecture({ sectionId, sectionTitle, topic, sourceType, pdfId });
    setSaved(true);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Left: Lecture area - slides center, avatar top-right */}
      <div className="flex-1 flex flex-col min-w-0">
        <div
          ref={lectureContainerRef}
          className="flex-1 bg-[var(--background)] flex flex-col relative overflow-hidden"
        >
          {/* Header with Back Button and Fullscreen */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 bg-[var(--color-surface-elevated)]/90 hover:bg-[var(--color-surface)]/90 px-3 py-2 rounded-lg transition-colors"
                  title="Back to content selection"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="text-sm font-medium">Back</span>
                </button>
              )}
              <div className="bg-[var(--color-primary)]/90 px-4 py-2 rounded-lg">
                <p className="font-semibold text-[var(--color-primary-foreground)]">🎓 {avatarName}</p>
                <p className="text-xs text-[var(--color-primary-foreground)]/90">{topic}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-[var(--color-surface-elevated)]/90 hover:bg-[var(--color-surface)]/90 transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>

          {/* Avatar - top right, smaller */}
          <div className="absolute top-4 right-4 z-20">
            <div
              className={`transition-all duration-200 ${
                isSpeaking ? "scale-105 shadow-[0_0_20px_var(--color-primary)]" : "scale-100"
              }`}
            >
              <TalkingAvatar
                name={avatarName}
                avatarConfig={avatarConfig}
                size={120}
                isSpeaking={isSpeaking}
              />
            </div>
            {isSpeaking && (
              <div className="flex justify-center gap-1 mt-1">
                <div className="w-1.5 h-4 bg-[var(--color-success)] rounded animate-pulse" style={{ animationDelay: "0ms" }}></div>
                <div className="w-1.5 h-6 bg-[var(--color-success)] rounded animate-pulse" style={{ animationDelay: "150ms" }}></div>
                <div className="w-1.5 h-3 bg-[var(--color-success)] rounded animate-pulse" style={{ animationDelay: "300ms" }}></div>
                <div className="w-1.5 h-5 bg-[var(--color-success)] rounded animate-pulse" style={{ animationDelay: "450ms" }}></div>
              </div>
            )}
          </div>

          {/* Coursera-style pause: next section countdown */}
          {pauseCountdown > 0 && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 pointer-events-none">
              <div className="bg-[var(--color-surface-elevated)]/95 px-6 py-4 rounded-xl text-center shadow-xl">
                <p className="text-[var(--foreground)] font-medium">Next section in</p>
                <p className="text-3xl font-bold text-[var(--color-primary)] mt-1">{pauseCountdown}</p>
                <p className="text-[var(--muted-foreground)] text-sm mt-1">Take a moment to absorb the content</p>
              </div>
            </div>
          )}

          {/* Main content: Slides - always visible (fallback on init) */}
          <div className="flex-1 flex flex-col pt-16 pb-24">
            {scriptLoading && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-[var(--color-surface-elevated)]/90 px-3 py-1.5 rounded-full text-[var(--muted-foreground)] text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Preparing narration...
              </div>
            )}
            <LectureSlides
              slides={slides}
              currentIndex={currentSlideIndex}
              sectionTitle={sectionTitle}
            />
          </div>

          {/* YouTube-style subtitles: bottom, synced to audio */}
          {currentText && (
            <div className="absolute bottom-6 left-0 right-0 px-4 z-20 pointer-events-none">
              <p
                className="text-center text-[var(--foreground)] text-sm md:text-base max-w-3xl mx-auto line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.8)" }}
              >
                {currentText}
              </p>
            </div>
          )}
        </div>

        {/* Video Controls */}
        <div className="bg-[var(--color-surface-elevated)] p-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="w-full bg-[var(--muted)] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[var(--color-primary)] h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-[var(--muted-foreground)] mt-1">
              <span>
                {Math.min(currentSentenceIndex + 1, sentences.length)} / {sentences.length} sections
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handlePlayPause}
                disabled={scriptLoading}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] p-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={scriptLoading ? "Preparing narration..." : isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
              </button>

              <button
                onClick={() => {
                  abortControllerRef.current?.abort();
                  abortControllerRef.current = isPlaying ? new AbortController() : null;
                  narrationInFlightRef.current = false;
                  cancelPlaybackRef.current = true;
                  preloadedAudioRef.current = null;
                  window.speechSynthesis.cancel();
                  const audio = currentAudioRef.current;
                  if (audio) {
                    audio.pause();
                    audio.currentTime = 0;
                    currentAudioRef.current = null;
                  }
                  setCurrentText("");
                  setCurrentSentenceIndex((prev) => {
                    const next = Math.max(0, prev - 1);
                    setProgress((next / sentences.length) * 100);
                    return next;
                  });
                }}
                disabled={currentSentenceIndex === 0}
                className="bg-[var(--muted)] hover:bg-[var(--color-surface)] p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Go back"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  abortControllerRef.current?.abort();
                  abortControllerRef.current = isPlaying ? new AbortController() : null;
                  narrationInFlightRef.current = false;
                  cancelPlaybackRef.current = true;
                  preloadedAudioRef.current = null;
                  window.speechSynthesis.cancel();
                  const audio = currentAudioRef.current;
                  if (audio) {
                    audio.pause();
                    audio.currentTime = 0;
                    currentAudioRef.current = null;
                  }
                  setCurrentText("");
                  setCurrentSentenceIndex((prev) => {
                    const next = Math.min(prev + 1, sentences.length - 1);
                    setProgress((next / sentences.length) * 100);
                    return next;
                  });
                }}
                disabled={currentSentenceIndex >= sentences.length - 1}
                className="bg-[var(--muted)] hover:bg-[var(--color-surface)] p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Skip forward"
              >
                <SkipForward className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-[var(--muted-foreground)] shrink-0" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setVolume(v);
                    volumeRef.current = v;
                    if (currentAudioRef.current) currentAudioRef.current.volume = v;
                  }}
                  className="w-20 h-2 bg-[var(--muted)] rounded-lg appearance-none cursor-pointer [accent-color:var(--color-primary)]"
                  title="Volume"
                />
                <select
                  value={playbackSpeed}
                  onChange={(e) => {
                    narrationInFlightRef.current = false;
                    cancelPlaybackRef.current = true;
                    window.speechSynthesis.cancel();
                    const audio = currentAudioRef.current;
                    if (audio) {
                      audio.pause();
                      audio.currentTime = 0;
                      currentAudioRef.current = null;
                    }
                    const newSpeed = parseFloat(e.target.value);
                    setPlaybackSpeed(newSpeed);
                    playbackSpeedRef.current = newSpeed;
                    setIsSpeaking(false);
                    setIsPlaying(false);
                  }}
                  className="bg-[var(--muted)] text-[var(--foreground)] px-2 py-1 rounded text-sm"
                >
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1">1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveLecture}
              disabled={saved}
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-[var(--muted)]/80 transition-colors disabled:opacity-70"
              title={saved ? "Saved" : "Save lecture"}
            >
              {saved ? <BookmarkCheck className="w-5 h-5 text-[var(--color-success)]" /> : <Bookmark className="w-5 h-5 text-[var(--muted-foreground)]" />}
              <span className="text-sm text-[var(--foreground)]">{saved ? "Saved" : "Save lecture"}</span>
            </button>
            <button
              type="button"
              onClick={openTeachingStyleModal}
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-[var(--muted)]/80 transition-colors"
              title="Change teaching style"
            >
              <Settings className="w-5 h-5 text-[var(--muted-foreground)]" />
              <span className="text-sm text-[var(--foreground)]">
                Teaching Style: {personalityPrompt.slice(0, 28)}...
              </span>
            </button>
          </div>
        </div>

        {/* Description (YouTube-style) */}
        <div className="bg-[var(--color-surface-elevated)] border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => setDescriptionOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--muted)]/50 transition-colors"
          >
            <span className="font-semibold text-[var(--foreground)]">Description</span>
            {descriptionOpen ? <ChevronUp className="w-5 h-5 text-[var(--muted-foreground)]" /> : <ChevronDown className="w-5 h-5 text-[var(--muted-foreground)]" />}
          </button>
          {descriptionOpen && (
            <div className="px-4 pb-4 space-y-4 text-sm text-[var(--muted-foreground)] border-t border-[var(--border)] pt-3">
              <div>
                <h4 className="font-medium text-[var(--foreground)] mb-1">Summary</h4>
                <p className="whitespace-pre-wrap">{sectionContent}</p>
              </div>
              <div>
                <h4 className="font-medium text-[var(--foreground)] mb-1">Transcript</h4>
                <p className="whitespace-pre-wrap">{contentForSentences}</p>
              </div>
            </div>
          )}
        </div>

        {/* Teaching Style modal */}
        {teachingStyleOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setTeachingStyleOpen(false)}>
            <div
              className="bg-[var(--color-surface-elevated)] rounded-xl shadow-xl max-w-lg w-full p-6 border border-[var(--border)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[var(--foreground)]">Teaching Style</h3>
                <button onClick={() => setTeachingStyleOpen(false)} className="p-1 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-[var(--muted-foreground)] mb-2">
                How should your tutor explain things? (e.g. &quot;Clear and friendly, use sports analogies&quot;)
              </p>
              <textarea
                value={teachingStyleDraft}
                onChange={(e) => setTeachingStyleDraft(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-[var(--muted)] text-[var(--foreground)] placeholder-[var(--muted-foreground)]/70 border border-[var(--border)] focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                placeholder="e.g. Clear and friendly, use examples..."
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={saveTeachingStyle}
                  className="flex-1 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-primary-foreground)] font-medium rounded-lg"
                >
                  Save
                </button>
                <button
                  onClick={() => setTeachingStyleOpen(false)}
                  className="px-4 py-2 bg-[var(--muted)] hover:bg-[var(--color-surface)] text-[var(--foreground)] rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Right: Chat + Practice Sidebar */}
      <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-[var(--border)] flex flex-col">
        <div className="flex border-b border-[var(--border)]">
          <button
            onClick={() => setSidebarMode("chat")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              sidebarMode === "chat"
                ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                : "bg-[var(--color-surface-elevated)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Chat
          </button>
          <button
            onClick={() => setSidebarMode("practice")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              sidebarMode === "practice"
                ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                : "bg-[var(--color-surface-elevated)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Practice
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {sidebarMode === "chat" ? (
            <LiveChat
              topic={topic}
              section={sectionTitle}
              sectionContent={sectionContent}
              personalityPrompt={personalityPrompt}
              voiceId={avatarConfig.voiceId}
              uploadedMaterials={uploadedMaterials}
            />
          ) : (
            <PracticeQuestion
              sectionId={sectionId}
              sectionTitle={sectionTitle}
              sectionContent={sectionContent}
              topic={topic}
              personalityPrompt={personalityPrompt}
            />
          )}
        </div>
      </div>
    </div>
  );
}
