/**
 * Video Teaching Component - Twitch.tv Style
 * Features:
 * - Avatar video player with lip-sync animation
 * - Live chat sidebar
 * - Teaching controls (play, pause, speed)
 */

"use client";

import React, { useState, useEffect } from "react";
import { Play, Pause, SkipForward, Volume2, Settings } from "lucide-react";
import LiveChat from "./LiveChat";
import { getUserData } from "@/lib/studybuddyStorage";

interface VideoTeacherProps {
  sectionTitle: string;
  sectionContent: string;
  topic: string;
  onComplete?: () => void;
}

export default function VideoTeacher({
  sectionTitle,
  sectionContent,
  topic,
  onComplete,
}: VideoTeacherProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [progress, setProgress] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  
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

  // Generate avatar color from config
  const colors = [
    "bg-purple-500",
    "bg-blue-500",
    "bg-pink-500",
    "bg-green-500",
    "bg-indigo-500",
  ];
  const colorIndex = avatarConfig.hairColor
    ? avatarConfig.hairColor.charCodeAt(0) % colors.length
    : 0;
  const avatarBgColor = colors[colorIndex];

  const initials = avatarName
    ? avatarName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "AI";

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-900 text-white">
      {/* Left: Video Player Area (like Twitch main stream) */}
      <div className="flex-1 flex flex-col">
        {/* Video/Avatar Display */}
        <div className="flex-1 bg-black flex items-center justify-center relative">
          {/* Animated Avatar */}
          <div className="relative">
            <div
              className={`w-64 h-64 ${avatarBgColor} rounded-full flex items-center justify-center text-white text-8xl font-bold shadow-2xl border-8 border-white transition-all duration-200 ${
                isSpeaking ? "scale-105 shadow-purple-500/50" : "scale-100"
              }`}
            >
              {initials}
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

          {/* Tutor Name Overlay */}
          <div className="absolute top-4 left-4 bg-purple-600/90 px-4 py-2 rounded-lg">
            <p className="font-semibold">🎓 {avatarName}</p>
            <p className="text-xs text-purple-200">{topic}</p>
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

      {/* Right: Chat Sidebar (like Twitch chat) */}
      <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-700">
        <LiveChat
          topic={topic}
          section={sectionTitle}
          personalityPrompt={personalityPrompt}
        />
      </div>
    </div>
  );
}
