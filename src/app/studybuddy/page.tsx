/**
 * Main StudyBuddy Page
 * Orchestrates the full user flow:
 * 1. Avatar Studio (if new user)
 * 2. Content Selection (Neural Networks sections)
 * 3. Voiced lesson + Chat + Practice
 */

"use client";

import React, { useState, useEffect } from "react";
import AvatarStudio from "@/components/studybuddy/AvatarStudio";
import VideoTeacher from "@/components/studybuddy/VideoTeacher";
import { NEURAL_NETWORKS_TOPIC, getAllSections, getSectionById } from "@/lib/neuralNetworksContent";
import { getAllPDFLectures, getPDFLectureById } from "@/lib/pdfContent";
import { getUserData, initializeUser, updateLastSection } from "@/lib/studybuddyStorage";
import { Play, FileText, Book } from "lucide-react";

type PageState = "setup" | "content-selection" | "lesson";

export default function StudyBuddyPage() {
  const [pageState, setPageState] = useState<PageState>("setup");
  const [currentSectionId, setCurrentSectionId] = useState("intro");
  const [currentSourceType, setCurrentSourceType] = useState<"neural_networks" | "pdf">("neural_networks");
  const [currentPDFId, setCurrentPDFId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const sections = getAllSections();
  const pdfLectures = getAllPDFLectures();
  const userData = getUserData();

  // Get current content based on source type
  const getCurrentSection = () => {
    if (currentSourceType === "pdf" && currentPDFId) {
      const pdfLecture = getPDFLectureById(currentPDFId);
      return pdfLecture?.sections.find((s) => s.id === currentSectionId);
    }
    return getSectionById(currentSectionId);
  };

  const getCurrentTopic = () => {
    if (currentSourceType === "pdf" && currentPDFId) {
      const pdfLecture = getPDFLectureById(currentPDFId);
      return pdfLecture?.title || "PDF Lecture";
    }
    return NEURAL_NETWORKS_TOPIC.title;
  };

  const currentSection = getCurrentSection();
  const currentTopic = getCurrentTopic();

  // Initialize on mount
  useEffect(() => {
    const user = getUserData();
    if (user) {
      setPageState("content-selection");
      setCurrentSectionId(user.lastSection);
    } else {
      setPageState("setup");
    }
    setIsLoading(false);
  }, []);

  const handleAvatarStudioComplete = (config: { name: string; avatarConfig: Record<string, string>; personalityPrompt: string }) => {
    initializeUser(config.name, config.avatarConfig, config.personalityPrompt);
    setPageState("content-selection");
  };

  const handleSelectSection = (sectionId: string, sourceType: "neural_networks" | "pdf" = "neural_networks", pdfId?: string) => {
    setCurrentSectionId(sectionId);
    setCurrentSourceType(sourceType);
    if (pdfId) setCurrentPDFId(pdfId);
    updateLastSection(currentTopic, sectionId);
    setPageState("lesson");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg font-semibold text-gray-600">Loading...</div>
      </div>
    );
  }

  // Page 1: Avatar Studio Setup
  if (pageState === "setup") {
    return <AvatarStudio onComplete={handleAvatarStudioComplete} />;
  }

  // Page 2: Content Selection
  if (pageState === "content-selection") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Greeting */}
          {userData && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome back, {userData.name}! 👋
              </h1>
              <p className="text-gray-600">
                Choose from pre-loaded lectures or PDFs
              </p>
            </div>
          )}

          {/* Neural Networks Topic */}
          <div className="mb-8">
            <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <Book className="w-6 h-6 text-purple-600" />
                <h2 className="text-2xl font-bold text-gray-900">
                  {NEURAL_NETWORKS_TOPIC.title}
                </h2>
              </div>
              <p className="text-gray-600 mb-2">{NEURAL_NETWORKS_TOPIC.description}</p>
              <p className="text-sm text-purple-600 font-medium">
                Interactive video lessons with live chat
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleSelectSection(section.id, "neural_networks")}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition-all duration-200 p-6 text-left group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600">
                      {section.order}. {section.title}
                    </h3>
                    <Play className="w-5 h-5 text-purple-400 group-hover:text-purple-600 transition-colors" />
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {section.content.substring(0, 100)}...
                  </p>
                  <p className="text-xs text-purple-600 mt-3 font-medium">🎥 Video Lesson</p>
                </button>
              ))}
            </div>
          </div>

          {/* PDF Lectures */}
          <div>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-lg p-6 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-6 h-6" />
                <h2 className="text-2xl font-bold">
                  PDF Lectures
                </h2>
              </div>
              <p className="text-blue-100">
                Learn from textbooks, lecture slides, and academic papers
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pdfLectures.map((pdfLecture) => (
                <div key={pdfLecture.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {pdfLecture.title}
                      </h3>
                      <p className="text-xs text-gray-500">{pdfLecture.source}</p>
                    </div>
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="space-y-2">
                    {pdfLecture.sections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => handleSelectSection(section.id, "pdf", pdfLecture.id)}
                        className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">
                            {section.title}
                          </span>
                          <Play className="w-4 h-4 text-blue-400 group-hover:text-blue-600" />
                        </div>
                        {section.pageNumbers && (
                          <span className="text-xs text-gray-500">{section.pageNumbers}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Attribution */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>Powered by MiniMax abab6.5 • Voice by MiniMax Speech</p>
          </div>
        </div>
      </div>
    );
  }

  // Page 3: Lesson with Video Teacher
  if (pageState === "lesson" && currentSection) {
    return (
      <VideoTeacher
        sectionTitle={currentSection.title}
        sectionContent={currentSection.content}
        topic={currentTopic}
        onComplete={() => {
          // Optional: Navigate back or to next section
          setPageState("content-selection");
        }}
      />
    );
  }

  return null;
}
