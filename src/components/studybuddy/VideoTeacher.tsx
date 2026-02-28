/**
 * Video Teaching Component - Twitch.tv Style
 * Features:
 * - Avatar video player with lip-sync animation
 * - Live chat sidebar
 * - Teaching controls (play, pause, speed)
 */

"use client";

import React, { useState, useEffect } from "react";
import { Play, Pause, SkipForward, Volume2, Settings, ArrowLeft, MessageCircle, BookOpen } from "lucide-react";
import LiveChat from "./LiveChat";
import PracticeQuestion from "./PracticeQuestion";
import { CustomAvatar } from "./AvatarStudio";
import { getUserData } from "@/lib/studybuddyStorage";

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
  const avatarName = userData?.name || "Tutor";
  const avatarConfig = userData?.avatarConfig || {};
  const personalityPrompt = userData?.personalityPrompt || "be clear and helpful";

  // Split content into sentences for narration
  const sentences = sectionContent.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);

  // Handle play/pause
  const handlePlayPause = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsSpeaking(false);
    } else {
      setIsPlaying(true);
      startNarration();
    }
  };

  // Start narration from current position
  const startNarration = () => {
    if (currentSentenceIndex >= sentences.length) {
      setCurrentSentenceIndex(0);
      setProgress(0);
    }
    narrateNextSentence();
  };

  // Narrate the next sentence
  const narrateNextSentence = () => {
    if (currentSentenceIndex >= sentences.length) {
      setIsPlaying(false);
      setIsSpeaking(false);
      setProgress(100);
      if (onComplete) onComplete();
      return;
    }

    const sentence = sentences[currentSentenceIndex].trim();
    setCurrentText(sentence);
    setIsSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.rate = playbackSpeed;
    utterance.pitch = 1;
    
    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentSentenceIndex((prev) => prev + 1);
      setProgress(((currentSentenceIndex + 1) / sentences.length) * 100);
      
      // Continue to next sentence after a brief pause
      if (isPlaying) {
        setTimeout(() => {
          narrateNextSentence();
        }, 500);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Clean up speech synthesis on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Update narration when playing state or sentence index changes
  useEffect(() => {
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
          {/* Animated Avatar */}
          <div className="relative">
            <div
              className={`transition-all duration-200 ${
                isSpeaking ? "scale-105 shadow-purple-500/50" : "scale-100"
              }`}
            >
              <CustomAvatar
                name={avatarName}
                avatarConfig={avatarConfig}
                size={256}
              />
            </div>
            
            {/* Speaking Indicator */}
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

          {/* Current Text Overlay (Subtitles) */}
          {currentText && (
            <div className="absolute bottom-8 left-0 right-0 px-8">
              <div className="bg-black/80 backdrop-blur-sm px-6 py-4 rounded-lg max-w-4xl mx-auto">
                <p className="text-xl text-center leading-relaxed">{currentText}</p>
              </div>
            </div>
          )}

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
                <p className="font-semibold">🎓 {avatarName}</p>
                <p className="text-xs text-purple-200">{topic}</p>
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
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>
                {currentSentenceIndex} / {sentences.length} sections
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
                <Volume2 className="w-5 h-5 text-gray-400" />
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
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

            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-400">
                Teaching Style: {personalityPrompt.slice(0, 30)}...
              </span>
            </div>
          </div>
        </div>

        {/* Section Info */}
        <div className="bg-gray-800 border-t border-gray-700 p-4">
          <h2 className="text-xl font-bold mb-2">{sectionTitle}</h2>
          <p className="text-gray-400 text-sm">
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
              personalityPrompt={personalityPrompt}
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
