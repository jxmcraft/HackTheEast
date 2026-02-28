/**
 * Video Teaching Component - Twitch.tv Style
 * Features:
 * - Avatar video player with lip-sync animation
 * - Live chat sidebar
 * - Teaching controls (play, pause, speed)
 */

"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipForward, Volume2, Settings, ArrowLeft, MessageCircle, BookOpen, X } from "lucide-react";
import LiveChat from "./LiveChat";
import PracticeQuestion from "./PracticeQuestion";
import TalkingAvatar from "./TalkingAvatar";
import { getUserData, saveUserData } from "@/lib/studybuddyStorage";
import { stopAllVoice, STOP_ALL_VOICE_EVENT } from "@/lib/voiceControl";
import LessonDiagram from "./LessonDiagram";

interface VideoTeacherProps {
  sectionTitle: string;
  sectionContent: string;
  sectionId: string;
  topic: string;
  onComplete?: () => void;
  onBack?: () => void;
}

export default function VideoTeacher({
  sectionTitle,
  sectionContent,
  sectionId,
  topic,
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
  const cancelPlaybackRef = useRef(false);
  const playbackSpeedRef = useRef(1.0);
  const volumeRef = useRef(1);
  const advanceRef = useRef<(() => void) | null>(null);
  const currentSentenceTextRef = useRef<string>("");

  const [volume, setVolume] = useState(1);

  // Split content into sentences for narration (revision content)
  const sentences = sectionContent.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);

  isPlayingRef.current = isPlaying;
  playbackSpeedRef.current = playbackSpeed;
  volumeRef.current = volume;

  useEffect(() => {
    const u = getUserData();
    if (u?.avatarProfile.teachingStylePrompt) setPersonalityPrompt(u.avatarProfile.teachingStylePrompt);
  }, [teachingStyleOpen]);

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
    if (isPlaying) {
      cancelPlaybackRef.current = true;
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoTeacher.tsx:handlePlayPause(Play)',message:'Play pressed',data:{cancelBefore:cancelPlaybackRef.current},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      cancelPlaybackRef.current = false;
      if (currentSentenceIndex >= sentences.length) {
        setCurrentSentenceIndex(0);
        setProgress(0);
      }
      setIsPlaying(true);
    }
  };

  function stopOwnPlayback(clearPlayingState: boolean) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoTeacher.tsx:stopOwnPlayback',message:'stopOwnPlayback called, setting cancel=true',data:{clearPlayingState},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    cancelPlaybackRef.current = true;
    window.speechSynthesis.cancel();
    const audio = currentAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
    if (clearPlayingState) setIsPlaying(false);
  }

  async function narrateNextSentence() {
    if (currentSentenceIndex >= sentences.length) {
      setIsPlaying(false);
      setIsSpeaking(false);
      setProgress(100);
      if (onComplete) onComplete();
      return;
    }

    cancelPlaybackRef.current = false;
    skipNextStopAllRef.current = true;
    weAreDispatchersRef.current = true;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoTeacher.tsx:narrateNextSentence:beforeStopAllVoice',message:'about to call stopAllVoice',data:{cancelNow:cancelPlaybackRef.current,sentenceIndex:currentSentenceIndex},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    stopAllVoice();
    weAreDispatchersRef.current = false;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoTeacher.tsx:narrateNextSentence:afterStopAllVoice',message:'after stopAllVoice',data:{cancelNow:cancelPlaybackRef.current},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const sentence = sentences[currentSentenceIndex].trim();
    setCurrentText(sentence);
    setIsSpeaking(true);

    const advance = () => {
      if (!isPlayingRef.current) return;
      setIsSpeaking(false);
      setCurrentSentenceIndex((prev) => {
        const next = Math.min(prev + 1, sentences.length);
        setProgress((next / sentences.length) * 100);
        return next;
      });
      setTimeout(() => {
        if (isPlayingRef.current) narrateNextSentence();
      }, 300);
    };

    advanceRef.current = advance;
    currentSentenceTextRef.current = sentence;

    const voiceId = avatarConfig.voiceId || undefined;
    try {
      const res = await fetch("/api/generate/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sentence, speed: playbackSpeed, voice_id: voiceId }),
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoTeacher.tsx:afterTTSFetch',message:'TTS fetch completed',data:{resOk:res.ok,cancelNow:cancelPlaybackRef.current},timestamp:Date.now(),hypothesisId:'A,C,E'})}).catch(()=>{});
      // #endregion
      if (cancelPlaybackRef.current) {
        setIsSpeaking(false);
        return;
      }
      if (res.ok) {
        const { audioBase64 } = await res.json();
        if (cancelPlaybackRef.current) {
          setIsSpeaking(false);
          return;
        }
        const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
        audio.volume = volumeRef.current;
        currentAudioRef.current = audio;
        audio.onended = () => {
          currentAudioRef.current = null;
          advance();
        };
        audio.onerror = () => {
          currentAudioRef.current = null;
          fallbackBrowserTTS(sentence, advance);
        };
        if (cancelPlaybackRef.current) {
          currentAudioRef.current = null;
          setIsSpeaking(false);
          return;
        }
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoTeacher.tsx:audio.play',message:'calling audio.play()',data:{},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        await audio.play();
        return;
      }
    } catch {
      // TTS API failed, use browser
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoTeacher.tsx:fallbackTTS',message:'using fallbackBrowserTTS',data:{cancelNow:cancelPlaybackRef.current},timestamp:Date.now(),hypothesisId:'C,E'})}).catch(()=>{});
    // #endregion
    if (cancelPlaybackRef.current) {
      setIsSpeaking(false);
      return;
    }
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoTeacher.tsx:onStopAll',message:'STOP_ALL_VOICE_EVENT weAreDispatcher skip',data:{},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        return;
      }
      const skip = skipNextStopAllRef.current;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoTeacher.tsx:onStopAll',message:'STOP_ALL_VOICE_EVENT received',data:{skip,callingStopOwnPlayback:!skip},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion
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

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b4376a79-f653-4c48-8ff8-e5fbe86d419a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoTeacher.tsx:useEffect(narrate)',message:'narration effect',data:{isPlaying,currentSentenceIndex,sentencesLen:sentences.length,willCall:isPlaying && currentSentenceIndex < sentences.length},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (isPlaying && currentSentenceIndex < sentences.length) {
      narrateNextSentence();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSentenceIndex, isPlaying]);

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-900 text-white">
      {/* Left: Video Player Area (like Twitch main stream) */}
      <div className="flex-1 flex flex-col">
        {/* Video/Avatar Display */}
        <div className="flex-1 bg-black flex items-center justify-center relative">
          {/* Talking Avatar with mouth animation */}
          <div className="relative">
            <div
              className={`transition-all duration-200 ${
                isSpeaking ? "scale-105 shadow-purple-500/50" : "scale-100"
              }`}
            >
              <TalkingAvatar
                name={avatarName}
                avatarConfig={avatarConfig}
                size={256}
                isSpeaking={isSpeaking}
              />
            </div>
            {isSpeaking && (
              <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
                <div className="flex gap-1">
                  <div className="w-2 h-8 bg-green-500 rounded animate-pulse" style={{ animationDelay: "0ms" }}></div>
                  <div className="w-2 h-12 bg-green-500 rounded animate-pulse" style={{ animationDelay: "150ms" }}></div>
                  <div className="w-2 h-6 bg-green-500 rounded animate-pulse" style={{ animationDelay: "300ms" }}></div>
                  <div className="w-2 h-10 bg-green-500 rounded animate-pulse" style={{ animationDelay: "450ms" }}></div>
                </div>
              </div>
            )}
          </div>

          {/* Current Text Overlay (Subtitles) - compact size */}
          {currentText && (
            <div className="absolute bottom-6 left-0 right-0 px-6">
              <div className="bg-black/80 backdrop-blur-sm px-4 py-2 rounded-lg max-w-3xl mx-auto">
                <p className="text-sm text-center leading-relaxed text-white">{currentText}</p>
              </div>
            </div>
          )}

          {/* Interactive diagram (TED-Ed style) for current section */}
          <LessonDiagram sectionId={sectionId} topicId={topic === "Neural Networks Basics" ? "neural_networks" : undefined} />

          {/* Header with Back Button */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 bg-gray-800/90 hover:bg-gray-700/90 px-3 py-2 rounded-lg transition-colors"
                  title="Back to content selection"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="text-sm font-medium">Back</span>
                </button>
              )}
              <div className="bg-purple-600/90 px-4 py-2 rounded-lg">
                <p className="font-semibold text-white">🎓 {avatarName}</p>
                <p className="text-xs text-white/90">{topic}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Video Controls */}
        <div className="bg-gray-800 p-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-purple-600 h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-300 mt-1">
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
                className="bg-purple-600 hover:bg-purple-700 p-3 rounded-full transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
              </button>

              <button
                onClick={() => {
                  window.speechSynthesis.cancel();
                  const audio = currentAudioRef.current;
                  if (audio) {
                    audio.pause();
                    audio.currentTime = 0;
                    currentAudioRef.current = null;
                  }
                  setCurrentSentenceIndex((prev) =>
                    Math.min(prev + 1, sentences.length - 1)
                  );
                }}
                className="bg-gray-700 hover:bg-gray-600 p-2 rounded transition-colors"
                title="Skip forward"
              >
                <SkipForward className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-gray-300 shrink-0" />
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
                  className="w-20 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  title="Volume"
                />
                <select
                  value={playbackSpeed}
                  onChange={(e) => {
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
                  className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
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
              onClick={openTeachingStyleModal}
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-gray-700/80 transition-colors"
              title="Change teaching style"
            >
              <Settings className="w-5 h-5 text-gray-300" />
              <span className="text-sm text-white">
                Teaching Style: {personalityPrompt.slice(0, 28)}...
              </span>
            </button>
          </div>
        </div>

        {/* Teaching Style modal */}
        {teachingStyleOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setTeachingStyleOpen(false)}>
            <div
              className="bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6 border border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Teaching Style</h3>
                <button onClick={() => setTeachingStyleOpen(false)} className="p-1 rounded hover:bg-gray-700 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-400 mb-2">
                How should your tutor explain things? (e.g. &quot;Clear and friendly, use sports analogies&quot;)
              </p>
              <textarea
                value={teachingStyleDraft}
                onChange={(e) => setTeachingStyleDraft(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white placeholder-gray-500 border border-gray-600 focus:ring-2 focus:ring-purple-500 resize-none"
                placeholder="e.g. Clear and friendly, use examples..."
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={saveTeachingStyle}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg"
                >
                  Save
                </button>
                <button
                  onClick={() => setTeachingStyleOpen(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section Info */}
        <div className="bg-gray-800 border-t border-gray-700 p-4">
          <h2 className="text-xl font-bold mb-2">{sectionTitle}</h2>
          <p className="text-gray-300 text-sm">
            {sentences.length} segments • Interactive Q&A available in chat →
          </p>
        </div>
      </div>

      {/* Right: Chat + Practice Sidebar */}
      <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-700 flex flex-col">
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setSidebarMode("chat")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              sidebarMode === "chat"
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Chat
          </button>
          <button
            onClick={() => setSidebarMode("practice")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              sidebarMode === "practice"
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
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
